// WORK-006: public-door dispatch, progress, missed-commitment escalation and reassignment.
import assert from 'node:assert/strict'
import {installation,tenancyInput} from './api/harness.mjs'
const tasks=['Isolate water supply','Replace inlet valve','Test for leaks']
const zone='America/Los_Angeles'
const day=offset=>new Intl.DateTimeFormat('en-CA',{timeZone:zone}).format(Date.now()+offset*86400000)
const at=(date,hour)=>`${date}T${hour}:00${new Intl.DateTimeFormat('en-US',{timeZone:zone,timeZoneName:'longOffset'}).formatToParts(new Date(date+'T20:00:00Z')).find(p=>p.type==='timeZoneName').value.replace('GMT','')}`
export async function journey({inspect,assets=false}={}) {
 const h=await installation({assets})
 try {
  const p=await h.command('portfolio.add',{name:'Alder homes'}),other=await h.command('portfolio.add',{name:'Other homes'})
  const property=await h.command('property.add',{portfolioId:p.id,name:'Alder Court',address:'1840 Alder Street, Oakland, CA',kind:'multifamily',timeZone:zone})
  const unit=await h.command('unit.add',{propertyId:property.id,identifier:'3A',bedrooms:2,bathrooms:1})
  const t=await h.command('tenancy.create',{...tenancyInput,unitId:unit.id,tenantName:'Jordan Lee',tenantEmail:'jordan-private@example.test'})
  const manager=await h.invite('admin','dispatch-manager@example.test'),member=await h.invite('member','dispatch-member@example.test')
  await h.stepUp();await h.command('operator.invite',{displayName:'Other coordinator',email:'other-coordinator@example.test',role:'maintenance_coordinator',['portfolio:'+other.id]:'1'})
  const outsider=await h.accept('other-coordinator@example.test')
  const vendorFields={name:'River Plumbing',email:'river@example.test',phone:'510-555-0190',specialties:'plumbing',serviceAreas:'Oakland',w9:'received',insuranceExpires:'2036-12-31',licenseNumber:'PL-240',licenseExpires:'2036-12-31',availability:'Weekdays',rate:'95',standing:'approved'}
  const vendor=await h.command('vendor.add',vendorFields),replacement=await h.command('vendor.add',{...vendorFields,name:'Bay Plumbing',email:'bay@example.test'})
  const j=await h.command('maintenance.prepare',{tenancyId:t.id,title:'Kitchen sink inlet leak',scope:'Replace leaking inlet valve; report any additional work before proceeding',checklist:tasks.join('\n'),vendorId:vendor.id,trade:'plumbing',dueDate:day(1),estimate:'385'})
  const work=async()=>(await h.state(t.id)).work,job=async()=>(await work()).jobs.find(x=>x.id===j.id)
  await h.command('maintenance.dispatch',{jobId:j.id,version:1},{status:409})
  await h.command('maintenance.dispatch',{jobId:j.id,version:1},{as:member,status:403})
  await h.command('maintenance.dispatch',{jobId:j.id,version:1},{as:outsider,status:404})
  await h.command('maintenance.approve',{jobId:j.id,version:1},{as:manager})
  const window={jobId:j.id,startsAt:at(day(-1),'09'),endsAt:at(day(-1),'10'),accessStartsAt:at(day(-1),'08'),accessEndsAt:at(day(-1),'11'),permission:'granted',permissionReference:'Jordan call: yesterday morning; dog secured',noticeReference:'Office entry notice log EN-4',noticeAt:at(day(-2),'09'),keysAccess:'PRIVATE-KEY-NO-EMAIL-439',availabilityReference:'River email: morning visit agreed'}
  const a=await h.command('appointment.book',window)
  await h.command('appointment.confirm',{appointmentId:a.id,version:1,party:'vendor',outcome:'confirmed',reference:'River email confirms arrival'})
  await h.command('appointment.confirm',{appointmentId:a.id,version:2,party:'resident',outcome:'confirmed',reference:'Jordan telephone confirmation'})
  if(inspect)await inspect({phase:'approved',h,t,j,manager,replacement,tasks})
  await h.command('maintenance.dispatch',{jobId:j.id,version:1},{status:409})
  const count=()=>h.messages.filter(m=>m.to.includes(vendorFields.email)).length
  const sent=await h.command('maintenance.dispatch',{jobId:j.id,version:2})
  assert.equal(sent.emailOutcome??sent.outcome,'accepted');assert.equal(count(),1)
  const mail=h.messages.findLast(m=>m.to.includes(vendorFields.email)),body=mail.text
  for(const value of ['Kitchen sink inlet leak','Replace leaking inlet valve','1840 Alder Street','$385.00',...tasks,window.startsAt.slice(0,10),'dispatch-manager@example.test',j.id])assert.ok(body.includes(value),'WORK-006 dispatch contains '+value)
  assert.ok(!JSON.stringify(mail).includes('jordan-private@example.test')&&!JSON.stringify(mail).includes('PRIVATE-KEY-NO-EMAIL-439'),'WORK-006 does not add unapproved resident details or keys')
  await Promise.all([h.command('maintenance.dispatch',{jobId:j.id,version:2}),h.command('maintenance.dispatch',{jobId:j.id,version:2})]);assert.equal(count(),1,'WORK-006 replay never resends')
  const progress=(state,opts={})=>h.command('maintenance.progress',{jobId:j.id,state,reference:`River email: ${state}; office follows up`,...opts})
  await h.command('maintenance.progress',{jobId:j.id,state:'completed',reference:'Premature completion',completedTasks:tasks.join('\n')},{status:409})
  // Explicit responses are entered by staff from their actual external source, not fabricated portal callbacks.
  await progress('accepted');await progress('en_route');await progress('started');await progress('blocked');await progress('parts_needed')
  assert.equal((await job()).resolution,null,'WORK-006 parts hold keeps the resident issue open')
  assert.equal((await h.request('/api/state?tenancy='+t.id,{as:outsider})).status,404)
  assert.equal((await h.request('/app?tab=work&tenancy='+t.id,{as:outsider})).status,404)
  const html=await(await h.request('/app?tab=work&tenancy='+t.id)).text();assert.match(html,/Missed arrival window/)
  const escalated=inspect?await inspect({phase:'parts-hold',h,t,j,manager,replacement,tasks}):false
  if(!escalated)await h.command('maintenance.escalate',{jobId:j.id,reference:'Called River and Jordan; replacement required today'})
  await h.command('appointment.no-show',{appointmentId:a.id,version:3,party:'vendor',reference:'Jordan call: River did not attend'})
  const next=await h.command('appointment.reassign',{appointmentId:a.id,version:4,vendorId:replacement.id,reference:'Owner chose Bay after River missed the appointment'})
  await h.command('maintenance.dispatch',{jobId:j.id,version:next.version},{status:409})
  await h.command('maintenance.progress',{jobId:j.id,state:'completed',reference:'Old vendor report'},{status:409})
  assert.equal((await job()).resolution,null)
  assert.equal(count(),1,'WORK-006 reassignment never sends until new approval')
  await h.command('maintenance.approve',{jobId:j.id,version:next.version},{as:manager})
  await h.command('maintenance.dispatch',{jobId:j.id,version:next.version+1})
  const newMail=h.messages.filter(m=>m.to.includes('bay@example.test'));assert.equal(newMail.length,1)
  assert.ok(newMail[0].text.includes('not booked'),'WORK-006 old vendor appointment is not reused')
  await progress('accepted');await progress('started')
  await h.command('maintenance.progress',{jobId:j.id,state:'completed',reference:'Bay completion email',completedTasks:tasks.slice(1).join('\n')},{status:409})
  await progress('completed',{completedTasks:tasks.join('\n')})
  let w=await work();assert.equal(w.jobs.find(x=>x.id===j.id).resolution,null,'WORK-006 vendor completion never resolves resident issue')
  assert.deepEqual(w.dispatchEvents.filter(e=>e.dispatch_id===sent.id).map(e=>e.kind),['dispatch_requested','email_result','accepted','en_route','started','blocked','parts_needed','escalated'])
  assert.ok(w.appointmentEvents.some(e=>e.kind==='no_show')&&w.appointmentEvents.some(e=>e.kind==='reassigned'))
  assert.ok(w.dispatches.every(d=>d.provider_id&&d.outcome==='accepted'))
  const history=(await(await h.request('/api/history')).json()).rows
  for(const action of ['maintenance.dispatch','maintenance.dispatch.result','maintenance.progress','maintenance.escalate'])assert.ok(history.some(e=>e.action===action&&e.tenancyId===t.id),'WORK-006 history '+action)
  if(inspect)await inspect({phase:'replacement-complete',h,t,j,manager,replacement,tasks})
  // The same approved path works for an in-house technician's mailbox; it does not invent another role or portal.
  const internal=await h.command('vendor.add',{...vendorFields,name:'In-house maintenance',email:'technician@example.test'})
  const internalJob=await h.command('maintenance.prepare',{tenancyId:t.id,title:'In-house water meter check',vendorId:internal.id,trade:'plumbing',dueDate:day(-1),estimate:'50'})
  await h.command('maintenance.approve',{jobId:internalJob.id,version:1},{as:manager});await h.command('maintenance.dispatch',{jobId:internalJob.id,version:2})
  assert.equal(h.messages.filter(m=>m.to.includes('technician@example.test')).length,1)
  assert.match(await(await h.request('/app?tab=work&tenancy='+t.id)).text(),/Work is past its due date/)
  await h.command('maintenance.escalate',{jobId:internalJob.id,reference:'Office to reschedule the overdue in-house visit'})
 }finally{await h.close()}
}

/** Provider rejection/uncertainty is not a handoff or technician acceptance, and is never silently retried. */
export async function failedDispatchJourney() {
 for(const mode of ['rejected','uncertain']){
  const h=await installation({mailResponse:message=>message.subject.startsWith('Approved Terrace work')?new Response(JSON.stringify({message:'Provider unavailable',name:'validation_error'}),{status:mode==='rejected'?422:500,headers:{'content-type':'application/json'}}):Response.json({id:crypto.randomUUID()})})
  try{
   const t=await h.command('tenancy.create',tenancyInput)
   const v=await h.command('vendor.add',{name:'River Plumbing',email:'river@example.test',phone:'510-555-0190',specialties:'plumbing',serviceAreas:'Oakland',w9:'received',insuranceExpires:'2036-12-31',licenseNumber:'PL-240',licenseExpires:'2036-12-31',availability:'Weekdays',rate:'95',standing:'approved'})
   const j=await h.command('maintenance.prepare',{tenancyId:t.id,title:'Failure-boundary repair',vendorId:v.id,trade:'plumbing',dueDate:day(1),estimate:'100'})
   await h.command('maintenance.approve',{jobId:j.id,version:1})
   const sent=await h.command('maintenance.dispatch',{jobId:j.id,version:2})
   assert.notEqual(sent.emailOutcome,'accepted','WORK-006 provider failure is not handoff')
   const w=(await h.state(t.id)).work
   assert.equal(w.jobs.find(x=>x.id===j.id).state,'approved')
   assert.equal(w.dispatches[0].provider_id,null)
   await h.command('maintenance.progress',{jobId:j.id,state:'accepted',reference:'No technician reply'},{status:409})
   const requests=h.messages.filter(m=>m.subject.startsWith('Approved Terrace work')).length
   await h.command('maintenance.dispatch',{jobId:j.id,version:2})
   assert.equal(h.messages.filter(m=>m.subject.startsWith('Approved Terrace work')).length,requests,'WORK-006 no automatic retry across uncertain outcomes')
  }finally{await h.close()}
 }
}
