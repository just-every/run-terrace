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
  const cancellation=await h.command('finance.prepare',{...fields,receiptId:receipts[0].id,amount:'1.00',reference:'synthetic-terrace-103 cancelled refund'});await approve(cancellation)
  const cancelledNative=inspect?await inspect({phase:'cancel',h,t,cancellation,manager}):null
  if(!cancelledNative?.cancelled)await h.command('finance.cancel',{actionId:cancellation.id,version:cancellation.version,fingerprint:cancellation.fingerprint,reason:'synthetic-terrace-104 resident withdrew request'})
  await h.command('finance.record',{actionId:cancellation.id,version:cancellation.version,fingerprint:cancellation.fingerprint,externalReference:'synthetic-terrace-105',confirm:'RECORDED'},{status:409})
  assert.equal((await h.state(t.id)).ledger.financialActions.actions.find(a=>a.id===cancellation.id).state,'cancelled')
  const agingResponse=await h.request('/api/delinquency?tenancyId='+t.id+'&asOf=2026-10-11');assert.equal(agingResponse.status,200);const aging=await agingResponse.json();assert.equal(aging.rows[0].balanceCents,12000,'dated refund and corrections reconcile to the ledger')
  const period=await(await h.request('/api/period-close?month=2026-10')).json();assert.deepEqual(period.live.lines.filter(x=>x.kind==='adjustment').map(x=>[x.day,x.amountCents]).sort(),[['2026-10-11',1000],['2026-10-11',2000]],'month close uses approved posting dates')
  const statement=await(await h.request('/api/statement?tenancyId='+t.id+'&from=2026-10-11&to=2026-10-11')).text();assert.ok(statement.includes('"Opening receivable USD","150.00"')&&statement.includes('"Closing receivable USD","120.00"'),'period statement reconciles refund opening and dated corrections')
  ledger=(await h.state(t.id)).ledger;const final=ledger.financialActions;await h.restart();assert.deepEqual((await h.state(t.id)).ledger.financialActions,final)
  if(inspect)await inspect({phase:'recorded',h,t,check,manager})
  const archive=await(await h.request('/api/backup')).text(),fresh=await installation()
  try{const invalid=await editArchive(archive,(table,row)=>{if(table==='tt_financial_recordings'){row.amount_cents+=1}});await fresh.formCommand('data.restore',{confirm:'RESTORE',backup:new File([invalid],'invalid-financial.rer')},{status:400});assert.equal((await fresh.state()).tenancies.length,0,'malformed financial archive installs no product rows');await fresh.formCommand('data.restore',{confirm:'RESTORE',backup:new File([archive],'refunds.rer')});const restored=(await fresh.state(t.id)).ledger;assert.equal(restored.balanceCents,12000);assert.deepEqual(restored.financialActions,final)}finally{await fresh.close()}
 }finally{await h.close()}
 await roundingJourney()
}


async function roundingJourney(){
 const h=await installation()
 try{
  const manager=await h.invite('admin','rounding-manager@example.test'),f=await h.command('portfolio.add',{name:'Rounding portfolio'}),p=await h.command('property.add',{portfolioId:f.id,name:'Rounding house',address:'1 Synthetic Terrace Road',kind:'duplex',timeZone:'America/Chicago'}),u=await h.command('unit.add',{propertyId:p.id,identifier:'A',bedrooms:'2',bathrooms:'1'}),t=await h.command('tenancy.create',{...tenancyInput,unitId:u.id,cadence:'monthly'}),owners=[]
  for(const n of ['A','B','C'])owners.push(await h.command('owner.add',{kind:'individual',legalName:'Rounding '+n,email:'rounding-'+n+'@example.test',mailingAddress:'1 Synthetic Terrace Road'}))
  await h.command('ownership.set',{propertyId:p.id,effectiveFrom:'2025-01-01',shares:[{ownerId:owners[0].id,percent:'34'},{ownerId:owners[1].id,percent:'33'},{ownerId:owners[2].id,percent:'33'}],reason:'synthetic-terrace-120'})
  const q=await h.command('rent.charge',{tenancyId:t.id,dueDate:'2026-10-01',amount:'0.06',description:'Small-cent allocation',reference:'synthetic-terrace-121'}),r=await h.command('rent.receipt',{chargeId:q.id,amount:'0.06',receivedDate:'2026-10-02',method:'card',reference:'synthetic-terrace-122'})
  await h.stepUp()
  const spent=await h.command('journal.post',{propertyId:p.id,ownerId:owners[0].id,day:'2026-10-03',fund:'operating',kind:'journal',reference:'synthetic-terrace-126 original owner cash already spent',lines:[{account:'expense',debit:4,credit:0},{account:'cash',debit:0,credit:4}]})
  const held=await h.command('finance.prepare',{kind:'refund',receiptId:r.id,amount:'0.01',on:'2026-10-10',method:'original',payee:'Synthetic resident',reason:'synthetic-terrace-127',reference:'synthetic-terrace-127'},{status:409});assert.equal(held.error,'insufficient_owner_funds','other owners cannot fund the original owner refund')
  await h.command('journal.reverse',{entryId:spent.id,day:'2026-10-04',reference:'synthetic-terrace-128 source correction'})
  const amounts=['0.01','0.01','0.01','0.02','0.01']
  for(let i=0;i<amounts.length;i++){
   const a=await h.command('finance.prepare',{kind:'refund',receiptId:r.id,amount:amounts[i],on:'2026-10-10',method:'original',payee:'Synthetic resident',reason:'synthetic-terrace-123 small refund',reference:'synthetic-terrace-124-'+i})
   await h.command('finance.approve',{actionId:a.id,version:a.version,fingerprint:a.fingerprint},{as:manager})
   await h.command('finance.record',{actionId:a.id,version:a.version,fingerprint:a.fingerprint,confirm:'RECORDED',externalReference:'synthetic-terrace-125-'+i})
  }
  const journal=await(await h.request('/api/journal?tenancyId='+t.id)).json(),entries=journal.entries.filter(j=>j.source_kind==='refund'),totals=new Map()
  for(const j of entries)totals.set(j.owner_key,(totals.get(j.owner_key)??0)+j.lines.find(l=>l.account==='cash').credit)
  assert.deepEqual([...totals].sort(),[[owners[0].id,4],[owners[1].id,1],[owners[2].id,1]].sort(),'repeated small refunds exhaust each original owner allocation exactly, never overdraw it')
  assert.equal((await h.state(t.id)).ledger.balanceCents,6)
  const large=await h.command('rent.charge',{tenancyId:t.id,dueDate:'2026-10-01',amount:'999999.99',description:'Large exact-cent receipt',reference:'synthetic-terrace-129'}),largeReceipt=await h.command('rent.receipt',{chargeId:large.id,amount:'999999.99',receivedDate:'2026-10-02',method:'card',reference:'synthetic-terrace-130'})
  for(const[i,amount]of ['999999.98','0.01'].entries()){
   const a=await h.command('finance.prepare',{kind:'refund',receiptId:largeReceipt.id,amount,on:'2026-10-10',method:'original',payee:'Synthetic resident',reason:'synthetic-terrace-131 exact cents',reference:'synthetic-terrace-132-'+i})
   await h.command('finance.approve',{actionId:a.id,version:a.version,fingerprint:a.fingerprint},{as:manager});await h.command('finance.record',{actionId:a.id,version:a.version,fingerprint:a.fingerprint,confirm:'RECORDED',externalReference:'synthetic-terrace-133-'+i})
  }
  const final=await(await h.request('/api/journal?tenancyId='+t.id)).json(),cash=Object.fromEntries(owners.map(o=>[o.id,final.entries.filter(j=>j.owner_key===o.id).flatMap(j=>j.lines).filter(l=>l.account==='cash').reduce((n,l)=>n+l.debit-l.credit,0)]));assert.ok(Object.values(cash).every(n=>n===0),'full large and small refunds leave every original owner at exactly zero cash')
  assert.equal((await h.state(t.id)).ledger.balanceCents,100000005)

 }finally{await h.close()}
}
