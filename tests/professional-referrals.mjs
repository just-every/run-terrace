import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {installation,tenancyInput} from './api/harness.mjs'
import {syntheticPack} from './rule-packs.mjs'
const mailbox=name=>name+'@'+'example.test'
const sha=bytes=>createHash('sha256').update(bytes).digest('hex')
export async function journey({assets=false,inspect}={}){
 const h=await installation({assets,now:'2026-10-20T12:00:00.000Z'})
 try{
  const json=async(path,as=h.cookie)=>{const r=await h.request(path,{as});assert.equal(r.status,200,await r.clone().text());return r.json()}
  const f=await h.command('portfolio.add',{name:'Referral portfolio'}),outside=await h.command('portfolio.add',{name:'Outside portfolio'})
  const property=await h.command('property.add',{portfolioId:f.id,name:'Referral property',address:'1 Synthetic Terrace Road',kind:'duplex',timeZone:'America/Los_Angeles'})
  const other=await h.command('property.add',{portfolioId:outside.id,name:'Outside property',address:'2 Synthetic Terrace Road',kind:'duplex',timeZone:'America/Los_Angeles'})
  const unit=await h.command('unit.add',{propertyId:property.id,identifier:'A',bedrooms:2,bathrooms:1,amenities:'',rentable:true})
  const otherUnit=await h.command('unit.add',{propertyId:other.id,identifier:'B',bedrooms:2,bathrooms:1,amenities:'',rentable:true})
  const t=await h.command('tenancy.create',{...tenancyInput,unitId:unit.id,tenantEmail:mailbox('synthetic-terrace-1'),startDate:'2009-01-01',endDate:'2010-12-31'})
  const otherT=await h.command('tenancy.create',{...tenancyInput,unitId:otherUnit.id,tenantEmail:mailbox('synthetic-terrace-2')})
  await h.command('property.rules',{propertyId:property.id,stateCode:'CA',version:0,reference:'synthetic-terrace-3'})
  const preview=()=>h.command('rules.preview',{propertyId:property.id,action:'entry',on:'2026-10-20'})
  const held=await preview();assert.equal(held.state,'held');assert.ok(held.sourceRevision)
  const owner=(await json('/api/history')).rows.find(r=>r.actorName==='Terrace owner').actor
  const staff={};await h.stepUp()
  for(const role of ['portfolio_manager','leasing','bookkeeper','accountant','maintenance_coordinator','member']){
   const email=mailbox('synthetic-terrace-'+role)
   await h.command('operator.invite',{displayName:role,email,role,portfolioIds:[f.id]});staff[role]=await h.accept(email)
  }
  await h.command('operator.invite',{displayName:'Outside manager',email:mailbox('synthetic-terrace-outside'),role:'portfolio_manager',portfolioIds:[outside.id]})
  const outsideManager=await h.accept(mailbox('synthetic-terrace-outside'))
  const managerRow=(await json('/api/professional-referrals')).assignees.find(p=>p.display_name==='portfolio_manager')
  const create={decisionId:held.id,sourceRevision:held.sourceRevision,tenancyId:t.id,professional:'Synthetic counsel',reference:'synthetic-terrace-4 external handoff',responsibleId:managerRow.id,dueOn:'2026-10-25'}
  for(const role of ['leasing','bookkeeper','accountant','maintenance_coordinator','member']){
   assert.equal((await h.request('/api/professional-referrals',{as:staff[role]})).status,403)
   for(const command of ['referral.create','referral.response','referral.review'])await h.command(command,create,{as:staff[role],status:403})
   assert.ok(!(await(await h.request('/app?tab=rules',{as:staff[role]})).text()).includes('Synthetic counsel'))
  }
  await h.command('referral.create',create,{as:outsideManager,status:404})
  await h.command('referral.create',{...create,tenancyId:otherT.id},{status:404})
  await h.command('referral.create',{...create,responsibleId:'synthetic-terrace-missing'},{status:403})
  const created=await h.command('referral.create',create,{as:staff.portfolio_manager})
  const cases=async(as=h.cookie)=>(await json('/api/professional-referrals',as)).cases
  let r=(await cases())[0]
  assert.deepEqual([r.id,r.open,r.status,r.source_revision,r.responsible_name,r.due_on],[created.id,true,'awaiting_response',held.sourceRevision,'portfolio_manager','2026-10-25'])
  assert.equal(r.professional,'Synthetic counsel');assert.equal(r.reference,create.reference);assert.deepEqual(r.source.jurisdiction,{state:'CA',overlays:[],version:1})
  assert.equal((await cases(outsideManager)).length,0)
  assert.equal((await h.request('/api/professional-referrals?propertyId='+property.id,{as:outsideManager})).status,404)
  const baseline=await json('/api/rules'),ledger=await h.state(t.id),mailCount=h.messages.length
  const bytes=Buffer.from('synthetic-terrace-5 professional rejects the proposed action. Keep the hold.')
  const response=async(outcome,version,data=bytes,opts={})=>h.formCommand('referral.response',{referralId:r.id,sourceRevision:held.sourceRevision,version:String(version),outcome,reference:'synthetic-terrace-6 response source',file:new File([data],'response.txt',{type:'text/plain'})},opts)
  const rejected=await response('rejected',0,bytes,{as:staff.portfolio_manager})
  r=(await cases())[0];assert.deepEqual([r.open,r.status,r.responses[0].outcome],[true,'response_rejected','rejected'])
  assert.equal(r.responses[0].sha256,sha(bytes));assert.equal(r.responses[0].reference,'synthetic-terrace-6 response source')
  await response('received',0,Buffer.from('stale response'),{status:409})
  await h.command('referral.review',{referralId:r.id,responseId:rejected.id,consent:'APPROVE',nextAction:'Release action',reference:'synthetic-terrace-7'},{status:400})
  const goodBytes=Buffer.from('synthetic-terrace-8 documentary response requests further counsel review.')
  const received=await response('received',1,goodBytes)
  const review={referralId:r.id,responseId:received.id,consent:'RECORD ONLY',nextAction:'Ask counsel to review the missing entry rule; keep the action held',reference:'synthetic-terrace-9 staff review'}
  await h.command('referral.review',review,{as:staff.portfolio_manager})
  await h.command('referral.review',review,{status:409})
  r=(await cases())[0];assert.equal(r.status,'reviewed_record_only');assert.equal(r.open,true);assert.equal(r.responses[1].next_action,review.nextAction)
  assert.deepEqual(await json('/api/rules'),baseline,'response and review change no source decisions, rules or activations')
  assert.deepEqual((await h.state(t.id)).ledger,ledger.ledger,'no financial state changes')
  assert.equal(h.messages.length,mailCount,'referral recording sends nothing')
  for(const entry of [rejected,received]){
   const result=await h.request('/api/document?id='+entry.versionId,{as:staff.portfolio_manager})
   assert.equal(result.status,200);assert.match(result.headers.get('cache-control'),/private, no-store/)
   assert.equal(result.headers.get('x-document-sha256'),entry.sha256)
   assert.equal(sha(Buffer.from(await result.arrayBuffer())),entry.sha256)
   for(const as of [staff.leasing,staff.accountant,outsideManager])assert.equal((await h.request('/api/document?id='+entry.versionId,{as})).status,404)
  }
  await h.command('referral.response',{referralId:r.id},{as:outsideManager,status:404})
  await h.command('referral.review',review,{as:outsideManager,status:404})
  const found=(await json('/api/documents?q=synthetic-terrace-8')).documents
  assert.equal(found.length,1);assert.equal(found[0].versionId,received.versionId)
  assert.equal((await json('/api/documents?q=synthetic-terrace-8',staff.leasing)).documents.length,0)
  await h.formCommand('document.revise',{documentId:found[0].documentId,version:'1',source:'synthetic-terrace-10',file:new File(['replacement'],'response.txt',{type:'text/plain'})},{status:409})
  const before=await cases();await h.restart();assert.deepEqual(await cases(),before)
  if(inspect)await inspect({h,property,t,r,held,owner,managerRow})
  // A dated pack publication and then its independent activation each invalidate older applicability.
  const pack=await h.command('rules.pack',syntheticPack('CA'))
  r=(await cases()).find(x=>x.id===created.id);assert.equal(r.sourceCurrent,false);assert.equal(r.status,'source_changed');assert.ok(r.responses.every(x=>!x.applicable))
  await h.command('referral.review',{...review,responseId:rejected.id},{status:409})
  await h.command('referral.create',create,{status:409})
  const inactive=await preview(),draftCase=await h.command('referral.create',{...create,decisionId:inactive.id,sourceRevision:inactive.sourceRevision,responsibleId:owner})
  await h.command('rules.activate',{packId:pack.id,consent:'REVIEWED'})
  assert.equal((await cases()).find(x=>x.id===draftCase.id).sourceCurrent,false)
  const allowed=await preview();assert.equal(allowed.state,'reviewed_preview')
  await h.command('referral.create',{...create,decisionId:allowed.id,sourceRevision:allowed.sourceRevision},{status:409})
  const cap=await h.command('rules.preview',{propertyId:property.id,action:'renewal',on:'2026-10-20',currentRentCents:100000,proposedRentCents:120000,reviewedCpiBp:300,cpiSource:'synthetic-terrace-11'})
  const capCase=await h.command('referral.create',{...create,decisionId:cap.id,sourceRevision:cap.sourceRevision})
  await h.command('property.rules',{propertyId:property.id,stateCode:'CA',version:1,reference:'synthetic-terrace-12 jurisdiction re-review'})
  assert.equal((await cases()).find(x=>x.id===capCase.id).sourceCurrent,false)
  // A credential cannot read or record these sensitive originals, even before revocation.
  await h.stepUp();const credential=await h.command('credential.mint',{label:'synthetic-terrace-13',scope:'read',role:'portfolio_manager',portfolioIds:[f.id]})
  const headers={authorization:'Bearer '+credential.token}
  assert.equal((await h.request('/api/professional-referrals',{as:'',headers})).status,403)
  await h.command('credential.revoke',{credentialId:credential.id})
  assert.equal((await h.request('/api/professional-referrals',{as:'',headers})).status,401)
  const backup=await(await h.request('/api/backup')).text(),fresh=await installation()
  try{
   await fresh.formCommand('data.restore',{confirm:'RESTORE',backup:new File([backup],'referrals.rer')})
   assert.deepEqual((await(await fresh.request('/api/professional-referrals')).json()).cases,await cases())
   const original=await fresh.request('/api/document?id='+received.versionId)
   assert.deepEqual(Buffer.from(await original.arrayBuffer()),goodBytes)
   assert.equal((await fresh.request('/api/professional-referrals',{as:'',headers})).status,401,'restore grants no credential authority')
  }finally{await fresh.close()}
  const zip=Buffer.from(await(await h.request('/api/readable-export')).arrayBuffer()),entries=new Map()
  for(let o=0;zip.readUInt32LE(o)===0x04034b50;){const size=zip.readUInt32LE(o+18),n=zip.readUInt16LE(o+26),x=zip.readUInt16LE(o+28),name=zip.subarray(o+30,o+30+n).toString();entries.set(name,zip.subarray(o+30+n+x,o+30+n+x+size));o+=30+n+x+size}
  assert.deepEqual(entries.get('files/tt_document_versions/'+received.versionId+'.txt'),goodBytes)
  assert.ok(entries.get('tables/tt_professional_referrals.csv').toString().includes(create.reference))
  assert.ok(entries.get('tables/tt_professional_reviews.csv').toString().includes(review.nextAction))
  const history=(await json('/api/history')).rows
  for(const action of ['referral.create','referral.response','referral.review'])assert.ok(history.some(x=>x.action===action&&x.tenancyId===t.id))
  // Existing lease retention and legal holds protect originals; erasure fences both old archives and re-upload.
  const req=await h.command('privacy.request',{tenancyId:t.id,kind:'erase',source:'synthetic-terrace-14'}),hold=await h.command('privacy.hold',{tenancyId:t.id,class:'lease',reason:'synthetic-terrace-15 counsel hold'})
  let retained=await h.command('privacy.review',{tenancyId:t.id,requestId:req.id})
  await h.command('tenancy.erase',{tenancyId:t.id,requestId:req.id,fingerprint:retained.review.fingerprint,confirm:mailbox('synthetic-terrace-1')},{status:409})
  assert.equal((await h.request('/api/document?id='+received.versionId)).status,200)
  await h.command('privacy.release',{tenancyId:t.id,holdId:hold.id,reason:'synthetic-terrace-16'})
  retained=await h.command('privacy.review',{tenancyId:t.id,requestId:req.id});assert.equal(retained.review.eligible,true)
  await h.command('tenancy.erase',{tenancyId:t.id,requestId:req.id,fingerprint:retained.review.fingerprint,confirm:mailbox('synthetic-terrace-1')})
  assert.deepEqual(await cases(),[])
  assert.equal((await h.request('/api/document?id='+received.versionId)).status,404)
  const later=await(await h.request('/api/backup')).text()
  assert.ok(!later.includes(create.reference));assert.ok(!later.includes(review.nextAction))
  const destination=await installation()
  try{await destination.formCommand('data.restore',{confirm:'RESTORE',backup:new File([backup],'old.rer'),journal:new File([later],'later.rer')},{status:409})}finally{await destination.close()}
  await h.formCommand('document.upload',{tenancyId:otherT.id,kind:'lease',title:'Replayed original',source:'synthetic-terrace-17',file:new File([goodBytes],'response.txt',{type:'text/plain'})},{status:409})
  await h.command('referral.response',{referralId:created.id},{status:404})
 }finally{await h.close()}
}
