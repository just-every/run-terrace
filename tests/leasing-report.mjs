import assert from 'node:assert/strict'
import {installation,tenancyInput} from './api/harness.mjs'

/** REPORT-003: public HTTP report follows a vacancy through enquiry, showing, lease and move-in. */
export async function journey({inspect,assets=false}={}) {
 const h=await installation({assets})
 try {
  const f=await h.command('portfolio.add',{name:'Oakland residential'}),outside=await h.command('portfolio.add',{name:'Outside portfolio'})
  const p=await h.command('property.add',{portfolioId:f.id,name:'Linden Apartments',address:'412 Linden Street, Oakland, CA 94607',kind:'multifamily',timeZone:'America/Los_Angeles'})
  const other=await h.command('property.add',{portfolioId:outside.id,name:'Outside apartments',address:'8 Other Road, Oakland, CA',kind:'duplex',timeZone:'America/Los_Angeles'})
  const today=(await h.state()).portfolios.find(x=>x.id===f.id).properties[0].today
  const shift=n=>new Date(Date.parse(today+'T00:00:00Z')+n*86400000).toISOString().slice(0,10),month=today.slice(0,7)
  const unit=async(identifier,marketRent)=>h.command('unit.add',{propertyId:p.id,identifier,bedrooms:2,bathrooms:1,marketRent})
  const a=await unit('A','3100.15'),b=await unit('B','1550.15'),missing=await unit('C'),nonrent=await h.command('unit.add',{propertyId:p.id,identifier:'Storage',bedrooms:0,bathrooms:1,rentable:'no',marketRent:'100'})
  const q={from:today,to:today,propertyId:p.id},url=query=>'/api/leasing-report?'+new URLSearchParams(query)
  const read=async(query=q,opts={})=>{const r=await h.request(url(query),opts);assert.equal(r.status,200,await r.clone().text());assert.equal(r.headers.get('cache-control'),'no-store');return r.json()}
  const before=await read();assert.deepEqual([before.summary.rentableDays,before.summary.occupiedDays,before.summary.vacantDays],[3,0,3])
  const lead=async(name,source)=>h.command('prospect.add',{propertyId:p.id,name,email:name.toLowerCase()+'@example.test',source,reference:`${source} enquiry for Linden A on ${today}`,consent_email:'granted'})
  const dana=await lead('Dana','own_site'),lee=await lead('Lee','phone'),sam=await lead('Sam','own_site')
  let version=1
  for(const stage of ['showing_scheduled','shown','applied','offer','leased'])version=(await h.command('prospect.stage',{prospectId:dana.id,version,stage,on:today,reference:`Dana ${stage} ${today}`})).version
  await h.command('prospect.stage',{prospectId:lee.id,version:1,stage:'shown',on:today,reference:'Lee toured A, no application'})
  await h.command('prospect.stage',{prospectId:sam.id,version:1,stage:'applied',on:today,reference:'Sam applied; still under review'})
  const duplicate=await h.command('prospect.add',{propertyId:p.id,name:'Dana duplicate',email:'dana@example.test',source:'email',reference:'Duplicate enquiry'})
  assert.equal(duplicate.review,'clear','a leased lead is closed and does not hold a later contact')
  // An open duplicate is excluded until a person reviews it, and a merge counts the first source once.
  const held=await h.command('prospect.add',{propertyId:p.id,name:'Sam duplicate',email:'SAM@example.test',source:'email',reference:'Repeat application question'})
  assert.equal(held.review,'possible_duplicate')
  await h.command('prospect.review',{prospectId:held.id,version:1,decision:'merge',reference:'Same Sam household'})
  const board=await h.command('turnover.open',{unitId:b.id,moveOut:shift(-1)})
  const future=await h.command('tenancy.create',{...tenancyInput,unitId:b.id,tenantEmail:'future@example.test',startDate:shift(1),endDate:shift(365),rent:'1550',cadence:'monthly'})
  const stillVacant=await read(),vb=stillVacant.units.find(x=>x.unitId===b.id)
  assert.equal(vb.vacantDays,1);assert.equal(vb.vacancySpells[0].nextTenancyId,future.id);assert.equal(vb.vacancySpells[0].daysToLease,0);assert.equal(vb.vacancySpells[0].nextMoveIn,shift(1))
  assert.equal(vb.turnovers[0].turnoverId,board.id);assert.equal(vb.turnovers[0].availableOn,null);assert.ok(vb.turnovers[0].forecastReadyDate>today,'a planned ready date is kept separate from actual readiness')
  const t=await h.command('tenancy.create',{...tenancyInput,unitId:a.id,tenantName:'Dana Ortiz',tenantEmail:'dana@example.test',startDate:today,endDate:today,rent:'3100',cadence:'monthly'})
  const renewal=await h.command('renewal.prepare',{tenancyId:t.id,endDate:shift(365),rent:'3200',source:'Staff-recorded reviewed renewal terms'})
  await h.command('proposal.approve',{proposalId:renewal.id})
  await h.command('term.add',{tenancyId:t.id,kind:'rent',description:'Move-in rent',amount:'3100',starts:today,ends:today})
  const preview=await h.command('charges.preview',{month});await h.command('charges.post',{month,fingerprint:preview.fingerprint})
  const rent=(await h.state(t.id)).ledger.charges.find(x=>x.term_id)
  await h.command('rent.receipt',{chargeId:rent.id,amount:(rent.amount_cents/100).toFixed(2),receivedDate:today,reference:'External ACH Linden A',method:'ach'})
  const manual=await h.command('rent.charge',{tenancyId:t.id,dueDate:today,amount:'10',description:'Unclassified manual charge',reference:'MANUAL-10'})
  await h.command('rent.receipt',{chargeId:manual.id,amount:'10',receivedDate:today,reference:'External unclassified receipt',method:'cash'})
  const decisions=[]
  for(const [label,decision] of [['D','pending'],['E','rejected']]){const u=await unit(label),lease=await h.command('tenancy.create',{...tenancyInput,unitId:u.id,tenantEmail:label+'@example.test',startDate:today,endDate:today,rent:'1500',cadence:'monthly'}),proposal=await h.command('renewal.prepare',{tenancyId:lease.id,endDate:shift(365),rent:'1550',source:'Reviewed renewal '+label});if(decision==='rejected')await h.command('proposal.reject',{proposalId:proposal.id});decisions.push({lease,proposal,decision})}
  const after=await read(),ua=after.units.find(x=>x.unitId===a.id),ub=after.units.find(x=>x.unitId===b.id)
  assert.deepEqual([after.summary.rentableDays,after.summary.occupiedDays,after.summary.vacantDays],[5,3,2])
  assert.equal(ua.daily.find(x=>x.date===today).tenancyIds[0],t.id);assert.equal(ua.vacantDays,0);assert.equal(ub.vacancySpells[0].daysInWindow,1)
  const daysInMonth=new Date(Number(today.slice(0,4)),Number(today.slice(5,7)),0).getDate()
  assert.equal(ua.potentialRentCents,Math.round(310015/daysInMonth));assert.equal(ua.rentReceiptsCents,rent.amount_cents)
  assert.equal(after.summary.potentialRentCents,Math.round(465030/daysInMonth));assert.equal(after.summary.rentReceiptsCents,rent.amount_cents)
  assert.ok(after.gaps.length>0,'missing market rent and unclassified receipt coverage are visible')
  assert.equal(after.units.find(x=>x.unitId===missing.id).potentialRentCents,null);assert.equal(after.units.find(x=>x.unitId===nonrent.id).rentableDays,0)
  const own=after.funnel.find(x=>x.source==='own_site'),phone=after.funnel.find(x=>x.source==='phone')
  assert.deepEqual([own.leads,own.leased,own.applied],[2,1,2]);assert.deepEqual([phone.leads,phone.showing,phone.applied],[1,1,0])
  assert.equal(own.conversionPercent,50);assert.equal(phone.showingToApplicationDropoffPercent,100);assert.equal(own.applicationToLeaseDropoffPercent,50);assert.ok(own.prospects.flatMap(x=>x.events).some(x=>x.stage==='leased'&&x.date===today&&x.reference.includes('Dana')))
  const retained=after.renewals.find(x=>x.tenancyId===t.id)
  assert.equal(after.summary.renewalCohort,3);assert.equal(after.summary.renewalPending,1);assert.equal(after.summary.renewalRejected,1)
  for(const d of decisions)assert.equal(after.renewals.find(x=>x.tenancyId===d.lease.id).status,d.decision)
  assert.equal(phone.showingToApplicationDropoff,1);assert.equal(own.applicationToLeaseDropoff,1)
  assert.equal(retained.proposalId,renewal.id);assert.equal(retained.approvedOn,today);assert.equal(after.summary.renewalAccepted,1)
  assert.ok(ua.receipts.some(x=>x.chargeId===rent.id&&x.reference==='External ACH Linden A'))
  const past=await read({...q,from:shift(-7),to:shift(-1)});assert.equal(past.summary.rentableDays,0,'no invented inventory days before units were recorded');assert.equal(past.summary.occupancyPercent,null);assert.equal(past.summary.economicVacancyPercent,null)
  const ready=(await h.state()).turnovers.find(x=>x.id===board.id)
  for(const task of ready.tasks)await h.command('turnover.task.submit',{taskId:task.id})
  for(const task of ready.tasks)await h.command('turnover.task.check',{taskId:task.id})
  const published=await h.command('turnover.publish',{turnoverId:board.id}),publishedReport=await read(),actualBoard=publishedReport.units.find(x=>x.unitId===b.id).turnovers[0]
  assert.equal(actualBoard.availableOn,published.availableOn);assert.equal(actualBoard.readyByWindowEnd,false,'a published future availability is not a ready unit today');assert.equal(publishedReport.units.find(x=>x.unitId===b.id).listingFreshness,'unknown')
  // Historic money keeps its currency: an imported AUD lease transferred through the ordinary unit door.
  const gapProperty=await h.command('property.add',{portfolioId:f.id,name:'Historical currency',address:'16 History Road, Oakland, CA',kind:'duplex',timeZone:'America/Los_Angeles'}),gapUnit=await h.command('unit.add',{propertyId:gapProperty.id,identifier:'AUD',bedrooms:1,bathrooms:1,marketRent:'2000'})
  const csv=['ref,address,owner_name,owner_email,tenant_name,tenant_email,start_date,end_date,rent,cadence,created_at,currency,time_zone',`AUD-1,12 Wattle Street,Owner,owner-aud@example.test,Resident,resident-aud@example.test,2024-01-01,${shift(365)},1850.00,monthly,2024-01-01T00:00:00.000Z,AUD,Australia/Sydney`].join('\n')
  const imported=await h.command('import.preview',{csv,namespace:'report-aud'});await h.command('import.apply',{csv,namespace:'report-aud',fingerprint:imported.fingerprint})
  const old=(await h.state()).tenancies.find(x=>x.tenant_email==='resident-aud@example.test'),moved=await h.command('tenancy.transfer',{tenancyId:old.id,unitId:gapUnit.id,moveIn:today})
  await h.command('term.add',{tenancyId:moved.id,kind:'rent',description:'AUD rent',amount:'1850',starts:today,ends:today})
  const audPreview=await h.command('charges.preview',{month});await h.command('charges.post',{month,fingerprint:audPreview.fingerprint})
  const audCharge=(await h.state(moved.id)).ledger.charges.find(x=>x.term_id)
  await h.command('rent.receipt',{chargeId:audCharge.id,amount:(audCharge.amount_cents/100).toFixed(2),receivedDate:today,reference:'AUD external rent'})
  const gapReport=await read({...q,propertyId:gapProperty.id})
  assert.ok(gapReport.gaps.some(x=>x.code==='non_usd'));assert.equal(gapReport.summary.rentReceiptsCents,0);assert.equal(gapReport.units[0].excludedReceipts[0].currency,'AUD')
  assert.equal((await h.state(moved.id)).tenancies.find(x=>x.id===moved.id).currency,'AUD','a report never relabels historical currency')
  const only=await read({...q,unitId:a.id});assert.deepEqual(only.units.map(x=>x.unitId),[a.id])
  assert.equal((await h.request(url({...q,from:shift(1)}))).status,400);assert.equal((await h.request(url({...q,to:shift(1)}))).status,400)
  assert.equal((await h.request(url(q),{as:''})).status,401)
  await h.stepUp()
  const staff={}
  for(const role of ['accountant','member']){const email=role+'-leasing@example.test';await h.command('operator.invite',{displayName:role,email,role,['portfolio:'+f.id]:'1'});staff[role]=await h.accept(email)}
  const scoped=await read(q,{as:staff.accountant});assert.equal(scoped.summary.occupiedDays,3)
  assert.ok(scoped.funnel.every(x=>!x.prospects?.length),'financial report readers without prospect rights receive aggregates only')
  assert.ok(!JSON.stringify(scoped).includes('Dana leased'),'private prospect references stay behind their existing permission')
  assert.equal((await h.request(url({...q,propertyId:other.id}),{as:staff.accountant})).status,404)
  assert.equal((await h.request(url(q),{as:staff.member})).status,403)
  const html=await(await h.request('/app?tab=leasing-report&'+new URLSearchParams(q))).text()
  assert.ok(html.includes('External ACH Linden A'));assert.ok(html.includes(today));assert.ok(html.includes('name="from"'))
  if(inspect)await inspect({h,p,q,t,a,b})
 } finally {await h.close()}
}
