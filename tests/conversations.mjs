import {createHmac} from 'node:crypto'
import assert from 'node:assert/strict'
import {installation,tenancyInput} from './api/harness.mjs'
export async function journey({assets=false,inspect}={}){
 const wire=[],twilio={accountSid:'synthetic-terrace-310',authToken:'synthetic-terrace-311',from:'+15005550006',mode:'test'}
 const h=await installation({twilio,twilioRequest:async req=>{wire.push(Object.fromEntries(new URLSearchParams(await req.text())));return Response.json({sid:'synthetic-terrace-312-'+wire.length},{status:201})},assets,now:'2026-10-27T18:00:00.000Z',asyncDatabase:true})
 try{
  const make=async(name,email)=>{
   const f=await h.command('portfolio.add',{name}),p=await h.command('property.add',{portfolioId:f.id,name,address:name+' Street',kind:'duplex',timeZone:'America/Los_Angeles'}),u=await h.command('unit.add',{propertyId:p.id,identifier:'1',bedrooms:'2',bathrooms:'1'}),t=await h.command('tenancy.create',{...tenancyInput,unitId:u.id,tenantEmail:email})
   return{f,p,t}
  }
  const a=await make('Alder','alder@example.test'),b=await make('Birch','birch@example.test'),member=await h.invite('member','note-preparer@example.test')
  const owner=(await(await h.request('/auth/operators')).json()).find(x=>x.email==='owner@example.test')
  for(const command of ['conversation.note','conversation.assign','conversation.broadcast'])await h.command(command,{tenancyId:a.t.id,body:'synthetic-terrace-301 private repair access detail',assigneeId:owner.id,version:0,channel:'email'},{status:403})
  await h.stepUp()
  await h.command('operator.invite',{email:'conversation-manager@example.test',displayName:'Alder Manager',role:'portfolio_manager',['portfolio:'+a.f.id]:'1'})
  const manager=await h.accept('conversation-manager@example.test'),managerId=(await(await h.request('/auth/operators')).json()).find(x=>x.email==='conversation-manager@example.test').id
  const credential=await h.command('credential.mint',{label:'Conversation read probe',role:'portfolio_manager',scope:'read',['portfolio:'+a.f.id]:'1'})
  assert.equal((await h.request('/api/conversations?tenancyId='+a.t.id,{as:'',headers:{authorization:'Bearer '+credential.token}})).status,403)
  const data=async(t=a.t.id,as=h.cookie)=>(await h.request('/api/conversations?tenancyId='+t,{as})).json()
  const initial=await data();assert.equal(initial.assignment,null);assert.deepEqual(initial.events,[])
  await h.command('conversation.assign',{tenancyId:a.t.id,assigneeId:managerId,version:0})
  await h.command('conversation.assign',{tenancyId:a.t.id,assigneeId:owner.id,version:0},{status:409})
  await h.command('conversation.assign',{tenancyId:b.t.id,assigneeId:managerId,version:0},{status:404})
  await h.command('conversation.note',{tenancyId:a.t.id,body:'synthetic-terrace-301 private repair access detail'})
  await h.command('conversation.note',{tenancyId:b.t.id,body:'synthetic-terrace-302 private other building'})
  let d=await data();assert.equal(d.assignment.assignee_id,managerId);assert.equal(d.assignment.version,1);assert.deepEqual(d.events.map(x=>x.kind),['assigned','private_note']);assert.equal(d.events[1].body,'synthetic-terrace-301 private repair access detail');assert.equal(d.events[1].actor,owner.id);assert.equal(d.events[1].actor_name,'Terrace owner')
  assert.equal((await h.request('/api/conversations?tenancyId='+a.t.id,{as:member})).status,403)
  assert.equal((await h.request('/api/conversations?tenancyId='+b.t.id,{as:manager})).status,404)
  assert.equal((await h.request('/app?tab=messages&tenancy='+b.t.id,{as:manager})).status,404)
  await h.command('conversation.note',{tenancyId:a.t.id,body:'Forbidden note'},{as:member,status:403})
  await h.stepUp('conversation-manager@example.test',manager)
  for(const cmd of ['conversation.note','conversation.assign'])await h.command(cmd,{tenancyId:b.t.id,body:'Forbidden note',assigneeId:managerId,version:0},{as:manager,status:404})
  const search=await(await h.request('/api/conversations?q=synthetic-terrace',{as:manager})).json();assert.deepEqual(search.results.map(x=>x.body),['synthetic-terrace-301 private repair access detail'])
  assert.deepEqual((await(await h.request('/api/conversations?q=302',{as:manager})).json()).results,[])
  assert.equal((await h.request('/api/conversations?q=301',{as:member})).status,403)
  await h.command('portal.invite',{kind:'resident',tenancyId:a.t.id,email:'alder@example.test',displayName:'Alder Resident',source:'Primary resident identity confirmed against the lease'})
  const resident=await h.portalSignIn('alder@example.test')
  const residentView=await h.request('/portal/api/resident?tenancyId='+a.t.id,{as:resident});assert.equal(residentView.status,200);assert.ok(!(await residentView.text()).includes('synthetic-terrace-301'))
  assert.equal((await h.request('/portal/api/resident?tenancyId='+b.t.id,{as:resident})).status,404)
  assert.equal((await h.request('/api/conversations?tenancyId='+a.t.id,{as:resident})).status,401)
  const u2=await h.command('unit.add',{propertyId:a.p.id,identifier:'2',bedrooms:'1',bathrooms:'1'}),t2=await h.command('tenancy.create',{...tenancyInput,unitId:u2.id,tenantName:'Second Resident',tenantEmail:'second@example.test'})
  const noticeBody='Water shutoff in Alder, October 28 from 9 to 11 a.m. Please store drinking water.'
  await h.command('conversation.broadcast',{tenancyId:a.t.id,channel:'sms',body:noticeBody},{status:409})
  assert.deepEqual((await(await h.request('/api/messages?tenancyId='+a.t.id)).json()).messages,[],'missing permission refuses atomically before creating any draft')
  for(const t of [a.t,t2])await h.command('message.contact',{tenancyId:t.id,kind:'resident',subjectId:t.id,phone:'+15005550006',timeZone:'America/Los_Angeles',smsConsent:'granted',emailConsent:'granted',reference:'Named resident explicitly requested building repair notices at this recorded address and number'})
  const broadcast=await h.command('conversation.broadcast',{tenancyId:a.t.id,channel:'sms',body:noticeBody})
  assert.deepEqual(broadcast.recipients.map(x=>x.tenancyId).sort(),[a.t.id,t2.id].sort());assert.equal(wire.length,0,'preparing a broadcast sends nothing')
  for(const [i,r] of broadcast.recipients.entries()){
   const approved=await h.command('message.approve',{messageId:r.messageId,version:1,consent:'APPROVE EXACT MESSAGE'});await h.command('message.send',{messageId:r.messageId,version:approved.version})
   assert.equal(wire.at(-1).Body,noticeBody)
   const message=(await(await h.request('/api/messages?tenancyId='+r.tenancyId)).json()).messages.find(x=>x.id===r.messageId)
   const params=new URLSearchParams({AccountSid:twilio.accountSid,MessageSid:message.provider_id,From:twilio.from,To:wire.at(-1).To,MessageStatus:i?'undelivered':'delivered'}),path='/api/twilio/status',canonical=h.origin+path+[...params].sort(([a],[b])=>a<b?-1:a>b?1:0).map(([k,v])=>k+v).join('')
   const response=await h.request(path,{method:'POST',as:'',form:params,headers:{'x-twilio-signature':createHmac('sha1',twilio.authToken).update(canonical).digest('base64')}});assert.equal(response.status,200)
   await h.command('message.send',{messageId:r.messageId,version:approved.version},{status:409})
  }
  assert.equal(wire.length,2)
  assert.deepEqual((await data()).notices.map(n=>n.state),['delivered','undelivered'])
  assert.deepEqual((await data(b.t.id)).notices,[],'another building has no recipient or notice')
  const visible=await h.request('/portal/api/conversation?tenancyId='+a.t.id,{as:resident});assert.equal(visible.status,200);const projection=await visible.json();assert.deepEqual(projection.messages.map(x=>x.body),[noticeBody]);assert.ok(!JSON.stringify(projection).includes('synthetic-terrace-301'))
  assert.equal((await h.request('/portal/api/conversation?tenancyId='+t2.id,{as:resident})).status,404)
  assert.equal((await h.request('/portal/api/conversation?tenancyId='+b.t.id,{as:resident})).status,404)
  await inspect?.({h,t:a.t,managerId,phase:'assigned'})
  d=await data()
  await h.restart();assert.equal((await data()).assignment.assignee_id,managerId);assert.deepEqual((await data()).events.map(x=>x.body),d.events.map(x=>x.body))
  const readable=Buffer.from(await(await h.request('/api/readable-export')).arrayBuffer());assert.ok(readable.includes(Buffer.from('synthetic-terrace-301 private repair access detail')));assert.ok(readable.includes(Buffer.from(managerId)))
  const archive=await(await h.request('/api/backup')).blob(),restored=await installation({now:'2026-10-27T18:00:00.000Z',asyncDatabase:true})
  try{
   const form=new FormData();form.set('command','data.restore');form.set('confirm','RESTORE');form.set('backup',archive,'conversations.rer');assert.equal((await restored.request('/api/commands',{method:'POST',form})).status,200)
   const r=await(await restored.request('/api/conversations?tenancyId='+a.t.id)).json();assert.deepEqual(r.events,d.events);assert.deepEqual(r.assignment,d.assignment);assert.deepEqual(r.notices,d.notices);assert.ok(!r.assignees.some(x=>x.id===managerId),'archived assignment grants no staff authority in a fresh installation')
  }finally{await restored.close()}
  await h.stepUp();await h.command('operator.status',{operatorId:managerId,status:'inactive'})
  await h.command('conversation.assign',{tenancyId:a.t.id,assigneeId:managerId,version:d.assignment.version},{status:404})
  assert.equal((await h.request('/api/conversations?tenancyId='+a.t.id,{as:manager})).status,401)
  assert.equal((await data()).events.length,d.events.length,'all refused commands leave history unchanged')
 }finally{await h.close()}
}
if(process.argv[1]===import.meta.filename)await journey()
