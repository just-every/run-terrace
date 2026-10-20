// WORK-006: the approval is the send authority. Replies are evidence entered by staff, never portal replies.
import { all, allow, commit, guard, id, insist, one, sql, tenancy, text, type Context, type Row } from './core'
import { hold, vendorGuard } from './vendors'
import { localDate } from './zones'
export const DISPATCH_COMMANDS = ['maintenance.dispatch', 'maintenance.progress', 'maintenance.escalate']
export function checklist(value: unknown): string[] {
 const tasks = text(value, 'Task checklist', 4000).split(/\r?\n/).map(s => s.trim()).filter(Boolean)
 insist(tasks.length <= 20 && tasks.every(t => t.length <= 200) && new Set(tasks).size === tasks.length, 'invalid_checklist', 'Use up to 20 distinct tasks, at most 200 characters each.')
 return tasks
}
const transitions: Record<string, string[]> = { dispatched: ['accepted', 'blocked'], accepted: ['en_route', 'started', 'blocked', 'parts_needed'], en_route: ['started', 'blocked', 'parts_needed'], started: ['blocked', 'parts_needed', 'completed'], blocked: ['accepted', 'en_route', 'started', 'parts_needed'], parts_needed: ['en_route', 'started', 'blocked'], completed: [] }
export const dispatchEvent = (c: Context, dispatchId: string, kind: string, reference: string, tasks: string[] = []) => sql(c, 'INSERT INTO tt_dispatch_events(id,dispatch_id,sequence,kind,reference,checklist,recorded_by,recorded_at) VALUES(?,?,(SELECT COALESCE(MAX(sequence),0)+1 FROM tt_dispatch_events WHERE dispatch_id=?),?,?,?,?,?)', id(), dispatchId, dispatchId, kind, reference, JSON.stringify(tasks), c.actor.id, c.now)
export function missed(c: Context, t: Row, j: Row, appointment?: Row | null) {
 if (['resolved', 'closed'].includes(j.resolution)) return null
 if (appointment && ['proposed','confirmed','no_show'].includes(appointment.state) && appointment.ends_at < c.now) return 'Missed arrival window: a person must contact the technician and resident, then record the next action.'
 if (j.due_date < localDate(c.now, t.time_zone)) return 'Work is past its due date: a person must check progress and arrange the next service commitment.'
 return null
}
export async function dispatchCommand(c: Context, command: string, p: Row): Promise<Row | undefined> {
 if (!DISPATCH_COMMANDS.includes(command)) return
 allow(c, command)
 const j = await one(c, 'SELECT * FROM tt_maintenance_jobs WHERE id=?', text(p.jobId, 'Maintenance job', 100))
 insist(j, 'not_found', 'Maintenance job not found.', 404)
 const t = await tenancy(c, j.tenancy_id)
 if (p.tenancyId !== undefined) insist(p.tenancyId === t.id, 'not_found', 'Maintenance job not found.', 404)
 const approval = await one(c, 'SELECT * FROM tt_maintenance_approvals WHERE job_id=? ORDER BY job_version DESC LIMIT 1', j.id)
 insist(approval && ['approved','sent'].includes(j.state), 'not_approved', 'Approve the current work before dispatch or progress recording.', 409)
 const current = await one(c, 'SELECT * FROM tt_dispatches WHERE approval_id=?', approval.id)
 const appointment = await one(c, "SELECT * FROM tt_appointments WHERE job_id=? AND approval_id=? ORDER BY recorded_at DESC,rowid DESC LIMIT 1", j.id, approval.id)
 const liveGuard = guard(c, 'EXISTS(SELECT 1 FROM tt_maintenance_jobs WHERE id=? AND version=? AND state=?)', j.id, j.version, j.state)
 if (command === 'maintenance.dispatch') {
  if (current) return { tenancyId: t.id, id: current.id, outcome: current.outcome, notice: current.label + ' Dispatch was already attempted; reconcile its outcome before arranging another handoff. No duplicate email sent.' }
  insist(j.state === 'approved', 'already_sent', 'An external handoff already exists. Do not send it a second time.', 409)
  insist(Number(p.version) === j.version, 'conflict', 'Reload the current job version before sending.', 409)
  const h = await hold(c, j, t)
  insist(!h.held, 'qualification_hold', 'Vendor qualification changed; resolve the hold before dispatch.', 409)
  const a = JSON.parse(approval.snapshot)
  // No resident contact or access secrets are added to the approved packet. Its permitted contact is its staff approver.
  const snapshot = { ...a, currency: t.currency_confirmed === 0 ? 'unconfirmed' : a.currency, checklist: a.checklist ?? [a.title], appointment: appointment && ['proposed','confirmed'].includes(appointment.state) ? { id: appointment.id, version: appointment.version, starts: appointment.starts_at, ends: appointment.ends_at, zone: appointment.time_zone, state: appointment.state } : null }
  const key = id()
  await commit(c, [liveGuard, vendorGuard(c, j, h.vendorVersion),
   guard(c, 'NOT EXISTS(SELECT 1 FROM tt_dispatches WHERE approval_id=?)', approval.id),
   ...(appointment ? [guard(c, 'EXISTS(SELECT 1 FROM tt_appointments WHERE id=? AND version=?)', appointment.id, appointment.version)] : []),
   sql(c, 'INSERT INTO tt_dispatches(id,job_id,approval_id,appointment_id,snapshot,outcome,label,recorded_by,recorded_at) VALUES(?,?,?,?,?,?,?,?,?)', key, j.id, approval.id, appointment?.id ?? null, JSON.stringify(snapshot), 'sending', 'Dispatch claimed; provider outcome not yet known. Reconcile before resending.', c.actor.id, c.now),
   dispatchEvent(c, key, 'dispatch_requested', 'Human requested dispatch of the approved work'),
  ], command, j.id)
  return { id: key, tenancyId: t.id, dispatchEmail: { id: key, jobId: j.id, jobVersion: j.version, approvalId: approval.id, snapshot }, notice: 'Dispatch requested.' }
 }
 insist(current?.outcome === 'accepted' && j.state === 'sent', 'not_dispatched', 'Progress requires the current dispatch to have been accepted by the mail provider.', 409)
 const events = await all(c, 'SELECT * FROM tt_dispatch_events WHERE dispatch_id=? ORDER BY sequence', current.id)
 const reference = text(p.reference, 'Technician reply or human escalation source', 1000)
 const guards = [liveGuard, guard(c, '(SELECT COUNT(*) FROM tt_dispatch_events WHERE dispatch_id=?)=?', current.id, events.length)]
 if (command === 'maintenance.escalate') {
  insist(missed(c, t, j, appointment), 'not_overdue', 'No missed due date or arrival window needs escalation.', 409)
  await commit(c, [...guards, dispatchEvent(c, current.id, 'escalated', reference)], command, j.id)
  return { tenancyId: t.id, notice: 'Human escalation recorded. The resident issue remains open until its separate resolution check.' }
 }
 insist(!j.resolution || j.resolution === 'reopened', 'job_state', 'Record progress only for open work.', 409)
 const progress = events.filter(e => Object.hasOwn(transitions, e.kind)), before = progress.at(-1)?.kind ?? 'dispatched', next = String(p.state)
 insist(transitions[before]?.includes(next), 'progress_transition', `Cannot record ${next} after ${before}.`, 409)
 const tasks = p.completedTasks ? checklist(p.completedTasks) : [], expected: string[] = JSON.parse(current.snapshot).checklist
 insist(tasks.every(task => expected.includes(task)), 'invalid_checklist', 'Only tasks in the approved checklist can be checked.')
 if (next === 'completed') insist(tasks.length === expected.length, 'checklist_incomplete', 'Record every approved task as completed before reporting technician completion.', 409)
 await commit(c, [...guards, dispatchEvent(c, current.id, next, reference, tasks)], command, j.id)
 return { tenancyId: t.id, notice: `Technician ${next.replaceAll('_',' ')} recorded by staff from the cited source. This does not resolve the resident issue.` }
}
export async function dispatchData(c: Context, t: Row) {
 const [dispatches, dispatchEvents] = await Promise.all([
  all(c, 'SELECT d.* FROM tt_dispatches d JOIN tt_maintenance_jobs j ON j.id=d.job_id WHERE j.tenancy_id=? ORDER BY d.recorded_at,d.id', t.id),
  all(c, 'SELECT e.* FROM tt_dispatch_events e JOIN tt_dispatches d ON d.id=e.dispatch_id JOIN tt_maintenance_jobs j ON j.id=d.job_id WHERE j.tenancy_id=? ORDER BY d.recorded_at,d.id,e.sequence', t.id),
 ])
 return { dispatches, dispatchEvents }
}
