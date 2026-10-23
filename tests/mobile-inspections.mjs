import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {installation} from './api/harness.mjs'
import {fixture,upload,png} from './record-media.mjs'
export const definitions=[{key:'sink',room:'Kitchen',asset:'Sink'},{key:'meter',room:'Utility',asset:'Water meter'}]
export async function journey({assets=false,inspect}={}){
 const h=await installation({assets}),fresh=await installation()
 try{
  const base=await fixture(h),{t,i}=base
  await h.command('inspection.configure',{inspectionId:i.id,version:1,kind:'move_in',checklist:definitions})
  const original=await upload(h,{kind:'inspection',recordId:i.id,bytes:png,name:'entry-sink.png'})
  const entryItems=definitions.map(x=>({key:x.key,condition:'good',notes:x.key==='sink'?'No chips or leaks at entry':'Meter undamaged',reading:x.key==='meter'?'1042':'none',mediaIds:x.key==='sink'?[original.id]:[]}))
  const entry=await h.command('inspection.capture',{inspectionId:i.id,version:2,clientId:randomUUID(),capturedAt:'2026-10-20',source:'Entry walkthrough with resident',items:entryItems})
  await h.command('inspection.complete',{inspectionId:i.id,version:3,notes:'Entry checklist reviewed with original evidence'})
  const exit=await h.command('inspection.create',{tenancyId:t.id,date:'2026-10-22',notes:'Move-out inspection'})
  await h.command('inspection.configure',{inspectionId:exit.id,version:1,kind:'move_out',entryId:i.id,checklist:definitions})
  const after=await upload(h,{kind:'inspection',recordId:exit.id,bytes:Buffer.concat([png,Buffer.from('exit original')]),name:'exit-sink.png'})
  await h.command('inspection.complete',{inspectionId:exit.id,version:2,notes:'Premature completion'},{status:409})
  const payload={inspectionId:exit.id,version:2,clientId:randomUUID(),capturedAt:'2026-10-22',source:'Technician’s phone at move-out',items:definitions.map(x=>({key:x.key,condition:'damaged',notes:x.key==='sink'?'Chip on sink rim':'Cracked meter cover',reading:x.key==='meter'?'1145':'none',mediaIds:x.key==='sink'?[after.id]:[]}))}
  // A scope change while the phone is offline must reject stale capture without losing or silently applying it.
  await h.command('inspection.configure',{inspectionId:exit.id,version:2,kind:'move_out',entryId:i.id,checklist:[...definitions,{key:'door',room:'Entry',asset:'Door'}]})
  await h.command('inspection.capture',payload,{status:409})
  assert.equal((await h.state(t.id)).work.captures.filter(f=>f.inspection_id===exit.id).length,0)
  const reconciled={...payload,version:3,items:[...payload.items,{key:'door',condition:'good',notes:'Door and latch unchanged',reading:'none',mediaIds:[]}],reconciliation:{previousVersion:2,previousValues:payload,reviewedVersion:3,reviewedAt:'2026-10-22T12:00:00Z'}}
  await inspect?.({phase:'before-exit',h,...base,exit,entry,after,payload,reconciled})
  const existing=(await h.state(t.id)).work.captures.find(f=>f.inspection_id===exit.id)
  const captured=existing?{id:existing.id}:await h.command('inspection.capture',reconciled)
  if(!existing){assert.equal((await h.command('inspection.capture',reconciled)).replayed,true);await h.command('inspection.capture',{...reconciled,source:'different'},{status:409})}
  await h.command('inspection.acknowledge',{captureId:captured.id,itemKey:'meter',outcome:'disputed',note:'Meter cover was cracked before move-in; I dispute the charge.',source:'Resident email dated 22 October'})
  await h.command('inspection.acknowledge',{captureId:captured.id,itemKey:'sink',outcome:'acknowledged',note:'I acknowledge the dated sink photographs, without accepting a deduction.',source:'Resident email dated 22 October'})
  const unsupported=await h.command('inspection.propose',{captureId:captured.id,itemKey:'meter',kind:'deduction',amount:'90.00',reason:'Replace cracked cover'})
  const denied=await h.command('inspection.decide',{proposalId:unsupported.id,decision:'approved',reason:'Approve repair'},{status:409});assert.equal(denied.error,'unsupported_finding')
  await h.command('inspection.decide',{proposalId:unsupported.id,decision:'rejected',reason:'No entry/exit media supports this deduction; retain resident dispute.'})
  const supported=await h.command('inspection.propose',{captureId:captured.id,itemKey:'sink',kind:'work',reason:'Review repair of photographed sink rim'})
  await h.command('inspection.decide',{proposalId:supported.id,decision:'approved',reason:'Both originals support inspection follow-up only'})
  const state=(await h.state(t.id)).work
  assert.equal(state.acknowledgements.filter(a=>a.outcome==='disputed').length,1)
  assert.deepEqual(state.inspectionProposals.map(p=>p.decision).sort(),['approved','rejected'])
  assert.equal((await h.state(t.id)).ledger.charges.length,0,'inspection decision never posts a deposit charge')
  assert.equal(state.jobs.length,1,'inspection decision never dispatches or fabricates a work order')
  await inspect?.({phase:'comparison',h,...base,exit,captured})
  const exitRow=(await h.state(t.id)).work.inspections.find(x=>x.id===exit.id);if(exitRow.state==='draft')await h.command('inspection.complete',{inspectionId:exit.id,version:exitRow.version,notes:'Reviewed final move-out checklist and original evidence'})
  assert.equal((await h.state(t.id)).work.inspections.find(x=>x.id===exit.id).state,'completed')
  const archive=await(await h.request('/api/backup')).text();await fresh.formCommand('data.restore',{confirm:'RESTORE',backup:new File([archive],'inspection.rer')})
  const restored=(await fresh.state(t.id)).work;assert.equal(restored.inspections.find(x=>x.id===exit.id).state,'completed');assert.deepEqual(restored.captures,state.captures);assert.deepEqual(restored.acknowledgements,state.acknowledgements);assert.deepEqual(restored.inspectionProposals,state.inspectionProposals)
  const other=await h.command('portfolio.add',{name:'Unrelated field portfolio'});await h.stepUp();await h.command('operator.invite',{displayName:'Unrelated inspector',email:'unrelated-inspector@example.test',role:'portfolio_manager',['portfolio:'+other.id]:'1'});const cookie=await h.accept('unrelated-inspector@example.test')
  await h.command('inspection.acknowledge',{captureId:captured.id,itemKey:'meter',outcome:'disputed',note:'probe',source:'probe'},{as:cookie,status:404})
  await h.command('operator.invite',{displayName:'Coordinator',email:'coordinator-policy@example.test',role:'maintenance_coordinator',['portfolio:'+base.f.id]:'1'});const coordinator=await h.accept('coordinator-policy@example.test');await h.command('inspection.acknowledge',{captureId:captured.id,itemKey:'meter',outcome:'disputed',note:'probe',source:'probe'},{as:coordinator,status:403})
 }finally{await h.close();await fresh.close()}
}
