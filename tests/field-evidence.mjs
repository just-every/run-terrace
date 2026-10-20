// WORK-007: staff-sourced labor/material/access evidence bound to the reviewed scope and original media.
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jz1sAAAAASUVORK5CYII=','base64')
export async function journey({h,t,j,tasks,inspect}) {
 const before=await h.command('inspection.create',{tenancyId:t.id,date:'2026-10-19',notes:'Kitchen inlet valve: active drip before replacement'})
 const upload=(inspectionId,name)=>h.formCommand('inspection.photo',{inspectionId,file:new File([png],name,{type:'image/png'})})
 const first=await upload(before.id,'inlet-valve-before.png'),second=await upload(before.id,'inlet-valve-after.png')
 const other=await h.command('tenancy.create',{address:'12 Pine Street, Oakland, CA',ownerName:'Oak Homes',ownerEmail:'owner2@example.test',tenantName:'Lee Park',tenantEmail:'lee@example.test',startDate:'2026-01-01',endDate:'2030-12-31',rent:'2000.00',cadence:'monthly'})
 const unrelated=await h.command('inspection.create',{tenancyId:other.id,date:'2026-10-19',notes:'Other household'})
 const unrelatedPhoto=await upload(unrelated.id,'unrelated-original.png')
 const work=async()=>(await h.state(t.id)).work,row=(await work()).jobs.find(x=>x.id===j.id)
 const payload={jobId:j.id,completedDate:'2026-10-20',summary:'Replaced inlet valve and checked for leaks',reference:'Bay Plumbing completion email with time sheet and original photos',fieldEvidence:'yes',jobVersion:row.version,approvalId:row.approval_id,laborMinutes:'75',materials:'1 quarter-turn inlet valve, 2 compression washers; no additional materials',accessOutcome:'granted',completedTasks:tasks.join('\n'),beforePhotoId:first.photoId,afterPhotoId:second.photoId}
 await h.command('completion.record',{...payload,jobVersion:row.version-1},{status:409})
 await h.command('completion.record',{...payload,approvalId:'old-approval'},{status:409})
 await h.command('completion.record',{...payload,completedTasks:tasks.slice(1).join('\n')},{status:409})
 await h.command('completion.record',{...payload,afterPhotoId:unrelatedPhoto.photoId},{status:404})
 await h.command('completion.record',{...payload,afterPhotoId:first.photoId},{status:400})
 await h.command('completion.record',{...payload,laborMinutes:'1.5'},{status:400})
 assert.equal((await work()).attempts.filter(x=>x.job_id===j.id).length,0,'WORK-007 refused evidence creates no completion or resident resolution')
 const native=await inspect?.({phase:'before-field-report',h,t,j,payload})
 if (!native) await h.command('completion.record',payload)
 const saved=(await work()).attempts.find(x=>x.job_id===j.id),f=JSON.parse(saved.field_evidence)
 assert.deepEqual([f.laborMinutes,f.materials,f.accessOutcome,f.completedTasks],[75,payload.materials,'granted',tasks])
 assert.deepEqual([f.approvalId,f.approvalSha256,f.jobVersion],[row.approval_id,row.approval_sha256,row.version])
 assert.equal(f.beforePhoto.id,first.photoId);assert.equal(f.afterPhoto.id,second.photoId)
 assert.equal(f.beforePhoto.sha256,createHash('sha256').update(png).digest('hex'))
 assert.equal((await work()).jobs.find(x=>x.id===j.id).resolution,'awaiting_check','WORK-007 evidence alone never resolves the resident issue')
 assert.equal((await h.request('/api/inspections/photos/'+first.photoId)).headers.get('cache-control'),'private, no-store')
 assert.deepEqual(Buffer.from(await(await h.request('/api/inspections/photos/'+second.photoId)).arrayBuffer()),png)
 await h.command('completion.record',payload,{status:409})
 assert.equal((await work()).attempts.filter(x=>x.job_id===j.id).length,1,'WORK-007 replay cannot submit a second completion')
 const history=(await(await h.request('/api/history')).json()).rows
 assert.ok(history.some(x=>x.action==='completion.record'&&x.tenancyId===t.id&&x.source===payload.reference))
 await inspect?.({phase:'saved-field-report',h,t,j,payload,saved})
 return {saved,png}
}
