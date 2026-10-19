import { all, allow, date, insist, one, tenancy, text, type Context, type Row } from './core'

const DAY = 86400000
const addDays = (day: string, n: number) => new Date(Date.parse(day + 'T00:00:00Z') + n * DAY).toISOString().slice(0, 10)
const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / DAY)
const names = { repair: 'Repair before listing', market: 'Immediate marketing with concession' }
const amounts = ['Rent', 'RenewalRent', 'Concession', 'DepositsHeld', 'NewDeposits', 'DepositRefunds', 'Capital', 'Distributions', 'OpeningCash'] as const

function amount(v: unknown, label: string) {
 const s = text(v, label, 16)
 insist(/^\d+(\.\d{1,2})?$/.test(s), 'invalid_money', `${label}: enter an explicit amount, including zero, with at most two decimal places.`)
 const [whole, fraction = ''] = s.split('.'), n = Number(whole) * 100 + Number(fraction.padEnd(2, '0'))
 insist(Number.isSafeInteger(n) && n <= 100000000, 'invalid_money', `${label} must be at most 1,000,000.00.`)
 return n
}
function integer(v: unknown, label: string) {
 const s = text(v, label, 4), n = Number(s)
 insist(/^\d+$/.test(s) && n <= 3660, 'invalid_input', `${label} must be a whole number from 0 to 3660.`)
 return n
}
function planInput(q: Row, key: 'repair' | 'market', from: string, to: string) {
 const p: Row = { key, name: names[key], source: text(q[key + 'Source'], `${names[key]} assumption sources`, 2000) }
 for (const name of amounts) p[name[0].toLowerCase() + name.slice(1) + 'Cents'] = amount(q[key + name], `${names[key]}: ${name}`)
 p.vacancyDays = integer(q[key + 'VacancyDays'], `${names[key]} letting days`)
 p.makeReadyDays = integer(q[key + 'MakeReadyDays'], `${names[key]} make-ready days`)
 const percent = text(q[key + 'CollectionPercent'], `${names[key]} collection percent`, 6)
 insist(/^\d{1,3}(\.\d{1,2})?$/.test(percent), 'invalid_input', 'Collection percent needs at most two decimal places.')
 const [whole, fraction = ''] = percent.split('.')
 p.collectionBp = Number(whole) * 100 + Number(fraction.padEnd(2, '0'))
 insist(p.collectionBp <= 10000, 'invalid_input', 'Collection percent must be between 0 and 100.')
 const renewal = text(q[key + 'RenewalDate'], `${names[key]} renewal date or none`, 10)
 p.renewalDate = renewal === 'none' ? null : date(renewal, 'Assumed renewal date')
 insist(!p.renewalDate || (p.renewalDate >= from && p.renewalDate <= to), 'scenario_renewal', 'Assumed renewal date must be inside the horizon.')
 insist(p.renewalDate || p.renewalRentCents === 0, 'scenario_renewal', 'Enter zero renewal rent when the renewal date is none.')
 return p
}

/** Accumulate rational daily rent, then round once, half up. Monthly denominators use each local calendar month's length. */
function projectedRent(p: Row, cadence: string, to: string) {
 let numerator = 0n, denominator = 1n, renewalNumerator = 0n, renewalDenominator = 1n
 const gcd = (a: bigint, b: bigint): bigint => b ? gcd(b, a % b) : a
 const plus = (a: bigint, b: bigint, cents: number, divisor: number) => {
  const d = BigInt(divisor), n = a * d + BigInt(cents) * b, den = b * d, common = gcd(n, den)
  return [n / common, den / common]
 }
 for (let day = p.readyDate; day <= to; day = addDays(day, 1)) {
  const dt = new Date(day + 'T00:00:00Z'), divisor = cadence === 'monthly' ? new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth() + 1, 0)).getUTCDate() : cadence === 'weekly' ? 7 : 14
  const renewed = p.renewalDate && day >= p.renewalDate, rent = renewed ? p.renewalRentCents : p.rentCents
  ;[numerator, denominator] = plus(numerator, denominator, rent, divisor)
  if (renewed) [renewalNumerator, renewalDenominator] = plus(renewalNumerator, renewalDenominator, rent, divisor)
 }
 const rounded = (n: bigint, d: bigint) => Number((2n * n + d) / (2n * d))
 return { grossRentCents: rounded(numerator, denominator), renewalGrossRentCents: rounded(renewalNumerator, renewalDenominator), collectedRentCents: rounded(numerator * BigInt(p.collectionBp), denominator * 10000n) }
}

/** REPORT-007: current source facts plus explicit user estimates; no writes, pricing approval or bank-balance inference. */
export async function scenarioReport(c: Context, q: Row): Promise<Row> {
 allow(c, 'reports.read')
 const t = await tenancy(c, q.tenancyId), from = date(q.from, 'Horizon start'), to = date(q.to, 'Horizon end')
 const horizonDays = daysBetween(from, to) + 1
 insist(horizonDays > 0 && horizonDays <= 3660, 'scenario_horizon', 'Use an inclusive horizon of 1 to 3660 property-local days.')
 const assumptions = { date: date(q.assumptionsDate, 'Assumptions date'), reference: text(q.reference, 'Comparison source reference', 1000), confidence: text(q.confidence, 'Confidence and uncertainty note', 1000), kind: 'User estimates, not measured confidence' }
 const inputs = (['repair', 'market'] as const).map(key => planInput(q, key, from, to))
 insist(t.currency_confirmed !== 0, 'scenario_currency', 'Confirm the tenancy currency before comparing cash. No conversion is performed.', 409)
 // Current agreement reserves and vendor bills are recorded only in USD. Never relabel or convert them.
 insist(t.currency === 'USD', 'scenario_currency', 'Current management-agreement reserves and vendor payables are USD. This tenancy uses another currency; a mixed-currency comparison cannot be calculated.', 409)
 const property = t.unit_id ? await one(c, 'SELECT p.id,p.name,p.time_zone FROM tt_properties p JOIN tt_units u ON u.property_id=p.id WHERE u.id=?', t.unit_id) : null
 insist(property, 'scenario_property', 'A property-linked tenancy is required to source current payables and the dated reserve agreement.', 409)
 const [agreements, bills] = await Promise.all([
  all(c, 'SELECT id,starts,reserve_cents,reference FROM tt_management_agreements WHERE property_id=? AND starts<=? ORDER BY starts', property.id, to),
  all(c, "SELECT b.id,b.version,b.invoice_number,b.day,r.terms FROM tt_bills b JOIN tt_bill_revisions r ON r.bill_id=b.id AND r.version=b.version WHERE b.state='payable' ORDER BY b.day,b.id"),
 ])
 const firstAgreement = agreements.filter(a => a.starts <= from).at(-1), agreement = agreements.at(-1)
 insist(firstAgreement && agreement, 'scenario_agreement', 'Record a management agreement effective by the horizon start. An absent reserve requirement is unknown, not zero.', 409)
 const payables = bills.flatMap(b => {
  const terms = JSON.parse(b.terms), allocation = terms.allocations.find((a: Row) => a.propertyId === property.id)
  return allocation ? [{ id: b.id, version: b.version, invoice: b.invoice_number, date: b.day, currency: terms.currency, amountCents: allocation.amountCents }] : []
 })
 insist(payables.every(b => b.currency === t.currency), 'scenario_currency', 'A current payable uses another currency. No mixed-currency total is available.', 409)
 const payableCents = payables.reduce((n, b) => n + b.amountCents, 0), reserveCents = agreement.reserve_cents
 const plans = inputs.map(p => {
  const totalVacantDays = p.key === 'repair' ? p.makeReadyDays + p.vacancyDays : Math.max(p.makeReadyDays, p.vacancyDays)
  const dates = { readyDate: addDays(from, totalVacantDays), workReadyDate: addDays(from, p.makeReadyDays), marketingDate: p.key === 'repair' ? addDays(from, p.makeReadyDays) : from, totalVacantDays, vacantDaysInHorizon: Math.min(totalVacantDays, horizonDays) }
  const rent = projectedRent({ ...p, ...dates }, t.cadence, to)
  const availableBeforeDistributionsCents = p.openingCashCents + rent.collectedRentCents - p.concessionCents - payableCents - p.capitalCents - reserveCents
  const afterDistributionsCents = availableBeforeDistributionsCents - p.distributionsCents
  const deposits = { alreadyHeldCents: p.depositsHeldCents, newExpectedCents: p.newDepositsCents, refundsCents: p.depositRefundsCents, closingLiabilityCashCents: p.depositsHeldCents + p.newDepositsCents - p.depositRefundsCents, category: 'Separate deposit liability cash; excluded from operating cash and owner distributions; new receipts are not discounted by collection percent' }
  return { ...p, ...dates, ...rent, payableCents, reserveRequirementCents: reserveCents, availableBeforeDistributionsCents, afterDistributionsCents, potentialShortfallCents: Math.max(0, -afterDistributionsCents), deposits }
 })
 return {
  tenancyId: t.id, from, to, horizonDays, currency: t.currency, zone: t.time_zone, assumptions,
  facts: { tenancy: { id: t.id, rentCents: t.rent_cents, cadence: t.cadence, currency: t.currency, zone: t.time_zone, leaseEnd: t.end_date, version: t.version }, property, payables, payableCents, agreement: { id: agreement.id, starts: agreement.starts, reference: agreement.reference, reserveRequirementCents: reserveCents, currency: 'USD' }, reserveSchedule: [firstAgreement, ...agreements.filter(a => a.starts > from)] },
  plans,
  difference: { direction: 'Immediate marketing minus repair before listing', cashCents: plans[1].afterDistributionsCents - plans[0].afterDistributionsCents, vacantDays: plans[1].vacantDaysInHorizon - plans[0].vacantDaysInHorizon, readyDays: daysBetween(plans[0].readyDate, plans[1].readyDate) },
  boundary: 'Read-only estimates, not bank balances or lease-pricing/distribution approval. Dates are inclusive property-local days. All current approved unpaid vendor allocations are deducted once, regardless of invoice date; do not repeat them in capital assumptions. Reserve is the dated requirement at horizon end, not cash held. Opening operating cash, deposits, new rent and renewals are source-labelled assumptions, not inferred history. Make-ready and letting run sequentially for repairs and concurrently for immediate marketing. Ready date is the first assumed rent day. Collection percent is a user estimate applied only to exact gross rent; concessions and all costs are deducted at their full assumed amount. No other fees, taxes, arrears or bank reconciliation are inferred; include additional expected operating costs in capital with a source note. Actual books remain unchanged.',
 }
}
