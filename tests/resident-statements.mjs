import assert from 'node:assert/strict'
import {installation,tenancyInput} from './api/harness.mjs'
import {syntheticPack} from './rule-packs.mjs'
export async function journey({assets=false,inspect}={}){
 const h=await installation({assets})
 try{
  const f=await h.command('portfolio.add',{name:'Statement portfolio'}),p=await h.command('property.add',{portfolioId:f.id,name:'Statement house',address:'1 Synthetic Terrace Road',kind:'duplex',timeZone:'America/Chicago'}),u=await h.command('unit.add',{propertyId:p.id,identifier:'A',bedrooms:'2',bathrooms:'1'}),t=await h.command('tenancy.create',{...tenancyInput,unitId:u.id,cadence:'monthly',rent:'1000.00'})
  const q=await h.command('rent.charge',{tenancyId:t.id,dueDate:'2026-10-01',amount:'1000.00',description:'October rent – East',reference:'synthetic-terrace-140 private charge reference'}),r=await h.command('rent.receipt',{chargeId:q.id,amount:'200.00',receivedDate:'2026-10-02',method:'card',reference:'synthetic-terrace-141 private bank reference'})
  await h.command('household.add',{tenancyId:t.id,role:'co_tenant',name:'Synthetic private co-tenant',email:'private-co@example.test',joined:'2025-01-01'})
  await h.command('property.rules',{propertyId:p.id,stateCode:'CA',version:0,reference:'synthetic-terrace-142'})
  const stages=[{minDaysPastDue:0,allowPartial:true,overpayment:'credit'}],pack=syntheticPack('CA');pack.fields.partialPayments.value={stages};const saved=await h.command('rules.pack',pack);await h.command('rules.activate',{packId:saved.id,consent:'REVIEWED'})
  await h.command('payment.policy',{tenancyId:t.id,version:0,terms:{stages,priority:[q.id]},reference:'synthetic-terrace-143'})
  await h.command('payment.record',{tenancyId:t.id,amount:'100.00',state:'pending',payerKind:'resident',method:'ach',receivedDate:'2026-10-03',reference:'synthetic-terrace-144 private pending reference'})
  await h.command('payment.record',{tenancyId:t.id,amount:'750.00',state:'settled',payerKind:'resident',method:'card',receivedDate:'2026-10-04',reference:'synthetic-terrace-145 private settled reference'})
  await h.stepUp();const resident=await h.command('portal.invite',{kind:'resident',tenancyId:t.id,email:'statement-resident@example.test',displayName:'Statement resident',source:'synthetic-terrace-146 resident asked'}),as=await h.portalSignIn('statement-resident@example.test')
  const delegate=await h.command('portal.invite',{kind:'resident',access:'delegate',tenancyId:t.id,email:'statement-delegate@example.test',displayName:'Statement delegate',source:'synthetic-terrace-147 delegated balance view'}),delegated=await h.portalSignIn('statement-delegate@example.test')
  const path='/portal/statement?tenancyId='+t.id+'&month=2026-10',response=await h.request(path+'&format=json',{as});assert.equal(response.status,200);const d=await response.json()
  assert.deepEqual([d.currency,d.openingCents,d.closingCents,d.currentBalanceCents,d.pendingCents,d.unappliedCreditCents],['USD',0,10000,10000,10000,5000]);assert.equal(d.lines.filter(l=>l.kind==='Recorded external payment').reduce((n,l)=>n+l.amountCents,0),90000)
  const portal=await(await h.request('/portal/api/resident?tenancyId='+t.id,{as})).json();assert.equal(d.currentBalanceCents,portal.balanceCents)
  const html=await(await h.request(path,{as})).text(),csv=await(await h.request(path+'&format=csv',{as})).text()
  for(const body of [JSON.stringify(d),html,csv])for(const privateText of ['private-co@example.test','Synthetic private co-tenant','private bank reference','private pending reference','private charge reference'])assert.ok(!body.includes(privateText),'no private provider/household detail: '+privateText)
  assert.match(csv,/Closing receivable","100.00/);assert.match(csv,/Settled unapplied credit \(separate\)","50.00/);assert.ok(csv.includes('October rent – East'))
  const transaction='/portal/transaction?tenancyId='+t.id+'&id='+encodeURIComponent('receipt:'+r.id),source=await(await h.request(transaction+'&format=json',{as})).json();assert.deepEqual([source.transaction.amountCents,source.charge.dueDate,source.charge.currentBalanceCents],[20000,'2026-10-01',10000])
  assert.equal((await h.request(path,{as:''})).status,401);assert.equal((await h.request(path,{as:delegated})).status,404);assert.equal((await h.request(transaction,{as:delegated})).status,404)
  assert.equal((await h.request('/portal/statement?tenancyId='+t.id,{as:delegated})).status,200,'existing balance/charges CSV remains available to a delegate')
  assert.equal((await h.request(path+'&format=pdf',{as})).status,400,'unsupported PDF is never silently substituted')
  const old=await(await h.request('/portal/statement?tenancyId='+t.id+'&month=2026-09&format=json',{as})).json();assert.deepEqual([old.closingCents,old.pendingCents,old.unappliedCreditCents],[0,0,0])
  assert.equal((await h.request('/portal/statement?tenancyId=synthetic-terrace-unshared&month=2026-10',{as})).status,404)
  assert.equal((await h.request('/portal/transaction?tenancyId='+t.id+'&id=receipt:synthetic-terrace-unshared',{as})).status,404)
  const report=await(await h.request('/api/delinquency?tenancyId='+t.id+'&asOf=2026-10-04')).json();assert.deepEqual([report.rows[0].balanceCents,report.rows[0].pendingExternalCents],[10000,10000],'as-of staff report matches resident balance and external pending funds');assert.match(report.rows[0].pendingFunds,/Processor pending payments not recorded/,'recorded manual funds do not imply a processor workflow or settlement')
  if(inspect)await inspect({h,t,as,delegated,transaction})
  await h.command('portal.revoke',{grantId:resident.grantId,reason:'synthetic-terrace-148 access ended'})
  assert.equal((await h.request(path,{as})).status,401);assert.equal((await h.request(transaction,{as})).status,401)
 }finally{await h.close()}
}
