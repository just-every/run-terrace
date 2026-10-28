import {collectionCase} from './arrears-state'
import {effectiveCharges,hapEffects} from './hap-balances'
import {phaReceipts} from './hap-reconciliation'
import {hapData} from './hap-charges'
import {externalFundsAsOf} from './payments'
import { all, allow, can, commit, date, guard, id, insist, one, reaches, reachesPortfolio, sql, tenancy, text, type Context, type Row } from './core'
import { ageReceivables } from './delinquency-math'
import { ownershipData, sharesOn } from './owners'
import { rights } from './households'
import { localDate } from './zones'

export const DELINQUENCY_COMMANDS = ['delinquency.assign']
const operational = (c: Context) => c.actor.role === 'owner' || ['portfolio_manager','bookkeeper'].includes(c.actor.staff?.role ?? '')
// A unitless tenancy requires all-portfolio authority; a portfolio-scoped person cannot be assigned to it.
const eligible = `o.status='active' AND (o.role='owner' OR EXISTS(
 SELECT 1 FROM tt_staff_roles r JOIN tt_role_actions k ON k.role=r.role
 WHERE r.operator_id=o.id AND r.role IN ('portfolio_manager','bookkeeper') AND k.action='arrears.prepare'
 AND (r.all_portfolios=1 OR (? IS NOT NULL AND EXISTS(SELECT 1 FROM tt_role_portfolios rp WHERE rp.operator_id=o.id AND rp.portfolio_id=?)))))`
const target = (c: Context, operatorId: string, portfolioId: string | null) => one(c, `SELECT o.id,o.display_name FROM oa_operators o WHERE o.id=? AND ${eligible}`, operatorId, portfolioId, portfolioId)

export async function delinquencyCommand(c: Context, name: string, p: Row): Promise<Row | undefined> {
 if (!DELINQUENCY_COMMANDS.includes(name)) return
 allow(c, 'arrears.prepare')
 insist(operational(c), 'forbidden', 'Only the owner, portfolio managers and bookkeepers assign collection follow-up.', 403)
 const t = await tenancy(c, p.tenancyId), assignedTo = text(p.assignedTo, 'Follow-up owner', 100), reference = text(p.reference, 'Assignment reference', 500)
 const scope = t.unit_id ? await one(c, 'SELECT p.portfolio_id FROM tt_units u JOIN tt_properties p ON p.id=u.property_id WHERE u.id=?', t.unit_id) : null
 const portfolioId: string | null = scope?.portfolio_id ?? null
 insist(!t.unit_id || scope && reachesPortfolio(c, portfolioId!), 'not_found', 'Tenancy not found.', 404)
 const old = await one(c, 'SELECT * FROM tt_delinquency_assignments WHERE tenancy_id=?', t.id), version = Number(p.version)
 insist(p.version !== undefined && Number.isInteger(version) && version >= 0 && version === (old?.version ?? 0), 'conflict', 'Reload the current follow-up assignment.', 409)
 insist(await target(c, assignedTo, portfolioId), 'not_eligible', 'Choose an active owner, portfolio manager or bookkeeper over this tenancy’s portfolio.', 409)
 c.source = reference
 const writes = [
  guard(c, 'EXISTS(SELECT 1 FROM tt_tenancies WHERE id=? AND version=? AND unit_id IS ? AND erased_at IS NULL)', t.id, t.version, t.unit_id),
  guard(c, 'COALESCE((SELECT version FROM tt_delinquency_assignments WHERE tenancy_id=?),0)=?', t.id, version),
  guard(c, `EXISTS(SELECT 1 FROM oa_operators o WHERE o.id=? AND ${eligible})`, assignedTo, portfolioId, portfolioId),
  guard(c, `EXISTS(SELECT 1 FROM oa_operators o WHERE o.id=? AND ${eligible})`, c.actor.id, portfolioId, portfolioId),
  ...(t.unit_id ? [guard(c, 'EXISTS(SELECT 1 FROM tt_units u JOIN tt_properties p ON p.id=u.property_id WHERE u.id=? AND p.portfolio_id=?)', t.unit_id, portfolioId)] : []),
  sql(c, 'INSERT INTO tt_delinquency_assignments(tenancy_id,assigned_to,reference,version,assigned_by,assigned_at) VALUES(?,?,?,?,?,?) ON CONFLICT(tenancy_id) DO UPDATE SET assigned_to=excluded.assigned_to,reference=excluded.reference,version=excluded.version,assigned_by=excluded.assigned_by,assigned_at=excluded.assigned_at', t.id, assignedTo, reference, version + 1, c.actor.id, c.now),
  sql(c, 'INSERT INTO tt_delinquency_assignment_events(id,tenancy_id,assigned_to,reference,version,assigned_by,assigned_at) VALUES(?,?,?,?,?,?,?)', id(), t.id, assignedTo, reference, version + 1, c.actor.id, c.now),
 ]
 await commit(c, writes, name, t.id)
 return { tenancyId: t.id, assignedTo, version: version + 1, tab: 'delinquency', notice: 'Collection follow-up assigned. No message was sent and no financial authority changed.' }
}

/** Effective-date aging, reconstructed from records known now. Operational eligibility is checked live. */
export async function delinquencyReport(c: Context, q: Row) {
 allow(c, 'reports.read')
 const asOf = date(q.asOf, 'As of date'), propertyId = q.propertyId ? text(q.propertyId, 'Property', 100) : null
 const tenancyId = q.tenancyId ? text(q.tenancyId, 'Tenancy', 100) : null, ownerId = q.ownerId ? text(q.ownerId, 'Owner', 100) : null
 const [propertiesAll, leases, charges, receipts, adjustments, members, proposals, assignments, assignmentEvents, ownership] = await Promise.all([
  all(c, 'SELECT id,name,portfolio_id,time_zone FROM tt_properties ORDER BY name'),
  all(c, `SELECT t.*,u.identifier AS unit,p.id AS property_id,p.name AS property_name,p.portfolio_id,p.time_zone AS property_zone
   FROM tt_tenancies t LEFT JOIN tt_units u ON u.id=t.unit_id LEFT JOIN tt_properties p ON p.id=u.property_id
   WHERE t.erased_at IS NULL ORDER BY p.name,u.identifier,t.address,t.id`),
  all(c, 'SELECT * FROM tt_charges ORDER BY due_date,id'), all(c, 'SELECT * FROM tt_net_receipts ORDER BY received_date,id'),
  all(c, 'SELECT * FROM tt_adjustments ORDER BY at,id'),
  all(c, 'SELECT id,tenancy_id,role,name,contact_by,joined,left_on FROM tt_household_members ORDER BY joined,id'),
  all(c, "SELECT id,tenancy_id,payload,approved_at,approved_by FROM tt_proposals WHERE kind='arrears' AND state='approved' ORDER BY approved_at,id"),
  all(c, 'SELECT * FROM tt_delinquency_assignments'), all(c, 'SELECT * FROM tt_delinquency_assignment_events ORDER BY assigned_at,version'),
  ownershipData(c),
 ])
 const properties = propertiesAll.filter(p => reachesPortfolio(c, p.portfolio_id))
 insist(!propertyId || properties.some(p => p.id === propertyId), 'not_found', 'Property not found.', 404)
 const scoped = leases.filter(t => reaches(c, t.unit_id) && (!t.property_id || reachesPortfolio(c, t.portfolio_id)))
 insist(!tenancyId || scoped.some(t => t.id === tenancyId), 'not_found', 'Tenancy not found.', 404)
 const ownersMap = new Map<string, {id: string; name: string}>()
 // Owner existence/scope is established through dated ownership on visible properties, never the private directory.
 for (const p of properties) {
  for (const set of ownership.byProperty[p.id]?.sets ?? []) for (const share of set.shares) ownersMap.set(share.owner_id, { id: share.owner_id, name: share.legal_name })
 }
 insist(!ownerId || ownersMap.has(ownerId), 'not_found', 'Owner not found.', 404)
 const selected = scoped.filter(t => (!propertyId || t.property_id === propertyId) && (!tenancyId || t.id === tenancyId) &&
  (!ownerId || (sharesOn(ownership.byProperty[t.property_id], asOf)?.shares ?? []).some((s: Row) => s.owner_id === ownerId)))
 const selectedProperties = properties.filter(p => (!propertyId || p.id === propertyId) && (!tenancyId || selected.some(t => t.property_id === p.id)) && (!ownerId || (sharesOn(ownership.byProperty[p.id], asOf)?.shares ?? []).some((s: Row) => s.owner_id === ownerId)))
 for (const p of selectedProperties) insist(asOf <= localDate(c.now, p.time_zone), 'invalid_as_of', 'As of cannot be after property-local today.')
 for (const t of selected) insist(asOf <= localDate(c.now, t.property_zone ?? t.time_zone), 'invalid_as_of', 'As of cannot be after tenancy-local today.')
 if (!selectedProperties.length && !selected.length) insist(asOf <= localDate(c.now, c.zone ?? 'America/New_York'), 'invalid_as_of', 'As of cannot be after today.')
 const gaps: Row[] = [
  { code: 'pending_payments_not_recorded', message: 'Processor pending payments are not recorded (PAY-008). PAY-005 external pending records are shown separately and never prove settlement.' },
  { code: 'returned_ach_not_recorded', message: 'Returned ACH and attempted collection outcomes are not recorded (PAY-008).' },
  { code: 'subsidy_history_partial', message: 'Separate HAP postings are shown where recorded. Historical shared charges have no inferred split; dated remittances, approved PHA corrections and inspection abatements remain separately sourced. Historical shared charges have no reconstructed payer split.' },
 ]
 const rows = await Promise.all(selected.map(async t => {
  const effects=await hapEffects(c,t.id),aging = ageReceivables({ ...t, time_zone: t.property_zone ?? t.time_zone }, effectiveCharges(charges,effects,asOf,'resident'), receipts, adjustments, asOf)
  const phaCharges=await hapData(c,t.id),phaAging=ageReceivables({...t,time_zone:t.property_zone??t.time_zone},effectiveCharges(phaCharges,effects,asOf,'pha'),await phaReceipts(c,t.id),[],asOf)
  const set = sharesOn(ownership.byProperty[t.property_id], asOf)
  const ownershipRows = (set?.shares ?? []).map((s: Row) => ({ ownerId: s.owner_id, name: s.legal_name, basisPoints: s.share_bp, setId: set!.id, effectiveFrom: set!.effective_from, reference: set!.reason }))
  if (!set) gaps.push({ code: 'ownership_not_recorded', tenancyId: t.id, propertyId: t.property_id ?? null, message: 'No ownership set is recorded at this date.' })
  const primary = { memberId: null, role: 'resident', name: t.tenant_name, joined: t.start_date, leftOn: t.ended_on ?? null, ...rights('resident', 'email', t.start_date <= asOf && (!t.ended_on || t.ended_on >= asOf)) }
  const household = [...(t.start_date <= asOf && (!t.ended_on || t.ended_on >= asOf) ? [primary] : []), ...members.filter(m => m.tenancy_id === t.id && m.joined <= asOf && (!m.left_on || m.left_on >= asOf)).map(m => ({ memberId: m.id, role: m.role, name: m.name, joined: m.joined, leftOn: m.left_on, ...rights(m.role, m.contact_by, true) }))]
  const approved = proposals.filter(p => p.tenancy_id === t.id && localDate(p.approved_at, aging.timeZone) <= asOf).at(-1)
  const approvedPayload = approved ? JSON.parse(approved.payload) : null
  const approvedDraft = approved ? { proposalId: approved.id, approvedAt: approved.approved_at, approvedBy: approved.approved_by, followUpDate: approvedPayload.followUpDate, message: approvedPayload.message, state: 'approved_unsent' } : null
  const current = assignments.find(a => a.tenancy_id === t.id), historical = assignmentEvents.filter(a => a.tenancy_id === t.id && localDate(a.assigned_at, aging.timeZone) <= asOf).at(-1)
  const assignees = await all(c, `SELECT o.id,o.display_name AS name FROM oa_operators o WHERE ${eligible} ORDER BY o.display_name,o.id`, t.portfolio_id ?? null, t.portfolio_id ?? null)
  const person = historical ? assignees.find(a => a.id === historical.assigned_to) : null
  const assignment = historical ? { assignedTo: person?.id ?? null, name: person?.name ?? null, previousAssignedTo: person ? null : historical.assigned_to, status: person ? 'assigned' : 'unassigned', reason: person ? null : 'assignee_not_eligible', version: historical.version, assignedAt: historical.assigned_at, reference: historical.reference } : null
  if (!person) gaps.push({ code: historical ? 'assignee_not_eligible' : 'followup_unassigned', tenancyId: t.id, message: 'Assign an active follow-up owner with current portfolio authority.' })
  const collection=await collectionCase(c,t.id,asOf)
  const notices=[]
  for(const a of collection.actions.filter(a=>a.kind.includes('notice'))){const service=await one(c,'SELECT action_id,served_at,method,server,reference,sha256,expires_on,at FROM tt_arrears_service WHERE action_id=?',a.id);const dated=collection.events.filter(e=>e.detail.actionId===a.id);notices.push({id:a.id,kind:a.kind,state:dated.at(-1)?.kind??'draft',rules:a.snapshot.rules,service:service&&localDate(service.at,t.time_zone)<=asOf?service:null})}
  const nextAction = collection.config ? collection.nextAction : !person ? 'assign follow-up owner' : approvedDraft ? 'review and send externally; Terrace has not sent it' : 'prepare and review an arrears proposal'
  const external=await externalFundsAsOf(c,t.id,asOf)
  return { tenancyId: t.id, unitId: t.unit_id, propertyId: t.property_id ?? null, property: t.property_name ?? t.address, unit: t.unit ?? '', resident: t.tenant_name,
   ...aging, phaAging,payerCorrections:effects.filter(e=>e.posting_day<=asOf), household, ownership: ownershipRows, approvedDraft, assignment, assignmentVersion: current?.version ?? 0,
   assignees: operational(c) && can(c, 'arrears.prepare') ? assignees : [], nextAction,
   pendingFunds: 'Processor pending payments not recorded; manual external funds shown separately',pendingExternalCents:external.pendingCents,pendingExternalPayments:external.pending, returnedAch: 'not recorded', paymentPlan: collection.plan?.state??'not recorded',paymentPlanSource:collection.plan,collectionEvents:collection.events,notices, subsidyShare: phaCharges.length?'Separate PHA receivables recorded':'Separate HAP posting not recorded', collectionOutcome: collection.config?collection.collectionOutcome:'not recorded' }
 }))
 const totals = [...new Set(rows.map(r => r.currency))].map(currency => {
  const mine = rows.filter(r => r.currency === currency)
  const sum = (key: 'balanceCents' | 'overdueCents' | 'billedCents' | 'receivedCents' | 'reductionsCents' | 'creditCents') => {
   const total = mine.reduce((n, r) => n + r[key], 0)
   insist(Number.isSafeInteger(total), 'invalid_receivable', 'Receivable total exceeds exact integer cents.')
   return total
  }
  const buckets = { current: 0, days1to30: 0, days31to60: 0, days61to90: 0, over90: 0 }
  for (const r of mine) for (const key of Object.keys(buckets) as (keyof typeof buckets)[]) {
   buckets[key] += r.buckets[key]
   insist(Number.isSafeInteger(buckets[key]), 'invalid_receivable', 'Receivable total exceeds exact integer cents.')
  }
  return { currency,creditCents:sum('creditCents'),phaBalanceCents:mine.reduce((n,r)=>n+r.phaAging.balanceCents,0),phaOverdueCents:mine.reduce((n,r)=>n+r.phaAging.overdueCents,0),phaCreditCents:mine.reduce((n,r)=>n+r.phaAging.creditCents,0), households: mine.length, overdueHouseholds: mine.filter(r => r.overdueCents > 0).length, buckets, balanceCents: sum('balanceCents'), overdueCents: sum('overdueCents'), billedCents: sum('billedCents'), receivedCents: sum('receivedCents'), reductionsCents: sum('reductionsCents') }
 })
 return { asOf, snapshotAt: c.now, filters: { propertyId, tenancyId, ownerId }, rows, totals, properties,
  owners: [...ownersMap.values()].sort((a, b) => a.name.localeCompare(b.name)), gaps,
  formulas: {
   aging: 'Due charges through As of, less external receipts received through that local day and reductions dated by their explicit approved posting day, or property-local recorded day when absent. Current = due today; past due = 1–30, 31–60, 61–90 and over 90 elapsed calendar days. Future charges and their allocations are excluded.',
   ownership: 'The owner filter matches the ownership set effective on As of. Each household balance is counted once in full; amounts are not allocated by ownership percentage. Missing ownership is unknown, never inferred from tenancy contact names.',
   household: 'One receivable balance per tenancy, shared by its household. Membership uses inclusive joining/leaving dates. Roles identify liability; no balance is multiplied by member count.',
   followup: 'Approved arrears drafts and assignment events are dated through As of. Assignee eligibility is checked against live active role and portfolio scope; assignment changes no financial or sending authority.',
  }, boundary: 'Effective-date reconstruction from records known now, not a snapshot of what was known then. Currencies remain separate, including currency unconfirmed. Recorded external receipts are not proof of bank settlement. Manually recorded external pending funds are shown separately without reducing receivables. Processor pending payments, returns and historical subsidy splits are not inferred; collection plans, notices and outcomes use their dated sources; none is inferred zero, resolved or collected. This report exposes no screening records.' }
}

export function delinquencyTable(r: Awaited<ReturnType<typeof delinquencyReport>>): (string | number)[][] {
 const amount = (n: number) => (n / 100).toFixed(2)
 return [['Delinquency as of', r.asOf], ['Owner filter', r.filters.ownerId ?? 'All owners', 'Full household balances; not share allocated'],
  ['Tenancy', 'Property', 'Unit', 'Resident', 'Currency', 'Current', '1–30', '31–60', '61–90', 'Over 90', 'Balance', 'Overdue', 'Follow-up owner', 'Next action', 'Assignment reference', 'Approved unsent draft'],
  ...r.rows.map(x => [x.tenancyId, x.property, x.unit, x.resident, x.currency, amount(x.buckets.current), amount(x.buckets.days1to30), amount(x.buckets.days31to60), amount(x.buckets.days61to90), amount(x.buckets.over90), amount(x.balanceCents), amount(x.overdueCents), x.assignment?.name ?? 'Unassigned', x.nextAction, x.assignment?.reference ?? '', x.approvedDraft?.proposalId ?? 'Not recorded']),
  ...r.totals.map(t => ['Total', t.currency, 'Households', t.households, 'Current', amount(t.buckets.current), '1–30', amount(t.buckets.days1to30), '31–60', amount(t.buckets.days31to60), '61–90', amount(t.buckets.days61to90), 'Over 90', amount(t.buckets.over90), 'Balance', amount(t.balanceCents), 'Overdue', amount(t.overdueCents)]),
  ['Separate housing authority receivables'],['Tenancy','Currency','PHA balance','PHA overdue'],...r.rows.map(x=>[x.tenancyId,x.currency,amount(x.phaAging.balanceCents),amount(x.phaAging.overdueCents)]),
  ['Reviewed payer correction sources'],['Tenancy','Correction','Economic from','Economic to','Approval posting day','Resident delta','PHA delta','Notice'],...r.rows.flatMap(x=>x.payerCorrections.map(e=>[x.tenancyId,e.id,e.effective_from,e.effective_to,e.posting_day,amount(e.resident_delta),amount(e.pha_delta),e.notice_version_id])),
  ['Dated PHA charge sources'],['Tenancy','Charge','Due','Outstanding','Credit','Receipt sources'],...r.rows.flatMap(x=>x.phaAging.charges.map(q=>[x.tenancyId,q.chargeId,q.dueDate,amount(q.outstandingCents),amount(q.creditCents),q.receipts.map(p=>p.reference).join('; ')])),
  ['Dated charge sources'], ['Tenancy', 'Charge', 'Due', 'Age', 'Currency', 'Billed', 'External receipts', 'Reductions', 'Outstanding', 'Receipt references', 'Reduction sources'],
  ...r.rows.flatMap(x => x.charges.map(q => [x.tenancyId, q.chargeId, q.dueDate, q.ageDays, q.currency, amount(q.billedCents), amount(q.receiptsCents), amount(q.reductionsCents), amount(q.outstandingCents), q.receipts.map(p => `${p.id} ${p.date} ${p.reference}`).join('; '), q.reductions.map(a => `${a.id} ${a.date} ${a.reason}`).join('; ')])),
  ['Manually recorded pending payment sources (not deducted)'],['Tenancy','Payment','Initiated','Method','Pending amount'],...r.rows.flatMap(x=>x.pendingExternalPayments.map(p=>[x.tenancyId,p.id,p.initiatedOn,p.method,amount(p.amountCents)])),
  ['Dated ownership sources', 'Full household amounts; not share allocated'],
  ...r.rows.flatMap(x => x.ownership.map((o: Row) => [x.tenancyId, o.ownerId, o.name, o.basisPoints, o.setId, o.effectiveFrom, o.reference])),
  ['Household membership sources'],
  ...r.rows.flatMap(x => x.household.map(m => [x.tenancyId, m.memberId ?? 'primary resident', m.name, m.role, m.joined, m.leftOn ?? '', m.liable ? 'liable' : 'not liable'])),
  ['Collection plan, notice and outcome sources'],
  ...r.rows.flatMap(x=>[...x.collectionEvents.map((v:Row)=>[x.tenancyId,v.kind,v.on_day,v.reference,JSON.stringify(v.detail)]),...x.notices.map((n:Row)=>[x.tenancyId,n.kind,n.state,n.service?.served_at??'',n.service?.expires_on??''])]),
  ['Follow-up sources'],
  ...r.rows.map(x => [x.tenancyId, x.assignment?.assignedTo ?? 'unassigned', x.assignment?.assignedAt ?? '', x.assignment?.reference ?? '', x.approvedDraft?.proposalId ?? '', x.approvedDraft?.approvedAt ?? '', x.approvedDraft?.followUpDate ?? '', x.nextAction]),
  ...r.gaps.map(g => ['Not recorded / gap', g.code, g.tenancyId ?? '', g.message]), [r.boundary] ]
}
