import { date, insist, shown, type Row } from './core'
import { localDate } from './zones'

type Bucket = 'current' | 'days1to30' | 'days31to60' | 'days61to90' | 'over90'
const calendarDay = (day: string) => Date.parse(day + 'T00:00:00Z') / 86400000
const bucketFor = (age: number): Bucket => age === 0 ? 'current' : age <= 30 ? 'days1to30' : age <= 60 ? 'days31to60' : age <= 90 ? 'days61to90' : 'over90'
function amount(value: unknown) {
 insist(typeof value === 'number' && Number.isSafeInteger(value) && value > 0, 'invalid_receivable', 'Receivable amounts must be positive integer cents.')
 return value
}
function sum(values: number[]) {
 return values.reduce((total, value) => {
  const result = total + value
  insist(Number.isSafeInteger(result), 'invalid_receivable', 'Receivable total exceeds exact integer cents.')
  return result
 }, 0)
}
function unique(rows: Row[]) {
 const ids = new Set<string>()
 for (const row of rows) {
  insist(typeof row.id === 'string' && row.id.length > 0 && !ids.has(row.id), 'invalid_receivable', 'Receivable records need distinct identifiers.')
  ids.add(row.id)
 }
}

/** Effective-date reconstruction from records known now, not a snapshot of what was known then.
 * Future-due charges and their allocations are excluded. Dates are inclusive property-local
 * calendar days; elapsed-day aging never divides a daylight-saving interval by 24 hours.
 * This calculation makes no assertion about payment settlement, collection policy or assignment.
 */
export function ageReceivables(tenancy: Row, charges: Row[], receipts: Row[], adjustments: Row[], asOf: string) {
 asOf = date(asOf, 'As of date')
 const currency = shown(tenancy), mine = charges.filter(q => q.tenancy_id === tenancy.id)
 unique(mine)
 const ids = new Set(mine.map(q => q.id)), paid = receipts.filter(r => ids.has(r.charge_id)), reduced = adjustments.filter(a => ids.has(a.charge_id))
 unique(paid); unique(reduced)
 // Validate stored currencies, including allocations outside the requested date window.
 for (const row of [...mine, ...reduced]) {
  insist(row.currency === tenancy.currency, 'currency_mismatch', 'A receivable record has a different stored currency from its tenancy.')
  amount(row.amount_cents)
 }
 for(const r of paid){
  insist(r.currency===tenancy.currency,'currency_mismatch','A receivable record has a different stored currency from its tenancy.')
  if(!r.reversal_of){amount(r.amount_cents);continue}
  amount(-r.amount_cents)
  const original=paid.find(x=>x.id===r.reversal_of&&!x.reversal_of&&x.charge_id===r.charge_id)
  insist(original&&r.received_date>=original.received_date&&-sum(paid.filter(x=>x.reversal_of===original.id).map(x=>x.amount_cents))<=original.amount_cents,'invalid_receivable','Refunds/reversals must match the original receipt and cannot exceed it.')
 }
 const receiptRows = paid.map(r => ({ chargeId: r.charge_id, id: r.id, date: date(r.received_date, 'Received date'), cents: r.amount_cents as number, reference: r.reference }))
 const reductionRows = reduced.map(a => {
  insist(typeof a.at === 'string' && Number.isFinite(Date.parse(a.at)) && /(?:Z|[+-]\d{2}:\d{2})$/.test(a.at), 'invalid_receivable', 'A reduction needs a recorded instant with a time zone.')
  return { chargeId: a.charge_id, id: a.id, date: a.posting_day?date(a.posting_day,'Reduction posting day'):localDate(a.at, tenancy.time_zone), cents: a.amount_cents as number, reason: a.reason }
 })
 const lines = mine.map(q => ({ row: q, dueDate: date(q.due_date, 'Due date') })).filter(q => q.dueDate <= asOf).map(({ row: q, dueDate }) => {
  const chargeReceipts = receiptRows.filter(r => r.chargeId === q.id && r.date <= asOf).map(({ chargeId: _, ...r }) => r)
  const chargeReductions = reductionRows.filter(a => a.chargeId === q.id && a.date <= asOf).map(({ chargeId: _, ...a }) => a)
  const billedCents = q.amount_cents as number, receiptsCents = sum(chargeReceipts.map(r => r.cents)), reductionsCents = sum(chargeReductions.map(a => a.cents))
  const outstandingCents = billedCents - sum([receiptsCents, reductionsCents])
  insist(outstandingCents >= 0, 'invalid_receivable', 'As-of receipts and reductions exceed their charge.')
  const ageDays = calendarDay(asOf) - calendarDay(dueDate)
  return { chargeId: q.id as string, dueDate, ageDays, bucket: bucketFor(ageDays), currency, billedCents, receiptsCents, reductionsCents, outstandingCents, receipts: chargeReceipts, reductions: chargeReductions }
 }).sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.chargeId.localeCompare(b.chargeId))
 const buckets: Record<Bucket, number> = { current: 0, days1to30: 0, days31to60: 0, days61to90: 0, over90: 0 }
 for (const line of lines) buckets[line.bucket] = sum([buckets[line.bucket], line.outstandingCents])
 return {
  asOf, currency, timeZone: tenancy.time_zone as string, charges: lines, buckets,
  billedCents: sum(lines.map(q => q.billedCents)), receivedCents: sum(lines.map(q => q.receiptsCents)), reductionsCents: sum(lines.map(q => q.reductionsCents)),
  balanceCents: sum(lines.map(q => q.outstandingCents)), overdueCents: sum(lines.filter(q => q.ageDays > 0).map(q => q.outstandingCents)),
 }
}
