import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {readFile} from 'node:fs/promises'
import {installation,tenancyInput} from './api/harness.mjs'
import {fixture,upload,png} from './record-media.mjs'
export async function videoOriginal(){const b=await readFile(new URL('./fixtures/inspection-walkthrough.mp4',import.meta.url));let at=0;while(at+8<b.length){const size=b.readUInt32BE(at),kind=b.subarray(at+4,at+8).toString();if(kind==='free'&&size>1024*1024)return b.subarray(0,at);at+=size||b.length}return b}
export async function journey({assets=false,inspect}={}){
 const h=await installation({assets}),fresh=await installation()
 try{
  const f=await fixture(h),{j,t}=f,tasks=['Replace valve','Test for leaks'],revised=['Isolate water supply',...tasks]
  await h.command('maintenance.approve',{jobId:j.id,version:1});await h.command('maintenance.sent',{jobId:j.id,version:2,reference:'Approved packet handed to in-house technician'})
  await h.stepUp();await h.command('operator.invite',{displayName:'Jordan Field Technician',email:'jordan-tech@example.test',role:'portfolio_manager',['portfolio:'+f.f.id]:'1'});const technician=await h.accept('jordan-tech@example.test')
  const before=await upload(h,{kind:'work',recordId:j.id,bytes:png,name:'before-valve.png'},{as:technician}),video=await videoOriginal(),after=await upload(h,{kind:'work',recordId:j.id,bytes:video,name:'after-valve.mp4',type:'video/mp4'},{as:technician})
  const row=(await h.state(t.id)).work.jobs.find(x=>x.id===j.id),payload={jobId:j.id,jobVersion:row.version,approvalId:row.approval_id,clientId:randomUUID(),captureMode:'direct',fieldEvidence:'yes',completedDate:'2026-10-22',summary:'Replaced valve and verified dry connection',reference:'My direct field report and original phone evidence',laborMinutes:'75',materials:'Quarter-turn valve and two washers',accessOutcome:'granted',completedTasks:tasks.join('\n'),beforePhotoId:before.id,afterPhotoId:after.id}
  const changeScope=async()=>{
   const current=(await h.state(t.id)).work.jobs.find(x=>x.id===j.id)
   await h.command('maintenance.field-revise',{jobId:j.id,version:current.version,scope:'Isolate water supply before replacing valve and pressure test',checklist:revised.join('\n'),reference:'Additional isolation step identified on site'})
   await h.command('completion.record',payload,{as:technician,status:409})
   await h.command('maintenance.approve',{jobId:j.id,version:current.version+1},{status:403})
   await h.command('maintenance.approve',{jobId:j.id,version:current.version+1},{as:technician})
   await h.command('maintenance.sent',{jobId:j.id,version:current.version+2,reference:'Revised approved packet explicitly handed to technician'})
   return (await h.state(t.id)).work.jobs.find(x=>x.id===j.id)
  }
  await inspect?.({phase:'before-scope-change',h,...f,technician,payload,changeScope,revised,video})
  let state=(await h.state(t.id)).work,saved=state.attempts.find(x=>x.job_id===j.id)
  if(!saved){
   const current=await changeScope();await h.command('completion.record',payload,{as:technician,status:409})
   const reconciled={...payload,jobVersion:current.version,approvalId:current.approval_id,completedTasks:revised.join('\n'),deviceConsentAt:'2026-10-22T12:00:00Z',reconciliation:{previousVersion:row.version,previousValues:payload,reviewedVersion:current.version}}
   await h.command('completion.record',{...reconciled,completedTasks:tasks.join('\n')},{as:technician,status:409})
   await h.command('completion.record',{...reconciled,laborMinutes:'1.5'},{as:technician,status:400})
   const other=await h.command('tenancy.create',{...tenancyInput,address:'12 Pine Street, Oakland, CA',tenantEmail:'other-field@example.test'}),inspection=await h.command('inspection.create',{tenancyId:other.id,date:'2026-10-22',notes:'Other resident private evidence'}),foreign=await upload(h,{kind:'inspection',recordId:inspection.id,bytes:png,name:'unrelated.png'})
   await h.command('completion.record',{...reconciled,afterPhotoId:foreign.id},{as:technician,status:404})
   await h.command('completion.record',reconciled,{as:technician});assert.equal((await h.command('completion.record',reconciled,{as:technician})).replayed,true)
   await h.command('completion.record',{...reconciled,materials:'Changed after synchronization'},{as:technician,status:409})
   saved=(await h.state(t.id)).work.attempts.find(x=>x.job_id===j.id)
  }
  const evidence=JSON.parse(saved.field_evidence);assert.equal(evidence.captureMode,'direct');assert.match(evidence.label,/Jordan Field Technician/);assert.equal(evidence.laborMinutes,75);assert.equal(evidence.materials,'Quarter-turn valve and two washers');assert.deepEqual(evidence.completedTasks,revised);assert.ok(evidence.reconciliation);assert.equal(evidence.afterPhoto.media_type,'video/mp4')
  const ownerState=(await h.state(t.id)).work;assert.equal(ownerState.jobs.find(x=>x.id===j.id).resolution,'awaiting_check');assert.equal(ownerState.attempts.filter(x=>x.job_id===j.id).length,1)
  assert.equal(ownerState.jobs.find(x=>x.id===j.id).state,'sent');assert.equal((await h.request('/api/record-media/file?id='+evidence.afterPhoto.id,{as:technician})).status,200)
  await inspect?.({phase:'submitted',h,...f,technician,saved,evidence})
  const archive=await(await h.request('/api/backup')).text();await fresh.formCommand('data.restore',{confirm:'RESTORE',backup:new File([archive],'technician.rer')});const restored=(await fresh.state(t.id)).work.attempts.find(x=>x.id===saved.id);assert.equal(restored.field_evidence,saved.field_evidence)
  for(const m of [evidence.beforePhoto,evidence.afterPhoto])assert.deepEqual(Buffer.from(await(await fresh.request(m.url)).arrayBuffer()),Buffer.from(await(await h.request(m.url)).arrayBuffer()))
  assert.equal((await h.request('/app?tab=technician&tenancy='+t.id,{as:''})).status,303)
 }finally{await h.close();await fresh.close()}
}
