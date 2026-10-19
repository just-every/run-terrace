// WORK-008: after handoff, staff record the vendor's completion report and then the resident's answer to
// whether the original issue is resolved. Terrace has no vendor portal (PORTAL-003) and does not contact
// residents (PORTAL-005), so every row says it was recorded by staff. An unresolved or recurring issue
// reopens the work for a return visit (a callback to the vendor); only an owner or admin closes work without
// the resident's confirmation, with a reason.
import { all, commit, date, guard, id, insist, manager, one, sql, text, type Context, type Row } from './core'

export const CONFIRMED_LABEL = 'confirmed by staff, resident not contacted by Terrace'
const LABELS: Record<string, string> = {
 confirmed: CONFIRMED_LABEL,
 unresolved: 'not resolved, recorded by staff, resident not contacted by Terrace',
 no_response: 'no response, recorded by staff, resident not contacted by Terrace',
}
const staff = (c: Context) => insist(['owner', 'admin', 'member'].includes(c.actor.role), 'forbidden', 'You cannot record completion checks.', 403)
const sentJob = async (c: Context, v: unknown) => {
 const j = await one(c, 'SELECT * FROM tt_maintenance_jobs WHERE id=?', text(v, 'Maintenance job', 100))
 insist(j, 'not_found', 'Maintenance job not found.', 404)
 insist(j.state === 'sent', 'job_state', 'Completion is recorded after the external handoff.', 409)
 return j
}
const resolutionIs = (c: Context, j: Row) => guard(c, 'EXISTS(SELECT 1 FROM tt_maintenance_jobs WHERE id=? AND resolution IS ?)', j.id, j.resolution ?? null)

export async function completionCommand(c: Context, command: string, p: Row): Promise<Row | undefined> {
 if (command === 'completion.record') {
  staff(c)
  const j = await sentJob(c, p.jobId)
  insist(j.resolution === null || j.resolution === 'reopened', 'job_state', 'This report is waiting on the resident’s check, or the work is resolved or closed.', 409)
  const attempt = ((await one<{ n: number }>(c, 'SELECT COUNT(*) AS n FROM tt_completion_attempts WHERE job_id=?', j.id))!.n) + 1
  const callback = attempt > 1 ? String(p.callback ?? '') : null
  insist(callback === null || ['warranty', 'billable'].includes(callback), 'invalid_input', 'A return visit is a warranty callback (no charge) or billable.')
  const key = id()
  await commit(c, [
   resolutionIs(c, j),
   sql(c, 'INSERT INTO tt_completion_attempts(id,job_id,attempt,completed_date,summary,reference,callback,recorded_by,recorded_at) VALUES(?,?,?,?,?,?,?,?,?)', key, j.id, attempt, date(p.completedDate, 'Completed date'), text(p.summary, 'Vendor’s completion report', 2000), text(p.reference, 'Where the vendor’s evidence is', 500), callback, c.actor.id, c.now),
   sql(c, "UPDATE tt_maintenance_jobs SET resolution='awaiting_check' WHERE id=?", j.id),
  ], command, j.id)
  return { id: key, tenancyId: j.tenancy_id, attempt, notice: `Vendor’s completion report ${attempt > 1 ? `for return visit ${attempt - 1} ` : ''}recorded. Ask the resident whether the original issue is resolved: Terrace has not contacted them.` }
 }
 if (command === 'completion.check') {
  staff(c)
  const j = await sentJob(c, p.jobId), outcome = String(p.outcome ?? '')
  insist(outcome in LABELS, 'invalid_input', 'The resident’s answer is confirmed, unresolved or no_response.')
  const last = await one(c, 'SELECT * FROM tt_completion_attempts WHERE job_id=? ORDER BY attempt DESC LIMIT 1', j.id)
  insist(last, 'job_state', 'Record the vendor’s completion report first.', 409)
  // Awaiting a check: any answer. Resolved or closed: only a report that the issue recurred reopens it.
  insist(j.resolution === 'awaiting_check' || (outcome === 'unresolved' && ['resolved', 'closed'].includes(j.resolution)), 'job_state', j.resolution === 'reopened' ? 'The work is reopened: record the return visit first.' : 'The work is resolved or closed; record only a recurring issue.', 409)
  const note = outcome === 'unresolved' ? text(p.note, 'What is still wrong', 2000) : String(p.note ?? '').trim().slice(0, 2000)
  const satisfaction = outcome === 'confirmed' && p.satisfaction ? Number(p.satisfaction) : null
  insist(satisfaction === null || (Number.isInteger(satisfaction) && satisfaction >= 1 && satisfaction <= 5), 'invalid_input', 'Satisfaction is 1 to 5.')
  const safety = p.safetyConcern ? text(p.safetyConcern, 'Safety concern', 1000) : null
  const next = outcome === 'confirmed' ? 'resolved' : outcome === 'unresolved' ? 'reopened' : 'awaiting_check', key = id()
  await commit(c, [
   resolutionIs(c, j),
   sql(c, 'INSERT INTO tt_resident_checks(id,job_id,attempt_id,outcome,note,satisfaction,safety_concern,label,recorded_by,recorded_at) VALUES(?,?,?,?,?,?,?,?,?,?)', key, j.id, last.id, outcome, note, satisfaction, safety, LABELS[outcome], c.actor.id, c.now),
   sql(c, 'UPDATE tt_maintenance_jobs SET resolution=? WHERE id=?', next, j.id),
  ], command, j.id)
  const notice = outcome === 'confirmed' ? `Resolved: ${CONFIRMED_LABEL}.` : outcome === 'unresolved' ? 'Reopened: the issue is not resolved. Arrange a return visit with the vendor and record it.' : 'No response recorded. The work stays open until the resident confirms or an owner or administrator closes it with a reason.'
  return { id: key, tenancyId: j.tenancy_id, resolution: next, notice }
 }
 if (command === 'completion.close') {
  manager(c)
  const j = await sentJob(c, p.jobId)
  insist(j.resolution === 'awaiting_check' || j.resolution === 'reopened', 'job_state', 'Only open completed work can be closed without the resident’s confirmation.', 409)
  await commit(c, [
   resolutionIs(c, j),
   sql(c, 'INSERT INTO tt_job_closures(id,job_id,reason,closed_by,closed_role,closed_at) VALUES(?,?,?,?,?,?)', id(), j.id, text(p.reason, 'Reason for closing without the resident’s confirmation', 1000), c.actor.id, c.actor.role, c.now),
   sql(c, "UPDATE tt_maintenance_jobs SET resolution='closed' WHERE id=?", j.id),
  ], command, j.id)
  return { tenancyId: j.tenancy_id, notice: 'Closed without the resident’s confirmation. The reason is kept with the work.' }
 }
}

/** Each job's reports, resident checks, closures, callbacks and unresolved safety concerns. */
export async function completionData(c: Context, tenancyId: string) {
 const [attempts, checks, closures] = await Promise.all([
  all(c, 'SELECT a.* FROM tt_completion_attempts a JOIN tt_maintenance_jobs j ON j.id=a.job_id WHERE j.tenancy_id=? ORDER BY a.attempt', tenancyId),
  all(c, 'SELECT r.* FROM tt_resident_checks r JOIN tt_maintenance_jobs j ON j.id=r.job_id WHERE j.tenancy_id=? ORDER BY r.recorded_at', tenancyId),
  all(c, 'SELECT x.* FROM tt_job_closures x JOIN tt_maintenance_jobs j ON j.id=x.job_id WHERE j.tenancy_id=? ORDER BY x.closed_at', tenancyId),
 ])
 // A safety concern stays unresolved until a later report on the same job is confirmed by the resident.
 const concerns = checks.filter(r => r.safety_concern).map(r => {
  const at = attempts.find(a => a.id === r.attempt_id)!.attempt
  const cleared = checks.some(x => x.job_id === r.job_id && x.outcome === 'confirmed' && attempts.find(a => a.id === x.attempt_id)!.attempt >= at && x.recorded_at >= r.recorded_at && x.id !== r.id)
  return { jobId: r.job_id, concern: r.safety_concern, recordedAt: r.recorded_at, unresolved: !cleared }
 })
 return { attempts, checks, closures, concerns, callbacks: attempts.filter(a => a.callback).map(a => ({ jobId: a.job_id, attempt: a.attempt, kind: a.callback })) }
}
