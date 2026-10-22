// PORT-008: supplied statutory examples are synthetic counsel-input fixtures at the test edge.
// The product ships no active counsel-reviewed pack or substituted field values.
import assert from 'node:assert/strict'
import {installation} from './api/harness.mjs'
const fields=['depositCap','depositSeparateAccount','depositBankDisclosure','depositReceipt','depositInterest','depositRefund','depositItemization','dispositionDelivery','lateFee','partialPayments','payOrQuit','leaseViolation','rentIncreaseNotice','terminationNotice','rentCap','justCause','entryNotice','leaseDisclosures','retention']
export const syntheticPack=(code,version=1)=>{
 const pack={code,version,effectiveFrom:version===1?'2025-01-01':'2026-01-01',reviewer:'Synthetic counsel fixture — no legal review claimed',reviewReference:'synthetic-terrace-1',fields:Object.fromEntries(fields.map(k=>[k,{citation:'synthetic-terrace-1 reviewed '+k,effectiveDate:'2025-01-01',value:{text:'Synthetic reviewed field; no live legal advice'}}]))}
 const set=(k,value,citation)=>pack.fields[k]={value,citation,effectiveDate:'2025-01-01'}
 if(code==='CA'){
  set('depositRefund',{days:21},'Cal. Civ. Code §1950.5(g)')
  set('depositItemization',{days:21},'Cal. Civ. Code §1950.5(g)')
  set('dispositionDelivery',{claim:['personal_delivery','first_class_mail'],refund:['personal_delivery','first_class_mail'],address:'Reviewed forwarding address'},'Cal. Civ. Code §1950.5(g)')
  set('rentCap',{applies:true,baseBp:500,absoluteBp:1000},'Cal. Civ. Code §1947.12')
  set('justCause',{occupancyMonths:12},'Cal. Civ. Code §1946.2')
 }else if(code==='TX'){
  set('depositRefund',{days:30},'Tex. Prop. Code §92.103');set('depositItemization',{days:30},'Tex. Prop. Code §92.104')
  set('dispositionDelivery',{claim:['first_class_mail'],refund:['first_class_mail'],address:'Reviewed forwarding address'},'Tex. Prop. Code §92.107')
  set('lateFee',{fullUnpaidDays:2,basis:'monthly_rent',smallStructureMaxUnits:4,smallStructureCapBp:1200,largeStructureCapBp:1000},'Tex. Prop. Code §92.019')
 }else{
  set('depositRefund',{days:15,noClaimDays:15},'Fla. Stat. §83.49(3)');set('depositItemization',{days:30},'Fla. Stat. §83.49(3)')
  set('dispositionDelivery',{claim:['certified_mail'],refund:['first_class_mail'],address:'Last known mailing address as reviewed'},'Fla. Stat. §83.49(3)')
 }
 return pack
}
export async function journey({assets=false,inspect}={}){
 const h=await installation({assets})
 try{
  const catalog=async()=>{const r=await h.request('/api/rules');assert.equal(r.status,200);return r.json()}
  const initial=await catalog();assert.equal(initial.packs.filter(p=>!p.code.includes(':')).length,51);assert.equal(initial.packs.filter(p=>p.code.includes(':')).length,5);assert.ok(initial.packs.every(p=>p.latest===null))
  const f=await h.command('portfolio.add',{name:'Rule portfolio'}),properties={}
  for(const code of ['CA','TX','FL']){
   const p=await h.command('property.add',{portfolioId:f.id,name:code+' fixture property',address:'1 Synthetic Terrace Road',kind:'duplex',timeZone:'America/Los_Angeles'});properties[code]=p
   await h.command('property.rules',{propertyId:p.id,stateCode:code,version:0,reference:'synthetic-terrace-1'})
   const held=await h.command('rules.preview',{propertyId:p.id,action:'disposition',on:'2026-10-01',surrenderDate:'2026-10-01',depositCents:180000,claim:true});assert.equal(held.state,'held');assert.match(held.gaps.join(' '),/no dated pack/)
  }
  const activate=async p=>h.command('rules.activate',{packId:p.id,consent:'REVIEWED'})
  const tx=await h.command('rules.pack',syntheticPack('TX'));await h.command('rules.activate',{packId:tx.id,consent:'REVIEWED'},{status:409})
  const ca=await h.command('rules.pack',syntheticPack('CA'));await h.command('rules.activate',{packId:ca.id,consent:'YES'},{status:400});await activate(ca);await activate(tx)
  const fl=await h.command('rules.pack',syntheticPack('FL'));await activate(fl)
  const previews=[]
  for(const [code,due,methods]of [['CA','2026-10-22',['personal_delivery','first_class_mail']],['TX','2026-10-31',['first_class_mail']],['FL','2026-10-31',['certified_mail']]]){
   const d=await h.command('rules.preview',{propertyId:properties[code].id,action:'disposition',on:'2026-10-01',surrenderDate:'2026-10-01',depositCents:180000,claim:true});assert.equal(d.state,'reviewed_preview');assert.deepEqual([d.calculations[0].depositCents,d.calculations[0].dueOn,d.calculations[0].methods],[180000,due,methods]);previews.push(d)
  }
  const noClaim=await h.command('rules.preview',{propertyId:properties.FL.id,action:'disposition',on:'2026-10-01',surrenderDate:'2026-10-01',depositCents:180000,claim:false});assert.equal(noClaim.calculations[0].dueOn,'2026-10-16')
  for(const [on,fee]of [['2026-10-02',0],['2026-10-03',0],['2026-10-04',12000]]){
   const d=await h.command('rules.preview',{propertyId:properties.TX.id,action:'late_fee',on,dueDate:'2026-10-01',rentCents:100000,unpaidCents:100000,units:4});assert.equal(d.calculations[0].feeCents,fee);assert.equal(d.calculations[0].capBp,1200)
  }
  const renewal=await h.command('rules.preview',{propertyId:properties.CA.id,action:'renewal',on:'2026-10-01',currentRentCents:100000,proposedRentCents:111000,reviewedCpiBp:300,cpiSource:'synthetic-terrace-2 dated CPI source'});assert.equal(renewal.state,'held');assert.deepEqual([renewal.calculations[0].capBp,renewal.calculations[0].maxRentCents],[800,108000])
  const cause=await h.command('rules.preview',{propertyId:properties.CA.id,action:'nonrenewal',on:'2026-10-01',occupancyMonths:12});assert.equal(cause.state,'held');assert.match(cause.gaps.join(' '),/just cause/)
  const allowed=await h.command('rules.preview',{propertyId:properties.CA.id,action:'nonrenewal',on:'2026-10-01',occupancyMonths:12,justCause:'synthetic-terrace-3 counsel source'});assert.equal(allowed.state,'reviewed_preview')
  const incomplete=syntheticPack('CA',2);delete incomplete.fields.dispositionDelivery
  const draft=await h.command('rules.pack',incomplete);await h.command('rules.activate',{packId:draft.id,consent:'REVIEWED'},{status:409})
  const missing=await h.command('rules.preview',{propertyId:properties.CA.id,action:'disposition',on:'2026-10-01',surrenderDate:'2026-10-01',depositCents:180000,claim:true});assert.equal(missing.state,'held');assert.match(missing.gaps.join(' '),/missing Disposition delivery/)
  const next=syntheticPack('CA',3);next.fields.depositItemization.value.days=20
  const v3=await h.command('rules.pack',next);await activate(v3)
  const latest=await h.command('rules.preview',{propertyId:properties.CA.id,action:'disposition',on:'2026-10-01',surrenderDate:'2026-10-01',depositCents:180000,claim:true});assert.equal(latest.calculations[0].dueOn,'2026-10-21');assert.equal(latest.packs[0].version,3)
  const old=(await catalog()).decisions.find(d=>d.id===previews[0].id);assert.equal(old.result.packs[0].version,1);assert.equal(old.result.calculations[0].dueOn,'2026-10-22')
  await h.command('property.rules',{propertyId:properties.CA.id,stateCode:'CA',version:1,overlays:['NY:new_york_city'],reference:'Wrong local pack'},{status:400})
  await h.command('property.rules',{propertyId:properties.CA.id,stateCode:'CA',version:1,overlays:['CA:san_francisco'],reference:'synthetic-terrace-4'})
  const overlay=await h.command('rules.preview',{propertyId:properties.CA.id,action:'nonrenewal',on:'2026-10-01',occupancyMonths:12,justCause:'Synthetic cause'});assert.equal(overlay.state,'held');assert.match(overlay.gaps.join(' '),/CA:san_francisco: no dated pack/)
  const member=await h.invite('member','rules-global-member@example.test');await h.command('rules.pack',syntheticPack('CA',4),{as:member,status:403});await h.command('rules.activate',{packId:v3.id,consent:'REVIEWED'},{as:member,status:403})
  const outside=await h.command('portfolio.add',{name:'Other rule portfolio'}),other=await h.command('property.add',{portfolioId:outside.id,name:'Outside jurisdiction',address:'2 Synthetic Terrace Road',kind:'duplex',timeZone:'America/New_York'})
  await h.command('property.rules',{propertyId:other.id,stateCode:'NY',version:0,reference:'synthetic-terrace-5'})
  const staff={};await h.stepUp()
  for(const role of ['portfolio_manager','leasing','bookkeeper','accountant','maintenance_coordinator','member']){
   const email='rules-'+role+'@example.test'
   await h.command('operator.invite',{displayName:role,email,role,['portfolio:'+f.id]:'1'});staff[role]=await h.accept(email)
   const response=await h.request('/api/rules',{as:staff[role]});assert.equal(response.status,200,role+' reads property pack values and held reasons')
   const data=await response.json();assert.ok(!JSON.stringify(data).includes(other.id));assert.ok(!data.packs.some(p=>p.code==='NY'))
   const ca=data.packs.find(p=>p.code==='CA');assert.equal(ca.versions.find(v=>v.version===3).fields.depositItemization.value.days,20)
   assert.match(data.properties.find(p=>p.id===properties.CA.id).heldReasons.join(' '),/CA:san_francisco: no dated pack/)
   assert.ok(data.decisions.some(d=>d.result.gaps.some(g=>/exceeds the reviewed cap/.test(g))),'staff see the reason a saved renewal is held')
   assert.ok(data.decisions.every(d=>!d.input&&d.result.calculations.length===0),'pack read rights grant no resident financial inputs or calculations')
   assert.ok(!JSON.stringify(ca.versions.find(v=>v.version===2).fields).includes('depositRefund'),'inactive draft values are owner-only')
   for(const path of ['/api/rules?propertyId=','/app?tab=rules&propertyId='])assert.equal((await h.request(path+other.id,{as:staff[role]})).status,404)
   const html=await(await h.request('/app?tab=rules',{as:staff[role]})).text();assert.ok(html.includes('Property pack status')&&!html.includes('Outside jurisdiction'))
   assert.ok((await(await h.request('/app?tab=properties',{as:staff[role]})).text()).includes('Open state &amp; local rules'))
   await h.command('rules.pack',syntheticPack('CA',4),{as:staff[role],status:403})
   await h.command('rules.activate',{packId:v3.id,consent:'REVIEWED'},{as:staff[role],status:403})
   await h.command('rules.preview',{propertyId:properties.CA.id},{as:staff[role],status:403})
   await h.command('property.rules',{propertyId:properties.CA.id},{as:staff[role],status:403})
   await h.command('property.rules.confirm',{proposalId:'synthetic-terrace-6'},{as:staff[role],status:403})
   if(role!=='portfolio_manager')await h.command('property.rules.propose',{}, {as:staff[role],status:403})
  }
  const manager=staff.portfolio_manager
  await h.command('property.rules.propose',{propertyId:other.id,stateCode:'NY',version:1,reference:'synthetic-terrace-7'},{as:manager,status:404})
  const pendingProperty=await h.command('property.add',{portfolioId:f.id,name:'Proposed jurisdiction',address:'3 Synthetic Terrace Road',kind:'duplex',timeZone:'America/Los_Angeles'})
  const propose=()=>h.command('property.rules.propose',{propertyId:pendingProperty.id,stateCode:'CA',overlays:['CA:los_angeles'],version:0,reference:'synthetic-terrace-8'},{as:manager})
  const proposal=await propose(),competing=await propose()
  assert.ok(!(await catalog()).assignments.some(a=>a.property_id===pendingProperty.id),'a manager proposal changes no effective jurisdiction')
  const pending=await h.command('rules.preview',{propertyId:pendingProperty.id,action:'entry',on:'2026-10-01'});assert.equal(pending.state,'held');assert.match(pending.gaps.join(' '),/not been explicitly assigned/)
  await h.command('property.rules.confirm',{proposalId:proposal.id,reference:'synthetic-terrace-9 owner review',stateCode:'TX'})
  const confirmed=(await catalog()).assignments.find(a=>a.property_id===pendingProperty.id);assert.deepEqual([confirmed.state_code,confirmed.overlays,confirmed.version],['CA',['CA:los_angeles'],1],'owner confirms the stored proposal, never client-substituted fields')
  for(const p of [proposal,competing])await h.command('property.rules.confirm',{proposalId:p.id,reference:'synthetic-terrace-10'},{status:409})
  const ownerHistory=await(await h.request('/api/history')).json();assert.ok(JSON.stringify(ownerHistory).includes('property.rules.propose')&&JSON.stringify(ownerHistory).includes('property.rules.confirm'))
  // A complete inactive draft cannot borrow an older active review or produce calculations.
  const inactive=await h.command('rules.pack',syntheticPack('TX',2))
  const heldDraft=await h.command('rules.preview',{propertyId:properties.TX.id,action:'late_fee',on:'2026-10-04',dueDate:'2026-10-01',rentCents:100000,unpaidCents:100000,units:4})
  assert.equal(heldDraft.state,'held');assert.match(heldDraft.gaps.join(' '),/counsel review not recorded/);assert.deepEqual(heldDraft.calculations,[])
  await activate(inactive)
  const before=await catalog();await h.restart();assert.deepEqual(await catalog(),before)
  const archive=await(await h.request('/api/backup')).text(),fresh=await installation()
  try{await fresh.formCommand('data.restore',{confirm:'RESTORE',backup:new File([archive],'packs.rer')});const restored=await(await fresh.request('/api/rules')).json();assert.deepEqual(restored.decisions,before.decisions);assert.deepEqual(restored.proposals,before.proposals);assert.deepEqual(restored.assignments,before.assignments)}finally{await fresh.close()}
  if(inspect)await inspect({h,properties,staff,pendingProperty})
 }finally{await h.close()}
}
