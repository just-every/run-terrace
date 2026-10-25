import assert from 'node:assert/strict'
import {installation,tenancyInput} from './api/harness.mjs'
/** WORK-014 category budgets through authenticated command, state and payable doors. Shares the bills registration. */
export async function journey({assets=false,inspect}={}) {
 const h=await installation({assets,now:'2026-10-25T12:00:00Z',asyncDatabase:true})
 try {
  const portfolio=await h.command('portfolio.add',{name:'Budget portfolio'}),outside=await h.command('portfolio.add',{name:'Outside budget portfolio'})
  const property=await h.command('property.add',{portfolioId:portfolio.id,name:'Budget house',address:'1840 Alder Street, Oakland, CA',kind:'single_family',timeZone:'America/Los_Angeles'})
  const unit=await h.command('unit.add',{propertyId:property.id,identifier:'A',bedrooms:2,bathrooms:1})
  const t=await h.command('tenancy.create',{...tenancyInput,unitId:unit.id})
  const owner=await h.command('owner.add',{kind:'individual',legalName:'Budget Owner',email:'budget-owner@example.test',mailingAddress:'1 Alder Street'})
  await h.command('ownership.set',{propertyId:property.id,effectiveFrom:'2025-01-01',reason:'synthetic-terrace-1',shares:[{ownerId:owner.id,percent:'100'}]})
  await h.command('agreement.set',{propertyId:property.id,starts:'2025-01-01',feePercent:'0',reserve:'0',reference:'synthetic-terrace-2'})
  const asset=await h.command('asset.add',{tenancyId:t.id,kind:'Furnace',location:'Hall',make:'Synthetic',model:'Terrace',serial:'synthetic-terrace-3',installedDate:'2025-01-01'})
  const vendor=await h.command('vendor.add',{name:'Budget Plumbing',email:'budget-plumbing@example.test',phone:'510-555-0101',specialties:'plumbing',serviceAreas:'Oakland',w9:'received',insuranceExpires:'2036-12-31',rate:'100',standing:'approved'})
  const budget=(kind,amount,extra={})=>h.command('work.budget',{tenancyId:t.id,year:'2026',kind,amount,reference:'synthetic-terrace-4 approved '+kind,...extra})
  await budget('operating','100');await budget('capital','200');await budget('operating','40',{assetId:asset.id})
  const manager=await h.invite('admin','budget-manager@example.test'),member=await h.invite('member','budget-member@example.test')
  const people=await(await h.request('/auth/operators')).json(),managerId=people.find(x=>x.email==='budget-manager@example.test').id
  await h.stepUp();await h.command('operator.role',{operatorId:managerId,role:'portfolio_manager',['portfolio:'+portfolio.id]:'1'})
  await h.command('work.budget',{tenancyId:t.id,year:'2026',kind:'operating',amount:'1',reference:'Unauthorized'},{as:member,status:403})
  const privateProperty=await h.command('property.add',{portfolioId:outside.id,name:'Private',address:'2 Private Street',kind:'single_family',timeZone:'America/Los_Angeles'}),privateUnit=await h.command('unit.add',{propertyId:privateProperty.id,identifier:'B',bedrooms:1,bathrooms:1}),privateT=await h.command('tenancy.create',{...tenancyInput,unitId:privateUnit.id})
  await h.command('work.budget',{tenancyId:privateT.id,year:'2026',kind:'operating',amount:'1',reference:'Outside'},{as:manager,status:404})
  const prepare=(title,estimate,extra={})=>h.command('maintenance.prepare',{tenancyId:t.id,title,vendorId:vendor.id,trade:'plumbing',dueDate:'2026-06-01',estimate,...extra})
  const work=await prepare('Furnace repair','50',{assetId:asset.id})
  await h.command('maintenance.approve',{jobId:work.id,version:1},{as:manager,status:409})
  let state=await h.state(t.id),authority=state.work.authorities[work.id]
  assert.match(authority.reasons.join(' '),/operating asset Furnace/)
  await h.command('maintenance.owner',{jobId:work.id,version:1,decision:'approved',source:'email',reference:'synthetic-terrace-5 exact furnace approval'})
  await h.command('maintenance.approve',{jobId:work.id,version:1},{as:manager})
  const capture=async(n,amount,jobId=work.id,extra={})=>h.command('bill.create',{vendorId:vendor.id,invoiceNumber:'synthetic-terrace-'+n,date:'2026-06-02',lines:[{description:'Repair part and tax',code:'repairs',amount:String(Number(amount)-5),tax:'5'}],allocations:[{propertyId:property.id,amount,jobId,...extra}],original:{name:'invoice.pdf',type:'application/pdf',base64:Buffer.from('%PDF-1.4\nsynthetic-terrace-'+n+'\n%%EOF').toString('base64')}})
  const approveBill=async b=>{const rows=await(await h.request('/api/bills')).json(),row=rows.bills.find(x=>x.id===b.id);if(row.authority.needsOwner)await h.command('bill.owner',{billId:b.id,version:1,decision:'approved',source:'document',reference:'synthetic-terrace-6 exact bill approval'});await h.command('bill.approve',{billId:b.id,version:1},{as:manager})}
  const first=await capture(7,'30');await approveBill(first)
  let budgets=(await h.state(t.id)).work.categoryBudgets
  assert.equal(budgets.find(b=>b.kind==='operating'&&!b.asset_id).spentCents,5000,'estimate and linked bill are one reservation, including tax')
  const second=await capture(8,'40');await approveBill(second)
  budgets=(await h.state(t.id)).work.categoryBudgets
  assert.equal(budgets.find(b=>b.kind==='operating'&&!b.asset_id).spentCents,7000,'cumulative invoices replace the lower estimate')
  assert.equal(budgets.find(b=>b.kind==='operating'&&b.asset_id).spentCents,7000)
  assert.equal(budgets.find(b=>b.kind==='capital').spentCents,0)
  const capital=await prepare('Capital replacement','150',{costClass:'capital'})
  await h.command('maintenance.approve',{jobId:capital.id,version:1},{as:manager})
  const capitalBill=await capture(9,'20',null,{costClass:'capital',assetId:asset.id});await approveBill(capitalBill)
  const excess=await prepare('Another operating repair','40')
  await h.command('maintenance.approve',{jobId:excess.id,version:1},{as:manager,status:409})
  await h.command('maintenance.owner',{jobId:excess.id,version:1,decision:'approved',source:'call',reference:'synthetic-terrace-10 $110 operating approval'})
  await h.command('maintenance.revise',{jobId:excess.id,version:1,estimate:'45'})
  await h.command('maintenance.approve',{jobId:excess.id,version:2},{as:manager,status:409})
  await h.command('maintenance.owner',{jobId:excess.id,version:2,decision:'approved',source:'email',reference:'synthetic-terrace-11 $115 operating approval'})
  await h.command('maintenance.approve',{jobId:excess.id,version:2},{as:manager})
  state=await h.state(t.id);budgets=state.work.categoryBudgets
  assert.deepEqual(budgets.filter(b=>!b.asset_id).map(b=>[b.kind,b.spentCents]),[['capital',17000],['operating',11500]])
  const snapshot=JSON.parse(state.work.jobs.find(j=>j.id===excess.id).approval_snapshot)
  assert.equal(snapshot.costClass,'operating');assert.ok(snapshot.categoryBudgets.some(b=>b.reference==='synthetic-terrace-4 approved operating'&&b.projectedCents===11500))
  // Concurrent approvals cannot both spend a category's last available funds.
  await budget('capital','200',{version:1})
  const x=await prepare('Capital race one','20',{costClass:'capital'}),y=await prepare('Capital race two','20',{costClass:'capital'})
  const answers=await h.atOnce([x,y].map(j=>['/api/commands',{method:'POST',as:manager,body:{command:'maintenance.approve',jobId:j.id,version:1}}]))
  assert.equal(answers.filter(r=>r.status===200).length,1);assert.ok(answers.every(r=>[200,409].includes(r.status)))
  // A stale budget form cannot silently overwrite the source or approval snapshot.
  await h.command('work.budget',{tenancyId:t.id,year:'2026',kind:'capital',amount:'500',reference:'stale',version:1},{status:409})
  assert.ok((await h.state(t.id)).work.budgetHistory.length===4)
  const future=await prepare('Next year operating','999',{dueDate:'2027-01-01'})
  await h.command('maintenance.approve',{jobId:future.id,version:1},{as:manager})
  const purchase=await capture(13,'20',null)
  await approveBill(purchase)
  const lot=await h.command('stock.receive',{tenancyId:t.id,billId:purchase.id,billVersion:1,name:'Furnace filter',quantity:3,day:'2026-06-03',reference:'synthetic-terrace-14 received purchase'})
  await h.command('stock.receive',{tenancyId:t.id,billId:purchase.id,billVersion:1,name:'Duplicate',quantity:3,day:'2026-06-03',reference:'synthetic-terrace-15'},{status:409})
  await h.command('stock.consume',{tenancyId:t.id,lotId:lot.id,jobId:work.id,jobVersion:1,quantity:1,day:'2026-06-04',reference:'synthetic-terrace-16 repair part'},{as:member,status:403})
  await h.command('stock.consume',{tenancyId:privateT.id,lotId:lot.id,jobId:work.id,jobVersion:1,quantity:1,day:'2026-06-04',reference:'synthetic-terrace-17 wrong property'},{status:404})
  // Existing approved over-budget work has no remaining room; receipt alone does not create repair expense.
  const stockUse={tenancyId:t.id,lotId:lot.id,jobId:future.id,jobVersion:(await h.state(t.id)).work.jobs.find(j=>j.id===future.id).version,quantity:1,day:'2026-06-04',reference:'synthetic-terrace-18 repair use'}
  await h.command('stock.consume',{...stockUse,jobId:work.id,jobVersion:(await h.state(t.id)).work.jobs.find(j=>j.id===work.id).version},{status:409})
  const successor=await h.command('owner.add',{kind:'individual',legalName:'Stock successor',email:'stock-successor@example.test',mailingAddress:'2 Alder Street'})
  await h.command('ownership.set',{propertyId:property.id,effectiveFrom:'2026-06-05',reason:'synthetic-terrace-21 ownership transfer',shares:[{ownerId:successor.id,percent:'100'}]})
  await h.command('stock.consume',{...stockUse,day:'2026-06-06'},{status:409})
  await h.command('stock.consume',stockUse)
  const stock=(await h.state(t.id)).work.stock
  assert.equal(stock.lots[0].used_quantity,1);assert.equal(stock.lots[0].used_cents,666)
  assert.equal(stock.uses[0].job_id,future.id)
  assert.equal((await h.state(t.id)).work.categoryBudgets.find(b=>b.kind==='operating'&&!b.asset_id).spentCents,11500,'stock purchase is no longer a repair reservation; part use stays within the approved estimate')
  const journal=await(await h.request('/api/journal?propertyId='+property.id)).json()
  const inventory=journal.entries.flatMap(j=>j.lines).filter(l=>l.account==='inventory').reduce((n,l)=>n+l.debit-l.credit,0)
  assert.equal(inventory,1334,'unconsumed tax-inclusive cost remains an asset')
  assert.equal(journal.entries.filter(j=>j.source_kind==='stock_use').flatMap(j=>j.lines).filter(l=>l.account==='expense').reduce((n,l)=>n+l.debit,0),666)
  assert.equal(journal.entries.filter(j=>j.source_kind==='stock_receipt').flatMap(j=>j.lines).filter(l=>l.account==='expense').reduce((n,l)=>n+l.credit,0),2000)
  const useEntry=journal.entries.find(j=>j.source_kind==='stock_use')
  assert.equal(useEntry.owner_key,owner.id)
  await h.command('journal.reverse',{entryId:useEntry.id,day:'2026-06-04',reference:'synthetic-terrace-19 bypass'},{status:409})
  await h.command('bill.attach',{billId:purchase.id,version:1,attachment:{name:'source.pdf',type:'application/pdf',base64:Buffer.from('%PDF-1.4\nsynthetic-terrace-20\n%%EOF').toString('base64')}},{status:409})
  await h.command('stock.consume',{...stockUse,quantity:3},{status:409})
  // WORK-014: exact source costs, explicit authority, independent allocation and no duplicate recovery.
  await h.command('ownership.set',{propertyId:property.id,effectiveFrom:'2026-06-09',reason:'synthetic-terrace-50 returned ownership',shares:[{ownerId:owner.id,percent:'100'}]})
  let cb=(await h.state(t.id)).work.chargebacks
  const source=cb.costs.find(s=>s.source_kind==='stock_use'),resident={id:'resident:'+t.id}
  assert.equal(source.costCents,666);assert.equal(source.netOwnerCostCents,666)
  const proposed={tenancyId:t.id,sourceId:source.id,ownerId:owner.id,kind:'resident',recipientId:resident.id,amount:'2.00',day:'2026-06-10',authority:'synthetic-terrace-51 exact recipient and amount authorization',consent:'yes'}
  await h.command('chargeback.prepare',{...proposed,consent:'no'},{status:400})
  await h.command('chargeback.prepare',{...proposed,ownerId:successor.id},{status:409})
  await h.command('chargeback.prepare',{...proposed,recipientId:'synthetic-terrace-52 unrelated resident'},{status:409})
  await h.command('chargeback.prepare',proposed,{as:member,status:403})
  await h.command('chargeback.prepare',{...proposed,tenancyId:privateT.id},{as:manager,status:404})
  const pending=await h.command('chargeback.prepare',proposed)
  const pendingRow=(await h.state(t.id)).work.chargebacks.proposals.find(p=>p.id===pending.id)
  assert.equal((await h.state(t.id)).work.chargebacks.costs.find(s=>s.id===source.id).recoveredCents,0,'a proposal has no financial effect')
  const approve={chargebackId:pending.id,sha256:pendingRow.sha256}
  await h.command('chargeback.approve',approve,{status:403})
  await h.command('chargeback.approve',{...approve,sha256:'synthetic-terrace-53 stale'},{as:manager,status:409})
  await h.command('chargeback.approve',approve,{as:manager})
  await h.command('chargeback.approve',approve,{as:manager,status:409})
  const ownerProposal=await h.command('chargeback.prepare',{...proposed,kind:'owner',recipientId:owner.id,amount:'1.00'})
  const insuranceProposal=await h.command('chargeback.prepare',{...proposed,kind:'insurance',recipientId:'synthetic-terrace-54 insurer claim',amount:'1.00'})
  for(const p of [ownerProposal,insuranceProposal]){const row=(await h.state(t.id)).work.chargebacks.proposals.find(r=>r.id===p.id);await h.command('chargeback.approve',{chargebackId:p.id,sha256:row.sha256},{as:manager})}
  cb=(await h.state(t.id)).work.chargebacks
  assert.equal(cb.costs.find(s=>s.id===source.id).recoveredCents,400);assert.equal(cb.costs.find(s=>s.id===source.id).netOwnerCostCents,266)
  assert.equal(cb.proposals.find(p=>p.id===pending.id).terms.authority,proposed.authority)
  await h.command('chargeback.prepare',{...proposed,amount:'3.00'},{status:409})
  const racesPending=[]
  for(let n=0;n<2;n++){const p=await h.command('chargeback.prepare',{...proposed,amount:'2.00'});racesPending.push((await h.state(t.id)).work.chargebacks.proposals.find(r=>r.id===p.id))}
  const recoveries=await h.atOnce(racesPending.map(p=>['/api/commands',{method:'POST',as:manager,body:{command:'chargeback.approve',chargebackId:p.id,sha256:p.sha256}}]))
  assert.equal(recoveries.filter(r=>r.status===200).length,1);assert.ok(recoveries.every(r=>[200,409].includes(r.status)))
  const statement=await(await h.request('/api/owner-statement?ownerId='+owner.id+'&from=2026-06-01&to=2026-06-30')).json();assert.equal(statement.costAllocations.reduce((n,a)=>n+a.amount_cents,0),600)
  const afterJournal=await(await h.request('/api/journal?propertyId='+property.id)).json(),postings=afterJournal.entries.filter(j=>j.source_kind==='chargeback')
  assert.equal(postings.flatMap(j=>j.lines).filter(l=>l.account==='receivable').reduce((n,l)=>n+l.debit,0),600)
  assert.equal(postings.flatMap(j=>j.lines).filter(l=>l.account==='expense').reduce((n,l)=>n+l.credit,0),600)
  assert.deepEqual(afterJournal.entries.filter(j=>j.source_kind==='bill'),journal.entries.filter(j=>j.source_kind==='bill'),'allocation never duplicates or changes the purchase payable')
  await h.command('journal.reverse',{entryId:postings[0].id,day:'2026-06-10',reference:'synthetic-terrace-55 bypass'},{status:409})
  const changedMember=await h.command('household.add',{tenancyId:t.id,role:'co_tenant',name:'Synthetic departing member',email:'departing@example.test',joined:'2025-01-01'})
  const changed=await h.command('chargeback.prepare',{...proposed,recipientId:changedMember.id,amount:'0.10'})
  const changedRow=(await h.state(t.id)).work.chargebacks.proposals.find(p=>p.id===changed.id)
  await h.command('household.leave',{memberId:changedMember.id,left:'2026-10-24'})
  await h.command('chargeback.approve',{chargebackId:changed.id,sha256:changedRow.sha256},{as:manager,status:409})
  const ownershipPending=await h.command('chargeback.prepare',{...proposed,amount:'0.10'})
  const ownershipRow=(await h.state(t.id)).work.chargebacks.proposals.find(p=>p.id===ownershipPending.id)
  await h.command('ownership.set',{propertyId:property.id,effectiveFrom:'2026-10-24',reason:'synthetic-terrace-57 changed current ownership',shares:[{ownerId:successor.id,percent:'100'}]})
  await h.command('chargeback.approve',{chargebackId:ownershipPending.id,sha256:ownershipRow.sha256},{as:manager,status:409})
  await h.command('ownership.set',{propertyId:property.id,effectiveFrom:'2026-10-25',reason:'synthetic-terrace-58 restored current ownership',shares:[{ownerId:owner.id,percent:'100'}]})
  if(inspect)await inspect({h,t,asset,property,manager,purchase,future,capture,approveBill,lot,chargebackSource:source,resident,owner})

  const races=await h.atOnce([1,2].map(()=>['/api/commands',{method:'POST',body:{command:'stock.consume',...stockUse,quantity:2}}]))
  assert.equal(races.filter(r=>r.status===200).length,1)
  assert.ok(races.every(r=>[200,409].includes(r.status)))
  assert.equal((await h.state(t.id)).work.stock.lots[0].used_cents,2000,'final part carries the remaining exact cents')
  const combined=await capture(41,'990',future.id)
  await h.command('bill.approve',{billId:combined.id,version:1},{as:manager,status:409})
  assert.ok((await(await h.request('/api/bills')).json()).bills.find(b=>b.id===combined.id).authority.reasons.some(r=>r.includes('cumulative invoices and parts')))
  await h.restart();assert.equal((await h.state(t.id)).work.chargebacks.costs.find(s=>s.id===source.id).recoveredCents,600);assert.equal((await h.state(t.id)).work.stock.lots[0].used_quantity,3)

  const archive=await(await h.request('/api/backup')).text();assert.match(archive,/tt_budget_changes/)
  const fresh=await installation({now:'2026-10-25T12:00:00Z',asyncDatabase:true})
  try{const form=new FormData();form.set('command','data.restore');form.set('confirm','RESTORE');form.set('backup',new File([archive],'budgets.rer'));const response=await fresh.request('/api/commands',{method:'POST',form});assert.equal(response.status,200,await response.clone().text());const restored=(await fresh.state(t.id)).work;assert.deepEqual(restored.categoryBudgets.map(b=>[b.kind,b.asset_id,b.amount_cents,b.spentCents]),(await h.state(t.id)).work.categoryBudgets.map(b=>[b.kind,b.asset_id,b.amount_cents,b.spentCents]));assert.deepEqual(restored.stock.lots,(await h.state(t.id)).work.stock.lots);assert.equal(restored.stock.uses.length,2);assert.equal(restored.chargebacks.proposals.filter(p=>p.approved_at).length,(await h.state(t.id)).work.chargebacks.proposals.filter(p=>p.approved_at).length);assert.equal(restored.chargebacks.costs.find(s=>s.id===source.id).recoveredCents,600);assert.equal(restored.budgetHistory.length,(await h.state(t.id)).work.budgetHistory.length)}finally{await fresh.close()}
 }finally{await h.close()}
}
