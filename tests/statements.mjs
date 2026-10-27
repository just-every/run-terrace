import assert from 'node:assert/strict'
import {installation,tenancyInput} from './api/harness.mjs'
export async function journey({assets=false,inspect}={}){
 const h=await installation({assets,now:'2026-10-27T12:00:00.000Z'})
 try{
  const f=await h.command('portfolio.add',{name:'Statement portfolio'}),p=await h.command('property.add',{portfolioId:f.id,name:'Statement House',address:'1 Alder Lane',kind:'duplex',timeZone:'America/Los_Angeles'}),u=await h.command('unit.add',{propertyId:p.id,identifier:'A',bedrooms:'2',bathrooms:'1'}),t=await h.command('tenancy.create',{...tenancyInput,unitId:u.id})
  const owner=async name=>h.command('owner.add',{kind:'individual',legalName:name,email:name.toLowerCase()+'@example.test',mailingAddress:'1 Alder Lane'}),seller=await owner('Seller'),buyer=await owner('Buyer')
  await h.command('ownership.set',{propertyId:p.id,effectiveFrom:'2025-01-01',reason:'synthetic-terrace-1',shares:[{ownerId:seller.id,percent:'100'}]})
  await h.command('ownership.set',{propertyId:p.id,effectiveFrom:'2026-09-16',reason:'synthetic-terrace-2 transfer',shares:[{ownerId:buyer.id,percent:'100'}]})
  await h.command('agreement.set',{propertyId:p.id,starts:'2025-01-01',feePercent:'0',reserve:'100',reference:'synthetic-terrace-3'})
  const post=(who,day,amount,account='contribution',fund='operating')=>h.command('journal.post',{propertyId:p.id,ownerId:who.id,tenancyId:t.id,kind:'journal',fund,day,reference:'synthetic-terrace-4 '+day+' '+account,lines:[{account:'cash',debit:Math.max(0,amount),credit:Math.max(0,-amount)},{account,debit:Math.max(0,-amount),credit:Math.max(0,amount)}]})
  await post(seller,'2026-08-31',100000,'opening_equity');await post(seller,'2026-09-10',60000,'lease_income');await post(seller,'2026-09-11',-5000,'fee_expense');await post(seller,'2026-09-12',-10000,'expense');await post(seller,'2026-09-13',20000,'deposit_liability','deposit')
  await post(buyer,'2026-09-16',60000,'lease_income');await post(buyer,'2026-09-17',-3000,'expense')
  const query=id=>'/api/owner-statement?ownerId='+id+'&from=2026-09-01&to=2026-09-30',read=async id=>{const r=await h.request(query(id));assert.equal(r.status,200,await r.clone().text());return r.json()}
  const s=await read(seller.id),b=await read(buyer.id),operating=s.cashDraft.rows.find(r=>r.fund==='operating'),deposit=s.cashDraft.rows.find(r=>r.fund==='deposit'),newCash=b.cashDraft.rows.find(r=>r.fund==='operating')
  assert.equal(s.cashDraft.status,'draft');assert.equal(s.cashDraft.published,false);assert.equal(operating.openingCents,100000);assert.equal(operating.inflowCents,60000);assert.equal(operating.outflowCents,15000);assert.equal(operating.closingCents,145000);assert.equal(operating.reserveCents,0);assert.equal(deposit.closingCents,20000);assert.equal(deposit.liabilitiesCents,20000);assert.equal(deposit.availableBeforeDistributionCents,0)
  assert.equal(newCash.openingCents,0);assert.equal(newCash.closingCents,57000);assert.equal(newCash.reserveCents,10000);assert.equal(newCash.availableBeforeDistributionCents,47000)
  assert.ok(operating.lines.every(l=>l.day<'2026-09-16'));assert.ok(newCash.lines.every(l=>l.day>='2026-09-16'))
  const csv=await(await h.request(query(seller.id)+'&format=csv')).text();assert.match(csv,/1450.00/);assert.match(csv,/200.00/);assert.ok(csv.includes(operating.lines[0].sourceId))
  const member=await h.invite('member','member@example.test');assert.equal((await h.request(query(seller.id),{as:member})).status,403)
  const other=await h.command('portfolio.add',{name:'Other'});await h.stepUp();await h.command('operator.invite',{displayName:'Scoped books',email:'scoped@example.test',role:'bookkeeper',portfolioIds:[other.id]});const scoped=await h.accept('scoped@example.test');assert.equal((await h.request(query(seller.id),{as:scoped})).status,404)
  await h.restart();assert.deepEqual((await read(seller.id)).cashDraft,s.cashDraft)
  const vendor=await h.command('vendor.add',{name:'Statement repairs',email:'repair@example.test',phone:'510-555-0100',specialties:'plumbing',serviceAreas:'Oakland',w9:'received',insuranceExpires:'2036-12-31',licenseNumber:'synthetic-terrace-8',licenseExpires:'2036-12-31',availability:'Weekdays',rate:'100',standing:'approved'})
  const original=n=>({name:'invoice-'+n+'.pdf',type:'application/pdf',base64:Buffer.from('%PDF-1.4\nsynthetic-terrace-'+n+'\n%%EOF').toString('base64')})
  const bill=async(n,date,allocations=[{propertyId:p.id,amount:'25'}])=>{
   const b=await h.command('bill.create',{vendorId:vendor.id,invoiceNumber:'synthetic-terrace-'+n,date,lines:[{description:'Repair',code:'repairs',amount:'25',tax:'0'}],allocations,original:original(n)})
   await h.command('bill.approve',{billId:b.id,version:1});return b
  }
  const oldBill=await bill(10,'2026-09-15'),newBill=await bill(11,'2026-09-16')
  const invite=async(o)=>{await h.command('portal.invite',{kind:'owner',ownerId:o.id,email:o.name.toLowerCase()+'@example.test',displayName:o.name,source:'synthetic-terrace-9 owner request'});return h.portalSignIn(o.name.toLowerCase()+'@example.test')}
  seller.name='Seller';buyer.name='Buyer';const sellerCookie=await invite(seller),buyerCookie=await invite(buyer)
  const portalQuery='/portal/owner-statement?from=2026-09-01&to=2026-09-30',portalRead=async as=>{const r=await h.request(portalQuery+'&format=json',{as});assert.equal(r.status,200,await r.clone().text());const statement=await r.json(),files=await h.request('/portal/api/owner-invoices?from=2026-09-01&to=2026-09-30',{as});assert.equal(files.status,200);return {...statement,...await files.json()}}
  const ps=await portalRead(sellerCookie),pb=await portalRead(buyerCookie)
  assert.deepEqual(ps.invoices.map(x=>x.billId),[oldBill.id]);assert.deepEqual(pb.invoices.map(x=>x.billId),[newBill.id]);assert.deepEqual(ps.expenses.map(x=>[x.day,x.amount_cents]),[['2026-09-15',2500]]);assert.deepEqual(pb.expenses.map(x=>[x.day,x.amount_cents]),[['2026-09-16',2500]])
  const oldFile=ps.invoices[0].files[0],newFile=pb.invoices[0].files[0]
  assert.ok(oldFile&&newFile,'both owners have an actual source original')
  for(const [as,f,n]of [[sellerCookie,oldFile,10],[buyerCookie,newFile,11]]){const r=await h.request(f.url,{as});assert.equal(r.status,200);assert.equal(await r.text(),Buffer.from(original(n).base64,'base64').toString());assert.equal(r.headers.get('cache-control'),'private, no-store');assert.match(r.headers.get('content-security-policy'),/sandbox/)}
  for(const [as,f]of [[sellerCookie,newFile],[buyerCookie,oldFile]])assert.equal((await h.request(f.url,{as})).status,404)
  assert.equal((await h.request(oldFile.url,{as:h.cookie})).status,401)
  assert.equal((await h.request(oldFile.url,{as:''})).status,401)
  assert.equal((await h.request('/portal/owner-invoice?id=unknown',{as:sellerCookie})).status,404)
  await h.command('portal.invite',{kind:'resident',tenancyId:t.id,email:'alex@example.test',displayName:'Alex',source:'synthetic-terrace-16 resident request'})
  const residentCookie=await h.portalSignIn('alex@example.test');assert.equal((await h.request(oldFile.url,{as:residentCookie})).status,404)
  assert.equal((await(await h.request('/portal/owner-statement?ownerId='+buyer.id+'&from=2026-09-01&to=2026-09-30&format=json',{as:sellerCookie})).json()).owner.id,seller.id,'an owner-id parameter cannot replace the live grant')
  assert.equal((await h.request('/api/owner-statement?ownerId='+buyer.id+'&from=2026-09-01&to=2026-09-30',{as:sellerCookie})).status,401)
  const portalCsv=await(await h.request(portalQuery+'&format=csv',{as:sellerCookie})).text();assert.match(portalCsv,/synthetic-terrace-10/);assert.ok(!portalCsv.includes('synthetic-terrace-11'))
  const screen=await h.formCommand('document.upload',{tenancyId:t.id,kind:'screening',title:'synthetic-terrace-12 screening',source:'Staff',file:new File(['private background'],'screen.txt',{type:'text/plain'})})
  assert.equal((await h.request('/portal/owner-invoice?id='+screen.id,{as:sellerCookie})).status,404)
  // A shared original is held even though the owner's own expense remains visible.
  await h.command('ownership.set',{propertyId:p.id,effectiveFrom:'2026-10-01',reason:'synthetic-terrace-13 joint ownership',shares:[{ownerId:seller.id,percent:'50'},{ownerId:buyer.id,percent:'50'}]})
  assert.equal((await h.request(oldFile.url,{as:sellerCookie})).status,401)
  const again=async(o)=>{const email=o.name.toLowerCase()+'@example.test';assert.equal((await h.request('/portal/signin',{method:'POST',as:'',form:new URLSearchParams({email})})).status,202);return h.portalSignIn(email)}
  const shared=await bill(14,'2026-10-02'),freshSeller=await again(seller),freshBuyer=await again(buyer)
  for(const as of [freshSeller,freshBuyer]){const r=await h.request('/portal/owner-statement?from=2026-10-01&to=2026-10-31&format=json',{as});assert.equal(r.status,200);const d=await r.json();const files=await h.request('/portal/api/owner-invoices?from=2026-10-01&to=2026-10-31',{as});assert.equal(files.status,200);assert.deepEqual((await files.json()).invoices,[]);assert.equal(d.expenses[0].amount_cents,1250)}
  const allBills=await(await h.request('/api/bills')).json(),sharedFile=allBills.bills.find(x=>x.id===shared.id).attachments[0]
  assert.equal((await h.request('/portal/owner-invoice?id='+sharedFile.id,{as:freshSeller})).status,404)
  const revised={billId:newBill.id,version:1,vendorId:vendor.id,invoiceNumber:'synthetic-terrace-11',date:'2026-09-16',lines:[{description:'Corrected repair',code:'repairs',amount:'25',tax:'0'}],allocations:[{propertyId:p.id,amount:'25'}]}
  await h.command('bill.revise',revised)
  assert.equal((await h.request(newFile.url,{as:freshBuyer})).status,404,'pending revisions immediately withdraw originals')
  await h.command('bill.approve',{billId:newBill.id,version:2})
  assert.equal((await h.request(newFile.url,{as:freshBuyer})).status,200)
  const otherProperty=await h.command('property.add',{portfolioId:f.id,name:'Other beneficiary property',address:'Private buyer property',kind:'duplex',timeZone:'America/Los_Angeles'})
  await h.command('ownership.set',{propertyId:otherProperty.id,effectiveFrom:'2025-01-01',reason:'synthetic-terrace-17',shares:[{ownerId:buyer.id,percent:'100'}]})
  await h.command('agreement.set',{propertyId:otherProperty.id,starts:'2025-01-01',feePercent:'0',reserve:'0',reference:'synthetic-terrace-18'})
  const mixed=await bill(19,'2026-09-10',[{propertyId:p.id,amount:'12.50'},{propertyId:otherProperty.id,amount:'12.50'}])
  const mixedFile=(await(await h.request('/api/bills')).json()).bills.find(x=>x.id===mixed.id).attachments[0]
  const mixedUrl='/portal/owner-invoice?id='+mixedFile.id
  assert.equal((await h.request(mixedUrl,{as:freshSeller})).status,404)
  await h.command('bill.revise',{...revised,billId:mixed.id,version:1,invoiceNumber:'synthetic-terrace-19',date:'2026-09-10'})
  await h.command('bill.approve',{billId:mixed.id,version:2})
  assert.equal((await h.request(mixedUrl,{as:freshSeller})).status,404,'a current allocation cannot disclose an original with another beneficiary in its history')
  await h.restart();assert.equal((await h.request(oldFile.url,{as:freshSeller})).status,200)
  if(inspect)await inspect({h,seller,buyer,query,sellerCookie:freshSeller,portalQuery,oldFile})
  const grants=await(await h.request('/portal/api/me',{as:freshSeller})).json()
  await h.command('portal.revoke',{grantId:grants.grants[0].id,reason:'synthetic-terrace-15 access ended'})
  assert.equal((await h.request(oldFile.url,{as:freshSeller})).status,401)
  const history=await(await h.request('/api/history?action=portal.read:owner-invoice')).json();assert.ok(history.rows.some(x=>x.subject===oldFile.id),'source reads remain in attributable history')
  const archive=await(await h.request('/api/backup')).text(),restored=await installation({now:'2026-10-27T12:00:00.000Z'})
  try{
   await restored.formCommand('data.restore',{confirm:'RESTORE',backup:new File([archive],'statement.rer')})
   assert.equal((await restored.request(oldFile.url,{as:freshSeller})).status,401,'restoring accounting originals never restores portal credentials')
   await restored.stepUp();await restored.command('portal.invite',{kind:'owner',ownerId:seller.id,email:'seller@example.test',displayName:'Seller',source:'synthetic-terrace-20 fresh destination authorization'})
   const cookie=await restored.portalSignIn('seller@example.test'),file=await restored.request(oldFile.url,{as:cookie})
   assert.equal(file.status,200);assert.equal(await file.text(),Buffer.from(original(10).base64,'base64').toString())
   assert.equal((await restored.request(newFile.url,{as:cookie})).status,404)
  }finally{await restored.close()}
 }finally{await h.close()}
}
