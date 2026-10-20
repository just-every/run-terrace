import assert from 'node:assert/strict'
import {installation,tenancyInput} from './api/harness.mjs'
import {makePart,ArchiveVerifier,ContentVerifier} from '../src/modules/portability/format.mjs'

// A historical installation archive is input at the public restore door. Build it with the
// normal archive checksums, preserving all data except the fixture's dated assignment event.
async function historicalAssignments(archive) {
 const records=archive.trim().split('\n').map(x=>JSON.parse(x)),manifest=records[0],parts=[]
 for(const old of records.filter(x=>x.kind==='part')){
  for(const item of old.items)if(item.kind==='row'){
   if(['tt_delinquency_assignments','tt_delinquency_assignment_events'].includes(item.table))item.row.assigned_at='2011-05-01T12:00:00.000Z'
   if(item.table==='tt_audit'&&item.row.action==='delinquency.assign')item.row.at='2011-05-01T12:00:00.000Z'
  }
  parts.push(await makePart(old.index,old.items))
 }
 const content=new ContentVerifier(manifest),integrity=new ArchiveVerifier(manifest)
 for(const part of parts){integrity.add(part);for(const item of part.items)content.add(item)}
 return [manifest,...parts,{kind:'closing',partCount:parts.length,contentHash:content.digest(),archiveHash:integrity.digest()}].map(x=>JSON.stringify(x)).join('\n')+'\n'
}

/** REPORT-002 / SAFE-004: a retained operational reference survives holds and disappears on eligible erasure. */
export async function assignmentCustody() {
 const source=await installation(),dest=await installation()
 try {
  const email='historic-followup@example.test',t=await source.command('tenancy.create',{...tenancyInput,tenantName:'Casey Historic',tenantEmail:email,startDate:'2010-01-01',endDate:'2011-12-31'})
  const owner=(await(await source.request('/auth/operators')).json()).find(x=>x.role==='owner')
  await source.command('delinquency.assign',{tenancyId:t.id,assignedTo:owner.id,version:0,reference:'PRIVATE-FOLLOWUP-CASEY-88'})
  const currentRequest=await source.command('privacy.request',{tenancyId:t.id,kind:'erase',source:'Current retention review'}),current=await source.command('privacy.review',{tenancyId:t.id,requestId:currentRequest.id})
  assert.ok(current.review.classes.find(x=>x.class==='accounting').retained,'new assignment extends fiscal accounting retention even on an old lease')
  const historical=await historicalAssignments(await(await source.request('/api/backup')).text())
  await dest.formCommand('data.restore',{backup:new File([historical],'historical.rer'),confirm:'RESTORE'})
  const hold=await dest.command('privacy.hold',{tenancyId:t.id,class:'accounting',reason:'Counsel HOLD-88'}),request=await dest.command('privacy.request',{tenancyId:t.id,kind:'erase',source:'Subject erasure request'})
  let review=await dest.command('privacy.review',{tenancyId:t.id,requestId:request.id})
  assert.equal(review.review.eligible,true);assert.equal(review.review.personalRetained,true)
  await dest.command('tenancy.erase',{tenancyId:t.id,requestId:request.id,fingerprint:review.review.fingerprint,confirm:email})
  let access=await(await dest.request('/api/resident-access?tenancyId='+t.id)).json()
  assert.equal(access.followupAssignments[0].reference,'PRIVATE-FOLLOWUP-CASEY-88','accounting hold retains private follow-up evidence')
  await dest.command('privacy.release',{tenancyId:t.id,holdId:hold.id,reason:'Counsel RELEASE-88'})
  const final=await dest.command('privacy.request',{tenancyId:t.id,kind:'erase',source:'Complete subject erasure'})
  review=await dest.command('privacy.review',{tenancyId:t.id,requestId:final.id});assert.equal(review.review.personalRetained,false)
  await dest.command('tenancy.erase',{tenancyId:t.id,requestId:final.id,fingerprint:review.review.fingerprint,confirm:email})
  const erased=await(await dest.request('/api/backup')).text(),records=erased.trim().split('\n').map(x=>JSON.parse(x))
  for(const table of ['tt_delinquency_assignments','tt_delinquency_assignment_events'])assert.equal(records[0].tables.find(x=>x.name===table).count,0)
  assert.ok(!erased.includes('PRIVATE-FOLLOWUP-CASEY-88'),'eligible personal redaction removes assignment references and audit source text')
  assert.equal((await dest.request('/api/resident-access?tenancyId='+t.id)).status,404)
 } finally {await source.close();await dest.close()}
}
