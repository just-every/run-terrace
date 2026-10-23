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
  const archive=await(await h.request('/api/backup')).text(),fresh=await installation()
  try{const invalid=await editArchive(archive,(table,row)=>{if(table==='tt_payment_allocations'){row.amount_cents+=1}});await fresh.formCommand('data.restore',{confirm:'RESTORE',backup:new File([invalid],'invalid-financial.rer')},{status:400});assert.equal((await fresh.state()).tenancies.length,0,'malformed financial archive installs no product rows');await fresh.formCommand('data.restore',{confirm:'RESTORE',backup:new File([archive],'payments.rer')});const restored=(await fresh.state(t.id)).ledger;assert.deepEqual(restored.payments,data.payments);assert.equal(restored.balanceCents,0)}finally{await fresh.close()}
  const past=new Date(Date.parse(day)-40*86400000).toISOString().slice(0,10),old=await h.command('rent.charge',{tenancyId:t.id,dueDate:past,amount:'100.00',description:'Older rent',reference:'synthetic-terrace-40'})
  await h.command('payment.policy',{tenancyId:t.id,version:1,terms:{stages,priority:[old.id]},reference:'synthetic-terrace-41'})
  const block=await h.command('payment.record',{tenancyId:t.id,amount:'50.00',state:'pending',payerKind:'resident',method:'ach',receivedDate:day,reference:'synthetic-terrace-42'},{status:409});assert.equal(block.error,'partial_blocked')
  const extra=await h.command('payment.record',{tenancyId:t.id,amount:'150.00',state:'settled',payerKind:'resident',method:'card',receivedDate:day,reference:'synthetic-terrace-43'},{status:409});assert.equal(extra.error,'overpayment')
  const member=await h.invite('member','payments-member@example.test');await h.command('payment.policy',{tenancyId:t.id},{as:member,status:403})
  if(inspect)await inspect({phase:'settled',h,t,day,pending,terms})
 }finally{await h.close()}
}
