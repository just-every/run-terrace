// REPORT-004. The maintenance service and cost report over the viewer's portfolios (ROLE-001), read only from
// recorded jobs, approvals, handoffs, completion reports, resident checks, closures, assets and owner budgets.
// A job counts as resolved only when the resident's confirmation is its current outcome (WORK-008); a vendor's
// completion report alone, or a closure without confirmation, never shortens resolution time. Costs are approved
// estimates, not invoiced amounts (WORK-009 carries invoices). Booking time uses the first appointment
// confirmed by both parties externally and recorded by staff. Emergency triage arrives with WORK-001.
import { all, allow, date, insist, shown, type Context, type Row } from './core'
import { localDate } from './zones'
import { tenancyData } from './tenancies'

const HOUR = 3600000
const hours = (from: string, to: string | null | undefined) => to ? Math.round((Date.parse(to) - Date.parse(from)) / HOUR * 10) / 10 : null
const STATUS: Record<string, string> = { pending: 'waiting for approval', approved: 'approved, not handed off', sent: 'handed off, no completion report', awaiting_check: 'completion reported, resident not confirmed', reopened: 'reopened', resolved: 'resolved, resident confirmed', closed: 'closed without the resident’s confirmation' }
const status = (j: Row) => j.resolution ?? j.state
export const OPEN = (s: string) => s !== 'resolved' && s !== 'closed'

export async function serviceReport(c: Context, q: Row) {
 allow(c, 'maintenance.report')
 const from = q.from ? date(q.from, 'From') : '0000-01-01', to = q.to ? date(q.to, 'To') : '9999-12-31', property = q.propertyId ? String(q.propertyId) : '', only = q.status ? String(q.status) : ''
 insist(['', 'unresolved', ...Object.keys(STATUS)].includes(only), 'invalid_filter', 'Status is unresolved or one of the job states.')
 const tenancies = new Map((await tenancyData(c)).map(t => [t.id, t]))
 const [jobs, approvals, attempts, checks, closures, units, assets, limits, bookings] = await Promise.all([
  all(c, 'SELECT * FROM tt_maintenance_jobs ORDER BY prepared_at'),
  all(c, 'SELECT job_id,MIN(approved_at) AS first FROM tt_maintenance_approvals GROUP BY job_id'),
  all(c, 'SELECT * FROM tt_completion_attempts ORDER BY attempt'),
  all(c, 'SELECT * FROM tt_resident_checks ORDER BY recorded_at'),
  all(c, 'SELECT * FROM tt_job_closures'),
  all(c, 'SELECT u.id,u.identifier,p.id AS property_id,p.name AS property_name FROM tt_units u JOIN tt_properties p ON p.id=u.property_id'),
  all(c, 'SELECT id,kind,location,serial FROM tt_assets'),
  all(c, 'SELECT * FROM tt_work_limits WHERE budget_cents IS NOT NULL'),
  all(c, 'SELECT job_id,MIN(confirmed_at) AS first FROM tt_appointments WHERE confirmed_at IS NOT NULL GROUP BY job_id'),
 ])
 const today = localDate(c.now, c.zone!)
 const rows = jobs.filter(j => tenancies.has(j.tenancy_id)).map(j => {
  const t = tenancies.get(j.tenancy_id)!, u = units.find(x => x.id === t.unit_id), s = status(j), mine = attempts.filter(a => a.job_id === j.id)
  const confirmed = s === 'resolved' ? checks.filter(x => x.job_id === j.id && x.outcome === 'confirmed').at(-1)?.recorded_at : null
  const approved = approvals.find(a => a.job_id === j.id)?.first ?? null, closed = closures.find(x => x.job_id === j.id)?.closed_at ?? null, asset = assets.find(a => a.id === j.asset_id)
  const booked = bookings.find(a => a.job_id === j.id)?.first ?? null
  const missing = [...(approved ? [] : ['no approval recorded']), ...(j.sent_at ? [] : ['no handoff recorded']), ...(booked ? [] : ['booking not recorded (WORK-005)']), ...(mine.length || !j.sent_at ? [] : ['no completion report'])]
  return { jobId: j.id, tenancyId: t.id, address: t.address, propertyId: u?.property_id ?? null, property: u?.property_name ?? t.address, title: j.title, vendor: j.trade_name, assetId: asset?.id ?? null, asset: asset ? `${asset.kind} · ${asset.location} · ${asset.serial}` : null, status: s, label: STATUS[s], preparedAt: j.prepared_at, preparedOn: localDate(j.prepared_at, t.time_zone), firstApprovedAt: approved, firstConfirmedAppointmentAt: booked, bookingHours: hours(j.prepared_at, booked), handedOffAt: j.sent_at ?? null, firstCompletion: mine[0]?.completed_date ?? null, confirmedAt: confirmed ?? null, closedAt: closed, ageDays: OPEN(s) ? Math.max(0, Math.round((Date.parse(today) - Date.parse(localDate(j.prepared_at, t.time_zone))) / 86400000)) : null, responseHours: hours(j.prepared_at, approved), handoffHours: hours(j.prepared_at, j.sent_at), resolutionHours: hours(j.prepared_at, confirmed), attempts: mine.length, callbacks: mine.filter(a => a.callback).map(a => a.callback), estimateCents: j.estimate_cents, currency: shown(t) === 'unconfirmed' ? 'unconfirmed' : j.currency, approvedTerms: ['approved', 'sent'].includes(j.state), costBasis: ['approved', 'sent'].includes(j.state) ? 'approved estimate, not invoiced' : 'estimate, current terms not approved', missing }
 }).filter(r => r.preparedOn >= from && r.preparedOn <= to && (!property || r.propertyId === property) && (!only || (only === 'unresolved' ? OPEN(r.status) : r.status === only)))
 const resolved = rows.filter(r => r.resolutionHours !== null)
 const avg = (xs: number[]) => xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length * 10) / 10 : null
 const vendors = [...new Set(rows.map(r => r.vendor))].map(v => { const mine = rows.filter(r => r.vendor === v); return { vendor: v, jobs: mine.length, resolved: mine.filter(r => r.status === 'resolved').length, reopened: mine.filter(r => r.status === 'reopened').length, callbacks: mine.reduce((n, r) => n + r.callbacks.length, 0), averageResolutionHours: avg(mine.filter(r => r.resolutionHours !== null).map(r => r.resolutionHours!)) } })
 const assetCost = [...new Set(rows.filter(r => r.assetId && r.approvedTerms).map(r => r.assetId + '|' + r.currency))].map(k => { const [assetId, currency] = k.split('|'), mine = rows.filter(r => r.assetId === assetId && r.currency === currency && r.approvedTerms); return { assetId, asset: mine[0].asset, currency, jobs: mine.length, approvedEstimateCents: mine.reduce((n, r) => n + r.estimateCents, 0) } })
 // Budget variance: each owner budget (WORK-003) against approved and handed-off estimates due in that year, as WORK-003 counts them.
 const budgets = limits.flatMap(l => {
  const inScope = (j: Row) => { const t = tenancies.get(j.tenancy_id); if (!t) return false; return l.scope.startsWith('property:') ? units.find(x => x.id === t.unit_id)?.property_id === l.scope.slice(9) : l.scope === 'tenancy:' + t.id }
  if (l.scope.startsWith('property:') && !units.some(u => u.property_id === l.scope.slice(9) && [...tenancies.values()].some(t => t.unit_id === u.id))) return []
  if (l.scope.startsWith('tenancy:') && !tenancies.has(l.scope.slice(8))) return []
  const committed = jobs.filter(j => inScope(j) && ['approved', 'sent'].includes(j.state)), years = [...new Set(committed.map(j => String(j.due_date).slice(0, 4)))].sort()
  const name = l.scope.startsWith('property:') ? units.find(u => u.property_id === l.scope.slice(9))?.property_name : tenancies.get(l.scope.slice(8))?.address
  return years.map(year => { const spent = committed.filter(j => String(j.due_date).slice(0, 4) === year).reduce((n, j) => n + j.estimate_cents, 0); return { scope: name, year, currency: l.currency, budgetCents: l.budget_cents, committedCents: spent, varianceCents: l.budget_cents - spent } })
 })
 return {
  filters: { from: q.from ?? null, to: q.to ?? null, propertyId: property || null, status: only || null }, today, rows,
  summary: { jobs: rows.length, open: rows.filter(r => OPEN(r.status)).length, resolved: resolved.length, closedWithoutConfirmation: rows.filter(r => r.status === 'closed').length, reopened: rows.filter(r => r.status === 'reopened').length, repeatRepairs: rows.filter(r => r.callbacks.length).length, averageResponseHours: avg(rows.filter(r => r.responseHours !== null).map(r => r.responseHours!)), averageResolutionHours: avg(resolved.map(r => r.resolutionHours!)), oldestOpenDays: Math.max(0, ...rows.filter(r => r.ageDays !== null).map(r => r.ageDays!)), openEmergencies: 'not recorded: emergency triage arrives with WORK-001', averageBookingHours: avg(rows.filter(r => r.bookingHours !== null).map(r => r.bookingHours!)), bookingTime: 'preparation to first appointment confirmed by both parties, recorded by staff; Terrace did not contact either party' },
  vendors, assetCost, budgets,
  boundary: 'Durations run from preparation to the first approval, the first appointment confirmed by both parties (recorded by staff), the handoff and the resident’s current confirmation; a completion report or a closure without confirmation is not a resolution. Costs are estimates, not invoices.',
 }
}
const amount = (n: number) => (n / 100).toFixed(2)
export const serviceTable = (r: Awaited<ReturnType<typeof serviceReport>>): (string | number)[][] => [
 ['Job', 'Property', 'Tenancy', 'Work', 'Vendor', 'Asset', 'Status', 'Prepared', 'First approved', 'First confirmed appointment', 'Booking (h)', 'Handed off', 'Resident confirmed', 'Closed', 'Age (days)', 'Response (h)', 'Resolution (h)', 'Attempts', 'Callbacks', 'Currency', 'Estimate', 'Cost basis', 'Missing'],
 ...r.rows.map(x => [x.jobId, x.property, x.address, x.title, x.vendor, x.asset ?? '', x.label, x.preparedAt, x.firstApprovedAt ?? '', x.firstConfirmedAppointmentAt ?? '', x.bookingHours ?? '', x.handedOffAt ?? '', x.confirmedAt ?? '', x.closedAt ?? '', x.ageDays ?? '', x.responseHours ?? '', x.resolutionHours ?? '', x.attempts, x.callbacks.join(' '), x.currency, amount(x.estimateCents), x.costBasis, x.missing.join('; ')]),
 [r.boundary],
]
