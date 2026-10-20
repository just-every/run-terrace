// WORK-007: staff-sourced field evidence bound to the current approved work, never technician authentication.
import {all,guard,insist,one,text,type Context,type Row} from './core'
import {checklist} from './dispatch'
export async function fieldEvidence(c:Context,j:Row,p:Row) {
 if (p.fieldEvidence !== 'yes' && p.fieldEvidence !== true) return {value:null,guards:[]}
 insist(Number(p.jobVersion)===j.version,'scope_changed','The approved work changed. Reload and review the technician evidence against the current scope.',409)
 const approval=await one(c,'SELECT * FROM tt_maintenance_approvals WHERE job_id=? ORDER BY job_version DESC LIMIT 1',j.id)
 insist(approval && p.approvalId===approval.id,'scope_changed','Review evidence against the current work approval.',409)
 const snapshot=JSON.parse(approval.snapshot),expected:string[]=snapshot.checklist??[snapshot.title],completed=checklist(p.completedTasks)
 insist(completed.length===expected.length&&completed.every(task=>expected.includes(task)),'checklist_incomplete','Complete every task in the approved checklist before submitting field evidence.',409)
 const minutes=Number(p.laborMinutes)
 insist(String(p.laborMinutes??'').trim()!==''&&Number.isSafeInteger(minutes)&&minutes>=0,'invalid_labor','Labor time must be a whole number of minutes, including zero.')
 const access=String(p.accessOutcome??'')
 insist(['granted','not_needed','no_access'].includes(access),'invalid_access','Record whether access was granted, not needed or unavailable.')
 const photos=await all(c,'SELECT p.id,p.filename,p.sha256,p.uploaded_at,i.inspection_date FROM tt_inspection_photos p JOIN tt_inspections i ON i.id=p.inspection_id WHERE i.tenancy_id=? AND p.id IN (?,?)',j.tenancy_id,text(p.beforePhotoId,'Before photo',100),text(p.afterPhotoId,'After photo',100))
 const before=photos.find(x=>x.id===p.beforePhotoId),after=photos.find(x=>x.id===p.afterPhotoId)
 insist(before&&after,'photo_not_found','Choose before and after originals from this tenancy’s inspections.',404)
 insist(before.id!==after.id,'photo_pair','Use distinct before and after original photos.')
 const value={approvalId:approval.id,approvalSha256:approval.sha256,jobVersion:j.version,scope:snapshot.scope??snapshot.title,checklist:expected,completedTasks:completed,laborMinutes:minutes,materials:text(p.materials,'Parts/materials used, or explicitly none',2000),accessOutcome:access,beforePhoto:before,afterPhoto:after,label:'Technician evidence recorded by staff from the cited source; not a technician portal submission'}
 return {value,guards:[guard(c,"EXISTS(SELECT 1 FROM tt_maintenance_jobs WHERE id=? AND version=? AND state='sent')",j.id,j.version),guard(c,'(SELECT id FROM tt_maintenance_approvals WHERE job_id=? ORDER BY job_version DESC LIMIT 1)=?',j.id,approval.id),...photos.map(photo=>guard(c,'EXISTS(SELECT 1 FROM tt_inspection_photos WHERE id=? AND sha256=?)',photo.id,photo.sha256))]}
}
