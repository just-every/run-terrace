/** Vendor bills are property accounting. Work-linked resident subjects survive removal of their work order. */
import { all, guard, insist, sql, type Context, type Row } from './core'
export async function billSubjects(c:Context,key:string,terms:Row,kind='bill') {
 const ids=new Set<string>()
 for(const a of terms.allocations) if(a.jobId) {
  const rows=await all(c,'SELECT tenancy_id FROM tt_maintenance_jobs WHERE id=?',a.jobId)
  for(const j of rows)ids.add(j.tenancy_id)
 }
 return [...ids].map(t=>sql(c,'INSERT INTO tt_bill_subjects(kind,entity_id,tenancy_id) VALUES(?,?,?) ON CONFLICT DO NOTHING',kind,key,t))
}
export async function billRetentionDay(c:Context,tenancyId:string) {
 const rows=await all(c,"SELECT b.day FROM tt_bill_subjects s JOIN tt_bills b ON s.entity_id=b.id AND s.kind='bill' WHERE s.tenancy_id=? UNION ALL SELECT json_extract(t.terms,'$.starts') AS day FROM tt_bill_subjects s JOIN tt_bill_templates t ON s.entity_id=t.id AND s.kind='template' WHERE s.tenancy_id=?",tenancyId,tenancyId)
 const stock=await all(c,'SELECT day FROM tt_stock_uses WHERE tenancy_id=?',tenancyId)
 const chargebacks=await all(c,'SELECT day FROM tt_work_chargebacks WHERE tenancy_id=?',tenancyId)
 return [...rows,...stock,...chargebacks].map(r=>r.day as string).sort().at(-1)??null
}
/** Anonymous shared-document holds: never disclose another resident or their reasons. */
export async function billSharedHolds(c:Context,tenancyId:string) {
 const rows=await all(c,`SELECT DISTINCT h.class FROM tt_bill_subjects own JOIN tt_bill_subjects other ON other.kind=own.kind AND other.entity_id=own.entity_id JOIN tt_legal_holds h ON h.tenancy_id=other.tenancy_id WHERE own.tenancy_id=? AND other.tenancy_id<>? AND h.released_at IS NULL AND h.class IN ('all','accounting')`,tenancyId,tenancyId)
 return rows.map(r=>({class:r.class,reason:'Shared vendor accounting evidence is under another subject’s legal hold'}))
}
const retained=(t:Row,key:string)=>({...t,invoiceNumber:key,...('purpose'in t?{purpose:'Retained accounting record'}:{}),lines:t.lines.map((l:Row)=>({...l,description:'Retained accounting record',code:'retained-expense'}))})
/** Call only after accounting retention/holds permit and while tt_erasure_work contains this subject.
 * Numeric/date/payee/share evidence and original fingerprints remain. Invoice bytes and personal free text go.
 */
export async function billErasureStatements(c:Context,tenancyId:string) {
 const holds=await billSharedHolds(c,tenancyId)
 insist(!holds.length,'retention_hold','Shared vendor accounting evidence is under a legal hold.',409)
 const entities=await all(c,'SELECT kind,entity_id FROM tt_bill_subjects WHERE tenancy_id=?',tenancyId),writes:D1PreparedStatement[]=[]
 for(const s of entities) {
  const key=s.entity_id
  writes.push(guard(c,'EXISTS(SELECT 1 FROM tt_erasure_work WHERE tenancy_id=?)',tenancyId),guard(c,"NOT EXISTS(SELECT 1 FROM tt_bill_subjects own JOIN tt_bill_subjects other ON other.kind=own.kind AND other.entity_id=own.entity_id JOIN tt_legal_holds h ON h.tenancy_id=other.tenancy_id WHERE own.tenancy_id=? AND other.tenancy_id<>? AND h.released_at IS NULL AND h.class IN ('all','accounting'))",tenancyId,tenancyId),sql(c,'UPDATE tt_audit SET source=NULL WHERE subject=? AND action LIKE ?',key,s.kind==='bill'?'bill.%':'bill-template.%'))
  if(s.kind==='bill') {
   writes.push(sql(c,"UPDATE tt_stock_lots SET name='Retained stock',reference=id WHERE bill_id=?",key),sql(c,'UPDATE tt_stock_uses SET reference=id WHERE tenancy_id=? AND lot_id IN (SELECT id FROM tt_stock_lots WHERE bill_id=?)',tenancyId,key))
   for(const r of await all(c,'SELECT * FROM tt_bill_revisions WHERE bill_id=?',key))writes.push(sql(c,'UPDATE tt_bill_revisions SET terms=? WHERE bill_id=? AND version=?',JSON.stringify(retained(JSON.parse(r.terms),key)),key,r.version))
   for(const a of await all(c,'SELECT * FROM tt_bill_approvals WHERE bill_id=?',key)) {
    const snapshot=JSON.parse(a.snapshot);snapshot.terms=retained(snapshot.terms,key);if(snapshot.decision)snapshot.decision.reference='Retained accounting record'
    writes.push(sql(c,'UPDATE tt_bill_approvals SET snapshot=? WHERE id=?',JSON.stringify(snapshot),a.id))
   }
   writes.push(sql(c,"UPDATE tt_fees SET source_label='Retained accounting record',override_reason=NULL WHERE kind='markup' AND source LIKE ?",'bill:'+key+':v%'),sql(c,'INSERT INTO tt_erased_bill_files(sha256) SELECT sha256 FROM tt_bill_attachments WHERE bill_id=? ON CONFLICT DO NOTHING',key),sql(c,'DELETE FROM tt_bill_attachments WHERE bill_id=?',key),sql(c,"UPDATE tt_bill_decisions SET reference='Retained accounting record' WHERE bill_id=?",key),sql(c,'UPDATE tt_bills SET invoice_number=?,invoice_key=? WHERE id=?',key,key,key))
  } else {
   const t=(await all(c,'SELECT * FROM tt_bill_templates WHERE id=?',key))[0]
   writes.push(sql(c,'UPDATE tt_bill_templates SET terms=? WHERE id=?',JSON.stringify(retained(JSON.parse(t.terms),key)),key))
   for(const r of await all(c,'SELECT * FROM tt_bill_template_revisions WHERE template_id=?',key))writes.push(sql(c,'UPDATE tt_bill_template_revisions SET terms=? WHERE template_id=? AND version=?',JSON.stringify(retained(JSON.parse(r.terms),key)),key,r.version))
  }
 }
 for(const r of await all(c,'SELECT id,terms FROM tt_work_chargebacks WHERE tenancy_id=?',tenancyId)){const t=JSON.parse(r.terms);writes.push(sql(c,'UPDATE tt_work_chargebacks SET terms=? WHERE id=?',JSON.stringify({...t,recipientId:r.id,recipientName:'Retained recipient',authority:'Retained accounting authorization'}),r.id))}
 return writes
}

/** Resident access discloses the existence of their shared accounting sources, without other parties' invoice text, originals or amounts. */
export async function residentBillSources(c:Context,tenancyId:string){
 const rows=await all(c,`SELECT DISTINCT s.kind,s.entity_id,b.day,b.state FROM tt_bill_subjects s LEFT JOIN tt_bills b ON s.kind='bill' AND b.id=s.entity_id WHERE s.tenancy_id=? ORDER BY s.entity_id`,tenancyId)
 return rows.map(r=>({kind:r.kind,id:r.entity_id,date:r.day??null,status:r.state??'recurring template'}))
}
