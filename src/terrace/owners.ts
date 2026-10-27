import {statementCash,statementCashTable} from './statement-draft'
// PORT-003. Owners and management agreements. An owner is an individual or entity apart from a tenancy's recorded
// owner contact. Each property has dated share sets: the set in force on a day is the one with the latest
// effective date on or before it, and its shares total exactly 100%. A transfer is a new set from its date, so the
// seller's share ends the day before. Recorded receipts on the property's tenancies are allocated by the set in
// force on their received date (property-local), with the management fee and reserve requirement of the agreement
// in force that day. Owner records are installation-wide: the owner and all-portfolio staff keep them (ROLE-001).
import { all, allow, can, commit, date, email, everywhere, guard, id, insist, one, reachesPortfolio, shown, sql, text, cents, type Context, type Row } from './core'
import { ownerFees } from './fees'
import { endSessions } from './portal-session'
import { ownerExpenses } from './bills'

const W9 = ['requested', 'received']
/** "60" or "33.33" percent -> basis points; never rounded. */
export function basisPoints(v: unknown, label: string) {
 const s = text(String(v ?? ''), label, 6)
 insist(/^\d{1,3}(\.\d{1,2})?$/.test(s), 'invalid_share', `${label} is a percent with at most two decimal places.`)
 const [a, b = ''] = s.split('.'), n = Number(a) * 100 + Number(b.padEnd(2, '0'))
 insist(n >= 0 && n <= 10000, 'invalid_share', `${label} is between 0 and 100 percent.`)
 return n
}
/** Splits exact cents by basis points: each share gets the floor, and the remainder cents go to the largest share (ties: the earlier position). */
export function split(amount: number, shares: Row[]) {
 const sign=Math.sign(amount),positive=Math.abs(amount)
 const out = shares.map(s => ({ ownerId: s.owner_id, bp: s.share_bp, cents: Math.floor(positive * s.share_bp / 10000) }))
 const rest = positive - out.reduce((t, s) => t + s.cents, 0)
 if (rest > 0 && out.length) out.reduce((best, s) => s.bp > best.bp ? s : best, out[0]).cents += rest
 return out.map(s=>({...s,cents:s.cents*sign}))
}
/** A fee in cents at basis points, rounded half up to the cent. */
export const fee = (cents: number, bp: number) => Math.sign(cents)*Math.floor((Math.abs(cents) * bp + 5000) / 10000)
const inForce = <T extends Row>(rows: T[], day: string, key: string) => rows.filter(r => r[key] <= day).at(-1)
const dayBefore = (d: string) => new Date(Date.parse(d + 'T00:00:00Z') - 86400000).toISOString().slice(0, 10)

async function owner(c: Context, v: unknown) {
 const row = await one(c, 'SELECT * FROM tt_owners WHERE id=?', text(v, 'Owner', 100))
 insist(row, 'not_found', 'Owner not found.', 404)
 return row
}
async function property(c: Context, v: unknown) {
 const row = await one(c, 'SELECT * FROM tt_properties WHERE id=?', text(v, 'Property', 100))
 insist(row && reachesPortfolio(c, row.portfolio_id), 'not_found', 'Property not found.', 404)
 return row
}

export async function ownerCommand(c: Context, command: string, p: Row): Promise<Row | undefined> {
 if (command === 'owner.add') {
  allow(c, command); everywhere(c)
  insist(['individual', 'entity'].includes(p.kind), 'invalid_kind', 'An owner is an individual or an entity.')
  const key = id()
  await commit(c, [sql(c, 'INSERT INTO tt_owners(id,kind,legal_name,email,mailing_address,created_by,created_at) VALUES(?,?,?,?,?,?,?)', key, p.kind, text(p.legalName, 'Legal name', 200), email(p.email), text(p.mailingAddress, 'Mailing address', 300), c.actor.id, c.now)], command, key)
  return { id: key, notice: 'Owner added. W-9 not requested yet.' }
 }
 if (command === 'owner.w9') {
  allow(c, command); everywhere(c)
  const o = await owner(c, p.ownerId), status = String(p.status ?? ''), on = date(p.date, 'W-9 date')
  insist(W9.includes(status), 'invalid_status', 'Record the W-9 as requested or received.')
  const location = status === 'received' ? text(p.location, 'Where the W-9 is kept', 300) : null
  await commit(c, [
   guard(c, 'EXISTS(SELECT 1 FROM tt_owners WHERE id=? AND version=?)', o.id, o.version),
   sql(c, 'INSERT INTO tt_w9_events(id,owner_id,status,on_date,location,recorded_by,recorded_at) VALUES(?,?,?,?,?,?,?)', id(), o.id, status, on, location, c.actor.id, c.now),
   sql(c, 'UPDATE tt_owners SET w9_status=?,w9_date=?,w9_location=?,version=version+1 WHERE id=?', status, on, location, o.id),
  ], command, o.id)
  return { id: o.id, notice: `W-9 recorded as ${status} by staff. Terrace stores no TIN and has not validated one.` }
 }
 if (command === 'ownership.set') {
  allow(c, command); everywhere(c)
  const prop = await property(c, p.propertyId), from = date(p.effectiveFrom, 'Effective from'), reason = text(p.reason, 'Reason or transfer reference', 500)
  const given: Row[] = Array.isArray(p.shares) ? p.shares : Object.keys(p).filter(k => k.startsWith('share:') && String(p[k]).trim() !== '').map(k => ({ ownerId: k.slice(6), percent: p[k] }))
  const shares = given.map(s => ({ ownerId: text(s.ownerId, 'Owner', 100), bp: basisPoints(s.percent, 'Share') })).filter(s => s.bp > 0)
  insist(shares.length > 0 && new Set(shares.map(s => s.ownerId)).size === shares.length, 'invalid_share', 'Give each owner one share.')
  insist(shares.reduce((t, s) => t + s.bp, 0) === 10000, 'shares_total', 'Shares must total exactly 100%.')
  const known = await all(c, `SELECT id FROM tt_owners WHERE id IN (${shares.map(() => '?').join(',')})`, ...shares.map(s => s.ownerId))
  insist(known.length === shares.length, 'not_found', 'Owner not found.', 404)
  const key = id(), before = await all(c, 'SELECT owner_id FROM tt_ownership_shares WHERE set_id=(SELECT id FROM tt_ownership_sets WHERE property_id=? ORDER BY effective_from DESC LIMIT 1)', prop.id)
  // History is never rewritten: a new set starts after the latest one. The owners on either side sign in again (ROLE-002).
  await commit(c, [
   guard(c, 'NOT EXISTS(SELECT 1 FROM tt_ownership_sets WHERE property_id=? AND effective_from>=?)', prop.id, from),
   sql(c, 'INSERT INTO tt_ownership_sets(id,property_id,effective_from,reason,created_by,created_at) VALUES(?,?,?,?,?,?)', key, prop.id, from, reason, c.actor.id, c.now),
   ...shares.map((s, i) => sql(c, 'INSERT INTO tt_ownership_shares(set_id,owner_id,share_bp,position) VALUES(?,?,?,?)', key, s.ownerId, s.bp, i)),
   endSessions(c, 'owner_id', [...before.map(b => b.owner_id), ...shares.map(s => s.ownerId)]),
  ], command, key).catch(e => { if (e.code === 'conflict') e.message = 'Ownership already changes on or after that date. A transfer starts after the latest one.'; throw e })
  return { id: key, notice: `Ownership from ${from} recorded.` }
 }
 if (command === 'agreement.set') {
  allow(c, command); everywhere(c)
  const prop = await property(c, p.propertyId), starts = date(p.starts, 'Agreement starts'), key = id()
  const money = (v: unknown) => ['', '0', '0.00'].includes(String(v ?? '').trim()) ? 0 : cents(v), reserve = money(p.reserve)
  // ACCT-009: optional fee terms; a blank term is none.
  const rate = (v: unknown, label: string) => String(v ?? '').trim() === '' ? 0 : basisPoints(v, label)
  await commit(c, [
   guard(c, 'NOT EXISTS(SELECT 1 FROM tt_management_agreements WHERE property_id=? AND starts>=?)', prop.id, starts),
   sql(c, 'INSERT INTO tt_management_agreements(id,property_id,starts,fee_bp,reserve_cents,reference,created_by,created_at,leasing_fee_cents,renewal_fee_cents,minimum_fee_cents,fee_tax_bp,markup_bp) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)', key, prop.id, starts, basisPoints(p.feePercent, 'Management fee'), reserve, text(p.reference, 'Agreement reference', 300), c.actor.id, c.now, money(p.leasingFee), money(p.renewalFee), money(p.minimumFee), rate(p.feeTaxPercent, 'Tax on fees'), rate(p.markupPercent, 'Vendor bill markup')),
  ], command, key).catch(e => { if (e.code === 'conflict') e.message = 'An agreement already starts on or after that date.'; throw e })
  return { id: key, notice: `Management agreement from ${starts} recorded.` }
 }
}

/** Share sets (with owner names) and agreements per reachable property; the owner directory only for the owner and all-portfolio staff. */
export async function ownershipData(c: Context) {
 const [props, sets, shares, agreements] = await Promise.all([
  all(c, 'SELECT id,portfolio_id FROM tt_properties'),
  all(c, 'SELECT * FROM tt_ownership_sets ORDER BY effective_from'),
  all(c, 'SELECT h.*,o.legal_name,o.kind FROM tt_ownership_shares h JOIN tt_owners o ON o.id=h.owner_id ORDER BY h.position'),
  all(c, 'SELECT * FROM tt_management_agreements ORDER BY starts'),
 ])
 const byProperty: Record<string, Row> = {}
 for (const p of props.filter(p => reachesPortfolio(c, p.portfolio_id))) byProperty[p.id] = {
  sets: sets.filter(s => s.property_id === p.id).map(s => ({ ...s, shares: shares.filter(h => h.set_id === s.id) })),
  agreements: agreements.filter(a => a.property_id === p.id),
 }
 // Leasing, maintenance and members see owner names and shares on their properties, never the directory's contact or W-9 details.
 const directory = c.actor.role === 'owner' || (c.actor.staff?.all && (can(c, 'owner.add') || can(c, 'reports.read'))) ? await all(c, 'SELECT id,kind,legal_name,email,mailing_address,w9_status,w9_date,w9_location FROM tt_owners ORDER BY legal_name') : null
 return { byProperty, directory }
}
export const sharesOn = (data: Row | undefined, day: string) => inForce(data?.sets ?? [], day, 'effective_from')
export const agreementOn = (data: Row | undefined, day: string) => inForce(data?.agreements ?? [], day, 'starts')

/** One owner's allocated receipts from..to (inclusive, property-local received dates) on properties the viewer reaches. */
export async function ownerStatement(c: Context, ownerId: unknown, fromValue: unknown, toValue: unknown, propertyId?: string) {
 allow(c, 'reports.read')
 const o = await owner(c, ownerId), from = date(fromValue, 'Period start'), to = date(toValue, 'Period end')
 insist(to >= from, 'period', 'Period end must follow its start.')
 const props = (await all(c, 'SELECT DISTINCT p.* FROM tt_properties p JOIN tt_ownership_sets s ON s.property_id=p.id JOIN tt_ownership_shares h ON h.set_id=s.id WHERE h.owner_id=? ORDER BY p.name', o.id)).filter(p => reachesPortfolio(c, p.portfolio_id) && (!propertyId || p.id === propertyId))
 insist(props.length || c.actor.role === 'owner' || c.actor.staff?.all, 'not_found', 'Owner not found.', 404)
 const data = await ownershipData(c), rows: Row[] = [], reserves: Row[] = []
 for (const p of props) {
  const d = data.byProperty[p.id]
  const receipts = await all(c, 'SELECT r.amount_cents,r.received_date,r.reference,original.received_date AS allocation_date,t.address,t.currency,t.currency_confirmed FROM tt_net_receipts r LEFT JOIN tt_receipts original ON original.id=r.reversal_of JOIN tt_charges q ON q.id=r.charge_id JOIN tt_tenancies t ON t.id=q.tenancy_id JOIN tt_units u ON u.id=t.unit_id WHERE u.property_id=? AND r.received_date BETWEEN ? AND ? AND q.tax_rule_id IS NULL ORDER BY r.received_date,r.created_at', p.id, from, to)
  for (const r of receipts) {
   const allocationDay=r.allocation_date??r.received_date
   const set = sharesOn(d, allocationDay), mine = set ? split(r.amount_cents, set.shares).find(s => s.ownerId === o.id) : undefined
   if (!mine) continue
   const a = agreementOn(d, allocationDay), feeCents = a ? fee(mine.cents, a.fee_bp) : 0
   rows.push({ date: r.received_date, property: p.name, address: r.address, reference: r.reference, currency: shown(r), receiptCents: r.amount_cents, shareBp: mine.bp, allocatedCents: mine.cents, feeBp: a?.fee_bp ?? 0, feeCents, netCents: mine.cents - feeCents, agreementReference: a?.reference ?? null })
  }
  // The reserve requirement is split like income: per stretch of the period with one share set and one agreement in force.
  const cuts = [...new Set([from, ...(d?.sets ?? []).map((s: Row) => s.effective_from), ...(d?.agreements ?? []).map((a: Row) => a.starts)].filter(x => x >= from && x <= to))].sort()
  cuts.forEach((start, i) => {
   const end = i + 1 < cuts.length ? dayBefore(cuts[i + 1]) : to, set = sharesOn(d, start), a = agreementOn(d, start), mine = set && a ? split(a.reserve_cents, set.shares).find(s => s.ownerId === o.id) : undefined
   if (mine) reserves.push({ propertyId:p.id, property: p.name, from: start, to: end, reserveCents: a!.reserve_cents, shareBp: mine.bp, ownerReserveCents: mine.cents, currency: 'USD' })
  })
 }
 const totals = [...new Set(rows.map(r => r.currency))].map(currency => { const mine = rows.filter(r => r.currency === currency); return { currency, allocatedCents: mine.reduce((t, r) => t + r.allocatedCents, 0), feeCents: mine.reduce((t, r) => t + r.feeCents, 0), netCents: mine.reduce((t, r) => t + r.netCents, 0) } })
 // ACCT-009: the fee lines fee runs recorded, and the owner's USD cash left after them and the reserve share in force at the period end.
 const fees = (await ownerFees(c, o.id, props.map(p => p.id), from, to)).map(f => ({ date: f.day, property: f.property, kind: f.kind, source: f.source_label, baseCents: f.base_cents, rateBp: f.rate_bp, amountCents: f.amount_cents, taxBp: f.tax_bp, taxCents: f.tax_cents, agreementReference: f.agreement_reference, override: f.override_reason }))
 const usd = rows.filter(r => r.currency === 'USD').reduce((t, r) => t + r.allocatedCents, 0), charged = fees.reduce((t, f) => t + f.amountCents, 0), tax = fees.reduce((t, f) => t + f.taxCents, 0)
 const expenses = await ownerExpenses(c, o.id, props.map(p => p.id), from, to), expenseCents = expenses.reduce((t, x) => t + x.amount_cents, 0)
 const floor = props.reduce((t, p) => t + (reserves.filter(r => r.propertyId === p.id && r.to === to).at(-1)?.ownerReserveCents ?? 0), 0)
 const cash = { currency: 'USD', collectedCents: usd, feesCents: charged, taxCents: tax, reserveFloorCents: floor, expensesCents: expenseCents, availableCents: usd - charged - tax - floor - expenseCents }
 const cashDraft=can(c,'reconcile.read')&&!c.actor.credential?await statementCash(c,o.id,from,to,reserves):null
 const costAllocations=await all(c,`SELECT c.id,c.source_id,c.day,c.amount_cents,json_extract(c.terms,'$.kind') AS recipient_kind,j.owner_key,j.property_id FROM tt_work_chargebacks c JOIN tt_work_chargeback_approvals a ON a.chargeback_id=c.id JOIN tt_journal j ON j.id=c.source_id WHERE j.owner_key=? AND c.day BETWEEN ? AND ?`,o.id,from,to)
 return { costAllocations:costAllocations.filter(r=>props.some(p=>p.id===r.property_id)), cashDraft, owner: { id: o.id, name: o.legal_name, kind: o.kind, w9: o.w9_status }, from, to, rows, totals, reserves, fees, expenses, cash, boundary: 'Recorded receipts allocated by ownership share on each received date, less the agreement fee. Reserve lines are each owner’s share of the requirement, not cash held. Not a trust disbursement, bank reconciliation or tax statement; approved vendor bill expenses are included by ownership on the invoice date. Bills are unpaid obligations; no money has moved. Tax on fees is at the agreement’s recorded rate; Terrace files and remits no tax.' }
}
const amount = (n: number) => (n / 100).toFixed(2)
const pct = (bp: number) => (bp / 100).toFixed(2) + '%'
type OwnerStatementTable = Pick<Awaited<ReturnType<typeof ownerStatement>>, 'from'|'to'|'rows'|'totals'|'reserves'|'fees'|'expenses'|'cash'|'boundary'> & {owner:{name:string};cashDraft?:Awaited<ReturnType<typeof statementCash>>|null}
export const ownerStatementTable = (s: OwnerStatementTable): (string | number)[][] => [
 ['Terrace owner allocation statement', s.owner.name], ['Period', s.from, s.to],
 ['Received', 'Property', 'Tenancy', 'Reference', 'Currency', 'Receipt', 'Share', 'Allocated', 'Fee rate', 'Fee', 'Net'],
 ...s.rows.map(r => [r.date, r.property, r.address, r.reference, r.currency, amount(r.receiptCents), pct(r.shareBp), amount(r.allocatedCents), pct(r.feeBp), amount(r.feeCents), amount(r.netCents)]),
 ...s.totals.map(t => ['Total', '', '', '', t.currency, '', '', amount(t.allocatedCents), '', amount(t.feeCents), amount(t.netCents)]),
 ...s.reserves.map(r => ['Reserve requirement share', r.property, `${r.from} to ${r.to}`, '', r.currency, amount(r.reserveCents), pct(r.shareBp), amount(r.ownerReserveCents), '', '', '']),
 ['Fee charged', 'Property', 'Kind', 'Source', 'Agreement', 'Base', 'Rate', 'Fee', 'Tax rate', 'Tax', 'Override'],
 ...s.fees.map(f => [f.date, f.property, f.kind, f.source, f.agreementReference, amount(f.baseCents), f.rateBp === null ? '' : pct(f.rateBp), amount(f.amountCents), pct(f.taxBp), amount(f.taxCents), f.override ?? '']),
 ['Approved expense', 'Property', 'Supplier', 'Invoice', 'Currency', 'Property total', 'Share', 'Owner expense'],
 ...s.expenses.map(x => [x.day, x.property, x.supplier, x.invoice_number, 'USD', amount(x.property_cents), pct(x.share_bp), amount(x.amount_cents)]),
 ['Cash available before distributions', 'USD', `collected share ${amount(s.cash.collectedCents)}`, `fees ${amount(s.cash.feesCents)}`, `tax on fees ${amount(s.cash.taxCents)}`, `reserve floor ${amount(s.cash.reserveFloorCents)}`, `approved expenses ${amount(s.cash.expensesCents)}`, amount(s.cash.availableCents)],
 [s.boundary],
 ...(s.cashDraft?statementCashTable(s.cashDraft):[]),
]
