import assert from 'node:assert/strict'
import {installation,tenancyInput} from './api/harness.mjs'

/** WORK-001 and BOUND-003, invoked inside the maintenance integration test: await journey(). No new test count. */
export async function journey() {
 const h=await installation({now:'2026-10-25T12:00:00Z',asyncDatabase:true});try {
 const place=async(name,n)=>{const f=await h.command('portfolio.add',{name}),p=await h.command('property.add',{portfolioId:f.id,name:name+' House',address:`${n} ${name} Road, Oakland, CA 94607`,kind:'duplex',timeZone:'America/Los_Angeles'}),u=await h.command('unit.add',{propertyId:p.id,identifier:'A',bedrooms:'2',bathrooms:'1'});return {f,p,u,t:await h.command('tenancy.create',{...tenancyInput,unitId:u.id,address:`Unit A, ${n} ${name} Road, Oakland, CA`,tenantEmail:name.toLowerCase()+'-resident@example.test',timeZone:'America/Los_Angeles'})}}
 const north=await place('North','10'),west=await place('West','30')
 await h.stepUp()
 const staff={},join=async(key,role,portfolio)=>{const email=key+'@example.test';await h.command('operator.invite',{displayName:key,email,role,['portfolio:'+portfolio.f.id]:'1'});staff[key]=await h.accept(email)}
 await join('oncall','maintenance_coordinator',north);await join('backup','portfolio_manager',north);await join('preparer','member',north);await join('elsewhere','maintenance_coordinator',west)
 const people=await(await h.request('/auth/operators')).json(),who=key=>people.find(x=>x.email===key+'@example.test').id,as=key=>({as:staff[key]})
 const cases=async(key)=>(await(await h.request('/api/emergencies',key?as(key):{})).json()).cases,find=async(id,key)=>(await cases(key)).find(x=>x.id===id)
 // Owner-approved guidance per risk: immediate danger must say when to call 911; staff cannot set policy; a new version never rewrites a recorded case.
 await h.command('emergency.guidance',{risk:'gas',guidance:'Leave the unit.'},{...as('oncall'),status:403})
 await h.command('emergency.guidance',{risk:'gas',guidance:'Leave the unit.'},{...as('backup'),status:403})
 assert.equal((await h.command('emergency.guidance',{risk:'gas',guidance:'Leave the unit.',callInstruction:'Call PG&E.'},{status:400})).error,'invalid_input')
 await h.command('emergency.guidance',{risk:'gas',guidance:'Leave the unit and do not use switches.',callInstruction:'From outside, call 911, then PG&E at 1-800-743-5000.'})
 const v2=await h.command('emergency.guidance',{risk:'gas',guidance:'Leave now, leave the door open, no flames or switches.',callInstruction:'From outside, call 911, then PG&E at 1-800-743-5000.'});assert.equal(v2.version,2)
 await h.command('emergency.guidance',{risk:'water',guidance:'Close the stop valve under the sink if it is safe to reach.'})
 // On call per portfolio: only active people whose role may acknowledge, in that portfolio.
 assert.equal((await h.command('emergency.oncall',{portfolioId:north.f.id,primaryId:who('preparer'),backupId:who('backup')},{status:409})).error,'responder_unavailable')
 assert.equal((await h.command('emergency.oncall',{portfolioId:north.f.id,primaryId:who('elsewhere'),backupId:who('backup')},{status:409})).error,'responder_unavailable')
 await h.command('emergency.oncall',{portfolioId:north.f.id,primaryId:who('oncall'),backupId:who('backup')},{...as('oncall'),status:403})
 await h.command('emergency.oncall',{portfolioId:north.f.id,primaryId:who('oncall'),backupId:who('backup')})
 // A gas smell at 2:10 a.m. Pacific last night: staff record it, policy refuses "not an emergency", the guidance is read out and the on-call person is emailed a sign-in link only.
 const night=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Los_Angeles',year:'numeric',month:'2-digit',day:'2-digit'}).format(Date.parse('2026-10-25T12:00:00Z')-86400000),offset=new Intl.DateTimeFormat('en-US',{timeZone:'America/Los_Angeles',timeZoneName:'longOffset'}).formatToParts(new Date(night+'T09:10:00Z')).find(p=>p.type==='timeZoneName').value.replace('GMT',''),reportedAt=`${night}T02:10${offset}`
 const gas={tenancyId:north.t.id,risk:'gas',emergency:'yes',channel:'phone',reporter:'Alex Chen, 510-555-0101',reportedAt,description:'Strong gas smell in the kitchen'}
 await h.command('emergency.report',gas,{...as('preparer'),status:403})
 assert.equal((await h.command('emergency.report',{...gas,emergency:'no'},{...as('oncall'),status:409})).error,'emergency_policy')
 assert.equal((await h.command('emergency.report',{...gas,reportedAt:'2099-01-01T00:00-08:00'},{...as('oncall'),status:400})).error,'invalid_time')
 await h.command('emergency.report',gas,{...as('elsewhere'),status:404})
 const before=h.messages.length,c1=await h.command('emergency.report',gas,as('oncall'))
 assert.match(c1.guidance,/call 911, then PG&E[\s\S]*Leave now, leave the door open/);assert.equal(c1.guidanceVersion,2)
 assert.equal(c1.alertOutcome,'accepted');assert.match(c1.notice,/accepted by the mail provider; no person has acknowledged/)
 const page=h.messages.slice(before);assert.equal(page.length,1);assert.deepEqual(page[0].to,['oncall@example.test'])
 assert.ok(page[0].text.includes('/app?tab=emergencies&case='+c1.id),'the alert is a sign-in link to the case');assert.ok(!/gas|kitchen|North|Alex/i.test(page[0].text+page[0].subject),'the email carries no case details')
 await h.command('emergency.guidance',{risk:'gas',guidance:'Version three wording.',callInstruction:'Call 911 from outside.'})
 let x=await find(c1.id,'oncall');assert.equal(x.state,'open');assert.equal(x.reported_at,new Date(Date.parse(reportedAt)).toISOString());assert.match(x.guidance_given,/Leave now, leave the door open/,'a case keeps the guidance version it was given')
 assert.deepEqual((await h.state()).tenancies.length,2)
 assert.equal((await cases('elsewhere')).length,0,'out-of-scope staff never see the case')
 assert.equal((await h.request('/api/emergencies',as('preparer'))).status,403)
 assert.equal((await h.request('/app?tab=emergencies',as('preparer'))).status,403)
 // Unanswered: urgent and open on the queue and in the REPORT-004 service report.
 const urgent=await(await h.request('/app?tab=emergencies',as('oncall'))).text()
 assert.match(urgent,/Urgent · not acknowledged/);assert.match(urgent,/call 911, then PG&amp;E/);assert.match(urgent,/name="command" value="emergency.acknowledge"/)
 let report=await(await h.request('/api/maintenance-report')).json()
 assert.equal(report.summary.openEmergencies,1);assert.ok(report.summary.oldestOpenEmergencyHours>0);assert.equal(report.emergencies[0].id,c1.id)
 assert.match(await(await h.request('/api/maintenance-report?format=csv')).text(),/"Open emergency","Unit A, 10 North Road[^\n]*","gas","open","\d{4}-\d\d-\d\dT\d\d:10:00\.000Z","not acknowledged","[\d.]+ h open"/)
 assert.equal((await(await h.request('/api/maintenance-report',as('elsewhere'))).json()).summary.openEmergencies,0)
 // Only the named people acknowledge; escalation to the backup is a recorded, sent human action; resolution waits for acknowledgement.
 assert.equal((await h.command('emergency.acknowledge',{emergencyId:c1.id,version:1,reference:'Owner saw it'},{status:403})).error,'not_on_call')
 assert.equal((await h.command('emergency.resolve',{emergencyId:c1.id,version:1,fieldWork:'x',residentFollowUp:'y'},{status:409})).error,'emergency_state')
 await h.command('emergency.escalate',{emergencyId:c1.id,version:1,to:'backup',reason:'No acknowledgement after 10 minutes'},{...as('elsewhere'),status:404})
 const sent=h.messages.length,esc=await h.command('emergency.escalate',{emergencyId:c1.id,version:1,to:'backup',reason:'No acknowledgement after 10 minutes'},as('oncall'))
 assert.equal(esc.alertOutcome,'accepted');assert.deepEqual(h.messages.slice(sent).map(m=>m.to[0]),['backup@example.test'])
 await h.command('emergency.acknowledge',{emergencyId:c1.id,version:1,reference:'stale'},{...as('backup'),status:409})
 await h.command('emergency.acknowledge',{emergencyId:c1.id,version:2,reference:'Called Alex: out of the unit, 911 called; PG&E dispatched'},as('backup'))
 x=await find(c1.id);assert.equal(x.state,'acknowledged');assert.equal(x.acknowledged_by,who('backup'))
 report=await(await h.request('/api/maintenance-report')).json();assert.equal(report.summary.openEmergencies,1,'acknowledged is still open until resolved');assert.equal(report.emergencies[0].state,'acknowledged')
 // Resolution: never by a coordinator or a preparer, only with field-work evidence and the resident's follow-up.
 await h.command('emergency.resolve',{emergencyId:c1.id,version:3,fieldWork:'PG&E made safe',residentFollowUp:'Alex confirmed'},{...as('oncall'),status:403})
 await h.command('emergency.resolve',{emergencyId:c1.id,version:3,fieldWork:'PG&E made safe'},{...as('backup'),status:400})
 await h.command('emergency.resolve',{emergencyId:c1.id,version:3,fieldWork:'PG&E tech #4411 shut off and capped the range line; leak test passed',residentFollowUp:'Office called Alex at 8:05 a.m.: back in the unit, no smell'},as('backup'))
 x=await find(c1.id);assert.equal(x.state,'resolved');assert.match(x.resident_followup,/no smell/)
 const ev=(await(await h.request('/api/emergencies')).json()).events.filter(v=>v.emergency_id===c1.id)
 assert.deepEqual(ev.map(v=>v.kind),['reported','alert','escalated','alert','acknowledged','resolved'])
 assert.deepEqual(ev.filter(v=>v.kind==='alert').map(v=>[v.recipient_id,v.outcome]),[[who('oncall'),'accepted'],[who('backup'),'accepted']])
 assert.match(ev.at(-1).label,/resident follow-up recorded by staff; Terrace did not contact the resident/)
 assert.equal((await(await h.request('/api/maintenance-report')).json()).summary.openEmergencies,0)
 // A portfolio with no on-call person: the case is still recorded, no alert is claimed; a non-emergency is never alerted or counted.
 const quiet=h.messages.length,c2=await h.command('emergency.report',{...gas,tenancyId:west.t.id,reportedAt:undefined},as('elsewhere'))
 assert.equal(c2.alertOutcome,undefined);assert.match(c2.notice,/no on-call person for this portfolio: no alert was sent/)
 const c3=await h.command('emergency.report',{tenancyId:north.t.id,risk:'water',emergency:'no',channel:'email',reporter:'Alex Chen',description:'Slow drip under the sink'},as('oncall'))
 assert.equal(c3.alertOutcome,undefined);assert.equal(h.messages.length,quiet)
 report=await(await h.request('/api/maintenance-report')).json();assert.deepEqual(report.emergencies.map(e=>e.id),[c2.id])
 const history=(await(await h.request('/api/history?action=emergency.')).json()).rows;assert.ok(history.some(r=>r.action==='emergency.alert'&&r.subject===c1.id&&r.outcome==='accepted'))
 } finally {await h.close()}
}
