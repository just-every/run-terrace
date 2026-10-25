import assert from 'node:assert/strict'
import {installation,tenancyInput} from './api/harness.mjs'
/** WORK-014 category budgets through authenticated command, state and payable doors. Shares the bills registration. */
export async function journey({assets=false,inspect}={}) {
 const h=await installation({assets})
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
  if(inspect)await inspect({h,t,asset,property,manager})
  const archive=await(await h.request('/api/backup')).text();assert.match(archive,/tt_budget_changes/)
  const fresh=await installation()
  try{const form=new FormData();form.set('command','data.restore');form.set('confirm','RESTORE');form.set('backup',new File([archive],'budgets.rer'));const response=await fresh.request('/api/commands',{method:'POST',form});assert.equal(response.status,200,await response.clone().text());const restored=(await fresh.state(t.id)).work;assert.deepEqual(restored.categoryBudgets.map(b=>[b.kind,b.asset_id,b.amount_cents,b.spentCents]),(await h.state(t.id)).work.categoryBudgets.map(b=>[b.kind,b.asset_id,b.amount_cents,b.spentCents]));assert.equal(restored.budgetHistory.length,(await h.state(t.id)).work.budgetHistory.length)}finally{await fresh.close()}
 }finally{await h.close()}
}
