import { all, audit, guard, id, insist, one, recordRead, sha256, sql, text, type Context, type Row } from './core'
import { applicantGuard } from './application-access'
import { applicationRecord } from './applications'
import { scan } from './document-scan'

export const applicationFileList = (c: Context, adultId: string) => all(c,'SELECT id,name,purpose,sha256 FROM tt_application_files WHERE adult_id=? ORDER BY at,id',adultId)
export const applicationRevision = (c: Context, a: Row, version: number, state: string, answers: Row, files: Row[], actor: string, reason: string) => sql(c,'INSERT INTO tt_application_revisions(adult_id,version,state,answers,files,actor,at,reason) VALUES(?,?,?,?,?,?,?,?)',a.id,version,state,JSON.stringify(answers),JSON.stringify(files),actor,c.now,reason)
/** Only the current adult's projection is returned by the applicant door. */
export async function applicantData(c: Context, adult: Row) {
 const revisions = await all(c,'SELECT * FROM tt_application_revisions WHERE adult_id=? ORDER BY version',adult.id)
 return { ...adult, answers:JSON.parse(adult.answers),files:await applicationFileList(c,adult.id), requests:await all(c,'SELECT id,message,requested_at,resolved_at,file_id FROM tt_application_requests WHERE adult_id=? ORDER BY requested_at,id',adult.id),revisions:revisions.map(r => ({...r,answers:JSON.parse(r.answers),files:JSON.parse(r.files)})) }
}
export async function applicantWrite(c: Context, adult: Row, sessionHash: string, form: FormData) {
 const version = Number(form.get('version')), action = String(form.get('action')??'')
 insist(version === adult.version, 'conflict','Reload your current application before saving.',409)
 insist(['draft','changes_requested'].includes(adult.state),'submitted_locked','Submitted answers cannot be edited. Ask your manager to request a revision.',409)
 insist(['save','upload','submit'].includes(action),'invalid_action','Choose save, upload or submit.')
 const statements:D1PreparedStatement[] = [], answers:Row=JSON.parse(adult.answers), files=await applicationFileList(c,adult.id)
 let reason='Progress saved', state=adult.state
 if(action==='save') {
  for(const [name,label,max] of [['identity','Identity and contact details',2000],['income','Income and employer',4000],['rentalHistory','Rental history',4000],['references','References',2000]] as const) {
   const v=String(form.get(name)??'').trim();insist(v.length<=max,'invalid_input',`${label} is too long.`);answers[name]=v
  }
 } else if(action==='upload') {
  const file=form.get('file'),purpose=String(form.get('purpose')??'')
  insist(file instanceof File&&file.size>0&&file.size<=5*1024*1024,'file_required','Choose a document up to 5 MB.')
  insist(['income','identity','rental','reference','requested'].includes(purpose),'invalid_input','Choose a document purpose.')
  const requestId=String(form.get('requestId')??'')||null
  if(purpose==='requested')insist(requestId,'request_required','Choose the missing document request.')
  if(requestId)insist(await one(c,'SELECT id FROM tt_application_requests WHERE id=? AND adult_id=? AND resolved_at IS NULL',requestId,adult.id),'not_found','Missing document request not found.',404)
  const bytes=new Uint8Array(await file.arrayBuffer()), screened=await scan(bytes,file.type)
  if(!screened.ok)insist(false,'file_refused',screened.reason)
  const key=id(),fingerprint=await sha256(bytes),name=text(file.name,'File name',200)
  statements.push(sql(c,'INSERT INTO tt_application_files(id,adult_id,request_id,name,type,purpose,bytes,sha256,scan,at) VALUES(?,?,?,?,?,?,?,?,?,?)',key,adult.id,requestId,name,file.type,purpose,bytes,fingerprint,screened.label,c.now))
  if(requestId)statements.push(sql(c,'UPDATE tt_application_requests SET resolved_at=?,file_id=? WHERE id=? AND resolved_at IS NULL',c.now,key,requestId))
  files.push({id:key,name,purpose,sha256:fingerprint});reason='Original evidence uploaded'
 } else {
  for(const key of ['identity','income','rentalHistory','references'])text(answers[key],key,4000)
  insist(files.some(f=>f.purpose==='income'),'income_required','Upload income evidence before submitting.',409)
  insist(!await one(c,'SELECT 1 FROM tt_application_requests WHERE adult_id=? AND resolved_at IS NULL',adult.id),'missing_evidence','Upload each requested original before submitting.',409)
  const app=await one(c,'SELECT disclosures FROM tt_applications WHERE id=?',adult.application_id)
  const disclosureHash=await sha256(new TextEncoder().encode(app!.disclosures))
  insist(form.get('consent')==='SUBMIT MY ANSWERS' && form.get('disclosureHash')===disclosureHash,'consent_required','Review and acknowledge the exact disclosures and your own answers.')
  answers.disclosureConsent={hash:disclosureHash,at:c.now,adultId:adult.id}
  state='submitted';reason='Applicant submitted exact answers and disclosures'
 }
 statements.push(sql(c,"UPDATE tt_application_adults SET answers=?,state=?,version=version+1,submitted_at=CASE WHEN ?='submitted' THEN ? ELSE submitted_at END WHERE id=?",JSON.stringify(answers),state,state,c.now,adult.id),sql(c,'UPDATE tt_applications SET last_activity_at=? WHERE id=?',c.now,adult.application_id),applicationRevision(c,adult,version+1,state,answers,files,'applicant:'+adult.id,reason),audit(c,'application.'+action,adult.id))
 try { await c.db.batch([applicantGuard(c,adult.id,sessionHash),guard(c,'EXISTS(SELECT 1 FROM tt_application_adults WHERE id=? AND version=? AND revoked_at IS NULL)',adult.id,version),...statements]) }
 catch(e){if(String(e).includes('CHECK constraint'))insist(false,'conflict','Your application or access changed. Reload and review.',409);throw e}
 return {version:version+1,state,notice:reason}
}
export async function applicationFile(c: Context, fileId: string, adultId?: string) {
 const file=await one(c,`SELECT f.*,a.application_id FROM tt_application_files f JOIN tt_application_adults a ON a.id=f.adult_id WHERE f.id=?`,fileId)
 insist(file&&(!adultId||file.adult_id===adultId),'not_found','Document not found.',404)
 if(!adultId)await applicationRecord(c,file.application_id)
 await recordRead(c,'application.file',file.id)
 return new Response(new Uint8Array(file.bytes),{headers:{'content-type':file.type,'content-disposition':`attachment; filename="${file.name.replace(/[^a-zA-Z0-9._-]/g,'_')}"`,'cache-control':'private, no-store','x-content-type-options':'nosniff','content-security-policy':"default-src 'none'; sandbox"}})
}
