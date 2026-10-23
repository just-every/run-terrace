// WORK-007: staff-sourced field evidence bound to the current approved work, never technician authentication.
import {all,guard,insist,one,sha256,text,type Context,type Row} from './core'
import {checklist} from './dispatch'
export async function fieldEvidence(c:Context,j:Row,p:Row) {
 if (p.fieldEvidence !== 'yes' && p.fieldEvidence !== true && p.captureMode !== 'direct') return {value:null,guards:[]}
 insist(Number(p.jobVersion)===j.version,'scope_changed','The approved work changed. Reload and review the technician evidence against the current scope.',409)
 const approval=await one(c,'SELECT * FROM tt_maintenance_approvals WHERE job_id=? ORDER BY job_version DESC LIMIT 1',j.id)
 insist(approval && p.approvalId===approval.id,'scope_changed','Review evidence against the current work approval.',409)
 const snapshot=JSON.parse(approval.snapshot),expected:string[]=snapshot.checklist??[snapshot.title],completed=checklist(p.completedTasks)
 insist(completed.length===expected.length&&completed.every(task=>expected.includes(task)),'checklist_incomplete','Complete every task in the approved checklist before submitting field evidence.',409)
 const minutes=Number(p.laborMinutes)
 insist(String(p.laborMinutes??'').trim()!==''&&Number.isSafeInteger(minutes)&&minutes>=0,'invalid_labor','Labor time must be a whole number of minutes, including zero.')
 const access=String(p.accessOutcome??'')
 insist(['granted','not_needed','no_access'].includes(access),'invalid_access','Record whether access was granted, not needed or unavailable.')
 const beforeId=text(p.beforePhotoId,'Before original',100),afterId=text(p.afterPhotoId,'After original',100)
 const photos=await all(c,'SELECT p.id,p.filename,p.sha256,p.uploaded_at,i.inspection_date FROM tt_inspection_photos p JOIN tt_inspections i ON i.id=p.inspection_id WHERE i.tenancy_id=? AND p.id IN (?,?)',j.tenancy_id,beforeId,afterId)
 const media=await all(c,"SELECT m.id,m.name AS filename,m.sha256,m.uploaded_at,m.captured_at AS inspection_date,m.media_type FROM tt_record_media m LEFT JOIN tt_inspections i ON i.id=m.inspection_id WHERE m.state='ready' AND (m.job_id=? OR i.tenancy_id=?) AND m.id IN (?,?) AND (m.media_type LIKE 'image/%' OR m.media_type LIKE 'video/%')",j.id,j.tenancy_id,beforeId,afterId)
 photos.push(...media.map(m=>({...m,url:'/api/record-media/file?id='+m.id,recordMedia:true})))
 const before=photos.find(x=>x.id===p.beforePhotoId),after=photos.find(x=>x.id===p.afterPhotoId)
 insist(before&&after,'photo_not_found','Choose before and after originals from this work or tenancy’s inspections.',404)
 insist(before.id!==after.id,'photo_pair','Use distinct before and after original photos.')
 const direct=p.captureMode==='direct'
 if(direct)insist(c.actor.role==='owner'||c.actor.staff?.role==='portfolio_manager','forbidden','Direct device capture defaults to the owner or portfolio managers pending policy approval.',403)
 const provenance=direct?{clientId:text(p.clientId,'Device capture id',100),payloadSha256:await directFieldHash(p),submittedBy:c.actor.id,submittedName:c.actor.displayName,submittedAt:c.now,deviceConsentAt:p.deviceConsentAt??null,reconciliation:p.reconciliation??null,captureMode:'direct',notes:text(p.summary,'Work notes',2000)}:{}
 const value={...provenance,approvalId:approval.id,approvalSha256:approval.sha256,jobVersion:j.version,scope:snapshot.scope??snapshot.title,checklist:expected,completedTasks:completed,laborMinutes:minutes,materials:text(p.materials,'Parts/materials used, or explicitly none',2000),accessOutcome:access,beforePhoto:before,afterPhoto:after,label:direct?'Direct field report by signed-in '+c.actor.displayName+'; not vendor-portal authentication':'Technician evidence recorded by staff from the cited source; not a technician portal submission'}
 return {value,guards:[guard(c,"EXISTS(SELECT 1 FROM tt_maintenance_jobs WHERE id=? AND version=? AND state='sent')",j.id,j.version),guard(c,'(SELECT id FROM tt_maintenance_approvals WHERE job_id=? ORDER BY job_version DESC LIMIT 1)=?',j.id,approval.id),...photos.map(photo=>guard(c,photo.recordMedia?"EXISTS(SELECT 1 FROM tt_record_media WHERE id=? AND sha256=? AND state='ready')":'EXISTS(SELECT 1 FROM tt_inspection_photos WHERE id=? AND sha256=?)',photo.id,photo.sha256))]}
}

/** Only evidence fields that affect the direct report enter the once-only fingerprint. */
export async function directFieldHash(p:Row) {
 const keys=['jobId','clientId','jobVersion','approvalId','completedDate','summary','reference','callback','laborMinutes','materials','accessOutcome','completedTasks','beforePhotoId','afterPhotoId']
 return sha256(new TextEncoder().encode(JSON.stringify(Object.fromEntries(keys.map(k=>[k,p[k]===undefined?null:String(p[k])])))))
}
export async function directFieldReplay(c:Context,j:Row,p:Row) {
 if(p.captureMode!=='direct')return null
 insist(c.actor.role==='owner'||c.actor.staff?.role==='portfolio_manager','forbidden','Direct device capture defaults to the owner or portfolio managers pending policy approval.',403)
 const key=text(p.clientId,'Device capture id',100),old=await one(c,"SELECT * FROM tt_completion_attempts WHERE json_extract(field_evidence,'$.clientId')=?",key)
 if(!old)return null
 const f=JSON.parse(old.field_evidence)
 insist(old.job_id===j.id&&old.recorded_by===c.actor.id&&f.payloadSha256===await directFieldHash(p),'capture_replay','This device capture id already records different evidence.',409)
 return {id:old.id,tenancyId:j.tenancy_id,replayed:true,notice:'Direct field report already submitted once. The resident check remains separate.'}
}
