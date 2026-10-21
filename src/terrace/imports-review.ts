import { canonicalJson, sha256, readD1ImportJob, readD1ImportUndoReport } from '../modules/import-kit/src/d1/index.ts'
import type { D1ImportContext, ImportJob } from '../modules/import-kit/src/d1/index.ts'
import { all, Fault, one, type Context, type Row } from './core'
import { dependencySnapshot, snapshotHash, type DependencySnapshot } from './imports-dependencies'
import { tenancyTargets } from './imports-target'

export const unavailable = () => new Fault('compensation_unavailable','This import cannot be compensated yet; its tenancies and later work are unchanged.',409)
export function reviewedFault(code: string, message: string, report: Row): never { throw Object.assign(new Fault(code,message,409),{report}) }
export type Review = Awaited<ReturnType<typeof compensationReview>>
export async function compensationReview(c: Context, jobId: string, context: D1ImportContext) {
 const job=await readD1ImportJob(jobId,context)
 const raw=(await one(c,'SELECT plan_json,reversal_policy FROM ik_jobs WHERE id=?',jobId))!
 let plan=JSON.parse(raw.plan_json)
 if(plan.d1Plan===1)plan=JSON.parse((await all(c,'SELECT body FROM ik_d1_plan_chunks WHERE job_id=? ORDER BY ordinal',jobId)).map(r=>r.body).join(''))
 if(!Array.isArray(plan.entries))throw unavailable()
 const provenance=await all(c,'SELECT * FROM ik_provenance WHERE job_id=? ORDER BY ordinal,effect_ordinal',jobId)
 const effects=provenance.map(row=>({raw:row,provenance:JSON.parse(row.record_json),expected:plan.entries[row.ordinal]?.effects[row.effect_ordinal]}))
 if(effects.some(e=>!e.expected))throw unavailable()
 const ids=effects.map(e=>e.provenance.targetId)
 let snapshot:DependencySnapshot
 try{snapshot=await dependencySnapshot(context.storage.database,ids)}catch{throw unavailable()}
 const report=await readD1ImportUndoReport(jobId,context)
 const rows=await Promise.all(effects.map(async e=>{
  const p=e.provenance,expected=e.expected.value as Row,current=await tenancyTargets.read(context.storage.database,job.destination,p.targetKind,p.targetId)
  const native=snapshot.rows.find(r=>r.tenancyId===p.targetId&&r.kind==='tenancy')?.record
  const changes=Object.keys(expected).filter(k=>canonicalJson(expected[k])!==canonicalJson(current?.value?.[k as keyof typeof current.value]??null)).map(field=>({field,applied:expected[field],current:(current?.value as Row|undefined)?.[field]??null}))
  // These native-only fields are null/1 on an imported row. They are not owned
  // CSV fields, but setting them still makes a tenancy ineligible for reversal.
  for(const field of ['unit_id','ended_on','end_reason','transferred_from','currency_confirmed'])if(native&&native[field] !== (field==='currency_confirmed'?1:null))changes.push({field,applied:field==='currency_confirmed'?1:null,current:native[field]})
  const blockers=snapshot.rows.filter(r=>r.tenancyId===p.targetId&&r.kind!=='tenancy').map(r=>({kind:r.kind,id:String(r.record.id??r.record.lease_version_id??r.record.tenancy_id??r.record.entity_id??r.record.bill_id),record:r.record}))
  const terminal=report.dispositions.find(d=>d.effectId===p.id)
  const erased=!!native?.custody_retired_at||!!native?.erased_at
  const edited=changes.length>0||(!p.reversed&&current?.revision.replace('|related-work','')!==p.appliedRevision)
  const action=p.reversed?'already_reversed':erased?'erased':terminal?.disposition==='retained'||edited||blockers.length?'retain':'reverse'
  return {effectId:p.id,sourceRef:p.sourceId??null,sourceRow:p.location.row??null,sourceIdentity:p.sourceIdentity,targetId:p.targetId,currentState:p.reversed?'already_reversed':erased?'erased':edited?'edited':'untouched',action,reason:terminal?.reason??(edited?'edited':blockers.length?'dependency':'unchanged'),changes,blockers,observedHash:snapshotHash(snapshot.rows.filter(r=>r.tenancyId===p.targetId)),appliedRevision:p.appliedRevision}
 }))
 for(const entry of plan.entries.filter((e:Row)=>e.erased))if(!rows.some(r=>r.sourceIdentity===entry.identity))rows.push({effectId:null,sourceRef:null,sourceRow:null,sourceIdentity:entry.identity,targetId:null,currentState:'erased',action:'erased',reason:'unchanged',changes:[],blockers:[],observedHash:sha256('null'),appliedRevision:null})
 const superseded=!!await one(c,'SELECT 1 FROM ik_d1_history WHERE job_id=? LIMIT 1',jobId)
 const available=raw.reversal_policy==='preserve-conflicts'&&!superseded&&!job.erasedRecords&&['completed','undoing','undone'].includes(job.state)&&!rows.some(r=>r.action==='erased')
 const fingerprint=sha256(canonicalJson({jobId,jobFingerprint:job.fingerprint,state:job.state,fence:job.fence,policy:raw.reversal_policy,superseded,rows}))
 return {job,policy:raw.reversal_policy as string,available,rows,fingerprint,counts:{reverse:rows.filter(r=>r.action==='reverse').length,retain:rows.filter(r=>r.action==='retain').length,reversed:rows.filter(r=>r.action==='already_reversed').length},snapshot,effects,undoReport:report}
}
export function publicReview(r: Review) { return {job:r.job,policy:r.policy,available:r.available,fingerprint:r.fingerprint,rows:r.rows,counts:r.counts} }
export function labelOutcome(job: ImportJob, dispositions: {disposition:string}[]) {
 return job.state==='undone' ? dispositions.some(d=>d.disposition==='retained')?'compensated':'undone' : job.state==='undoing'?'stopped':job.state
}
