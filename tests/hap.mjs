import {hapCadenceFlow} from './hap-cadences.mjs'
import {hapPortalFlow} from './hap-portals.mjs'
import {hapErasureFlow} from './hap-erasure.mjs'
import {remittanceFlow} from './hap-remittances.mjs'
import {hapChangeFlow} from './hap-changes.mjs'
import {hapScenarioFlow} from './hap-scenarios.mjs'
import assert from 'node:assert/strict'
import {installation,tenancyInput} from './api/harness.mjs'
import {editArchive} from './archive-edit.mjs'
import {leaseFields} from './leases.mjs'
export async function journey({assets=false,inspect}={}){
 const h=await installation({assets,bufferedTransport:true,now:'2026-10-26T12:00:00.000Z'})
 try{
  const manager=await h.invite('admin','hap-manager@example.test'),leases=[]
  for(const [i,resident,pha] of [[1,'300.01','700.00'],[2,'200.00','800.01']]){
   const f=await h.command('portfolio.add',{name:'HAP '+i}),p=await h.command('property.add',{portfolioId:f.id,name:'Voucher property '+i,address:i+' Synthetic Terrace Road',kind:'duplex',timeZone:'America/Los_Angeles'}),u=await h.command('unit.add',{propertyId:p.id,identifier:'A',bedrooms:2,bathrooms:1}),o=await h.command('owner.add',{kind:'individual',legalName:'Synthetic owner '+i,email:'hap-owner'+i+'@example.test',mailingAddress:i+' Synthetic Terrace Road'})
   await h.command('ownership.set',{propertyId:p.id,effectiveFrom:'2026-01-01',reason:'synthetic-terrace-101',shares:[{ownerId:o.id,percent:'100'}]})
   const t=await h.command('tenancy.create',{...tenancyInput,unitId:u.id,tenantName:'synthetic-terrace-'+(809+i),tenantEmail:'hap'+i+'@example.test',startDate:'2026-07-01',endDate:'2027-06-30',cadence:'monthly',rent:'1000.01'}),signed=leaseFields(t.id,'2026-07-01','1000.01','0','0','synthetic-terrace-'+(110+i))
   signed.terms=signed.terms.filter(x=>x.kind==='rent');Object.assign(signed.obligations.find(x=>x.kind==='hap'),{details:'Tenant-based HAP contract',housingAuthority:'Synthetic Housing Authority',reference:'synthetic-terrace-'+(120+i),tenantPortion:resident,hapPortion:pha})
   const v=await h.command('lease.prepare',signed),preview=await h.command('lease.preview',{leaseId:v.leaseId,month:'2026-07'})
   assert.deepEqual(preview.lines.map(x=>x.amountCents),[Math.round(Number(resident)*100),Math.round(Number(pha)*100)])
   await h.command('lease.approve',{leaseId:v.leaseId,month:'2026-07',fingerprint:'stale'},{as:manager,status:409})
   await h.command('lease.approve',{leaseId:v.leaseId,month:'2026-07',fingerprint:preview.fingerprint},{as:manager})
   leases.push({t,p,o,f,v,signed})
  }
  const run=await h.command('charges.preview',{month:'2026-07'});assert.equal(run.newLines,4)
  if(inspect)await inspect({h,leases,phase:'preview',run})
  await h.command('charges.post',{month:'2026-07',fingerprint:run.fingerprint})
  assert.equal((await h.command('charges.preview',{month:'2026-07'})).newLines,0)
  await h.command('charges.post',{month:'2026-07',fingerprint:(await h.command('charges.preview',{month:'2026-07'})).fingerprint})
  for(const x of leases){
   const state=await h.state(x.t.id),q=state.ledger.charges[0],hap=state.ledger.hapCharges[0]
   assert.equal(state.ledger.charges.length,1);assert.equal(state.ledger.hapCharges.length,1)
   assert.equal(state.ledger.balanceCents+state.ledger.hapBalanceCents,100001)
   assert.equal(hap.lease_version_id,x.v.leaseId);assert.equal(hap.source_clause,x.signed.obligations.find(x=>x.kind==='hap').sourceClause)
   await h.command('rent.receipt',{chargeId:hap.id,amount:'1.00',receivedDate:'2026-07-02',reference:'synthetic-terrace-130'},{status:404})
   await h.command('latefee.policy',{tenancyId:x.t.id,chargeId:hap.id,version:0,reference:'synthetic-terrace-131',terms:{fullUnpaidDays:0,feeCents:1000,capCents:1000,weekendRule:'calendar',excludeTimely:true}},{status:404})
   await h.command('rent.receipt',{chargeId:q.id,amount:(q.amount_cents/100).toFixed(2),receivedDate:'2026-07-02',reference:'synthetic-terrace-'+q.id})
   const paid=(await h.state(x.t.id)).ledger;assert.equal(paid.balanceCents,0);assert.equal(paid.hapBalanceCents,hap.amount_cents,'PHA arrears never become resident arrears')
   const j=await(await h.request('/api/journal?propertyId='+x.p.id)).json();assert.equal(j.debitCents,j.creditCents);assert.ok(j.entries.filter(e=>e.source_kind==='hap_charge').every(e=>e.owner_key===x.o.id))
   const report=await(await h.request('/api/delinquency?asOf=2026-10-01&tenancyId='+x.t.id)).json();assert.equal(report.rows[0].balanceCents,0);assert.equal(report.rows[0].phaAging.overdueCents,hap.amount_cents)
   const csv=await(await h.request('/api/delinquency?asOf=2026-10-01&tenancyId='+x.t.id+'&format=csv')).text();assert.ok(csv.includes(hap.id)&&csv.includes('Separate housing authority receivables'))
  }
  await remittanceFlow(h,leases,{inspect})
  await hapChangeFlow(h,leases,manager,{inspect})
  await hapPortalFlow(h,leases,{inspect})
  const comparisons=await hapScenarioFlow(h,leases);if(inspect)await inspect({h,leases,phase:'payer-scenarios',comparisons})
  await hapCadenceFlow(h,leases,manager)
  // A fully subsidized partial month posts no zero or phantom resident charge.
  const zunit=await h.command('unit.add',{propertyId:leases[1].p.id,identifier:'B',bedrooms:1,bathrooms:1}),z=await h.command('tenancy.create',{...tenancyInput,unitId:zunit.id,tenantEmail:'hap-zero@example.test',startDate:'2026-07-16',endDate:'2027-06-30',cadence:'monthly',rent:'1000.01'})
  const zs=leaseFields(z.id,'2026-07-16','1000.01','0','0','synthetic-terrace-140');zs.terms=zs.terms.filter(x=>x.kind==='rent');Object.assign(zs.obligations.find(x=>x.kind==='hap'),{details:'Fully subsidized',housingAuthority:'Synthetic Housing Authority',reference:'synthetic-terrace-141',tenantPortion:'0',hapPortion:'1000.01',ends:'2026-07-31'})
  const zv=await h.command('lease.prepare',zs),zr=await h.command('lease.preview',{leaseId:zv.leaseId,month:'2026-07'});assert.deepEqual(zr.lines.map(x=>[x.kind,x.amountCents]),[['hap',51613]])
  await h.command('lease.approve',{leaseId:zv.leaseId,month:'2026-07',fingerprint:zr.fingerprint},{as:manager});const july=await h.command('charges.preview',{month:'2026-07'});await h.command('charges.post',{month:'2026-07',fingerprint:july.fingerprint});const zero=(await h.state(z.id)).ledger;assert.equal(zero.charges.length,0);assert.equal(zero.hapBalanceCents,51613)
  const za=leaseFields(z.id,'2026-07-20','1000.01','0','0','synthetic-terrace-142');za.terms=za.terms.filter(x=>x.kind==='rent');const amendment=await h.command('lease.prepare',za);await h.command('lease.preview',{leaseId:amendment.leaseId,month:'2026-07'},{status:409})
  const uncovered=await h.command('charges.preview',{month:'2026-08'},{status:409});assert.equal(uncovered.error,'hap_coverage','an expired HAP obligation cannot silently become resident rent')
  await h.stepUp();await h.command('operator.invite',{displayName:'Scoped bookkeeper',email:'hap-bookkeeper@example.test',role:'bookkeeper',['portfolio:'+leases[0].f.id]:'1'});const scoped=await h.accept('hap-bookkeeper@example.test')
  assert.equal((await h.request('/api/state?tenancy='+leases[1].t.id,{as:scoped})).status,404)
  const visible=await h.command('charges.preview',{month:'2026-07'},{as:scoped});assert.ok(visible.lines.every(l=>l.tenancyId===leases[0].t.id))
  const backup=await(await h.request('/api/backup')).text(),fresh=await installation({bufferedTransport:true})
  try{const invalid=await editArchive(backup,(table,row)=>{if(table==='tt_hap_charges')row.amount_cents+=1});await fresh.formCommand('data.restore',{confirm:'RESTORE',backup:new File([invalid],'invalid-hap.rer')},{status:400});assert.equal((await fresh.state()).tenancies.length,0);await fresh.formCommand('data.restore',{confirm:'RESTORE',backup:new File([backup],'hap.rer')});for(const x of leases){const restored=(await fresh.state(x.t.id)).ledger;assert.deepEqual(restored.hapCharges,(await h.state(x.t.id)).ledger.hapCharges);assert.equal(restored.balanceCents,(await h.state(x.t.id)).ledger.balanceCents);assert.equal(restored.hapBalanceCents,(await h.state(x.t.id)).ledger.hapBalanceCents)}}finally{await fresh.close()}
  await hapErasureFlow(backup,leases)
  await h.restart();assert.equal((await h.command('charges.preview',{month:'2026-07'})).newLines,0)
  if(inspect)await inspect({h,leases,phase:'posted',run})
 }finally{await h.close()}
}
