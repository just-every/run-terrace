import assert from 'node:assert/strict'
import {installation,tenancyInput} from './api/harness.mjs'

/** Invoke inside the existing maintenance integration test: await journey(h,{member}). No new test count. */
export async function journey() {
 const clock='2026-10-26T18:00:00.000Z',h=await installation({now:clock});try {
 const member=await h.invite('member','appointment-preparer@example.test'),admin=await h.invite('admin','appointment-approver@example.test')
 const t=await h.command('tenancy.create',{...tenancyInput,address:'400 Appointment Road, Oakland, CA',tenantEmail:'appointment-resident@example.test',timeZone:'America/Los_Angeles'})
 const fields={name:'Appointment Plumbing',email:'appointment-vendor@example.test',phone:'510-555-0144',specialties:'plumbing',serviceAreas:'Oakland',w9:'received',insuranceExpires:'2036-12-31',licenseNumber:'AP-1',licenseExpires:'2036-12-31',availability:'Agreed externally',rate:'95.00',standing:'approved'}
 const vendor=await h.command('vendor.add',fields),other=await h.command('vendor.add',{...fields,name:'Appointment Replacement',email:'appointment-replacement@example.test'})
 const prepare=()=>h.command('maintenance.prepare',{tenancyId:t.id,title:'Appointment repair',vendorId:vendor.id,trade:'plumbing',dueDate:'2030-12-02',estimate:'100.00'})
 const j=await prepare(),work=async()=>(await h.state(t.id)).work,appointment=async id=>(await work()).appointments.find(a=>a.id===id)
 // Staff backfill yesterday's externally arranged visit, then record its external no-show today.
 const localDay=ms=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Los_Angeles',year:'numeric',month:'2-digit',day:'2-digit'}).format(ms)
 const day=localDay(Date.parse(clock)-86400000),noticeDay=localDay(Date.parse(clock)-2*86400000)
 const at=(day,hour)=>{const offset=new Intl.DateTimeFormat('en-US',{timeZone:'America/Los_Angeles',timeZoneName:'longOffset'}).formatToParts(new Date(day+'T20:00:00Z')).find(p=>p.type==='timeZoneName').value.replace('GMT','');return `${day}T${hour}:00${offset}`}
 const window={startsAt:at(day,'09'),endsAt:at(day,'10'),accessStartsAt:at(day,'08'),accessEndsAt:at(day,'11'),permission:'granted',permissionReference:'Resident call: permission for this window, dog secured',noticeReference:'Office entry notice service log',noticeAt:at(noticeDay,'09'),keysAccess:'Resident will open the door; no key required',availabilityReference:'Vendor email: available for arrival window'}
 const book=(data={},opts={})=>h.command('appointment.book',{jobId:j.id,...window,...data},opts)
 assert.equal((await book({}, {status:409})).error,'not_approved')
 await h.command('maintenance.approve',{jobId:j.id,version:1},{as:admin})
 if(member) await book({}, {as:member,status:403})
 assert.equal((await book({permission:'denied'},{status:409})).error,'access_permission')
 assert.equal((await book({accessEndsAt:at(day,'09').replace('T09:00','T09:30')},{status:400})).error,'access_window')
 assert.equal((await book({startsAt:'2030-03-10T02:30-08:00'},{status:400})).error,'invalid_time','a spring-forward gap cannot silently change the appointment')
 const a=await book(),reply=(id,version,party,outcome='confirmed')=>h.command('appointment.confirm',{appointmentId:id,version,party,outcome,reference:`${party} external ${outcome}: call log`})
 await reply(a.id,1,'resident','no_response')
 assert.equal((await appointment(a.id)).confirmed_at,null,'an unanswered arrival window stays unconfirmed')
 await reply(a.id,2,'vendor');assert.equal((await appointment(a.id)).state,'proposed','vendor alone cannot confirm the appointment')
 const confirmed=await reply(a.id,3,'resident');assert.equal(confirmed.state,'confirmed')
 const first=(await appointment(a.id)).confirmed_at
 assert.match(confirmed.notice,/confirmed by staff, resident not contacted by Terrace/)
 await h.command('appointment.confirm',{appointmentId:a.id,version:3,party:'resident',outcome:'confirmed',reference:'stale reply'},{status:409})
 // A second order cannot double-book either the vendor, assigned staff or this property unit.
 const overlap=await prepare();await h.command('maintenance.approve',{jobId:overlap.id,version:1},{as:admin})
 await h.command('appointment.book',{...window,jobId:overlap.id},{status:409})
 const report=async()=>(await(await h.request('/api/maintenance-report')).json()).rows.find(r=>r.jobId===j.id)
 let r=await report();assert.equal(r.firstConfirmedAppointmentAt,first);assert.equal(r.bookingHours,Math.round((Date.parse(first)-Date.parse(r.preparedAt))/360000)/10)
 await h.command('maintenance.sent',{jobId:j.id,version:2,reference:'External email handoff appointment vendor'})
 await h.command('appointment.no-show',{appointmentId:a.id,version:4,party:'vendor',reference:'Resident called: vendor did not attend'})
 const reassigned=await h.command('appointment.reassign',{appointmentId:a.id,version:5,vendorId:other.id,reference:'Vendor no-show; owner chose replacement'})
 assert.equal((await h.request('/api/maintenance/'+j.id+'/packet')).status,409,'the earlier vendor approval no longer authorizes a packet')
 await book({previousId:a.id,reason:'Replacement vendor'}, {status:409})
 await h.command('maintenance.approve',{jobId:j.id,version:reassigned.version},{as:admin})
 const b=await book({previousId:a.id,reason:'New vendor, new permitted window',startsAt:'2030-12-02T09:00-08:00',endsAt:'2030-12-02T10:00-08:00',accessStartsAt:'2030-12-02T08:00-08:00',accessEndsAt:'2030-12-02T11:00-08:00',permissionReference:'Resident email permits only the replacement December window'})
 assert.equal((await appointment(b.id)).vendor_id,other.id)
 await reply(b.id,1,'resident');await reply(b.id,2,'vendor')
 assert.equal((await report()).firstConfirmedAppointmentAt,first,'rescheduling never resets time to the first confirmed appointment')
 await h.command('appointment.cancel',{appointmentId:b.id,version:3,party:'vendor',reference:'Vendor externally cancelled the replacement window'})
 const c=await book({previousId:b.id,reason:'Vendor cancellation; resident agreed to afternoon',startsAt:'2030-12-02T13:00-08:00',endsAt:'2030-12-02T14:00-08:00',accessStartsAt:'2030-12-02T12:00-08:00',accessEndsAt:'2030-12-02T15:00-08:00',permissionReference:'Resident new afternoon permission'})
 assert.equal((await appointment(c.id)).state,'proposed','rescheduling needs two fresh confirmations')
 // Revised WORK-003 terms invalidate an existing calendar window until approved and rebooked.
 const before=(await work()).jobs.find(x=>x.id===j.id)
 await h.command('maintenance.revise',{jobId:j.id,version:before.version,scope:'Replace valve and supply hose'})
 assert.equal((await appointment(c.id)).current,false)
 await h.command('appointment.confirm',{appointmentId:c.id,version:1,party:'resident',outcome:'confirmed',reference:'Old scope confirmation'},{status:409})
 await h.command('maintenance.approve',{jobId:j.id,version:before.version+1},{as:admin})
 // Current vendor qualifications are rechecked at the booking door, after approval.
 await h.command('vendor.update',{...fields,name:'Appointment Replacement',email:'appointment-replacement@example.test',vendorId:other.id,version:1,standing:'blocked'})
 assert.equal((await book({previousId:c.id,reason:'Changed scope; needs fresh access'}, {status:409})).error,'qualification_hold')
 const w=await work();assert.deepEqual(w.appointments.map(a=>a.state),['no_show','cancelled','proposed'])
 for(const kind of ['booked','confirmation','no_show','reassigned','rescheduled','cancelled'])assert.ok(w.appointmentEvents.some(e=>e.kind===kind),kind+' retained')
 const csv=await(await h.request('/api/maintenance-report?format=csv')).text();assert.ok(csv.includes('First confirmed appointment')&&csv.includes('Booking (h)'))
 return {tenancyId:t.id,jobId:j.id,firstConfirmedAt:first}
 }finally{await h.close()}
}
