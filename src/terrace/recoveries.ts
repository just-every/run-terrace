// ACCT-016. Utility recovery: a recorded utility bill is split across the leases on its property by a formula
// (occupant-days, bedroom-days, unit-days or submeter readings), and the recoverable share is charged only to leases
// that authorize recovery of that utility, within any per-lease cap; vacancy, unauthorized leases and capped excess
// stay unrecovered (the owner's cost). A second person approves the exact allocation before anything posts. One-off
// parking, storage and other permitted charges post with the tax their reviewed rule calls for.
import { all, allow, cents, commit, date, guard, id, insist, one, reachesPortfolio, sha256, sql, tenancy, text, type Context, type Row } from './core'
import { independence } from './dual-control'
import { basisPoints } from './owners'
import { taxCharge, taxInsert, taxRules } from './tax'

export const UTILITIES = ['water', 'sewer', 'trash', 'gas', 'electric']
export const FORMULAS: [string, string][] = [['occupants', 'Occupant-days (tenant, co-tenants and occupants)'], ['bedrooms', 'Bedroom-days (a studio counts as one)'], ['equal', 'Unit-days'], ['submeter', 'Submeter reading × days']]
export const RECOVERY_COMMANDS = ['recovery.authorize', 'utility.prepare', 'utility.approve', 'ancillary.charge']
const DAY = 86400000, ms = (d: string) => Date.parse(d + 'T00:00:00Z')
const span = (a: string, b: string) => a > b ? 0 : Math.round((ms(b) - ms(a)) / DAY) + 1
const half = (cents: number, bp: number) => Math.floor((cents * bp + 5000) / 10000)

async function property(c: Context, v: unknown) {
 const row = await one(c, 'SELECT * FROM tt_properties WHERE id=?', text(v, 'Property', 100))
 insist(row && reachesPortfolio(c, row.portfolio_id), 'not_found', 'Property not found.', 404)
 return row
}

/** The bill's allocation: each lease's basis and share, which leases are charged, and what stays unrecovered. */
export async function allocation(c: Context, bill: Row) {
 const ps = bill.period_start, pe = bill.period_end, length = span(ps, pe), readings = bill.readings ? JSON.parse(bill.readings) : {}
 const [units, leases, members, allowed] = await Promise.all([
  all(c, 'SELECT * FROM tt_units WHERE property_id=? ORDER BY identifier', bill.property_id),
  all(c, 'SELECT t.* FROM tt_tenancies t JOIN tt_units u ON u.id=t.unit_id WHERE u.property_id=? AND t.start_date<=? AND COALESCE(t.ended_on,t.end_date)>=? ORDER BY t.start_date,t.id', bill.property_id, pe, ps),
  all(c, "SELECT m.* FROM tt_household_members m JOIN tt_tenancies t ON t.id=m.tenancy_id JOIN tt_units u ON u.id=t.unit_id WHERE u.property_id=? AND m.role IN ('co_tenant','occupant')", bill.property_id),
  all(c, 'SELECT tenancy_id,reference FROM tt_recovery_authorizations WHERE utility=?', bill.utility),
 ])
 const parties: Row[] = []
 for (const u of units) {
  const weight = bill.formula === 'bedrooms' ? Math.max(1, u.bedrooms) : bill.formula === 'submeter' ? Number(readings[u.id] ?? 0) : 1
  let occupied = 0
  for (const t of leases.filter(t => t.unit_id === u.id)) {
   const from = t.start_date > ps ? t.start_date : ps, end = t.ended_on ?? t.end_date, to = end < pe ? end : pe, days = span(from, to)
   occupied += days
   const people = bill.formula === 'occupants' ? days + members.filter(m => m.tenancy_id === t.id).reduce((s, m) => s + span(m.joined > from ? m.joined : from, m.left_on && m.left_on < to ? m.left_on : to), 0) : 0
   const basis = bill.formula === 'occupants' ? people : weight * days
   const label = bill.formula === 'occupants' ? `${people} occupant-days` : bill.formula === 'bedrooms' ? `${weight} bedroom${weight === 1 ? '' : 's'} × ${days} days` : bill.formula === 'submeter' ? `reading ${weight} × ${days} days` : `${days} days`
   const auth = allowed.find(a => a.tenancy_id === t.id)
   parties.push({ tenancyId: t.id, unitId: u.id, unit: u.identifier, address: t.address, currency: t.currency, basis, basisLabel: label, authorized: auth?.reference ?? null })
  }
  // Vacant days carry their share when the formula weighs units rather than people.
  const vacant = length - Math.min(length, occupied)
  if (vacant > 0 && bill.formula !== 'occupants') parties.push({ tenancyId: null, unitId: u.id, unit: u.identifier, basis: weight * vacant, basisLabel: `vacant ${vacant} days`, authorized: null })
 }
 const recoverable = half(bill.amount_cents, bill.recoverable_bp), total = parties.reduce((s, x) => s + x.basis, 0)
 for (const x of parties) x.shareCents = total ? Math.floor(recoverable * x.basis / total) : 0
 const rest = recoverable - parties.reduce((s, x) => s + x.shareCents, 0)
 if (rest > 0 && parties.length) parties.reduce((best, x) => x.basis > best.basis ? x : best, parties[0]).shareCents += rest
 for (const x of parties) { x.capped = !!(x.authorized && bill.cap_cents && x.shareCents > bill.cap_cents); x.chargeCents = x.authorized ? (x.capped ? bill.cap_cents : x.shareCents) : 0 }
 const charged = parties.reduce((s, x) => s + x.chargeCents, 0)
 const lines = parties.map(({ currency, ...x }) => x)
 return { lines, recoverableCents: recoverable, chargedCents: charged, unrecoveredCents: bill.amount_cents - charged, fingerprint: await sha256(new TextEncoder().encode(JSON.stringify([bill.id, bill.amount_cents, bill.recoverable_bp, bill.formula, bill.readings, bill.cap_cents, lines]))) }
}

export async function recoveryCommand(c: Context, command: string, p: Row): Promise<Row | undefined> {
 if (!RECOVERY_COMMANDS.includes(command)) return
 allow(c, command)
 if (command === 'recovery.authorize') {
  const t = await tenancy(c, p.tenancyId), utility = String(p.utility ?? '')
  insist(UTILITIES.includes(utility), 'invalid_utility', `Choose ${UTILITIES.join(', ')}.`)
  await commit(c, [sql(c, 'INSERT INTO tt_recovery_authorizations(tenancy_id,utility,reference,recorded_by,recorded_at) VALUES(?,?,?,?,?)', t.id, utility, text(p.reference, 'Lease clause reference', 300), c.actor.id, c.now)], command, `${t.id} ${utility}`)
  return { tenancyId: t.id, notice: `The lease authorizes ${utility} recovery.` }
 }
 if (command === 'utility.prepare') {
  const prop = await property(c, p.propertyId), utility = String(p.utility ?? ''), formula = String(p.formula ?? '')
  insist(UTILITIES.includes(utility), 'invalid_utility', `Choose ${UTILITIES.join(', ')}.`)
  insist(FORMULAS.some(f => f[0] === formula), 'invalid_formula', 'Choose occupants, bedrooms, equal or submeter.')
  const ps = date(p.periodStart, 'Bill period start'), pe = date(p.periodEnd, 'Bill period end')
  insist(pe >= ps, 'period', 'The bill period must end on or after it starts.')
  const readings = formula === 'submeter' ? Object.fromEntries(Object.keys(p).filter(k => k.startsWith('reading:')).map(k => { const v = Number(p[k]); insist(Number.isInteger(v) && v >= 0, 'invalid_reading', 'A submeter reading is a whole number of units.'); return [k.slice(8), v] })) : null
  const key = id()
  await commit(c, [sql(c, 'INSERT INTO tt_utility_bills(id,property_id,utility,vendor,invoice_reference,period_start,period_end,due_date,amount_cents,recoverable_bp,formula,readings,cap_cents,prepared_by,prepared_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)', key, prop.id, utility, text(p.vendor, 'Utility vendor', 200), text(p.invoiceReference, 'Invoice reference', 150), ps, pe, date(p.dueDate, 'Resident due date'), cents(p.amount), String(p.recoverablePercent ?? '').trim() === '' ? 10000 : basisPoints(p.recoverablePercent, 'Recoverable share'), formula, readings ? JSON.stringify(readings) : null, String(p.cap ?? '').trim() === '' ? null : cents(p.cap), c.actor.id, c.now)], command, key)
  const bill = await one(c, 'SELECT * FROM tt_utility_bills WHERE id=?', key)
  return { id: key, ...await allocation(c, bill!), notice: 'Utility bill recorded. Another person reviews and approves the allocation before anything is charged.' }
 }
 if (command === 'utility.approve') {
  const bill = await one(c, 'SELECT b.*,p.portfolio_id FROM tt_utility_bills b JOIN tt_properties p ON p.id=b.property_id WHERE b.id=?', text(p.billId, 'Utility bill', 100))
  insist(bill && reachesPortfolio(c, bill.portfolio_id), 'not_found', 'Utility bill not found.', 404)
  insist(bill.state === 'prepared', 'decided', 'This bill is already approved.', 409)
  const a = await allocation(c, bill)
  insist(p.fingerprint === a.fingerprint, 'review_changed', 'The allocation changed since it was reviewed. Review it again.', 409)
  const { label, guards } = await independence(c, command, [bill.prepared_by]), writes: D1PreparedStatement[] = [guard(c, "EXISTS(SELECT 1 FROM tt_utility_bills WHERE id=? AND state='prepared')", bill.id), ...guards]
  const name = bill.utility[0].toUpperCase() + bill.utility.slice(1), formula = FORMULAS.find(f => f[0] === bill.formula)![1]
  for (const x of a.lines.filter(x => x.chargeCents > 0)) {
   const t = (await one(c, 'SELECT * FROM tt_tenancies WHERE id=?', x.tenancyId))!, charge = id(), reference = `UTIL-${bill.invoice_reference}-${x.unit}`, description = `${name} recovery ${bill.invoice_reference} ${bill.period_start} to ${bill.period_end} (${formula}: ${x.basisLabel})`
   writes.push(sql(c, 'INSERT INTO tt_charges(id,tenancy_id,due_date,amount_cents,description,reference,created_at,currency) VALUES(?,?,?,?,?,?,?,?)', charge, t.id, bill.due_date, x.chargeCents, description, reference, c.now, t.currency))
   writes.push(sql(c, 'INSERT INTO tt_utility_allocations(bill_id,tenancy_id,basis,basis_label,amount_cents,capped,charge_id) VALUES(?,?,?,?,?,?,?)', bill.id, t.id, x.basis, x.basisLabel, x.chargeCents, x.capped ? 1 : 0, charge))
   const tax = await taxCharge(c, t, 'utility', bill.due_date, x.chargeCents, reference, description)
   if (tax) writes.push(taxInsert(c, t, bill.due_date, tax))
  }
  writes.push(sql(c, "UPDATE tt_utility_bills SET state='approved',fingerprint=?,approved_by=?,approved_at=?,approval_label=? WHERE id=?", a.fingerprint, c.actor.id, c.now, label, bill.id))
  await commit(c, writes, command, bill.id)
  return { id: bill.id, chargedCents: a.chargedCents, notice: `Allocation approved: ${a.lines.filter(x => x.chargeCents > 0).length} leases charged.` }
 }
 // ancillary.charge: a one-off parking, storage or other permitted charge, with the tax its reviewed rule calls for.
 const t = await tenancy(c, p.tenancyId), kind = String(p.kind ?? '')
 insist(['parking', 'storage', 'other'].includes(kind), 'invalid_kind', 'An ancillary charge is parking, storage or other.')
 const due = date(p.dueDate, 'Due date'), amount = cents(p.amount), description = text(p.description, 'Description', 300), reference = text(p.reference, 'Unique charge reference', 140), key = id()
 const tax = await taxCharge(c, t, kind, due, amount, reference, description)
 await commit(c, [sql(c, 'INSERT INTO tt_charges(id,tenancy_id,due_date,amount_cents,description,reference,created_at,currency) VALUES(?,?,?,?,?,?,?,?)', key, t.id, due, amount, description, reference, c.now, t.currency), ...(tax ? [taxInsert(c, t, due, tax)] : [])], command, key)
 return { id: key, tenancyId: t.id, taxCents: tax?.amount ?? 0, notice: tax ? `Charge recorded with ${tax.description}.` : 'Charge recorded. No reviewed tax rule applies.' }
}

/** A property's utility bills (prepared ones with their live allocation), tax rules, leases and recovery authorizations. */
export async function recoveryData(c: Context, propertyId: string) {
 const [bills, rules, leases, auths] = await Promise.all([
  all(c, 'SELECT * FROM tt_utility_bills WHERE property_id=? ORDER BY period_start DESC', propertyId), taxRules(c, propertyId),
  all(c, 'SELECT t.id,t.address,t.start_date,t.end_date FROM tt_tenancies t JOIN tt_units u ON u.id=t.unit_id WHERE u.property_id=? ORDER BY t.start_date', propertyId),
  all(c, 'SELECT a.* FROM tt_recovery_authorizations a JOIN tt_tenancies t ON t.id=a.tenancy_id JOIN tt_units u ON u.id=t.unit_id WHERE u.property_id=?', propertyId),
 ])
 const withAllocation = await Promise.all(bills.map(async b => ({ ...b, allocation: b.state === 'prepared' ? await allocation(c, b) : { lines: await all(c, 'SELECT * FROM tt_utility_allocations WHERE bill_id=?', b.id) } })))
 return { bills: withAllocation, rules, leases, auths }
}
