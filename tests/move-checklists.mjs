// PORT-006 operational checklists, through signed-in HTTP doors; financial gaps stay separate.
import assert from 'node:assert/strict'
import {installation,tenancyInput} from './api/harness.mjs'
const keys=['keys','meters','condition','possession','forwarding']
export async function journey({assets=false,inspect}={}) {
 const h=await installation({assets})
 try {
  const f=await h.command('portfolio.add',{name:'Checklist homes'}),p=await h.command('property.add',{portfolioId:f.id,name:'Cedar Court',address:'610 Cedar Street, Oakland, CA',kind:'duplex',timeZone:'America/Los_Angeles'})
  const unit=async identifier=>h.command('unit.add',{propertyId:p.id,identifier,bedrooms:'2',bathrooms:'1'})
  const a=await unit('A'),b=await unit('B')
  const lease=await h.command('tenancy.create',{...tenancyInput,unitId:a.id,startDate:'2026-10-15',endDate:'2027-10-14',cadence:'monthly',rent:'2400.00'})
  const read=async id=>(await h.state(id)).moveChecklists
  const payload={tenancyId:lease.id,kind:'move_in',moveDate:'2026-10-15',version:'0',leaseVersion:String((await h.state()).tenancies.find(t=>t.id===lease.id).version),reference:'Office handover sheet 610-A; Oct 15',...Object.fromEntries(keys.flatMap(k=>[[k+'State','recorded'],[k+'Notes',({keys:'Two front-door keys issued; one mailbox key',meters:'Electric E-610: 1240.75 kWh; water W-610: 92 m³',condition:'Kitchen cabinet scuffed at entry; inspection entry-610-A',possession:'Resident took possession October 15 at 10:30 local time',forwarding:'Not needed at move-in; current postal address confirmed'})[k]]]))}
  assert.deepEqual(await read(lease.id),[])
  await h.command('move.checklist',{...payload,metersNotes:''},{status:400})
  await h.command('move.checklist',{...payload,keysState:'verified_by_provider'},{status:400})
  await h.command('move.checklist',{...payload,moveDate:'2026-10-14'},{status:400})
  await h.command('move.checklist',{...payload,version:'-1'},{status:400})
  assert.deepEqual(await read(lease.id),[],'PORT-006 invalid reports do not create checklist evidence')
  const draft={...payload,keysState:'pending',keysNotes:'Awaiting mailbox key from office'}
  const first=await h.command('move.checklist',draft)
  assert.equal(first.complete,false)
  let rows=await read(lease.id)
  assert.equal(rows[0].items.keys.state,'pending');assert.equal(rows[0].version,1)
  await h.command('move.checklist',payload,{status:409})
  const ready={...payload,version:'1',leaseVersion:String((await h.state()).tenancies.find(t=>t.id===lease.id).version)}
  const native=await inspect?.({phase:'before-checklist',h,lease,payload:ready})
  if(!native)await h.command('move.checklist',ready)
  rows=await read(lease.id)
  assert.equal(rows.length,2);assert.equal(rows[0].complete,true);assert.equal(rows[0].version,2)
  assert.deepEqual(rows[1].items.keys,{state:'pending',notes:draft.keysNotes},'PORT-006 earlier handover evidence is retained')
  for(const k of keys)assert.deepEqual(rows[0].items[k],{state:'recorded',notes:payload[k+'Notes']})
  const saved=rows[0]
  await inspect?.({phase:'saved-checklist',h,lease,payload:ready,saved})
  await h.command('move.checklist',ready,{status:409})
  const member=await h.invite('member','preparer@example.test')
  await h.command('move.checklist',{...payload,version:'2'},{as:member,status:403})
  const other=await h.command('portfolio.add',{name:'Unrelated homes'})
  await h.stepUp()
  const operators=await(await h.request('/auth/operators')).json(),person=operators.find(o=>o.email==='preparer@example.test')
  await h.command('operator.role',{operatorId:person.id,role:'leasing',portfolioIds:[other.id]})
  await h.command('move.checklist',{...payload,version:'2'},{as:member,status:404})
  assert.equal((await h.request('/api/state?tenancy='+lease.id,{as:member})).status,404)
  await h.command('operator.role',{operatorId:person.id,role:'leasing',portfolioIds:[f.id]})
  await h.command('move.checklist',{...payload,version:'2',leaseVersion:String((await h.state()).tenancies.find(t=>t.id===lease.id).version),forwardingState:'not_applicable',forwardingNotes:'Resident receives mail at the occupied unit'},{as:member})
  assert.equal((await read(lease.id))[0].version,3,'PORT-006 existing scoped leasing responsibility can record the handover')
  const race={...payload,version:'3',leaseVersion:String((await h.state()).tenancies.find(t=>t.id===lease.id).version)}
  const raced=await Promise.all(['East office correction','West office correction'].map(reference=>h.request('/api/commands',{method:'POST',body:{command:'move.checklist',...race,reference}})))
  assert.deepEqual(raced.map(r=>r.status).sort(),[200,409],'PORT-006 concurrent corrections keep one reviewed successor')
  assert.equal((await read(lease.id)).filter(r=>r.kind==='move_in').length,4)
  const transfer=await h.command('tenancy.transfer',{tenancyId:lease.id,unitId:b.id,moveIn:'2026-11-16'})
  await h.command('move.checklist',{...payload,version:'3'},{status:409})
  assert.deepEqual(await read(transfer.id),[],'PORT-006 transfer destination never inherits source key or meter claims')
  const state=await h.state(lease.id),old=state.tenancies.find(t=>t.id===lease.id)
  const out={...payload,kind:'move_out',moveDate:'2026-11-15',version:'0',leaseVersion:String(old.version),reference:'Office return sheet 610-A; Nov 15',keysNotes:'Two door keys and mailbox key returned',metersNotes:'Electric E-610: 1400.25 kWh; water W-610: 101 m³',conditionNotes:'Kitchen scuff unchanged; move-out inspection exit-610-A',possessionNotes:'Vacant possession returned November 15 at 17:00 local time',forwardingNotes:'PO Box 610, Oakland, CA 94612'}
  await h.command('move.checklist',{...out,moveDate:'2026-11-14'},{status:409})
  const outNative=await inspect?.({phase:'before-out-checklist',h,lease,payload:out})
  if(!outNative)await h.command('move.checklist',out)
  await inspect?.({phase:'saved-out-checklist',h,lease,payload:out})
  assert.equal((await read(lease.id)).find(r=>r.kind==='move_out').complete,true)
  assert.equal(state.turnovers.length,1);assert.equal((await h.state(lease.id)).ledger.balanceCents,0,'PORT-006 a checklist posts no money or deposit disposition')
  const destination=(await h.state()).tenancies.find(t=>t.id===transfer.id)
  await h.command('move.checklist',{...out,tenancyId:transfer.id,moveDate:destination.end_date,leaseVersion:String(destination.version),reference:'Planned end-of-term return checklist'})
  await h.command('tenancy.end',{tenancyId:transfer.id,moveOut:'2026-12-01',reason:'Early departure'})
  const changed=(await read(transfer.id))[0]
  assert.equal(changed.needsReview,true);assert.equal(changed.complete,false,'PORT-006 a changed departure date cannot leave a prior checklist complete')
  const history=(await(await h.request('/api/history?tenancyId='+lease.id)).json()).rows
  assert.ok(history.some(r=>r.action==='move.checklist'&&r.source===out.reference&&r.tenancyId===lease.id))
  const access=await(await h.request('/api/resident-access?tenancyId='+lease.id)).json()
  assert.deepEqual((await(await h.request('/api/v1/leases/'+lease.id)).json()).data.moveChecklists,await read(lease.id))
  assert.deepEqual(access.moveChecklists,await read(lease.id),'PORT-006 resident access includes their operational evidence')
  const readable=Buffer.from(await(await h.request('/api/readable-export')).arrayBuffer()),files=new Map()
  for(let offset=0;readable.readUInt32LE(offset)===0x04034b50;){
   const size=readable.readUInt32LE(offset+18),nameSize=readable.readUInt16LE(offset+26),extra=readable.readUInt16LE(offset+28)
   const name=readable.subarray(offset+30,offset+30+nameSize).toString(),start=offset+30+nameSize+extra
   files.set(name,readable.subarray(start,start+size).toString());offset=start+size
  }
  const operationalCsv=files.get('tables/tt_move_checklists.csv')
  assert.ok(operationalCsv.includes(out.forwardingNotes)&&operationalCsv.includes(draft.keysNotes),'PORT-006 readable export contains original and corrected operational evidence')
  const archive=await(await h.request('/api/backup')).text(),fresh=await installation()
  try {
   await fresh.formCommand('data.restore',{confirm:'RESTORE',backup:new File([archive],'move-checklists.rer')})
   assert.deepEqual((await fresh.state(lease.id)).moveChecklists,await read(lease.id),'PORT-006 all revisions and provenance survive restore')
  }finally{await fresh.close()}
  const expired=await h.command('tenancy.create',{...tenancyInput,startDate:'1990-01-15',endDate:'1991-01-14',tenantEmail:'former@example.test'})
  await h.command('move.checklist',{...payload,tenancyId:expired.id,moveDate:'1990-01-15',leaseVersion:String((await h.state()).tenancies.find(t=>t.id===expired.id).version)})
  const expiredRows=await read(expired.id),expiredIds=expiredRows.map(r=>r.id)
  assert.equal(expiredRows.length,1)
  const request=await h.command('privacy.request',{tenancyId:expired.id,kind:'erase',source:'Former resident erasure request'})
  const reviewed=await h.command('privacy.review',{tenancyId:expired.id,requestId:request.id})
  await h.command('tenancy.erase',{tenancyId:expired.id,requestId:request.id,fingerprint:reviewed.review.fingerprint,confirm:'former@example.test'})
  const after=await(await h.request('/api/backup')).text()
  const exportedRows=after.trim().split('\n').map(l=>JSON.parse(l)).filter(r=>r.kind==='part').flatMap(r=>r.items).filter(item=>item.kind==='row').map(item=>item.row)
  assert.ok(!exportedRows.some(r=>expiredIds.includes(r.id)),'PORT-006 erasure removes the expired handover snapshots from the public backup')
  const restored=await installation()
  try{
   await restored.formCommand('data.restore',{confirm:'RESTORE',backup:new File([after],'after-erasure.rer')})
   assert.equal((await restored.request('/api/state?tenancy='+expired.id)).status,404)
   assert.deepEqual((await restored.state(lease.id)).moveChecklists,await read(lease.id),'PORT-006 erasure preserves other leases’ operational evidence')
  }finally{await restored.close()}
  await reconcileRent()
 }finally{await h.close()}
}

// Rent is reviewed separately from operational handover evidence and deposit disposition.
async function reconcileRent(){
 const h=await installation({now:'2027-01-02T12:00:00Z'})
 try{
  const f=await h.command('portfolio.add',{name:'Proration homes'}),p=await h.command('property.add',{portfolioId:f.id,name:'Willow Court',address:tenancyInput.address,kind:'duplex',timeZone:'America/Los_Angeles'})
  const unit=async identifier=>h.command('unit.add',{propertyId:p.id,identifier,bedrooms:2,bathrooms:1})
  const a=await unit('A'),b=await unit('B')
  const source=await h.command('tenancy.create',{...tenancyInput,unitId:a.id,startDate:'2026-10-15',endDate:'2027-10-14',rent:'2400.00',cadence:'monthly'})
  const ledger=async id=>(await h.state(id)).ledger
  const rent=async(id,starts)=>h.command('term.add',{tenancyId:id,kind:'rent',description:'Recorded monthly rent',amount:'2400.00',starts,ends:'2027-10-14'})
  const run=async month=>{
   const preview=await h.command('charges.preview',{month})
   await h.command('charges.post',{month,fingerprint:preview.fingerprint})
   return preview
  }
  await rent(source.id,'2026-10-15')
  await run('2026-10');await run('2026-11')
  let old=await ledger(source.id)
  assert.deepEqual(old.charges.map(q=>[q.due_date,q.amount_cents]),[['2026-10-15',131613],['2026-11-01',240000]],'A mid-month move-in rounds 17 calendar days once; rent posted before transfer retains its original amount')
  const november=old.charges.find(q=>q.due_date==='2026-11-01')
  const moved=await h.command('tenancy.transfer',{tenancyId:source.id,unitId:b.id,moveIn:'2026-11-16'})
  await rent(moved.id,'2026-11-16')
  const transfer=await run('2026-11')
  assert.deepEqual(transfer.lines.map(l=>[l.tenancyId,l.coveredDays,l.amountCents,l.posted]).sort(),[[source.id,15,120000,true],[moved.id,15,120000,false]].sort(),'The transfer preview splits November at the inclusive move-out day and identifies the already-posted source charge')
  old=await ledger(source.id)
  assert.equal(old.charges.find(q=>q.id===november.id).amount_cents,240000,'A lease transition never silently rewrites an issued charge')
  const sourceCorrection={chargeId:november.id,amount:'1200.00',reason:'Reviewed transfer proration: source possession ended November 15; retain the original charge.'}
  const member=await h.invite('member',tenancyInput.ownerEmail)
  await h.command('rent.adjust',sourceCorrection,{as:member,status:403})
  assert.equal((await ledger(source.id)).adjustments.length,0,'An unauthorized correction changes no balance')
  await h.command('rent.adjust',sourceCorrection)
  await run('2026-12')
  const december=(await ledger(moved.id)).charges.find(q=>q.due_date==='2026-12-01')
  assert.equal(december.amount_cents,240000)
  await h.command('tenancy.end',{tenancyId:moved.id,moveOut:'2026-12-01',reason:'Possession returned after one December day'})
  const departure=await run('2026-12')
  assert.deepEqual(departure.lines.map(l=>[l.tenancyId,l.coveredDays,l.amountCents,l.posted]),[[moved.id,1,7742,true]],'Early move-out previews one of 31 days without duplicating or silently reducing the posted charge')
  await h.command('rent.adjust',{chargeId:december.id,amount:'2322.58',reason:'Reviewed early move-out: one December day is 77.42; retain the posted original.'})
  await h.command('rent.adjust',{...sourceCorrection,amount:'1200.01'},{status:409})
  await h.command('rent.adjust',{chargeId:december.id,amount:'77.43',reason:'Would reduce more than the remaining rent'},{status:409})
  const receipt=async(q,amount,reference)=>h.command('rent.receipt',{chargeId:q.id,amount,receivedDate:'2026-12-31',method:'other',reference})
  old=await ledger(source.id)
  await receipt(old.charges.find(q=>q.due_date==='2026-10-15'),'1316.13','synthetic-terrace-rent-1')
  await receipt(november,'600.00','synthetic-terrace-rent-2')
  await receipt((await ledger(moved.id)).charges.find(q=>q.due_date==='2026-11-16'),'1200.00','synthetic-terrace-rent-3')
  const expected=await Promise.all([ledger(source.id),ledger(moved.id)])
  assert.deepEqual(expected.map(l=>l.balanceCents),[60000,7742],'Unpaid source rent stays with its original lease; the destination keeps its own corrected balance')
  assert.deepEqual(expected.map(l=>l.adjustments.map(a=>a.amount_cents)),[[120000],[232258]],'Both reviewed corrections remain separately inspectable')
  for(const [id,balance]of [[source.id,'600.00'],[moved.id,'77.42']]){
   const response=await h.request('/api/statement?tenancyId='+id+'&from=2026-10-01&to=2027-01-02')
   assert.equal(response.status,200)
   assert.ok((await response.text()).includes('"Closing receivable USD","'+balance+'"'),'Downloaded statements reconcile each lease independently')
  }
  await h.restart()
  assert.deepEqual(await Promise.all([ledger(source.id),ledger(moved.id)]),expected,'Restart preserves original charges, explicit corrections, receipts and separate balances')
 }finally{await h.close()}
}
