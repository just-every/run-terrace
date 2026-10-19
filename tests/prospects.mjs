import assert from 'node:assert/strict'
import {installation} from './api/harness.mjs'

/** LEASE-005, invoked inside the leasing integration test: await journey(). No new test count. */
export async function journey() {
 const h=await installation();try {
 const place=async(name,n)=>{const f=await h.command('portfolio.add',{name}),p=await h.command('property.add',{portfolioId:f.id,name:name+' Flats',address:`${n} ${name} Road, Oakland, CA 94607`,kind:'multifamily',timeZone:'America/Los_Angeles'});return {f,p}}
 const north=await place('North','10'),west=await place('West','30')
 await h.stepUp()
 const staff={},join=async(key,role,at)=>{const email=key+'@example.test';await h.command('operator.invite',{displayName:key,email,role,['portfolio:'+at.f.id]:'1'});staff[key]=await h.accept(email)}
 await join('leasing','leasing',north);await join('books','bookkeeper',north);await join('reader','member',north);await join('westlease','leasing',west)
 const people=await(await h.request('/auth/operators')).json(),who=k=>people.find(x=>x.email===k+'@example.test').id,as=k=>({as:staff[k]})
 const list=async k=>(await(await h.request('/api/prospects',k?as(k):{})).json()).prospects,get=async(id,k)=>(await list(k)).find(x=>x.id===id)
 // A marketplace listing enquiry with household preferences and per-channel consent.
 const lead={propertyId:north.p.id,name:'Dana Ortiz',email:'dana@example.test',phone:'(510) 555-0142',source:'marketplace',reference:'Zillow enquiry Z-881 for 2-bed at North Flats',bedrooms:'2',occupants:'3',moveIn:'2026-12-01',budget:'2400.00',pets:'one cat',consent_email:'granted',consent_text:'refused'}
 await h.command('prospect.add',lead,{...as('books'),status:403})
 await h.command('prospect.add',lead,{...as('reader'),status:403})
 await h.command('prospect.add',lead,{...as('westlease'),status:404})
 assert.equal((await h.request('/api/prospects',as('books'))).status,403)
 const p1=await h.command('prospect.add',lead,as('leasing'));assert.equal(p1.review,'clear')
 // The same person emails: held as a possible duplicate, never merged or worked until a person reviews it.
 const p2=await h.command('prospect.add',{propertyId:north.p.id,name:'Dana O.',email:'DANA@example.test',source:'email',reference:'Email 2026-10-19 asking about parking'},as('leasing'))
 assert.equal(p2.review,'possible_duplicate');assert.equal(p2.duplicateOf,p1.id)
 assert.equal((await h.command('prospect.assign',{prospectId:p2.id,version:1,assignedTo:who('leasing')},{...as('leasing'),status:409})).error,'review_required')
 assert.match(await(await h.request('/app?tab=prospects',as('leasing'))).text(),/possible duplicate[\s\S]*name="command" value="prospect.review"/)
 assert.equal((await list('reader')).length,2,'a member reads the portfolio prospects');assert.equal((await list('westlease')).length,0,'another portfolio sees none')
 await h.command('prospect.review',{prospectId:p2.id,version:1,decision:'merge',reference:'Same email; same household'},{...as('westlease'),status:404})
 const merged=await h.command('prospect.review',{prospectId:p2.id,version:1,decision:'merge',reference:'Same email; same household'},as('leasing'))
 assert.equal(merged.id,p1.id);assert.deepEqual((await list('leasing')).map(x=>x.id),[p1.id])
 let x=await get(p1.id,'leasing')
 assert.equal(x.first_source,'marketplace');assert.equal(x.first_reference,lead.reference);assert.deepEqual(x.sources,['marketplace','email'],'first-contact attribution stays; the later source is added')
 assert.equal(x.consent.email.state,'unknown','merged consent is the most restrictive');assert.equal(x.consent.text.state,'refused')
 assert.deepEqual(x.preferences,{bedrooms:2,occupants:3,moveIn:'2026-12-01',budgetCents:240000,pets:'one cat',notes:null})
 // Assign leasing staff in the portfolio, respond within consent, and follow the stages to a lease.
 assert.equal((await h.command('prospect.assign',{prospectId:p1.id,version:x.version,assignedTo:who('westlease')},{...as('leasing'),status:409})).error,'not_eligible')
 await h.command('prospect.assign',{prospectId:p1.id,version:x.version,assignedTo:who('leasing')},as('leasing'))
 x=await get(p1.id);assert.equal(x.assigned_to,who('leasing'))
 assert.equal((await h.command('prospect.respond',{prospectId:p1.id,version:x.version,channel:'text',reference:'Texted showing times'},{...as('leasing'),status:409})).error,'consent_refused')
 const r=await h.command('prospect.respond',{prospectId:p1.id,version:x.version,channel:'phone',reference:'Called Dana: offered Saturday showing'},as('leasing'));assert.match(r.notice,/recorded by staff; Terrace did not contact the prospect/)
 let v=r.version
 // Email from the record through the installation's mail provider, only with email consent; an opt-out stops it.
 assert.equal((await h.command('prospect.email',{prospectId:p1.id,version:v,subject:'Showing times',body:'Hi Dana'},{...as('leasing'),status:409})).error,'consent_required')
 v=(await h.command('prospect.consent',{prospectId:p1.id,version:v,channel:'email',state:'granted',reference:'Dana on the phone: email me'},as('leasing'))).version
 await h.command('prospect.email',{prospectId:p1.id,version:v,subject:'x',body:'y'},{...as('reader'),status:403})
 const out=h.messages.length,mailed=await h.command('prospect.email',{prospectId:p1.id,version:v,subject:'Showing times at North Flats',body:'Hi Dana,\nSaturday 10:00 works for a showing.'},as('leasing'))
 assert.equal(mailed.emailOutcome,'accepted');assert.match(mailed.notice,/accepted by the mail provider; delivery to the prospect is not confirmed/)
 const sentMail=h.messages.slice(out);assert.equal(sentMail.length,1);assert.deepEqual(sentMail[0].to,['dana@example.test']);assert.equal(sentMail[0].subject,'Showing times at North Flats');assert.match(sentMail[0].text,/Saturday 10:00/)
 v=(await h.command('prospect.consent',{prospectId:p1.id,version:mailed.version,channel:'email',state:'refused',reference:'Dana replied: unsubscribe'},as('leasing'))).version
 assert.equal((await h.command('prospect.email',{prospectId:p1.id,version:v,subject:'Again',body:'Again'},{...as('leasing'),status:409})).error,'consent_required');assert.equal(h.messages.length,out+1)
 for(const [stage,ref] of [['showing_scheduled','Showing Sat 10:00, office calendar'],['shown','Shown by leasing; liked the unit'],['applied','Paper application received with ID']]){v=(await h.command('prospect.stage',{prospectId:p1.id,version:v,stage,on:'2026-10-24',reference:ref},as('leasing'))).version}
 assert.equal((await h.command('prospect.stage',{prospectId:p1.id,version:v,stage:'shown',on:'2026-10-25',reference:'back'},{...as('leasing'),status:400})).error,'invalid_stage')
 v=(await h.command('prospect.stage',{prospectId:p1.id,version:v,stage:'offer',on:'2026-10-26',reference:'Offer letter 2026-10-26'},as('leasing'))).version
 await h.command('prospect.stage',{prospectId:p1.id,version:v,stage:'leased',on:'2026-10-28',reference:'Lease signed for Unit 2B'},as('leasing'))
 x=await get(p1.id);assert.equal(x.stage,'leased');assert.equal(x.first_source,'marketplace')
 assert.deepEqual(x.history.map(e=>e.kind),['enquiry','enquiry','duplicate_held','source','merged','assigned','response','consent','email','email_result','consent','stage','stage','stage','stage','stage'])
 const [written,result]=x.history.filter(e=>e.kind.startsWith('email'));assert.equal(written.detail.subject,'Showing times at North Flats');assert.match(written.detail.body,/Saturday 10:00/);assert.equal(result.detail.outcome,'accepted');assert.equal(result.detail.emailEvent,written.id)
 assert.deepEqual(x.history.filter(e=>e.kind==='stage').map(e=>e.detail.to),['showing_scheduled','shown','applied','offer','leased'])
 await h.command('prospect.respond',{prospectId:p1.id,version:x.version,channel:'phone',reference:'late'},{...as('leasing'),status:409})
 // A lost prospect needs a reason; a phone lead kept separate after review; no bank data reaches leasing.
 const p3=await h.command('prospect.add',{propertyId:north.p.id,name:'Lee Park',phone:'+1 510 555 0142',source:'phone',reference:'Call log 2026-10-20 09:12'},as('leasing'))
 assert.equal(p3.review,'clear','the matching prospect is leased, so this is not a duplicate')
 assert.equal((await h.command('prospect.stage',{prospectId:p3.id,version:1,stage:'lost',on:'2026-10-21',reference:'Call',lostReason:'other'},{...as('leasing'),status:400})).error,'invalid_input')
 await h.command('prospect.stage',{prospectId:p3.id,version:1,stage:'lost',on:'2026-10-21',reference:'Call: found a cheaper place',lostReason:'price'},as('leasing'))
 assert.equal((await get(p3.id)).lost_reason,'price')
 const p4=await h.command('prospect.add',{propertyId:north.p.id,name:'Sam Park',phone:'510-555-0199',source:'walk_in',reference:'Walk-in 2026-10-21'},as('leasing')),p5=await h.command('prospect.add',{propertyId:north.p.id,name:'Sam Park Jr',phone:'5105550199',source:'referral',reference:'Referred by Dana'},as('leasing'))
 assert.equal(p5.duplicateOf,p4.id);await h.command('prospect.review',{prospectId:p5.id,version:1,decision:'separate',reference:'Different person, same family phone'},as('leasing'))
 assert.equal((await get(p5.id)).review,'kept_separate')
 assert.ok(!/routing|bank|\bein\b/i.test(JSON.stringify(await list('leasing'))));await h.command('account.add',{},{...as('leasing'),status:403})
 // SAFE-004: the owner erases a prospect on request; history keeps an opaque alias.
 await h.command('prospect.erase',{prospectId:p3.id,version:2,reason:'Erasure request email 2026-10-22'},{...as('leasing'),status:403})
 await h.command('prospect.erase',{prospectId:p3.id,version:2,reason:'Erasure request email 2026-10-22'})
 assert.equal(await get(p3.id),undefined);const rows=(await(await h.request('/api/history?action=prospect.erase')).json()).rows;assert.equal(rows[0].subject,'prospect-'+p3.id);assert.ok(!JSON.stringify(rows).includes('Lee Park'))
 } finally {await h.close()}
}
