import assert from 'node:assert/strict'
import {installation,tenancyInput} from './api/harness.mjs'
export async function journey({assets=false,inspect}={}){
 const r=await installation({assets,now:'2026-10-27T16:00:00.000Z'})
 try{
  await r.stepUp()
  const north=await r.command('portfolio.add',{name:'North'}),south=await r.command('portfolio.add',{name:'South'})
  const properties=[];const tenants=[];const grants=[];const cookies=[]
  for(let i=0;i<3;i++){
   const p=i===1?properties[0]:await r.command('property.add',{portfolioId:i===2?south.id:north.id,name:i===2?'Cedar House':'Alder House',address:'Synthetic property '+i+', Oakland, CA',kind:'duplex',timeZone:'America/Los_Angeles'});properties.push(p)
   const u=await r.command('unit.add',{propertyId:p.id,identifier:String(i+1),bedrooms:'2',bathrooms:'1'})
   const t=await r.command('tenancy.create',{...tenancyInput,address:'Synthetic home '+i+', Oakland, CA',unitId:u.id,tenantEmail:`resident${i}@example.test`});tenants.push(t)
   grants.push(await r.command('portal.invite',{kind:'resident',tenancyId:t.id,email:`resident${i}@example.test`,displayName:'Resident '+i,source:'Synthetic explicit portal consent'}));cookies.push(await r.portalSignIn(`resident${i}@example.test`))
  }
  const staff={};for(const [key,role,p] of [['manager','portfolio_manager',north.id],['south','portfolio_manager',south.id],['member','member',north.id]]){await r.command('operator.invite',{displayName:key,email:key+'@example.test',role,portfolioIds:[p]});staff[key]=await r.accept(key+'@example.test')}
  const t=tenants[0],create=(extra={},opts={})=>r.command('thread.create',{tenancyId:t.id,grantId:grants[0].grantId,kind:'conversation',subject:'Kitchen repair conversation',body:'Please confirm the kitchen repair details.',deadline:'2026-11-01',consentReference:'Synthetic explicit channel permission for named recipients',...extra},opts)
  const data=async(id,as=r.cookie)=>{const res=await r.request('/api/threads?id='+id,{as});assert.equal(res.status,200,await res.clone().text());return(await res.json()).threads[0]}
  const mutate=async(command,id,extra={},opts={})=>{const d=await data(id);return r.command('thread.'+command,{threadId:id,version:d.version,fingerprint:d.fingerprint,...extra},opts)}
  const shared=async(cookie,id)=>{const res=await r.request('/portal/api/threads'+(id?'?id='+id:''),{as:cookie});assert.equal(res.status,200,await res.clone().text());return(await res.json()).threads}
  await create({}, {as:staff.member,status:403});
  const oldProof=Date.now()-20*60000;await r.db.prepare("UPDATE oa_sessions SET created_at=? WHERE operator_id IN (SELECT id FROM oa_operators WHERE email='manager@example.test')").bind(oldProof).run();
  await create({}, {as:staff.manager,status:403});await r.stepUp('manager@example.test',staff.manager);await r.stepUp('south@example.test',staff.south)
  await create({}, {as:staff.south,status:404})
  const thread=await create({}, {as:staff.manager})
  for(const path of ['/api/threads?id='+thread.id,'/app?tab=messages&tenancy='+t.id]){assert.equal((await r.request(path,{as:staff.south})).status,404);assert.equal((await r.request(path,{as:staff.member})).status,403)}
  assert.deepEqual((await(await r.request('/api/threads?q=kitchen',{as:staff.south})).json()).threads,[])
  assert.deepEqual(await shared(cookies[0]),[],'prepared content is hidden')
  await mutate('approve',thread.id,{fingerprint:'synthetic-terrace-1',consent:'APPROVE EXACT MESSAGE',reference:'Synthetic permission'},{status:409})
  await mutate('approve',thread.id,{consent:'APPROVE EXACT MESSAGE',reference:'Synthetic explicit recipient and content consent'})
  await mutate('assign',thread.id,{assignedTo:(await r.db.prepare("SELECT id FROM oa_operators WHERE email='south@example.test'").first()).id,deadline:'2026-11-02'},{status:400})
  const manager=(await r.db.prepare("SELECT id FROM oa_operators WHERE email='manager@example.test'").first()).id
  await mutate('assign',thread.id,{assignedTo:manager,deadline:'2026-11-02'})
  assert.equal((await data(thread.id)).assigned_to,manager);assert.equal((await data(thread.id)).deadline,'2026-11-02')
  const note=await data(thread.id)
  await r.formCommand('thread.reply',{threadId:thread.id,version:note.version,private:'1',body:'PRIVATE STAFF NOTE: manager follow-up only',file:new File(['Synthetic private original'],'private.txt',{type:'text/plain'})})
  let current=await data(thread.id);const privateEntry=current.entries.at(-1)
  assert.equal(await(await r.request('/api/thread-file?id='+privateEntry.id)).text(),'Synthetic private original')
  assert.equal((await r.request('/api/thread-file?id='+privateEntry.id,{as:staff.south})).status,404)
  assert.equal((await r.request('/portal/thread-file?id='+privateEntry.id,{as:cookies[0]})).status,404)
  let visible=await shared(cookies[0],thread.id);assert.equal(visible[0].entries.length,1);assert.ok(!JSON.stringify(visible).includes('PRIVATE STAFF NOTE'));assert.deepEqual((await(await r.request('/portal/api/threads?q=PRIVATE%20STAFF%20NOTE',{as:cookies[0]})).json()).threads,[]);assert.equal((await(await r.request('/api/threads?q=PRIVATE%20STAFF%20NOTE')).json()).threads.length,1)
  await mutate('reply',thread.id,{private:'0',body:'Public repair instructions',consent:'SHARE EXACT MESSAGE'})
  current=await data(thread.id)
  await r.formCommand('thread.reply',{threadId:thread.id,version:current.version,private:'0',body:'Attached repair instructions',consent:'SHARE EXACT MESSAGE',file:new File(['Synthetic public original'],'instructions.txt',{type:'text/plain'})})
  visible=await shared(cookies[0],thread.id);const publicEntry=visible[0].entries.at(-1)
  assert.equal(await(await r.request('/portal/thread-file?id='+publicEntry.id,{as:cookies[0]})).text(),'Synthetic public original')
  assert.equal((await r.request('/portal/thread-file?id='+publicEntry.id,{as:cookies[2]})).status,404)
  const portalPost=(fields={},opts={})=>r.request('/portal/api/threads',{method:'POST',as:cookies[0],form:new URLSearchParams({threadId:thread.id,version:String(visible[0].version),body:'Resident confirms repair details',consent:'SHARE EXACT MESSAGE',...fields}),...opts})
  assert.equal((await portalPost({}, {originHeader:'https://elsewhere.test'})).status,403)
  const answered=await portalPost();assert.equal(answered.status,200,await answered.clone().text())
  assert.equal((await portalPost()).status,409,'stale reply retry cannot duplicate content')
  current=await data(thread.id);assert.equal(current.unread,true)
  await mutate('readmark',thread.id);assert.equal((await data(thread.id)).unread,false)
  const beforeOpen=(await shared(cookies[0],thread.id))[0];assert.equal(beforeOpen.unread,true)
  await r.request('/portal/threads',{as:cookies[0]});assert.equal((await shared(cookies[0],thread.id))[0].unread,true,'opens have no completion or read side effect')
  assert.equal((await portalPost({version:String(current.version),action:'read'})).status,200);assert.equal((await shared(cookies[0],thread.id))[0].unread,false)
  const batch=await create({kind:'broadcast',subject:'Water shutoff',body:'Water off in Alder House 10 to 11 tomorrow.'});assert.equal(batch.ids.length,2)
  for(const [i,id]of batch.ids.entries()){
   await mutate('approve',id,{consent:'APPROVE EXACT MESSAGE',reference:'Synthetic building recipient consent and exact content'})
   await mutate('service',id,{outcome:i?'failed':'delivered',method:'Staff recorded hand delivery',reference:'Synthetic named staff receipt '+i,servedAt:'2026-10-27',consent:'RECORD EVIDENCE'})
  }
  assert.deepEqual(await Promise.all(batch.ids.map(async id=>(await data(id)).service.outcome)),['delivered','failed']);const summary=await(await r.request('/api/threads?tenancyId='+t.id)).json();assert.deepEqual(summary.announcements.map(a=>a.service.outcome).sort(),['delivered','failed']);assert.deepEqual((await(await r.request('/api/threads',{as:staff.south})).json()).announcements,[])
  assert.equal((await shared(cookies[0])).some(x=>x.subject==='Water shutoff'),true);assert.equal((await shared(cookies[1])).some(x=>x.subject==='Water shutoff'),true);assert.deepEqual(await shared(cookies[2]),[])
  const owner=await r.command('owner.add',{kind:'individual',legalName:'Rowan Ellis',email:'rowan@example.test',mailingAddress:'Synthetic owner address'})
  await r.command('ownership.set',{propertyId:properties[0].id,effectiveFrom:'2026-01-01',reason:'Synthetic ownership',shares:[{ownerId:owner.id,percent:'100'}]})
  const ownerGrant=await r.command('portal.invite',{kind:'owner',ownerId:owner.id,email:'rowan@example.test',displayName:'Rowan Ellis',source:'Synthetic explicit consent'})
  const ownerCookie=await r.portalSignIn('rowan@example.test')
  const vendor=await r.command('vendor.add',{name:'River Plumbing',email:'river@example.test',phone:'510-555-0190',specialties:'plumbing',serviceAreas:'Oakland',w9:'received',insuranceExpires:'2036-12-31',licenseNumber:'synthetic-terrace-2',licenseExpires:'2036-12-31',availability:'Weekdays',rate:'95',standing:'approved'})
  const job=await r.command('maintenance.prepare',{tenancyId:t.id,title:'Kitchen valve',vendorId:vendor.id,trade:'plumbing',dueDate:'2026-11-20',estimate:'180.00'});await r.command('maintenance.approve',{jobId:job.id,version:1},{as:staff.manager})
  const vendorGrant=await r.command('portal.invite',{kind:'vendor',vendorId:vendor.id,email:'river@example.test',displayName:'River Plumbing',source:'Synthetic explicit consent'}),vendorCookie=await r.portalSignIn('river@example.test')
  for(const [grant,cookie,subject]of [[ownerGrant,ownerCookie,'Owner repair update'],[vendorGrant,vendorCookie,'Vendor repair update']]){
   const x=await create({grantId:grant.grantId,subject});await mutate('approve',x.id,{consent:'APPROVE EXACT MESSAGE',reference:'Synthetic named recipient approval'})
   assert.deepEqual((await shared(cookie)).map(x=>x.subject),[subject]);assert.ok(!(await shared(cookies[0])).some(x=>x.subject===subject))
   const d=(await shared(cookie,x.id))[0];assert.equal((await r.request('/portal/api/threads',{method:'POST',as:cookie,form:new URLSearchParams({threadId:x.id,version:String(d.version),body:'Named recipient reply',consent:'SHARE EXACT MESSAGE'})})).status,200)
  }
  const access=await(await r.request('/api/resident-access?tenancyId='+t.id)).json();assert.ok(access.sharedThreads.some(x=>x.body==='Public repair instructions'));assert.ok(!JSON.stringify(access.sharedThreads).includes('PRIVATE STAFF NOTE'));assert.ok(!JSON.stringify(access.sharedThreads).includes('Owner repair update'));assert.ok(!JSON.stringify(access.sharedThreads).includes('Vendor repair update'))
  const legal=await r.formCommand('thread.create',{tenancyId:t.id,grantId:grants[0].grantId,kind:'legal',subject:'Exact reviewed informational notice',body:'Synthetic counsel-reviewed notice terms',deadline:'2026-11-01',consentReference:'Synthetic explicit permission for this original',file:new File(['Synthetic exact legal original'],'notice.txt',{type:'text/plain'})})
  await mutate('service',legal.id,{outcome:'delivered',fingerprint:(await data(legal.id)).fingerprint},{status:409})
  await mutate('approve',legal.id,{consent:'APPROVE EXACT MESSAGE',reference:'Synthetic counsel service authorization'})
  const legalEntry=(await shared(cookies[0],legal.id))[0].entries[0];assert.equal(await(await r.request('/portal/thread-file?id='+legalEntry.id,{as:cookies[0]})).text(),'Synthetic exact legal original')
  await mutate('service',legal.id,{outcome:'delivered',fingerprint:'synthetic-terrace-3'},{status:409})
  await mutate('reply',legal.id,{private:'0',body:'Changed legal terms',consent:'SHARE EXACT MESSAGE'},{status:409})
  await mutate('service',legal.id,{outcome:'uncertain',method:'Staff recorded attempted service',reference:'Synthetic named witness and attempt record',servedAt:'2026-10-27',consent:'RECORD EVIDENCE'})
  await mutate('service',legal.id,{outcome:'delivered'},{status:409})
  await inspect?.({r,t,staff,cookies,threadId:thread.id,batch,legal})
  await r.restart();assert.equal((await data(thread.id)).entries.at(-1).body,'Resident confirms repair details')
  const archive=await(await r.request('/api/backup')).text(),readable=new Uint8Array(await(await r.request('/api/readable-export')).arrayBuffer());const readableText=new TextDecoder().decode(readable)
  for(const text of ['tt_threads.csv','tt_thread_service.csv','Synthetic public original','Synthetic private original',publicEntry.sha256])assert.ok(readableText.includes(text),text+' is readable and portable')
  const restored=await installation({now:'2026-10-27T16:00:00.000Z'});try{
   await restored.formCommand('data.restore',{confirm:'RESTORE',backup:new File([archive],'backup.rer')})
   const d=(await(await restored.request('/api/threads?id='+thread.id)).json()).threads[0];assert.equal(d.entries.length,current.entries.length);assert.equal(d.assigned_to,manager)
   assert.equal(await(await restored.request('/api/thread-file?id='+publicEntry.id)).text(),'Synthetic public original')
   assert.equal((await(await restored.request('/api/threads?id='+legal.id)).json()).threads[0].service.reference,'Synthetic named witness and attempt record')
   assert.equal((await restored.request('/portal/api/threads',{as:cookies[0]})).status,401)
   await restored.stepUp();await restored.command('thread.reply',{threadId:thread.id,version:d.version,private:'0',body:'No restored authority',consent:'SHARE EXACT MESSAGE'},{status:404})
  }finally{await restored.close()}
  const future=await installation({now:'2038-10-28T16:00:00.000Z'});try{
   await future.formCommand('data.restore',{confirm:'RESTORE',backup:new File([archive],'backup.rer')})
   const request=await future.command('privacy.request',{tenancyId:t.id,kind:'erase',source:'Synthetic resident erasure request'})
   const hold=await future.command('privacy.hold',{tenancyId:t.id,class:'communications',reason:'Synthetic communication legal hold'})
   let reviewed=await future.command('privacy.review',{tenancyId:t.id,requestId:request.id})
   assert.equal(reviewed.review.classes.find(c=>c.class==='communications').through,'2029-10-27');assert.equal(reviewed.review.eligible,false)
   await future.command('tenancy.erase',{tenancyId:t.id,requestId:request.id,fingerprint:reviewed.review.fingerprint,confirm:'resident0@example.test'},{status:409})
   await future.command('privacy.release',{tenancyId:t.id,holdId:hold.id,reason:'Synthetic authorized release'})
   reviewed=await future.command('privacy.review',{tenancyId:t.id,requestId:request.id});assert.equal(reviewed.review.eligible,true)
   await future.command('tenancy.erase',{tenancyId:t.id,requestId:request.id,fingerprint:reviewed.review.fingerprint,confirm:'resident0@example.test'})
   assert.equal((await future.request('/api/thread-file?id='+publicEntry.id)).status,404)
   assert.equal((await(await future.request('/api/threads')).json()).threads.some(x=>x.tenancy_id===t.id),false)
   assert.equal((await future.db.prepare('SELECT COUNT(*) AS n FROM tt_erased_document_files WHERE sha256=?').bind(publicEntry.sha256).first()).n,1)
   const journal=await(await future.request('/api/backup')).text(),destination=await installation();try{
    const refused=await destination.formCommand('data.restore',{confirm:'RESTORE',backup:new File([archive],'old.rer'),journal:new File([journal],'later.rer')},{status:409});assert.equal(refused.error,'erasure_fence')
   }finally{await destination.close()}
  }finally{await future.close()}
  for(const command of ['thread.create','thread.reply','thread.assign','thread.approve','thread.service','thread.readmark']){
   await r.command(command,{tenancyId:t.id,threadId:thread.id},{as:staff.member,status:403})
   await r.command(command,{tenancyId:t.id,threadId:thread.id},{as:staff.south,status:404})
  }
  const stale=Date.now()-20*60000
  await r.db.prepare("UPDATE oa_sessions SET created_at=? WHERE operator_id IN (SELECT id FROM oa_operators WHERE email='owner@example.test')").bind(stale).run()
  await r.db.prepare("UPDATE oa_step_up_challenges SET consumed_at=? WHERE operator_id IN (SELECT id FROM oa_operators WHERE email='owner@example.test') AND consumed_at IS NOT NULL").bind(stale).run()
  for(const command of ['thread.create','thread.reply','thread.assign','thread.approve','thread.service','thread.readmark'])assert.equal((await r.command(command,{tenancyId:t.id,threadId:thread.id},{status:403})).error,'step_up_required')
  await r.stepUp()
  await r.command('portal.revoke',{grantId:grants[0].grantId,reason:'Synthetic withdrawal'})
  assert.equal((await r.request('/portal/api/threads',{as:cookies[0]})).status,401)
 }finally{await r.close()}
}
