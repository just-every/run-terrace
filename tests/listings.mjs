import assert from 'node:assert/strict'
import {installation,tenancyInput} from './api/harness.mjs'
const now='2026-11-04T12:00:00.000Z'
const mail=n=>['synthetic-terrace-'+n,'example.test'].join('@')
export async function journey({assets=false,inspect}={}) {
 const h=await installation({assets,now}),other=[]
 try {
  const f=await h.command('portfolio.add',{name:'Synthetic Terrace'}),
   property=await h.command('property.add',{portfolioId:f.id,name:'Synthetic Garden Flats',address:'12 Synthetic Road, Oakland, CA',kind:'duplex',timeZone:'America/Los_Angeles'}),
   units=[]
  for(const identifier of ['A','B'])units.push(await h.command('unit.add',{propertyId:property.id,identifier,bedrooms:'2',bathrooms:'1',marketRent:'2400.01'}))
  const data=async()=>(await(await h.request('/api/listings')).json())
  const current=async id=>(await data()).listings.find(x=>x.id===id)
  const publicData=async h1=>(await(await (h1??h).request('/vacancies/api',{as:''})).json()).listings
  const input={title:'Sunny garden home',description:'Two bedrooms with a quiet courtyard. Owner-entered advertised amounts.',rent:'2400.01',fees:'25.09',deposit:'1200.03',availableOn:'2026-11-04'}
  const save=async(unitId,p={})=>h.command('listing.save',{...input,unitId,...p})
  const preview=async id=>h.command('listing.preview',{listingId:id,version:(await current(id)).version})
  const publish=async id=>{const p=await preview(id);return h.command('listing.publish',{listingId:id,version:p.version,revisionId:p.revisionId,fingerprint:p.fingerprint,confirm:'PUBLISH'})}
  const a=await save(units[0].id),b=await save(units[1].id,{title:'Courtyard home B',fees:'0.00',deposit:'0.00'})
  assert.deepEqual(await publicData(),[],'drafts never become public')
  await h.command('listing.save',{...input,unitId:units[0].id,listingId:a.id,version:1,rent:'2400.001'},{status:400})
  await publish(a.id);await publish(b.id)
  let publicRows=await publicData()
  assert.equal(publicRows.length,2);assert.deepEqual(publicRows.find(x=>x.id===a.id).rentCents,240001)
  assert.deepEqual([publicRows.find(x=>x.id===a.id).feesCents,publicRows.find(x=>x.id===a.id).depositCents],[2509,120003])
  const publicDetail=await h.request('/vacancies/'+a.id,{as:''})
  assert.equal(publicDetail.status,200);assert.match(publicDetail.headers.get('cache-control'),/no-store/)
  assert.ok((await publicDetail.text()).includes('2,400.01'))
  // Exact preview is invalidated by a new draft. The old public revision stays unchanged.
  const stale=await preview(a.id)
  await save(units[0].id,{listingId:a.id,version:(await current(a.id)).version,rent:'2475.13',title:'Updated garden home'})
  assert.equal((await publicData()).find(x=>x.id===a.id).rentCents,240001)
  await h.command('listing.publish',{listingId:a.id,version:stale.version,revisionId:stale.revisionId,fingerprint:stale.fingerprint,confirm:'PUBLISH'},{status:409})
  const exact=await preview(a.id)
  const answers=await h.atOnce(Array.from({length:2},()=>['/api/commands',{method:'POST',body:{command:'listing.publish',listingId:a.id,version:exact.version,revisionId:exact.revisionId,fingerprint:exact.fingerprint,confirm:'PUBLISH'}}]))
  assert.deepEqual(answers.map(r=>r.status).sort(),[200,409],'one exact publication wins')
  publicRows=await publicData();assert.equal(publicRows.find(x=>x.id===a.id).rentCents,247513)
  const revision=publicRows.find(x=>x.id===a.id).revisionId
  const enquiry={requestId:crypto.randomUUID(),revisionId:revision,name:'Synthetic Visitor',email:mail(1),phone:'5105550141',consent_email:'granted',consent_phone:'refused',consent_text:'refused'}
  const enquire=async(p,expected=202,opts={})=>{const r=await h.request('/vacancies/'+a.id+'/enquire',{as:'',method:'POST',body:p,...opts});const value=await r.json();assert.equal(r.status,expected,JSON.stringify(value));return value}
  const messages=h.messages.length
  await enquire({...enquiry,consent_email:''},400)
  await enquire(enquiry,403,{originHeader:'https://example.test'})
  const received=await enquire({...enquiry,propertyId:'unrelated',source:'marketplace'})
  assert.deepEqual(Object.keys(received).sort(),['accepted','notice'])
  assert.equal(received.accepted,true)
  assert.ok(!JSON.stringify(received).includes(mail(1)))
  assert.deepEqual(await enquire(enquiry),received,'lost-response replay returns the same generic receipt')
  const prospectData=async()=>(await(await h.request('/api/prospects')).json()).prospects
  let prospects=await prospectData(),lead=prospects.find(x=>x.email===mail(1))
  assert.equal(prospects.length,1);assert.equal(lead.property_id,property.id);assert.equal(lead.first_source,'own_site')
  assert.equal(lead.consent.email.state,'granted');assert.equal(lead.consent.phone.state,'refused')
  assert.ok(JSON.stringify(lead).includes(revision));assert.match(JSON.stringify(lead),/unverified/i)
  const second=await enquire({...enquiry,requestId:crypto.randomUUID()})
  assert.deepEqual(second,received,'duplicate status never reaches the visitor')
  prospects=await prospectData();const held=prospects.find(x=>x.id!==lead.id)
  assert.equal(held.review,'possible_duplicate');assert.equal(held.duplicate_of,lead.id)
  await h.command('prospect.respond',{prospectId:held.id,version:held.version,channel:'email',reference:'synthetic-terrace-contact'},{status:409})
  assert.equal(h.messages.length,messages,'enquiry acceptance sends nothing')
  await h.restart()
  assert.deepEqual(await enquire(enquiry),received)
  assert.equal((await prospectData()).length,2)
  // Owner-only controls, with live session and credential refusal through ordinary doors.
  await h.stepUp()
  const member=await h.invite('member',mail(2))
  for(const [command,p]of [['listing.save',{...input,unitId:units[0].id}],['listing.preview',{listingId:a.id,version:(await current(a.id)).version}],['listing.publish',{listingId:a.id,version:exact.version,revisionId:revision,fingerprint:exact.fingerprint,confirm:'PUBLISH'}],['listing.withdraw',{listingId:a.id,version:(await current(a.id)).version}]])await h.command(command,p,{as:member,status:403})
  assert.equal((await h.request('/api/listings',{as:member})).status,403)
  assert.equal((await h.request('/api/listings',{as:''})).status,401)
  const token=await h.command('credential.mint',{label:'Synthetic leasing credential',role:'leasing',scope:'prepare',['portfolio:'+f.id]:'1'})
  await h.command('listing.withdraw',{listingId:a.id,version:(await current(a.id)).version},{as:'',headers:{authorization:'Bearer '+token.token,'idempotency-key':'synthetic-terrace-1'},status:403})
  await h.command('credential.revoke',{credentialId:token.id})
  assert.equal((await h.request('/api/listings',{as:'',headers:{authorization:'Bearer '+token.token}})).status,401)
  // Native owner and visitor forms are exercised before occupancy changes.
  if(inspect)await inspect({h,property,units,a,b,input,current,publicData,lead})
  const pending=await preview(a.id)
  const privateName='Synthetic private household sentinel'
  await h.command('tenancy.create',{...tenancyInput,unitId:units[0].id,tenantName:privateName,tenantEmail:mail(3),startDate:'2026-11-04',endDate:'2027-11-03',rent:'2475.13',cadence:'monthly'})
  assert.deepEqual((await publicData()).map(x=>x.id),[b.id],'occupancy withdraws only the affected unit')
  assert.equal((await h.request('/vacancies/'+a.id,{as:''})).status,404)
  await h.command('listing.publish',{listingId:a.id,version:pending.version,revisionId:pending.revisionId,fingerprint:pending.fingerprint,confirm:'PUBLISH'},{status:409})
  await enquire({...enquiry,requestId:crypto.randomUUID()},404)
  const html=await(await h.request('/vacancies',{as:''})).text(),wire=JSON.stringify(await publicData())
  for(const secret of [privateName,mail(3),mail(1),lead.id,'tenant_email','duplicate_of','portfolio_id'])assert.ok(!html.includes(secret)&&!wire.includes(secret),'public allowlist excludes private details')
  const report=await(await h.request('/api/leasing-report?from=2026-11-01&to=2026-11-04')).json()
  assert.match(JSON.stringify(report),/published/);assert.match(JSON.stringify(report),/unavailable/);assert.match(JSON.stringify(report),/unconfigured/)
  // Custody keeps documentary history but never restores publication or preview authority.
  const backup=await(await h.request('/api/backup')).text()
  const dest=await installation({now});other.push(dest)
  await dest.formCommand('data.restore',{backup:new File([backup],'listings.rer'),confirm:'RESTORE'})
  assert.deepEqual(await publicData(dest),[])
  const retained=await(await dest.request('/api/listings')).json()
  assert.equal(retained.listings.length,2);assert.ok(retained.listings.every(x=>!x.published&&!x.preview))
  assert.equal((await(await dest.request('/api/prospects')).json()).prospects.length,(await prospectData()).length)
  const zip=Buffer.from(await(await h.request('/api/readable-export')).arrayBuffer())
  assert.ok(zip.includes(Buffer.from('tt_listing_revisions')));assert.ok(zip.includes(Buffer.from('unpublished')))
  // Owner-request erasure removes visitor details; request tombstones and checkpoint block resurrection.
  await h.command('prospect.erase',{prospectId:lead.id,version:lead.version,reason:'synthetic-terrace-erasure'})
  await enquire(enquiry,409)
  assert.ok(!(await prospectData()).some(x=>x.id===lead.id))
  const journal=await(await h.request('/api/backup')).text()
  assert.ok(!journal.includes(mail(1))|| (await prospectData()).some(x=>x.id===held.id),'separate held enquiry remains an independently retained submission')
  const erasedHeld=(await prospectData()).find(x=>x.id===held.id)
  if(erasedHeld)await h.command('prospect.erase',{prospectId:held.id,version:erasedHeld.version,reason:'synthetic-terrace-erasure-2'})
  const latest=await(await h.request('/api/backup')).text(),restored=await installation({now});other.push(restored)
  const refusal=await restored.formCommand('data.restore',{backup:new File([backup],'old.rer'),journal:new File([latest],'new.rer'),confirm:'RESTORE'},{status:409})
  assert.equal(refusal.error,'erasure_fence')
  assert.equal((await h.request('/vacancies/not-a-listing',{as:''})).status,404)
  console.log('PROBE LEASE-001 frozen publication: two vacant units -> exact prices, one concurrent winner, stale approval refused')
  console.log('PROBE LEASE-001 public enquiry: current revision plus explicit consent -> one own_site prospect; lost reply replays, duplicate held privately')
  console.log('PROBE LEASE-001 availability: lease on A -> A withdrawn, B remains advertised')
  console.log('PROBE LEASE-001 authority and privacy: member and credential refused; public output excludes private household and prospect fields')
  console.log('PROBE LEASE-001 custody: restart retains attribution; restore unpublished; erased request refused and old archive fenced')
  console.log('PROBE REPORT-003 listing sources: publication and unavailable events -> dated own-site evidence; partners unconfigured')
 }finally{for(const item of other)await item.close();await h.close()}
}
