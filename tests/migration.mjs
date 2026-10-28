import assert from 'node:assert/strict'
import {installation} from './api/harness.mjs'
import {migrationFixture,recount} from './migration-fixture.mjs'
export async function journey({inspect,assets=false}={}){
 const h=await installation({assets,now:'2026-10-28T12:00:00.000Z'})
 try{
  const m=recount(migrationFixture()),preview=source=>h.command('migration.preview',{manifest:JSON.stringify(source)}),apply=(source,review)=>h.command('migration.apply',{manifest:JSON.stringify(source),fingerprint:review.migrationPreview.fingerprint})
  const before=await h.state(),missing=structuredClone(m);missing.records=missing.records.filter(r=>r.kind!=='deposit'||r.ref!=='synthetic-terrace-12');recount(missing)
  const duplicate=structuredClone(m.records.find(r=>r.kind==='household'));duplicate.ref='synthetic-terrace-30';missing.records.push(duplicate,{kind:'lease',ref:'synthetic-terrace-31',data:{leaseType:'commercial'}});recount(missing);missing.resolutions=[]
  const held=await preview(missing),problems=held.migrationPreview.issues
  assert.ok(problems.some(i=>i.key==='deposit:lease:synthetic-terrace-8'&&!i.resolved),'missing deposit is a held record')
  assert.ok(problems.some(i=>i.key==='exclude:household:synthetic-terrace-30'&&!i.resolved),'duplicate household is held')
  assert.ok(problems.some(i=>i.key==='w9:vendor:synthetic-terrace-19'&&!i.resolved),'missing W-9 cannot silently qualify a vendor')
  assert.ok(problems.some(i=>i.key==='exclude:lease:synthetic-terrace-31'&&!i.resolved),'commercial lease never becomes residential')
  assert.equal(held.migrationPreview.canApply,false)
  assert.deepEqual((await h.state()).tenancies,before.tenancies,'preview writes no tenancies')
  assert.equal((await h.db.prepare('SELECT count(*) AS n FROM tt_migrations').first()).n,0,'preview creates no durable job')
  await h.command('migration.apply',{manifest:JSON.stringify(missing),fingerprint:held.migrationPreview.fingerprint},{status:409})
  const counts=structuredClone(m);counts.inventory.lease=3
  assert.ok((await preview(counts)).migrationPreview.issues.some(i=>i.key==='count:lease'&&!i.resolved))
  const mismatch=structuredClone(m);mismatch.trialBalance[0].balanceCents+=100
  const different=await preview(mismatch);assert.equal(different.migrationPreview.canApply,false)
  assert.equal(different.migrationPreview.tieOut[0].differenceCents,-100)
  mismatch.trialBalance[0].exception='Source trial includes an identified 100 cent unposted bank correction retained for review.'
  const named=await preview(mismatch);assert.equal(named.migrationPreview.canApply,true);assert.equal(named.migrationPreview.completeSwitch,false)
  assert.equal(named.migrationPreview.tieOut[0].exception,mismatch.trialBalance[0].exception)
  const resolved=structuredClone(m)
  resolved.records.push(duplicate,{kind:'lease',ref:'synthetic-terrace-31',data:{leaseType:'commercial'}});recount(resolved)
  resolved.resolutions.push({key:'exclude:household:synthetic-terrace-30',action:'exclude',reason:'Duplicate of the retained household; its leases map to that household.'},{key:'exclude:lease:synthetic-terrace-31',action:'exclude',reason:'Commercial source stays in its specialist system under BOUND-004.'})
  const review=await preview(resolved),report=review.migrationPreview
  assert.equal(report.canApply,true,JSON.stringify(report.issues))
  assert.deepEqual(report.counts.lease,{source:3,imported:2,excluded:1})
  assert.deepEqual(report.counts.household,{source:3,imported:2,excluded:1})
  assert.equal(report.sourceCount,report.importedCount+report.excludedCount)
  assert.deepEqual(report.tieOut.map(r=>r.differenceCents),Array(11).fill(0))
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
  const replay=await apply(resolved,review);assert.equal(replay.replayed,true)
  assert.equal((await h.db.prepare('SELECT count(*) AS n FROM tt_charges').first()).n,2)
  await h.restart();assert.deepEqual((await h.command('migration.journal',{migrationId})).migration.report.tieOut,report.tieOut)
  if(inspect)await inspect({h,manifest:resolved,review,applied,leases,phase:'applied'})
  return {fingerprint:report.fingerprint}
 }finally{await h.close()}
}
