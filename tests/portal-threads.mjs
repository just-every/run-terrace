import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
const servicePng=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64')
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
  const mutate=async(command,id,extra={},opts={})=>{const d=await data(id);return (command==='service'?r.formCommand:r.command)('thread.'+command,{...(command==='service'?{serverName:'Synthetic process server',serverReference:'synthetic-terrace-service-1',occurredAt:'2026-10-27T08:30-07:00',photo:new File([servicePng],'service.png',{type:'image/png'})}:{}),threadId:id,version:d.version,fingerprint:d.fingerprint,...extra},opts)}
  const shared=async(cookie,id)=>{const res=await r.request('/portal/api/threads'+(id?'?id='+id:''),{as:cookie});assert.equal(res.status,200,await res.clone().text());return(await res.json()).threads}
  await create({}, {as:staff.member,status:403});
  const oldProof=Date.now()-20*60000;await r.db.prepare("UPDATE oa_sessions SET created_at=? WHERE operator_id IN (SELECT id FROM oa_operators WHERE email='manager@example.test')").bind(oldProof).run();
  await create({}, {as:staff.manager,status:403});await r.stepUp('manager@example.test',staff.manager);await r.stepUp('south@example.test',staff.south)
  await create({}, {as:staff.south,status:404})
  await create({consentReference:''},{as:staff.manager,status:400})
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
  assert.equal(publicEntry.sha256,createHash('sha256').update('Synthetic public original').digest('hex'))
  assert.equal(await(await r.request('/portal/thread-file?id='+publicEntry.id,{as:cookies[0]})).text(),'Synthetic public original')
  assert.equal((await r.request('/portal/thread-file?id='+publicEntry.id,{as:cookies[2]})).status,404)
  const portalPost=(fields={},opts={})=>r.request('/portal/api/threads',{method:'POST',as:cookies[0],form:new URLSearchParams({threadId:thread.id,version:String(visible[0].version),body:'Resident confirms repair details',consent:'SHARE EXACT MESSAGE',...fields}),...opts})
  assert.equal((await portalPost({}, {originHeader:'https://elsewhere.test'})).status,403)
  const answered=await portalPost();assert.equal(answered.status,200,await answered.clone().text())
  assert.equal((await portalPost()).status,409,'stale reply retry cannot duplicate content')
  current=await data(thread.id);assert.equal(current.unread,true)
  await mutate('readmark',thread.id);assert.equal((await data(thread.id)).unread,false)
  const attachmentHistory=(await(await r.request('/api/history?action=read:thread-attachment&tenancyId='+t.id)).json()).rows
  const residentAttachment=attachmentHistory.find(x=>x.subject===publicEntry.id);assert.ok(residentAttachment);assert.ok(residentAttachment.actor.startsWith('portal:'));assert.equal(residentAttachment.policy,'portal_resident v1');assert.equal(residentAttachment.source,publicEntry.sha256);assert.equal(residentAttachment.outcome,'recorded');assert.equal(residentAttachment.at,'2026-10-27T16:00:00.000Z')
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
  const household=[]
  for(const [index,role,preference,joined,left,eligible]of [[0,'co_tenant','email','2025-01-01',null,true],[1,'guarantor','mail','2025-01-01',null,true],[2,'authorized_contact','phone','2025-01-01',null,true],[3,'occupant','email','2025-01-01',null,false],[4,'emergency_contact','email','2025-01-01',null,false],[5,'co_tenant','none','2025-01-01',null,false],[6,'guarantor','email','2026-10-28',null,false],[7,'authorized_contact','email','2025-01-01','2026-10-26',false]]){
   const email=`household${index}@example.test`,member=await r.command('household.add',{tenancyId:t.id,role,name:'Household '+index,email,phone:'510-555-0100',contactBy:preference,joined})
   if(left)await r.command('household.leave',{memberId:member.id,left})
   const grant=await r.command('portal.invite',{kind:'resident',access:'delegate',tenancyId:t.id,email,displayName:'Household '+index,source:'Synthetic scoped notice recipient invitation'})
   const cookie=await r.portalSignIn(email);household.push({member,grant,cookie,eligible})
   await create({grantId:grant.grantId},{status:404})
  }
  const beforeHouseholdPublication=r.messages.length
  const householdBatch=await r.formCommand('thread.create',{tenancyId:t.id,kind:'broadcast',subject:'Household service announcement',body:'Synthetic reviewed household service notice.',consentReference:'Synthetic professionally reviewed service authority for each exact named household recipient',file:new File(['Synthetic household notice original'],'household-notice.txt',{type:'text/plain'})})
  assert.equal(householdBatch.ids.length,5)
  for(const id of householdBatch.ids)await mutate('approve',id,{consent:'APPROVE EXACT MESSAGE',reference:'Synthetic exact household service approval'})
  assert.equal(r.messages.length,beforeHouseholdPublication,'notice preparation and approval never send provider mail')
  const householdRows=await Promise.all(householdBatch.ids.map(id=>data(id)))
  assert.deepEqual(householdRows.map(x=>x.recipient_name).sort(),['Household 0','Household 1','Household 2','Resident 0','Resident 1'])
  for(const person of household){
   const visible=await shared(person.cookie)
   assert.deepEqual(visible.map(x=>x.subject),person.eligible?['Household service announcement']:[])
   assert.equal((await r.request('/portal/api/threads?id='+thread.id,{as:person.cookie})).status,404,'household notice authority grants no conversation')
   assert.equal((await r.request('/portal/thread-file?id='+privateEntry.id,{as:person.cookie})).status,404)
   if(person.eligible){
    const notice=visible[0];assert.equal(await(await r.request('/portal/thread-file?id='+notice.entries[0].id,{as:person.cookie})).text(),'Synthetic household notice original')
    assert.equal((await r.request('/portal/api/threads',{method:'POST',as:person.cookie,form:new URLSearchParams({threadId:notice.id,version:String(notice.version),body:'No blanket conversation grant',consent:'SHARE EXACT MESSAGE'})})).status,409)
   }
  }
  const coTenant=household[0],coNotice=householdRows.find(x=>x.recipient_member_id===coTenant.member.id)
  for(const [joined,left,expected]of [['2026-10-28',null,404],['2026-10-27',null,200],['2025-01-01','2026-10-27',200],['2025-01-01','2026-10-26',404]]){
   await r.db.prepare('UPDATE tt_household_members SET joined=?,left_on=? WHERE id=?').bind(joined,left,coTenant.member.id).run()
   assert.equal((await r.request('/portal/api/threads?id='+coNotice.id,{as:coTenant.cookie})).status,expected)
   assert.equal((await r.request('/portal/thread-file?id='+coNotice.entries[0].id,{as:coTenant.cookie})).status,expected)
   if(expected===404)await create({kind:'legal',grantId:coTenant.grant.grantId},{status:404})
  }
  await r.db.prepare('UPDATE tt_household_members SET joined=?,left_on=NULL WHERE id=?').bind('2025-01-01',coTenant.member.id).run()
  const office=await officePrintJourney({r,t,create,data,mutate,staff,manager,grants,servicePng})
  const legal=await r.formCommand('thread.create',{tenancyId:t.id,grantId:grants[0].grantId,kind:'legal',subject:'Exact reviewed informational notice',body:'Synthetic counsel-reviewed notice terms',deadline:'2026-11-01',consentReference:'Synthetic explicit permission for this original',file:new File(['Synthetic exact legal original'],'notice.txt',{type:'text/plain'})})
  await mutate('service',legal.id,{outcome:'delivered',fingerprint:(await data(legal.id)).fingerprint},{status:409})
  await mutate('approve',legal.id,{consent:'APPROVE EXACT MESSAGE',reference:'Synthetic counsel service authorization'})
  const legalEntry=(await shared(cookies[0],legal.id))[0].entries[0];assert.equal(await(await r.request('/portal/thread-file?id='+legalEntry.id,{as:cookies[0]})).text(),'Synthetic exact legal original')
  await mutate('service',legal.id,{outcome:'delivered',fingerprint:'synthetic-terrace-3'},{status:409})
  await mutate('reply',legal.id,{private:'0',body:'Changed legal terms',consent:'SHARE EXACT MESSAGE'},{status:409})
  await mutate('service',legal.id,{outcome:'uncertain',method:'Staff recorded attempted service',reference:'Synthetic named witness and attempt record',servedAt:'2026-10-27',consent:'RECORD EVIDENCE'})
  await mutate('service',legal.id,{outcome:'delivered'},{status:409})
  let recovery=(await data(legal.id)).reconciliations
  assert.equal(recovery.length,1);assert.equal(recovery[0].outcome,'uncertain')
  assert.equal(recovery[0].assigned_to,(await r.db.prepare("SELECT id FROM oa_operators WHERE role='owner'").first()).id)
  assert.equal(recovery[0].due_on,'2026-10-27');assert.ok(recovery[0].next_action.includes('independent service evidence'))
  const reconcile={outcome:'delivered',assignedTo:manager,nextAction:'Receipt reviewed; physical attempt reconciled without retry.',dueOn:'2026-10-28',reference:'Synthetic independent witness receipt',consent:'RECORD RECONCILIATION'}
  await mutate('reconcile',legal.id,{...reconcile,reference:''},{status:400})
  await mutate('reconcile',legal.id,{...reconcile,assignedTo:'synthetic-terrace-missing'},{status:400})
  const beforeRecoveryMail=r.messages.length
  await inspect?.({r,t,staff,cookies,ownerCookie,vendorCookie,threadId:thread.id,batch,legal,manager,householdCookie:coTenant.cookie,office})
  // Browser proof records an open assigned review; HTTP proof resolves it if no browser was requested.
  if((await data(legal.id)).reconciliations.at(-1).outcome!=='delivered')await mutate('reconcile',legal.id,reconcile)
  recovery=(await data(legal.id)).reconciliations
  assert.equal(recovery.length,2);assert.equal(recovery[0].outcome,'uncertain');assert.equal(recovery[1].outcome,'delivered')
  assert.equal(recovery[1].assigned_to,manager);assert.equal(recovery[1].reference,'Synthetic independent witness receipt')
  assert.equal(recovery[1].fingerprint,(await data(legal.id)).fingerprint)
  assert.equal((await data(legal.id)).service.outcome,'uncertain','original evidence is never rewritten')
  assert.equal(r.messages.length,beforeRecoveryMail,'reconciliation performs no outbound send')
  await mutate('reconcile',legal.id,reconcile,{status:409})
  const audit=(await(await r.request('/api/history?action=thread.reconcile&tenancyId='+t.id)).json()).rows
  assert.equal(audit.length,2);const legalAudit=audit.find(x=>x.subject===legal.id);assert.ok(legalAudit);assert.equal(legalAudit.subject,legal.id);assert.equal(legalAudit.source,recovery[1].reference)
  assert.equal(legalAudit.actor,recovery[1].actor);assert.equal(legalAudit.at,'2026-10-27T16:00:00.000Z');assert.equal(legalAudit.policy,'owner');assert.equal(legalAudit.outcome,'recorded')
  const conversationHistory=(await data(thread.id)).events
  assert.deepEqual([...new Set(conversationHistory.map(x=>x.action))].sort(),['portal.thread.read','portal.thread.reply','thread.approve','thread.assign','thread.create','thread.readmark','thread.reply'])
  const legalHistory=(await data(legal.id)).events
  assert.deepEqual(legalHistory.map(x=>x.action),['thread.create','thread.approve','thread.service','thread.reconcile'])
  for(const event of [...conversationHistory,...legalHistory]){
   assert.ok(event.actor);assert.equal(event.at,'2026-10-27T16:00:00.000Z');assert.ok(event.policy);assert.ok(event.source);assert.ok(event.reason)
   assert.equal(event.fingerprint,(event.thread_id===thread.id?await data(thread.id):await data(legal.id)).fingerprint)
   assert.ok(Number.isInteger(event.before_revision));assert.equal(event.after_revision,event.before_revision+(['thread.readmark','portal.thread.read'].includes(event.action)?0:1))
  }
  const preparedEvent=conversationHistory.find(x=>x.action==='thread.create');assert.equal(preparedEvent.actor,manager);assert.equal(preparedEvent.policy,'portfolio_manager v1');assert.equal(preparedEvent.before_revision,0);assert.equal(preparedEvent.source,'Synthetic explicit channel permission for named recipients')
  assert.equal(legalHistory.at(-1).source,'Synthetic independent witness receipt')
  // Fixed property-local date: before the term, the opening day, closing day and day after.
  const term=await r.db.prepare('SELECT start_date,end_date FROM tt_tenancies WHERE id=?').bind(t.id).first()
  for(const [start,end,zone,expected]of [['2026-10-28','2026-12-31','America/Los_Angeles',404],['2026-10-27','2026-12-31','America/Los_Angeles',200],['2025-01-01','2026-10-27','America/Los_Angeles',200],['2025-01-01','2026-10-26','America/Los_Angeles',404],['2026-10-28','2026-12-31',['Pacific','Kiritimati'].join('/'),200],['2025-01-01','2026-10-27',['Pacific','Kiritimati'].join('/'),404]]){
   await r.db.prepare('UPDATE tt_tenancies SET start_date=?,end_date=?,time_zone=? WHERE id=?').bind(start,end,zone,t.id).run()
   assert.equal((await r.request('/portal/api/threads?id='+thread.id,{as:cookies[0]})).status,expected,'recipient read at term boundary')
   assert.equal((await r.request('/portal/thread-file?id='+publicEntry.id,{as:cookies[0]})).status,expected,'original at term boundary')
   if(expected===404){assert.equal((await portalPost({version:String((await data(thread.id)).version)})).status,404);await create({subject:'Refused outside term'},{status:404})}
  }
  await r.db.prepare('UPDATE tt_tenancies SET start_date=?,end_date=?,time_zone=? WHERE id=?').bind(term.start_date,term.end_date,'America/Los_Angeles',t.id).run()
  await r.db.prepare('UPDATE tt_tenancies SET tenant_email=? WHERE id=?').bind('replacement@example.test',t.id).run()
  assert.equal((await r.request('/portal/api/threads?id='+thread.id,{as:cookies[0]})).status,404,'changed resident identity loses former thread')
  await r.db.prepare('UPDATE tt_tenancies SET tenant_email=? WHERE id=?').bind('resident0@example.test',t.id).run()

  await r.restart();assert.equal((await data(thread.id)).entries.at(-1).body,'Resident confirms repair details')
  assert.equal(createHash('sha256').update(Buffer.from(await(await r.request('/api/thread-print?id='+office.printBatchId)).arrayBuffer())).digest('hex'),office.pdfSha256)
  const archive=await(await r.request('/api/backup')).text(),readable=new Uint8Array(await(await r.request('/api/readable-export')).arrayBuffer());const readableText=new TextDecoder().decode(readable)
  for(const text of ['tt_print_batches.csv','tt_print_items.csv','tt_print_approvals.csv',office.pdfSha256,'tt_threads.csv','tt_thread_service.csv','tt_thread_reconciliations.csv','tt_thread_events.csv','Synthetic independent witness receipt','Synthetic public original','Synthetic private original',publicEntry.sha256])assert.ok(readableText.includes(text),text+' is readable and portable')
  assertOfficeExport(readable,office,servicePng)
  const restored=await installation({now:'2026-10-27T16:00:00.000Z'});try{
   await restored.formCommand('data.restore',{confirm:'RESTORE',backup:new File([archive],'backup.rer')})
   assert.ok((await(await restored.request('/api/threads?id='+office.threadId)).json()).threads[0].prints[0].inert)
   const restoredExport=Buffer.from(await(await restored.request('/api/readable-export')).arrayBuffer());assertOfficeExport(restoredExport,office,servicePng)
   assert.equal((await(await restored.request('/api/threads?id='+office.threadId)).json()).threads[0].service.photo_sha256,office.photoSha256)
   assert.ok([404,409].includes((await restored.request('/api/thread-print?id='+office.printBatchId)).status))
   await restored.stepUp();await restored.command('thread.print.approve',{printBatchId:office.printBatchId,manifestSha256:office.manifestSha256,pdfSha256:office.pdfSha256,consent:'APPROVE EXACT PRINT',reference:'Synthetic restored evidence refuses authority'},{status:404})
   const d=(await(await restored.request('/api/threads?id='+thread.id)).json()).threads[0];assert.equal(d.entries.length,current.entries.length);assert.equal(d.assigned_to,manager);assert.deepEqual(d.events,conversationHistory)
   assert.equal(await(await restored.request('/api/thread-file?id='+publicEntry.id)).text(),'Synthetic public original')
   assert.equal((await(await restored.request('/api/threads?id='+legal.id)).json()).threads[0].service.reference,'Synthetic named witness and attempt record')
   const restoredRecovery=(await(await restored.request('/api/threads?id='+legal.id)).json()).threads[0].reconciliations;assert.equal(restoredRecovery.length,2);assert.equal(restoredRecovery[1].reference,'Synthetic independent witness receipt')
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
   const other=(await(await future.request('/api/threads')).json()).threads.find(row=>office.noticeIds.includes(row.id)&&row.tenancy_id!==t.id)
   assert.ok(other,'the immutable office batch contains another tenancy')
   const heldPrint=other.prints.find(print=>print.id===office.printBatchId)
   assert.ok(heldPrint.approved,'the shared batch has exact human approval')
   for(const retentionClass of ['communications','all']){
    reviewed=await future.command('privacy.review',{tenancyId:t.id,requestId:request.id});assert.equal(reviewed.review.eligible,true)
    const sharedHold=await future.command('privacy.hold',{tenancyId:other.tenancy_id,class:retentionClass,reason:'Synthetic private reason for the other tenancy'})
    await future.command('tenancy.erase',{tenancyId:t.id,requestId:request.id,fingerprint:reviewed.review.fingerprint,confirm:'resident0@example.test'},{status:409})
    reviewed=await future.command('privacy.review',{tenancyId:t.id,requestId:request.id})
    assert.equal(reviewed.review.eligible,false,'another tenancy’s shared print hold prevents erasure')
    assert.ok(reviewed.review.kept.some(row=>row.class==='communications'&&row.reasons.some(reason=>reason.includes('Shared office print evidence'))))
    assert.ok(!JSON.stringify(reviewed.review).includes('Synthetic private reason for the other tenancy'),'shared hold reasons remain private')
    const refused=await future.command('tenancy.erase',{tenancyId:t.id,requestId:request.id,fingerprint:reviewed.review.fingerprint,confirm:'resident0@example.test'},{status:409})
    assert.equal(refused.error,'retention_hold')
    const preserved=(await(await future.request('/api/threads?id='+other.id)).json()).threads[0].prints.find(print=>print.id===office.printBatchId)
    assert.deepEqual(preserved,heldPrint,'refused erasure preserves the other tenancy’s manifest and exact approval')
    assertOfficeExport(new Uint8Array(await(await future.request('/api/readable-export')).arrayBuffer()),office,servicePng)
    assert.equal((await future.db.prepare('SELECT COUNT(*) AS n FROM tt_erased_document_files WHERE sha256=?').bind(office.pdfSha256).first()).n,0,'a refused erase creates no file resurrection fence')
    await future.command('privacy.release',{tenancyId:other.tenancy_id,holdId:sharedHold.id,reason:'Synthetic authorized shared hold release'})
   }
   reviewed=await future.command('privacy.review',{tenancyId:t.id,requestId:request.id});assert.equal(reviewed.review.eligible,true)
   await future.command('tenancy.erase',{tenancyId:t.id,requestId:request.id,fingerprint:reviewed.review.fingerprint,confirm:'resident0@example.test'})
   assert.equal((await future.request('/api/thread-file?id='+publicEntry.id)).status,404)
   assert.equal((await future.request('/api/thread-print?id='+office.printBatchId)).status,404)
   assert.equal((await future.db.prepare('SELECT COUNT(*) AS n FROM tt_print_batches WHERE id=?').bind(office.printBatchId).first()).n,0)
   assert.equal((await future.db.prepare('SELECT COUNT(*) AS n FROM tt_erased_document_files WHERE sha256=?').bind(office.pdfSha256).first()).n,1)
   assert.equal((await(await future.request('/api/threads')).json()).threads.some(x=>x.tenancy_id===t.id),false)
   assert.equal((await future.db.prepare('SELECT COUNT(*) AS n FROM tt_erased_document_files WHERE sha256=?').bind(publicEntry.sha256).first()).n,1)
   const journal=await(await future.request('/api/backup')).text(),destination=await installation();try{
    const refused=await destination.formCommand('data.restore',{confirm:'RESTORE',backup:new File([archive],'old.rer'),journal:new File([journal],'later.rer')},{status:409});assert.equal(refused.error,'erasure_fence')
   }finally{await destination.close()}
  }finally{await future.close()}
  for(const command of ['thread.create','thread.reply','thread.assign','thread.approve','thread.service','thread.readmark','thread.reconcile','thread.print.prepare','thread.print.approve']){
   await r.command(command,{tenancyId:t.id,threadId:thread.id,printBatchId:office.printBatchId},{as:staff.member,status:403})
   await r.command(command,{tenancyId:t.id,threadId:thread.id,printBatchId:office.printBatchId},{as:staff.south,status:404})
  }
  await r.command('household.leave',{memberId:coTenant.member.id,left:'2026-10-26'})
  await r.command('household.add',{tenancyId:t.id,role:'co_tenant',name:'Returned household contact',email:'household0@example.test',contactBy:'email',joined:'2026-10-27'})
  assert.equal((await r.request('/portal/api/threads?id='+coNotice.id,{as:coTenant.cookie})).status,404,'a replacement membership cannot revive the original notice authority')
  const freshHouseholdNotice=await create({kind:'legal',grantId:coTenant.grant.grantId,subject:'New membership reviewed notice'})
  await mutate('approve',freshHouseholdNotice.id,{consent:'APPROVE EXACT MESSAGE',reference:'Synthetic fresh membership review'})
  assert.equal((await r.request('/portal/api/threads?id='+freshHouseholdNotice.id,{as:coTenant.cookie})).status,200)
  const signInPortal=async email=>{const response=await r.request('/portal/signin',{method:'POST',as:'',form:new URLSearchParams({email})});assert.equal(response.status,202);return r.portalSignIn(email)}
  const replacementOwner=await r.command('owner.add',{kind:'individual',legalName:'Synthetic successor owner',email:'successor@example.test',mailingAddress:'Synthetic successor address'})
  await r.command('ownership.set',{propertyId:properties[0].id,effectiveFrom:'2026-10-28',reason:'Synthetic dated transfer',shares:[{ownerId:replacementOwner.id,percent:'100'}]})
  const currentOwnerCookie=await signInPortal('rowan@example.test')
  assert.deepEqual((await shared(currentOwnerCookie)).map(x=>x.subject),['Owner repair update'],'prior owner retains current-day authority before transfer')
  await r.db.prepare('UPDATE tt_tenancies SET time_zone=? WHERE id=?').bind(['Pacific','Kiritimati'].join('/'),t.id).run()
  assert.deepEqual(await shared(currentOwnerCookie),[],'property-local transfer day revokes former owner even while UTC is prior day')
  await create({grantId:ownerGrant.grantId},{status:404})
  await r.db.prepare('UPDATE tt_tenancies SET time_zone=? WHERE id=?').bind('America/Los_Angeles',t.id).run()
  const currentJob=await r.db.prepare('SELECT version FROM tt_maintenance_jobs WHERE id=?').bind(job.id).first()
  const revisedWork=await r.command('maintenance.revise',{jobId:job.id,version:currentJob.version,scope:'Revised synthetic scope needs fresh work approval'})
  assert.deepEqual(await shared(vendorCookie),[],'a reopened work approval supplies no vendor conversation authority')
  await create({grantId:vendorGrant.grantId},{status:404})
  const replacementVendor=await r.command('vendor.add',{name:'Synthetic successor plumber',email:'replacement-vendor@example.test',phone:'510-555-0101',specialties:'plumbing',serviceAreas:'Oakland',w9:'received',insuranceExpires:'2036-12-31',licenseNumber:'synthetic-terrace-4',licenseExpires:'2036-12-31',availability:'Weekdays',rate:'95',standing:'approved'})
  const reassignedWork=await r.command('maintenance.reassign',{jobId:job.id,version:revisedWork.version,vendorId:replacementVendor.id})
  assert.equal((await r.request('/portal/api/threads',{as:vendorCookie})).status,401,'reassignment ends the former vendor session')
  const formerVendorCookie=await signInPortal('river@example.test')
  assert.deepEqual(await shared(formerVendorCookie),[])
  await r.command('maintenance.approve',{jobId:job.id,version:reassignedWork.version},{as:staff.manager})
  assert.deepEqual(await shared(formerVendorCookie),[],'another vendor approval cannot restore former vendor thread authority')
  await create({grantId:vendorGrant.grantId},{status:404})
  await r.command('tenancy.end',{tenancyId:t.id,moveOut:'2026-10-26',reason:'Synthetic ended-tenancy boundary'})
  assert.equal((await r.request('/portal/api/threads?id='+thread.id,{as:cookies[0]})).status,404,'ended tenancy loses current conversation access')
  assert.equal((await r.request('/portal/thread-file?id='+publicEntry.id,{as:cookies[0]})).status,404)
  await create({subject:'Refused ended-tenancy publication'},{status:404})
  const stale=Date.now()-20*60000
  await r.db.prepare("UPDATE oa_sessions SET created_at=? WHERE operator_id IN (SELECT id FROM oa_operators WHERE email='owner@example.test')").bind(stale).run()
  await r.db.prepare("UPDATE oa_step_up_challenges SET consumed_at=? WHERE operator_id IN (SELECT id FROM oa_operators WHERE email='owner@example.test') AND consumed_at IS NOT NULL").bind(stale).run()
  for(const command of ['thread.create','thread.reply','thread.assign','thread.approve','thread.service','thread.readmark','thread.reconcile','thread.print.prepare','thread.print.approve'])assert.equal((await r.command(command,{tenancyId:t.id,threadId:thread.id,printBatchId:office.printBatchId},{status:403})).error,'step_up_required')
  await r.stepUp()
  await r.command('portal.revoke',{grantId:grants[0].grantId,reason:'Synthetic withdrawal'})
  assert.equal((await r.request('/portal/api/threads',{as:cookies[0]})).status,401)
 }finally{await r.close()}
}

async function officePrintJourney({r,t,create,data,mutate,staff,manager,grants,servicePng}){
 const before=r.messages.length
 const notice=await create({kind:'broadcast',subject:'Office certified notice',body:'Synthetic exact office letter body.'})
 await mutate('print.prepare',notice.id,{reference:'Synthetic print preparation'},{status:409})
 for(const id of notice.ids)await mutate('approve',id,{consent:'APPROVE EXACT MESSAGE',reference:'Synthetic exact recipient authority'})
 const prepared=await mutate('print.prepare',notice.id,{allRecipients:'1',reference:'Synthetic office print preparation'})
 const batch=(await data(notice.id)).prints.find(b=>b.id===prepared.printBatchId)
 assert.equal(batch.items.length,5);assert.equal(batch.approved,false)
 const wire=path=>r.request('/api/thread-print?id='+batch.id+path)
 assert.equal((await wire('')).status,409,'office download requires exact print approval')
 const review=await wire('&review=1'),bytes=Buffer.from(await review.arrayBuffer())
 assert.equal(review.headers.get('cache-control'),'private, no-store');assert.match(review.headers.get('content-disposition'),/^inline/)
 assert.equal(bytes.subarray(0,8).toString(),'%PDF-1.7')
 assert.equal(createHash('sha256').update(bytes).digest('hex'),batch.pdf_sha256)
 const approval={printBatchId:batch.id,manifestSha256:batch.manifest_sha256,pdfSha256:batch.pdf_sha256,consent:'APPROVE EXACT PRINT',reference:'Synthetic exact PDF review'}
 await r.command('thread.print.approve',{...approval,pdfSha256:'synthetic-terrace-wrong'},{status:409})
 const body=(await data(notice.id)).entries[0]
 await r.db.prepare('UPDATE tt_thread_entries SET body=? WHERE id=?').bind('Changed underlying source after print review',body.id).run()
 await r.command('thread.print.approve',approval,{status:409})
 assert.equal((await wire('&review=1')).status,409,'changed source refuses stale frozen print')
 assert.equal((await data(notice.id)).prints[0].approved,false)
 await r.db.prepare('UPDATE tt_thread_entries SET body=? WHERE id=?').bind(body.body,body.id).run()
 await r.command('thread.print.approve',approval,{as:staff.manager})
 const download=await wire('');assert.match(download.headers.get('content-disposition'),/^attachment/)
 assert.deepEqual(Buffer.from(await download.arrayBuffer()),bytes)
 const manifestResponse=await wire('&manifest=1'),manifestBytes=Buffer.from(await manifestResponse.arrayBuffer())
 assert.equal(createHash('sha256').update(manifestBytes).digest('hex'),batch.manifest_sha256)
 const manifest=JSON.parse(manifestBytes);assert.equal(manifest.items.length,5);assert.equal(manifest.pdfSha256,batch.pdf_sha256)
 const pdfs=[],recipientPdfs=[]
 for(const item of batch.items){
  const original=await wire('&item='+item.id),pdf=Buffer.from(await original.arrayBuffer())
  assert.equal(createHash('sha256').update(pdf).digest('hex'),item.pdf_sha256)
  assert.equal(manifest.items.find(m=>m.id===item.id).pdfSha256,item.pdf_sha256)
  assert.ok(pdf.includes(Buffer.from('Office certified notice').toString('hex')),'PDF contains selectable subject text')
  assert.ok(pdf.includes(Buffer.from(item.recipient).toString('hex')),'PDF names its recipient')
  assert.ok(pdf.includes(Buffer.from(item.address).toString('hex')),'PDF names its mailing address')
  pdfs.push(item.pdf_sha256);recipientPdfs.push({id:item.id,bytes:pdf,sha256:item.pdf_sha256})
  assert.equal((await data(item.thread_id)).service,null,'printing is distinct from service')
 }
 assert.equal(new Set(pdfs).size,5,'each recipient has distinct frozen bytes')
 assert.equal(r.messages.length,before,'office printing performs no provider send')
 for(const as of [staff.south,staff.member]){
  assert.equal((await r.request('/api/thread-print?id='+batch.id,{as})).status,as===staff.south?404:403)
  await r.command('thread.print.approve',approval,{as,status:as===staff.south?404:403})
 }
 await mutate('service',notice.id,{outcome:'returned',method:'office_certified',reference:'Synthetic returned office mail',tracking:'',servedAt:'2026-10-27',consent:'RECORD EVIDENCE'},{status:400})
 await mutate('service',notice.id,{outcome:'returned',method:'office_certified',reference:'Synthetic returned office mail',tracking:'synthetic-terrace-tracking-1',servedAt:'2026-10-27',serverName:'',consent:'RECORD EVIDENCE'},{status:400})
 await mutate('service',notice.id,{outcome:'returned',method:'office_certified',reference:'Synthetic returned office mail',tracking:'synthetic-terrace-tracking-1',servedAt:'2026-10-27',photo:new File(['invalid photo'],'fake.png',{type:'image/png'}),consent:'RECORD EVIDENCE'},{status:422})
 await mutate('service',notice.id,{outcome:'returned',method:'office_certified',reference:'Synthetic returned office mail',tracking:'synthetic-terrace-tracking-1',servedAt:'2026-10-27',printBatchId:batch.id,consent:'RECORD EVIDENCE'})
 const served=await data(notice.id)
 assert.equal(served.service.outcome,'returned');assert.equal(served.service.server_name,'Synthetic process server');assert.equal(served.service.server_reference,'synthetic-terrace-service-1')
 assert.equal(served.service.occurred_at,'2026-10-27T15:30:00.000Z');assert.equal(served.service.recorded_at,'2026-10-27T16:00:00.000Z');assert.equal(served.service.tracking,'synthetic-terrace-tracking-1')
 assert.equal(served.service.print_batch_id,batch.id);assert.equal(served.reconciliations[0].outcome,'returned');assert.ok(served.reconciliations[0].assigned_to);assert.ok(served.reconciliations[0].next_action)
 const photo=await r.request('/api/thread-service-photo?id='+notice.id)
 assert.equal(photo.headers.get('cache-control'),'private, no-store');assert.deepEqual(Buffer.from(await photo.arrayBuffer()),servicePng)
 assert.equal(served.service.photo_sha256,createHash('sha256').update(servicePng).digest('hex'))
 for(const [as,status]of [[staff.south,404],[staff.member,403]])assert.equal((await r.request('/api/thread-service-photo?id='+notice.id,{as})).status,status)
 await mutate('service',notice.id,{outcome:'delivered'},{status:409})
 await mutate('reconcile',notice.id,{outcome:'uncertain',assignedTo:manager,nextAction:'Obtain a new address and independent returned-mail evidence.',dueOn:'2026-10-28',reference:'Synthetic returned-mail review',consent:'RECORD RECONCILIATION'})
 assert.equal((await data(notice.id)).service.outcome,'returned')
 const history=(await(await r.request('/api/history?action=thread.print.&tenancyId='+t.id)).json()).rows
 assert.ok(history.some(x=>x.action==='thread.print.prepare'&&x.source===batch.manifest_sha256));assert.ok(history.some(x=>x.action==='thread.print.approve'&&x.source===batch.manifest_sha256))
 const revoke=await create({kind:'legal',subject:'Revoked office print',body:'Synthetic revoked recipient content'})
 await mutate('approve',revoke.id,{consent:'APPROVE EXACT MESSAGE',reference:'Synthetic exact review'})
 const revoking=await mutate('print.prepare',revoke.id,{reference:'Synthetic pre-revocation print'})
 await r.db.prepare('UPDATE tt_portal_grants SET revoked_at=? WHERE id=?').bind('2026-10-27T16:00:00.000Z',grants[0].grantId).run()
 assert.equal((await r.request('/api/thread-print?id='+revoking.printBatchId+'&review=1')).status,404)
 await r.db.prepare('UPDATE tt_portal_grants SET revoked_at=NULL WHERE id=?').bind(grants[0].grantId).run()
 return {...prepared,threadId:notice.id,noticeIds:notice.ids,pdfBytes:bytes,recipientPdfs,photoSha256:served.service.photo_sha256}
}

function assertOfficeExport(value,office,photo){
 const zip=Buffer.from(value),entries=new Map()
 for(let offset=0;zip.readUInt32LE(offset)===0x04034b50;){
  const size=zip.readUInt32LE(offset+18),length=zip.readUInt16LE(offset+26),extra=zip.readUInt16LE(offset+28),start=offset+30+length+extra
  entries.set(zip.subarray(offset+30,offset+30+length).toString(),zip.subarray(start,start+size));offset=start+size
 }
 const inventory=JSON.parse(entries.get('manifest.json')).files
 assert.deepEqual(entries.get(`files/tt_print_batches/${office.printBatchId}.pdf`),office.pdfBytes,'readable export preserves the exact combined PDF')
 for(const item of office.recipientPdfs)assert.deepEqual(entries.get(`files/tt_print_items/${item.id}.pdf`),item.bytes,'readable export preserves each recipient PDF')
 const photograph=inventory.find(f=>f.table==='tt_thread_service'&&f.column==='photo_bytes'&&f.sha256===office.photoSha256)
 assert.ok(photograph);assert.ok(photograph.path.endsWith('.png'));assert.deepEqual(entries.get(photograph.path),photo,'readable export preserves the service photograph')
}
