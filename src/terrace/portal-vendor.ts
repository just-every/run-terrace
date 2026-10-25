import {all,audit,Fault,guard,id,insist,one,sha256,sql,text,tenancy,tenancyGuard,type Context,type Row} from './core'
import {localDate} from './zones'
import {hash,type Portal} from './portal-session'
import {hold,vendorGuard} from './vendors'

/** An explicit response to the exact approved work. It never sends, schedules, dispatches or changes spend authority. */
export async function respondToWork(c:Context,p:Portal,f:FormData){
 const jobId=String(f.get('jobId')??'')
 const j=await one(c,"SELECT * FROM tt_maintenance_jobs WHERE id=? AND state IN ('approved','sent')",jobId)
 const grant=p.grants.find(g=>g.access==='vendor'&&g.vendor_id===j?.vendor_id)
 insist(j&&grant,'not_found','Work not found.',404)
 const t=await tenancy(c,j.tenancy_id)
 insist(Number(f.get('version'))===j.version,'conflict','Review the current approved job before responding.',409)
 const a=await one(c,'SELECT * FROM tt_maintenance_approvals WHERE job_id=? ORDER BY job_version DESC LIMIT 1',j.id)
 insist(a,'not_found','Work not found.',404)
 const h=await hold(c,j,t)
 insist(!h.held,'qualification_hold','Your qualification needs staff review before responding.',409)
 const outcome=String(f.get('outcome')??'')
 insist(['accepted','declined'].includes(outcome),'invalid_input','Choose accepted or declined.')
 insist(f.get('consent')==='yes','consent_required','Confirm this is your response to the exact approved work.')
 const fingerprint=await sha256(new TextEncoder().encode(a.snapshot)),identity=await hash(p.identity.email)
 const prior=await one(c,'SELECT * FROM tt_vendor_work_responses WHERE job_id=? AND vendor_id=? AND job_version=?',j.id,j.vendor_id,j.version)
 if(prior){insist(prior.outcome===outcome&&prior.approval_sha256===fingerprint&&prior.responded_by===identity,'conflict','A response already exists for this approved job.',409);return prior}
 const key=id()
 try{await c.db.batch([
  tenancyGuard(c,t),
  guard(c,"EXISTS(SELECT 1 FROM tt_portal_sessions s JOIN tt_portal_identities i ON i.id=s.identity_id JOIN tt_portal_grants g ON g.identity_id=i.id WHERE s.hash=? AND s.revoked_at IS NULL AND s.expires_at>? AND i.status='active' AND g.id=? AND g.access='vendor' AND g.revoked_at IS NULL AND g.vendor_id=?)",p.sessionHash,c.now,grant.id,j.vendor_id),
  guard(c,'EXISTS(SELECT 1 FROM tt_maintenance_jobs WHERE id=? AND vendor_id=? AND version=? AND state=?)',j.id,j.vendor_id,j.version,j.state),
  vendorGuard(c,j,h.vendorVersion),
  sql(c,'INSERT INTO tt_vendor_work_responses VALUES(?,?,?,?,?,?,1,?,?)',key,j.id,j.vendor_id,j.version,fingerprint,outcome,identity,c.now),
  audit(c,'portal.work.response',j.id,outcome),
 ])}catch(error){
  if(String(error).includes('UNIQUE constraint')){
   const saved=await one(c,'SELECT * FROM tt_vendor_work_responses WHERE job_id=? AND vendor_id=? AND job_version=?',j.id,j.vendor_id,j.version)
   insist(saved&&saved.outcome===outcome&&saved.approval_sha256===fingerprint&&saved.responded_by===identity,'conflict','A response already exists for this approved job.',409)
   return saved
  }
  if(String(error).includes('CHECK constraint'))throw new Fault('conflict','Your job or access changed. Review it again.',409)
  throw error
 }
 return one(c,'SELECT * FROM tt_vendor_work_responses WHERE id=?',key)
}
/** A vendor can inspect their own attributable responses only while the job is still approved and assigned to them. */
export async function vendorResponses(c:Context,vendorId:string){
 return all(c,"SELECT r.* FROM tt_vendor_work_responses r JOIN tt_maintenance_jobs j ON j.id=r.job_id JOIN tt_tenancies t ON t.id=j.tenancy_id WHERE j.vendor_id=? AND r.vendor_id=? AND j.state IN ('approved','sent') AND t.erased_at IS NULL",vendorId,vendorId)
}

/** A vendor answers a staff-booked window; resident consent and staff booking authority stay separate. */
export async function vendorAppointment(c:Context,p:Portal,f:FormData){
 const a=await one(c,'SELECT * FROM tt_appointments WHERE id=?',String(f.get('appointmentId')??''))
 const j=a&&await one(c,"SELECT * FROM tt_maintenance_jobs WHERE id=? AND state IN ('approved','sent')",a.job_id)
 const grant=p.grants.find(g=>g.access==='vendor'&&g.vendor_id===j?.vendor_id)
 insist(a&&j&&grant&&a.vendor_id===j.vendor_id,'not_found','Appointment not found.',404)
 const t=await tenancy(c,j.tenancy_id)
 const approval=await one(c,'SELECT id FROM tt_maintenance_approvals WHERE job_id=? ORDER BY job_version DESC LIMIT 1',j.id)
 insist(approval?.id===a.approval_id,'conflict','Staff must book the current approved work again.',409)
 const outcome=String(f.get('outcome')??''),version=Number(f.get('version'))
 insist(['confirmed','cancelled'].includes(outcome)&&Number.isInteger(version)&&version>0,'invalid_input','Choose an appointment response.')
 insist(f.get('consent')==='yes','consent_required','Confirm this response to the displayed appointment.')
 const reference=text(f.get('reference'),'Response reason',1000),key=`portal-appointment:${a.id}:${version}`
 const saved=async()=>{
  const e=await one(c,'SELECT * FROM tt_appointment_events WHERE id=?',key)
  if(e)insist(e.recorded_by===c.actor.id&&e.outcome===outcome&&e.reference===reference,'conflict','A different response already exists for this appointment revision.',409)
  return e
 }
 const prior=await saved();if(prior)return prior
 insist(a.version===version&&['proposed','confirmed'].includes(a.state),'conflict','Review the current appointment before responding.',409)
 if(outcome==='confirmed')insist(!a.vendor_confirmed_at,'conflict','You already confirmed this window.',409)
 const h=await hold(c,{...j,due_date:[j.due_date,localDate(a.ends_at,t.time_zone)].sort().at(-1)},t)
 if(outcome==='confirmed')insist(!h.held,'qualification_hold','Your qualification needs staff review before confirmation.',409)
 try{await c.db.batch([
  tenancyGuard(c,t),
  guard(c,"EXISTS(SELECT 1 FROM tt_portal_sessions s JOIN tt_portal_identities i ON i.id=s.identity_id JOIN tt_portal_grants g ON g.identity_id=i.id WHERE s.hash=? AND s.revoked_at IS NULL AND s.expires_at>? AND i.status='active' AND g.id=? AND g.access='vendor' AND g.revoked_at IS NULL AND g.vendor_id=?)",p.sessionHash,c.now,grant.id,j.vendor_id),
  guard(c,'EXISTS(SELECT 1 FROM tt_maintenance_jobs WHERE id=? AND version=? AND vendor_id=? AND state=?)',j.id,j.version,j.vendor_id,j.state),
  guard(c,'(SELECT id FROM tt_maintenance_approvals WHERE job_id=? ORDER BY job_version DESC LIMIT 1)=?',j.id,a.approval_id),
  guard(c,'EXISTS(SELECT 1 FROM tt_appointments WHERE id=? AND version=? AND state=?)',a.id,version,a.state),
  ...(outcome==='confirmed'?[vendorGuard(c,j,h.vendorVersion)]:[]),
  sql(c,'INSERT INTO tt_appointment_events(id,appointment_id,kind,party,outcome,reference,label,recorded_by,recorded_at) VALUES(?,?,?,?,?,?,?,?,?)',key,a.id,outcome==='confirmed'?'confirmation':'cancelled','vendor',outcome,reference,'Confirmation version 1: I confirm this response to the displayed appointment. Resident confirmation remains separate.',c.actor.id,c.now),
  sql(c,'UPDATE tt_appointments SET state=?,vendor_confirmed_at=?,confirmed_at=?,version=version+1 WHERE id=?',outcome==='cancelled'?'cancelled':a.resident_confirmed_at?'confirmed':'proposed',outcome==='confirmed'?c.now:a.vendor_confirmed_at,outcome==='confirmed'&&a.resident_confirmed_at?c.now:a.confirmed_at,a.id),
  audit(c,'portal.appointment.response',j.id,outcome),
 ])}catch(error){
  if(/CHECK constraint|UNIQUE constraint/.test(String(error))){const e=await saved();if(e)return e;throw new Fault('conflict','Your appointment or access changed. Review it again.',409)}
  throw error
 }
 return saved()
}
export async function vendorAppointments(c:Context,vendorId:string){
 return all(c,"SELECT a.id,a.job_id,a.version,a.state,a.starts_at,a.ends_at,a.time_zone,a.vendor_confirmed_at FROM tt_appointments a JOIN tt_maintenance_jobs j ON j.id=a.job_id JOIN tt_tenancies t ON t.id=j.tenancy_id WHERE j.vendor_id=? AND a.vendor_id=? AND j.state IN ('approved','sent') AND t.erased_at IS NULL AND a.approval_id=(SELECT id FROM tt_maintenance_approvals WHERE job_id=j.id ORDER BY job_version DESC LIMIT 1) ORDER BY a.recorded_at,a.rowid",vendorId,vendorId)
}
