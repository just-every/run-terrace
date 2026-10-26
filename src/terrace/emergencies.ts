// WORK-001 / BOUND-003. Staff record a safety intake; the owner (or a manager over every portfolio) approves the
// guidance for each risk; each portfolio names an on-call person and a backup. An emergency alerts the on-call person
// by the installation's email with a sign-in link only, and stays urgent and open until a named person acknowledges it
// in Terrace. Escalation to the backup is a recorded human action; nothing escalates on a timer. Separate approved
// pages use the PORTAL-005 communication door. Only the owner or a portfolio manager resolves, with field-work evidence and
// the resident's follow-up as staff recorded it. Terrace never diagnoses, classifies or closes a case by inference.
import { all, allow, commit, everywhere, guard, id, insist, one, reaches, reachesPortfolio, sql, tenancy, text, type Context, type Row } from './core'
import { serviceableAsset } from './assets'

export const EMERGENCY_COMMANDS = ['emergency.guidance', 'emergency.oncall', 'emergency.report', 'emergency.escalate', 'emergency.acknowledge', 'emergency.resolve']
export const RISKS: [string, string][] = [['gas', 'Gas smell or leak'], ['fire', 'Fire or smoke'], ['electric', 'Electrical hazard'], ['water', 'Flooding or water leak'], ['habitability', 'No heat, water or sanitation'], ['other', 'Other safety concern']]
/** Gas, fire and electrical hazards are always immediate danger: their guidance must say when to call 911 or the utility. */
export const IMMEDIATE = ['gas', 'fire', 'electric']
export const CHANNELS = ['phone', 'email', 'in_person', 'staff_observed']
export const FOLLOWUP_LABEL = 'resident follow-up recorded by staff; Terrace did not contact the resident'
const NO_GUIDANCE = 'No approved guidance for this risk. Terrace gave none; follow your emergency policy and call 911 for immediate danger.'
// An on-call person is an active owner, or staff whose role may acknowledge emergencies in that portfolio.
export const responderScope = "o.status='active' AND (o.role='owner' OR EXISTS(SELECT 1 FROM tt_staff_roles r JOIN tt_role_actions k ON k.role=r.role WHERE r.operator_id=o.id AND k.action='emergency.acknowledge' AND (r.all_portfolios=1 OR EXISTS(SELECT 1 FROM tt_role_portfolios rp WHERE rp.operator_id=o.id AND rp.portfolio_id=?))))"
export const event = (c: Context, caseId: string, kind: string, reference: string, label: string, recipientId: string | null = null, outcome: string | null = null) =>
 sql(c, 'INSERT INTO tt_emergency_events(id,emergency_id,kind,recipient_id,outcome,reference,label,recorded_by,recorded_at) VALUES(?,?,?,?,?,?,?,?,?)', id(), caseId, kind, recipientId, outcome, reference, label, c.actor.id, c.now)

const risk = (v: unknown) => { const r = String(v ?? ''); insist(RISKS.some(x => x[0] === r), 'invalid_input', 'Choose gas, fire, electric, water, habitability or other.'); return r }
const currentGuidance = (c: Context, r: string) => one(c, 'SELECT * FROM tt_emergency_guidance WHERE risk=? ORDER BY version DESC LIMIT 1', r)
const currentOncall = (c: Context, portfolioId: string) => one(c, 'SELECT * FROM tt_oncall WHERE portfolio_id=? ORDER BY set_at DESC,rowid DESC LIMIT 1', portfolioId)
/** Exact instant with a UTC offset (or Z), at or before now: when the resident or observer reported it. */
function reportedAt(c: Context, v: unknown) {
 if (v === undefined || v === '') return c.now
 const s = text(v, 'Reported at', 40)
 insist(/^\d{4}-\d\d-\d\dT\d\d:\d\d(:\d\d(\.\d+)?)?(Z|[+-]\d\d:\d\d)$/.test(s) && Number.isFinite(Date.parse(s)), 'invalid_time', 'Reported at: enter YYYY-MM-DDTHH:mm with a UTC offset, for example 2026-10-20T02:10-07:00.')
 const at = new Date(Date.parse(s)).toISOString()
 insist(at <= c.now, 'invalid_time', 'Reported at cannot be in the future.')
 return at
}
async function emergencyCase(c: Context, v: unknown) {
 const e = await one(c, 'SELECT * FROM tt_emergencies WHERE id=?', text(v, 'Emergency', 100))
 insist(e && reaches(c, e.unit_id), 'not_found', 'Emergency not found.', 404)
 return e
}
const caseGuard = (c: Context, e: Row) => guard(c, 'EXISTS(SELECT 1 FROM tt_emergencies WHERE id=? AND version=? AND state=?)', e.id, e.version, e.state)

export async function emergencyCommand(c: Context, command: string, p: Row): Promise<Row | undefined> {
 if (!EMERGENCY_COMMANDS.includes(command)) return
 allow(c, command)
 if (command === 'emergency.guidance') {
  everywhere(c)
  const r = risk(p.risk), danger = IMMEDIATE.includes(r) || p.immediateDanger === true || p.immediateDanger === '1' || p.immediateDanger === 'on'
  const guidance = text(p.guidance, 'Safe guidance for the resident', 2000), call = danger ? text(p.callInstruction, 'When to call 911 or the utility', 1000) : null
  insist(!call || /\b911\b/.test(call), 'invalid_input', 'Immediate-danger guidance must tell the resident when to call 911 (and the utility, where it applies).')
  const old = await currentGuidance(c, r), version = (old?.version ?? 0) + 1, key = id()
  c.source = p.source ? String(p.source) : `guidance ${r} v${version}`
  await commit(c, [guard(c, 'COALESCE((SELECT MAX(version) FROM tt_emergency_guidance WHERE risk=?),0)=?', r, version - 1),
   sql(c, 'INSERT INTO tt_emergency_guidance(id,risk,version,immediate_danger,guidance,call_instruction,approved_by,approved_role,approved_at) VALUES(?,?,?,?,?,?,?,?,?)', key, r, version, danger ? 1 : 0, guidance, call, c.actor.id, c.actor.staff?.role ?? c.actor.role, c.now)], command, key)
  return { id: key, risk: r, version, tab: 'emergencies', notice: `Guidance for ${r} approved as version ${version}. Cases already recorded keep the version they were given.` }
 }
 if (command === 'emergency.oncall') {
  const portfolio = await one(c, 'SELECT id,name FROM tt_portfolios WHERE id=?', text(p.portfolioId, 'Portfolio', 100))
  insist(portfolio && reachesPortfolio(c, portfolio.id), 'not_found', 'Portfolio not found.', 404)
  const primary = text(p.primaryId, 'On-call person', 100), backup = text(p.backupId, 'Backup', 100)
  insist(primary !== backup, 'invalid_input', 'Choose a backup who is not the on-call person.')
  const eligible = `EXISTS(SELECT 1 FROM oa_operators o WHERE o.id=? AND ${responderScope})`
  for (const who of [primary, backup]) insist((await one(c, `SELECT ${eligible} AS ok`, who, portfolio.id))?.ok, 'responder_unavailable', 'Choose active people whose role may acknowledge emergencies in this portfolio.', 409)
  const key = id()
  await commit(c, [guard(c, eligible, primary, portfolio.id), guard(c, eligible, backup, portfolio.id),
   sql(c, 'INSERT INTO tt_oncall(id,portfolio_id,primary_id,backup_id,set_by,set_at) VALUES(?,?,?,?,?,?)', key, portfolio.id, primary, backup, c.actor.id, c.now)], command, portfolio.id)
  return { id: key, tab: 'emergencies', notice: `On-call for ${portfolio.name} saved. New emergencies alert the on-call person; escalation to the backup is a recorded action.` }
 }
 if (command === 'emergency.report') {
  const prepared = await prepareEmergency(c,p)
  await commit(c,prepared.statements,command,prepared.result.id)
  return prepared.result
 }
 const e = await emergencyCase(c, p.emergencyId)
 const version = Number(p.version)
 insist(Number.isInteger(version) && version === e.version, 'conflict', 'Reload the current case version.', 409)
 insist(e.state !== 'resolved', 'emergency_state', 'This case is resolved.', 409)
 if (command === 'emergency.escalate') {
  insist(e.emergency === 1 && e.oncall_id, 'emergency_state', 'Only an emergency with an on-call assignment escalates.', 409)
  insist(e.state === 'open', 'emergency_state', 'Already acknowledged by a person.', 409)
  const to = p.to === 'primary' ? e.primary_id : e.backup_id, reason = text(p.reason, 'Why you are escalating', 1000)
  c.source = reason
  await commit(c, [caseGuard(c, e), sql(c, 'UPDATE tt_emergencies SET version=version+1 WHERE id=?', e.id), event(c, e.id, 'escalated', reason, 'escalated by staff', to)], command, e.id)
  return { id: e.id, tenancyId: e.tenancy_id, version: version + 1, tab: 'emergencies', alert: { caseId: e.id, recipientId: to, kind: 'alert' }, notice: 'Escalation recorded.' }
 }
 if (command === 'emergency.acknowledge') {
  insist(e.emergency === 1, 'emergency_state', 'Only emergencies are acknowledged.', 409)
  insist(e.state === 'open', 'emergency_state', 'Already acknowledged.', 409)
  insist([e.primary_id, e.backup_id].includes(c.actor.id), 'not_on_call', 'Only the on-call person or backup named on this case acknowledges it.', 403)
  const handoff = text(p.reference, 'What you are doing (call made, responder or vendor dispatched)', 1000)
  c.source = handoff
  await commit(c, [caseGuard(c, e), sql(c, "UPDATE tt_emergencies SET state='acknowledged',acknowledged_by=?,acknowledged_at=?,version=version+1 WHERE id=?", c.actor.id, c.now, e.id), event(c, e.id, 'acknowledged', handoff, 'acknowledged in Terrace by the named person')], command, e.id)
  return { id: e.id, tenancyId: e.tenancy_id, version: version + 1, tab: 'emergencies', notice: 'Acknowledged. The case stays open until a manager records the field work and the resident’s follow-up.' }
 }
 insist(e.emergency === 0 || e.state === 'acknowledged', 'emergency_state', 'A person must acknowledge the emergency before it is resolved.', 409)
 const fieldWork = text(p.fieldWork, 'Field-work evidence (who attended, what was made safe, job or report reference)', 2000), followup = text(p.residentFollowUp, 'Resident follow-up (who spoke to the resident, when, what they said)', 2000)
 c.source = fieldWork
 await commit(c, [caseGuard(c, e), sql(c, "UPDATE tt_emergencies SET state='resolved',acknowledged_at=COALESCE(acknowledged_at,?),resolved_by=?,resolved_at=?,field_work=?,resident_followup=?,version=version+1 WHERE id=?", c.now, c.actor.id, c.now, fieldWork, followup, e.id), event(c, e.id, 'resolved', fieldWork, FOLLOWUP_LABEL)], command, e.id)
 return { id: e.id, tenancyId: e.tenancy_id, version: version + 1, tab: 'emergencies', notice: 'Resolved with field-work evidence and the resident’s follow-up.' }
}

/** Shared intake preparation; caller commits its own live authority fence with these statements. */
export async function prepareEmergency(c: Context,p: Row,residentSubmission = false) {
  const t = await tenancy(c, p.tenancyId)
  insist(t.unit_id, 'unit_required', 'Link this tenancy to a unit first: the unit’s portfolio decides who is on call.', 409)
  const place = await one(c, 'SELECT p.portfolio_id FROM tt_units u JOIN tt_properties p ON p.id=u.property_id WHERE u.id=?', t.unit_id)
  const r = risk(p.risk), channel = String(p.channel ?? '')
  insist(CHANNELS.includes(channel), 'invalid_input', 'Record how it arrived: phone, email, in person or observed by staff.')
  insist(['yes', 'no'].includes(String(p.emergency)), 'invalid_input', 'Classify it: emergency yes or no. Terrace never classifies it for you.')
  const g = await currentGuidance(c, r), emergency = p.emergency === 'yes'
  insist(emergency || !(IMMEDIATE.includes(r) || g?.immediate_danger), 'emergency_policy', 'Your emergency policy treats this risk as immediate danger: record it as an emergency.', 409)
  const asset = await serviceableAsset(c, t.id, p.assetId), oncall = emergency ? await currentOncall(c, place!.portfolio_id) : null
  const given = g ? [g.call_instruction, g.guidance].filter(Boolean).join('\n') : NO_GUIDANCE, key = id(), at = reportedAt(c, p.reportedAt)
  c.source = text(p.reporter, 'Reported by (name and contact)', 300)
  const statements = [
   ...(g ? [guard(c, '(SELECT MAX(version) FROM tt_emergency_guidance WHERE risk=?)=?', r, g.version)] : [guard(c, 'NOT EXISTS(SELECT 1 FROM tt_emergency_guidance WHERE risk=?)', r)]),
   ...(oncall ? [guard(c, '(SELECT id FROM tt_oncall WHERE portfolio_id=? ORDER BY set_at DESC,rowid DESC LIMIT 1)=?', place!.portfolio_id, oncall.id)] : []),
   sql(c, 'INSERT INTO tt_emergencies(id,tenancy_id,unit_id,portfolio_id,asset_id,channel,reporter,description,risk,emergency,reported_at,guidance_id,guidance_given,oncall_id,primary_id,backup_id,recorded_by,recorded_at,intake_origin) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)', key, t.id, t.unit_id, place!.portfolio_id, asset?.id ?? null, channel, c.source, text(p.description, 'What was reported', 2000), r, emergency ? 1 : 0, at, g?.id ?? null, given, oncall?.id ?? null, oncall?.primary_id ?? null, oncall?.backup_id ?? null, c.actor.id, c.now, residentSubmission ? 'resident_portal' : 'staff'),
   event(c, key, 'reported', g ? `guidance ${r} v${g.version} given` : 'no approved guidance', residentSubmission ? 'resident safety report; treated as emergency under approved policy' : emergency ? 'classified emergency by staff' : 'classified not an emergency by staff'),
  ]
  const alert = oncall ? { caseId: key, recipientId: oncall.primary_id, kind: 'alert' } : null
  return { statements, result: { id: key, tenancyId: t.id, tab: 'emergencies', guidance: given, guidanceVersion: g?.version ?? null, alert, notice: emergency ? (oncall ? 'Emergency recorded. Read the guidance to the caller now.' : 'Emergency recorded with no on-call person for this portfolio: no alert was sent. Call your on-call service now.') : 'Recorded as not an emergency. Read the guidance to the caller and route the repair to maintenance.' } }
}

export async function emergencyData(c: Context) {
 allow(c, 'emergency.read')
 const [cases, events, guidance, oncall, portfolios, tenancies] = await Promise.all([
  all(c, "SELECT e.*,t.address,t.time_zone FROM tt_emergencies e JOIN tt_tenancies t ON t.id=e.tenancy_id ORDER BY CASE e.state WHEN 'open' THEN 0 WHEN 'acknowledged' THEN 1 ELSE 2 END,e.emergency DESC,e.reported_at"),
  all(c, 'SELECT * FROM tt_emergency_events ORDER BY recorded_at,rowid'),
  all(c, 'SELECT g.* FROM tt_emergency_guidance g WHERE g.version=(SELECT MAX(version) FROM tt_emergency_guidance x WHERE x.risk=g.risk) ORDER BY g.risk'),
  all(c, 'SELECT o.* FROM tt_oncall o WHERE o.rowid=(SELECT x.rowid FROM tt_oncall x WHERE x.portfolio_id=o.portfolio_id ORDER BY x.set_at DESC,x.rowid DESC LIMIT 1)'),
  all(c, 'SELECT id,name FROM tt_portfolios ORDER BY name'),
  all(c, 'SELECT id,address,unit_id FROM tt_tenancies WHERE erased_at IS NULL AND unit_id IS NOT NULL ORDER BY address'),
 ])
 const mine = cases.filter(e => reaches(c, e.unit_id)), ids = new Set(mine.map(e => e.id)), visible = portfolios.filter(f => reachesPortfolio(c, f.id))
 const responders = Object.fromEntries(await Promise.all(visible.map(async f => [f.id, await all(c, `SELECT o.id,o.display_name FROM oa_operators o WHERE ${responderScope} ORDER BY o.display_name`, f.id)])))
 return { now: c.now, cases: mine, events: events.filter(x => ids.has(x.emergency_id)), guidance, oncall: oncall.filter(o => reachesPortfolio(c, o.portfolio_id)), portfolios: visible, responders, tenancies: tenancies.filter(t => reaches(c, t.unit_id)) }
}

/** REPORT-004: emergencies count as open, with their age in hours from the report, until a person resolves them. */
export async function openEmergencies(c: Context) {
 const rows = (await all(c, "SELECT e.id,e.unit_id,e.risk,e.state,e.reported_at,e.acknowledged_at,t.address,u.property_id FROM tt_emergencies e JOIN tt_tenancies t ON t.id=e.tenancy_id JOIN tt_units u ON u.id=e.unit_id WHERE e.emergency=1 AND e.state<>'resolved' ORDER BY e.reported_at")).filter(e => reaches(c, e.unit_id))
 return rows.map(e => ({ id: e.id, address: e.address, propertyId: e.property_id, risk: e.risk, state: e.state, reportedAt: e.reported_at, acknowledgedAt: e.acknowledged_at ?? null, ageHours: Math.round((Date.parse(c.now) - Date.parse(e.reported_at)) / 360000) / 10 }))
}
