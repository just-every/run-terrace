// WORK-005: staff record external arrangements and replies, including historical external backfill.
// Record timestamps stay at the actual Terrace entry time. PORTAL-003/005 remain delivery/portal gaps.
import { all, allow, commit, guard, id, insist, one, reaches, sql, tenancy, text, type Context, type Row } from './core'
import { anyZone, localDate } from './zones'
import { hold, vendor, vendorGuard, issues, assignment } from './vendors'
import { endSessions } from './portal-session'
import { CONFIRMED_LABEL } from './completions'

export const APPOINTMENT_COMMANDS = ['appointment.book', 'appointment.confirm', 'appointment.cancel', 'appointment.no-show', 'appointment.reassign']
const ACTIVE = ['proposed', 'confirmed']
const RECORDED = 'recorded by staff, resident and vendor not contacted by Terrace'
// Match an explicit offset to the property's IANA zone. Both fall-back occurrences are selectable; a skipped
// spring-forward local time or an incorrect seasonal offset is refused rather than silently normalised.
export function instant(v: unknown, label: string, zone: string) {
 const s = text(v, label, 32)
 insist(/^\d{4}-\d\d-\d\dT\d\d:\d\d[+-]\d\d:\d\d$/.test(s) && Number.isFinite(Date.parse(s)), 'invalid_time', `${label}: enter YYYY-MM-DDTHH:mm±HH:mm, with the property's UTC offset.`)
 const ms = Date.parse(s), parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: zone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).formatToParts(ms).map(p => [p.type, p.value]))
 insist(`${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}` === s.slice(0, 16), 'invalid_time', `${label} does not exist with that UTC offset in ${zone}.`)
 return new Date(ms).toISOString()
}
const event = (c: Context, key: string, kind: string, reference: string, party: string | null = null, outcome: string | null = null, label = RECORDED) => sql(c, 'INSERT INTO tt_appointment_events(id,appointment_id,kind,party,outcome,reference,label,recorded_by,recorded_at) VALUES(?,?,?,?,?,?,?,?,?)', id(), key, kind, party, outcome, reference, label, c.actor.id, c.now)
async function job(c: Context, key: unknown) {
 const j = await one(c, 'SELECT * FROM tt_maintenance_jobs WHERE id=?', text(key, 'Maintenance job', 100))
 insist(j, 'not_found', 'Maintenance job not found.', 404)
 const t = await tenancy(c, j.tenancy_id)
 const approval = await one(c, 'SELECT * FROM tt_maintenance_approvals WHERE job_id=? ORDER BY job_version DESC LIMIT 1', j.id)
 return { j, t, approval }
}
const current = (j: Row, a: Row, approval: Row | null) => ['approved', 'sent'].includes(j.state) && approval?.id === a.approval_id
const jobGuard = (c: Context, j: Row) => guard(c, 'EXISTS(SELECT 1 FROM tt_maintenance_jobs WHERE id=? AND version=? AND state=?)', j.id, j.version, j.state)
async function qualified(c: Context, j: Row, t: Row, end: string) {
 const h = await hold(c, { ...j, due_date: [j.due_date, localDate(end, t.time_zone)].sort().at(-1) }, t)
 insist(!h.held, 'qualification_hold', `Held: ${h.issues.join('; ')}. A manager records a documented exception before booking.`, 409)
 return h
}
// Appointments that lost approval are history, not calendar reservations.
const live = "a.state IN ('proposed','confirmed') AND j.state IN ('approved','sent') AND a.approval_id=(SELECT id FROM tt_maintenance_approvals WHERE job_id=j.id ORDER BY job_version DESC LIMIT 1)"
const staffScope = "o.status='active' AND (o.role='owner' OR EXISTS(SELECT 1 FROM tt_staff_roles r JOIN tt_role_actions k ON k.role=r.role WHERE r.operator_id=o.id AND k.action='appointment.book' AND (r.all_portfolios=1 OR EXISTS(SELECT 1 FROM tt_role_portfolios rp JOIN tt_properties p ON p.portfolio_id=rp.portfolio_id JOIN tt_units u ON u.property_id=p.id WHERE rp.operator_id=o.id AND u.id=?))))"
export async function appointmentCommand(c: Context, command: string, p: Row): Promise<Row | undefined> {
 if (!APPOINTMENT_COMMANDS.includes(command)) return
 allow(c, command)
 if (command === 'appointment.book') {
  const { j, t, approval } = await job(c, p.jobId)
  if (p.tenancyId !== undefined) insist(p.tenancyId === t.id, 'not_found', 'Maintenance job not found.', 404)
  insist(['approved', 'sent'].includes(j.state) && approval, 'not_approved', 'Approve the current work terms before booking.', 409)
  insist(!['resolved', 'closed', 'awaiting_check'].includes(j.resolution), 'job_state', 'Book open work or a reopened return visit.', 409)
  const zone = anyZone(t.time_zone), start = instant(p.startsAt, 'Arrival window start', zone), end = instant(p.endsAt, 'Arrival window end', zone), accessStart = instant(p.accessStartsAt, 'Permitted access start', zone), accessEnd = instant(p.accessEndsAt, 'Permitted access end', zone)
  insist(accessStart <= start && start < end && end <= accessEnd, 'access_window', 'The arrival window must fit entirely inside the resident’s permitted access window.')
  insist(p.permission === 'granted', 'access_permission', 'Record the resident’s permission before booking.', 409)
  const permission = text(p.permissionReference, 'Resident permission source', 1000), notice = text(p.noticeReference, 'External entry notice or documented notice exception', 1000), noticeAt = instant(p.noticeAt, 'Entry notice recorded service time', zone)
  insist(noticeAt <= c.now && noticeAt < start, 'entry_notice', 'Record actual external notice service before the arrival window. Terrace does not serve or validate legal notice.')
  const keys = text(p.keysAccess, 'Keys and access instructions (or no key required)', 1000), availability = text(p.availabilityReference, 'Vendor availability source', 1000), staffId = text(p.staffId || c.actor.id, 'Staff calendar', 100)
  insist(await one(c, `SELECT o.id FROM oa_operators o WHERE o.id=? AND ${staffScope}`, staffId, t.unit_id ?? null), 'staff_unavailable', 'Choose active staff authorized to schedule this property.', 409)
  const old = await one(c, 'SELECT * FROM tt_appointments WHERE job_id=? ORDER BY recorded_at DESC,rowid DESC LIMIT 1', j.id)
  if (old && ACTIVE.includes(old.state) && current(j, old, approval)) insist(p.previousId === old.id, 'appointment_exists', 'Use the existing appointment or reschedule it by naming previousId.', 409)
  if (p.previousId) insist(old && p.previousId === old.id, 'conflict', 'Reschedule from the latest appointment.', 409)
  const reason = old ? text(p.reason, 'Reason for rescheduling', 1000) : availability, h = await qualified(c, j, t, end), key = id()
  // Check overlapping vendor, staff and unit calendars inside the same atomic batch; no other property's
  // identifiers or access details appear in a collision response.
  const collision = `NOT EXISTS(SELECT 1 FROM tt_appointments a JOIN tt_maintenance_jobs j ON j.id=a.job_id JOIN tt_tenancies t ON t.id=j.tenancy_id WHERE ${live} AND a.job_id<>? AND a.starts_at<? AND a.ends_at>? AND (a.staff_id=? OR a.vendor_email=? OR (? IS NOT NULL AND a.vendor_id=?) OR j.tenancy_id=? OR (? IS NOT NULL AND t.unit_id=?)))`
  const calendarArgs = [j.id, end, start, staffId, j.trade_email, j.vendor_id, j.vendor_id, t.id, t.unit_id ?? null, t.unit_id ?? null]
  insist((await one(c, `SELECT ${collision} AS clear`, ...calendarArgs))?.clear, 'calendar_conflict', 'The arrival window overlaps a staff, vendor or unit reservation. Choose another window.', 409)
  c.source = permission
  await commit(c, [jobGuard(c, j), vendorGuard(c, j, h.vendorVersion), guard(c, `EXISTS(SELECT 1 FROM oa_operators o WHERE o.id=? AND ${staffScope})`, staffId, t.unit_id ?? null),
   guard(c, collision, ...calendarArgs),
   guard(c, '(SELECT COUNT(*) FROM tt_appointments WHERE job_id=?)=?', j.id, (await one<{ n: number }>(c, 'SELECT COUNT(*) AS n FROM tt_appointments WHERE job_id=?', j.id))!.n),
   ...(old ? [guard(c, '(SELECT id FROM tt_appointments WHERE job_id=? ORDER BY recorded_at DESC,rowid DESC LIMIT 1)=?', j.id, old.id), guard(c, 'EXISTS(SELECT 1 FROM tt_appointments WHERE id=? AND version=?)', old.id, old.version)] : []),
   ...(old && ACTIVE.includes(old.state) ? [sql(c, "UPDATE tt_appointments SET state='superseded',version=version+1 WHERE id=?", old.id), event(c, old.id, 'superseded', reason)] : []),
   sql(c, 'INSERT INTO tt_appointments(id,job_id,approval_id,previous_id,vendor_id,vendor_name,vendor_email,staff_id,time_zone,starts_at,ends_at,access_starts_at,access_ends_at,permission_reference,notice_reference,notice_at,keys_access,availability_reference,recorded_by,recorded_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)', key, j.id, approval.id, old?.id ?? null, j.vendor_id, j.trade_name, j.trade_email, staffId, zone, start, end, accessStart, accessEnd, permission, notice, noticeAt, keys, availability, c.actor.id, c.now), event(c, key, old ? 'rescheduled' : 'booked', reason),
  ], command, j.id)
  return { id: key, tenancyId: t.id, version: 1, state: 'proposed', notice: 'Arrival window recorded, awaiting both confirmations. Terrace has not contacted the resident or vendor.' }
 }
 const a = await one(c, 'SELECT * FROM tt_appointments WHERE id=?', text(p.appointmentId, 'Appointment', 100))
 insist(a, 'not_found', 'Appointment not found.', 404)
 const { j, t, approval } = await job(c, a.job_id)
 if (p.tenancyId !== undefined) insist(p.tenancyId === t.id, 'not_found', 'Appointment not found.', 404)
 const version = Number(p.version)
 insist(Number.isInteger(version) && version === a.version, 'conflict', 'Reload the current appointment version.', 409)
 const reference = text(p.reference, 'External reply, cancellation or no-show evidence', 1000)
 c.source = reference
 const guards = [jobGuard(c, j), guard(c, 'EXISTS(SELECT 1 FROM tt_appointments WHERE id=? AND version=?)', a.id, version)]
 if (command === 'appointment.reassign') {
  insist((await one(c, 'SELECT id FROM tt_appointments WHERE job_id=? ORDER BY recorded_at DESC,rowid DESC LIMIT 1', j.id))?.id === a.id, 'conflict', 'Reassign from the latest appointment.', 409)
  insist(['cancelled', 'no_show'].includes(a.state), 'appointment_state', 'Record the cancellation or no-show before reassigning.', 409)
  insist(!j.resolution && !(await one(c, 'SELECT id FROM tt_completion_attempts WHERE job_id=?', j.id)), 'job_state', 'Reassign before any completion report.', 409)
  const v = await vendor(c, p.vendorId), found = issues(v, j, t)
  await commit(c, [...guards, guard(c, '(SELECT id FROM tt_appointments WHERE job_id=? ORDER BY recorded_at DESC,rowid DESC LIMIT 1)=?', j.id, a.id), guard(c, 'EXISTS(SELECT 1 FROM tt_vendors WHERE id=? AND version=?)', v.id, v.version),
   sql(c, "UPDATE tt_maintenance_jobs SET vendor_id=?,trade_name=?,trade_email=?,qualification=?,quote_id=NULL,revised_by=?,state='pending',version=version+1,sent_by=NULL,sent_at=NULL,sent_reference=NULL WHERE id=?", v.id, v.name, v.email, JSON.stringify(found), c.actor.id, j.id),
   sql(c, "UPDATE tt_proposals SET state='pending',approved_by=NULL,approved_at=NULL,tenancy_version=?,payload=json_set(payload,'$.tradeName',?,'$.tradeEmail',?) WHERE id=?", t.version, v.name, v.email, j.proposal_id),
   assignment(c, j.id, v.id, v.name, j.trade, found), event(c, a.id, 'reassigned', reference), ...(j.vendor_id === v.id ? [] : [endSessions(c, 'vendor_id', [j.vendor_id, v.id])]),
  ], command, j.id)
  return { id: j.id, tenancyId: t.id, version: j.version + 1, issues: found, notice: 'Vendor changed: authorization reopened. Approve the new exact terms before booking or handoff; obtain a new owner decision if required.' }
 }
 insist(ACTIVE.includes(a.state), 'appointment_state', 'This appointment ended. Record a new arrival and access window.', 409)
 if (command === 'appointment.confirm') {
  insist(current(j, a, approval), 'not_approved', 'The work terms changed. Reapprove and record a new appointment.', 409)
  const h = await qualified(c, j, t, a.ends_at), party = String(p.party), outcome = String(p.outcome)
  insist(['vendor', 'resident'].includes(party) && ['confirmed', 'no_response'].includes(outcome), 'invalid_input', 'Choose resident or vendor, and confirmed or no_response.')
  insist(!a[`${party}_confirmed_at`], 'appointment_state', 'This party already confirmed. Cancel or reschedule changed arrangements.', 409)
  const both = outcome === 'confirmed' && !!a[party === 'vendor' ? 'resident_confirmed_at' : 'vendor_confirmed_at']
  await commit(c, [...guards, vendorGuard(c, j, h.vendorVersion), event(c, a.id, 'confirmation', reference, party, outcome, outcome === 'confirmed' ? CONFIRMED_LABEL : 'no response, recorded by staff, resident not contacted by Terrace'),
   sql(c, `UPDATE tt_appointments SET ${party}_confirmed_at=?,confirmed_at=?,state=?,version=version+1 WHERE id=?`, outcome === 'confirmed' ? c.now : null, both ? c.now : null, both ? 'confirmed' : 'proposed', a.id),
  ], command, j.id)
  return { id: a.id, tenancyId: t.id, version: version + 1, state: both ? 'confirmed' : 'proposed', notice: both ? `Appointment ${CONFIRMED_LABEL}.` : 'Awaiting both confirmations. Terrace has not contacted either party.' }
 }
 const state = command === 'appointment.cancel' ? 'cancelled' : 'no_show', party = String(p.party)
 insist(['resident', 'vendor', 'staff'].includes(party), 'invalid_input', 'Record whether resident, vendor or staff cancelled or did not attend.')
 if (state === 'no_show') insist(a.starts_at <= c.now, 'appointment_state', 'A future arrival window is not a no-show.', 409)
 await commit(c, [...guards, event(c, a.id, state, reference, party), sql(c, 'UPDATE tt_appointments SET state=?,version=version+1 WHERE id=?', state, a.id)], command, j.id)
 return { id: a.id, tenancyId: t.id, version: version + 1, state, notice: `${state === 'cancelled' ? 'Cancellation' : 'No-show'} recorded. No notification was sent. Record the next appointment with renewed access permission.` }
}

export async function appointmentData(c: Context, t: Row) {
 const [appointments, events, calendar, staff, proposals] = await Promise.all([
  all(c, 'SELECT a.*,j.state AS job_state,(SELECT id FROM tt_maintenance_approvals WHERE job_id=j.id ORDER BY job_version DESC LIMIT 1) AS current_approval FROM tt_appointments a JOIN tt_maintenance_jobs j ON j.id=a.job_id WHERE j.tenancy_id=? ORDER BY a.recorded_at,a.rowid', t.id),
  all(c, 'SELECT e.* FROM tt_appointment_events e JOIN tt_appointments a ON a.id=e.appointment_id JOIN tt_maintenance_jobs j ON j.id=a.job_id WHERE j.tenancy_id=? ORDER BY e.recorded_at,e.rowid', t.id),
  all(c, `SELECT a.id,a.job_id,a.staff_id,a.vendor_name,a.starts_at,a.ends_at,a.time_zone,j.tenancy_id,t.unit_id,t.address FROM tt_appointments a JOIN tt_maintenance_jobs j ON j.id=a.job_id JOIN tt_tenancies t ON t.id=j.tenancy_id WHERE ${live} ORDER BY a.starts_at`),
  all(c, `SELECT o.id,o.display_name FROM oa_operators o WHERE ${staffScope} ORDER BY o.display_name`, t.unit_id ?? null),
  all(c,'SELECT p.* FROM tt_vendor_appointment_proposals p JOIN tt_maintenance_jobs j ON j.id=p.job_id WHERE j.tenancy_id=? ORDER BY p.proposed_at,p.id',t.id),
 ])
 return { appointmentProposals:proposals, appointmentNow: c.now, appointments: appointments.map(a => ({ ...a, current: current({ state: a.job_state }, a, { id: a.current_approval }) })), appointmentEvents: events, appointmentCalendar: calendar.filter(a => reaches(c, a.unit_id)), appointmentStaff: staff }
}

/** A signed resident reply confirms only the already permitted current window. */
export async function arrivalReplyStatements(c:Context,appointmentId:string,snapshot:Row,reference:string,label:string){
 const a=await one(c,'SELECT * FROM tt_appointments WHERE id=?',appointmentId)
 insist(a&&ACTIVE.includes(a.state)&&a.ends_at>c.now,'appointment_state','The arrival window ended or changed.',409)
 const {j,t,approval}=await job(c,a.job_id)
 insist(current(j,a,approval)&&a.approval_id===snapshot.approvalId&&j.version===snapshot.jobVersion,'not_approved','The work terms changed.',409)
 insist(!a.resident_confirmed_at,'appointment_state','Resident confirmation is already recorded.',409)
 const h=await qualified(c,j,t,a.ends_at),both=!!a.vendor_confirmed_at
 return[jobGuard(c,j),vendorGuard(c,j,h.vendorVersion),guard(c,'EXISTS(SELECT 1 FROM tt_appointments WHERE id=? AND version=?)',a.id,a.version),
  event(c,a.id,'confirmation',reference,'resident','confirmed',label),sql(c,"UPDATE tt_appointments SET resident_confirmed_at=?,confirmed_at=?,state=?,version=version+1 WHERE id=?",c.now,both?c.now:null,both?'confirmed':'proposed',a.id)]
}
