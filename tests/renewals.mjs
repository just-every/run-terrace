// LEASE-012: a renewal campaign through the public command and read doors: scheduling from lease ends, the offer
// comparison before approval, approved sends, staff-recorded replies and outcomes, a staff-recorded signed renewal
// activating once (PORT-005), and its sources in REPORT-003, REPORT-007 and SAFE-005's export and restore.
import assert from 'node:assert/strict'
import {installation,tenancyInput} from './api/harness.mjs'
import {leaseFields} from './leases.mjs'

const now='2026-10-26T12:00:00.000Z',zone='America/Los_Angeles',day=d=>new Intl.DateTimeFormat('en-CA',{timeZone:zone}).format(d)
const add=(d,n)=>new Date(Date.parse(d+'T00:00:00Z')+n*86400000).toISOString().slice(0,10)
const offer=(renewalId,end,rent)=>({renewalId,endDate:add(end,365),rent,deadline:end,marketRent:'1975',marketRentDate:add(end,-1),marketRentSource:'Comparable two-bed listings survey',vacantDays:'30',makeReadyCost:'1200',makeReadySource:'Paint and clean quote Q-17',leasingCost:'900',leasingSource:'Leasing fee schedule',source:'Annual renewal review'})

export async function journey({assets=false,inspect}={}) {
 const h=await installation({assets,now})
 try {
  // Each lease ends today at the property, so the dated sources fall inside a report window that ends today.
  const end=day(new Date(now)),start=add(end,-364)
  const portfolio=await h.command('portfolio.add',{name:'Renewal homes'})
  const property=await h.command('property.add',{portfolioId:portfolio.id,name:'Cedar Row',address:'22 Cedar Row, Oakland, CA',kind:'multifamily',timeZone:zone})
  const lease=async(identifier,tenantName,endDate=end)=>{const unit=await h.command('unit.add',{propertyId:property.id,identifier,bedrooms:2,bathrooms:1});return h.command('tenancy.create',{...tenancyInput,unitId:unit.id,tenantName,tenantEmail:identifier.toLowerCase()+'@example.test',startDate:start,endDate,rent:'1800',cadence:'monthly'})}
  const a=await lease('A1','Ana Ruiz'),b=await lease('B1','Ben Ode'),c=await lease('C1','Cy Park'),later=await lease('D1','Dee Long',add(end,200)),early=await lease('E1','Eli Soon',add(end,2))
  await h.command('household.add',{tenancyId:a.id,role:'co_tenant',name:'Luis Ruiz',email:'luis@example.test',joined:start})
  await h.command('household.add',{tenancyId:a.id,role:'occupant',name:'Mia Ruiz',email:'mia@example.test',joined:start})
  const manager=await h.invite('admin','renewals-manager@example.test'),member=await h.invite('member','renewals-member@example.test')

  // Scheduling creates one item per current lease ending in the window, once.
  const scheduled=await h.command('renewal.schedule',{from:add(end,-10),to:add(end,30),propertyId:property.id},{as:member})
  assert.equal(scheduled.created.length,4)
  assert.equal((await h.command('renewal.schedule',{from:add(end,-10),to:add(end,30)})).created.length,0,'a rerun schedules nothing twice')
  const item=async t=>(await h.state(t.id)).renewals[0]
  const [ra,rb,rc]=[await item(a),await item(b),await item(c)]
  for(const r of [ra,rb,rc]){const e=r.events.find(e=>e.kind==='scheduled');assert.equal(e.happened_on,day(new Date(e.recorded_at)),'scheduling is dated at the property, not the office')}
  assert.equal((await h.state(later.id)).renewals.length,0,'a lease ending outside the window is not scheduled')
  assert.equal(ra.nextAction,'Prepare a renewal offer')
  assert.equal((await h.command('renewal.prepare',{tenancyId:a.id,endDate:add(end,365),rent:'1890.00',source:'Direct'},{status:409})).error,'renewal_campaign','scheduled work cannot be bypassed by a direct renewal')

  // The offer freezes its comparison and recipients: current household contacts with email under PORT-004.
  await h.stepUp()
  const credential=await h.command('credential.mint',{label:'synthetic-terrace-91 renewal agent',role:'member',scope:'prepare',['portfolio:'+portfolio.id]:'1'})
  const options={tenancyId:a.id,...offer(ra.id,end,'1890.00'),alternatives:[{rent:'1890',endDate:add(end,365),concessionCost:'0',source:'synthetic-terrace-91 market option'},{rent:'1850',endDate:add(end,365),concessionCost:'100',source:'synthetic-terrace-91 retention option'}],conditionSource:'Inspection reviewed: ordinary wear',communicationSource:'Resident asked to stay; email record 91',cashSource:'Owner approved vacancy and reserve worksheet 91',requiredSigners:['Ana Ruiz','Luis Ruiz','Rowan Ellis']}
  await h.command('renewal.prepare',options,{as:member,status:403})
  const spec={credentialId:credential.id,action:'renewal.prepare',arguments:options,purpose:'Compare sourced renewal alternatives',nextStep:'A person reviews pricing, legal terms and notices',dueOn:end}
  await h.command('agent.enqueue',spec,{as:member,status:403})
  const workload=await h.command('agent.enqueue',spec),outbound=h.messages.length
  const executed=await h.command('agent.execute',{workloadId:workload.id,version:workload.version},{as:'',headers:{authorization:'Bearer '+credential.token,'idempotency-key':'synthetic-terrace-91-prepare'}})
  let oa={id:executed.id}
  assert.equal(h.messages.length,outbound,'agent preparation sends nothing')
  const evidence=(await(await h.request('/api/agent-workloads')).json()).workloads.find(w=>w.id===workload.id)
  assert.deepEqual([evidence.state,evidence.attempts,evidence.costs.modelCents,evidence.costs.providerCents],['prepared',1,0,0])
  assert.equal(evidence.arguments.conditionSource,'Inspection reviewed: ordinary wear')
  assert.equal(evidence.outcomeEvidence.subjectId,oa.id)
  await h.command('proposal.approve',{proposalId:oa.id},{as:'',status:403,headers:{authorization:'Bearer '+credential.token,'idempotency-key':'synthetic-terrace-91-no-approval'}})
  const stale=await h.command('agent.enqueue',{...spec,arguments:{...options,tenancyId:b.id,renewalId:rb.id}})
  await h.command('renewal.prepare',{tenancyId:a.id,...offer(ra.id,end,'1880.00')},{as:member,status:409})
  const ob=await h.command('renewal.prepare',{tenancyId:b.id,...offer(rb.id,end,'1850.00')},{as:member})
  const oc=await h.command('renewal.prepare',{tenancyId:c.id,...offer(rc.id,end,'1800.00')},{as:member})
  const pending=(await item(a)).offer
  assert.equal(pending.state,'pending')
  assert.deepEqual(pending.payload.alternatives.map(a=>[a.rentCents,a.concessionCents,a.source]),[[189000,0,'synthetic-terrace-91 market option'],[185000,10000,'synthetic-terrace-91 retention option']])
  assert.equal(pending.payload.alternatives[1].comparison.changeCents,5000)
  assert.deepEqual(pending.payload.comparison.changeCents,9000);assert.equal(pending.payload.comparison.changeBp,500)
  assert.equal(pending.payload.comparison.marketGapCents,-8500);assert.equal(pending.payload.comparison.marketGapBp,-430)
  assert.equal(pending.payload.comparison.vacancyCents,177534,'30 days × $1,800 × 12 ÷ 365, rounded once')
  assert.equal(pending.payload.comparison.turnoverCents,387534)
  assert.deepEqual(pending.payload.recipients.map(r=>r.email),['a1@example.test','luis@example.test'],'an occupant is not an offer recipient')
  const page=await(await h.request('/app?tab=renewals',{as:manager})).text()
  for(const shown of ['+$90.00 (+5.00%)','$1,975.00 dated','(-4.30%)','Estimated turnover cost','$3,875.34','Approve offer'])assert.ok(page.includes(shown),'shown before approval: '+shown)

  await inspect?.({h,stage:'options',renewalId:ra.id})

  // Approval needs another person (ROLE-003); it approves the exact offer and changes no lease.
  await h.command('proposal.approve',{proposalId:oa.id},{as:member,status:403})
  for(const o of [oa,ob,oc])await h.command('proposal.approve',{proposalId:o.id},{as:manager})
  assert.equal((await h.command('agent.execute',{workloadId:stale.id,version:stale.version},{as:'',status:409,headers:{authorization:'Bearer '+credential.token,'idempotency-key':'synthetic-terrace-91-stale'}})).error,'renewal_changed')
  const stopped=(await(await h.request('/api/agent-workloads')).json()).workloads.find(w=>w.id===stale.id)
  assert.deepEqual([stopped.state,stopped.executionAvailable,stopped.events.at(-1).kind],['paused',false,'stopped'])
  let s=await h.state(a.id)
  assert.equal(s.tenancies.find(x=>x.id===a.id).end_date,end,'an approved offer is not a renewal');assert.equal(s.renewals[0].nextAction,'Send the approved offer')

  // Only an explicit send emails the approved offer; the provider's answer is recorded and never resent.
  await h.command('renewal.send',{renewalId:ra.id},{as:member,status:403})
  const out=h.messages.length,sent=await h.command('renewal.send',{renewalId:ra.id})
  assert.deepEqual(sent.emailOutcomes.map(x=>[x.to,x.outcome]),[['a1@example.test','accepted'],['luis@example.test','accepted']])
  assert.match(sent.notice,/accepted by the mail provider; delivery to the household is not confirmed/)
  const mail=h.messages.slice(out);assert.equal(mail.length,2);assert.match(mail[0].subject,/Lease renewal offer/);assert.match(mail[0].text,/\$1,890\.00 per month/)
  assert.equal((await h.command('renewal.send',{renewalId:ra.id},{status:409})).error,'already_sent');assert.equal(h.messages.length,out+2)
  for(const r of [rb,rc])await h.command('renewal.send',{renewalId:r.id})

  // A counteroffer invalidates the prior authority until another exact offer is approved.
  await h.command('renewal.reply',{renewalId:ra.id,outcome:'counteroffer',on:end,source:'synthetic-terrace-91 resident counteroffer',note:'1875 per month requested'})
  assert.equal((await h.command('renewal.send',{renewalId:ra.id},{status:409})).error,'offer_not_approved')
  await h.command('renewal.reply',{renewalId:ra.id,outcome:'accepted',on:end,source:'Cannot accept obsolete offer'},{status:409})
  await h.command('lease.prepare',{...leaseFields(a.id,add(end,1),'1890'),renewalId:ra.id},{status:409})
  await inspect?.({h,stage:'counteroffer',renewalId:ra.id})
  oa=await h.command('renewal.prepare',{tenancyId:a.id,...offer(ra.id,end,'1875.00')},{as:member})
  assert.equal((await item(a)).offer.state,'pending')
  await h.command('renewal.send',{renewalId:ra.id},{status:409})
  await h.command('proposal.approve',{proposalId:oa.id},{as:manager})
  await h.command('renewal.send',{renewalId:ra.id})

  const earlyItem=await item(early),earlyOffer=await h.command('renewal.prepare',{tenancyId:early.id,...offer(earlyItem.id,end,'1800'),deadline:add(end,2)},{as:member})
  await h.command('proposal.approve',{proposalId:earlyOffer.id},{as:manager});await h.command('renewal.send',{renewalId:earlyItem.id})
  assert.equal((await item(early)).nextAction,'Escalate unanswered offer to the owner before 2026-10-28; no automatic contact','the owner queue escalates two days before the deadline')

  // Staff-recorded replies and outcomes: accepted, declined then nonrenewal, unanswered stays open.
  await h.command('renewal.reply',{renewalId:ra.id,outcome:'accepted',on:end,source:'Ana replied by email to the manager'})
  await h.command('renewal.reply',{renewalId:rb.id,outcome:'declined',on:end,source:'Ben called the office'})
  await h.command('renewal.close',{renewalId:rb.id,outcome:'nonrenewal',on:end,source:'Owner decision recorded in the call note'})
  assert.equal((await h.command('renewal.close',{renewalId:rc.id,outcome:'no_response',on:end,source:'No reply'},{status:409})).error,'deadline_open')

  // The signed renewal is a staff-recorded original matching the accepted offer, activated once by another person.
  const signed={...leaseFields(a.id,add(end,1),'1875','100','25','Signed renewal'),signers:['Ana Ruiz','Luis Ruiz','Rowan Ellis'],renewalId:ra.id}
  assert.equal((await h.command('lease.prepare',{...signed,signers:['Ana Ruiz','Rowan Ellis']},{as:manager,status:409})).error,'renewal_signers','a missing co-tenant signature cannot be recorded as complete')
  await h.command('lease.prepare',{...leaseFields(c.id,add(end,1),'1800','100','25','Unaccepted'),renewalId:rc.id},{status:409})
  assert.equal((await h.command('lease.prepare',{...signed,...leaseFields(a.id,add(end,1),'1900','100','25','Signed renewal'),renewalId:ra.id},{as:manager,status:409})).error,'renewal_terms')
  const version=await h.command('lease.prepare',signed,{as:manager})
  assert.match(version.notice,/signature recorded by staff, not verified by an e-signature provider/)
  assert.equal((await h.state(a.id)).tenancies.find(x=>x.id===a.id).end_date,end,'recording the signed original activates nothing')
  const preview=await h.command('lease.preview',{leaseId:version.leaseId,month:'2026-11'})
  assert.deepEqual(preview.lines.map(x=>[x.kind,x.amountCents]),[['rent',187500],['utility',4000],['pet',2500],['parking',7500],['concession',10000]],'future charges match every executed term in exact cents')
  await h.command('lease.approve',{leaseId:version.leaseId,month:preview.month,fingerprint:preview.fingerprint},{as:manager,status:403})
  const activated=await h.command('lease.approve',{leaseId:version.leaseId,month:preview.month,fingerprint:preview.fingerprint})
  assert.match(activated.notice,/Renewal activated/)
  await h.command('lease.approve',{leaseId:version.leaseId,month:preview.month,fingerprint:preview.fingerprint},{status:409})
  s=await h.state(a.id)
  const renewedTenancy=s.tenancies.find(x=>x.id===a.id)
  assert.deepEqual([renewedTenancy.end_date,renewedTenancy.rent_cents],[add(end,365),187500])
  assert.equal(s.renewals[0].state,'executed');assert.equal(s.renewals[0].nextAction,null)
  assert.equal(s.leaseVersions[0].payload.renewal.proposalId,oa.id)
  assert.deepEqual(s.leaseVersions[0].signers.map(s=>s.name),['Ana Ruiz','Luis Ruiz','Rowan Ellis'],'the original records every owner-reviewed required signer')
  const run=await h.command('charges.preview',{month:preview.month})
  assert.deepEqual(run.lines.filter(x=>x.tenancyId===a.id&&x.kind==='rent').map(x=>x.termId),preview.lines.filter(x=>x.kind==='rent').map(x=>x.termId),'the ordinary run posts the reviewed renewal schedule')

  assert.deepEqual(run.lines.filter(x=>x.tenancyId===a.id),preview.lines,'ordinary future charges match the reviewed signed terms in full')
  await h.command('charges.post',{month:run.month,fingerprint:run.fingerprint})
  assert.equal((await h.command('charges.preview',{month:run.month})).newLines,0,'posted renewal charges cannot repeat')
  const posted=await h.state(a.id)
  assert.deepEqual(posted.ledger.charges.map(x=>x.amount_cents).sort((a,b)=>a-b),[2500,4000,7500,187500])
  assert.deepEqual(posted.ledger.adjustments.map(x=>x.amount_cents),[10000])

  // The follow-up queue keeps every unresolved household with its named next action.
  const queue=await(await h.request('/app?tab=renewals')).text(),follow=queue.slice(queue.indexOf('Follow-up queue'),queue.indexOf('<h2>Renewed'))
  assert.ok(follow.includes('Cy Park')&&follow.includes('Escalate unanswered offer to the owner before '+end));assert.ok(follow.includes('Ben Ode')&&follow.includes('Nonrenewal: plan the move-out'))
  assert.ok(!follow.includes('Ana Ruiz'),'the executed renewal leaves the queue')

  // REPORT-003: dated campaign sources and outcomes; the signature is staff-recorded, never inferred.
  const report=await(await h.request('/api/leasing-report?'+new URLSearchParams({from:add(end,-20),to:end,propertyId:property.id}))).json()
  const by=t=>report.renewals.find(r=>r.tenancyId===t.id)
  assert.deepEqual([by(a).status,by(a).signedStatus],['accepted','staff_recorded_original'])
  assert.deepEqual([by(b).status,by(b).campaignOutcome],['nonrenewed','nonrenewal']);assert.equal(by(c).status,'pending')
  assert.deepEqual(by(c).campaign.map(e=>e.event),['scheduled','send','send_result'])
  assert.ok(report.sources.some(x=>x.kind==='renewal_campaign'&&x.event==='executed'&&x.tenancyId===a.id&&x.date===end))
  await inspect?.({h,property,from:add(end,-20),to:end,stage:'executed',renewalId:ra.id,leaseId:version.leaseId})

  // REPORT-007: the executed renewal is the actual dated source; another offer stays an assumption.
  await h.command('agreement.set',{propertyId:property.id,starts:add(end,-400),feePercent:'0',reserve:'100',reference:'Reserve agreement'})
  const q={tenancyId:a.id,from:add(end,-5),to:add(end,25),assumptionsDate:end,reference:'Renewal plan',confidence:'Owner estimate'}
  for(const key of ['repair','market'])Object.assign(q,{[key+'Rent']:'1800',[key+'RenewalDate']:'none',[key+'RenewalRent']:'0',[key+'VacancyDays']:'0',[key+'MakeReadyDays']:'0',[key+'Concession']:'0',[key+'DepositsHeld']:'0',[key+'NewDeposits']:'0',[key+'DepositRefunds']:'0',[key+'Capital']:'0',[key+'Distributions']:'0',[key+'OpeningCash']:'0',[key+'CollectionPercent']:'100',[key+'Source']:'Owner worksheet'})
  const plan=await(await h.request('/api/cash-scenario?'+new URLSearchParams(q))).json()
  assert.deepEqual(plan.facts.renewals.actual.map(x=>[x.effective,x.rentCents]),[[add(end,1),187500]])
  assert.ok(plan.plans.every(p=>p.renewalDate===add(end,1)&&p.renewalRentCents===187500&&/^Actual/.test(p.renewalBasis)))
  const other=await(await h.request('/api/cash-scenario?'+new URLSearchParams({...q,tenancyId:c.id}))).json()
  assert.deepEqual(other.facts.renewals.proposed.map(x=>[x.rentCents,x.basis]),[[180000,'Assumption: renewal offer not executed']])

  // SAFE-005: the signed renewal and campaign history are in the readable export and survive a fresh restore.
  const bytes=Buffer.from(await(await h.request('/api/readable-export')).arrayBuffer()),entries=new Map()
  for(let o=0;bytes.readUInt32LE(o)===0x04034b50;){const n=bytes.readUInt16LE(o+26),x=bytes.readUInt16LE(o+28),size=bytes.readUInt32LE(o+18);entries.set(bytes.subarray(o+30,o+30+n).toString(),bytes.subarray(o+30+n+x,o+30+n+x+size));o+=30+n+x+size}
  const manifest=JSON.parse(entries.get('manifest.json')),original=Buffer.from(signed.source.base64,'base64')
  assert.deepEqual(entries.get(manifest.files.find(f=>f.table==='tt_lease_sources'&&f.sha256===s.leaseVersions[0].source_sha256).path),original)
  assert.ok(entries.get('tables/tt_renewal_events.csv').toString().includes('executed'))
  const backup=await(await h.request('/api/backup')).text(),fresh=await installation()
  try {
   await fresh.formCommand('data.restore',{confirm:'RESTORE',backup:new File([backup],'renewals.rer')})
   const restored=await fresh.state(a.id)
   assert.deepEqual(restored.renewals[0].offers.map(o=>o.id),s.renewals[0].offers.map(o=>o.id),'offer order survives equal timestamps and archive reconstruction')
   assert.deepEqual(restored.renewals.map(r=>[r.state,r.events.map(e=>e.kind)]),s.renewals.map(r=>[r.state,r.events.map(e=>e.kind)]))
   assert.deepEqual(Buffer.from(await(await fresh.request('/api/lease-source?id='+version.leaseId)).arrayBuffer()),original)
  }finally{await fresh.close()}
 }finally{await h.close()}
}
