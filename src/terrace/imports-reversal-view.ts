import { escape as e, type Row } from './core'
import { button, form, hidden, input } from './view'

function blocker(b: Row) {
 const kind=b.kind==='tt_charges'?'rent charge':b.kind==='tt_receipts'?'receipt':b.kind==='tt_proposals'?'prepared decision':b.kind==='tt_inspections'?'inspection':b.kind==='tt_maintenance_jobs'?'maintenance job':'later recorded work'
 const r=b.record
 return `${kind}${r.reference?' '+r.reference:r.title?' '+r.title:r.description?' '+r.description:''}${r.due_date?' due '+r.due_date:''}`
}
export function reversalBlockers(rows: Row[]) {
 return rows.filter(r=>r.action==='retain').map(r=>`${r.sourceRef??'Source row '+r.sourceRow} · ${r.address} · ${r.tenantName}: ${[...r.blockers.map(blocker),...r.changes.map((c:Row)=>'changed '+c.field.replaceAll('_',' '))].join('; ')||'previously retained work'}`).join(' | ')
}
/** This is an undo review, never a CSV import approval. The owner approves its exact fingerprint. */
export function reversalReviewView(r?: Row) {
 if(!r)return ''
 const rows=r.rows??[]
 const review=rows.map((x:Row)=>`<li><strong>${e(x.sourceRef??'Source row '+x.sourceRow)} · ${e(x.address)} · ${e(x.tenantName)}</strong>: ${x.action==='reverse'?'Unchanged; can be removed':x.action==='already_reversed'?'Already removed':'Kept'}${x.blockers.length?`<ul>${x.blockers.map((b:Row)=>`<li>${e(blocker(b))}</li>`).join('')}</ul>`:''}${x.changes.length?`<p>Changed: ${x.changes.map((c:Row)=>e(c.field.replaceAll('_',' '))).join(', ')}.</p>`:''}</li>`).join('')
 const approval=r.available&&r.counts.reverse>0?form('import.compensate',hidden('jobId',r.job.id)+hidden('fingerprint',r.fingerprint)+`<p>This approval removes ${r.counts.reverse} unchanged tenancies and keeps ${r.counts.retain} tenancies with their later work. The original source and journal remain. Keep the import by leaving this page without approving.</p>`+input('Reason for removing only unchanged tenancies','reason')+button('Remove unchanged tenancies; keep later work'),'','import'):'<p>No unchanged tenancies are available to remove. Keep the import and its later work.</p>'
 return `<article class="card" aria-labelledby="undo-review"><h3 id="undo-review">Review import undo</h3><p>Nothing is removed by this review. Later work is kept. An ordinary undo refuses the whole batch when any tenancy is changed.</p><ul>${review}</ul>${approval}${form('import.compensation.preview',hidden('jobId',r.job.id)+button('Refresh undo review'),'','import')}</article>`
}
