import {all,audit,Fault,guard,id,insist,one,sha256,sql,tenancy,tenancyGuard,type Context,type Row} from './core'
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
