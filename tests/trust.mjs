// ACCT-002: public HTTP bank custody, separation, approval, reserves and recovery.
import assert from 'node:assert/strict'
import {installation,tenancyInput} from './api/harness.mjs'
export async function journey({assets=false,inspect}={}){
 const h=await installation({assets})
 try{
  const get=async(as=h.cookie,propertyId='')=>{const r=await h.request('/api/trust'+(propertyId?'?propertyId='+propertyId:''),{as});assert.equal(r.status,200,await r.clone().text());return r.json()}
  const make=async name=>{
   const f=await h.command('portfolio.add',{name}),p=await h.command('property.add',{portfolioId:f.id,name:name+' House',address:'1 '+name+' Lane, Oakland, CA',kind:'duplex',timeZone:'America/Los_Angeles'}),u=await h.command('unit.add',{propertyId:p.id,identifier:'A',bedrooms:'2',bathrooms:'1'}),o=await h.command('owner.add',{kind:'individual',legalName:name+' Owner',email:name.toLowerCase()+'@example.test',mailingAddress:'1 '+name+' Lane'})
   await h.command('ownership.set',{propertyId:p.id,effectiveFrom:'2025-01-01',reason:'synthetic-terrace-1',shares:[{ownerId:o.id,percent:'100'}]})
   await h.command('agreement.set',{propertyId:p.id,starts:'2025-01-01',feePercent:'0',reserve:'200.00',reference:'synthetic-terrace-2'})
   const t=await h.command('tenancy.create',{...tenancyInput,unitId:u.id,tenantName:name+' Resident',tenantEmail:name.toLowerCase()+'-resident@example.test'})
   return{f,p,u,o,t}
  }
  const a=await make('Alder'),b=await make('Birch'),day=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Los_Angeles'}).format(new Date())
  await h.command('company.save',{name:'Synthetic Terrace Management',timeZone:'America/Los_Angeles',officeEmail:'office@example.test',officePhone:'510-555-0101',officeAddress:'1 Alder Lane'})
  await h.command('trust.account.add',{}, {status:403})
  await h.stepUp()
  const entity=await h.command('entity.add',{legalName:'Synthetic Terrace LLC',ein:'12-3456789'}),other=await h.command('entity.add',{legalName:'Synthetic Other LLC',ein:'12-3456790'})
  const bank=async(name,purpose,entityId=entity.id)=>h.command('trust.account.add',{entityId,name,purpose,bankName:'Synthetic Bank',last4:purpose==='deposit'?'5530':'1020'})
  const rent=await bank('Rent trust','rent_trust'),deposit=await bank('Deposit trust','deposit'),second=await bank('Reserve trust','rent_trust'),wrong=await bank('Other entity trust','rent_trust',other.id),operating=await bank('Operating account','operating')
  const map=(x,bankId,fund,primary=true,opts={})=>h.command('trust.map',{propertyId:x.p.id,bankId,fund,primary,reference:'synthetic-terrace-3 bank authority'},opts)
  for(const x of [a,b]){await map(x,rent.id,'operating');await map(x,deposit.id,'deposit');await map(x,second.id,'operating',false);await map(x,operating.id,'operating',false)}
  await map(a,deposit.id,'operating',false,{status:409});await map(a,wrong.id,'operating',false,{status:409})
  await map(a,second.id,'operating',true,{status:409})
  const pair=(n,other)=>[{account:'cash',debit:n,credit:0},{account:other,debit:0,credit:n}]
  for(const x of [a,b]){
   const charge=await h.command('rent.charge',{tenancyId:x.t.id,dueDate:day,amount:'1000.00',description:'Rent',reference:'synthetic-terrace-4 '+x.p.id})
   const receipt=await h.command('rent.receipt',{chargeId:charge.id,amount:'1000.00',receivedDate:day,reference:'synthetic-terrace-5 '+x.p.id})
   x.receipt=receipt
   await h.command('journal.post',{propertyId:x.p.id,ownerId:x.o.id,tenancyId:x.t.id,day,fund:'deposit',kind:'deposit',reference:'synthetic-terrace-6 external deposit',lines:pair(180000,'deposit_liability')})
  }
  const before=await get(),amount=(d,bankId,x)=>d.balances.find(z=>z.bank_id===bankId&&z.owner_key===x.o.id&&z.property_id===x.p.id)?.balance_cents??0
  for(const x of [a,b]){assert.equal(amount(before,rent.id,x),100000);assert.equal(amount(before,deposit.id,x),180000)}
  assert.ok(before.reconciliation.every(r=>r.complete&&r.ledgerCents===r.assignedCents));assert.equal(before.unassigned.length,0)
  const prepare=(p={},opts={})=>h.command('trust.prepare',{propertyId:a.p.id,ownerId:a.o.id,fund:'operating',fromBank:rent.id,toBank:second.id,day,amount:'300.00',reason:'synthetic-terrace-7 reviewed transfer',...p},opts)
  assert.equal((await prepare({fund:'deposit',fromBank:deposit.id,purpose:'owner_payout'},{status:409})).error,'payout_door')
  assert.equal((await prepare({toOwnerId:b.o.id},{status:409})).error,'inter_owner')
  await prepare({toPropertyId:b.p.id},{status:409});await prepare({toBank:deposit.id},{status:409});await prepare({toBank:wrong.id},{status:409});await prepare({toBank:operating.id},{status:409});await prepare({amount:'800.01'},{status:409});await prepare({day:'2036-01-01'},{status:400});await prepare({day:'2025-01-01'},{status:409})
  const refused=await get();assert.deepEqual(refused.balances,before.balances);assert.equal(refused.transfers.length,0);assert.ok(refused.exceptions.some(x=>x.outcome==='inter_owner'));assert.ok(refused.exceptions.some(x=>x.outcome==='payout_door'))
  const solo=await prepare({amount:'1.00'});await h.command('trust.approve',{transferId:solo.id});assert.equal((await get()).transfers.find(t=>t.id===solo.id).label,'self-approved: no second person')
  let manager=await h.invite('admin','manager@example.test')
  const transfer=await prepare()
  await h.command('trust.record',{transferId:transfer.id,bankReference:'synthetic-terrace-8'},{status:409})
  await h.command('trust.approve',{transferId:transfer.id},{status:403})
  await h.stepUp('manager@example.test',manager)
  await h.command('trust.approve',{transferId:transfer.id},{as:manager})
  assert.equal((await get()).transfers.find(t=>t.id===transfer.id).approved_by!==undefined,true)
  await h.command('trust.record',{transferId:transfer.id,bankReference:'synthetic-terrace-8'})
  await h.command('trust.record',{transferId:transfer.id,bankReference:'synthetic-terrace-8'},{status:409})
  const moved=await get();assert.equal(amount(moved,rent.id,a),70000);assert.equal(amount(moved,second.id,a),30000);assert.equal(amount(moved,deposit.id,a),180000);assert.equal(amount(moved,rent.id,b),100000);assert.ok(moved.reconciliation.every(r=>r.ledgerCents===r.assignedCents))
  const held=await prepare({amount:'400.00'})
  await h.command('trust.approve',{transferId:held.id},{as:manager})
  await h.command('agreement.set',{propertyId:a.p.id,starts:day,feePercent:'0',reserve:'650.00',reference:'synthetic-terrace-9 increased reserve'})
  await h.command('trust.record',{transferId:held.id,bankReference:'synthetic-terrace-10'},{status:409})
  assert.equal((await get()).transfers.find(t=>t.id===held.id).bank_reference,null,'reserve rechecked after approval')
  await h.command('rent.reverse-receipt',{receiptId:a.receipt.id,day,reference:'synthetic-terrace-11',reason:'Cannot reverse cash already moved'},{status:409})
  assert.deepEqual((await get()).balances,moved.balances,'a source reversal cannot overdraw its bank custody')
  // A legacy unassigned source remains a visible exception even when its balance is zero.
  const c=await make('Cedar')
  await h.command('journal.post',{propertyId:c.p.id,ownerId:c.o.id,day,fund:'operating',kind:'contribution',reference:'synthetic-terrace-12',lines:pair(50000,'contribution')})
  await map(c,rent.id,'operating');await map(c,second.id,'operating',false)
  const pending=await get(),legacy=pending.unassigned.find(j=>j.property_id===c.p.id);assert.ok(legacy)
  await prepare({propertyId:c.p.id,ownerId:c.o.id,amount:'1.00'},{status:409})
  await h.command('trust.assign',{entryId:legacy.id,bankId:deposit.id},{status:409})
  await h.command('trust.assign',{entryId:legacy.id,bankId:rent.id})
  assert.equal((await get()).unassigned.length,0)
  const member=await h.invite('member','member@example.test');assert.equal((await h.request('/api/trust',{as:member})).status,403);assert.equal((await h.request('/api/trust',{as:''})).status,401)
  for(const command of ['trust.account.add','trust.map','trust.assign','trust.prepare','trust.approve','trust.record'])await h.command(command,{}, {as:member,status:403})
  await h.command('operator.invite',{displayName:'Scoped books',email:'books@example.test',role:'bookkeeper',portfolioIds:[a.f.id]})
  const books=await h.accept('books@example.test'),scoped=await get(books)
  assert.ok(scoped.balances.every(x=>x.property_id===a.p.id));assert.ok(scoped.mappings.every(x=>x.property_id===a.p.id));assert.ok(!JSON.stringify(scoped).includes(b.o.id));assert.equal((await h.request('/api/trust?propertyId='+b.p.id,{as:books})).status,404)
  await prepare({propertyId:b.p.id,ownerId:b.o.id},{as:books,status:404});await h.command('trust.map',{}, {as:books,status:403});await h.command('trust.approve',{}, {as:books,status:403})
  const revoked=await prepare({propertyId:b.p.id,ownerId:b.o.id,amount:'10.00'});await h.command('trust.approve',{transferId:revoked.id},{as:manager});
  const operators=await(await h.request('/auth/operators')).json();const managerId=operators.find(o=>o.email==='manager@example.test').id;await h.command('operator.role',{operatorId:managerId,role:'leasing',allPortfolios:true});await h.command('trust.record',{transferId:revoked.id,bankReference:'synthetic-terrace-22'},{status:409});await h.command('operator.role',{operatorId:managerId,role:'portfolio_manager',allPortfolios:true});manager=await h.signIn('manager@example.test');await h.stepUp('manager@example.test',manager);
  const racers=await Promise.all([prepare({propertyId:b.p.id,ownerId:b.o.id,amount:'700.00'}),prepare({propertyId:b.p.id,ownerId:b.o.id,amount:'700.00'})]);for(const t of racers)await h.command('trust.approve',{transferId:t.id},{as:manager});
  const race=await Promise.all(racers.map((t,i)=>h.request('/api/commands',{method:'POST',body:{command:'trust.record',transferId:t.id,bankReference:'synthetic-terrace-race-'+i}})));assert.deepEqual(race.map(r=>r.status).sort(),[200,409]);assert.equal(amount(await get(),rent.id,b),30000);
  const expected=await get();await h.restart();const restarted=await get();assert.deepEqual(restarted.balances,expected.balances);assert.deepEqual(restarted.transfers,expected.transfers)
  const archive=await(await h.request('/api/backup')).text(),fresh=await installation()
  try{await fresh.formCommand('data.restore',{confirm:'RESTORE',backup:new File([archive],'trust.rer')});const restored=await(await fresh.request('/api/trust')).json();assert.deepEqual(restored.balances,expected.balances);assert.deepEqual(restored.transfers,expected.transfers);assert.deepEqual(restored.mappings,expected.mappings)}finally{await fresh.close()}
  if(inspect)await inspect({h,a,b,c,day,rent,deposit,second,manager,transfer})
 }finally{await h.close()}
}
