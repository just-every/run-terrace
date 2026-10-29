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
  const backup=await(await h.request('/api/backup')).text(),fresh=await installation({bufferedTransport:true,asyncDatabase:true,now:'2026-10-20T12:00:00.000Z'})
  try{
   await fresh.formCommand('data.restore',{confirm:'RESTORE',backup:new File([backup],'shadow.rer')})
   const restored=await(await fresh.request('/api/shadow-runs')).json(),copy=restored.runs.find(v=>v.id===r.id)
   assert.equal(copy.inert,true);assert.equal(copy.review.result,'matched')
   assert.deepEqual(Buffer.from(await(await fresh.request('/api/shadow-original?id='+r.id)).arrayBuffer()),correctedBytes)
   await fresh.command('shadow.review',{...review,runId:r.id,fingerprint:r.fingerprint},{status:409})
   const saved=await financial()
   assert.deepEqual((await fresh.state(leases[0].id)).ledger.receipts.map(x=>x.amount_cents).sort((a,b)=>a-b),[100,4000])
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
  assert.equal((await h.db.prepare('SELECT COUNT(*) AS n FROM tt_shadow_runs').first()).n,captures,'peer hold keeps the shared originals')
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
}
