import assert from 'node:assert/strict'
import {installation,tenancyInput} from './api/harness.mjs'
export async function journey({assets=false,inspect}={}){
 let mailMode='accepted'
 const h=await installation({assets,mailResponse:message=>message.subject==='Your Terrace owner report is ready'?(mailMode==='accepted'?Response.json({id:'synthetic-terrace-report-message'}):new Response('',{status:mailMode==='rejected'?400:mailMode==='limited'?429:500})):Response.json({id:crypto.randomUUID()})})
 try{
  const portfolio=await h.command('portfolio.add',{name:'Scheduled reports'}),property=await h.command('property.add',{portfolioId:portfolio.id,name:'Alder',address:'1 Alder Lane',kind:'duplex',timeZone:Intl.supportedValuesOf('timeZone').find(z=>z.endsWith('Los_Angeles'))}),unit=await h.command('unit.add',{propertyId:property.id,identifier:'A',bedrooms:2,bathrooms:1}),owner=await h.command('owner.add',{kind:'individual',legalName:'Alder Owner',email:'alder@example.test',mailingAddress:'1 Alder Lane'})
  await h.command('ownership.set',{propertyId:property.id,effectiveFrom:'2025-01-01',reason:'synthetic-terrace-1',shares:[{ownerId:owner.id,percent:'100'}]})
  const tenancy=await h.command('tenancy.create',{...tenancyInput,unitId:unit.id})
  const next=new Date(Date.now()+9*3600000);next.setUTCHours(0,0,0,0);next.setUTCDate(next.getUTCDate()+1);next.setTime(next.getTime()-9*3600000)
  const local=new Intl.DateTimeFormat('en-CA',{timeZone:Intl.supportedValuesOf('timeZone').find(z=>z.endsWith('Tokyo'))}).format(next),starts=local.slice(0,7),day=Number(local.slice(8))
  const base={name:'Owner financial generation',kind:'financial',propertyId:property.id,ownerId:owner.id,basis:'accrual',zone:Intl.supportedValuesOf('timeZone').find(z=>z.endsWith('Tokyo')),starts,dayOfMonth:day,hour:0,requireClose:false,reference:'synthetic-terrace-2 explicit review',consent:'GENERATE ONLY'}
  const priorMonth=new Date(Date.parse(starts+'-01')-86400000).toISOString().slice(0,7)
  const income=await h.command('rent.charge',{tenancyId:tenancy.id,dueDate:priorMonth+'-01',amount:'100.00',description:'Recorded rent',reference:'synthetic-terrace-16'})
  await h.command('rent.receipt',{chargeId:income.id,amount:'100.00',receivedDate:priorMonth+'-02',reference:'synthetic-terrace-17',method:'ach'})
  const get=async()=>{const response=await h.request('/api/report-schedules');assert.equal(response.status,200);return response.json()}
  await h.command('report.schedule',{...base,consent:''},{status:400});await h.command('report.schedule',{...base,zone:'synthetic-terrace-unknown'},{status:400});await h.command('report.schedule',{...base,dayOfMonth:32},{status:400});await h.command('report.schedule',{...base,kind:'unknown'},{status:400})
  assert.equal((await get()).schedules.length,0)
  const schedule=await h.command('report.schedule',base),closed=await h.command('report.schedule',{...base,name:'Closed period only',requireClose:true})
  const emailCount=h.messages.length
  await h.scheduled(next.getTime()-60000)
  assert.equal((await get()).generations.length,0,'not due before the timezone boundary')
  await Promise.all([h.scheduled(next.getTime()),h.scheduled(next.getTime())])
  let data=await get();assert.equal(data.generations.length,1,'one generation despite concurrent Cron deliveries');assert.equal(data.generations[0].schedule_id,schedule.id)
  assert.ok(!data.generations.some(g=>g.schedule_id===closed.id),'open month holds a close-required schedule without consuming the generation key')
  assert.equal(h.messages.length,emailCount,'generation never sends mail')
  const generation=data.generations[0],read=()=>h.request('/api/report-generation?id='+generation.id)
  let response=await read();assert.equal(response.status,200,await response.clone().text());const generated=await response.json();assert.equal(generated.generation.generation_version,1);assert.equal(generated.data.filters.ownerId,owner.id)
  assert.ok(generation.fingerprint);assert.equal(generation.report_from.slice(0,7),new Date(Date.parse(starts+'-01')-86400000).toISOString().slice(0,7))
  await h.restart();await h.scheduled(next.getTime()+3600000);assert.deepEqual((await get()).generations,data.generations)
  const member=await h.invite('member','reports-member@example.test')
  for(const path of ['/api/report-schedules','/api/report-generation?id='+generation.id,'/app?tab=report-schedules'])assert.equal((await h.request(path,{as:member})).status,403)
  await h.command('report.generate',{}, {as:member,status:403});await h.command('report.schedule',base,{as:member,status:403})
  // Existing owner portal projections are the sole recipient payload; the private link grants no authority.
  await h.stepUp()
  const people=[]
  for(let i=0;i<6;i++){
   const email='reports-'+i+'@example.test',g=await h.command('portal.invite',{kind:'owner',ownerId:owner.id,email,displayName:'Report owner '+i,source:'synthetic-terrace-6 recipient authority'})
   const cookie=await h.portalSignIn(email);people.push({...g,email,cookie})
  }
  const prepare=async(person,extra={})=>h.command('report.delivery.prepare',{generationId:generation.id,grantId:person.grantId,fingerprint:generation.fingerprint,reference:'synthetic-terrace-7 report consent',consent:'DELIVER OWNER REPORT',...extra})
  const send=(d,extra={})=>h.command('report.delivery.send',{deliveryId:d.id,fingerprint:d.fingerprint,consent:'SEND LINK',reference:'synthetic-terrace-8 send consent',...extra})
  await h.command('report.delivery.prepare',{generationId:generation.id,grantId:people[0].grantId,fingerprint:generation.fingerprint,consent:''},{status:400})
  const revoked=await prepare(people[0]);await h.command('portal.revoke',{grantId:people[0].grantId,reason:'synthetic-terrace-9 revoke before send'})
  const beforeRevoked=h.messages.length
  await h.command('report.delivery.send',{deliveryId:revoked.id,fingerprint:revoked.fingerprint,consent:'SEND LINK',reference:'synthetic-terrace-10'},{status:409})
  assert.equal(h.messages.length,beforeRevoked,'revocation before delivery sends nothing')
  const delivery=await prepare(people[1]),frozen=await(await h.request('/api/report-delivery?id='+delivery.id)).json()
  assert.equal(frozen.statement.owner.id,owner.id);assert.equal(frozen.fingerprint,delivery.fingerprint)
  const sentBefore=h.messages.length,body={command:'report.delivery.send',deliveryId:delivery.id,fingerprint:delivery.fingerprint,consent:'SEND LINK',reference:'synthetic-terrace-11'}
  const races=await h.atOnce([['/api/commands',{method:'POST',body}],['/api/commands',{method:'POST',body}]])
  assert.deepEqual(races.map(r=>r.status).sort(),[200,409]);assert.equal(h.messages.length,sentBefore+1,'one authorized mail submission despite simultaneous sends')
  const message=h.messages.at(-1);assert.deepEqual(message.to,[people[1].email]);assert.ok(!message.text.includes('Alex Chen'),'email carries only a session-protected link')
  const link='/portal/report?id='+delivery.id
  assert.equal((await h.request(link,{as:''})).status,401);assert.equal((await h.request(link,{as:people[2].cookie})).status,404)
  let delivered=await h.request(link+'&format=json',{as:people[1].cookie});assert.equal(delivered.status,200);assert.deepEqual(await delivered.json(),frozen.statement)
  await h.restart();assert.equal((await h.request(link,{as:people[1].cookie})).status,200,'durable report and receipt survive worker restart')
  await h.command('report.delivery.send',body,{status:409});assert.equal(h.messages.length,sentBefore+1,'accepted submissions never retry')
  await h.command('report.delivery.outcome',{deliveryId:delivery.id,outcome:'delivered',reference:'synthetic-terrace-12 provider delivery evidence'})
  const bounced=await prepare(people[2]);await send(bounced)
  await h.command('report.delivery.outcome',{deliveryId:bounced.id,outcome:'bounced',reference:'synthetic-terrace-13 provider bounce evidence'})
  const bounceRow=(await get()).deliveries.find(d=>d.id===bounced.id);assert.equal(bounceRow.state,'bounced');assert.match(bounceRow.next_action,/Failed-delivery task/)
  assert.equal((await h.request('/portal/report?id='+bounced.id,{as:people[2].cookie})).status,404)
  const retry=await prepare(people[3]);mailMode='limited';assert.equal((await send(retry)).emailOutcome,'rate_limited');mailMode='accepted';assert.equal((await send(retry)).emailOutcome,'accepted','a definitive rate limit can be explicitly retried after a live recheck')
  const uncertain=await prepare(people[4]);mailMode='uncertain';assert.equal((await send(uncertain)).emailOutcome,'uncertain');mailMode='accepted'
  await h.restart();await h.command('report.delivery.send',{deliveryId:uncertain.id,fingerprint:uncertain.fingerprint,consent:'SEND LINK',reference:'synthetic-terrace-14'},{status:409})
  const native=await prepare(people[5])
  const nativeProof={native,person:people[5],delivered:delivery,recipient:people[1],link,frozen}
  for(const path of ['/api/report-delivery?id='+delivery.id])assert.equal((await h.request(path,{as:member})).status,403)
  await h.command('report.delivery.outcome',{deliveryId:delivery.id,outcome:'bounced',reference:'synthetic-terrace-15'},{as:member,status:403})
  const archive=await(await h.request('/api/backup')).text(),fresh=await installation()
  try{await fresh.formCommand('data.restore',{confirm:'RESTORE',backup:new File([archive],'reports.rer')});const restored=await(await fresh.request('/api/report-schedules')).json();assert.deepEqual(restored.generations,data.generations);assert.deepEqual(restored.deliveries,[],'private recipient snapshots and grants are never regranted by restore');assert.equal((await fresh.request('/api/report-generation?id='+generation.id)).status,409,'restoring data grants no original configurer authority')}finally{await fresh.close()}
  for(const item of ['receipts','deposits','exceptions'])await h.command('period.signoff',{month:generation.report_from.slice(0,7),item})
  await h.command('period.close',{month:generation.report_from.slice(0,7)})
  await h.scheduled(next.getTime()+7200000);assert.equal((await get()).generations.length,2,'closing the period releases the held schedule')
  const closeGeneration=(await get()).generations.find(g=>g.schedule_id===closed.id)
  assert.equal((await h.request('/api/report-generation?id='+closeGeneration.id)).status,200)
  await h.command('period.reopen',{month:generation.report_from.slice(0,7),reason:'synthetic-terrace-4 reviewed correction'})
  assert.equal((await h.request('/api/report-generation?id='+closeGeneration.id)).status,409,'a reopened period invalidates the close-required generation link')
  if(inspect)await inspect({h,base,schedule,generation,...nativeProof})
  const changed=await h.command('rent.charge',{tenancyId:tenancy.id,dueDate:generation.report_from,amount:'20.00',description:'New recorded source',reference:'synthetic-terrace-3 new source'})
  response=await read();assert.equal(response.status,409);await h.command('rent.receipt',{chargeId:changed.id,amount:'20.00',receivedDate:generation.report_from,reference:'synthetic-terrace-18',method:'ach'});assert.equal((await h.request(link,{as:people[1].cookie})).status,404,'changed statement sources never substitute new contents in an old recipient link');assert.equal((await response.json()).error,'report_changed','changed sources never silently substitute a new report under an old fingerprint')
  await h.command('report.retire',{scheduleId:schedule.id});assert.equal((await read()).status,409)
  await h.scheduled(next.getTime()+7200000);assert.equal((await get()).generations.length,2)
  const changedOwner=await h.command('owner.add',{kind:'individual',legalName:'New Alder Owner',email:'new-alder@example.test',mailingAddress:'1 Alder Lane'})
  await h.command('ownership.set',{propertyId:property.id,effectiveFrom:starts+'-01',reason:'synthetic-terrace-21 transfer',shares:[{ownerId:changedOwner.id,percent:'100'}]})
  assert.equal((await h.request('/portal/report?id='+retry.id,{as:people[3].cookie})).status,401,'ownership changes end the intended recipient session immediately')
  const clamped=await h.command('report.schedule',{...base,name:'Month end clamp',starts:'2027-02',dayOfMonth:31})
  await h.scheduled(Date.parse('2027-02-27T14:59:00Z'));assert.ok(!(await get()).generations.some(g=>g.schedule_id===clamped.id))
  await h.scheduled(Date.parse('2027-02-27T15:00:00Z'));assert.ok((await get()).generations.some(g=>g.schedule_id===clamped.id&&g.local_month==='2027-02'),'day 31 clamps to February end in the schedule zone')
 }finally{await h.close()}
}
