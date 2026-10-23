import { all, allow, audit, commit, guard, id, insist, one, sha256, sql, tenancy, text, type Context, type Row } from './core'
import { scan } from './document-scan'
import { hash, type Portal } from './portal-session'

/** Reports bind to the verified mailbox hash and a live tenancy grant, so a fresh staff invitation after restore restores reads without carrying credentials. */
/** Resident writes always fence the live session and exact resident grant in the same transaction. */
const live = (c: Context, p: Portal, tenancyId: string) => guard(c, "EXISTS(SELECT 1 FROM tt_portal_sessions s JOIN tt_portal_identities i ON i.id=s.identity_id JOIN tt_portal_grants g ON g.identity_id=i.id JOIN tt_tenancies t ON t.id=g.tenancy_id WHERE s.hash=? AND s.revoked_at IS NULL AND s.expires_at>? AND i.status='active' AND g.access='resident' AND g.revoked_at IS NULL AND g.tenancy_id=? AND t.erased_at IS NULL)", p.sessionHash, c.now, tenancyId)
async function resident(c: Context, p: Portal, tenancyId: unknown) {
 const g = p.grants.find(g => g.access === 'resident' && g.tenancy_id === tenancyId)
 insist(g, 'not_found', 'Request not found.', 404)
 return tenancy(c, g.tenancy_id)
}
async function own(c: Context, p: Portal, requestId: unknown) {
 const r = await one(c, 'SELECT * FROM tt_resident_requests WHERE id=? AND submitted_by=?', String(requestId ?? ''), await hash(p.identity.email))
 insist(r, 'not_found', 'Request not found.', 404); await resident(c, p, r.tenancy_id); return r
}
const pick = (v: unknown, values: string[], label: string) => { const s = String(v ?? ''); insist(values.includes(s), 'invalid_input', 'Choose ' + label + '.'); return s }
export async function submitRequest(c: Context, p: Portal, f: FormData) {
 const t = await resident(c, p, f.get('tenancyId')), key = text(f.get('requestKey'), 'Submission identifier', 100)
 insist(/^[a-f0-9-]{36}$/.test(key), 'invalid_input', 'Reload the request form.')
 const prior = await one(c, 'SELECT * FROM tt_resident_requests WHERE id=?', key)
 if (prior) { insist(prior.submitted_by === await hash(p.identity.email) && prior.tenancy_id === t.id, 'not_found', 'Request not found.', 404); return key }
 const category = pick(f.get('category'), ['plumbing','electrical','heating','appliance','other'], 'a category'), urgency = pick(f.get('urgency'), ['routine','urgent'], 'routine or urgent'), access = pick(f.get('accessConsent'), ['ask','no','yes'], 'access consent')
 const description = text(f.get('description'), 'Describe the issue', 2000), notes = text(f.get('accessNotes'), 'Access restrictions', 1000), pets = text(f.get('pets'), 'Pets', 500), times = text(f.get('preferredTimes'), 'Preferred times', 500)
 const file = f.get('photo'), files: D1PreparedStatement[] = []
 if (file instanceof File && file.size) {
  insist(['image/png','image/jpeg'].includes(file.type), 'invalid_file', 'Upload a JPEG or PNG photo up to 5 MB.')
  insist(file.size <= 5 * 1024 * 1024, 'invalid_file', 'Each photo must be at most 5 MB.')
  const bytes = new Uint8Array(await file.arrayBuffer()), checked = await scan(bytes, file.type)
  insist(checked.ok, 'invalid_file', checked.ok ? '' : checked.reason)
  files.push(sql(c, 'INSERT INTO tt_request_photos(id,request_id,name,media_type,bytes,sha256) VALUES(?,?,?,?,?,?)', id(), key, text(file.name, 'File name', 200), file.type, bytes, await sha256(bytes)))
 }
 await c.db.batch([live(c,p,t.id), sql(c, 'INSERT INTO tt_resident_requests(id,tenancy_id,submitted_by,submitted_name,submitted_at,description,category,urgency,access_consent,access_notes,pets,preferred_times) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)', key,t.id,await hash(p.identity.email),p.identity.display_name,c.now,description,category,urgency,access,notes,pets,times), ...files, audit(c,'portal.request.submit',key)])
 return key
}
export async function requestData(c: Context, p: Portal, requestId: unknown) {
 const r = await own(c,p,requestId), job = r.job_id ? await one(c, 'SELECT id,title,state,resolution FROM tt_maintenance_jobs WHERE id=? AND tenancy_id=?', r.job_id,r.tenancy_id) : null
 const appointment = job ? await one(c, "SELECT starts_at,ends_at,time_zone,state FROM tt_appointments WHERE job_id=? AND state IN ('proposed','confirmed') ORDER BY recorded_at DESC LIMIT 1",job.id) : null
 const attempt = job ? await one(c, 'SELECT id,attempt,summary FROM tt_completion_attempts WHERE job_id=? ORDER BY attempt DESC LIMIT 1',job.id) : null
 const answer = attempt ? await one(c, 'SELECT outcome,note,answered_at FROM tt_request_answers WHERE request_id=? AND attempt_id=?',r.id,attempt.id) : null
 const status = answer?.outcome === 'confirmed' ? 'Resident confirmed resolved' : answer?.outcome === 'unresolved' ? 'Resident reports unresolved' : attempt ? 'Awaiting your confirmation' : appointment ? 'Appointment recorded' : job ? 'Work linked' : 'Received; awaiting staff review'
 const photos = await all(c, 'SELECT id,name,media_type,sha256 FROM tt_request_photos WHERE request_id=?',r.id)
 await audit(c,'portal.request.read',r.id).run()
 return {request:r,job,appointment,attempt,answer,status,photos}
}
export async function answerRequest(c: Context,p: Portal,f: FormData) {
 const r = await own(c,p,f.get('requestId')), d = await requestData(c,p,r.id)
 insist(d.attempt && d.job?.state === 'sent', 'request_state','No completion report is ready for confirmation.',409)
 insist(String(f.get('attemptId')) === d.attempt.id && !d.answer, 'conflict','This completion report changed or was already answered.',409)
 const outcome = pick(f.get('outcome'),['confirmed','unresolved'],'resolved or unresolved'), note = text(f.get('note'),'Your answer',1000)
 // This resident answers their own concern only. Staff review the job as a whole; no other report is closed.
 await c.db.batch([live(c,p,r.tenancy_id), guard(c,'(SELECT id FROM tt_completion_attempts WHERE job_id=? ORDER BY attempt DESC LIMIT 1)=?',r.job_id,d.attempt.id), sql(c,'INSERT INTO tt_request_answers(id,request_id,attempt_id,outcome,note,answered_by,answered_at) VALUES(?,?,?,?,?,?,?)',id(),r.id,d.attempt.id,outcome,note,p.identity.id,c.now), audit(c,'portal.request.answer',r.id,outcome)])
 return r.id
}
export async function requestPhoto(c: Context,p: Portal,fileId: string) {
 const photo = await one(c,'SELECT * FROM tt_request_photos WHERE id=?',fileId); insist(photo,'not_found','Photo not found.',404)
 await own(c,p,photo.request_id); await audit(c,'portal.request.photo',photo.id).run(); return photo
}
export async function residentRequests(c: Context,p: Portal,tenancyId: unknown) {
 const t = await resident(c,p,tenancyId)
 return {tenancy:t,requests:await all(c,'SELECT id,description,submitted_at FROM tt_resident_requests WHERE tenancy_id=? AND submitted_by=? ORDER BY submitted_at DESC,id',t.id,await hash(p.identity.email))}
}
export async function staffRequests(c: Context) {
 const rows = await all(c,'SELECT r.*,t.unit_id,t.address FROM tt_resident_requests r JOIN tt_tenancies t ON t.id=r.tenancy_id WHERE t.erased_at IS NULL ORDER BY submitted_at DESC,id')
 return rows.filter(r => c.actor.role === 'owner' || c.actor.staff?.all || c.actor.staff?.units.has(r.unit_id)).map(r => ({...r,photos:undefined}))
}
export async function linkRequest(c: Context,p: Row) {
 allow(c,'portal.request.link')
 const r = await one(c,'SELECT * FROM tt_resident_requests WHERE id=?',text(p.requestId,'Request',100)); insist(r,'not_found','Request not found.',404)
 await tenancy(c,r.tenancy_id)
 const j = await one(c,'SELECT id,tenancy_id FROM tt_maintenance_jobs WHERE id=?',text(p.jobId,'Work order',100)); insist(j && j.tenancy_id === r.tenancy_id,'not_found','Work order not found.',404)
 insist(Number(p.version) === r.version,'conflict','Reload the request before linking work.',409)
 const reference = text(p.reference,'Link reference',500)
 await commit(c,[guard(c,'EXISTS(SELECT 1 FROM tt_resident_requests WHERE id=? AND version=?)',r.id,r.version),sql(c,'UPDATE tt_resident_requests SET job_id=?,version=version+1 WHERE id=?',j.id,r.id),sql(c,'INSERT INTO tt_request_links(id,request_id,job_id,linked_by,linked_at,reference) VALUES(?,?,?,?,?,?)',id(),r.id,j.id,c.actor.id,c.now,reference)],'portal.request.link',r.id)
 return {notice:'Work linked. Every resident report retains its original concern.',tab:'settings'}
}
