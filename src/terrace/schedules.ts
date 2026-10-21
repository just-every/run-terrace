// WORK-010: recurring maintenance. A schedule's occurrences fall every `interval_months` from its first due date
// (the same day of the month, or the month's last day when shorter). A scheduler run creates one pending
// maintenance order, for the schedule's budget and vendor, for each occurrence whose effective due date (its
// deferred date, if deferred) is on or before the property-local today plus the lead days. Replays create
// nothing new. An occurrence past its effective due date whose order has not been handed off is overdue.
import { all, cents, commit, guard, date, insist, allow, one, sql, tenancy, text, id, type Context, type Row, reaches } from './core'
import { serviceableAsset } from './assets'
import { jobWrites } from './job-writes'
import { trade, vendor } from './vendors'
import { localDate } from './zones'

const LIMIT = 60
export function addMonths(day: string, months: number) {
 const [y, m, d] = day.split('-').map(Number), target = new Date(Date.UTC(y, m - 1 + months, 1))
 const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate()
 return new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), Math.min(d, last))).toISOString().slice(0, 10)
}
const addDays = (day: string, n: number) => new Date(Date.parse(day + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10)
/** Nominal occurrence dates through `through`, at most LIMIT. */
export function occurrences(s: Row, through: string) {
 const out: string[] = []
 for (let k = 0; k < LIMIT; k++) { const d = addMonths(s.first_due, k * s.interval_months); if (d > through) break; out.push(d) }
 return out
}

export async function scheduleCommand(c: Context, command: string, p: Row): Promise<Row | undefined> {
 if (command === 'schedule.add') {
  allow(c, command)
  const t = await tenancy(c, p.tenancyId), key = id(), asset = await serviceableAsset(c, t.id, p.assetId)
  const inspection = p.inspectionId ? await one(c, "SELECT id FROM tt_inspections WHERE id=? AND tenancy_id=? AND state='completed'", text(p.inspectionId, 'Inspection', 100), t.id) : null
  insist(!p.inspectionId || inspection, 'not_found', 'Choose a completed inspection of this tenancy.', 404)
  const listed = await vendor(c, p.vendorId), interval = Number(p.intervalMonths), lead = p.leadDays === undefined || p.leadDays === '' ? 30 : Number(p.leadDays)
  insist(Number.isInteger(interval) && interval >= 1 && interval <= 60, 'invalid_interval', 'Repeat every 1 to 60 months.')
  insist(Number.isInteger(lead) && lead >= 0 && lead <= 90, 'invalid_lead', 'Create orders 0 to 90 days ahead.')
  await commit(c, [sql(c, 'INSERT INTO tt_schedules(id,tenancy_id,title,source,asset_id,inspection_id,trade,vendor_id,interval_months,first_due,lead_days,budget_cents,currency,created_by,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)', key, t.id, text(p.title, 'Work', 200), asset ? 'asset' : inspection ? 'inspection' : 'seasonal', asset?.id ?? null, inspection?.id ?? null, trade(p.trade), listed.id, interval, date(p.firstDue, 'First due date'), lead, cents(p.budget), t.currency, c.actor.id, c.now)], command, key)
  return { id: key, tenancyId: t.id, notice: 'Schedule saved. Run the scheduler to create its due orders.' }
 }
 if (command === 'schedule.defer') {
  allow(c, command)
  const s = await one(c, 'SELECT * FROM tt_schedules WHERE id=?', text(p.scheduleId, 'Schedule', 100))
  insist(s, 'not_found', 'Schedule not found.', 404)
  const due = date(p.dueDate, 'Occurrence date'), to = date(p.deferTo, 'Deferred to')
  insist(occurrences(s, due).at(-1) === due, 'invalid_occurrence', 'That date is not an occurrence of this schedule.')
  insist(to > due, 'invalid_defer', 'Defer to a date after the occurrence.')
  const existing = await one(c, 'SELECT o.id,(SELECT id FROM tt_maintenance_jobs WHERE occurrence_id=o.id) AS job_id FROM tt_schedule_occurrences o WHERE schedule_id=? AND due_date=?', s.id, due)
  insist(!existing?.job_id, 'occurrence_ordered', 'This occurrence already has an order. Change or reject that order instead.', 409)
  await commit(c, [sql(c, 'INSERT INTO tt_schedule_occurrences(id,schedule_id,due_date,deferred_to,defer_reason,deferred_by,asset_id,created_at) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(schedule_id,due_date) DO UPDATE SET deferred_to=excluded.deferred_to,defer_reason=excluded.defer_reason,deferred_by=excluded.deferred_by WHERE NOT EXISTS(SELECT 1 FROM tt_maintenance_jobs WHERE occurrence_id=tt_schedule_occurrences.id)', existing?.id ?? id(), s.id, due, to, text(p.reason, 'Reason', 500), c.actor.id, s.asset_id, c.now)], command, s.id)
  return { id: s.id, tenancyId: s.tenancy_id, notice: `Occurrence of ${due} deferred to ${to}.` }
 }
 if (command === 'schedule.run') {
  allow(c, command)
  const { writes, created, existing } = await schedulePlan(c)
  if (writes.length) await commit(c, writes, command, 'schedules')
  return { created, existing, notice: `Scheduler run: ${created} new ${created === 1 ? 'order' : 'orders'}, ${existing} already ordered.` }
 }
}

/** Plans due occurrence orders without approving or sending them; the caller commits the entire plan atomically. */
export async function schedulePlan(c: Context) {
 let created = 0, existing = 0
 const writes: D1PreparedStatement[] = []
 // ROLE-001: the run creates orders only for schedules on tenancies in the runner's portfolios.
  for (const s of await all(c, 'SELECT s.*,t.unit_id AS tenancy_unit FROM tt_schedules s JOIN tt_tenancies t ON t.id=s.tenancy_id ORDER BY s.created_at').then(rows => rows.filter(s => reaches(c, s.tenancy_unit)))) {
   const t = await tenancy(c, s.tenancy_id), horizon = addDays(localDate(c.now, t.time_zone), s.lead_days)
   const listed = await vendor(c, s.vendor_id)
   const asset = s.asset_id ? await one(c, "SELECT * FROM tt_assets WHERE id=? AND state='in_service'", s.asset_id) : null
   for (const due of occurrences(s, horizon)) {
    let o = await one(c, 'SELECT o.*,(SELECT id FROM tt_maintenance_jobs WHERE occurrence_id=o.id) AS job_id FROM tt_schedule_occurrences o WHERE schedule_id=? AND due_date=?', s.id, due)
    if (o?.job_id) { existing++; continue }
    const effective = o?.deferred_to ?? due
    if (effective > horizon) continue
    const occurrenceId = o?.id ?? id()
    const job = jobWrites(c, t, { title: s.title, listed, trade: s.trade, tradeName: listed.name, tradeEmail: listed.email, dueDate: effective, estimateCents: s.budget_cents, asset, occurrenceId })
    writes.push(...(o ? [guard(c, 'EXISTS(SELECT 1 FROM tt_schedule_occurrences WHERE id=? AND deferred_to IS ? AND NOT EXISTS(SELECT 1 FROM tt_maintenance_jobs WHERE occurrence_id=?))', o.id, o.deferred_to, o.id)] : [sql(c, 'INSERT INTO tt_schedule_occurrences(id,schedule_id,due_date,asset_id,created_at) VALUES(?,?,?,?,?)', occurrenceId, s.id, due, s.asset_id, c.now)]), ...job.statements)
    created++
   }
  }
 return { writes, created, existing }
}

/** Each schedule with its occurrences through the horizon: deferral, order and overdue state. */
export async function scheduleData(c: Context, t: Row, today: string) {
 const schedules = await all(c, 'SELECT * FROM tt_schedules WHERE tenancy_id=? ORDER BY title', t.id)
 const [rows, jobs] = await Promise.all([
  all(c, 'SELECT o.* FROM tt_schedule_occurrences o JOIN tt_schedules s ON s.id=o.schedule_id WHERE s.tenancy_id=?', t.id),
  all(c, 'SELECT id,occurrence_id,state,due_date FROM tt_maintenance_jobs WHERE tenancy_id=? AND occurrence_id IS NOT NULL', t.id),
 ])
 return schedules.map(s => {
  const horizon = addDays(today, s.lead_days), dates = new Set([...occurrences(s, horizon), ...rows.filter(o => o.schedule_id === s.id).map(o => o.due_date)])
  const list = [...dates].sort().map(due => {
   const o = rows.find(x => x.schedule_id === s.id && x.due_date === due), job = o ? jobs.find(j => j.occurrence_id === o.id) : undefined, effective = o?.deferred_to ?? due
   return { dueDate: due, effectiveDate: effective, deferredTo: o?.deferred_to ?? null, deferReason: o?.defer_reason ?? null, assetId: o?.asset_id ?? null, jobId: job?.id ?? null, jobState: job?.state ?? null, overdue: effective < today && job?.state !== 'sent' }
  })
  return { ...s, horizon, occurrences: list, overdue: list.filter(x => x.overdue) }
 })
}
