import assert from 'node:assert/strict'
import {installation,tenancyInput} from './api/harness.mjs'

const email=name=>['synthetic-terrace-'+name.toLowerCase().replaceAll(' ','-'),'example.test'].join('@')
export const name='AGENT-007: owner read-only HVAC callbacks and leasing bottleneck retain scoped source evidence'
export async function journey({inspect,assets=false}={}){
 const h=await installation({assets,now:'2026-10-27T06:30:00.000Z',asyncDatabase:true,stripeKey:'synthetic-terrace-9100',stripeRequest:()=>{assert.fail('Analysis must not request a provider')}})
 try{
  const make=async(label)=>{
   const f=await h.command('portfolio.add',{name:label+' portfolio'})
   const p=await h.command('property.add',{portfolioId:f.id,name:label+' apartments',address:'91 '+label+' Road, Oakland, CA',kind:'duplex',timeZone:'America/Los_Angeles'})
   const u=await h.command('unit.add',{propertyId:p.id,identifier:'A',bedrooms:2,bathrooms:1})
   const t=await h.command('tenancy.create',{...tenancyInput,tenantEmail:email(label),unitId:u.id})
   return {f,p,u,t}
  }
  const local=await make('Linden'),outside=await make('Outside')
  const asset=async(place,kind,serial)=>h.command('asset.add',{tenancyId:place.t.id,kind,location:'Equipment closet',make:'Synthetic',model:'Synthetic unit',serial,installedDate:'2024-01-01'})
  const hvac=await asset(local,'HVAC furnace','synthetic-terrace-9101'),otherHvac=await asset(local,'HVAC cooling','synthetic-terrace-9102'),plumbing=await asset(local,'Water heater','synthetic-terrace-9103'),foreign=await asset(outside,'HVAC furnace','synthetic-terrace-9104')
  const q={propertyId:local.p.id,from:'2026-10-26',to:'2026-10-26',assetIds:hvac.id},endpoint=query=>'/api/operating-risks?'+new URLSearchParams(query)
  const read=async(query=q,opts={})=>{
   const r=await h.request(endpoint(query),opts);assert.equal(r.status,200,await r.clone().text());assert.equal(r.headers.get('cache-control'),'no-store');return r.json()
  }
  const empty=await read()
  assert.equal(empty.hvac[0].measured.callbacks,0);assert.match(empty.hvac[0].finding,/Insufficient/)
  for(const transition of [empty.leasing.showingToApplication,empty.leasing.applicationToLease]){
   assert.equal(transition.denominator,0);assert.equal(transition.dropoffPercent,null);assert.match(transition.evidence,/Insufficient/)
  }
  assert.equal(empty.assumptions,null)
  const vendor=await h.command('vendor.add',{name:'Synthetic heating contractor',email:email('vendor'),phone:'510-555-0191',specialties:'hvac,plumbing',serviceAreas:'Oakland',w9:'received',insuranceExpires:'2036-12-31',licenseNumber:'synthetic-terrace-9105',licenseExpires:'2036-12-31',availability:'Weekdays',rate:'95',standing:'approved'})
  const job=async(place,a,title)=>{
   const j=await h.command('maintenance.prepare',{tenancyId:place.t.id,assetId:a.id,title,vendorId:vendor.id,trade:'hvac',dueDate:'2026-10-26',estimate:'240'})
   await h.command('maintenance.approve',{jobId:j.id,version:1})
   await h.command('maintenance.sent',{jobId:j.id,version:2,reference:'Synthetic external handoff'})
   return j
  }
  const repair=await job(local,hvac,'Furnace short cycling'),unrelated=await job(local,otherHvac,'Other equipment sentinel'),outsideJob=await job(outside,foreign,'Outside repair sentinel')
  const complete=async(j,callback,summary='Synthetic vendor visit')=>h.command('completion.record',{jobId:j.id,completedDate:'2026-10-26',summary,reference:'Synthetic service original',...(callback?{callback}:{})})
  const check=async(j,outcome,note)=>h.command('completion.check',{jobId:j.id,outcome,note})
  await complete(repair);await check(repair,'unresolved','First visit failed')
  await complete(repair,'warranty');await check(repair,'unresolved','Issue recurred after return')
  await complete(repair,'billable');await check(repair,'no_response','No resident answer yet')
  await complete(unrelated);await check(unrelated,'confirmed','Other equipment resolved')
  await complete(outsideJob);await check(outsideJob,'confirmed','Outside resident sentinel')
  const lead=async(label,{place=local,source='own_site',sameEmail}={})=>h.command('prospect.add',{propertyId:place.p.id,name:label,email:sameEmail??email(label),source,reference:label+' first contact'})
  const stage=async(p,version,to,on='2026-10-26')=>h.command('prospect.stage',{prospectId:p.id,version,stage:to,on,reference:'Synthetic '+to+' evidence'})
  const shown=await lead('Shown case');await stage(shown,1,'shown')
  const applied=await lead('Applied case');await stage(applied,1,'applied')
  const leased=await lead('Skipped showing case');await stage(leased,1,'leased')
  const both=await lead('Shown and applied');await stage(both,1,'shown');await stage(both,2,'applied')
  const held=await lead('Held duplicate',{sameEmail:email('Applied case'),source:'email'});assert.equal(held.review,'possible_duplicate')
  const merged=await lead('Merged duplicate',{sameEmail:email('Shown case'),source:'phone'});assert.equal(merged.review,'possible_duplicate')
  await h.command('prospect.review',{prospectId:merged.id,version:1,decision:'merge',reference:'Same recorded household'})
  const separate=await lead('Reviewed separate',{sameEmail:email('Applied case'),source:'phone'});await h.command('prospect.review',{prospectId:separate.id,version:1,decision:'separate',reference:'Different household verified'})
  const future=await lead('Future effective stage');await stage(future,1,'applied','2026-10-27')
  const outsideLead=await lead('Outside prospect sentinel',{place:outside});await stage(outsideLead,1,'shown')
  const scenario={...q,assumptionDate:'2026-10-26',assumptionReference:'Synthetic owner scenario, no measured savings',preventiveCost:'100.01',callbackCost:'80.02',avoidedCallbacks:'2'}
  const data=await read(scenario),a=data.hvac[0]
  assert.deepEqual(a.measured,{jobs:1,attempts:3,callbacks:2,warrantyCallbacks:1,billableCallbacks:1,residentConfirmedChecks:0,unresolvedChecks:2,noResponseChecks:1})
  assert.equal(a.assetId,hvac.id);assert.match(a.finding,/Repeated/);assert.match(a.hypothesis,/establish no cause/)
  assert.equal(a.jobs[0].jobId,repair.id);assert.equal(a.jobs[0].attempts[2].callback,'billable')
  assert.equal(a.jobs[0].checks[2].attempt_id,a.jobs[0].attempts[2].id);assert.match(a.jobs[0].checks[2].label,/recorded by staff/)
  assert.deepEqual(a.estimates.map(x=>[x.currency,x.cents]),[['USD',24000]])
  assert.equal(a.settledCostCents,null);assert.equal(a.realizedSavingsCents,null)
  assert.deepEqual([data.assumptions.grossBenefitCents,data.assumptions.netBenefitCents],[16004,6003])
  const l=data.leasing
  assert.deepEqual([l.showingToApplication.denominator,l.showingToApplication.dropoff,l.showingToApplication.dropoffPercent],[2,1,50])
  assert.deepEqual([l.applicationToLease.denominator,l.applicationToLease.dropoff,l.applicationToLease.dropoffPercent],[2,2,100])
  assert.deepEqual(l.showingToApplication.prospectIds,[shown.id]);assert.ok(l.applicationToLease.prospectIds.includes(applied.id))
  const skip=l.prospects.find(p=>p.prospectId===leased.id);assert.equal(skip.showing,false);assert.equal(skip.applied,false);assert.equal(skip.leased,true)
  assert.equal(l.prospects.find(p=>p.prospectId===future.id).applied,false)
  assert.deepEqual(l.excludedProspects.map(p=>p.reason).sort(),['duplicate_held','merged'])
  assert.ok(l.reviewedSeparate.includes(separate.id));assert.equal(l.prospects[0].createdOn,'2026-10-26','UTC next day belongs to the property-local cohort')
  const encoded=JSON.stringify(data)
  for(const sentinel of [unrelated.id,otherHvac.id,outsideJob.id,foreign.id,outsideLead.id,'Outside repair sentinel','Outside prospect sentinel','Other equipment sentinel'])assert.ok(!encoded.includes(sentinel),'unselected source stays absent: '+sentinel)
  const paired=await read({...q,assetIds:hvac.id+','+otherHvac.id})
  assert.deepEqual(paired.hvac.map(x=>[x.assetId,x.measured.callbacks]),[[hvac.id,2],[otherHvac.id,0]],'equipment with similar kinds never shares callback counts')
  for(const [query,status] of [[{...q,assetIds:foreign.id},404],[{...q,assetIds:plumbing.id},400],[{...q,assetIds:hvac.id+','+hvac.id},400],[{...q,assetIds:''},400],[{...q,propertyId:outside.p.id},404],[{...q,to:'2026-10-27'},400],[{...scenario,preventiveCost:'1.001'},400],[{...scenario,avoidedCallbacks:'1.5'},400]])assert.equal((await h.request(endpoint(query))).status,status)
  // Reads and native rendering do not mutate any product table or use a provider.
  const snapshot=async()=>{
   const tables=(await h.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name GLOB 'tt_*' ORDER BY name").all()).results
   return Promise.all(tables.map(async({name})=>[name,(await h.db.prepare('SELECT * FROM "'+name+'" ORDER BY rowid').all()).results]))
  }
  const before=await snapshot(),messages=h.messages.length
  await read(scenario)
  const page=await h.request('/app?tab=operating-risks&'+new URLSearchParams(scenario));assert.equal(page.status,200)
  const html=await page.text()
  assert.ok(html.includes(repair.id));assert.ok(html.includes('$60.03'));assert.ok(html.includes('Hypothesis:'));assert.ok(html.includes('Evidence gaps'))
  if(inspect)await inspect({h,q:scenario,data,hvac,repair,shown})
  assert.deepEqual(await snapshot(),before,'analysis and native findings change no domain, financial, proposal, grant, custody or schedule state')
  assert.equal(h.messages.length,messages,'analysis sends no message')
  await h.stepUp()
  const staff={}
  for(const role of ['portfolio_manager','accountant','leasing','member']){
   const address=email(role)
   await h.command('operator.invite',{displayName:'Synthetic '+role,email:address,role,['portfolio:'+local.f.id]:'1'})
   staff[role]=await h.accept(address)
   const deniedBefore=await snapshot()
   for(const path of [endpoint(q),'/app?tab=operating-risks&'+new URLSearchParams(q)]){
    const r=await h.request(path,{as:staff[role]});assert.equal(r.status,403)
    const body=await r.text();assert.ok(!body.includes(repair.id)&&!body.includes('Furnace short cycling')&&!body.includes(outsideJob.id))
   }
   assert.deepEqual(await snapshot(),deniedBefore,'denied reads change no domain state')
  }
  assert.equal((await h.request(endpoint(q),{as:''})).status,401)
  const credential=await h.command('credential.mint',{label:'Synthetic analysis read',role:'portfolio_manager',scope:'read',allPortfolios:true})
  assert.equal((await h.request(endpoint(q),{as:'',headers:{authorization:'Bearer '+credential.token}})).status,403)
  await h.command('credential.revoke',{credentialId:credential.id})
  assert.equal((await h.request(endpoint(q),{as:'',headers:{authorization:'Bearer '+credential.token}})).status,401)
  const people=await(await h.request('/auth/operators')).json(),operator=people.find(p=>p.email===email('portfolio_manager'))
  await h.command('operator.status',{operatorId:operator.id,status:'inactive'})
  assert.equal((await h.request(endpoint(q),{as:staff.portfolio_manager})).status,401,'revoked session is refused on the next read')
  // A late-recorded prior-date event is excluded until the window includes its recording date.
  await h.setTime('2026-10-27T07:30:00.000Z')
  await check(repair,'confirmed','Resident later confirmed, recorded by staff')
  await stage(applied,2,'leased','2026-10-26')
  const later=await lead('Next local day');await stage(later,1,'shown','2026-10-27')
  const historical=await read(scenario)
  assert.equal(historical.hvac[0].measured.residentConfirmedChecks,0)
  assert.equal(historical.leasing.applicationToLease.dropoff,2,'late recording does not rewrite earlier cohort evidence')
  assert.ok(!historical.leasing.prospects.some(p=>p.prospectId===later.id))
  const fresh=await read({...scenario,to:'2026-10-27'})
  assert.equal(fresh.hvac[0].measured.residentConfirmedChecks,1)
  assert.equal(fresh.leasing.applicationToLease.dropoff,2,'newly effective application joins while prior application leases')
  assert.equal(fresh.leasing.applicationToLease.denominator,3)
  assert.equal(fresh.leasing.showingToApplication.denominator,3)
  assert.equal(fresh.leasing.showingToApplication.dropoff,2)
  await h.command('prospect.erase',{prospectId:later.id,version:2,reason:'Synthetic eligible erasure request'})
  assert.ok(!JSON.stringify(await read({...q,to:'2026-10-27'})).includes(later.id),'read-only recomputation cannot resurrect an erased prospect')
  const adjusted=await read({...scenario,to:'2026-10-27',callbackCost:'100.01'})
  assert.equal(adjusted.assumptions.netBenefitCents,10001,'new explicit assumptions recalculate without persisting a plan')
  const ownerSession=await h.signIn(['owner','example.test'].join('@'))
  await read(q,{as:ownerSession})
  assert.equal((await h.request('/auth/signout',{method:'POST',as:ownerSession,body:{}})).status,204)
  assert.equal((await h.request(endpoint(q),{as:ownerSession})).status,401,'an owner session that previously read sources cannot read after revocation')
  assert.equal((await h.request('/app?tab=operating-risks',{as:ownerSession})).status,303)
  await h.restart();assert.equal((await read({...q,to:'2026-10-27'})).hvac[0].measured.callbacks,2)
  console.log('PROBE AGENT-007 analysis: attributable HVAC callbacks, cohort bottlenecks, duplicates, local dates, current sources, exact assumptions and owner-only refusals passed; no analysis writes or provider requests.')
 }finally{await h.close()}
}
