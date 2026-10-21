// ACCT-001: public-door rent, deposit, expense, contributions, trial/subledgers and duplicate reversal.
import assert from 'node:assert/strict'
import {installation,tenancyInput} from './api/harness.mjs'
export async function journey({assets=false,inspect}={}){
 const old=await installation({beforeMigration:async(name,db)=>{
  if(!name.startsWith('0056'))return
  await db.batch([
   db.prepare("INSERT INTO tt_tenancies(id,address,owner_name,owner_email,tenant_name,tenant_email,start_date,end_date,rent_cents,cadence,created_at,currency,currency_confirmed,time_zone) VALUES('synthetic-terrace-1','1 Alder Lane','Legacy Owner','legacy-owner@example.test','Legacy Resident','legacy-resident@example.test','2025-01-01','2026-12-31',100000,'monthly','2025-01-01T00:00:00Z','USD',1,'America/Los_Angeles')"),
   db.prepare("INSERT INTO tt_charges(id,tenancy_id,due_date,amount_cents,description,reference,created_at,currency) VALUES('synthetic-terrace-2','synthetic-terrace-1','2025-02-01',100000,'Opening rent','synthetic-terrace-2','2025-02-01T00:00:00Z','USD')"),
   db.prepare("INSERT INTO tt_receipts(id,charge_id,amount_cents,received_date,reference,created_at,currency) VALUES('synthetic-terrace-3','synthetic-terrace-2',20000,'2025-02-02','synthetic-terrace-3','2025-02-02T00:00:00Z','USD')"),
   db.prepare("INSERT INTO tt_adjustments(id,charge_id,amount_cents,reason,at,currency) VALUES('synthetic-terrace-5','synthetic-terrace-2',1000,'Legacy correction','2025-03-01T00:30:00Z','USD')"),
   db.prepare("INSERT INTO tt_portfolios(id,name,created_by,created_at) VALUES('synthetic-terrace-pf','Legacy portfolio','old-owner','2025-01-01')"),
   db.prepare("INSERT INTO tt_properties(id,portfolio_id,name,address,kind,time_zone,created_by,created_at) VALUES('synthetic-terrace-prop','synthetic-terrace-pf','Legacy property','1 Legacy Lane','duplex','America/Los_Angeles','old-owner','2025-01-01')"),
   db.prepare("INSERT INTO tt_owners(id,kind,legal_name,email,mailing_address,created_by,created_at) VALUES('synthetic-terrace-owner','individual','Legacy Owner','legacy@example.test','1 Legacy Lane','old-owner','2025-01-01')"),
   db.prepare("INSERT INTO tt_ownership_sets(id,property_id,effective_from,reason,created_by,created_at) VALUES('synthetic-terrace-set','synthetic-terrace-prop','2025-01-01','Opening shares','old-owner','2025-01-01')"),
   db.prepare("INSERT INTO tt_ownership_shares(set_id,owner_id,share_bp,position) VALUES('synthetic-terrace-set','synthetic-terrace-owner',10000,0)"),
   db.prepare("INSERT INTO tt_management_agreements(id,property_id,starts,fee_bp,reserve_cents,reference,created_by,created_at) VALUES('synthetic-terrace-agreement','synthetic-terrace-prop','2025-01-01',0,0,'Old agreement','old-owner','2025-01-01')"),
   db.prepare("INSERT INTO tt_vendors(id,name,email,phone,specialties,service_areas,w9,insurance_expires,availability,currency,standing,updated_by,updated_at) VALUES('synthetic-terrace-vendor','Legacy vendor','vendor@example.test','1','[\"general\"]','[\"Oakland\"]','received','2030-01-01','Available','USD','approved','old-owner','2025-01-01')"),
   db.prepare("INSERT INTO tt_bills(id,vendor_id,invoice_number,invoice_key,day,version,state,prepared_by,revised_by,created_at) VALUES('synthetic-terrace-bill','synthetic-terrace-vendor','Legacy bill','legacy bill','2025-02-03',2,'payable','old-owner','old-owner','2025-02-03')"),
   ...[1,2].map(version=>db.prepare("INSERT INTO tt_bill_revisions(bill_id,version,terms,sha256,prepared_by,prepared_at) VALUES('synthetic-terrace-bill',?,'{}',?,'old-owner','2025-02-03')").bind(version,'synthetic-terrace-'+version)),
   ...[1,2].map(version=>db.prepare("INSERT INTO tt_bill_expenses(id,bill_id,version,property_id,owner_id,share_set_id,agreement_id,day,share_bp,property_cents,amount_cents) VALUES(?,'synthetic-terrace-bill',?,'synthetic-terrace-prop','synthetic-terrace-owner','synthetic-terrace-set','synthetic-terrace-agreement','2025-02-03',10000,?,?)").bind('synthetic-terrace-expense-'+version,version,version===1?30000:40000,version===1?30000:40000)),
   db.prepare("INSERT INTO tt_period_closes(id,month,version,closed_by,closed_at,statement) VALUES('synthetic-terrace-4','2025-02',1,'old-owner','2025-03-01T00:00:00Z','[]')")
  ])
 }})
 try{const j=await(await old.request('/api/journal')).json();assert.equal(j.entries.length,6);assert.equal(j.debitCents,221000);assert.equal(j.creditCents,221000);const expenses=j.trialBalance.find(a=>a.code==='expense');assert.equal(expenses.debitCents-expenses.creditCents,40000);assert.equal(j.entries.filter(e=>e.source_kind==='bill_reversal').length,1);assert.equal(j.entries.find(e=>e.source_kind==='reduction').day,'2025-02-28');assert.equal((await old.state('synthetic-terrace-1')).ledger.balanceCents,79000);assert.equal((await old.command('journal.post',{propertyId:'synthetic-terrace-prop',ownerId:'synthetic-terrace-owner',day:'2025-02-10',fund:'operating',kind:'opening',reference:'Backdated opening',lines:[{account:'receivable',debit:100,credit:0},{account:'opening_equity',debit:0,credit:100}]},{status:409})).error,'period_closed')}finally{await old.close()}
 const h=await installation({assets})
 try{
  const make=async name=>{
   const f=await h.command('portfolio.add',{name}),p=await h.command('property.add',{portfolioId:f.id,name:name+' House',address:'1 '+name+' Lane, Oakland, CA',kind:'duplex',timeZone:'America/Los_Angeles'}),u=await h.command('unit.add',{propertyId:p.id,identifier:'A',bedrooms:'2',bathrooms:'1'}),o=await h.command('owner.add',{kind:'individual',legalName:name+' Owner',email:name.toLowerCase()+'@example.test',mailingAddress:'1 '+name+' Lane'})
   await h.command('ownership.set',{propertyId:p.id,effectiveFrom:'2025-01-01',reason:'synthetic-terrace-1',shares:[{ownerId:o.id,percent:'100'}]})
   const t=await h.command('tenancy.create',{...tenancyInput,unitId:u.id,tenantName:name+' Resident',tenantEmail:name.toLowerCase()+'-resident@example.test'})
   return{f,p,u,o,t}
  }
  const a=await make('Alder'),b=await make('Birch'),day=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Los_Angeles'}).format(new Date())
  const vendor=await h.command('vendor.add',{name:'Clear Plumbing',email:'plumbing@example.test',phone:'510-555-0101',specialties:'plumbing',serviceAreas:'Oakland',w9:'received',insuranceExpires:'2036-12-31',rate:'100.00',standing:'approved'})
  const get=async q=>{const r=await h.request('/api/journal'+(q?'?'+new URLSearchParams(q):''));assert.equal(r.status,200);return r.json()}
  const pair=(account,n,creditAccount)=>[{account,debit:n,credit:0},{account:creditAccount,debit:0,credit:n}]
  const post=(x,kind,fund,ls,extra={})=>h.command('journal.post',{propertyId:x.p.id,ownerId:x.o.id,tenancyId:x.t.id,day,kind,fund,reference:'synthetic-terrace-1 '+kind,lines:ls,...extra})
  await h.command('chart.add',{code:'repairs',name:'Reviewed repair expense',kind:'expense',fund:'operating'})
  const earlyDay=new Date(Date.parse(day+'T12:00:00Z')-10*864e5).toISOString().slice(0,10)
  const original=[]
  for(const x of [a,b]){
   await h.command('agreement.set',{propertyId:x.p.id,starts:'2025-01-01',feePercent:'10.00',feeTaxPercent:'4.5',reserve:'0',reference:'synthetic-terrace-6 management agreement'})
   const charge=await h.command('rent.charge',{tenancyId:x.t.id,dueDate:earlyDay,amount:'1000.00',description:'Rent',reference:x.p.id+' rent'})
   const first=await h.command('rent.receipt',{chargeId:charge.id,receivedDate:earlyDay,amount:'100.00',reference:x.p.id+' payment'})
   const duplicate=await h.command('rent.receipt',{chargeId:charge.id,receivedDate:earlyDay,amount:'100.00',reference:x.p.id+' duplicate'})
   await h.command('fees.run',{propertyId:x.p.id,month:day.slice(0,7)})
   original.push({x,charge,first,duplicate,before:(await get({propertyId:x.p.id})).entries})
   await post(x,'deposit','deposit',pair('cash',180000,'deposit_liability'))
   await post(x,'contribution','operating',pair('cash',50000,'contribution'))
   await post(x,'vendor_expense','operating',pair('expense',10000,'cash'),{vendorId:vendor.id})
   const open=await post(x,'opening','operating',pair('receivable',2500,'opening_equity'))
   await h.command('journal.reverse',{entryId:open.id,day,reference:'Correct opening balance'})
  }
  const archiveRows=(await(await h.request('/api/backup')).text()).trim().split('\n').map(JSON.parse).filter(r=>r.kind==='part').flatMap(p=>p.items).filter(i=>i.kind==='row')
  const overridden=archiveRows.find(i=>i.table==='tt_fees'&&i.row.source==='receipt:'+original[1].duplicate.id).row
  await h.command('fee.override',{feeId:overridden.id,amount:'3.33',reason:'Partial waiver on duplicate before correction'})
  const successor=await h.command('owner.add',{kind:'individual',legalName:'Cedar successor',email:'cedar@example.test',mailingAddress:'1 Cedar Lane'})
  const transferred=new Date(Date.parse(earlyDay+'T12:00:00Z')+864e5).toISOString().slice(0,10)
  await h.command('ownership.set',{propertyId:a.p.id,effectiveFrom:transferred,reason:'Dated sale after receipt',shares:[{ownerId:successor.id,percent:'100'}]})
  await h.command('agreement.set',{propertyId:a.p.id,starts:transferred,feePercent:'20.00',reserve:'0',reference:'Successor agreement'})
  const snapshot=await get(),count=snapshot.entries.length
  await post(b,'journal','operating',[{account:'cash',debit:1,credit:0},{account:'contribution',debit:0,credit:2}]).then(()=>assert.fail('unbalanced must be refused'),e=>{assert.match(e.message,/400|debit|credit|balance/i)})
  assert.equal((await get()).entries.length,count,'unbalanced writes nothing')
  await h.command('journal.post',{propertyId:a.p.id,ownerId:b.o.id,day,kind:'vendor_expense',fund:'operating',vendorId:vendor.id,reference:'Other owner',lines:pair('expense',1,'cash')},{status:409})
  await h.command('journal.post',{propertyId:b.p.id,ownerId:b.o.id,day,kind:'journal',fund:'deposit',reference:'Deposit cannot pay expense',lines:pair('expense',1,'cash')},{status:400})
  await h.command('journal.post',{propertyId:b.p.id,ownerId:b.o.id,day,kind:'vendor_expense',fund:'operating',vendorId:vendor.id,reference:'Cannot borrow other owners or deposits',lines:pair('expense',100000,'cash')},{status:409})
  assert.equal((await get()).entries.length,count,'all refused fund and owner requests leave no journal row')
  const custom=await post(b,'journal','operating',pair('repairs',123,'payable'))
  const customData=await get({propertyId:b.p.id});assert.equal(customData.trialBalance.find(a=>a.code==='repairs').debitCents,123);assert.deepEqual(customData.entries.find(j=>j.id===custom.id).lines,pair('repairs',123,'payable'))
  for(const{x,duplicate,before}of original){
   const reversal=await h.command('rent.reverse-receipt',{receiptId:duplicate.id,day,reference:'Bank duplicate corrected',reason:'Same external payment entered twice'})
   await h.command('rent.reverse-receipt',{receiptId:duplicate.id,day,reference:'Again',reason:'Again'},{status:409})
   const fees=await h.command('fees.run',{propertyId:x.p.id,month:day.slice(0,7)})
   assert.ok(fees.lines.some(l=>l.kind==='management'&&l.ownerId===x.o.id&&l.amountCents===(x===a?-1000:-333)&&l.taxCents===(x===a?-45:-15)),'the correction reverses the original owner and fee rate after a transfer')
   const allocation=await(await h.request('/api/owner-statement?'+new URLSearchParams({ownerId:x.o.id,from:earlyDay,to:day}))).json()
   assert.equal(allocation.rows.find(r=>r.reference==='Bank duplicate corrected').allocatedCents,-10000)
   const state=await h.state(x.t.id);assert.equal(state.ledger.balanceCents,90000);assert.equal(state.ledger.receipts.length,3);assert.equal(state.ledger.receipts.filter(r=>r.reversal_of===duplicate.id).length,1)
   for(const q of [{tenancyId:x.t.id},{propertyId:x.p.id},{ownerId:x.o.id}]){
    const d=await get(q),old=d.entries.find(j=>j.source_kind==='receipt'&&j.source_id===duplicate.id),undo=d.entries.find(j=>j.reversal_of===old.id)
    assert.equal(undo.source_id,reversal.id);assert.deepEqual(undo.lines,old.lines.map(l=>({account:l.account,debit:l.credit,credit:l.debit})))
    const unchanged=before.find(j=>j.id===old.id);assert.deepEqual({...old,reversed_by:null},unchanged,'the original source posting remains intact')
    assert.equal(d.debitCents,d.creditCents)
   }
  }
  const deposit=await get({fund:'deposit'});assert.equal(deposit.entries.length,2);assert.equal(deposit.trialBalance.find(a=>a.code==='deposit_liability').creditCents,360000);assert.equal(deposit.trialBalance.find(a=>a.code==='lease_income').creditCents,0)
  assert.equal((await get({vendorId:vendor.id})).entries.length,2)
  const member=await h.invite('member','member@example.test')
  assert.equal((await h.request('/api/journal',{as:member})).status,403)
  await h.command('journal.post',{}, {as:member,status:403});await h.command('chart.add',{}, {as:member,status:403})
  await h.stepUp();await h.command('operator.invite',{displayName:'Scoped bookkeeper',email:'scoped-books@example.test',role:'bookkeeper',portfolioIds:[a.f.id]})
  const scoped=await h.accept('scoped-books@example.test')
  assert.equal((await h.request('/api/journal?propertyId='+b.p.id,{as:scoped})).status,404)
  const scopedData=await(await h.request('/api/journal',{as:scoped})).json();assert.ok(scopedData.entries.length);assert.ok(scopedData.entries.every(j=>j.property_id===a.p.id));assert.ok(!JSON.stringify(scopedData.owners).includes(b.o.id))
  await h.command('journal.post',{propertyId:b.p.id,ownerId:b.o.id,day,kind:'contribution',fund:'operating',reference:'Out of scope',lines:pair('cash',100,'contribution')},{as:scoped,status:404})
  await h.command('rent.adjust',{chargeId:original[0].charge.id,amount:'1.00',reason:'Sourced correction'})
  assert.equal((await get()).entries.find(j=>j.source_kind==='reduction').day,day)
  const db=await h.mf.getD1Database('DB');await assert.rejects(db.prepare("UPDATE tt_journal SET reference='rewrite'").run(),/never edited/);await assert.rejects(db.prepare('DELETE FROM tt_journal').run(),/never deleted/)
  const expected=(await get()).entries;await h.restart();assert.deepEqual((await get()).entries,expected)
  const archive=await(await h.request('/api/backup')).text(),fresh=await installation()
  try{await fresh.formCommand('data.restore',{confirm:'RESTORE',backup:new File([archive],'journal.rer')});const restored=await(await fresh.request('/api/journal')).json();assert.deepEqual(restored.entries,expected);assert.equal(restored.accounts.find(a=>a.code==='repairs').name,'Reviewed repair expense')}finally{await fresh.close()}
  if(inspect)await inspect({h,a,b,day,vendor})
 }finally{await h.close()}
}
