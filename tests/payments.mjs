import {leaseFields} from './leases.mjs'
import {editArchive} from './archive-edit.mjs'
import assert from 'node:assert/strict'
import {installation,tenancyInput} from './api/harness.mjs'
import {syntheticPack} from './rule-packs.mjs'
export async function journey({assets=false,inspect}={}){
 const h=await installation({assets})
 try{
  const f=await h.command('portfolio.add',{name:'Payment portfolio'}),property=await h.command('property.add',{portfolioId:f.id,name:'Payment property',address:'1 Synthetic Terrace Road',kind:'duplex',timeZone:'America/Chicago'}),u=await h.command('unit.add',{propertyId:property.id,identifier:'A',bedrooms:'2',bathrooms:'1'}),t=await h.command('tenancy.create',{...tenancyInput,unitId:u.id,rent:'1000.00',cadence:'monthly'})
  const day=(await h.state(t.id)).ledger.today
  const q=await h.command('rent.charge',{tenancyId:t.id,dueDate:day,amount:'1000.00',description:'October rent',reference:'synthetic-terrace-10'}),utility=await h.command('rent.charge',{tenancyId:t.id,dueDate:day,amount:'100.00',description:'Water',reference:'synthetic-terrace-11'})
  const co=[];for(const [i,name]of ['Alex','Jo'].entries())co.push(await h.command('household.add',{tenancyId:t.id,role:'co_tenant',name,email:'payment'+i+'@example.test',joined:'2025-01-01'}))
  const stages=[{minDaysPastDue:0,allowPartial:true,overpayment:'credit'},{minDaysPastDue:30,allowPartial:false,overpayment:'reject'}],terms={stages,priority:[q.id,utility.id]}
  await h.command('payment.policy',{tenancyId:t.id,version:0,terms,reference:'synthetic-terrace-12 approved lease policy'})
  const pay=(i,amount,state='pending')=>h.command('payment.record',{tenancyId:t.id,amount,state,payerKind:'co_tenant',payerId:co[i].id,method:'ach',receivedDate:day,reference:'synthetic-terrace-'+(20+i)})
  await h.command('payment.record',{tenancyId:t.id,amount:'1.00',state:'pending',payerKind:'resident',method:'ach',receivedDate:day,reference:'synthetic-terrace-13'},{status:409})
  await h.command('property.rules',{propertyId:property.id,stateCode:'CA',version:0,reference:'synthetic-terrace-14'})
  const pack=syntheticPack('CA');pack.fields.partialPayments.value={stages}
  const published=await h.command('rules.pack',pack);await h.command('rules.activate',{packId:published.id,consent:'REVIEWED'})
  const results=await Promise.allSettled([pay(0,'600.00'),pay(1,'600.00','settled')]);let payments=[]
  for(let i=0;i<results.length;i++){if(results[i].status==='fulfilled')payments.push(results[i].value);else payments.push(await pay(i,'600.00',i?'settled':'pending'))}
  let data=(await h.state(t.id)).ledger
  const settledAllocation=data.payments.payments.filter(p=>p.state==='settled').flatMap(p=>p.allocations).reduce((n,a)=>n+a.amount_cents,0)
  assert.deepEqual([data.balanceCents,data.payments.pendingCents],[110000-settledAllocation,60000])
  assert.equal(data.payments.creditCents,data.payments.payments.filter(p=>p.state==='settled').reduce((n,p)=>n+p.credit_cents,0))
  assert.deepEqual(data.payments.payments.map(p=>p.credit_cents).sort((a,b)=>a-b),[0,10000])
  assert.equal(data.payments.payments.flatMap(p=>p.allocations).reduce((n,a)=>n+a.amount_cents,0),110000)
  assert.ok(data.payments.payments.every(p=>p.snapshot.packs[0].version===1))
  assert.equal(data.receipts.reduce((n,r)=>n+r.amount_cents,0),settledAllocation,'only the settled allocation reduces receivables')
  const pending=data.payments.payments.find(p=>p.state==='pending')
  const native=inspect?await inspect({phase:'pending',h,t,day,pending,terms}):null
  await h.command('rent.receipt',{chargeId:q.id,amount:'1.00',receivedDate:day,reference:'synthetic-terrace-30'},{status:409})
  await h.command('rent.adjust',{chargeId:q.id,amount:'1.00',reason:'Cannot consume reserved funds'},{status:409})
  await h.restart();if(!native?.settled)await h.command('payment.settle',{paymentId:pending.id,version:1,on:day,reference:'synthetic-terrace-31 settled'})
  await h.command('payment.settle',{paymentId:pending.id,version:1,on:day,reference:'synthetic-terrace-31 settled'},{status:409})
  data=(await h.state(t.id)).ledger;assert.deepEqual([data.balanceCents,data.payments.pendingCents,data.payments.creditCents],[0,0,10000]);assert.equal(data.receipts.reduce((n,r)=>n+r.amount_cents,0),110000)
  assert.equal(data.payments.payments.find(p=>p.id===pending.id).events.length,2)
  // The same admission/allocation door records the two named payers of an approved HAP lease.
  const manager=await h.invite('admin','payment-manager@example.test'),hu=await h.command('unit.add',{propertyId:property.id,identifier:'B',bedrooms:'2',bathrooms:'1'}),ht=await h.command('tenancy.create',{...tenancyInput,unitId:hu.id,tenantName:'Synthetic voucher resident',tenantEmail:'voucher@example.test',startDate:'2026-10-01',rent:'1000.00',cadence:'monthly'})
  const hq=await h.command('rent.charge',{tenancyId:ht.id,dueDate:'2026-10-01',amount:'1000.00',description:'October shared rent',reference:'synthetic-terrace-53'})
  await h.command('payment.policy',{tenancyId:ht.id,version:0,terms:{stages,priority:[hq.id]},reference:'synthetic-terrace-54'})
  const hapPayment={tenancyId:ht.id,amount:'700.00',state:'pending',payerKind:'housing_authority',method:'ach',receivedDate:'2026-10-10',reference:'synthetic-terrace-55',payerName:'Untrusted substitution'}
  assert.equal((await h.command('payment.record',hapPayment,{status:409})).error,'hap_required')
  const signed=leaseFields(ht.id,'2026-10-01','1000','0','0','synthetic-terrace-56 signed lease');signed.terms=signed.terms.filter(t=>t.kind==='rent');Object.assign(signed.obligations.find(o=>o.kind==='hap'),{details:'Synthetic housing assistance agreement',housingAuthority:'Synthetic Housing Authority',reference:'synthetic-terrace-57',tenantPortion:'300.00',hapPortion:'700.00'})
  const lease=await h.command('lease.prepare',signed),leasePreview=await h.command('lease.preview',{leaseId:lease.leaseId,month:'2026-10'});await h.command('lease.approve',{leaseId:lease.leaseId,month:'2026-10',fingerprint:leasePreview.fingerprint},{as:manager})
  await h.stepUp();await h.command('operator.invite',{displayName:'Payment bookkeeper',email:'payment-bookkeeper@example.test',role:'bookkeeper',['portfolio:'+f.id]:'1'});const bookkeeper=await h.accept('payment-bookkeeper@example.test')
  await h.command('payment.policy',{tenancyId:ht.id},{as:bookkeeper,status:403})
  await h.command('payment.record',{tenancyId:ht.id,amount:'300.00',state:'settled',payerKind:'resident',method:'card',receivedDate:'2026-10-10',reference:'synthetic-terrace-58'},{as:bookkeeper})
  const hap=await h.command('payment.record',hapPayment,{as:bookkeeper}),hapState=(await h.state(ht.id)).ledger
  assert.deepEqual([hapState.balanceCents,hapState.payments.pendingCents],[70000,70000]);const payer=hapState.payments.payments.find(p=>p.id===hap.id);assert.equal(payer.payer_name,'Synthetic Housing Authority');assert.equal(payer.snapshot.payerSource.leaseVersionId,lease.leaseId)
  await h.command('payment.settle',{paymentId:hap.id,version:1,on:'2026-10-11',reference:'synthetic-terrace-59'},{as:bookkeeper});assert.equal((await h.state(ht.id)).ledger.balanceCents,0)
  const archive=await(await h.request('/api/backup')).text(),fresh=await installation()
  try{const invalid=await editArchive(archive,(table,row)=>{if(table==='tt_payment_allocations'){row.amount_cents+=1}});await fresh.formCommand('data.restore',{confirm:'RESTORE',backup:new File([invalid],'invalid-financial.rer')},{status:400});assert.equal((await fresh.state()).tenancies.length,0,'malformed financial archive installs no product rows');await fresh.formCommand('data.restore',{confirm:'RESTORE',backup:new File([archive],'payments.rer')});const restored=(await fresh.state(t.id)).ledger;assert.deepEqual(restored.payments,data.payments);assert.equal(restored.balanceCents,0);assert.equal((await fresh.state(ht.id)).ledger.balanceCents,0)}finally{await fresh.close()}
  const past=new Date(Date.parse(day)-40*86400000).toISOString().slice(0,10),old=await h.command('rent.charge',{tenancyId:t.id,dueDate:past,amount:'100.00',description:'Older rent',reference:'synthetic-terrace-40'})
  await h.command('payment.policy',{tenancyId:t.id,version:(await h.state(t.id)).ledger.payments.policies.at(-1).version,terms:{stages,priority:[old.id]},reference:'synthetic-terrace-41'})
  const block=await h.command('payment.record',{tenancyId:t.id,amount:'50.00',state:'pending',payerKind:'resident',method:'ach',receivedDate:day,reference:'synthetic-terrace-42'},{status:409});assert.equal(block.error,'partial_blocked')
  const extra=await h.command('payment.record',{tenancyId:t.id,amount:'150.00',state:'settled',payerKind:'resident',method:'card',receivedDate:day,reference:'synthetic-terrace-43'},{status:409});assert.equal(extra.error,'overpayment')
  const member=await h.invite('member','payments-member@example.test');const restricted=await(await h.request('/api/state?tenancy='+ht.id,{as:member})).json();assert.equal(restricted.ledger.payments.restricted,true);assert.deepEqual(restricted.ledger.payments.payments,[]);await h.command('payment.policy',{tenancyId:t.id},{as:member,status:403})
  if(inspect)await inspect({phase:'settled',h,t,day,pending,terms})
 }finally{await h.close()}
}
