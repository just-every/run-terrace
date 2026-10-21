// OPS-003: the records a workflow runs on. A subject is found by a template's trigger and conditions, only inside the
// actor's portfolios, and is rechecked on every step: when it has moved on, the run pauses instead of acting on it.
import { all, reaches, reachesPortfolio, type Context, type Row } from './core'
import { ageReceivables } from './delinquency-math'
import { localDate } from './zones'
import { daysBetween } from './format'
import { SUBJECT } from './workflow-spec'

export type Subject = { kind: string; id: string; tenancyId: string | null; unitId: string | null; portfolioId: string | null; propertyId: string | null; label: string; zone: string }
const within = (c: Context, s: Subject) => s.portfolioId ? reachesPortfolio(c, s.portfolioId) : reaches(c, s.unitId)

async function tenancies(c: Context, extra = '', ...values: unknown[]) {
 return all(c, `SELECT t.*,u.property_id,p.portfolio_id,p.name AS property_name,u.identifier AS unit_name,COALESCE(p.time_zone,t.time_zone) AS zone FROM tt_tenancies t LEFT JOIN tt_units u ON u.id=t.unit_id LEFT JOIN tt_properties p ON p.id=u.property_id WHERE t.erased_at IS NULL${extra}`, ...values)
}
const tenancySubject = (t: Row, label: string): Subject => ({ kind: 'tenancy', id: t.id, tenancyId: t.id, unitId: t.unit_id, portfolioId: t.portfolio_id ?? null, propertyId: t.property_id ?? null, label, zone: t.zone })

/** What each receivable looks like today for these leases. */
async function arrears(c: Context, leases: Row[]) {
 if (!leases.length) return new Map<string, ReturnType<typeof ageReceivables>>()
 const [charges, receipts, adjustments] = await Promise.all([all(c, 'SELECT * FROM tt_charges ORDER BY due_date,id'), all(c, 'SELECT * FROM tt_net_receipts ORDER BY received_date,id'), all(c, 'SELECT * FROM tt_adjustments ORDER BY at,id')])
 return new Map(leases.map(t => [t.id, ageReceivables({ ...t, time_zone: t.zone }, charges, receipts, adjustments, localDate(c.now, t.zone))]))
}
const oldestOverdue = (a: ReturnType<typeof ageReceivables>) => Math.max(0, ...a.charges.filter(q => q.outstandingCents > 0 && q.ageDays > 0).map(q => q.ageDays))

/** Subjects matching a template's trigger and conditions, in the actor's scope. `only` limits the search to one subject. */
export async function matching(c: Context, tpl: Row, only?: string): Promise<Subject[]> {
 const { trigger, conditions } = tpl, kind: string = tpl.kind, out: Subject[] = []
 const property = (s: Subject) => !conditions.propertyId || s.propertyId === conditions.propertyId
 if (kind === 'renewal') {
  const rows = await all(c, "SELECT r.id AS renewal_id,r.lease_end,r.tenancy_id,t.unit_id,t.address,COALESCE(p.time_zone,t.time_zone) AS zone,u.property_id,p.portfolio_id FROM tt_renewals r JOIN tt_tenancies t ON t.id=r.tenancy_id LEFT JOIN tt_units u ON u.id=t.unit_id LEFT JOIN tt_properties p ON p.id=u.property_id WHERE t.erased_at IS NULL AND t.ended_on IS NULL AND r.lease_end=t.end_date AND r.state IN ('open','countered')" + (only ? ' AND r.id=?' : ''), ...(only ? [only] : []))
  for (const r of rows) {
   const s: Subject = { kind: 'renewal', id: r.renewal_id, tenancyId: r.tenancy_id, unitId: r.unit_id, portfolioId: r.portfolio_id ?? null, propertyId: r.property_id ?? null, label: `Renewal · ${r.address} · lease ends ${r.lease_end}`, zone: r.zone }
   if (within(c, s) && property(s) && daysBetween(localDate(c.now, s.zone), r.lease_end) <= trigger.daysBeforeLeaseEnd) out.push(s)
  }
 } else if (kind === 'unit_turn') {
  const rows = await all(c, "SELECT b.id,b.unit_id,b.move_out,u.property_id,u.identifier,p.portfolio_id,p.name,p.time_zone AS zone FROM tt_turnovers b JOIN tt_units u ON u.id=b.unit_id JOIN tt_properties p ON p.id=u.property_id WHERE b.state='open'" + (only ? ' AND b.id=?' : ''), ...(only ? [only] : []))
  for (const r of rows) {
   const s: Subject = { kind: 'turnover', id: r.id, tenancyId: null, unitId: r.unit_id, portfolioId: r.portfolio_id, propertyId: r.property_id, label: `Unit turn · ${r.name} unit ${r.identifier} · moved out ${r.move_out}`, zone: r.zone }
   if (within(c, s) && property(s)) out.push(s)
  }
 } else if (kind === 'leasing') {
  const rows = await all(c, "SELECT x.id,x.property_id,x.portfolio_id,x.last_activity_at,x.first_source,p.name,p.time_zone AS zone FROM tt_prospects x JOIN tt_properties p ON p.id=x.property_id WHERE x.merged_into IS NULL AND x.stage='enquiry' AND x.review<>'possible_duplicate'" + (only ? ' AND x.id=?' : ''), ...(only ? [only] : []))
  for (const r of rows) {
   const s: Subject = { kind: 'prospect', id: r.id, tenancyId: null, unitId: null, portfolioId: r.portfolio_id, propertyId: r.property_id, label: `Prospect enquiry · ${r.name} · ${r.first_source.replace('_', ' ')}`, zone: r.zone }
   if (within(c, s) && property(s) && daysBetween(localDate(r.last_activity_at, s.zone), localDate(c.now, s.zone)) >= trigger.staleDays) out.push(s)
  }
 } else {
  const leases = await tenancies(c, only ? ' AND t.id=?' : '', ...(only ? [only] : []))
  const reachable = leases.filter(t => tenancySubject(t, '') && within(c, tenancySubject(t, '')))
  const aged = await arrears(c, reachable)
  for (const t of reachable) {
   const a = aged.get(t.id)!, age = oldestOverdue(a), s = tenancySubject(t, `${kind === 'rent' ? 'Rent' : 'Delinquency'} · ${t.property_name ? `${t.property_name} unit ${t.unit_name}` : t.address} · ${age} days past due`)
   const rentWindow = kind === 'rent' ? age <= 30 : true
   if (property(s) && a.overdueCents > 0 && age >= trigger.minDaysPastDue && rentWindow && a.overdueCents >= (conditions.minOverdueCents ?? 1)) out.push(s)
  }
 }
 return out
}

/** The record a run is on, as it is now, or why it is no longer a safe place to act. */
export async function standing(c: Context, run: Row, gate: string | null): Promise<{ reason: string | null; goal: boolean }> {
 const kind = run.subject_kind
 if (kind === 'renewal') {
  const r = (await all(c, 'SELECT r.state,r.lease_end,t.end_date,t.ended_on,t.erased_at FROM tt_renewals r JOIN tt_tenancies t ON t.id=r.tenancy_id WHERE r.id=?', run.subject_id))[0]
  if (!r || r.erased_at) return { reason: 'subject_missing', goal: false }
  if (r.state === 'executed') return { reason: gate === 'renewal_executed' ? null : 'subject_resolved', goal: true }
  if (['nonrenewal', 'month_to_month'].includes(r.state)) return { reason: 'subject_resolved', goal: false }
  return { reason: r.lease_end !== r.end_date || r.ended_on ? 'subject_changed' : null, goal: false }
 }
 if (kind === 'turnover') {
  const b = (await all(c, 'SELECT state FROM tt_turnovers WHERE id=?', run.subject_id))[0]
  return b ? { reason: null, goal: b.state === 'ready' } : { reason: 'subject_missing', goal: false }
 }
 if (kind === 'prospect') {
  const p = (await all(c, 'SELECT stage,merged_into FROM tt_prospects WHERE id=?', run.subject_id))[0]
  if (!p) return { reason: 'subject_missing', goal: false }
  if (p.stage === 'leased') return { reason: gate === 'prospect_leased' ? null : 'subject_resolved', goal: true }
  return { reason: p.merged_into || p.stage === 'lost' ? 'subject_changed' : null, goal: false }
 }
 const t = (await tenancies(c, ' AND t.id=?', run.subject_id))[0]
 if (!t) return { reason: 'subject_missing', goal: false }
 const a = (await arrears(c, [t])).get(t.id)!, clear = a.overdueCents === 0
 return { reason: clear ? (gate === 'balance_cleared' ? null : 'subject_resolved') : null, goal: clear }
}
export const subjectKind = (kind: string) => SUBJECT[kind]
