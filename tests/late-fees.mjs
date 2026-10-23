import {editArchive} from './archive-edit.mjs'
import assert from 'node:assert/strict'
import {installation,tenancyInput} from './api/harness.mjs'
import {syntheticPack} from './rule-packs.mjs'
export async function journey({assets=false,inspect}={}){
 const h=await installation({assets})
 try{
  const f=await h.command('portfolio.add',{name:'Late-fee portfolio'}),places={}
  for(const code of ['CA','TX']){
   const p=await h.command('property.add',{portfolioId:f.id,name:code+' fee property',address:'1 Synthetic Terrace Road',kind:'duplex',timeZone:'America/Chicago'}),u=await h.command('unit.add',{propertyId:p.id,identifier:'A',bedrooms:'2',bathrooms:'1'}),t=await h.command('tenancy.create',{...tenancyInput,unitId:u.id,rent:'1000.00',cadence:'monthly'}),q=await h.command('rent.charge',{tenancyId:t.id,dueDate:'2026-10-02',amount:'1000.00',description:code+' October rent',reference:'synthetic-terrace-'+code+'-1'})
   await h.command('property.rules',{propertyId:p.id,stateCode:code,version:0,reference:'synthetic-terrace-61'})
   const terms={fullUnpaidDays:0,feeCents:15000,capCents:10000,weekendRule:'next_business_day',excludeTimely:true}
   await h.command('latefee.policy',{tenancyId:t.id,chargeId:q.id,version:0,terms,reference:'synthetic-terrace-62 approved lease fee'})
   places[code]={p,u,t,q,terms}
  }
  let held=await h.command('latefee.preview',{tenancyId:places.TX.t.id,on:'2026-10-06'});assert.equal(held.lines[0].state,'held');await h.command('latefee.post',{tenancyId:places.TX.t.id,on:'2026-10-06',fingerprint:held.fingerprint},{status:409})
  for(const code of ['CA','TX']){
   const pack=syntheticPack(code),rule={fullUnpaidDays:code==='CA'?4:2,basis:'monthly_rent',smallStructureMaxUnits:4,smallStructureCapBp:code==='CA'?500:1200,largeStructureCapBp:code==='CA'?500:1000,weekendRule:'next_business_day',holidays:['2026-10-05'],pendingPolicy:'exclude_timely',reversalPolicy:'hold'}
   pack.fields.lateFee={citation:code==='CA'?'synthetic-terrace-63 California counsel fee limit':'Tex. Prop. Code §92.019',effectiveDate:'2025-01-01',value:rule}
   pack.fields.partialPayments.value={stages:[{minDaysPastDue:0,allowPartial:true,overpayment:'reject'}]}
   const saved=await h.command('rules.pack',pack);await h.command('rules.activate',{packId:saved.id,consent:'REVIEWED'})
  }
  const review=(code,on)=>h.command('latefee.preview',{tenancyId:places[code].t.id,on})
  for(const code of ['CA','TX'])assert.equal((await review(code,'2026-10-03')).lines[0].feeCents,0,'no fee across the weekend before grace/calendar allows it')
  const tx=await review('TX','2026-10-06'),caEarly=await review('CA','2026-10-06'),ca=await review('CA','2026-10-07')
  assert.deepEqual([tx.lines[0].feeCents,caEarly.lines[0].feeCents,ca.lines[0].feeCents],[10000,0,5000])
  assert.deepEqual(tx.lines[0].calculations.map(c=>[c.firstFeeDay,c.basisCents,c.capCents,c.fullUnpaidDays,c.version,c.citation]),[['2026-10-06',100000,12000,2,1,'Tex. Prop. Code §92.019']])
  const post=async(code,r)=>h.command('latefee.post',{tenancyId:places[code].t.id,on:r.on,fingerprint:r.fingerprint})
  if(inspect)await inspect({phase:'calculation',h,places,tx,ca})
  const native=inspect?await inspect({phase:'post',h,places,tx,ca}):null
  if(!native?.posted)await post('TX',tx)
  await post('CA',ca)
  await h.command('latefee.post',{tenancyId:places.TX.t.id,on:tx.on,fingerprint:tx.fingerprint},{status:409})
  await post('TX',await review('TX','2026-10-06'));let data=(await h.state(places.TX.t.id)).ledger
  assert.equal(data.lateFees.fees.length,1);const fee=data.lateFees.fees[0]
  await h.command('latefee.policy',{tenancyId:places.TX.t.id,chargeId:fee.fee_charge_id,version:0,terms:places.TX.terms,reference:'synthetic-terrace-64'},{status:409})
  const member=await h.invite('member','fee-member@example.test');await h.command('latefee.waive',{feeId:fee.id,amount:'100.00',on:'2026-10-07',reason:'synthetic-terrace-65',reference:'synthetic-terrace-65'},{as:member,status:403})
  const waived=inspect?await inspect({phase:'waiver',h,places,fee}):null
  if(!waived?.waived)await h.command('latefee.waive',{feeId:fee.id,amount:'100.00',on:'2026-10-07',reason:'synthetic-terrace-66 hardship waiver',reference:'synthetic-terrace-66'})
  const q=await h.command('rent.charge',{tenancyId:places.TX.t.id,dueDate:'2026-10-02',amount:'1000.00',description:'Timely pending rent',reference:'synthetic-terrace-67'})
  await h.command('latefee.policy',{tenancyId:places.TX.t.id,chargeId:q.id,version:0,terms:places.TX.terms,reference:'synthetic-terrace-68'})
  await h.command('payment.policy',{tenancyId:places.TX.t.id,version:0,terms:{stages:[{minDaysPastDue:0,allowPartial:true,overpayment:'reject'}],priority:[q.id,places.TX.q.id]},reference:'synthetic-terrace-69'})
  const pending=await h.command('payment.record',{tenancyId:places.TX.t.id,amount:'1000.00',state:'pending',payerKind:'resident',method:'ach',receivedDate:'2026-10-02',reference:'synthetic-terrace-70'})
  let p=await review('TX','2026-10-06'),line=p.lines.find(l=>l.sourceChargeId===q.id)
  assert.deepEqual([line.feeCents,line.calculations[0].protectedPendingCents,line.calculations[0].eligibleUnpaidCents],[0,100000,0])
  await post('TX',p);await h.restart();await h.command('payment.settle',{paymentId:pending.id,version:1,on:'2026-10-08',reference:'synthetic-terrace-71'})
  p=await review('TX','2026-10-09');assert.equal(p.lines.find(l=>l.sourceChargeId===q.id).feeCents,0);await post('TX',p)
  data=(await h.state(places.TX.t.id)).ledger;assert.equal(data.lateFees.fees.length,1);assert.deepEqual([data.lateFees.fees[0].amount_cents,data.lateFees.fees[0].balance_cents,data.lateFees.waivers[0].amount_cents],[10000,0,10000]);assert.match(data.lateFees.waivers[0].reason,/hardship/)
  if(inspect)await inspect({phase:'pending-protected',h,places,p})
  const receipt=await h.command('rent.receipt',{chargeId:places.CA.q.id,amount:'1000.00',receivedDate:'2026-10-08',reference:'synthetic-terrace-72'});const paidLate=await review('CA','2026-10-08');assert.equal(paidLate.lines[0].feeCents,5000,'late principal settlement does not erase an earned fee');await post('CA',paidLate);await h.command('rent.reverse-receipt',{receiptId:receipt.id,day:'2026-10-09',reference:'synthetic-terrace-73',reason:'External return'})
  const reversal=await review('CA','2026-10-09');assert.equal(reversal.lines[0].state,'held');assert.match(reversal.lines[0].gaps.join(' '),/reversal/)
  const before=(await h.state(places.TX.t.id)).ledger.lateFees,archive=await(await h.request('/api/backup')).text(),fresh=await installation()
  try{const invalid=await editArchive(archive,(table,row)=>{if(table==='tt_late_fees'){const s=JSON.parse(row.snapshot);s.feeCents+=1;row.snapshot=JSON.stringify(s)}});await fresh.formCommand('data.restore',{confirm:'RESTORE',backup:new File([invalid],'invalid-financial.rer')},{status:400});assert.equal((await fresh.state()).tenancies.length,0,'malformed financial archive installs no product rows');await fresh.formCommand('data.restore',{confirm:'RESTORE',backup:new File([archive],'late-fees.rer')});assert.deepEqual((await fresh.state(places.TX.t.id)).ledger.lateFees,before)}finally{await fresh.close()}
 }finally{await h.close()}
}
