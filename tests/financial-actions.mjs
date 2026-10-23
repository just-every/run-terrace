import {editArchive} from './archive-edit.mjs'
import assert from 'node:assert/strict'
import {installation,tenancyInput} from './api/harness.mjs'
export async function journey({assets=false,inspect}={}){
 const h=await installation({assets})
 try{
  const manager=await h.invite('admin','finance-manager@example.test'),member=await h.invite('member','finance-member@example.test'),f=await h.command('portfolio.add',{name:'Financial portfolio'}),p=await h.command('property.add',{portfolioId:f.id,name:'Refund property',address:'1 Synthetic Terrace Road',kind:'duplex',timeZone:'America/Chicago'}),u=await h.command('unit.add',{propertyId:p.id,identifier:'A',bedrooms:'2',bathrooms:'1'}),t=await h.command('tenancy.create',{...tenancyInput,unitId:u.id,rent:'1000.00',cadence:'monthly'}),owners=[]
  for(const n of ['A','B','C'])owners.push(await h.command('owner.add',{kind:'individual',legalName:'Synthetic owner '+n,email:'owner-'+n+'@example.test',mailingAddress:'1 Synthetic Terrace Road'}))
  await h.command('ownership.set',{propertyId:p.id,effectiveFrom:'2025-01-01',shares:[{ownerId:owners[0].id,percent:'60'},{ownerId:owners[1].id,percent:'40'}],reason:'synthetic-terrace-90'})
  const charges=[],receipts=[]
  for(const[i,amount]of ['1000.00','200.00'].entries()){
   charges.push(await h.command('rent.charge',{tenancyId:t.id,dueDate:'2026-10-01',amount,description:'October rent '+i,reference:'synthetic-terrace-91-'+i}))
   receipts.push(await h.command('rent.receipt',{chargeId:charges[i].id,amount,receivedDate:'2026-10-02',method:'card',reference:'synthetic-terrace-92-'+i}))
  }
  await h.command('ownership.set',{propertyId:p.id,effectiveFrom:'2026-10-03',shares:[{ownerId:owners[2].id,percent:'100'}],reason:'synthetic-terrace-93 new ownership'})
  const fields={kind:'refund',receiptId:receipts[0].id,amount:'50.00',payee:'Alex Chen',method:'original',on:'2026-10-10',reason:'synthetic-terrace-94 duplicate receipt',reference:'synthetic-terrace-94'}
  const prepared=await h.command('finance.prepare',fields),approve=a=>h.command('finance.approve',{actionId:a.id,version:a.version,fingerprint:a.fingerprint},{as:manager}),record=(a,externalReference)=>h.command('finance.record',{actionId:a.id,version:a.version,fingerprint:a.fingerprint,externalReference,confirm:'RECORDED'})
  await h.command('finance.approve',{actionId:prepared.id,version:prepared.version,fingerprint:prepared.fingerprint},{status:403});await approve(prepared)
  await h.command('finance.prepare',{...fields,amount:'1001.00'},{status:409})
  const revised=await h.command('finance.revise',{...fields,receiptId:receipts[1].id,actionId:prepared.id,version:1})
  await h.stepUp()
  await h.command('finance.record',{actionId:prepared.id,version:1,fingerprint:prepared.fingerprint,externalReference:'synthetic-terrace-95',confirm:'RECORDED'},{status:409})
  await h.command('finance.record',{actionId:revised.id,version:2,fingerprint:revised.fingerprint,externalReference:'synthetic-terrace-95',confirm:'RECORDED'},{status:409})
  const approval=inspect?await inspect({phase:'approval',h,t,revised,manager}):null
  if(!approval?.approved)await approve(revised)
  const native=inspect?await inspect({phase:'refund',h,t,revised,manager}):null
  const first=native?.recorded??await record(revised,'synthetic-terrace-96 provider confirmation')
  const repeated=await record(revised,native?'synthetic-terrace-110 native provider confirmation':'synthetic-terrace-96 provider confirmation');assert.equal(repeated.replayed,true)
  let ledger=(await h.state(t.id)).ledger;assert.equal(ledger.balanceCents,5000);assert.equal(ledger.receipts.filter(r=>r.reversal_of===receipts[1].id).length,1);assert.equal(ledger.financialActions.actions.filter(a=>a.state==='recorded').length,1)
  const journal=await(await h.request('/api/journal?tenancyId='+t.id)).json(),refunds=journal.entries.filter(j=>j.source_kind==='refund')
  assert.deepEqual(refunds.map(j=>[j.owner_key,j.lines.find(l=>l.account==='cash').credit]).sort(),[[owners[0].id,3000],[owners[1].id,2000]].sort(),'partial refund follows original 60/40 receipt owners, never the new owner')
  assert.equal(ledger.receipts.find(r=>r.id===receipts[1].id).amount_cents,20000,'original receipt retained')
  await h.command('rent.reverse-receipt',{receiptId:receipts[1].id,day:'2026-10-10',reference:'synthetic-terrace-97',reason:'Would refund twice'},{status:409})
  for(const[kind,amount]of [['write_off','20.00'],['credit','10.00']]){
   const a=await h.command('finance.prepare',{kind,chargeId:charges[1].id,amount,on:'2026-10-11',reason:'synthetic-terrace-98 '+kind,reference:'synthetic-terrace-98 '+kind});assert.equal(a.source.residentBeforeCents-a.source.residentAfterCents,Number(amount)*100);await approve(a);await record(a,'synthetic-terrace-99 '+kind)
  }
  ledger=(await h.state(t.id)).ledger;assert.equal(ledger.balanceCents,2000)
  assert.equal(ledger.financialActions.actions.filter(a=>a.state==='recorded').length,3)
  const restricted=await(await h.request('/api/state?tenancy='+t.id,{as:member})).json();assert.equal(restricted.ledger.financialActions.restricted,true);assert.deepEqual(restricted.ledger.financialActions.actions,[])
  await h.command('finance.prepare',fields,{as:member,status:403})
  await h.command('tenancy.end',{tenancyId:t.id,moveOut:'2026-10-09',reason:'synthetic-terrace-100 move-out'})
  const checkFields={...fields,receiptId:receipts[0].id,amount:'100.00',method:'check',forwardingAddress:'89 Synthetic Forwarding Road, Chicago IL 60601',checkNumber:'1001',reference:'synthetic-terrace-101 forwarding refund'},check=await h.command('finance.prepare',checkFields)
  await approve(check)
  const registered=inspect?await inspect({phase:'check',h,t,check,manager}):null
  if(!registered?.registered)await h.command('finance.check',{actionId:check.id,version:check.version,fingerprint:check.fingerprint})
  ledger=(await h.state(t.id)).ledger;assert.equal(ledger.financialActions.checks[0].state,'draft');assert.match(ledger.financialActions.checks[0].snapshot,/89 Synthetic Forwarding Road/)
  await record(check,'synthetic-terrace-102 externally issued check');await record(check,'synthetic-terrace-102 externally issued check')
  ledger=(await h.state(t.id)).ledger;assert.equal(ledger.financialActions.checks[0].state,'recorded_external');assert.equal(ledger.balanceCents,12000)
  const final=ledger.financialActions;await h.restart();assert.deepEqual((await h.state(t.id)).ledger.financialActions,final)
  if(inspect)await inspect({phase:'recorded',h,t,check,manager})
  const archive=await(await h.request('/api/backup')).text(),fresh=await installation()
  try{const invalid=await editArchive(archive,(table,row)=>{if(table==='tt_financial_recordings'){row.amount_cents+=1}});await fresh.formCommand('data.restore',{confirm:'RESTORE',backup:new File([invalid],'invalid-financial.rer')},{status:400});assert.equal((await fresh.state()).tenancies.length,0,'malformed financial archive installs no product rows');await fresh.formCommand('data.restore',{confirm:'RESTORE',backup:new File([archive],'refunds.rer')});const restored=(await fresh.state(t.id)).ledger;assert.equal(restored.balanceCents,12000);assert.deepEqual(restored.financialActions,final)}finally{await fresh.close()}
 }finally{await h.close()}
}
