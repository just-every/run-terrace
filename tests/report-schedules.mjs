import assert from 'node:assert/strict'
import {installation,tenancyInput} from './api/harness.mjs'
export async function journey({assets=false,inspect}={}){
 const h=await installation({assets})
 try{
  const portfolio=await h.command('portfolio.add',{name:'Scheduled reports'}),property=await h.command('property.add',{portfolioId:portfolio.id,name:'Alder',address:'1 Alder Lane',kind:'duplex',timeZone:Intl.supportedValuesOf('timeZone').find(z=>z.endsWith('Los_Angeles'))}),unit=await h.command('unit.add',{propertyId:property.id,identifier:'A',bedrooms:2,bathrooms:1}),owner=await h.command('owner.add',{kind:'individual',legalName:'Alder Owner',email:'alder@example.test',mailingAddress:'1 Alder Lane'})
  await h.command('ownership.set',{propertyId:property.id,effectiveFrom:'2025-01-01',reason:'synthetic-terrace-1',shares:[{ownerId:owner.id,percent:'100'}]})
  const tenancy=await h.command('tenancy.create',{...tenancyInput,unitId:unit.id})
  const next=new Date(Date.now()+9*3600000);next.setUTCHours(0,0,0,0);next.setUTCDate(next.getUTCDate()+1);next.setTime(next.getTime()-9*3600000)
  const local=new Intl.DateTimeFormat('en-CA',{timeZone:Intl.supportedValuesOf('timeZone').find(z=>z.endsWith('Tokyo'))}).format(next),starts=local.slice(0,7),day=Number(local.slice(8))
  const base={name:'Owner financial generation',kind:'financial',propertyId:property.id,ownerId:owner.id,basis:'accrual',zone:Intl.supportedValuesOf('timeZone').find(z=>z.endsWith('Tokyo')),starts,dayOfMonth:day,hour:0,requireClose:false,reference:'synthetic-terrace-2 explicit review',consent:'GENERATE ONLY'}
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
  const archive=await(await h.request('/api/backup')).text(),fresh=await installation()
  try{await fresh.formCommand('data.restore',{confirm:'RESTORE',backup:new File([archive],'reports.rer')});const restored=await(await fresh.request('/api/report-schedules')).json();assert.deepEqual(restored.generations,data.generations);assert.equal((await fresh.request('/api/report-generation?id='+generation.id)).status,409,'restoring data grants no original configurer authority')}finally{await fresh.close()}
  for(const item of ['receipts','deposits','exceptions'])await h.command('period.signoff',{month:generation.report_from.slice(0,7),item})
  await h.command('period.close',{month:generation.report_from.slice(0,7)})
  await h.scheduled(next.getTime()+7200000);assert.equal((await get()).generations.length,2,'closing the period releases the held schedule')
  const closeGeneration=(await get()).generations.find(g=>g.schedule_id===closed.id)
  assert.equal((await h.request('/api/report-generation?id='+closeGeneration.id)).status,200)
  await h.command('period.reopen',{month:generation.report_from.slice(0,7),reason:'synthetic-terrace-4 reviewed correction'})
  assert.equal((await h.request('/api/report-generation?id='+closeGeneration.id)).status,409,'a reopened period invalidates the close-required generation link')
  if(inspect)await inspect({h,base,schedule,generation})
  await h.command('rent.charge',{tenancyId:tenancy.id,dueDate:generation.report_from,amount:'20.00',description:'New recorded source',reference:'synthetic-terrace-3 new source'})
  response=await read();assert.equal(response.status,409);assert.equal((await response.json()).error,'report_changed','changed sources never silently substitute a new report under an old fingerprint')
  await h.command('report.retire',{scheduleId:schedule.id});assert.equal((await read()).status,409)
  await h.scheduled(next.getTime()+7200000);assert.equal((await get()).generations.length,2)
  const clamped=await h.command('report.schedule',{...base,name:'Month end clamp',starts:'2027-02',dayOfMonth:31})
  await h.scheduled(Date.parse('2027-02-27T14:59:00Z'));assert.ok(!(await get()).generations.some(g=>g.schedule_id===clamped.id))
  await h.scheduled(Date.parse('2027-02-27T15:00:00Z'));assert.ok((await get()).generations.some(g=>g.schedule_id===clamped.id&&g.local_month==='2027-02'),'day 31 clamps to February end in the schedule zone')
 }finally{await h.close()}
}
