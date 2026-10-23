import assert from 'node:assert/strict'
import {installation,tenancyInput} from './api/harness.mjs'
export async function journey({assets=false,inspect}={}){
 const h=await installation({assets})
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
  if(inspect)await inspect({h,seller,buyer,query})
 }finally{await h.close()}
}
