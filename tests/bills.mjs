import {journey as budgetJourney} from './work-budgets.mjs'
import assert from 'node:assert/strict'
import {installation,tenancyInput} from './api/harness.mjs'
const pdf=n=>({name:'invoice-'+n+'.pdf',type:'application/pdf',base64:Buffer.from('%PDF-1.4\n'+n+'\n%%EOF').toString('base64')})
/** ACCT-007 public-door journey; called from the existing tenth test (no new suite entry). */
export async function journey() {
 await budgetJourney()
 const h=await installation()
 try {
  const portfolio=await h.command('portfolio.add',{name:'Bills residential portfolio'}),otherPortfolio=await h.command('portfolio.add',{name:'Outside bills portfolio'}),sharedPortfolio=await h.command('portfolio.add',{name:'Shared bills portfolio'})
  const prop=async(name,portfolioId=portfolio.id,address=name+', Oakland, CA')=>h.command('property.add',{portfolioId,name,address,kind:'duplex',timeZone:'America/Los_Angeles'})
  const a=await prop('Landscaping west'),b=await prop('Landscaping west',sharedPortfolio.id,'East garden, Oakland, CA'),outside=await prop('Unassigned property',otherPortfolio.id)
  const owner=async name=>h.command('owner.add',{kind:'individual',legalName:name,email:name.toLowerCase()+'@example.test',mailingAddress:'Owner mailing address'})
  const seller=await owner('Seller'),buyer=await owner('Buyer')
  for(const p of [a,b,outside]) {
   await h.command('ownership.set',{propertyId:p.id,effectiveFrom:'2024-01-01',reason:'Original ownership',shares:p.id===a.id?[{ownerId:seller.id,percent:'60'},{ownerId:buyer.id,percent:'40'}]:[{ownerId:seller.id,percent:'100'}]})
   await h.command('agreement.set',{propertyId:p.id,starts:'2024-01-01',feePercent:'0',reserve:'100',markupPercent:'10',feeTaxPercent:'10',reference:'Agreement '+p.id})
  }
  await h.command('ownership.set',{propertyId:a.id,effectiveFrom:'2024-06-15',reason:'Sale completed June 15',shares:[{ownerId:buyer.id,percent:'100'}]})
  const unit=await h.command('unit.add',{propertyId:a.id,identifier:'A',bedrooms:2,bathrooms:1,amenities:'garden',rentable:true})
  const tenancy=await h.command('tenancy.create',{...tenancyInput,unitId:unit.id,startDate:'2024-01-01',endDate:'2026-12-31'})
  const vendorFields={name:'Landscape Partners',email:'landscape@example.test',phone:'510-555-0100',specialties:'landscaping',serviceAreas:'Oakland',w9:'received',insuranceExpires:'2036-12-31',licenseNumber:'LAND-1',licenseExpires:'2036-12-31',availability:'Monthly',rate:'100',standing:'approved'}
  const vendor=await h.command('vendor.add',vendorFields),association=await h.command('vendor.add',{...vendorFields,name:'Oakland Residential Association',email:'association@example.test'})
  const base={vendorId:vendor.id,invoiceNumber:'LAND-2024-06',date:'2024-06-10',lines:[{description:'Shared landscaping',code:'landscaping',amount:'90',tax:'10'}],allocations:[{propertyId:a.id,amount:'60'},{propertyId:b.id,amount:'40'}],original:pdf('shared-landscaping')}
  const bill=await h.command('bill.create',base)
  assert.equal((await h.command('bill.create',base,{status:409})).error,'duplicate_invoice')
  assert.equal((await h.command('bill.create',{...base,invoiceNumber:'NEW-NUMBER'},{status:409})).error,'duplicate_bytes')
  await h.command('bill.create',{...base,invoiceNumber:'INVALID-SPLIT',original:pdf('invalid'),allocations:[{propertyId:a.id,amount:'99'}]},{status:400})
  // A sole operator may self-approve, with an explicit durable label. Exact invoice bytes are retrievable privately.
  const read=async(as)=>{const r=await h.request('/api/bills',as?{as}:{});assert.equal(r.status,200,await r.clone().text());return r.json()}
  let data=await read();let captured=data.bills.find(x=>x.id===bill.id)
  const attachment=captured.attachments[0],download=await h.request('/api/bill-attachment?id='+attachment.id)
  assert.equal(await download.text(),Buffer.from(base.original.base64,'base64').toString());assert.equal(download.headers.get('cache-control'),'no-store')
  assert.equal((await h.request('/api/bill-attachment?id='+attachment.id,{as:''})).status,401)
  for(const original of [
   {name:'invoice.png',type:'image/png',base64:'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jz1sAAAAASUVORK5CYII='},
   {name:'invoice.eml',type:'message/rfc822',base64:Buffer.from('From: landscape@example.test\nTo: manager@example.test\nSubject: Original email invoice\n\nInvoice details').toString('base64')}
  ]) {
   const media=await h.command('bill.create',{...base,invoiceNumber:'MEDIA-'+original.name,original})
   const saved=(await read()).bills.find(x=>x.id===media.id).attachments[0]
   const response=await h.request('/api/bill-attachment?id='+saved.id)
   assert.deepEqual(Buffer.from(await response.arrayBuffer()),Buffer.from(original.base64,'base64'),'image and original email bytes survive capture exactly')
  }
  await h.command('bill.approve',{billId:bill.id,version:1})
  captured=(await read()).bills.find(x=>x.id===bill.id)
  assert.equal(captured.state,'payable');assert.ok(captured.approvals[0].label)
  assert.equal(captured.expenses.reduce((s,x)=>s+x.amount_cents,0),10000)
  const statement=async(ownerId)=>{const r=await h.request(`/api/owner-statement?ownerId=${ownerId}&from=2024-06-01&to=2024-06-30&format=json`);assert.equal(r.status,200);return r.json()}
  let s=await statement(seller.id)
  assert.equal(s.cash.expensesCents,7600);assert.equal(s.fees.filter(x=>x.kind==='markup').reduce((n,x)=>n+x.amountCents,0),760)
  assert.equal(s.cash.availableCents,-7600-760-76-20000)
  await h.command('fees.run',{propertyId:a.id,month:'2024-06'})
  assert.equal((await statement(seller.id)).fees.filter(x=>x.kind==='markup').reduce((n,x)=>n+x.amountCents,0),760,'ordinary fee reruns preserve bill markup')
  // A post-transfer expense belongs wholly to the buyer on the transferred property.
  const after=await h.command('bill.create',{...base,invoiceNumber:'LAND-AFTER',date:'2024-06-20',allocations:[{propertyId:a.id,amount:'100'}],original:pdf('after-transfer')})
  await h.command('bill.approve',{billId:after.id,version:1});assert.equal((await statement(buyer.id)).cash.expensesCents,12400)
  const manager=await h.invite('admin','bills-manager@example.test'),member=await h.invite('member','bills-member@example.test')
  const staff=await(await h.request('/auth/operators')).json()
  const managerId=staff.find(x=>x.email==='bills-manager@example.test').id,memberId=staff.find(x=>x.email==='bills-member@example.test').id
  await h.stepUp()
  await h.command('operator.role',{operatorId:managerId,role:'portfolio_manager',['portfolio:'+portfolio.id]:'1',['portfolio:'+sharedPortfolio.id]:'1'})
  // Preparers cannot approve once an independent approver exists. Changed amount, payee and attachments reopen.
  const changed=await h.command('bill.revise',{...base,billId:bill.id,version:1,invoiceNumber:'LAND-REVISED',lines:[{description:'Revised landscaping',code:'landscaping',amount:'110',tax:'10'}],allocations:[{propertyId:a.id,amount:'120'}]})
  assert.equal(changed.state,'pending');assert.equal((await h.command('bill.approve',{billId:bill.id,version:2},{status:403})).error,'preparer_cannot_approve')
  assert.equal((await statement(seller.id)).cash.expensesCents,0,'superseded expense and its markup are removed from live cash obligations')
  await h.command('bill.approve',{billId:bill.id,version:1},{as:manager,status:409})
  await h.command('bill.approve',{billId:bill.id,version:2},{as:manager})
  await h.command('bill.attach',{billId:bill.id,version:2,attachment:{name:'supplier.eml',type:'message/rfc822',base64:Buffer.from('From: landscape@example.test\nSubject: Reviewed invoice\n\nConfirmed').toString('base64')}})
  assert.equal((await read()).bills.find(x=>x.id===bill.id).state,'pending')
  await h.command('bill.approve',{billId:bill.id,version:3},{as:manager})
  await h.command('bill.create',base,{as:member,status:403});assert.equal((await h.request('/api/bills',{as:member})).status,403)
  const forbidden=await h.command('bill.create',{...base,invoiceNumber:'OUTSIDE',allocations:[{propertyId:outside.id,amount:'100'}],original:pdf('outside')})
  assert.ok(!(await read(manager)).bills.some(x=>x.id===forbidden.id))
  await h.command('bill.approve',{billId:forbidden.id,version:1},{as:manager,status:404})
  await h.command('bill.revise',{...base,billId:forbidden.id,version:1,invoiceNumber:'OUTSIDE',allocations:[{propertyId:a.id,amount:'100'}]})
  assert.ok(!(await read(manager)).bills.some(x=>x.id===forbidden.id),'current scope cannot expose evidence from historical out-of-scope allocations')
  await h.command('bill.approve',{billId:forbidden.id,version:2},{as:manager,status:404})
  const f=(await read()).bills.find(x=>x.id===forbidden.id).attachments[0]
  assert.equal((await h.request('/api/bill-attachment?id='+f.id,{as:manager})).status,404)
  // Accountants read invoices in scope; bookkeepers prepare and code but cannot approve. Live role changes take effect.
  await h.command('operator.role',{operatorId:memberId,role:'accountant',['portfolio:'+portfolio.id]:'1',['portfolio:'+sharedPortfolio.id]:'1'})
  assert.equal((await h.request('/api/bill-attachment?id='+attachment.id,{as:member})).status,200)
  await h.command('bill.approve',{billId:forbidden.id,version:1},{as:member,status:403})
  await h.command('operator.role',{operatorId:memberId,role:'bookkeeper',['portfolio:'+portfolio.id]:'1',['portfolio:'+sharedPortfolio.id]:'1'})
  await h.command('bill.create',{...base,invoiceNumber:'BOOKKEEPER',allocations:[{propertyId:a.id,amount:'100'}],original:pdf('bookkeeper')},{as:member})
  await h.command('bill.approve',{billId:forbidden.id,version:1},{as:member,status:403})
  // Work-linked invoices require approved work and the same supplier, with cumulative billed spend checked.
  const work=await h.command('maintenance.prepare',{tenancyId:tenancy.id,title:'Garden work',vendorId:vendor.id,trade:'landscaping',dueDate:'2024-09-01',estimate:'40'})
  const workBill=await h.command('bill.create',{...base,invoiceNumber:'WORK-LINK',lines:[{description:'Garden work',code:'landscaping',amount:'25',tax:'0'}],allocations:[{propertyId:a.id,amount:'25',jobId:work.id}],original:pdf('work-link')})
  assert.equal((await h.command('bill.approve',{billId:workBill.id,version:1},{as:manager,status:409})).error,'bill_held')
  await h.command('maintenance.approve',{jobId:work.id,version:1},{as:manager})
  await h.command('bill.approve',{billId:workBill.id,version:1},{as:manager})
  const excess=await h.command('bill.create',{...base,invoiceNumber:'WORK-EXCESS',lines:[{description:'Extra garden work',code:'landscaping',amount:'20',tax:'0'}],allocations:[{propertyId:a.id,amount:'20',jobId:work.id}],original:pdf('work-excess')})
  assert.equal((await h.command('bill.approve',{billId:excess.id,version:1},{as:manager,status:409})).error,'owner_approval_required')
  await h.command('bill.owner',{billId:excess.id,version:1,decision:'approved',source:'document',reference:'Owner approves cumulative work invoices totaling $45'})
  await h.command('bill.approve',{billId:excess.id,version:1},{as:manager})
  await h.command('work.limits',{tenancyId:tenancy.id,limit:'1000',budget:'267'})
  const budgetOnly=await h.command('bill.create',{...base,invoiceNumber:'ACTUAL-BUDGET',lines:[{description:'Small additional expense',code:'landscaping',amount:'3',tax:'0'}],allocations:[{propertyId:a.id,amount:'3'}],original:pdf('actual-budget')})
  const budgetRow=(await read()).bills.find(x=>x.id===budgetOnly.id)
  assert.ok(budgetRow.authority.reasons.some(x=>x.includes('budget')),'actual $45 linked invoices consume budget beyond the $40 work estimate')
  assert.ok(!budgetRow.authority.reasons.some(x=>x.includes('limit')))
  await h.command('bill.approve',{billId:budgetOnly.id,version:1},{as:manager,status:409})
  // Owner limits and budgets route a held bill to a source-backed exact owner decision, then independent approval.
  await h.command('work.limits',{tenancyId:tenancy.id,limit:'50',budget:'150'})
  const held=await h.command('bill.create',{...base,invoiceNumber:'HELD-LIMIT',date:'2024-07-01',allocations:[{propertyId:a.id,amount:'100'}],original:pdf('held')})
  let heldRow=(await read()).bills.find(x=>x.id===held.id)
  assert.ok(heldRow.authority.reasons.some(x=>x.includes('limit')));assert.ok(heldRow.authority.reasons.some(x=>x.includes('budget')))
  await h.command('bill.approve',{billId:held.id,version:1},{as:manager,status:409})
  await h.command('bill.owner',{billId:held.id,version:1,decision:'approved',source:'email',reference:'Owner email July 1 approves exact $100 invoice'})
  await h.command('bill.approve',{billId:held.id,version:1},{as:manager})
  assert.equal((await read()).bills.find(x=>x.id===held.id).state,'payable')
  await h.command('bill.revise',{...base,billId:held.id,version:1,invoiceNumber:'HELD-LIMIT',vendorId:association.id,allocations:[{propertyId:a.id,amount:'100'}]})
  await h.command('bill.approve',{billId:held.id,version:2},{as:manager,status:409})
  // Recurring HOA dues are a residential owner's vendor payable, never an association accounting ledger.
  const recurring={vendorId:association.id,invoiceNumber:'OWNER-HOA',purpose:'Residential owner HOA dues',starts:'2024-08-01',endDate:'2024-09-30',dayOfMonth:1,lines:[{description:'Owner HOA dues',code:'hoa-expense',amount:'25',tax:'0'}],allocations:[{propertyId:b.id,amount:'25'}]}
  const template=await h.command('bill-template.create',recurring)
  await h.command('bill-template.run',{templateId:template.id,version:1,month:'2024-08'},{status:409})
  await h.command('bill-template.approve',{templateId:template.id,version:1},{status:403})
  await h.command('bill-template.approve',{templateId:template.id,version:1},{as:manager})
  for(const month of ['2024-08','2024-09']) {
   const bill=await h.command('bill-template.run',{templateId:template.id,version:1,month})
   assert.equal(bill.state,'pending');const replay=await h.command('bill-template.run',{templateId:template.id,version:1,month});assert.equal(replay.id,bill.id);assert.equal(replay.generated,false)
   await h.command('bill.approve',{billId:bill.id,version:1},{as:manager})
  }
  await h.command('bill-template.run',{templateId:template.id,version:1,month:'2024-10'},{status:409})
  data=await read();const generated=data.bills.filter(x=>x.template_id===template.id)
  assert.equal(generated.length,2);assert.deepEqual(generated.map(x=>x.period),['2024-08','2024-09']);assert.ok(generated.every(x=>x.state==='payable'&&x.vendor_id===association.id&&x.parsed.totalCents===2500))
  await h.command('bill-template.revise',{...recurring,templateId:template.id,version:1,vendorId:vendor.id,lines:[{description:'Changed payee and amount',code:'hoa-expense',amount:'30',tax:'0'}],allocations:[{propertyId:b.id,amount:'30'}]})
  await h.command('bill-template.run',{templateId:template.id,version:2,month:'2024-09'},{status:409})
  await h.command('bill-template.approve',{templateId:template.id,version:2},{as:manager})
  assert.equal((await h.command('bill-template.run',{templateId:template.id,version:2,month:'2024-09'})).id,generated[1].id,'a template change cannot generate a second bill for an existing month')
  const html=await(await h.request('/app?tab=bills')).text();assert.ok(html.includes('LAND-REVISED'));assert.ok(html.includes('Oakland Residential Association'))
  // Closed months refuse capture and approval, with no partial originals or payable rows.
  for(const item of ['receipts','deposits','exceptions'])await h.command('period.signoff',{month:'2024-10',item})
  await h.command('period.close',{month:'2024-10'})
  await h.command('bill.create',{...base,invoiceNumber:'CLOSED',date:'2024-10-01',original:pdf('closed')},{status:409})
  await retention(h,{portfolioId:portfolio.id,ownerId:seller.id,vendorId:vendor.id,manager})
  // Archiving keeps private invoice bytes, approval evidence and payable owner allocations through restore.
  const archive=await(await h.request('/api/backup')).text(),fresh=await installation()
  try {
   const form=new FormData();form.set('command','data.restore');form.set('confirm','RESTORE');form.set('backup',new File([archive],'bills.rer'))
   const restored=await fresh.request('/api/commands',{method:'POST',form});assert.equal(restored.status,200,await restored.clone().text())
   const rows=await(await fresh.request('/api/bills')).json();assert.equal(rows.bills.length,(await read()).bills.length)
   const copy=await fresh.request('/api/bill-attachment?id='+attachment.id);assert.equal(await copy.text(),Buffer.from(base.original.base64,'base64').toString())
   assert.ok(rows.bills.find(x=>x.id===bill.id).approvals.length>=3)
  }finally{await fresh.close()}
  return {billId:bill.id,generated:generated.map(x=>x.id)}
 }finally{await h.close()}
}

/** Shared invoice originals honor either subject's hold, then redact eligible identity without losing cents. */
async function retention(h,{portfolioId,ownerId,vendorId,manager}) {
 const subjects=[]
 for(const suffix of ['one','two']) {
  const property=await h.command('property.add',{portfolioId,name:'Historic garden '+suffix,address:'Historic garden '+suffix+', Oakland, CA',kind:'duplex',timeZone:'America/Los_Angeles'})
  await h.command('ownership.set',{propertyId:property.id,effectiveFrom:'2010-01-01',reason:'Historic ownership',shares:[{ownerId,percent:'100'}]})
  await h.command('agreement.set',{propertyId:property.id,starts:'2010-01-01',feePercent:'0',reserve:'0',markupPercent:'10',reference:'Historic agreement'})
  const unit=await h.command('unit.add',{propertyId:property.id,identifier:'Old',bedrooms:1,bathrooms:1})
  const email='historic-'+suffix+'@example.test',tenantName='Historic Resident '+suffix
  const tenancy=await h.command('tenancy.create',{...tenancyInput,unitId:unit.id,startDate:'2010-01-01',endDate:'2011-12-31',tenantName,tenantEmail:email})
  const work=await h.command('maintenance.prepare',{tenancyId:tenancy.id,title:'Historic garden repair',vendorId,trade:'landscaping',dueDate:'2011-06-01',estimate:'50'})
  await h.command('maintenance.approve',{jobId:work.id,version:1},{as:manager})
  subjects.push({property,tenancy,work,email,tenantName})
 }
 const terms={vendorId,invoiceNumber:'HISTORIC-RESIDENT-INVOICE',date:'2011-06-01',reference:'Historic Resident one private invoice evidence',lines:[{description:'Historic Resident one garden repair',code:'landscaping',amount:'100',tax:'0'}],allocations:subjects.map(s=>({propertyId:s.property.id,amount:'50',jobId:s.work.id})),original:pdf('Historic Resident one private invoice bytes')}
 const bill=await h.command('bill.create',terms);await h.command('bill.approve',{billId:bill.id,version:1},{as:manager})
 const read=async()=>await(await h.request('/api/bills')).json(),before=(await read()).bills.find(x=>x.id===bill.id),attachmentId=before.attachments[0].id
 const access=await(await h.request('/api/resident-access?tenancyId='+subjects[0].tenancy.id)).json();assert.ok(access.billSources.some(x=>x.id===bill.id));assert.ok(!JSON.stringify(access.billSources).includes(subjects[1].tenantName),'SAFE-004: source projection omits other residents')
 const hold=await h.command('privacy.hold',{tenancyId:subjects[1].tenancy.id,class:'accounting',reason:'Other resident litigation'})
 const erase=async()=>{
  const request=await h.command('privacy.request',{tenancyId:subjects[0].tenancy.id,kind:'erase',source:'Historic resident request'})
  const reviewed=await h.command('privacy.review',{tenancyId:subjects[0].tenancy.id,requestId:request.id})
  return {review:reviewed.review,result:await h.command('tenancy.erase',{tenancyId:subjects[0].tenancy.id,requestId:request.id,fingerprint:reviewed.review.fingerprint,confirm:subjects[0].email})}
 }
 const held=await erase();assert.equal(held.review.personalRetained,true);assert.equal(held.result.alias,null)
 const accounting=held.review.classes.find(x=>x.class==='accounting');assert.ok(accounting.retained)
 assert.ok(!JSON.stringify(held.review).includes('Other resident litigation'),'shared evidence hold reason does not reveal the counterpart reason')
 assert.equal((await h.request('/api/bill-attachment?id='+attachmentId)).status,200,'a shared accounting hold preserves the invoice original')
 await h.command('privacy.release',{tenancyId:subjects[1].tenancy.id,holdId:hold.id,reason:'Litigation ended'})
 const erased=await erase();assert.equal(erased.review.personalRetained,false);assert.ok(erased.result.alias)
 assert.equal((await h.request('/api/bill-attachment?id='+attachmentId)).status,404,'eligible original invoice bytes are removed')
 await h.command('bill.create',{...terms,invoiceNumber:'ATTEMPTED-RESURRECTION'},{status:409})
 const after=(await read()).bills.find(x=>x.id===bill.id)
 assert.equal(after.parsed.totalCents,10000);assert.equal(after.expenses.reduce((n,x)=>n+x.amount_cents,0),10000)
 assert.equal(after.approvals[0].sha256,before.approvals[0].sha256,'original approval fingerprint remains')
 assert.ok(!JSON.stringify(after).includes('Historic Resident one'),'resident text is removed from every revision and approval snapshot')
 const history=await(await h.request('/api/history?action=bill.')).json()
 assert.ok(history.rows.filter(x=>x.subject===bill.id).every(x=>x.source===null),'billing audit sources are redacted under the erasure gate')
}
