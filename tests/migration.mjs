import assert from 'node:assert/strict'
import {installation} from './api/harness.mjs'
import {migrationFixture,recount} from './migration-fixture.mjs'
export async function journey({inspect,assets=false}={}){
 const h=await installation({assets,now:'2026-10-28T12:00:00.000Z'})
 try{
  const m=recount(migrationFixture()),preview=source=>h.command('migration.preview',{manifest:JSON.stringify(source)}),apply=(source,review)=>h.command('migration.apply',{manifest:JSON.stringify(source),fingerprint:review.migrationPreview.fingerprint})
  const productCounts=async()=>{const names=(await h.db.prepare("SELECT name FROM sqlite_schema WHERE type='table' ORDER BY name").all()).results.map(r=>r.name).filter(n=>/^(tt|ik)_[a-z0-9_]+$/.test(n));const batches=[];for(let i=0;i<names.length;i+=5)batches.push(h.db.prepare(names.slice(i,i+5).map(n=>"SELECT '"+n+"' AS name,count(*) AS n FROM "+n).join(' UNION ALL ')));return (await h.db.batch(batches)).flatMap(r=>r.results)}
  const countsBefore=await productCounts()
  const before=await h.state(),missing=structuredClone(m);missing.records=missing.records.filter(r=>r.kind!=='deposit'||r.ref!=='synthetic-terrace-12');recount(missing)
  const duplicate=structuredClone(m.records.find(r=>r.kind==='household'));duplicate.ref='synthetic-terrace-30';missing.records.push(duplicate,{kind:'lease',ref:'synthetic-terrace-31',data:{leaseType:'commercial'}});recount(missing);missing.resolutions=[]
  const held=await preview(missing),problems=held.migrationPreview.issues
  assert.ok(problems.some(i=>i.key==='deposit:lease:synthetic-terrace-8'&&!i.resolved),'missing deposit is a held record')
  assert.ok(problems.some(i=>i.key==='exclude:household:synthetic-terrace-30'&&!i.resolved),'duplicate household is held')
  assert.ok(problems.some(i=>i.key==='w9:vendor:synthetic-terrace-19'&&!i.resolved),'missing W-9 cannot silently qualify a vendor')
  assert.ok(problems.some(i=>i.key==='exclude:lease:synthetic-terrace-31'&&!i.resolved),'commercial lease never becomes residential')
  assert.equal(held.migrationPreview.canApply,false)
  assert.deepEqual(await h.state(),before,'preview changes no native state')
  assert.deepEqual(await productCounts(),countsBefore,'preview writes no product or import rows')
  assert.equal((await h.db.prepare('SELECT count(*) AS n FROM tt_migrations').first()).n,0,'preview creates no durable job')
  await h.command('migration.apply',{manifest:JSON.stringify(missing),fingerprint:held.migrationPreview.fingerprint},{status:409})
  const missingForward=structuredClone(m);missingForward.records=missingForward.records.filter(r=>r.kind!=='vendor_ytd');recount(missingForward)
  assert.ok((await preview(missingForward)).migrationPreview.issues.some(i=>i.key==='vendor-ytd:vendor:synthetic-terrace-19'))
  const counts=structuredClone(m);counts.inventory.lease=3
  assert.ok((await preview(counts)).migrationPreview.issues.some(i=>i.key==='count:lease'&&!i.resolved))
  const mismatch=structuredClone(m);mismatch.trialBalance[0].balanceCents+=100
  const different=await preview(mismatch);assert.equal(different.migrationPreview.canApply,false)
  assert.equal(different.migrationPreview.tieOut[0].differenceCents,-100)
  mismatch.trialBalance[0].exception='Source trial includes an identified 100 cent unposted bank correction retained for review.'
  const named=await preview(mismatch);assert.equal(named.migrationPreview.canApply,true);assert.equal(named.migrationPreview.completeSwitch,false)
  assert.equal(named.migrationPreview.tieOut[0].exception,mismatch.trialBalance[0].exception)
  const resolved=structuredClone(mismatch)
  resolved.records.push(duplicate,{kind:'lease',ref:'synthetic-terrace-31',data:{leaseType:'commercial'}});recount(resolved)
  resolved.resolutions.push({key:'exclude:household:synthetic-terrace-30',action:'exclude',reason:'Duplicate of the retained household; its leases map to that household.'},{key:'exclude:lease:synthetic-terrace-31',action:'exclude',reason:'Commercial source stays in its specialist system under BOUND-004.'})
  const review=await preview(resolved),report=review.migrationPreview
  assert.equal(report.canApply,true,JSON.stringify(report.issues))
  assert.deepEqual(report.counts.lease,{source:3,imported:2,excluded:1})
  assert.deepEqual(report.counts.household,{source:3,imported:2,excluded:1})
  assert.equal(report.sourceCount,report.importedCount+report.excludedCount)
  assert.deepEqual(report.tieOut.map(r=>r.differenceCents),[-100,...Array(10).fill(0)])
  assert.equal(report.tieOut[0].exception,mismatch.trialBalance[0].exception)
  const changed=structuredClone(resolved);changed.records.find(r=>r.kind==='work').data.description='Changed source work'
  await h.command('migration.apply',{manifest:JSON.stringify(changed),fingerprint:report.fingerprint},{status:409})
  const manager=await h.invite('admin','migration-manager'+String.fromCharCode(64)+'example.test')
  for(const command of ['migration.preview','migration.apply','migration.journal'])await h.command(command,{manifest:JSON.stringify(resolved),fingerprint:report.fingerprint},{as:manager,status:403})
  if(inspect)await inspect({h,manifest:resolved,review,phase:'preview'})
  const applied=await apply(resolved,review),migrationId=applied.migration.id
  assert.equal(applied.replayed,false)
  const state=await h.state(),leases=report.records.filter(r=>r.kind==='lease'&&r.disposition==='imported')
  assert.deepEqual(state.tenancies.map(t=>t.id).sort(),leases.map(t=>t.targetId).sort(),'exactly the two reviewed residential leases load')
  assert.equal((await h.db.prepare('SELECT count(*) AS n FROM tt_properties').first()).n,2)
  assert.equal((await h.db.prepare('SELECT count(*) AS n FROM tt_owners').first()).n,2)
  const journal=await h.command('migration.journal',{migrationId})
  assert.equal(journal.migration.original,JSON.stringify(resolved),'exact original bytes are retained')
  assert.deepEqual(journal.migration.report.tieOut,report.tieOut,'account tie-out is retained with the manifest')
  assert.deepEqual(journal.migration.report.issues,report.issues,'named exception dispositions survive approval')
  const rows=await h.db.prepare('SELECT * FROM tt_migration_records WHERE migration_id=?').bind(migrationId).all()
  assert.equal(rows.results.length,report.sourceCount)
  const native=await(await h.request('/api/journal')).json()
  for(const expected of report.tieOut){const property=report.records.find(r=>r.kind==='property'&&r.ref===expected.propertyRef).targetId,owner=report.records.find(r=>r.kind==='owner'&&r.ref===expected.ownerRef).targetId
   const actual=native.entries.filter(e=>e.property_id===property&&e.owner_key===owner&&e.fund===expected.fund).flatMap(e=>e.lines).filter(l=>l.account===expected.account).reduce((n,l)=>n+l.debit-l.credit,0)
   assert.equal(actual,expected.terraceCents,'native opening '+expected.propertyRef+' '+expected.fund+' '+expected.account)
  }
  assert.equal((await h.state(leases[0].targetId)).ledger.balanceCents,12000)
  assert.equal((await h.state(leases[1].targetId)).ledger.balanceCents,2500)
  const docs=await(await h.request('/api/documents')).json()
  assert.equal(docs.documents.filter(d=>d.kind==='lease').length,2)
  for(const d of docs.documents){const bytes=Buffer.from(await(await h.request(d.url)).arrayBuffer());assert.ok(bytes.toString().startsWith('Synthetic retained original'))}
  const nativeUnits=state.portfolios.flatMap(p=>p.properties.flatMap(x=>x.units))
  assert.equal(nativeUnits.length,3,'vacant units migrate independently of leases')
  assert.equal(nativeUnits.find(u=>u.identifier==='B').bedrooms,3)
  assert.deepEqual(state.portfolios.flatMap(p=>p.properties).map(p=>p.address).sort(),['3 Synthetic Road','4 Synthetic Road'],'field mapping reaches native properties')
  assert.deepEqual(journal.migration.balanceForwards.filter(x=>x.kind==='vendor_ytd').map(x=>x.reportable_cents),[120000])
  assert.deepEqual(journal.migration.balanceForwards.filter(x=>x.kind==='owner_ytd').map(x=>[x.income_cents,x.expense_cents]),[[1000000,120000],[1000000,120000]])
  assert.equal(journal.migration.vendorDetails[0].dba,'Synthetic trade');assert.equal(journal.migration.vendorDetails[0].tin_status,'missing');assert.equal(journal.migration.vendorDetails[0].eligible_1099,1);assert.equal(journal.migration.vendorDetails[0].payment_method,'check')
  const nativeDeposit=ref=>{const record=report.records.find(r=>r.kind==='deposit'&&r.ref===ref);assert.ok(record,'review retains the deposit link');const entry=native.entries.find(j=>j.id===record.targetId&&j.source_kind==='deposit');assert.ok(entry,'native deposit journal exists for '+ref);return entry}
  const firstDeposit=nativeDeposit('synthetic-terrace-11'),secondDeposit=nativeDeposit('synthetic-terrace-12')
  assert.equal(firstDeposit.tenancy_id,leases[0].targetId,'first deposit links to its native lease')
  assert.equal(firstDeposit.lines.find(l=>l.account==='deposit_liability').credit,50000,'first native deposit is 50000 cents independently of the opening aggregate')
  assert.equal(secondDeposit.tenancy_id,leases[1].targetId,'second deposit links to its native lease')
  assert.equal(secondDeposit.lines.find(l=>l.account==='deposit_liability').credit,20000,'second native deposit is 20000 cents independently of the opening aggregate')
  assert.equal(native.trialBalance.find(a=>a.code==='lease_income').creditCents-native.trialBalance.find(a=>a.code==='lease_income').debitCents,0,'historical unpaid charges do not re-post income')
  const first=await h.state(leases[0].targetId),second=await h.state(leases[1].targetId)
  assert.equal(first.household.members.find(m=>m.role==='occupant').name,'Synthetic occupant 5')
  assert.equal(first.work.jobs[0].title,'Source active repair')
  assert.equal(first.work.jobs[0].state,'pending','source progress grants no native spending or sending approval')
  assert.equal(first.work.vendors[0].w9,'missing')
  assert.ok(first.work.holds[first.work.jobs[0].id].held,'missing W-9 remains a real native work hold')
  assert.equal(second.work.schedules[0].first_due,'2026-09-01')
  assert.equal(second.work.schedules[0].budget_cents,9000)
  assert.deepEqual(first.ledger.migrationHistory.rows.map(x=>[x.kind,x.amount_cents,x.delta_cents]).sort(),[['charge',24000,24000],['credit',500,-500],['deposit',50000,0],['receipt',12000,-12000],['returned_payment',500,500]])
  const staffStatement=await(await h.request('/api/statement?tenancyId='+leases[0].targetId+'&from=2024-06-30&to=2026-06-30')).text()
  assert.ok(staffStatement.includes('Migrated charge')&&staffStatement.includes('240.00')&&staffStatement.includes('Migrated receipt')&&staffStatement.includes('120.00'))
  assert.ok(staffStatement.includes('Closing receivable USD","120.00'),'statement history reconciles without adding the opening charge a second time')
  const bill=(await(await h.request('/api/bills')).json()).bills[0]
  assert.equal(bill.parsed.totalCents,5000);assert.equal(bill.state,'pending');assert.equal(bill.approvals.length,0)
  assert.equal(await(await h.request('/api/bill-attachment?id='+bill.attachments[0].id)).text(),'Synthetic retained original 20')
  const detail=JSON.parse(journal.migration.original),forward=detail.records.find(r=>r.kind==='vendor_ytd')
  assert.equal(forward.data.reportableCents,120000)
  assert.deepEqual(detail.records.filter(r=>r.kind==='owner_ytd').map(r=>[r.data.incomeCents,r.data.expenseCents]),[[1000000,120000],[1000000,120000]])
  const audit=(await(await h.request('/api/history?action=migration.apply')).json()).rows
  assert.equal(audit.length,1);assert.equal(audit[0].subject,migrationId);assert.ok(audit[0].actor&&audit[0].at)
  const replay=await apply(resolved,review);assert.equal(replay.replayed,true)
  assert.equal((await h.db.prepare('SELECT count(*) AS n FROM tt_charges').first()).n,2)
  await h.restart();assert.deepEqual((await h.command('migration.journal',{migrationId})).migration.report.tieOut,report.tieOut)
  if(inspect)await inspect({h,manifest:resolved,review,applied,leases,phase:'applied'})
  // A later independently approved native bill must preserve the carried liability and expense, not double it.
  const property=report.records.find(r=>r.kind==='property'&&r.ref==='synthetic-terrace-3').targetId
  await h.command('agreement.set',{propertyId:property,starts:'2024-01-01',feePercent:'0',reserve:'0',markupPercent:'0',reference:'Synthetic existing agreement'})
  await h.command('bill.approve',{billId:bill.id,version:1},{status:403})
  const beforeBill=(await(await h.request('/api/journal?propertyId='+property)).json()).trialBalance
  await h.command('bill.approve',{billId:bill.id,version:1},{as:manager})
  const afterBill=(await(await h.request('/api/journal?propertyId='+property)).json()).trialBalance
  const net=(rows,code)=>{const a=rows.find(a=>a.code===code);return a.debitCents-a.creditCents}
  assert.equal(net(afterBill,'payable'),net(beforeBill,'payable'),'native bill approval cannot double an imported payable')
  assert.equal(net(afterBill,'expense'),net(beforeBill,'expense'),'native bill approval cannot double historical expense')
  await h.command('bill.approve',{billId:bill.id,version:1},{as:manager,status:409})
  const clearance=(await(await h.request('/api/journal?propertyId='+property)).json()).entries.find(j=>j.source_kind==='migration_bill_clearance')
  assert.ok(clearance);await h.command('journal.reverse',{entryId:clearance.id,day:'2026-10-28',reference:'Synthetic incorrect direct reversal'},{status:409})
  await h.stepUp()
  const residentAddress=resolved.records.find(r=>r.kind==='household').data.email
  await h.command('portal.invite',{kind:'resident',tenancyId:leases[0].targetId,email:residentAddress,displayName:'Synthetic resident',source:'Synthetic resident request'})
  const resident=await h.portalSignIn(residentAddress)
  const monthly=await(await h.request('/portal/statement?tenancyId='+leases[0].targetId+'&month=2024-07&format=json',{as:resident})).json()
  assert.equal(monthly.closingCents,24000);assert.equal(monthly.lines.length,1);assert.equal(monthly.lines[0].receivableDeltaCents,24000)
  const transaction=await h.request('/portal/transaction?tenancyId='+leases[0].targetId+'&id='+monthly.lines[0].id+'&format=json',{as:resident})
  assert.equal(transaction.status,200);assert.equal((await transaction.json()).charge.currentBalanceCents,null)
  assert.equal((await h.request('/portal/statement?tenancyId='+leases[1].targetId+'&month=2024-07&format=json',{as:resident})).status,404)
  const credential=await h.command('credential.mint',{label:'Synthetic migration reader',role:'accountant',scope:'read',['portfolio:'+first.portfolios[0].id]:'1'})
  const tokenCall=()=>h.request('/api/commands',{method:'POST',as:'',body:{command:'migration.journal',migrationId},headers:{authorization:'Bearer '+credential.token}})
  assert.equal((await tokenCall()).status,403)
  await h.command('credential.revoke',{credentialId:credential.id,version:1})
  assert.equal((await tokenCall()).status,401,'revoked credential cannot reach retained migration custody')
  const oldArchive=await(await h.request('/api/backup')).text(),restored=await installation({now:'2026-10-28T12:00:00.000Z'})
  try{
   await restored.formCommand('data.restore',{confirm:'RESTORE',backup:new File([oldArchive],'synthetic-terrace-40.rer')})
   assert.deepEqual((await restored.command('migration.journal',{migrationId})).migration.report,report)
   assert.equal((await restored.state(leases[0].targetId)).ledger.balanceCents,12000)
   assert.deepEqual((await restored.state(leases[0].targetId)).ledger.migrationHistory,first.ledger.migrationHistory)
   assert.equal((await restored.request('/portal/statement?tenancyId='+leases[0].targetId+'&month=2024-07&format=json',{as:resident})).status,401)
   const restoredDocs=(await(await restored.request('/api/documents')).json()).documents
   assert.equal(await(await restored.request(restoredDocs[0].url)).text(),'Synthetic retained original '+(restoredDocs[0].title.endsWith('7')?'17':'18'))
  }finally{await restored.close()}
  await h.setTime('2045-01-01T12:00:00.000Z')
  const sharedHold=await h.command('privacy.hold',{tenancyId:leases[1].targetId,class:'accounting',reason:'Synthetic shared-source legal hold'})
  const privacy=await h.command('privacy.request',{tenancyId:leases[0].targetId,kind:'erase',source:'Synthetic resident erasure request'})
  const heldRetention=await h.command('privacy.review',{tenancyId:leases[0].targetId,requestId:privacy.id})
  assert.equal(heldRetention.review.eligible,false,'another household legal hold preserves shared original custody')
  await h.command('tenancy.erase',{tenancyId:leases[0].targetId,requestId:privacy.id,fingerprint:heldRetention.review.fingerprint,confirm:residentAddress},{status:409})
  assert.equal((await h.command('migration.journal',{migrationId})).migration.original,JSON.stringify(resolved))
  await h.command('privacy.release',{tenancyId:leases[1].targetId,holdId:sharedHold.id,reason:'Synthetic legal release'})
  const retention=await h.command('privacy.review',{tenancyId:leases[0].targetId,requestId:privacy.id})
  assert.equal(retention.review.eligible,true);assert.equal(retention.review.personalRetained,false)
  await h.command('tenancy.erase',{tenancyId:leases[0].targetId,requestId:privacy.id,fingerprint:retention.review.fingerprint,confirm:residentAddress})
  await h.command('migration.journal',{migrationId},{status:410})
  await h.command('migration.apply',{manifest:JSON.stringify(resolved),fingerprint:report.fingerprint},{status:410})
  const resurrection=structuredClone(resolved);resurrection.namespace='synthetic-terrace-99'
  assert.ok((await preview(resurrection)).migrationPreview.issues.some(i=>i.key==='erased:synthetic-terrace-7'))
  assert.equal((await h.state()).tenancies.length,1,'other household native records survive shared-custody retirement')
  const retired=await h.db.prepare('SELECT original,report FROM tt_migrations WHERE id=?').bind(migrationId).first()
  assert.equal(retired.original,null);assert.ok(!retired.report.includes(residentAddress))
  assert.deepEqual(JSON.parse(retired.report).tieOut.map(r=>[r.sourceCents,r.terraceCents,r.differenceCents]),report.tieOut.map(r=>[r.sourceCents,r.terraceCents,r.differenceCents]),'erasure retains the numeric opening tie-out')
  const unrelatedSource=(await h.db.prepare("SELECT record FROM tt_migration_records WHERE kind='household' AND ref='synthetic-terrace-6'").first()).record
  assert.ok(unrelatedSource,'unrelated original source facts remain')
  assert.equal(JSON.parse(unrelatedSource).sourceNote,'Synthetic unrelated source note')
  assert.equal((await h.db.prepare("SELECT record FROM tt_migration_records WHERE kind='household' AND ref='synthetic-terrace-30'").first()).record,null,'excluded duplicates carry no erased-person copy')
  const laterArchive=await(await h.request('/api/backup')).text(),fresh=await installation({now:'2045-01-01T12:00:00.000Z'})
  assert.ok(laterArchive.includes('Synthetic unrelated source note'),'backup preserves unrelated original source fields')
  assert.ok(!laterArchive.includes('Synthetic subject source note'),'backup withdraws erased-person source fields')
  try{
   await fresh.formCommand('data.restore',{confirm:'RESTORE',backup:new File([oldArchive],'synthetic-terrace-41.rer'),journal:new File([laterArchive],'synthetic-terrace-42.rer')},{status:409})
   assert.equal((await fresh.state()).tenancies.length,0)
   await fresh.formCommand('data.restore',{confirm:'RESTORE',backup:new File([laterArchive],'synthetic-terrace-43.rer')})
   await fresh.command('migration.journal',{migrationId},{status:410})
   await fresh.command('migration.apply',{manifest:JSON.stringify(resolved),fingerprint:report.fingerprint},{status:410})
   assert.equal((await fresh.state()).tenancies.length,1)
  }finally{await fresh.close()}
  return {fingerprint:report.fingerprint}
 }finally{await h.close()}
}
