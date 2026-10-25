import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {installation,tenancyInput} from './api/harness.mjs'
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64')
export async function journey({inspect,assets=false}={}) {
 const r=await installation({assets,asyncDatabase:true,now:'2026-10-25T12:00:00Z'})
 try {
  const f=await r.command('portfolio.add',{name:'Repair homes'}),other=await r.command('portfolio.add',{name:'Other homes'})
  const p=await r.command('property.add',{portfolioId:f.id,name:'Alder Court',address:'1 Alder St, Oakland, CA',kind:'duplex',timeZone:'America/Los_Angeles'})
  const u=await r.command('unit.add',{propertyId:p.id,identifier:'3A',bedrooms:2,bathrooms:1}),t=await r.command('tenancy.create',{...tenancyInput,unitId:u.id})
  const admin=await r.invite('admin','manager@example.test'),member=await r.invite('member','member@example.test')
  await r.stepUp();await r.command('operator.invite',{displayName:'Other manager',email:'other@example.test',role:'portfolio_manager',['portfolio:'+other.id]:'1'});const outsider=await r.accept('other@example.test')
  const invite=async(email,access='resident')=>{await r.command('portal.invite',{kind:'resident',tenancyId:t.id,email,displayName:email,access,source:'Explicit resident request'});return r.portalSignIn(email)}
  const resident=await invite('resident@example.test'),second=await invite('second@example.test'),delegate=await invite('delegate@example.test','delegate')
  const post=async(path,fields,as=resident,extra={})=>{const form=new FormData();for(const [k,v]of Object.entries(fields))form.set(k,v);return r.request(path,{method:'POST',form,as,...extra})}
  const fields={tenancyId:t.id,requestKey:randomUUID(),description:'Leaking kitchen tap',category:'plumbing',urgency:'urgent',accessConsent:'no',accessNotes:'Do not enter without calling me',pets:'Dog in kitchen',preferredTimes:'Tuesday 9 to 11',photo:new File([png],'tap.png',{type:'image/png'})}
  for(const as of [second,delegate])assert.equal((await r.request('/portal/repair?id=unknown',{as})).status,404)
  assert.equal((await post('/portal/repairs',fields,delegate)).status,404)
  assert.equal((await post('/portal/repairs',fields,resident,{originHeader:'https://elsewhere.test'})).status,403)
  assert.equal((await post('/portal/repairs',{...fields,requestKey:randomUUID(),photo:new File(['bad'],'tap.png',{type:'image/png'})})).status,400)
  await inspect?.({phase:'intake',r,t,resident})
  const created=await post('/portal/repairs',fields);assert.equal(created.status,303);const path=created.headers.get('location'),key=new URL(path,r.origin).searchParams.get('id')
  assert.equal((await post('/portal/repairs',fields)).headers.get('location'),path,'retry reuses the tracking number')
  let html=await(await r.request(path,{as:resident})).text();for(const text of ['Leaking kitchen tap','Do not enter without calling me','Dog in kitchen','Tuesday 9 to 11','Received; awaiting staff review'])assert.ok(html.includes(text),text)
  const filePath=html.match(/href="(\/portal\/repair-file[^\"]+)"/)[1]
  assert.deepEqual(Buffer.from(await(await r.request(filePath,{as:resident})).arrayBuffer()),png)
  for(const as of [second,delegate])for(const url of [path,filePath])assert.equal((await r.request(url,{as})).status,404)
  const staffFile='/api/repair-media?id='+new URL(filePath,r.origin).searchParams.get('id')
  assert.deepEqual(Buffer.from(await(await r.request(staffFile,{as:admin})).arrayBuffer()),png)
  for(const as of ['',resident,delegate])assert.equal((await r.request(staffFile,{as})).status,401,'resident and signed-out sessions never reach staff media')
  for(const [as,status] of [[member,403],[outsider,404]])assert.equal((await r.request(staffFile,{as})).status,status)
  const video=Buffer.from([0,0,0,16,102,116,121,112,105,115,111,109,0,0,0,0])
  const movie=await post('/portal/repairs',{...fields,requestKey:randomUUID(),photo:new File([video],'tap.mp4',{type:'video/mp4'})});assert.equal(movie.status,303)
  const movieHtml=await(await r.request(movie.headers.get('location'),{as:resident})).text(),movieFile=movieHtml.match(/href="(\/portal\/repair-file[^"]+)"/)[1]
  assert.deepEqual(Buffer.from(await(await r.request(movieFile,{as:resident})).arrayBuffer()),video)
  await r.command('emergency.guidance',{risk:'gas',guidance:'Leave now. No switches or flames.',callInstruction:'From outside call 911 and your gas utility.'})
  const people=await(await r.request('/auth/operators')).json(),owner=people.find(x=>x.email==='owner@example.test'),manager=people.find(x=>x.email==='manager@example.test')
  await r.command('emergency.oncall',{portfolioId:f.id,primaryId:owner.id,backupId:manager.id})
  const safety={...fields,requestKey:randomUUID(),description:'Gas smell in kitchen',safetyRisk:'gas',photo:''},before=r.messages.length
  const gas=await post('/portal/repairs',safety);assert.equal(gas.status,303)
  const gasPath=gas.headers.get('location'),guidanceHtml=await(await r.request(gasPath,{as:resident})).text();assert.match(guidanceHtml,/Approved guidance version: 1/);assert.match(guidanceHtml,/Leave now/);assert.match(guidanceHtml,/call 911/)
  const emergencies=(await(await r.request('/api/emergencies')).json()).cases,emergency=emergencies.find(e=>e.description==='Gas smell in kitchen');assert.ok(emergency);assert.equal(emergency.state,'open');assert.equal(emergency.intake_origin,'resident_portal');assert.equal(emergency.primary_id,owner.id)
  assert.equal(r.messages.length,before+1);assert.deepEqual(r.messages.at(-1).to,['owner@example.test']);assert.ok(!r.messages.at(-1).text.includes('Gas smell'))
  assert.equal((await post('/portal/repairs',safety)).headers.get('location'),gasPath);assert.equal(r.messages.length,before+1,'a replay never re-alerts')
  await inspect?.({phase:'emergency',r,t,resident,path:gasPath})
  const secondPost=await post('/portal/repairs',{...fields,requestKey:randomUUID(),description:'Different concern: bathroom tap',photo:''},second),secondPath=secondPost.headers.get('location'),secondKey=new URL(secondPath,r.origin).searchParams.get('id')
  assert.ok(!(await(await r.request('/portal/repairs?tenancy='+t.id,{as:resident})).text()).includes('Different concern'))
  const vendor=await r.command('vendor.add',{name:'River Plumbing',email:'river@example.test',phone:'510-555-0190',specialties:'plumbing',serviceAreas:'Oakland',w9:'received',insuranceExpires:'2036-12-31',licenseNumber:'PL-240',licenseExpires:'2036-12-31',availability:'Weekdays',rate:'95',standing:'approved'})
  const landlord=await r.command('owner.add',{kind:'individual',legalName:'Repair owner',email:'repair-owner@example.test',mailingAddress:'1 Alder St'})
  await r.command('ownership.set',{propertyId:p.id,effectiveFrom:'2025-01-01',reason:'synthetic-terrace-60 original ownership',shares:[{ownerId:landlord.id,percent:'100'}]})
  for(const params of [{kind:'owner',ownerId:landlord.id,email:'repair-owner@example.test'},{kind:'vendor',vendorId:vendor.id,email:'river@example.test'}]){await r.command('portal.invite',{...params,displayName:params.email,source:'synthetic-terrace-61 portal isolation'});const outsiderPortal=await r.portalSignIn(params.email);for(const url of [path,filePath])assert.equal((await r.request(url,{as:outsiderPortal})).status,404)}
  const j=await r.command('maintenance.prepare',{tenancyId:t.id,title:'Repair taps',vendorId:vendor.id,trade:'plumbing',dueDate:'2026-11-20',estimate:'180.00'})
  const link={requestId:key,jobId:j.id,version:1,reference:'Staff reviewed both original reports'}
  await r.command('portal.request.link',link,{as:member,status:403});await r.command('portal.request.link',link,{as:outsider,status:404})
  assert.ok(!(await(await r.request('/app?tab=settings',{as:outsider})).text()).includes('Leaking kitchen tap'))
  assert.ok(!(await(await r.request('/app?tab=settings',{as:member})).text()).includes('Resident repair requests'),'unprivileged staff have no request section')
  await r.command('portal.request.link',link,{as:admin});await r.command('portal.request.link',link,{status:409})
  await r.command('portal.request.link',{...link,requestId:secondKey},{as:admin})
  const approved=await r.command('maintenance.approve',{jobId:j.id,version:1},{as:admin})
  const d=offset=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Los_Angeles'}).format(Date.parse('2026-10-25T12:00:00Z')+offset*86400000),at=(day,h)=>`${day}T${h}:00${new Intl.DateTimeFormat('en-US',{timeZone:'America/Los_Angeles',timeZoneName:'longOffset'}).formatToParts(new Date(day+'T20:00:00Z')).find(p=>p.type==='timeZoneName').value.replace('GMT','')}`
  await r.command('appointment.book',{jobId:j.id,startsAt:at(d(-1),'09'),endsAt:at(d(-1),'10'),accessStartsAt:at(d(-1),'08'),accessEndsAt:at(d(-1),'11'),permission:'granted',permissionReference:'Separate later resident permission',noticeReference:'Office notice',noticeAt:at(d(-2),'09'),keysAccess:'Private key details',availabilityReference:'Vendor call'})
  html=await(await r.request(path,{as:resident})).text();assert.ok(html.includes('Appointment recorded'));assert.ok(!html.includes('Private key details'));assert.ok(html.includes('Do not enter'))
  await inspect?.({phase:'scheduled',r,t,resident,path})
  await r.command('maintenance.sent',{jobId:j.id,version:approved.version,reference:'Staff sent approved packet'})
  await r.command('completion.record',{jobId:j.id,completedDate:d(-1),summary:'Both taps repaired',reference:'Vendor report'})
  html=await(await r.request(path,{as:resident})).text();assert.ok(html.includes('Awaiting your confirmation'))
  const attempt=html.match(/name="attemptId" value="([^"]+)"/)[1]
  assert.equal((await post('/portal/repair',{requestId:key,attemptId:attempt,outcome:'confirmed',note:'Tap no longer leaks'},second)).status,404)
  await inspect?.({phase:'answer',r,t,resident,path})
  assert.equal((await post('/portal/repair',{requestId:key,attemptId:attempt,outcome:'confirmed',note:'Tap no longer leaks'})).status,303)
  assert.equal((await post('/portal/repair',{requestId:key,attemptId:attempt,outcome:'confirmed',note:'Retry'})).status,409)
  assert.ok((await(await r.request(path,{as:resident})).text()).includes('Resident confirmed resolved'))
  assert.ok((await(await r.request(secondPath,{as:second})).text()).includes('Awaiting your confirmation'),'another report is never closed by this answer')
  assert.equal((await r.state(t.id)).work.jobs.find(x=>x.id===j.id).state,'sent','a resident answer never closes the work order')
  await inspect?.({phase:'resolved',r,t,resident,path})
  const archive=await(await r.request('/api/backup')).text();assert.ok(archive.includes('Leaking kitchen tap'))
  const restored=await installation({asyncDatabase:true,now:'2026-10-25T12:00:00Z'});try {await restored.formCommand('data.restore',{confirm:'RESTORE',backup:new File([archive],'backup.rer')});assert.ok((await(await restored.request('/app?tab=settings')).text()).includes('Leaking kitchen tap'));assert.equal((await restored.request(path,{as:resident})).status,303);await restored.stepUp();await restored.command('portal.invite',{kind:'resident',tenancyId:t.id,email:'resident@example.test',displayName:'Restored resident',source:'Owner renewed the resident grant after restore'});const fresh=await restored.portalSignIn('resident@example.test');assert.ok((await(await restored.request(path,{as:fresh})).text()).includes('Resident confirmed resolved'));assert.deepEqual(Buffer.from(await(await restored.request(filePath,{as:fresh})).arrayBuffer()),png)}finally{await restored.close()}
  const history=(await(await r.request('/api/history?limit=3000')).json()).rows;for(const action of ['portal.request.submit','portal.request.link','portal.request.answer'])assert.ok(history.some(x=>x.action===action))
  const grants=(await(await r.request('/portal/api/me',{as:resident})).json()).grants
  await r.command('portal.revoke',{grantId:grants[0].id,reason:'Resident moved out'});assert.equal((await r.request(path,{as:resident})).status,303)
 } finally {await r.close()}
}
