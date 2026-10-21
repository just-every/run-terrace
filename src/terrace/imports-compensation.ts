/** Owner approval exists only in this invocation. The adapter's exact snapshot
 * guards and the approval/history receipts commit in each reversal transaction.
 * No persisted approval can authorize a later request or a restored session. */
import { canonicalJson, readD1ImportUndoReport, undoD1Import, rollbackD1Import } from '../modules/import-kit/src/d1/index.ts'
import type { D1Database, D1ImportContext, D1Statement, D1UndoEffect, D1UndoSnapshot } from '../modules/import-kit/src/d1/index.ts'
import { id, sql, text, type Context, type Row } from './core'
import { dependencySnapshot, snapshotGuard } from './imports-dependencies'
import { compensationReview, labelOutcome, publicReview, reviewedFault, unavailable, type Review } from './imports-review'
import { kitSql, tenancyTargets } from './imports-target'

export async function importReversal(c: Context, command: string, p: Row, context: D1ImportContext) {
 const review=await compensationReview(c,text(p.jobId,'Import job',100),context),report=publicReview(review)
 if(command==='import.compensation.preview')return report
 if(command==='import.compensate') {
  const reason=text(p.reason,'Compensation reason',2000)
  if(!review.available)throw Object.assign(unavailable(),{report})
  if(p.fingerprint!==review.fingerprint)reviewedFault('review_changed','The import or its later work changed. Preview and approve it again.',report)
  if(review.job.state==='undone')return {job:review.job,outcome:labelOutcome(review.job,review.undoReport.dispositions),undoReport:review.undoReport}
  return reverseReviewed(c,context,review,{id:id(),reason})
 }
 if(['undone','rolled_back'].includes(review.job.state))return {job:review.job,replayed:true,outcome:labelOutcome(review.job,review.undoReport.dispositions)}
 if(review.rows.some(r=>r.action==='retain')||review.job.state==='undoing')reviewedFault('import_conflict',`Undo refused: ${review.counts.reversed} reversed, ${review.counts.retain} blocked. Review compensation; nothing else was reversed.`,report)
 return reverseReviewed(c,context,review)
}

async function reverseReviewed(c: Context, context: D1ImportContext, review: Review, approval?: {id:string;reason:string}) {
 const jobId=review.job.id,base=context.storage.database
 let pending=false
 const adapter={...tenancyTargets,ownedContent:(row: any)=>({revision:row.revision.replace('|related-work',''),value:row.value,attachment:row.attachment??null}),
  remove(destination:string,kind:string,targetId:string) {
   const native=review.snapshot.rows.find(r=>r.kind==='tenancy'&&r.tenancyId===targetId)?.record
   if(!native)throw new Error('COMPENSATION_REVIEW_CHANGED')
   return [kitSql(`EXISTS(SELECT 1 FROM tt_tenancies WHERE ${Object.keys(native).map(k=>`"${k}" IS ?`).join(' AND ')})`,...Object.values(native))].map(p=>kitSql(`INSERT INTO tt_guard(ok) VALUES(CASE WHEN (${p.sql}) THEN 1 ELSE 0 END)`,...p.params??[])).concat(tenancyTargets.remove(destination,kind,targetId))
  },
  async preparePreservedUndo(db:D1Database,_destination:string,effects:D1UndoEffect[]):Promise<D1UndoSnapshot> {
   const live=await dependencySnapshot(db,review.snapshot.ids)
   const active=new Set(effects.map(e=>e.provenance.targetId))
   // The kit validated all provenance and terminal decisions before this call.
   // Only its own already-reversed native rows may disappear from approval.
   const expected=review.snapshot.rows.filter(r=>r.kind!=='tenancy'||active.has(r.tenancyId))
   if(canonicalJson(live.rows)!==canonicalJson(expected))throw new Error('COMPENSATION_REVIEW_CHANGED')
   if(!approval&&effects.some(e=>e.retained))throw new Error('COMPENSATION_REVIEW_CHANGED')
   const observations=await Promise.all(effects.map(async e=>({effectId:e.provenance.id,current:(await tenancyTargets.read(db,context.destination,e.provenance.targetKind,e.provenance.targetId))??null,entity:{table:'tt_tenancies',recordId:e.provenance.targetId},evidence:{sourceRef:e.provenance.sourceId,sourceRow:e.provenance.location.row??null}})))
   const dependencies=effects.flatMap(e=>live.rows.filter(r=>r.tenancyId===e.provenance.targetId&&r.kind!=='tenancy').map(r=>({requiredEffectId:e.provenance.id,cause:{table:r.kind,recordId:String(r.record.id??r.record.tenancy_id??r.record.lease_version_id??r.record.bill_id)},evidence:r.record})))
   if(!approval&&(dependencies.length||observations.some(o=>{const e=effects.find(e=>e.provenance.id===o.effectId)!;return !o.current||canonicalJson(adapter.ownedContent(o.current))!==canonicalJson(adapter.ownedContent(e.expected))})))throw new Error('COMPENSATION_REVIEW_CHANGED')
   pending=!!approval
   return {observations,dependencies,guards:[snapshotGuard(live),kitSql('NOT EXISTS(SELECT 1 FROM ik_d1_history WHERE job_id=?)',jobId)]}
  },
 }
 /** Adapt the public D1 port to add product receipts to the kit's atomic batch.
  * The pending flag is set by preparePreservedUndo, immediately before the
  * kit publishes that decision. Read batches and reversal intent record none. */
 const db:D1Database={prepare:q=>base.prepare(q),async batch(statements:D1Statement[]){
  if(!pending)return base.batch(statements)
  pending=false
  const a=approval!,targets=JSON.stringify(review.snapshot.ids)
  const additions=[
   sql(c,"INSERT INTO tt_guard(ok) VALUES(CASE WHEN EXISTS(SELECT 1 FROM oa_operators WHERE id=? AND status='active' AND role='owner' AND version=?) THEN 1 ELSE 0 END)",c.actor.id,c.actor.version??1),
   sql(c,'INSERT INTO tt_import_compensations(id,job_id,actor,at,role,role_version,fingerprint,reason,target_ids,reverse_count,retain_count) VALUES(?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING',a.id,jobId,c.actor.id,c.now,'owner',c.actor.version??1,review.fingerprint,a.reason,targets,review.counts.reverse,review.counts.retain),
   // Each committed batch records its own current counts, including a stopped
   // outcome. Repeats after completion never reach this port or add a receipt.
   sql(c,`INSERT INTO tt_audit(id,actor,action,subject,at,role,policy,source,outcome) SELECT ?||':'||reversal_cursor,?,'import.compensate',id,?,'owner',?, ?,json_object('approvalId',?,'fingerprint',?,'reversed',(SELECT count(*) FROM ik_d1_reversal_reports WHERE job_id=? AND json_extract(record_json,'$.disposition')='reversed'),'retained',(SELECT count(*) FROM ik_d1_reversal_reports WHERE job_id=? AND json_extract(record_json,'$.disposition')='retained'),'outcome',CASE WHEN state='undone' THEN CASE WHEN EXISTS(SELECT 1 FROM ik_d1_reversal_reports WHERE job_id=? AND json_extract(record_json,'$.disposition')='retained') THEN 'compensated' ELSE 'undone' END ELSE 'stopped' END) FROM ik_jobs WHERE id=?`,a.id,c.actor.id,c.now,`owner v${c.actor.version??1}`,a.reason,a.id,review.fingerprint,jobId,jobId,jobId,jobId),
  ]
  const result=await base.batch([...statements,...additions as unknown as D1Statement[]]);return result.slice(0,statements.length)
 }}
 const guarded={...context,storage:{database:db,targets:adapter}}
 try {
  const reversing=['queued','applying','failed','rolling_back','rolled_back'].includes(review.job.state)?rollbackD1Import:undoD1Import
  const job=await reversing(jobId,guarded),undoReport=await readD1ImportUndoReport(jobId,context)
  return {job,outcome:labelOutcome(job,undoReport.dispositions),undoReport,counts:{reversed:undoReport.dispositions.filter(d=>d.disposition==='reversed').length,retained:undoReport.dispositions.filter(d=>d.disposition==='retained').length,remaining:review.effects.length-undoReport.dispositions.length}}
 }catch(error){
  if(/COMPENSATION_REVIEW_CHANGED|IMPORT_ATOMIC_GUARD|IMPORT_FINAL_GUARD|CHECK constraint/.test(String(error))) {
   const current=await compensationReview(c,jobId,context)
   reviewedFault(approval?'review_changed':'import_conflict',`Undo stopped: ${current.counts.reversed} reversed, ${current.counts.retain} blocked. Preview the remainder and approve it again.`,publicReview(current))
  }
  throw error
 }
}
