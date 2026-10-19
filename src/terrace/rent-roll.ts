// REPORT-001: the rent roll as of a date and the month's collection view. A unit is occupied on a day when a
// lease covers it (start to move-out or end); otherwise vacant, noting a future lease. Contract rent on a day
// is the rent of the lease period covering it: a renewal's earlier terms (TER-003 history) until that period
// ends, then the current rent. Recurring charges and concessions are the PAY-001 terms in effect that day.
// Collections count charges due in the month and the recorded external receipts against them; Terrace holds
// no pending funds (PAY-002 adds them), so pending is always reported as none.
import { all, date, insist, manager, money, shown, text, type Context, type Row } from './core'
import { occupiedTo } from './properties'

const covers = (l: Row, d: string) => l.start_date <= d && occupiedTo(l) >= d
const METHOD: Record<string, string> = { ach: 'ACH', card: 'card', cash: 'cash', check: 'check', other: 'other' }

export async function rentRoll(c: Context, q: Row) {
 manager(c)
 const asOf = date(q.asOf, 'As of date'), property = q.propertyId ? text(q.propertyId, 'Property', 100) : '', occupancy = q.occupancy ? String(q.occupancy) : ''
 insist(['', 'occupied', 'vacant'].includes(occupancy), 'invalid_filter', 'Occupancy is occupied or vacant.')
 const [units, leases, history, terms] = await Promise.all([
  all(c, 'SELECT u.*,p.name AS property_name,p.id AS property_id,f.name AS portfolio_name FROM tt_units u JOIN tt_properties p ON p.id=u.property_id JOIN tt_portfolios f ON f.id=p.portfolio_id ORDER BY f.name,p.name,u.identifier'),
  all(c, 'SELECT * FROM tt_tenancies ORDER BY start_date'),
  all(c, 'SELECT * FROM tt_lease_history ORDER BY end_date'),
  all(c, 'SELECT * FROM tt_lease_terms WHERE starts<=? AND (ends IS NULL OR ends>=?) ORDER BY kind', asOf, asOf),
 ])
 const rentOn = (l: Row) => history.find(h => h.tenancy_id === l.id && h.start_date <= asOf && h.end_date >= asOf)?.rent_cents ?? l.rent_cents
 const line = (unit: Row | null, l: Row | undefined, next: Row | undefined) => {
  const mine = l ? terms.filter(t => t.tenancy_id === l.id) : []
  return { unitId: unit?.id ?? null, portfolio: unit?.portfolio_name ?? '', propertyId: unit?.property_id ?? null, property: unit?.property_name ?? '', unit: unit?.identifier ?? '', address: l?.address ?? (unit ? `Unit ${unit.identifier}, ${unit.property_name}` : ''), bedrooms: unit?.bedrooms ?? null, marketRentCents: unit?.market_rent_cents ?? null,
   state: l ? 'occupied' : next ? 'vacant, leased' : 'vacant', tenancyId: l?.id ?? null, resident: l?.tenant_name ?? '', leaseStart: l?.start_date ?? '', leaseEnd: l ? occupiedTo(l) : '', contractRentCents: l ? rentOn(l) : 0, currency: l ? shown(l) : 'USD', cadence: l?.cadence ?? '',
   recurring: mine.filter(t => t.kind !== 'concession').map(t => ({ termId: t.id, kind: t.kind, amountCents: t.amount_cents })), concessions: mine.filter(t => t.kind === 'concession').map(t => ({ termId: t.id, amountCents: t.amount_cents })),
   deposit: 'not recorded', nextLease: next ? { tenancyId: next.id, resident: next.tenant_name, start: next.start_date } : null }
 }
 const rows = [
  ...units.map(u => { const on = leases.filter(l => l.unit_id === u.id); return line(u, on.find(l => covers(l, asOf)), on.find(l => l.start_date > asOf)) }),
  ...leases.filter(l => !l.unit_id && covers(l, asOf)).map(l => line(null, l, undefined)),
 ].filter(r => (!property || r.propertyId === property) && (!occupancy || (occupancy === 'occupied' ? r.state === 'occupied' : r.state !== 'occupied')))
 const unitRows = rows.filter(r => r.unitId), occupied = rows.filter(r => r.state === 'occupied')
 const sums = (pick: (r: Row) => number | null, list: Row[]) => Object.entries(list.reduce((m: Record<string, number>, r) => { const v = pick(r); if (v) m[r.currency] = (m[r.currency] ?? 0) + v; return m }, {})).map(([currency, cents]) => ({ currency, cents }))
 return { asOf, filters: { propertyId: property || null, occupancy: occupancy || null }, rows, totals: { units: unitRows.length, occupiedUnits: unitRows.filter(r => r.state === 'occupied').length, vacantUnits: unitRows.filter(r => r.state !== 'occupied').length, leasesWithoutUnit: rows.length - unitRows.length, contractRent: sums(r => r.contractRentCents, occupied), marketRent: sums(r => r.marketRentCents, unitRows) } }
}

export async function collections(c: Context, m: unknown) {
 manager(c)
 const month = text(m, 'Month', 7); insist(/^\d{4}-(0[1-9]|1[0-2])$/.test(month), 'invalid_month', 'Choose a month as YYYY-MM.')
 const [charges, receipts, adjustments] = await Promise.all([
  all(c, "SELECT q.*,t.address,t.tenant_name,t.currency_confirmed,u.identifier AS unit FROM tt_charges q JOIN tt_tenancies t ON t.id=q.tenancy_id LEFT JOIN tt_units u ON u.id=t.unit_id WHERE substr(q.due_date,1,7)=? ORDER BY t.address", month),
  all(c, "SELECT r.* FROM tt_receipts r JOIN tt_charges q ON q.id=r.charge_id WHERE substr(q.due_date,1,7)=?", month),
  all(c, "SELECT a.* FROM tt_adjustments a JOIN tt_charges q ON q.id=a.charge_id WHERE substr(q.due_date,1,7)=?", month),
 ])
 const leases = [...new Set(charges.map(q => q.tenancy_id))].map(id => {
  const mine = charges.filter(q => q.tenancy_id === id), ids = new Set(mine.map(q => q.id)), paid = receipts.filter(r => ids.has(r.charge_id))
  const billed = mine.reduce((s, q) => s + q.amount_cents, 0), reduced = adjustments.filter(a => ids.has(a.charge_id)).reduce((s, a) => s + a.amount_cents, 0), collected = paid.reduce((s, r) => s + r.amount_cents, 0)
  const outstanding = billed - reduced - collected, methods = [...new Set(paid.map(r => r.method ? METHOD[r.method] : 'method not recorded'))]
  const state = outstanding > 0 ? (collected > 0 ? 'partial' : 'unpaid') : collected > 0 ? `paid by ${methods.join(', ')}` : 'reduced to zero'
  return { tenancyId: id, address: mine[0].address, unit: mine[0].unit ?? '', resident: mine[0].tenant_name, currency: shown(mine[0]), billedCents: billed, reducedCents: reduced, collectedCents: collected, outstandingCents: outstanding, pendingCents: 0, methods, state, paidInFull: outstanding === 0 }
 })
 const totals = [...new Set(leases.map(l => l.currency))].map(currency => { const mine = leases.filter(l => l.currency === currency); return { currency, billedCents: mine.reduce((s, l) => s + l.billedCents, 0), collectedCents: mine.reduce((s, l) => s + l.collectedCents, 0), reducedCents: mine.reduce((s, l) => s + l.reducedCents, 0), pendingCents: 0, leases: mine.length, paidInFull: mine.filter(l => l.paidInFull).length } })
 return { month, leases, totals }
}

/** The rent roll as table rows for CSV, XLSX and PDF: the same filtered rows the page shows. */
export function rentRollTable(r: Row): (string | number)[][] {
 const amount = (n: number | null, k: string) => n ? money(n, k) : ''
 return [['Rent roll as of ' + r.asOf], ['Portfolio', 'Property', 'Unit', 'Bedrooms', 'State', 'Resident', 'Lease start', 'Lease end', 'Contract rent', 'Market rent', 'Recurring charges', 'Concessions', 'Deposit', 'Next lease'],
  ...r.rows.map((x: Row) => [x.portfolio, x.property, x.unit || x.address, x.bedrooms ?? '', x.state, x.resident, x.leaseStart, x.leaseEnd, amount(x.contractRentCents, x.currency), amount(x.marketRentCents, 'USD'), x.recurring.map((t: Row) => `${t.kind} ${money(t.amountCents, x.currency)}`).join('; '), x.concessions.map((t: Row) => money(t.amountCents, x.currency)).join('; '), x.deposit, x.nextLease ? `${x.nextLease.resident} from ${x.nextLease.start}` : '']),
  ['Units', r.totals.units, 'Occupied', r.totals.occupiedUnits, 'Vacant', r.totals.vacantUnits, 'Contract rent', r.totals.contractRent.map((t: Row) => money(t.cents, t.currency)).join(' + '), 'Market rent', r.totals.marketRent.map((t: Row) => money(t.cents, t.currency)).join(' + ')]]
}
