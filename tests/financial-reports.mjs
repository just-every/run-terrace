import assert from 'node:assert/strict'
import {installation,tenancyInput} from './api/harness.mjs'
export async function journey({assets=false,inspect}={}){
 const h=await installation({assets})
 try{
  const make=async name=>{
   const portfolio=await h.command('portfolio.add',{name}),property=await h.command('property.add',{portfolioId:portfolio.id,name,address:'1 '+name+' Lane',kind:'duplex',timeZone:Intl.supportedValuesOf('timeZone').find(z=>z.endsWith('Los_Angeles'))}),unit=await h.command('unit.add',{propertyId:property.id,identifier:'A',bedrooms:2,bathrooms:1}),owner=await h.command('owner.add',{kind:'individual',legalName:name+' Owner',email:name.toLowerCase()+'@example.test',mailingAddress:'1 '+name+' Lane'})
   await h.command('ownership.set',{propertyId:property.id,effectiveFrom:'2025-01-01',reason:'synthetic-terrace-1',shares:[{ownerId:owner.id,percent:'100'}]})
   await h.command('agreement.set',{propertyId:property.id,starts:'2025-01-01',feePercent:'0',reserve:'0',reference:'synthetic-terrace-2'})
   const tenancy=await h.command('tenancy.create',{...tenancyInput,unitId:unit.id,tenantEmail:name.toLowerCase()+'-resident@example.test'})
   return{portfolio,property,unit,owner,tenancy}
  }
  const a=await make('Alder'),b=await make('Birch')
  const vendor=await h.command('vendor.add',{name:'Clear Plumbing',email:'plumbing@example.test',phone:'510-555-0101',specialties:'plumbing',serviceAreas:'Oakland',w9:'received',insuranceExpires:'2036-12-31',rate:'100.00',standing:'approved'})
  const charge=await h.command('rent.charge',{tenancyId:a.tenancy.id,dueDate:'2026-09-01',amount:'1000.00',description:'Earned September rent',reference:'synthetic-terrace-3 earned rent'})
  await h.command('rent.charge',{tenancyId:b.tenancy.id,dueDate:'2026-09-01',amount:'777.00',description:'Other property rent',reference:'synthetic-terrace-4 private'})
  const bill=await h.command('bill.create',{vendorId:vendor.id,invoiceNumber:'synthetic-terrace-5',date:'2026-09-02',lines:[{description:'Repair',code:'repairs',amount:'300.00',tax:'0'}],allocations:[{propertyId:a.property.id,amount:'300.00'}],original:{name:'invoice.pdf',type:'application/pdf',base64:Buffer.from('%PDF-1.4\nsynthetic-terrace-5 original\n%%EOF').toString('base64')}})
  await h.command('bill.approve',{billId:bill.id,version:1})
  const q={from:'2026-09-01',to:'2026-09-30',propertyId:a.property.id}
  const get=async(extra={},opts={})=>{const r=await h.request('/api/financial-reports?'+new URLSearchParams({...q,...extra}),opts);assert.equal(r.status,200,await r.clone().text());assert.equal(r.headers.get('cache-control'),'no-store');return r.json()}
  await h.command('chart.add',{code:'receipt_timing',name:'User-defined expense',kind:'expense',fund:'operating'})
  const before=(await(await h.request('/api/journal')).json()).entries
  const accrual=await get(),cash=await get({basis:'cash'})
  assert.deepEqual([accrual.incomeStatement.incomeCents,accrual.incomeStatement.expenseCents,accrual.incomeStatement.netCents],[100000,30000,70000])
  assert.deepEqual([cash.incomeStatement.incomeCents,cash.incomeStatement.expenseCents,cash.incomeStatement.netCents],[0,0,0])
  assert.deepEqual([accrual.balanceSheet.assetsCents,accrual.balanceSheet.liabilitiesCents,accrual.balanceSheet.retainedEarningsCents],[100000,30000,70000])
  assert.deepEqual([cash.balanceSheet.assetsCents,cash.balanceSheet.liabilitiesCents,cash.balanceSheet.retainedEarningsCents],[0,0,0])
  for(const d of [cash,accrual]){
   assert.equal(d.balanceSheet.assetsCents,d.balanceSheet.liabilitiesCents+d.balanceSheet.equityCents+d.balanceSheet.retainedEarningsCents)
   assert.equal(d.trialBalance.reduce((n,l)=>n+l.debitCents-l.creditCents,0),0)
   assert.equal(d.receivables.reduce((n,l)=>n+l.amountCents,0),100000);assert.equal(d.payables.reduce((n,l)=>n+l.amountCents,0),30000)
   assert.equal(d.receivables[0].bucket,'0–30');assert.ok(d.incomeStatement.income.flatMap(r=>r.sources).some(s=>s.sourceId===charge.id))
   const expense=d.incomeStatement.expenses.flatMap(r=>r.sources).find(s=>s.sourceKind==='bill');assert.ok(expense)
   assert.ok(d.generalLedger.some(j=>j.source_id===expense.sourceId&&j.reference===bill.id),'expense drills to the original bill allocation')
   assert.ok(d.generalLedger.every(j=>j.property_id===a.property.id))
   for(const row of [...d.incomeStatement.income,...d.incomeStatement.expenses,...d.balanceSheet.assets,...d.balanceSheet.liabilities,...d.balanceSheet.equity,d.balanceSheet.retainedEarnings,...d.trialBalance,...d.receivables,...d.payables]){
    assert.ok(row.sources.length||row.amountCents===0||row.debitCents===0&&row.creditCents===0,'each nonzero amount has posting sources')
    for(const source of row.sources){const original=d.generalLedger.find(j=>j.id===source.entryId);assert.ok(original,'source entry is readable');assert.equal(original.source_id,source.sourceId);assert.ok(original.lines.some(l=>l.debit===source.debit&&l.credit===source.credit),'source keeps the original posted amounts')}
   }
  }
  assert.deepEqual((await(await h.request('/api/journal')).json()).entries,before,'basis reads leave every journal posting unchanged')
  const receipt=await h.command('rent.receipt',{chargeId:charge.id,receivedDate:'2026-10-01',amount:'400.00',reference:'synthetic-terrace-6 bank receipt'})
  // External payable settlement through the existing reviewed journal door; no payment is initiated.
  await h.command('journal.post',{propertyId:a.property.id,ownerId:a.owner.id,vendorId:vendor.id,day:'2026-10-02',fund:'operating',kind:'journal',reference:'synthetic-terrace-7 external bill settlement',lines:[{account:'payable',debit:10000,credit:0},{account:'cash',debit:0,credit:10000}]})
  const october=await get({from:'2026-10-01',to:'2026-10-03',basis:'cash'})
  assert.deepEqual([october.incomeStatement.incomeCents,october.incomeStatement.expenseCents,october.incomeStatement.netCents],[40000,10000,30000])
  assert.equal(october.cashFlow.closingCents,30000);assert.equal(october.cashFlow.netCents,30000)
  assert.deepEqual(october.trialBalance.filter(r=>['receivable','payable','cash'].includes(r.code)).map(r=>[r.code,r.debitCents,r.creditCents]).sort(),[['cash',30000,0],['payable',0,20000],['receivable',60000,0]],'trial balance carries earlier postings and nets each ending account balance')
  assert.equal(october.trialBalance.reduce((n,r)=>n+r.debitCents-r.creditCents,0),0)
  assert.equal(october.trialBalance.find(r=>r.code==='receivable').sources.length,2,'ending balance drills to both earning and settlement postings')
  assert.equal(october.receivables.reduce((n,l)=>n+l.amountCents,0),60000);assert.equal(october.payables.reduce((n,l)=>n+l.amountCents,0),20000)
  assert.ok(october.receivables.every(l=>l.bucket==='31–60'));assert.ok(october.cashFlow.movements.some(l=>l.sourceId===receipt.id))
  assert.equal((await get({ownerId:a.owner.id})).incomeStatement.netCents,70000)
  assert.equal((await get({ownerId:b.owner.id})).incomeStatement.netCents,0)
  await h.stepUp();await h.command('company.save',{name:'Synthetic Terrace',timeZone:Intl.supportedValuesOf('timeZone').find(z=>z.endsWith('Los_Angeles')),officeEmail:'office@example.test',officePhone:'1',officeAddress:'1 Main'})
  const entity=await h.command('entity.add',{legalName:'Alder Entity',ein:'123456789'}),bank=await h.command('trust.account.add',{entityId:entity.id,name:'Rent trust',bankName:'Recorded bank',last4:'1234',purpose:'rent_trust'})
  await h.command('trust.map',{propertyId:a.property.id,bankId:bank.id,fund:'operating',primary:true,reference:'synthetic-terrace-8'})
  assert.equal((await get({propertyId:'',entityId:entity.id})).incomeStatement.netCents,70000)
  assert.equal((await get({propertyId:'',entityId:'unassigned'})).incomeStatement.netCents,77700)
  const member=await h.invite('member','reports-member@example.test')
  assert.equal((await h.request('/api/financial-reports?'+new URLSearchParams(q),{as:member})).status,403)
  assert.equal((await h.request('/app?tab=financial-reports&'+new URLSearchParams(q),{as:member})).status,403)
  assert.equal((await h.request('/api/financial-reports?'+new URLSearchParams(q),{as:''})).status,401)
  await h.command('operator.invite',{displayName:'Scoped accountant',email:'reports-accountant@example.test',role:'accountant',portfolioIds:[a.portfolio.id]})
  const scoped=await h.accept('reports-accountant@example.test'),scopedData=await get({propertyId:''},{as:scoped})
  assert.ok(!JSON.stringify(scopedData).includes(b.property.id));assert.ok(!JSON.stringify(scopedData).includes(b.owner.id))
  for(const extra of [{propertyId:b.property.id},{ownerId:b.owner.id},{entityId:'synthetic-terrace-unknown'}])assert.equal((await h.request('/api/financial-reports?'+new URLSearchParams({...q,...extra}),{as:scoped})).status,404)
  for(const extra of [{from:'2026-10-01'},{basis:'unknown'},{to:'2099-01-01'},{from:'2026-02-30'}])assert.equal((await h.request('/api/financial-reports?'+new URLSearchParams({...q,...extra}))).status,400)
  // Tax collections and their corrections stay liabilities on cash statements, with no artificial income.
  const rule=await h.command('tax.prepare',{propertyId:b.property.id,kind:'parking',ratePercent:'10',label:'Synthetic parking tax',starts:'2026-01-01'})
  await h.command('tax.review',{ruleId:rule.id})
  await h.command('ancillary.charge',{tenancyId:b.tenancy.id,kind:'parking',description:'Recorded parking',amount:'100.00',dueDate:'2026-09-01',reference:'synthetic-terrace-11 parking'})
  const tax=(await h.state(b.tenancy.id)).ledger.charges.find(c=>c.reference==='synthetic-terrace-11 parking-TAX'),taxReceipt=await h.command('rent.receipt',{chargeId:tax.id,amount:'10.00',receivedDate:'2026-09-02',method:'card',reference:'synthetic-terrace-12 tax receipt'})
  const refund=await h.command('finance.prepare',{kind:'refund',receiptId:taxReceipt.id,amount:'2.00',payee:'Synthetic resident',method:'original',on:'2026-09-03',reason:'synthetic-terrace-13 corrected tax receipt',reference:'synthetic-terrace-13'})
  await h.command('finance.approve',{actionId:refund.id,version:refund.version,fingerprint:refund.fingerprint})
  await h.command('finance.record',{actionId:refund.id,version:refund.version,fingerprint:refund.fingerprint,externalReference:'synthetic-terrace-14 external refund',confirm:'RECORDED'})
  await h.command('rent.adjust',{chargeId:tax.id,amount:'1.00',reason:'synthetic-terrace-15 tax correction'})
  const opening=await h.command('journal.post',{propertyId:b.property.id,ownerId:b.owner.id,day:'2026-09-01',fund:'operating',kind:'opening',reference:'synthetic-terrace-16 opening receivable',lines:[{account:'receivable',debit:100,credit:0},{account:'opening_equity',debit:0,credit:100}]})
  await h.command('journal.reverse',{entryId:opening.id,day:'2026-09-03',reference:'synthetic-terrace-17 opening correction'})
  const nowDay=new Intl.DateTimeFormat('en-CA',{timeZone:Intl.supportedValuesOf('timeZone').find(z=>z.endsWith('Los_Angeles'))}).format(new Date()),taxReport=await get({propertyId:b.property.id,to:nowDay,basis:'cash'})
  assert.equal(taxReport.incomeStatement.netCents,0,'tax refunds, reductions and reversed openings create no cash income')
  assert.equal(taxReport.balanceSheet.liabilities.find(l=>l.code==='tax_payable').amountCents,800)
  assert.equal(taxReport.balanceSheet.assetsCents,800)
  if(inspect)await inspect({h,a,b,q,charge,bill})
  await h.command('journal.post',{propertyId:a.property.id,ownerId:a.owner.id,day:'2026-10-03',fund:'operating',kind:'contribution',reference:'synthetic-terrace-10 replenishment',lines:[{account:'cash',debit:10000,credit:0},{account:'contribution',debit:0,credit:10000}]})
  await h.command('rent.reverse-receipt',{receiptId:receipt.id,day:'2026-10-03',reference:'synthetic-terrace-9 reversal',reason:'Duplicate external fact'})
  assert.equal((await get({from:'2026-10-01',to:'2026-10-03',basis:'cash'})).incomeStatement.incomeCents,0)
  const expected=await get({basis:'cash'});await h.restart();assert.deepEqual(await get({basis:'cash'}),expected)
  const archive=await(await h.request('/api/backup')).text(),fresh=await installation()
  try{await fresh.formCommand('data.restore',{confirm:'RESTORE',backup:new File([archive],'financial.rer')});const restored=await(await fresh.request('/api/financial-reports?'+new URLSearchParams({...q,basis:'cash'}))).json();assert.deepEqual(restored,expected)}finally{await fresh.close()}
 }finally{await h.close()}
}
