import assert from 'node:assert/strict'

/** Folded into the existing PAY-013 journey, using its two signed posted leases. */
export async function remittanceFlow(h,leases,{inspect}={}) {
 const [first,second]=leases,states=await Promise.all(leases.map(x=>h.state(x.t.id))),charges=states.map(s=>s.ledger.hapCharges[0]),payer=charges[0].payer
 const source=async(n,kind='hap')=>h.command('document.upload',{tenancyId:first.t.id,kind,title:'synthetic-terrace-'+n,source:'synthetic-terrace-'+n,file:{name:'synthetic-terrace-'+n+'.txt',type:'text/plain',base64:Buffer.from('synthetic-terrace-'+n).toString('base64')}})
 const detail=async(opts={})=>{
  const response=await h.request('/api/hap-remittances?tenancyId='+first.t.id,opts)
  assert.equal(response.status,200)
  return (await response.json()).remittances
 }
 const journal=async(x)=>(await(await h.request('/api/journal?propertyId='+x.p.id)).json()).entries.filter(e=>e.source_kind==='hap_receipt')
 const before=states.map(s=>s.ledger.hapBalanceCents),resident=states.map(s=>s.ledger.balanceCents),pendingSource=await source(170),input={payerName:payer,method:'ach',amount:'30.20',currency:'USD',receivedDate:'2026-09-01',reference:'synthetic-terrace-171',state:'pending',sourceDocumentVersionId:pendingSource.versionId}
 await h.command('hap.remittance.record',{...input,sourceDocumentVersionId:'https://example.test/synthetic-terrace-170'},{status:404})
 await h.command('hap.remittance.record',{...input,currency:'AUD'},{status:409})
 const wrongClass=await source(172,'notice')
 await h.command('hap.remittance.record',{...input,sourceDocumentVersionId:wrongClass.versionId},{status:409})
 const pending=await h.command('hap.remittance.record',input)
 await h.command('hap.remittance.record',input,{status:409})
 await h.command('hap.remittance.record',{...input,reference:'synthetic-terrace-173'},{status:409})
 const reserved=await h.command('hap.remittance.allocate',{remittanceId:pending.id,version:1,reference:'synthetic-terrace-174',allocations:[{chargeId:charges[0].id,amount:'10.01'},{chargeId:charges[1].id,amount:'20.02'}]})
 assert.equal(reserved.heldCents,17)
 for(const [i,x] of leases.entries()) {
  const ledger=(await h.state(x.t.id)).ledger
  assert.equal(ledger.hapBalanceCents,before[i],'pending allocations never settle a PHA receivable')
  assert.equal((await journal(x)).length,0,'pending funds never journal cash')
 }
 await h.command('hap.remittance.outcome',{remittanceId:pending.id,version:1,state:'received',on:'2026-09-02',reference:'synthetic-terrace-175'},{status:409})
 const failed=await h.command('hap.remittance.outcome',{remittanceId:pending.id,version:reserved.version,state:'failed',on:'2026-09-02',reference:'synthetic-terrace-175'})
 assert.equal(failed.state,'failed')
 await h.command('hap.remittance.outcome',{remittanceId:pending.id,version:failed.version,state:'received',on:'2026-09-03',reference:'synthetic-terrace-176'},{status:409})
 for(const x of leases)assert.equal((await journal(x)).length,0,'a failed attempt is never inferred settled')

 // A dated ownership change must not move the old receivable's beneficiary.
 const successor=await h.command('owner.add',{kind:'individual',legalName:'synthetic-terrace-177',email:'synthetic-terrace-177@example.test',mailingAddress:'synthetic-terrace-177'})
 await h.command('ownership.set',{propertyId:first.p.id,effectiveFrom:'2026-08-01',reason:'synthetic-terrace-178',shares:[{ownerId:successor.id,percent:'100'}]})
 const receivedSource=await source(179),received=await h.command('hap.remittance.record',{...input,method:'check',amount:'300.20',reference:'synthetic-terrace-180',state:'received',sourceDocumentVersionId:receivedSource.versionId})
 const paid=await h.command('hap.remittance.allocate',{remittanceId:received.id,version:received.version,reference:'synthetic-terrace-181',allocations:[{chargeId:charges[0].id,amount:'100.01'},{chargeId:charges[1].id,amount:'200.02'}]})
 assert.equal(paid.heldCents,17)
 const lump=(await detail()).find(r=>r.id===received.id)
 assert.equal(lump.held_cents,17);assert.equal(lump.allocations.length,2)
 for(const [i,x] of leases.entries()) {
  const ledger=(await h.state(x.t.id)).ledger,entries=await journal(x)
  assert.equal(ledger.hapBalanceCents,before[i]-[10001,20002][i])
  assert.equal(ledger.balanceCents,resident[i],'PHA cash never pays resident rent')
  assert.ok(entries.length>0&&entries.every(e=>e.owner_key===x.o.id),'receipts use each charge original owner')
  assert.equal(entries.reduce((n,e)=>n+e.lines.filter(l=>l.account==='cash').reduce((s,l)=>s+l.debit,0),0),[10001,20002][i])
 }
 await h.command('hap.remittance.allocate',{remittanceId:received.id,version:paid.version,reference:'synthetic-terrace-181',allocations:[{chargeId:charges[0].id,amount:'0.01'}]},{status:409})
 await h.command('hap.remittance.allocate',{remittanceId:received.id,version:paid.version,reference:'synthetic-terrace-182',allocations:[{chargeId:charges[0].id,amount:'0.01'}]},{status:409})

 await h.stepUp()
 await h.command('operator.invite',{displayName:'synthetic-terrace-183',email:'synthetic-terrace-183@example.test',role:'bookkeeper',['portfolio:'+first.f.id]:'1'})
 const scoped=await h.accept('synthetic-terrace-183@example.test')
 assert.ok(!(await detail({as:scoped})).some(r=>r.id===received.id),'partial scope cannot reveal the lump sum or other households')
 await h.command('hap.remittance.allocate',{remittanceId:received.id,version:paid.version,reference:'synthetic-terrace-184',allocations:[{chargeId:charges[0].id,amount:'0.01'}]},{as:scoped,status:404})
 const scopedSource=await source(185),scopedRemit=await h.command('hap.remittance.record',{...input,amount:'1.00',reference:'synthetic-terrace-186',sourceDocumentVersionId:scopedSource.versionId},{as:scoped})
 await h.command('hap.remittance.allocate',{remittanceId:scopedRemit.id,version:1,reference:'synthetic-terrace-187',allocations:[{chargeId:charges[0].id,amount:'0.50'},{chargeId:charges[1].id,amount:'0.50'}]},{as:scoped,status:404})
 assert.equal((await detail()).find(r=>r.id===scopedRemit.id).allocations.length,0,'scoped refusal leaves no partial allocation')

 const otherSource=await source(188),other=await h.command('hap.remittance.record',{...input,payerName:'synthetic-terrace-189',amount:'1.00',reference:'synthetic-terrace-190',sourceDocumentVersionId:otherSource.versionId})
 await h.command('hap.remittance.allocate',{remittanceId:other.id,version:1,reference:'synthetic-terrace-191',allocations:[{chargeId:charges[0].id,amount:'1.00'}]},{status:409})
 await h.command('hap.remittance.allocate',{remittanceId:scopedRemit.id,version:1,reference:'synthetic-terrace-192',allocations:[{chargeId:charges[0].id,amount:'1.01'}]},{status:409})
 await h.command('hap.remittance.allocate',{remittanceId:scopedRemit.id,version:1,reference:'synthetic-terrace-193',allocations:[{chargeId:charges[0].id,amount:'0.50'},{chargeId:charges[0].id,amount:'0.50'}]},{status:409})
 const racing=await h.atOnce([194,195].map(n=>['/api/commands',{method:'POST',body:{command:'hap.remittance.allocate',remittanceId:scopedRemit.id,version:1,reference:'synthetic-terrace-'+n,allocations:[{chargeId:charges[0].id,amount:'1.00'}]}}]))
 assert.deepEqual(racing.map(r=>r.status).sort(),[200,409],'one reviewed remittance version wins concurrent allocation')
 const ready=(await detail()).find(r=>r.id===scopedRemit.id)
 const settled=await h.command('hap.remittance.outcome',{remittanceId:scopedRemit.id,version:ready.version,state:'received',on:'2026-09-03',reference:'synthetic-terrace-196'})
 assert.equal(settled.state,'received')
 assert.equal((await h.state(first.t.id)).ledger.hapBalanceCents,before[0]-10101)
 await h.command('hap.remittance.outcome',{remittanceId:scopedRemit.id,version:ready.version,state:'received',on:'2026-09-03',reference:'synthetic-terrace-196'},{status:409})
 const excessSource=await source(197),excess=await h.command('hap.remittance.record',{...input,amount:'10000.00',reference:'synthetic-terrace-198',sourceDocumentVersionId:excessSource.versionId})
 await h.command('hap.remittance.allocate',{remittanceId:excess.id,version:1,reference:'synthetic-terrace-199',allocations:[{chargeId:charges[0].id,amount:'10000.00'}]},{status:409})
 const snapshot=await detail()
 const history=await(await h.request('/api/history?action=read:hap-remittances')).json();assert.ok(history.rows.some(r=>r.action==='read:hap-remittances'&&r.tenancyId===first.t.id),'documentary remittance reads retain attributable scoped history')
 await h.restart()
 assert.deepEqual(await detail(),snapshot,'restart retains explicit outcomes and immutable allocations')
 await inspect?.({h,leases,phase:'remittances',remittance:lump})
 return {received,paid,pending,failed,scopedRemit}
}
