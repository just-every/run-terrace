// ACCT-009. The monthly fee run for one property: management fees on each owner's share of every USD receipt,
// leasing fees on new leases, renewal fees on approved renewals and, once the month has ended, a top-up to the
// agreement's monthly minimum, each with the agreement in force on its day and tax at that agreement's rate. Every
// line names its source. A rerun posts only differences from what is recorded, so nothing is charged twice; an
// owner's override is a new line with its reason, and later runs leave that source alone.
import { all, allow, cents, commit, guard, id, insist, one, reachesPortfolio, sql, text, type Context, type Row } from './core'
import { month as monthOf } from './periods'
import { agreementOn, fee, ownershipData, sharesOn, split } from './owners'
import { localDate } from './zones'

const lastDay = (m: string) => new Date(Date.UTC(Number(m.slice(0, 4)), Number(m.slice(5, 7)), 0)).toISOString().slice(0, 10)
const key = (l: Row) => `${l.kind}|${l.source}|${l.owner_id ?? l.ownerId}`
type Want = { ownerId: string; day: string; kind: string; source: string; sourceLabel: string; baseCents: number; rateBp: number | null; amountCents: number; taxBp: number; agreement: Row }

async function property(c: Context, v: unknown) {
 const row = await one(c, 'SELECT * FROM tt_properties WHERE id=?', text(v, 'Property', 100))
 insist(row && reachesPortfolio(c, row.portfolio_id), 'not_found', 'Property not found.', 404)
 return row
}

/** The fee lines the month's records call for, per owner and source. */
async function wanted(c: Context, p: Row, m: string, today: string) {
 const d = (await ownershipData(c)).byProperty[p.id], from = m + '-01', to = lastDay(m), out: Want[] = [], skipped: Row[] = []
 const add = (day: string, kind: string, source: string, sourceLabel: string, total: number, rateBp: number | null, per: (cents: number) => number) => {
  const set = sharesOn(d, day), a = agreementOn(d, day)
  if (!set || !a) return void skipped.push({ source, reason: !set ? 'No ownership recorded on ' + day : 'No management agreement in force on ' + day })
  for (const s of split(total, set.shares)) { const amount = per(s.cents); if (amount > 0) out.push({ ownerId: s.ownerId, day, kind, source, sourceLabel, baseCents: rateBp === null ? total : s.cents, rateBp, amountCents: rateBp === null ? s.cents : amount, taxBp: a.fee_tax_bp, agreement: a }) }
 }
 const [receipts, leases, renewals] = await Promise.all([
  all(c, 'SELECT r.id,r.amount_cents,r.received_date,r.reference,r.currency,t.currency_confirmed FROM tt_receipts r JOIN tt_charges q ON q.id=r.charge_id JOIN tt_tenancies t ON t.id=q.tenancy_id JOIN tt_units u ON u.id=t.unit_id WHERE u.property_id=? AND r.received_date BETWEEN ? AND ? AND q.tax_rule_id IS NULL ORDER BY r.received_date,r.id', p.id, from, to),
  all(c, 'SELECT t.id,t.address,t.start_date FROM tt_tenancies t JOIN tt_units u ON u.id=t.unit_id WHERE u.property_id=? AND t.start_date BETWEEN ? AND ? AND t.transferred_from IS NULL ORDER BY t.start_date,t.id', p.id, from, to),
  // LEASE-012: a campaign offer earns its renewal fee when its signed renewal activates, never at offer approval.
  all(c, "SELECT r.id,COALESCE(h.confirmed_at,r.approved_at) AS approved_at,json_extract(r.payload,'$.renewalId') AS campaign,t.address FROM tt_proposals r JOIN tt_tenancies t ON t.id=r.tenancy_id JOIN tt_units u ON u.id=t.unit_id LEFT JOIN tt_lease_history h ON h.proposal_id=r.id WHERE u.property_id=? AND r.kind='renewal' AND r.state='approved' AND (json_extract(r.payload,'$.renewalId') IS NULL OR h.id IS NOT NULL) ORDER BY 2,r.id", p.id),
 ])
 for (const r of receipts) {
  if (r.currency !== 'USD' || r.currency_confirmed === 0) { skipped.push({ source: 'receipt:' + r.id, reason: `Receipt ${r.reference} is not in confirmed USD` }); continue }
  const a = agreementOn(d, r.received_date)
  add(r.received_date, 'management', 'receipt:' + r.id, `Receipt ${r.reference}`, r.amount_cents, a?.fee_bp ?? 0, share => fee(share, a!.fee_bp))
 }
 for (const t of leases) { const a = agreementOn(d, t.start_date); if (a?.leasing_fee_cents) add(t.start_date, 'leasing', 'lease:' + t.id, `New lease ${t.address} from ${t.start_date}`, a.leasing_fee_cents, null, share => share) }
 for (const r of renewals) {
  const day = localDate(r.approved_at, p.time_zone), a = agreementOn(d, day)
  if (day.slice(0, 7) === m && a?.renewal_fee_cents) add(day, 'renewal', 'renewal:' + r.id, `Renewal of ${r.address} ${r.campaign ? 'activated' : 'approved'} ${day}`, a.renewal_fee_cents, null, share => share)
 }
 // The minimum applies to a whole month, so it is reckoned only once the month has ended at the property.
 const a = agreementOn(d, to), management = out.filter(l => l.kind === 'management').reduce((s, l) => s + l.amountCents, 0)
 if (a && m < today.slice(0, 7) && a.minimum_fee_cents > management) add(to, 'minimum', 'minimum:' + m, `Monthly minimum ${(a.minimum_fee_cents / 100).toFixed(2)} less management fees ${(management / 100).toFixed(2)}`, a.minimum_fee_cents - management, null, share => share)
 return { lines: out, skipped }
}

export async function feeCommand(c: Context, command: string, p: Row): Promise<Row | undefined> {
 if (command === 'fees.run') {
  allow(c, command)
  const prop = await property(c, p.propertyId), m = monthOf(p.month), today = localDate(c.now, prop.time_zone)
  insist(m <= today.slice(0, 7), 'future_month', 'A fee run is for this month or an earlier one.', 409)
  const { lines, skipped } = await wanted(c, prop, m, today), recorded = await all(c, 'SELECT * FROM tt_fees WHERE property_id=? AND month=?', prop.id, m)
  const held = new Set(recorded.filter(r => r.override_reason).map(key)), run = id(), writes: D1PreparedStatement[] = []
  const sum = (k: string, col: string) => recorded.filter(r => key(r) === k).reduce((s, r) => s + r[col], 0)
  const keys = new Set([...lines.map(key), ...recorded.filter(r => r.kind !== 'markup').map(key)])
  for (const k of keys) {
   if (held.has(k)) continue
   const want = lines.find(l => key(l) === k), last = recorded.filter(r => key(r) === k).at(-1)!
   const amount = (want?.amountCents ?? 0) - sum(k, 'amount_cents'), tax = (want ? fee(want.amountCents, want.taxBp) : 0) - sum(k, 'tax_cents')
   if (!amount && !tax) continue
   const l = want ?? { ownerId: last.owner_id, day: last.day, kind: last.kind, source: last.source, sourceLabel: last.source_label + ' (no longer due)', baseCents: 0, rateBp: last.rate_bp, taxBp: last.tax_bp, agreement: { id: last.agreement_id } }
   writes.push(sql(c, 'INSERT INTO tt_fees(id,property_id,owner_id,month,day,kind,source,source_label,base_cents,rate_bp,amount_cents,tax_bp,tax_cents,agreement_id,run_id,created_by,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)', id(), prop.id, l.ownerId, m, l.day, l.kind, l.source, l.sourceLabel, l.baseCents, l.rateBp, amount, l.taxBp, tax, l.agreement.id, run, c.actor.id, c.now))
  }
  // Two runs at once cannot both post: the batch holds only if no fee line was added since this run read them.
  await commit(c, [guard(c, '(SELECT COUNT(*) FROM tt_fees WHERE property_id=? AND month=?)=?', prop.id, m, recorded.length), ...writes], command, `${prop.id} ${m}`)
  return { posted: writes.length, lines: lines.map(({ agreement, ...l }) => ({ ...l, taxCents: fee(l.amountCents, l.taxBp), agreementReference: agreement.reference })), skipped, notice: writes.length ? `Fee run posted ${writes.length} line${writes.length === 1 ? '' : 's'}.` : 'Fee run: nothing new to charge.' }
 }
 if (command === 'fee.override') {
  allow(c, command)
  const line = await one(c, 'SELECT * FROM tt_fees WHERE id=?', text(p.feeId, 'Fee', 100))
  insist(line, 'not_found', 'Fee not found.', 404)
  await property(c, line.property_id)
  const reason = text(p.reason, 'Override reason', 500), to = ['0', '0.00'].includes(String(p.amount ?? '').trim()) ? 0 : cents(p.amount)
  const same = await all(c, 'SELECT amount_cents,tax_cents FROM tt_fees WHERE property_id=? AND month=? AND kind=? AND source=? AND owner_id=?', line.property_id, line.month, line.kind, line.source, line.owner_id)
  const amount = to - same.reduce((s, r) => s + r.amount_cents, 0), tax = fee(to, line.tax_bp) - same.reduce((s, r) => s + r.tax_cents, 0)
  await commit(c, [
   guard(c, '(SELECT COUNT(*) FROM tt_fees WHERE property_id=? AND month=? AND kind=? AND source=? AND owner_id=?)=?', line.property_id, line.month, line.kind, line.source, line.owner_id, same.length),
   sql(c, 'INSERT INTO tt_fees(id,property_id,owner_id,month,day,kind,source,source_label,base_cents,rate_bp,amount_cents,tax_bp,tax_cents,agreement_id,override_reason,run_id,created_by,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)', id(), line.property_id, line.owner_id, line.month, line.day, line.kind, line.source, line.source_label, line.base_cents, line.rate_bp, amount, line.tax_bp, tax, line.agreement_id, reason, id(), c.actor.id, c.now),
  ], command, line.id)
  return { id: line.id, notice: `Fee set to ${(to / 100).toFixed(2)} by override.` }
 }
}

/** One owner's recorded fee lines with day in from..to on the given properties, each with its agreement reference. */
export async function ownerFees(c: Context, ownerId: string, propertyIds: string[], from: string, to: string) {
 if (!propertyIds.length) return []
 return all(c, `SELECT f.*,p.name AS property,a.reference AS agreement_reference FROM tt_fees f JOIN tt_properties p ON p.id=f.property_id JOIN tt_management_agreements a ON a.id=f.agreement_id WHERE f.owner_id=? AND f.day BETWEEN ? AND ? AND f.property_id IN (${propertyIds.map(() => '?').join(',')}) ORDER BY f.day,f.kind,f.created_at`, ownerId, from, to, ...propertyIds)
}
