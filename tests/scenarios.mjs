import assert from 'node:assert/strict'
import {installation,tenancyInput} from './api/harness.mjs'

const original=n=>({name:'reviewed-invoice.pdf',type:'application/pdf',base64:Buffer.from('%PDF-1.4\nReviewed '+n+'\n%%EOF').toString('base64')})
/** REPORT-007 public-door comparison, folded into the existing integrated property journey. */
export async function journey({inspect,assets=false}={}) {
 const h=await installation({assets})
 try {
  const portfolio=await h.command('portfolio.add',{name:'Cash planning'}),outsidePortfolio=await h.command('portfolio.add',{name:'Outside planning'})
  const place=async(portfolioId,name)=>{
   const property=await h.command('property.add',{portfolioId,name,address:name+', Oakland, CA',kind:'duplex',timeZone:'America/Los_Angeles'})
   const unit=await h.command('unit.add',{propertyId:property.id,identifier:'A',bedrooms:2,bathrooms:1})
   const t=await h.command('tenancy.create',{...tenancyInput,unitId:unit.id,rent:'3100',cadence:'monthly'})
   return {property,unit,t}
  }
  const home=await place(portfolio.id,'Planning house'),outside=await place(outsidePortfolio.id,'Other house')
  const owners=[]
  for(const name of ['Rowan','Jamie']) owners.push(await h.command('owner.add',{kind:'individual',legalName:name,email:name.toLowerCase()+'@example.test',mailingAddress:'10 Owner Street, Oakland, CA'}))
  await h.command('ownership.set',{propertyId:home.property.id,effectiveFrom:'2024-01-01',reason:'Recorded deed',shares:[{ownerId:owners[0].id,percent:'60'},{ownerId:owners[1].id,percent:'40'}]})
  await h.command('agreement.set',{propertyId:home.property.id,starts:'2024-01-01',feePercent:'0',reserve:'100',reference:'Original reserve agreement'})
  const agreement=await h.command('agreement.set',{propertyId:home.property.id,starts:'2027-01-01',feePercent:'0',reserve:'200',reference:'Signed 2027 reserve requirement'})
  const vendor=await h.command('vendor.add',{name:'Make-ready Works',email:'works@example.test',phone:'510-555-0100',specialties:'painting',serviceAreas:'Oakland',w9:'received',insuranceExpires:'2036-12-31',availability:'Weekdays',rate:'100',standing:'approved'})
  const terms={vendorId:vendor.id,invoiceNumber:'PAINT-1',date:'2026-12-10',lines:[{description:'Completed painting',code:'repairs',amount:'100',tax:'0'}],allocations:[{propertyId:home.property.id,amount:'100'}],original:original('paint')}
  const bill=await h.command('bill.create',terms)
  await h.command('bill.approve',{billId:bill.id,version:1})
  await h.command('bill.revise',{...terms,billId:bill.id,version:1,lines:[{description:'Reviewed actual painting',code:'repairs',amount:'120',tax:'0'}],allocations:[{propertyId:home.property.id,amount:'120'}]})
  await h.command('bill.approve',{billId:bill.id,version:2})
  await h.command('bill.create',{...terms,invoiceNumber:'UNAPPROVED',original:original('pending')})
  const q={tenancyId:home.t.id,from:'2027-01-01',to:'2027-01-31',assumptionsDate:'2026-10-20',reference:'Owner cash-planning meeting notes',confidence:'Moderate; letting time is an owner estimate, not measured probability'}
  for(const key of ['repair','market']) Object.assign(q,{[key+'Rent']:'3100',[key+'RenewalDate']:'2027-01-20',[key+'RenewalRent']:'6200',[key+'VacancyDays']:key==='repair'?'7':'3',[key+'MakeReadyDays']:key==='repair'?'7':'0',[key+'Concession']:key==='repair'?'0':'300',[key+'DepositsHeld']:'2000',[key+'NewDeposits']:'1500',[key+'DepositRefunds']:'500',[key+'Capital']:key==='repair'?'300':'0',[key+'Distributions']:'500',[key+'OpeningCash']:'1000',[key+'CollectionPercent']:'80',[key+'Source']:'Owner worksheet: opening cash excludes deposits; held deposit statement; vendor quote; renewal and concession are proposed only'})
  const read=async(query=q,opts={})=>{
   const r=await h.request('/api/cash-scenario?'+new URLSearchParams(query),opts)
   assert.equal(r.status,200,await r.clone().text());assert.equal(r.headers.get('cache-control'),'no-store')
   return r.json()
  }
  const beforeState=await h.state(home.t.id),beforeBills=await(await h.request('/api/bills')).json()
  let s=await read(),[repair,market]=s.plans
  assert.equal(s.currency,'USD');assert.equal(s.zone,'America/Los_Angeles');assert.equal(s.horizonDays,31)
  assert.equal(s.facts.tenancy.rentCents,310000);assert.equal(s.facts.tenancy.cadence,'monthly')
  assert.equal(s.facts.agreement.id,agreement.id);assert.equal(s.facts.agreement.reserveRequirementCents,20000)
  assert.equal(s.facts.agreement.reference,'Signed 2027 reserve requirement')
  assert.equal(s.facts.payables.length,1);assert.equal(s.facts.payables[0].id,bill.id);assert.equal(s.facts.payables[0].version,2)
  assert.equal(s.facts.payableCents,12000,'one current revision/property allocation, never prior revision, pending invoice or repeated owner expense totals')
  assert.equal(repair.readyDate,'2027-01-15');assert.equal(repair.workReadyDate,'2027-01-08');assert.equal(repair.marketingDate,'2027-01-08')
  assert.equal(repair.vacantDaysInHorizon,14);assert.equal(repair.grossRentCents,290000);assert.equal(repair.renewalGrossRentCents,240000)
  assert.equal(repair.collectedRentCents,232000);assert.equal(repair.availableBeforeDistributionsCents,270000);assert.equal(repair.afterDistributionsCents,220000)
  assert.equal(market.readyDate,'2027-01-04');assert.equal(market.marketingDate,'2027-01-01');assert.equal(market.vacantDaysInHorizon,3)
  assert.equal(market.grossRentCents,400000);assert.equal(market.collectedRentCents,320000);assert.equal(market.afterDistributionsCents,308000)
  assert.equal(s.difference.cashCents,88000);assert.equal(s.difference.vacantDays,-11);assert.equal(s.difference.readyDays,-11)
  assert.equal(market.deposits.alreadyHeldCents,200000);assert.equal(market.deposits.newExpectedCents,150000);assert.equal(market.deposits.refundsCents,50000);assert.equal(market.deposits.closingLiabilityCashCents,300000)
  assert.match(market.deposits.category,/excluded from operating/);assert.match(s.assumptions.kind,/User estimates/);assert.equal(s.assumptions.reference,q.reference);assert.equal(market.source,q.marketSource)
  s=await read({...q,marketVacancyDays:'10'});market=s.plans[1]
  assert.equal(market.readyDate,'2027-01-11');assert.equal(market.vacantDaysInHorizon,10);assert.equal(market.collectedRentCents,264000);assert.equal(market.afterDistributionsCents,252000);assert.equal(s.difference.cashCents,32000)
  const changedDeposits=await read({...q,marketNewDeposits:'3000',marketDepositsHeld:'0'})
  assert.equal(changedDeposits.plans[1].afterDistributionsCents,308000,'deposit cash never becomes owner operating cash')
  const short=await read({...q,repairOpeningCash:'0',repairDistributions:'9000'})
  assert.equal(short.plans[0].afterDistributionsCents,-730000);assert.equal(short.plans[0].potentialShortfallCents,730000)
  const missing={...q};delete missing.repairOpeningCash
  for(const query of [missing,{...q,repairCapital:'0.001'},{...q,marketCollectionPercent:'101'},{...q,marketRenewalDate:'none'},{...q,to:'2026-12-31'}]) assert.equal((await h.request('/api/cash-scenario?'+new URLSearchParams(query))).status,400)
  const afterState=await h.state(home.t.id)
  // The appointment clock is computed for each read; compare every persisted field, including the rest of work.
  const {appointmentNow:beforeClock,...beforeWork}=beforeState.work,{appointmentNow:afterClock,...afterWork}=afterState.work
  assert.deepEqual(afterWork,beforeWork);assert.deepEqual({...afterState,work:undefined},{...beforeState,work:undefined});assert.deepEqual(await(await h.request('/api/bills')).json(),beforeBills,'comparison and changed assumptions never alter actual books or approvals')
  // Exact cadence and half-up collection arithmetic, through ordinary new-tenancy commands.
  for(const [cadence,rent,to,expected] of [['weekly','0.01','2027-01-07',1],['fortnightly','0.03','2027-01-14',2],['monthly','0.31','2027-01-01',1]]) {
   const unit=await h.command('unit.add',{propertyId:home.property.id,identifier:cadence,bedrooms:1,bathrooms:1})
   const t=await h.command('tenancy.create',{...tenancyInput,unitId:unit.id,rent,cadence})
   const exact={...q,tenancyId:t.id,to}
   for(const key of ['repair','market'])Object.assign(exact,{[key+'Rent']:rent,[key+'RenewalDate']:'none',[key+'RenewalRent']:'0',[key+'MakeReadyDays']:'0',[key+'VacancyDays']:'0',[key+'CollectionPercent']:'50'})
   const result=await read(exact);assert.equal(result.plans[0].collectedRentCents,expected,cadence+' rational daily rent rounds half up once after collection')
  }
  const html=await(await h.request('/app?tab=tenancy&tenancy='+home.t.id+'&scenario=1&'+new URLSearchParams(q))).text()
  assert.match(html,/Cash and vacancy comparison/);assert.match(html,/2027-01-15/);assert.match(html,/Separate deposit liability cash/)
  const empty=await(await h.request('/app?tab=tenancy&tenancy='+home.t.id)).text()
  assert.match(empty,/name="repairOpeningCash"[^>]*value=""/,'new comparison starts with empty assumptions')
  const member=await h.invite('member','scenario-member@example.test'),accountant=await h.invite('member','scenario-accountant@example.test')
  assert.equal((await h.request('/api/cash-scenario?'+new URLSearchParams(q),{as:member})).status,403)
  assert.equal((await h.request('/api/cash-scenario?'+new URLSearchParams(q),{as:''})).status,401)
  const staff=await(await h.request('/auth/operators')).json(),accountantId=staff.find(x=>x.email==='scenario-accountant@example.test').id
  await h.stepUp();await h.command('operator.role',{operatorId:accountantId,role:'accountant',['portfolio:'+portfolio.id]:'1'})
  assert.equal((await read(q,{as:accountant})).tenancyId,home.t.id)
  assert.equal((await h.request('/api/cash-scenario?'+new URLSearchParams({...q,tenancyId:outside.t.id}),{as:accountant})).status,404)
  const loose=await h.command('tenancy.create',{...tenancyInput,tenantEmail:'loose-plan@example.test'})
  assert.equal((await h.request('/api/cash-scenario?'+new URLSearchParams({...q,tenancyId:loose.id}))).status,409,'missing property sources are a visible gap, never invented zero')
  const missingAgreement={...q,tenancyId:outside.t.id}
  assert.equal((await h.request('/api/cash-scenario?'+new URLSearchParams(missingAgreement))).status,409,'absent reserve agreement is unknown')
  const csv=['ref,address,owner_name,owner_email,tenant_name,tenant_email,start_date,end_date,rent,cadence,created_at,currency,time_zone','AUD-PLAN,"12 Wattle Street, Sydney NSW 2000",Owner,owner-aud@example.test,Resident,resident-aud@example.test,2024-01-01,2026-12-31,1850.00,monthly,2024-01-01T00:00:00.000Z,AUD,Australia/Sydney'].join('\n')
  const preview=await h.command('import.preview',{csv,namespace:'scenario-aud'})
  await h.command('import.apply',{csv,namespace:'scenario-aud',fingerprint:preview.fingerprint})
  const imported=(await h.state()).tenancies.find(t=>t.tenant_email==='resident-aud@example.test')
  const incompatible=await h.request('/api/cash-scenario?'+new URLSearchParams({...q,tenancyId:imported.id}))
  assert.equal(incompatible.status,409);assert.equal((await incompatible.json()).error,'scenario_currency')
  const unchanged=(await h.state()).tenancies.find(t=>t.id===imported.id)
  assert.equal(unchanged.currency,'AUD');assert.equal(unchanged.rent_cents,185000,'comparison rejection never converts source currency')
  if(inspect)await inspect({h,home,q})
  return {tenancyId:home.t.id,billId:bill.id,comparison:q}
 } finally { await h.close() }
}
