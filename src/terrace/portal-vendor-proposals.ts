import {all,audit,Fault,guard,insist,one,sha256,sql,tenancy,tenancyGuard,text,type Context,type Row} from './core'
import {instant} from './appointments'
import {anyZone,localDate} from './zones'
import {hash,type Portal} from './portal-session'
import {hold,vendorGuard} from './vendors'

export const APPOINTMENT_PROPOSAL_DECLARATION='I propose this availability for staff review only. It is not a booking, resident permission, entry notice or authority to enter.'

/** Append attributable availability only. Staff must separately obtain permission, notice and booking authority. */
export async function vendorAppointmentProposal(c:Context,p:Portal,f:FormData):Promise<Row>{
 const j=await one(c,"SELECT * FROM tt_maintenance_jobs WHERE id=? AND state IN ('approved','sent')",String(f.get('jobId')??''))
 const grant=p.grants.find(g=>g.access==='vendor'&&g.vendor_id===j?.vendor_id)
 insist(j&&grant,'not_found','Work not found.',404)
 const t=await tenancy(c,j.tenancy_id),version=Number(f.get('version'))
 insist(Number.isInteger(version)&&version===j.version,'conflict','Review the current approved work before proposing availability.',409)
 insist(f.get('consent')==='yes','consent_required','Confirm this availability is proposed for staff review only.')
 const zone=anyZone(t.time_zone),startsAt=text(f.get('startsAt'),'Proposed start',32),endsAt=text(f.get('endsAt'),'Proposed end',32)
 const start=instant(startsAt,'Proposed start',zone),end=instant(endsAt,'Proposed end',zone)
 insist(start<end,'invalid_time','Proposed end must be after the start.')
 const reason=text(f.get('reason'),'Proposal reason',1000)
 const h=await hold(c,{...j,due_date:[j.due_date,localDate(end,zone)].sort().at(-1)},t)
 insist(!h.held,'qualification_hold','Your qualification needs staff review before proposing availability.',409)
 const approval=await one(c,'SELECT id,sha256 FROM tt_maintenance_approvals WHERE job_id=? ORDER BY job_version DESC LIMIT 1',j.id)
 insist(approval,'not_found','Approved work not found.',404)
 const identity=await hash(p.identity.email)
 const fingerprint=await sha256(new TextEncoder().encode(JSON.stringify({jobId:j.id,vendorId:j.vendor_id,version,approval:approval.sha256,identity,start,end,zone,reason})))
 const key='portal-appointment-proposal:'+fingerprint
 const saved=()=>one(c,'SELECT * FROM tt_vendor_appointment_proposals WHERE id=? AND job_id=? AND vendor_id=?',key,j.id,j.vendor_id)
 const guards=()=>[
  tenancyGuard(c,t),
  guard(c,"EXISTS(SELECT 1 FROM tt_portal_sessions s JOIN tt_portal_identities i ON i.id=s.identity_id JOIN tt_portal_grants g ON g.identity_id=i.id WHERE s.hash=? AND s.revoked_at IS NULL AND s.expires_at>? AND i.id=? AND i.email=? AND i.status='active' AND g.id=? AND g.access='vendor' AND g.revoked_at IS NULL AND g.vendor_id=?)",p.sessionHash,c.now,p.identity.id,p.identity.email,grant.id,j.vendor_id),
  guard(c,'EXISTS(SELECT 1 FROM tt_maintenance_jobs WHERE id=? AND vendor_id=? AND version=? AND state=?)',j.id,j.vendor_id,version,j.state),
  guard(c,'(SELECT id FROM tt_maintenance_approvals WHERE job_id=? ORDER BY job_version DESC LIMIT 1)=?',j.id,approval.id),
  vendorGuard(c,j,h.vendorVersion),
  ...(h.exception?[guard(c,'EXISTS(SELECT 1 FROM tt_vendor_exceptions WHERE id=? AND job_id=? AND vendor_id=? AND issues=?)',h.exception.id,j.id,j.vendor_id,JSON.stringify(h.issues))]:[]),
 ]
 try{
  const prior=await saved()
  if(prior){await c.db.batch(guards());return prior}
  await c.db.batch([...guards(),
   sql(c,'INSERT INTO tt_vendor_appointment_proposals(id,job_id,vendor_id,job_version,approval_sha256,starts_at,ends_at,time_zone,reason,consent_version,declaration,proposed_by,proposed_at) VALUES(?,?,?,?,?,?,?,?,?,1,?,?,?)',key,j.id,j.vendor_id,version,approval.sha256,startsAt,endsAt,zone,reason,APPOINTMENT_PROPOSAL_DECLARATION,identity,c.now),
   audit(c,'portal.appointment.propose',j.id,JSON.stringify({proposalId:key,jobVersion:version,approvalSha256:approval.sha256,proposedBy:identity,consentVersion:1,declaration:APPOINTMENT_PROPOSAL_DECLARATION})),
  ])
 }catch(error){
  if(String(error).includes('UNIQUE constraint')){
   const prior=await saved()
   if(prior){
    try{await c.db.batch(guards())}catch{throw new Fault('conflict','Your work or access changed. Review it again.',409)}
    return prior
   }
  }
  if(/CHECK constraint|UNIQUE constraint/.test(String(error)))throw new Fault('conflict','Your work or access changed. Review it again.',409)
  throw error
 }
 const result=await saved();insist(result,'conflict','Proposal could not be read. Review the work again.',409);return result
}

/** Current assigned work only; no resident contacts, access instructions or portal credentials. */
export async function vendorAppointmentProposals(c:Context,vendorId:string):Promise<Row[]>{
 return all(c,"SELECT p.* FROM tt_vendor_appointment_proposals p JOIN tt_maintenance_jobs j ON j.id=p.job_id JOIN tt_tenancies t ON t.id=j.tenancy_id WHERE p.vendor_id=? AND j.vendor_id=? AND j.state IN ('approved','sent') AND t.erased_at IS NULL ORDER BY p.proposed_at,p.id",vendorId,vendorId)
}

