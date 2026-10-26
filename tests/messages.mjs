import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {createHmac} from 'node:crypto'
import {installation,tenancyInput} from './api/harness.mjs'
const twilio={accountSid:'synthetic-terrace-220',authToken:'synthetic-terrace-221',from:'+15005550006',mode:'test'}
export async function journey({assets=false,inspect}={}){
 const wire=[],clock='2026-10-26T18:00:00.000Z'
 let response='accepted'
 const h=await installation({assets,now:clock,asyncDatabase:true,twilio,twilioRequest:async req=>{
  const body=new URLSearchParams(await req.text());wire.push({path:new URL(req.url).pathname,...Object.fromEntries(body)})
  if(response==='uncertain')return new Response('interrupted',{status:503})
  if(response==='rejected')return Response.json({code:21610},{status:400})
  return Response.json({sid:'synthetic-terrace-222-'+wire.length},{status:201})
 }})
 try{
  const f=await h.command('portfolio.add',{name:'Alder Homes'}),p=await h.command('property.add',{portfolioId:f.id,name:'Alder House',address:'1840 Alder Street, Oakland, CA 94607',kind:'duplex',timeZone:'America/Los_Angeles'}),u=await h.command('unit.add',{propertyId:p.id,identifier:'1C',bedrooms:'2',bathrooms:'1'}),t=await h.command('tenancy.create',{...tenancyInput,unitId:u.id,timeZone:'America/Los_Angeles'})
  const member=await h.invite('member','message-preparer@example.test')
  const contactInput={tenancyId:t.id,kind:'resident',subjectId:t.id,phone:'+15005550006',timeZone:'America/Los_Angeles',emailConsent:'granted',smsConsent:'granted',reference:'Resident explicitly requested repair texts and email; identity and phone confirmed in recorded call'}
  await h.command('message.contact',contactInput,{status:403});await h.stepUp();await h.command('message.contact',contactInput,{as:member,status:403})
  const r=await h.command('message.contact',contactInput)
  const data=async()=>(await(await h.request('/api/messages?tenancyId='+t.id)).json())
  const prepare=(extra={})=>h.command('message.prepare',{contactId:r.id,channel:'sms',body:'The plumber will check the kitchen valve. Reply here with questions.',...extra})
  const approve=m=>h.command('message.approve',{messageId:m.id,version:m.version,consent:'APPROVE EXACT MESSAGE'})
  const send=(m,opts={})=>h.command('message.send',{messageId:m.id,version:m.version},opts)
  const callback=async(path,fields,signature=true)=>{
   const params=new URLSearchParams({AccountSid:twilio.accountSid,...fields}),sorted=[...params].sort(([a],[b])=>a<b?-1:a>b?1:0),signed=h.origin+path+sorted.map(([k,v])=>k+v).join('')
   return h.request(path,{method:'POST',as:'',form:params,headers:{'x-twilio-signature':signature?createHmac('sha1',twilio.authToken).update(signed).digest('base64'):'invalid'}})
  }
  await inspect?.({phase:'ready',h,t,r})
  const m=await prepare();await send(m,{status:409});const a=await approve(m),parallel=await h.atOnce([1,2].map(()=>['/api/commands',{method:'POST',body:{command:'message.send',messageId:a.id,version:a.version}}]));assert.deepEqual(parallel.map(x=>x.status).sort(),[200,409]);const firstSend=(await parallel.find(x=>x.status===200).json()).result
  assert.equal(firstSend.messageOutcome,'accepted',JSON.stringify({result:firstSend,message:(await data()).messages.find(x=>x.id===m.id)}))
  assert.equal(wire.at(-1).Body,(await data()).messages.find(x=>x.id===m.id).body)
  const sentCount=wire.length;await send(a,{status:409});assert.equal(wire.length,sentCount,'an approved attempt can be sent only once')
  let d=await data(),sent=d.messages.find(x=>x.id===m.id)
  assert.equal(sent.state,'accepted');assert.equal((await h.request('/api/messages?tenancyId='+t.id,{as:member})).status,403)
  const status={MessageSid:sent.provider_id,MessageStatus:'delivered',From:twilio.from,To:contactInput.phone,FutureField:'preserved in signature'}
  assert.equal((await callback('/api/twilio/status',status,false)).status,403)
  assert.equal((await callback('/api/twilio/status',{...status,AccountSid:'synthetic-terrace-228'})).status,403,'a signed event for another account cannot change delivery')
  assert.equal((await callback('/api/twilio/status',status)).status,200);assert.equal((await callback('/api/twilio/status',status)).status,200)
  await callback('/api/twilio/status',{...status,MessageStatus:'sent'})
  assert.equal((await data()).messages.find(x=>x.id===m.id).state,'delivered','late sent callback cannot regress a delivered outcome')
  const inbound={MessageSid:'synthetic-terrace-223',From:contactInput.phone,To:twilio.from,Body:'Will the plumber bring a replacement valve?',NumMedia:'0',NumSegments:'1'}
  assert.equal((await callback('/api/twilio/inbound',inbound,false)).status,403)
  assert.equal((await callback('/api/twilio/inbound',inbound)).status,200);await callback('/api/twilio/inbound',inbound)
  assert.equal((await data()).events.filter(x=>x.kind==='received').length,1,'a signed reply joins the shared thread once')
  await inspect?.({phase:'thread',h,t,r})
  // The current approved work and separately recorded permission are prerequisites to an arrival reply.
  const v=await h.command('vendor.add',{name:'River Plumbing',email:'river@example.test',phone:'510-555-0100',specialties:'plumbing',serviceAreas:'Oakland',w9:'received',insuranceExpires:'2036-12-31',licenseNumber:'RP-1',licenseExpires:'2036-12-31',availability:'Tuesday',rate:'95.00',standing:'approved'})
  const j=await h.command('maintenance.prepare',{tenancyId:t.id,title:'Kitchen valve repair',vendorId:v.id,trade:'plumbing',dueDate:'2026-10-27',estimate:'100.00'});await h.command('maintenance.approve',{jobId:j.id,version:1})
  const window={jobId:j.id,startsAt:'2026-10-27T09:00-07:00',endsAt:'2026-10-27T10:00-07:00',accessStartsAt:'2026-10-27T08:00-07:00',accessEndsAt:'2026-10-27T11:00-07:00',permission:'granted',permissionReference:'Resident permission recorded separately for Tuesday',noticeReference:'Staff recorded entry notice',noticeAt:'2026-10-25T09:00-07:00',keysAccess:'Resident opens door',availabilityReference:'Vendor call'}
  const ap=await h.command('appointment.book',window)
  await h.command('appointment.confirm',{appointmentId:ap.id,version:1,party:'vendor',outcome:'confirmed',reference:'Vendor email confirms Tuesday'})
  const arrival=await approve(await prepare({purpose:'arrival',appointmentId:ap.id}));await send(arrival)
  const apData=async()=>(await h.state(t.id)).work.appointments.find(x=>x.id===ap.id)
  assert.equal((await apData()).state,'proposed','unanswered arrival text cannot confirm the appointment')
  const y={...inbound,MessageSid:'synthetic-terrace-224',Body:'Y'}
  assert.equal((await callback('/api/twilio/inbound',y)).status,200);assert.equal((await apData()).state,'confirmed')
  const count=(await h.state(t.id)).work.appointmentEvents.filter(x=>x.party==='resident').length
  await callback('/api/twilio/inbound',y);assert.equal((await h.state(t.id)).work.appointmentEvents.filter(x=>x.party==='resident').length,count)
  await inspect?.({phase:'confirmed',h,t,r})
  await h.command('appointment.cancel',{appointmentId:ap.id,version:3,party:'vendor',reference:'Vendor portal cancellation recorded'})
  await callback('/api/twilio/inbound',{...y,MessageSid:'synthetic-terrace-225'});assert.equal((await apData()).state,'cancelled','a late Y never revives an ended appointment')
  const vendorContact=await h.command('message.contact',{tenancyId:t.id,kind:'vendor',subjectId:v.id,phone:'',timeZone:'America/Los_Angeles',emailConsent:'granted',reference:'Vendor explicitly requested appointment notifications at the assigned work email'})
  for(const contactId of [r.id,vendorContact.id]){const notification=await approve(await prepare({contactId,channel:'email',body:'The Tuesday morning appointment was cancelled by the vendor. Please review a new permitted window.'}));await send(notification)}
  assert.equal(h.messages.filter(x=>x.text?.includes('Tuesday morning appointment was cancelled')).length,2,'both parties receive separately approved cancellation notices at the mail boundary')
  const nextAppointment=await h.command('appointment.book',{...window,previousId:ap.id,reason:'Vendor cancelled; resident gave fresh permission',startsAt:'2026-10-27T13:00-07:00',endsAt:'2026-10-27T14:00-07:00',accessStartsAt:'2026-10-27T12:00-07:00',accessEndsAt:'2026-10-27T15:00-07:00',permissionReference:'New afternoon permission'})
  const nextArrival=await approve(await prepare({purpose:'arrival',appointmentId:nextAppointment.id}));await send(nextArrival)
  await callback('/api/twilio/inbound',{...y,MessageSid:'synthetic-terrace-229'})
  assert.equal((await h.state(t.id)).work.appointments.find(x=>x.id===nextAppointment.id).resident_confirmed_at,null,'a delayed Y cannot be guessed to refer to a different arrival window')
  await h.command('maintenance.revise',{jobId:j.id,version:2,scope:'Add the supply hose; requires renewed approval'})
  await callback('/api/twilio/inbound',{...y,MessageSid:'synthetic-terrace-227'})
  assert.equal((await h.state(t.id)).work.appointments.find(x=>x.id===nextAppointment.id).resident_confirmed_at,null,'a reply to superseded work terms supplies no confirmation')
  response='rejected';const failed=await approve(await prepare());await send(failed);assert.equal((await data()).messages.find(x=>x.id===failed.id).state,'rejected')
  response='uncertain';const unknown=await approve(await prepare());await send(unknown);await h.restart();await h.stepUp();await send(unknown,{status:409})
  response='accepted'
  // Quiet hours hold the attempted send and never put it on a scheduler.
  const quiet=await h.command('message.contact',{...contactInput,timeZone:'Asia/Tokyo',version:1}),held=await approve(await prepare());const beforeQuiet=wire.length;await send(held);assert.equal(wire.length,beforeQuiet);assert.equal((await data()).messages.find(x=>x.id===held.id).state,'suppressed')
  await h.command('message.contact',{...contactInput,version:quiet.version})
  const pending=await approve(await prepare())
  await callback('/api/twilio/inbound',{...inbound,MessageSid:'synthetic-terrace-226',Body:'STOP'})
  const stoppedCount=wire.length;await send(pending);assert.equal(wire.length,stoppedCount);assert.equal((await data()).messages.find(x=>x.id===pending.id).state,'suppressed')
  await h.command('message.contact',{...contactInput,version:(await data()).contacts[0].version},{status:409})
  await inspect?.({phase:'opted-out',h,t,r})
  const accessResponse=await h.request('/api/resident-access?tenancyId='+t.id),access=await accessResponse.json();assert.equal(accessResponse.status,200,JSON.stringify(access));assert.ok(access.repairMessages.some(x=>x.event?.includes('STOP')))
  const archive=await(await h.request('/api/backup')).blob(),readable=Buffer.from(await(await h.request('/api/readable-export')).arrayBuffer());assert.ok(readable.includes(Buffer.from(inbound.Body)),'readable export contains the actual received message')
  const restored=await installation({now:clock,asyncDatabase:true,twilio,twilioRequest:async()=>{throw Error('restored evidence must never send')}})
  try{const form=new FormData();form.set('command','data.restore');form.set('confirm','RESTORE');form.set('backup',archive,'messages.rer');assert.equal((await restored.request('/api/commands',{method:'POST',form})).status,200)
   const after=await(await restored.request('/api/messages?tenancyId='+t.id)).json();assert.equal(after.messages.length,(await data()).messages.length);assert.ok(after.events.some(x=>x.kind==='received'));await restored.stepUp();await restored.command('message.send',{messageId:pending.id,version:after.messages.find(x=>x.id===pending.id).version},{status:409})
  }finally{await restored.close()}
  const header=(await readFile('fixtures/terrace-tenancies.csv','utf8')).split('\n')[0],csv=header+'\nmessage-import,1 Synthetic Terrace Road,Rowan Ellis,rowan@example.test,Imported Resident,message-import@example.test,2025-01-01,2026-12-31,620.00,weekly,2025-01-01T00:00:00.000Z\n'
  const preview=await h.command('import.preview',{csv,namespace:'message-import'}),applied=await h.command('import.apply',{csv,namespace:'message-import',fingerprint:preview.fingerprint}),importedId=preview.rows[0].targetId
  await h.command('message.contact',{...contactInput,tenancyId:importedId,subjectId:importedId,phone:'',smsConsent:'unknown',reference:'Imported resident explicitly requested repair email'})
  const undo=await h.command('import.undo',{jobId:applied.job.id},{status:409});assert.equal(undo.error,'import_conflict','contact evidence protects an imported tenancy from undo')
  const paging=await installation({assets,now:clock,asyncDatabase:true,twilio,twilioRequest:async req=>{wire.push({path:new URL(req.url).pathname,...Object.fromEntries(new URLSearchParams(await req.text()))});return Response.json({sid:'synthetic-terrace-240-'+wire.length},{status:201})}})
  try{
  const h=paging,f=await h.command('portfolio.add',{name:'Safety portfolio'}),p=await h.command('property.add',{portfolioId:f.id,name:'Alder House',address:'1840 Alder Street, Oakland, CA 94607',kind:'duplex',timeZone:'America/Los_Angeles'}),u=await h.command('unit.add',{propertyId:p.id,identifier:'1C',bedrooms:'2',bathrooms:'1'}),t=await h.command('tenancy.create',{...tenancyInput,unitId:u.id,timeZone:'America/Los_Angeles'})
  const data=async()=>(await(await h.request('/api/messages?tenancyId='+t.id)).json()),prepare=p=>h.command('message.prepare',p),approve=m=>h.command('message.approve',{messageId:m.id,version:m.version,consent:'APPROVE EXACT MESSAGE'}),send=m=>h.command('message.send',{messageId:m.id,version:m.version})
  const callback=async(path,fields)=>{const params=new URLSearchParams({AccountSid:twilio.accountSid,...fields}),signed=h.origin+path+[...params].sort(([a],[b])=>a<b?-1:a>b?1:0).map(([k,v])=>k+v).join('');return h.request(path,{method:'POST',as:'',form:params,headers:{'x-twilio-signature':createHmac('sha1',twilio.authToken).update(signed).digest('base64')}})}
  // Pages remain manual; provider completion never substitutes for a named human acknowledgement.
  const people=await(await h.request('/auth/operators')).json(),ownerId=people.find(x=>x.email==='owner@example.test').id
  await h.stepUp();await h.command('operator.invite',{displayName:'Evening backup',email:'message-backup@example.test',role:'portfolio_manager',['portfolio:'+f.id]:'1'})
  const backupCookie=await h.accept('message-backup@example.test'),backupId=(await(await h.request('/auth/operators')).json()).find(x=>x.email==='message-backup@example.test').id
  await h.command('emergency.guidance',{risk:'gas',guidance:'Leave the unit and wait outside.',callInstruction:'Call 911 and the gas utility from a safe place.'})
  await h.command('emergency.oncall',{portfolioId:f.id,primaryId:ownerId,backupId})
  const emergency=await h.command('emergency.report',{tenancyId:t.id,risk:'gas',emergency:'yes',channel:'phone',reporter:'Resident called the office',description:'Gas smell in the kitchen'})
  const responder=await h.command('message.contact',{...contactInput,tenancyId:t.id,kind:'responder',subjectId:ownerId,phone:'+15005550006',emailConsent:'unknown',voiceConsent:'granted',smsConsent:'unknown',reference:'On-call owner explicitly consented to voice pages at this number'})
  const page=await approve(await prepare({contactId:responder.id,purpose:'page',channel:'voice',emergencyId:emergency.id}));await send(page)
  const paged=(await data()).messages.find(x=>x.id===page.id)
  assert.ok(wire.at(-1).Twiml.includes(paged.body));assert.ok(!wire.at(-1).Twiml.includes('Gas smell in the kitchen'),'a page carries no case details')
  await callback('/api/twilio/status',{CallSid:paged.provider_id,CallStatus:'completed',To:'+15005550006',From:twilio.from})
  const caseData=async()=>(await(await h.request('/api/emergencies')).json()).cases.find(x=>x.id===emergency.id)
  assert.equal((await caseData()).state,'open','voice completed is never a person acknowledgement')
  const backupContact=await h.command('message.contact',{...contactInput,tenancyId:t.id,kind:'responder',subjectId:backupId,phone:'+15005550006',voiceConsent:'unknown',smsConsent:'granted',reference:'Backup explicitly agreed to receive safety text pages'})
  const backupPage=await approve(await prepare({contactId:backupContact.id,purpose:'page',channel:'sms',emergencyId:emergency.id}));await send(backupPage)
  assert.equal(wire.at(-1).Body,(await data()).messages.find(x=>x.id===backupPage.id).body)

  await h.command('emergency.acknowledge',{emergencyId:emergency.id,version:1,reference:'Owner called utility and is waiting outside'})
  await h.command('message.prepare',{contactId:responder.id,purpose:'page',channel:'voice',emergencyId:emergency.id},{status:409})
  assert.equal((await h.request('/api/messages?tenancyId='+t.id,{as:backupCookie})).status,200)
  const other=await h.command('portfolio.add',{name:'Other portfolio'}),op=await h.command('property.add',{portfolioId:other.id,name:'Other house',address:'2 Other Road',kind:'duplex',timeZone:'America/Los_Angeles'}),ou=await h.command('unit.add',{propertyId:op.id,identifier:'A',bedrooms:'1',bathrooms:'1'}),ot=await h.command('tenancy.create',{...tenancyInput,unitId:ou.id,tenantEmail:'other-resident@example.test'})
  assert.equal((await h.request('/api/messages?tenancyId='+ot.id,{as:backupCookie})).status,404)
  assert.equal((await h.request('/app?tab=messages&tenancy='+ot.id,{as:backupCookie})).status,404)
  await inspect?.({phase:'complete',h,t,r:null})
  }finally{await paging.close()}
 }finally{await h.close()}
}
if(process.argv[1]===import.meta.filename)await journey()
