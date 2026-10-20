// OPS-007: a mixed owner's residential property links to its Cabin record and a Chest document by address only,
// within property scope; the links open the sibling, and the residential ledger and export carry no short-stay data.
import assert from 'node:assert/strict'
import {installation,tenancyInput} from './api/harness.mjs'

export async function journey() {
 const h=await installation()
 try {
  const place=async name=>{const f=await h.command('portfolio.add',{name}),p=await h.command('property.add',{portfolioId:f.id,name:name+' House',address:name+' Road, Oakland, CA',kind:'duplex',timeZone:'America/Los_Angeles'});return {f,p}}
  const mixed=await place('Mixed'),other=await place('Other')
  const unit=await h.command('unit.add',{propertyId:mixed.p.id,identifier:'1',bedrooms:2,bathrooms:1})
  const t=await h.command('tenancy.create',{...tenancyInput,unitId:unit.id,startDate:'2026-09-01',endDate:'2027-08-31',rent:'2100',cadence:'monthly'})
  const charge=await h.command('rent.charge',{tenancyId:t.id,dueDate:'2026-09-01',amount:'2100',description:'September rent',reference:'Lease section 2'})
  await h.command('rent.receipt',{chargeId:charge.id,amount:'2100',receivedDate:'2026-09-02',reference:'Check 1001'})
  await h.stepUp()
  const staff={},join=async(key,role,at)=>{const email=key+'@example.test';await h.command('operator.invite',{displayName:key,email,role,['portfolio:'+at.f.id]:'1'});staff[key]=await h.accept(email)}
  await join('mixedpm','portfolio_manager',mixed);await join('otherpm','portfolio_manager',other);await join('mixedleasing','leasing',mixed)
  const statement=async()=>(await h.request(`/api/statement?tenancyId=${t.id}&from=2026-09-01&to=2026-09-30`)).text(),before=await statement()

  // The owner enters each sibling's origin; a manager cannot, and only https host names are accepted.
  await h.command('sibling.link',{propertyId:mixed.p.id,product:'cabin',url:'https://cabin.example.com/app/properties/ca-77',label:'Lake cottage'},{status:409})
  await h.command('sibling.origin',{product:'cabin',origin:'https://cabin.example.com'},{as:staff.mixedpm,status:403})
  for(const origin of ['http://cabin.example.com','https://127.0.0.1','https://cabin.example.com/app','https://user:pw@cabin.example.com','https://localhost'])assert.equal((await h.command('sibling.origin',{product:'cabin',origin},{status:400})).error,'invalid_origin',origin)
  await h.command('sibling.origin',{product:'cabin',origin:'https://cabin.example.com'});await h.command('sibling.origin',{product:'chest',origin:'https://chest.example.com'})

  // A manager in the property's portfolio links records there; elsewhere the property does not exist for them.
  await h.command('sibling.link',{propertyId:mixed.p.id,product:'cabin',url:'https://evil.example.net/app/properties/ca-77',label:'Lake cottage'},{as:staff.mixedpm,status:400})
  const cabin=await h.command('sibling.link',{propertyId:mixed.p.id,product:'cabin',url:'https://cabin.example.com/app/properties/ca-77',label:'Lake cottage short stays'},{as:staff.mixedpm})
  await h.command('sibling.link',{propertyId:mixed.p.id,product:'chest',url:'https://chest.example.com/files/hoa-insurance-2026',label:'Insurance certificate'},{as:staff.mixedpm})
  await h.command('sibling.link',{propertyId:mixed.p.id,product:'chest',url:'https://chest.example.com/files/x',label:'x'},{as:staff.otherpm,status:404})
  await h.command('sibling.link',{propertyId:mixed.p.id,product:'chest',url:'https://chest.example.com/files/x',label:'x'},{as:staff.mixedleasing,status:403})
  await h.command('sibling.unlink',{linkId:cabin.id},{as:staff.otherpm,status:404})

  // Navigation: anyone reading the property sees the links, which open the sibling with no Terrace credential.
  const page=await(await h.request('/app?tab=properties',{as:staff.mixedleasing})).text()
  assert.ok(page.includes('href="https://cabin.example.com/app/properties/ca-77" target="_blank" rel="noopener noreferrer"'))
  assert.ok(page.includes('href="https://chest.example.com/files/hoa-insurance-2026"'))
  assert.match(page,/whose own sign-in decides access; Terrace has not checked that this record exists/)
  assert.ok(!(await(await h.request('/app?tab=properties',{as:staff.otherpm})).text()).includes('cabin.example.com/app'),'out-of-scope staff see no link')
  assert.deepEqual((await(await h.request('/api/state',{as:staff.otherpm})).json()).siblings.links,[])

  // The residential ledger and export are unchanged by links and hold no reservation or guest records.
  assert.equal(await statement(),before)
  const bytes=Buffer.from(await(await h.request('/api/readable-export')).arrayBuffer()),names=[]
  for(let o=0;bytes.readUInt32LE(o)===0x04034b50;){const n=bytes.readUInt16LE(o+26),x=bytes.readUInt16LE(o+28),size=bytes.readUInt32LE(o+18);names.push(bytes.subarray(o+30,o+30+n).toString());o+=30+n+x+size}
  assert.ok(names.includes('tables/tt_charges.csv')&&names.includes('tables/tt_receipts.csv')&&names.includes('tables/tt_sibling_links.csv'))
  assert.ok(!names.some(n=>/reservation|booking|guest/i.test(n)),'no short-stay records are kept in Terrace')
  await h.command('sibling.unlink',{linkId:cabin.id},{as:staff.mixedpm})
  assert.equal((await h.state()).siblings.links.length,1)
 }finally{await h.close()}
}
