import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {installation,tenancyInput} from './api/harness.mjs'
const mailbox=n=>'synthetic-terrace-'+n+'@'+'example.test'
const sha=b=>createHash('sha256').update(b).digest('hex')
export async function journey({assets=false,inspect}={}){
 const h=await installation({assets,bufferedTransport:true,asyncDatabase:true,now:'2026-10-20T12:00:00.000Z'})
 try{
  const get=async(path='/api/shadow-runs')=>{const r=await h.request(path);assert.equal(r.status,200,await r.clone().text());return r.json()}
  const portfolio=await h.command('portfolio.add',{name:'Synthetic rent portfolio'}),property=await h.command('property.add',{portfolioId:portfolio.id,name:'Synthetic shadow property',address:'1 Synthetic Terrace Road',kind:'multifamily',timeZone:'America/Los_Angeles'})
  const leases=[]
  for(const [i,name]of ['Alex Synthetic','Blair Synthetic','Casey Synthetic'].entries()){
   const unit=await h.command('unit.add',{propertyId:property.id,identifier:String(i+1),bedrooms:2,bathrooms:1,amenities:'',rentable:true})
   leases.push(await h.command('tenancy.create',{...tenancyInput,unitId:unit.id,tenantName:name,tenantEmail:mailbox(i),startDate:'2026-01-01',endDate:'2026-12-31'}))
  }
  const charge=(i,day,amount,ref)=>h.command('rent.charge',{tenancyId:leases[i].id,dueDate:day,amount,description:'Recorded rent',reference:ref})
  await charge(0,'2026-09-01','20.00','synthetic-terrace-4')
  const a=await charge(0,'2026-10-01','100.00','synthetic-terrace-5'),b=await charge(1,'2026-10-01','100.00','synthetic-terrace-6')
  await charge(2,'2026-10-01','50.00','synthetic-terrace-7')
  await h.command('rent.receipt',{chargeId:a.id,amount:'40.00',receivedDate:'2026-10-02',reference:'synthetic-terrace-8',method:'cash'})
  await h.command('rent.receipt',{chargeId:b.id,amount:'100.00',receivedDate:'2026-10-02',reference:'synthetic-terrace-9',method:'cash'})
  await h.command('rent.adjust',{chargeId:a.id,amount:'10.00',reason:'synthetic-terrace-10 reduction'})
  await h.command('term.add',{tenancyId:leases[0].id,kind:'rent',description:'Future rent',amount:'100.00',starts:'2026-11-01'})
  const rows=[
   {sourceRef:'synthetic-terrace-11',tenancyId:leases[0].id,currency:'USD',openingCents:2000,chargesCents:10000,receiptsCents:4000,reductionsCents:1000,closingCents:7000},
   {sourceRef:'synthetic-terrace-12',tenancyId:leases[1].id,currency:'USD',openingCents:0,chargesCents:10000,receiptsCents:10000,reductionsCents:0,closingCents:0},
   {sourceRef:'synthetic-terrace-13',tenancyId:leases[2].id,currency:'USD',openingCents:0,chargesCents:5000,receiptsCents:0,reductionsCents:0,closingCents:5000}
  ]
  const original=Buffer.from('Explicitly synthetic source statement original. synthetic-terrace-14\nNot an authentic incumbent statement.\n')
  const capture=async(sourceRows,bytes=original,replacesId,opts={})=>h.formCommand('shadow.capture',{propertyId:property.id,from:'2026-10-01',to:'2026-10-31',reference:'synthetic-terrace-15 source statement',synthetic:'yes',rows:JSON.stringify(sourceRows),file:new File([bytes],'synthetic-statement.txt',{type:'text/plain'}),...(replacesId?{replacesId}:{})},opts)
  const financial=async()=>Object.fromEntries(await Promise.all(['tt_charges','tt_receipts','tt_adjustments','tt_journal','tt_lease_terms','tt_schedules','tt_payments','tt_card_payments','tt_card_events','tt_workflow_runs'].map(async table=>[table,(await h.db.prepare('SELECT * FROM '+table+' ORDER BY rowid').all()).results])))
  const before=await financial(),mailBefore=h.messages.length
  const offset=structuredClone(rows.slice(0,2));offset[0].chargesCents+=100;offset[0].closingCents+=100;offset[1].chargesCents-=100;offset[1].closingCents-=100
  const first=await capture(offset),run=async id=>(await get()).runs.find(r=>r.id===id)
  let r=await run(first.id)
  assert.equal(r.matched,false,'offsetting differences never become a match')
  assert.deepEqual(r.lines.map(l=>l.differences.closingCents),[-100,100])
  assert.ok(r.issues.some(i=>i.key==='lease:'+leases[2].id),'an omitted native lease stays an open source mapping')
  assert.deepEqual(r.lines[0].native.events.map(e=>[e.kind,e.chargeCents,e.receiptCents,e.adjustmentCents]),[['Charge',10000,0,0],['Recorded external receipt',0,4000,0],['Charge reduction',0,0,1000]])
  assert.equal(new Date(r.lines[0].native.startsAt).toISOString(),'2026-10-01T07:00:00.000Z')
  const review={runId:first.id,fingerprint:r.fingerprint,consent:'RECORD ONLY',reference:'synthetic-terrace-16 reviewed differences'}
  await h.command('shadow.review',review,{status:409})
  const owner=(await get()).people[0]
  for(const issue of r.issues)await h.command('shadow.action',{runId:r.id,issueKey:issue.key,responsibleId:owner.id,dueOn:'2026-10-25',nextAction:'Ask source preparer to correct '+issue.key})
  await h.command('shadow.review',review)
  r=await run(first.id);assert.equal(r.status,'reviewed_held');assert.equal(r.review.result,'held')
  assert.ok(r.issues.every(i=>r.actions.some(a=>a.issue_key===i.key&&a.responsible_id===owner.id&&a.due_on==='2026-10-25')))
  const source=await h.request('/api/shadow-original?id='+first.id)
  assert.equal(source.status,200);assert.match(source.headers.get('cache-control'),/private, no-store/);assert.equal(source.headers.get('x-source-sha256'),sha(original));assert.deepEqual(Buffer.from(await source.arrayBuffer()),original)
  const duplicates=structuredClone(rows);duplicates[1].sourceRef=duplicates[0].sourceRef;duplicates[1].tenancyId=duplicates[0].tenancyId;duplicates[0].currency='AUD';duplicates[2].tenancyId=null
  const duplicate=await capture(duplicates,original,first.id),d=await run(duplicate.id)
  assert.equal(d.matched,false);assert.ok(d.issues.some(i=>i.key.endsWith(':duplicate-source')));assert.ok(d.issues.some(i=>i.key.endsWith(':duplicate-lease')));assert.ok(d.issues.some(i=>i.key.endsWith(':unmapped')))
  assert.deepEqual(Object.values(d.lines[0].differences),[null,null,null,null,null],'different currencies never net or reconcile')
  assert.equal((await run(first.id)).sourceCurrent,false);assert.equal((await run(first.id)).review.result,'held','prior evidence is retained')
  await h.command('shadow.review',review,{status:409})
  let correctedBytes=Buffer.from('Explicitly synthetic CORRECTED original. synthetic-terrace-17\n')
  const corrected=await capture(rows,correctedBytes,duplicate.id);r=await run(corrected.id)
  assert.equal(r.matched,true);assert.equal(r.review,null,'corrected source needs its own exact review')
  await h.command('shadow.review',{...review,runId:r.id},{status:409})
  await h.command('shadow.review',{...review,runId:r.id,fingerprint:r.fingerprint})
  assert.equal((await run(r.id)).status,'reviewed_match')
  const priorExact=r,priorBytes=correctedBytes
  correctedBytes=Buffer.from('Explicitly synthetic REISSUED original. synthetic-terrace-29\n')
  const reissued=await capture(rows,correctedBytes,priorExact.id);r=await run(reissued.id)
  assert.equal(r.matched,true);assert.equal(r.review,null)
  assert.notEqual(r.sourceSha256,sha(priorBytes));assert.notEqual(r.fingerprint,priorExact.fingerprint,'different source bytes alone change the exact review')
  assert.equal((await run(priorExact.id)).sourceCurrent,false)
  assert.equal((await run(priorExact.id)).review.result,'matched','prior exact review remains historical evidence')
  await h.command('shadow.review',{...review,runId:r.id,fingerprint:priorExact.fingerprint},{status:409})
  await h.command('shadow.review',{...review,runId:r.id,fingerprint:r.fingerprint})
  assert.deepEqual(Buffer.from(await(await h.request('/api/shadow-original?id='+priorExact.id)).arrayBuffer()),priorBytes,'the prior source original remains exact')
  assert.deepEqual(Buffer.from(await(await h.request('/api/shadow-original?id='+first.id)).arrayBuffer()),original,'the first held source original remains exact')
  assert.deepEqual(await financial(),before,'documentary recording changes no money, schedule or provider state');assert.equal(h.messages.length,mailBefore,'no outbound sends')
  await h.restart();assert.equal((await run(r.id)).status,'reviewed_match','review survives an actual Worker restart')
  // Existing sign-ins and credentials cannot acquire the owner documentary door.
  await h.stepUp()
  await h.command('operator.invite',{displayName:'Synthetic manager',email:mailbox(18),role:'portfolio_manager',portfolioIds:[portfolio.id]})
  const manager=await h.accept(mailbox(18))
  for(const path of ['/api/shadow-runs','/api/shadow-original?id='+r.id,'/app?tab=shadow'])assert.equal((await h.request(path,{as:manager})).status,403)
  await capture(rows,correctedBytes,r.id,{as:manager,status:403})
  for(const command of ['shadow.action','shadow.review'])await h.command(command,{runId:r.id},{as:manager,status:403})
  const credential=await h.command('credential.mint',{label:'synthetic-terrace-19',scope:'prepare',role:'portfolio_manager',portfolioIds:[portfolio.id]}),headers={authorization:'Bearer '+credential.token,'idempotency-key':'synthetic-terrace-20'}
  for(const path of ['/api/shadow-runs','/api/shadow-original?id='+r.id])assert.equal((await h.request(path,{as:'',headers})).status,403)
  await h.command('shadow.review',{runId:r.id},{as:'',headers,status:403})
  await h.command('credential.revoke',{credentialId:credential.id})
  assert.equal((await h.request('/api/shadow-runs',{as:'',headers})).status,401)
  assert.deepEqual(await financial(),before,'refused staff and credential operations change no money, schedule or provider state')
  assert.equal((await get()).runs.length,4,'refused operations create no comparison evidence')
  if(inspect)await inspect({h,property,leases,rows,correctedBytes,runId:r.id,owner})
  const captures=(await h.db.prepare('SELECT COUNT(*) AS n FROM tt_shadow_runs').first()).n
  // A native event invalidates the exact prior review even if source bytes stay unchanged.
  await h.command('rent.receipt',{chargeId:a.id,amount:'1.00',receivedDate:'2026-10-03',reference:'synthetic-terrace-21',method:'cash'})
  assert.equal((await run(r.id)).status,'native_changed')
  await h.command('shadow.action',{runId:r.id,issueKey:'row:0:receiptsCents',responsibleId:owner.id,dueOn:'2026-10-25',nextAction:'Reconcile new receipt'},{status:409})
  await h.command('shadow.review',{...review,runId:r.id,fingerprint:r.fingerprint},{status:409})
  const currentRows=structuredClone(rows);currentRows[0].receiptsCents+=100;currentRows[0].closingCents-=100
  const recaptured=await capture(currentRows,correctedBytes,r.id);r=await run(recaptured.id)
  await h.command('shadow.review',{...review,runId:r.id,fingerprint:r.fingerprint})
  assert.equal((await run(r.id)).status,'reviewed_match')
  const openingBefore=r.lines[0].native.openingCents,revisionBefore=r.lines[0].native.financialRevision
  const oldCharge=await charge(0,'2026-09-03','1.00','synthetic-terrace-30')
  await h.command('rent.receipt',{chargeId:oldCharge.id,amount:'1.00',receivedDate:'2026-09-03',reference:'synthetic-terrace-31',method:'cash'})
  const offsetHistory=await run(r.id)
  assert.equal(offsetHistory.lines[0].native.openingCents,openingBefore,'the retained opening evidence remains exact')
  assert.equal(offsetHistory.matched,true,'the retained comparison amounts still match')
  assert.equal(offsetHistory.status,'native_changed','offsetting native events before the period invalidate the previous exact review')
  const refreshed=await capture(currentRows,correctedBytes,r.id),freshSnapshot=await run(refreshed.id)
  assert.equal(freshSnapshot.lines[0].native.openingCents,openingBefore,'offsetting earlier events leave the current opening total unchanged')
  assert.notEqual(freshSnapshot.lines[0].native.financialRevision,revisionBefore,'the independent event watermark detects changed native evidence')
  r=await run(refreshed.id)
  await h.command('shadow.review',{...review,runId:r.id,fingerprint:r.fingerprint})
  const backup=await(await h.request('/api/backup')).text(),fresh=await installation({bufferedTransport:true,asyncDatabase:true,now:'2026-10-20T12:00:00.000Z'})
  try{
   await fresh.formCommand('data.restore',{confirm:'RESTORE',backup:new File([backup],'shadow.rer')})
   const restored=await(await fresh.request('/api/shadow-runs')).json(),copy=restored.runs.find(v=>v.id===r.id)
   assert.equal(copy.inert,true);assert.equal(copy.review.result,'matched')
   assert.deepEqual(Buffer.from(await(await fresh.request('/api/shadow-original?id='+r.id)).arrayBuffer()),correctedBytes)
   await fresh.command('shadow.review',{...review,runId:r.id,fingerprint:r.fingerprint},{status:409})
   const saved=await financial()
   assert.deepEqual((await fresh.state(leases[0].id)).ledger.receipts.map(x=>x.amount_cents).sort((a,b)=>a-b),[100,100,4000])
   assert.deepEqual(await financial(),saved)
   assert.equal((await fresh.request('/api/shadow-runs',{as:'',headers})).status,401)
  }finally{await fresh.close()}
  const zip=Buffer.from(await(await h.request('/api/readable-export')).arrayBuffer()),files=new Map()
  for(let at=0;zip.readUInt32LE(at)===0x04034b50;){const size=zip.readUInt32LE(at+18),n=zip.readUInt16LE(at+26),x=zip.readUInt16LE(at+28),name=zip.subarray(at+30,at+30+n).toString();files.set(name,zip.subarray(at+30+n+x,at+30+n+x+size));at+=30+n+x+size}
  assert.deepEqual(files.get('files/tt_shadow_runs/'+r.id+'.txt'),correctedBytes)
  assert.ok(files.get('tables/tt_shadow_reviews.csv').toString().includes('synthetic-terrace-16'))
  const history=await get('/api/history');for(const action of ['shadow.capture','shadow.action','shadow.review'])assert.ok(history.rows.some(x=>x.action===action))
  // Accounting retention and a peer's legal hold protect shared statement bytes.
  let req=await h.command('privacy.request',{tenancyId:leases[0].id,kind:'erase',source:'synthetic-terrace-22'})
  let retention=await h.command('privacy.review',{tenancyId:leases[0].id,requestId:req.id})
  assert.ok(retention.review.classes.find(x=>x.class==='accounting').retained)
  await h.command('tenancy.erase',{tenancyId:leases[0].id,requestId:req.id,fingerprint:retention.review.fingerprint,confirm:mailbox(0)},{status:409})
  await h.setTime('2045-01-01T12:00:00.000Z')
  const hold=await h.command('privacy.hold',{tenancyId:leases[1].id,class:'accounting',reason:'synthetic-terrace-23 shared statement hold'})
  retention=await h.command('privacy.review',{tenancyId:leases[0].id,requestId:req.id})
  assert.ok(retention.review.kept.some(k=>k.reasons.some(s=>s.includes('Shared shadow'))))
  await h.command('tenancy.erase',{tenancyId:leases[0].id,requestId:req.id,fingerprint:retention.review.fingerprint,confirm:mailbox(0)})
  assert.equal((await h.request('/api/shadow-original?id='+r.id)).status,404,'retired personal custody cannot expose originals while accounting hold retains them')
  assert.equal((await h.db.prepare('SELECT COUNT(*) AS n FROM tt_shadow_runs').first()).n,captures+2,'peer hold keeps the shared originals')
  await h.command('privacy.release',{tenancyId:leases[1].id,holdId:hold.id,reason:'synthetic-terrace-24'})
  req=await h.command('privacy.request',{tenancyId:leases[0].id,kind:'erase',source:'synthetic-terrace-25'})
  retention=await h.command('privacy.review',{tenancyId:leases[0].id,requestId:req.id})
  await h.command('tenancy.erase',{tenancyId:leases[0].id,requestId:req.id,fingerprint:retention.review.fingerprint,confirm:mailbox(0)})
  assert.equal((await h.db.prepare('SELECT COUNT(*) AS n FROM tt_shadow_runs').first()).n,0)
  assert.equal((await get()).runs.length,0)
  const later=await(await h.request('/api/backup')).text()
  assert.ok(!later.includes('synthetic-terrace-15 source statement'));assert.ok(!later.includes('Ask source preparer'))
  const target=await installation({bufferedTransport:true,asyncDatabase:true,now:'2045-01-01T12:00:00.000Z'})
  try{await target.formCommand('data.restore',{confirm:'RESTORE',backup:new File([backup],'old.rer'),journal:new File([later],'later.rer')},{status:409})}finally{await target.close()}
  await capture(rows.slice(1),original,undefined,{status:409})
  assert.equal((await h.request('/api/shadow-original?id='+first.id)).status,404)
 }finally{await h.close()}
 await correctionsJourney()
}

// Ordinary financial activity must remain comparable independently of lease dates and retired custody.
export async function correctionsJourney({finding='all'}={}){
 if(finding==='all'){for(const part of ['advance','signed','retired'])await correctionsJourney({finding:part});return}
 const h=await installation({bufferedTransport:true,asyncDatabase:true,now:'2026-10-20T12:00:00.000Z'})
 try{
  const portfolio=await h.command('portfolio.add',{name:'Synthetic corrected comparison portfolio'})
  const property=await h.command('property.add',{portfolioId:portfolio.id,name:'Synthetic corrected comparison property',address:'2 Synthetic Terrace Road',kind:'multifamily',timeZone:'America/Los_Angeles'})
  const lease=async(n,startDate='2026-01-01',endDate='2027-06-30')=>{
   const unit=await h.command('unit.add',{propertyId:property.id,identifier:String(n),bedrooms:1,bathrooms:1})
   return h.command('tenancy.create',{...tenancyInput,unitId:unit.id,tenantName:'Synthetic resident '+n,tenantEmail:mailbox(n),startDate,endDate,rent:'1000.00',cadence:'monthly'})
  }
  const row=(t,n,values={})=>({sourceRef:'synthetic-terrace-'+n,tenancyId:t.id,currency:'USD',openingCents:0,chargesCents:0,receiptsCents:0,reductionsCents:0,closingCents:0,...values})
  const capture=(rows,n,replacesId,opts={})=>h.formCommand('shadow.capture',{propertyId:property.id,from:'2026-10-01',to:'2026-10-31',reference:'synthetic-terrace-'+n,synthetic:'yes',rows:JSON.stringify(rows),file:new File(['Explicitly synthetic original synthetic-terrace-'+n],'synthetic-terrace-'+n+'.txt'),...(replacesId?{replacesId}:{})},opts)
  const data=async()=>{const r=await h.request('/api/shadow-runs');assert.equal(r.status,200);return r.json()}
  const run=async id=>(await data()).runs.find(r=>r.id===id)
  const review=async r=>{assert.equal(r.matched,true);await h.command('shadow.review',{runId:r.id,fingerprint:r.fingerprint,consent:'RECORD ONLY',reference:'synthetic-terrace-50'});assert.equal((await run(r.id)).status,'reviewed_match')}
  if(finding==='advance'){
   const current=await lease(51),future=await lease(52,'2026-11-01')
   const first=await capture([row(current,53)],54);await review(await run(first.id))
   const charge=await h.command('rent.charge',{tenancyId:future.id,dueDate:'2026-11-01',amount:'100.00',description:'Advance rent',reference:'synthetic-terrace-55'})
   await h.command('rent.receipt',{chargeId:charge.id,amount:'100.00',receivedDate:'2026-10-20',reference:'synthetic-terrace-56',method:'cash'})
   assert.equal((await run(first.id)).status,'native_changed','October advance rent on a November lease invalidates the previous review')
   const missing=await capture([row(current,53)],57,first.id),held=await run(missing.id)
   assert.equal(held.matched,false);assert.ok(held.issues.some(i=>i.key==='lease:'+future.id),'advance rent requires a separate source mapping')
   const corrected=await capture([row(current,53),row(future,58,{receiptsCents:10000,closingCents:-10000})],59,missing.id),r=await run(corrected.id)
   const advance=r.lines.find(l=>l.source.tenancyId===future.id)
   assert.deepEqual([advance.native.openingCents,advance.native.chargesCents,advance.native.receiptsCents,advance.native.closingCents],[0,0,10000,-10000])
   assert.equal(advance.native.events[0].kind,'Recorded external receipt');await review(r)
  }else if(finding==='signed'){
   const t=await lease(60,'2026-07-01'),manager=await h.invite('admin',mailbox(61))
   const owner=await h.command('owner.add',{kind:'individual',legalName:'Synthetic corrected comparison owner',email:mailbox(62),mailingAddress:'2 Synthetic Terrace Road'})
   await h.command('ownership.set',{propertyId:property.id,effectiveFrom:'2026-01-01',reason:'synthetic-terrace-63',shares:[{ownerId:owner.id,percent:'100'}]})
   const {leaseFields}=await import('./leases.mjs'),signed=leaseFields(t.id,'2026-07-01','1000.00','0','0','synthetic-terrace-64')
   signed.terms=signed.terms.filter(x=>x.kind==='rent')
   Object.assign(signed.obligations.find(x=>x.kind==='hap'),{details:'Synthetic HAP contract',housingAuthority:'Synthetic Housing Authority',reference:'synthetic-terrace-65',tenantPortion:'300.00',hapPortion:'700.00'})
   const prepared=await h.command('lease.prepare',signed),preview=await h.command('lease.preview',{leaseId:prepared.leaseId,month:'2026-07'})
   await h.command('lease.approve',{leaseId:prepared.leaseId,month:'2026-07',fingerprint:preview.fingerprint},{as:manager})
   for(const month of ['2026-07','2026-08','2026-09']){const q=await h.command('charges.preview',{month});await h.command('charges.post',{month,fingerprint:q.fingerprint})}
   const first=await capture([row(t,66,{openingCents:90000,closingCents:90000})],67);await review(await run(first.id))
   const source=await h.command('document.upload',{tenancyId:t.id,kind:'hap',title:'Synthetic resident portion correction',source:'synthetic-terrace-68',file:{name:'synthetic-terrace-68.txt',type:'text/plain',base64:Buffer.from('Explicitly synthetic PHA notice synthetic-terrace-68').toString('base64')}})
   const change=await h.command('hap.change.prepare',{tenancyId:t.id,kind:'split',effectiveFrom:'2026-07-01',effectiveTo:'2026-09-30',residentPortion:'200.00',phaPortion:'800.00',payer:'Synthetic Housing Authority',noticeVersionId:source.versionId,reason:'Synthetic three-month resident rent reduction',reference:'synthetic-terrace-69'})
   const exact=await h.command('hap.change.preview',{changeId:change.changeId});await h.command('hap.change.approve',{changeId:change.changeId,fingerprint:exact.fingerprint},{as:manager})
   assert.equal((await run(first.id)).status,'native_changed')
   const corrected=await capture([row(t,66,{openingCents:90000,chargesCents:-30000,closingCents:60000})],70,first.id),r=await run(corrected.id)
   assert.deepEqual(r.lines[0].native.events.map(e=>e.chargeCents),[-10000,-10000,-10000])
   assert.equal(r.lines[0].native.chargesCents,-30000);assert.equal(r.lines[0].native.closingCents,60000)
   assert.deepEqual(Object.values(r.lines[0].differences),[0,0,0,0,0]);await review(r)
  }else if(finding==='retired'){
   const former=await lease(71,'2016-01-01','2016-12-31'),current=await lease(72)
   await h.command('rent.charge',{tenancyId:former.id,dueDate:'2016-12-01',amount:'10.00',description:'Retained rent',reference:'synthetic-terrace-73'})
   const rows=[row(former,74,{openingCents:1000,closingCents:1000}),row(current,75)]
   const first=await capture(rows,76);await review(await run(first.id))
   await h.command('privacy.hold',{tenancyId:former.id,class:'accounting',reason:'synthetic-terrace-77'})
   const request=await h.command('privacy.request',{tenancyId:former.id,kind:'erase',source:'synthetic-terrace-78'}),retention=await h.command('privacy.review',{tenancyId:former.id,requestId:request.id})
   assert.equal(retention.review.eligible,true);assert.equal(retention.review.personalRetained,true)
   await h.command('tenancy.erase',{tenancyId:former.id,requestId:request.id,fingerprint:retention.review.fingerprint,confirm:mailbox(71)})
   const retained=await h.db.prepare('SELECT * FROM tt_shadow_runs WHERE id=?').bind(first.id).first()
   assert.equal(Buffer.from(retained.original).toString(),'Explicitly synthetic original synthetic-terrace-76')
   assert.equal((await h.request('/api/shadow-original?id='+first.id)).status,404);assert.equal((await data()).runs.length,0)
   await capture([rows[1]],79,first.id,{status:404})
   const fresh=await capture([rows[1]],80),r=await run(fresh.id)
   assert.notEqual(r.seriesId,first.id,'fresh personal custody starts a separate comparison series')
   assert.deepEqual(r.snapshot.leases.map(t=>t.tenancyId),[current.id]);await review(r)
   const publicData=JSON.stringify(await data());assert.ok(!publicData.includes(first.id));assert.ok(!publicData.includes(former.id));assert.ok(!publicData.includes('synthetic-terrace-76'))
   assert.equal((await h.request('/api/shadow-original?id='+first.id)).status,404,'a fresh comparison cannot reopen retired originals')
   await h.restart();assert.equal((await run(fresh.id)).status,'reviewed_match')
   assert.equal((await h.db.prepare('SELECT result FROM tt_shadow_reviews WHERE run_id=?').bind(first.id).first()).result,'matched','prior review remains in retained accounting custody')
  }
 }finally{await h.close()}
}
