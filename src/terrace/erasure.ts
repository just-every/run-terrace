import {hapRemittanceErasureStatements} from './hap-remittances'
/** SAFE-004 erasure is one transaction with custody retirement and the archive non-resurrection fence. */
import { all, audit, guard, insist, one, sha256, sql, tenancy, type Context, type Row } from './core'
import { retentionReview } from './retention'
import { retireTenancy } from './imports'
import { billErasureStatements } from './bills-retention'
import { leaseErasureStatements } from './lease-versions'
import { portable } from './data'
import { referralErasure } from './professional-referrals'
import { documentErasureStatements } from './documents'
import { portalErasureStatements } from './portal'
import { migrationErasure } from './migration'
export async function eraseTenancy(c:Context,p:Row){
 const t=await tenancy(c,p.tenancyId)
 insist(p.confirm===t.tenant_email,'confirmation','Type the exact tenant email to confirm permanent tenancy erasure.')
 const request=await one(c,"SELECT * FROM tt_privacy_requests WHERE id=? AND tenancy_id=? AND kind='erase' AND reviewed_at IS NOT NULL",String(p.requestId??''),t.id)
 insist(request,'review_required','Record and review an erasure request first.',409)
 const review=await retentionReview(c,t)
 insist(p.fingerprint===review.fingerprint&&JSON.parse(request.review).fingerprint===review.fingerprint,'review_changed','Retention or holds changed. Review the request again.',409)
 insist(review.eligible,'retention_hold','Lease evidence is retained by its period or a legal hold. See the review for what is kept and why.',409)
 const service=await portable(c),checkpoint=await service.redactionStatements(),alias='resident-'+t.id
 const native=[...await migrationErasure(c,t.id,!review.personalRetained),guard(c,"EXISTS(SELECT 1 FROM oa_operators WHERE id=? AND status='active' AND role='owner' AND version=?)",c.actor.id,c.actor.version??1),guard(c,'EXISTS(SELECT 1 FROM tt_tenancies WHERE id=? AND version=?)',t.id,t.version),
 guard(c,"NOT EXISTS(SELECT 1 FROM tt_legal_holds WHERE tenancy_id=? AND released_at IS NULL AND class IN ('all','lease'))",t.id),
 sql(c,'INSERT INTO tt_erasures(subject,erased_at) VALUES(?,?) ON CONFLICT DO NOTHING',await sha256(new TextEncoder().encode(t.tenant_email)),c.now),
 sql(c,'INSERT OR IGNORE INTO tt_erased_document_files(sha256) SELECT e.sha256 FROM tt_thread_entries e JOIN tt_threads r ON r.id=e.thread_id WHERE r.tenancy_id=? AND e.sha256 IS NOT NULL',t.id),
 sql(c,'INSERT OR IGNORE INTO tt_erased_document_files(sha256) SELECT s.photo_sha256 FROM tt_thread_service s JOIN tt_threads r ON r.id=s.thread_id WHERE r.tenancy_id=? AND s.photo_sha256 IS NOT NULL',t.id),
 sql(c,'INSERT OR IGNORE INTO tt_erased_document_files(sha256) SELECT b.pdf_sha256 FROM tt_print_batches b WHERE b.id IN (SELECT i.batch_id FROM tt_print_items i JOIN tt_threads r ON r.id=i.thread_id WHERE r.tenancy_id=?)',t.id),
 sql(c,'INSERT OR IGNORE INTO tt_erased_document_files(sha256) SELECT i.pdf_sha256 FROM tt_print_items i WHERE i.batch_id IN (SELECT x.batch_id FROM tt_print_items x JOIN tt_threads r ON r.id=x.thread_id WHERE r.tenancy_id=?)',t.id),
 sql(c,'DELETE FROM tt_print_batches WHERE id IN (SELECT i.batch_id FROM tt_print_items i JOIN tt_threads r ON r.id=i.thread_id WHERE r.tenancy_id=?)',t.id),
 ...['tt_resident_document_shares','tt_threads','tt_messages','tt_message_contacts','tt_action_requests','tt_move_checklists','tt_emergencies','tt_schedules','tt_maintenance_jobs','tt_inspections','tt_assets','tt_household_members','tt_renewal_events','tt_renewals','tt_workflow_events','tt_workflow_runs','tt_lease_history','tt_recovery_authorizations'].map(table=>sql(c,`DELETE FROM ${table} WHERE tenancy_id=?`,t.id)),
 ...await leaseErasureStatements(c,t.id),
 referralErasure(c,t.id),
 ...documentErasureStatements(c,t.id,['lease','screening','communications']),
 ...await portalErasureStatements(c,t.id),
 sql(c,'UPDATE tt_privacy_requests SET completed_at=? WHERE id=?',c.now,request.id),sql(c,'UPDATE tt_tenancies SET custody_retired_at=?,import_revision=NULL WHERE id=?',c.now,t.id)]
 if(!review.personalRetained){
  native.push(guard(c,"NOT EXISTS(SELECT 1 FROM tt_legal_holds WHERE tenancy_id=? AND released_at IS NULL AND class IN ('all','accounting'))",t.id),sql(c,'INSERT INTO tt_erasure_work(tenancy_id) VALUES(?)',t.id), sql(c,"DELETE FROM rer_mail_event_receipts WHERE json_extract(event_json,'$.deliveryId') IN (SELECT id FROM tt_resident_deliveries WHERE tenancy_id=?) OR json_extract(event_json,'$.providerMessageId') IN (SELECT provider_id FROM tt_resident_deliveries WHERE tenancy_id=?)",t.id,t.id),
 sql(c,"DELETE FROM rer_mail_event_states WHERE EXISTS(SELECT 1 FROM tt_resident_deliveries d WHERE d.tenancy_id=? AND (provider_message_id=d.provider_id OR substr(provider_message_id,1,length(d.provider_id)+1)=d.provider_id||'.') AND recipient=d.recipient)",t.id),
 sql(c,'DELETE FROM tt_resident_deliveries WHERE tenancy_id=?',t.id),
...documentErasureStatements(c,t.id,['accounting']),...hapRemittanceErasureStatements(c,t.id),sql(c,'DELETE FROM tt_hap_changes WHERE tenancy_id=? AND approved_at IS NULL',t.id),sql(c,"UPDATE tt_hap_changes SET payer='Retained housing authority',reference=id,reason='Retained accounting record',notice_version_id=NULL WHERE tenancy_id=?",t.id),...await billErasureStatements(c,t.id),
   sql(c,"UPDATE tt_fees SET source_label='Retained accounting record',override_reason=NULL WHERE source='lease:'||? OR source IN (SELECT 'receipt:'||r.id FROM tt_receipts r JOIN tt_charges q ON q.id=r.charge_id WHERE q.tenancy_id=?) OR source IN (SELECT 'renewal:'||p.id FROM tt_proposals p WHERE p.tenancy_id=?)",t.id,t.id,t.id),
   sql(c,"UPDATE tt_charges SET description='Retained accounting record',reference=id WHERE tenancy_id=?",t.id),
   sql(c,'UPDATE tt_journal SET reference=id WHERE tenancy_id=?',t.id),
   sql(c,"UPDATE tt_payments SET payer_name='Retained resident',payer_id=NULL,reference=id WHERE tenancy_id=?",t.id),
   sql(c,"UPDATE tt_payment_policies SET reference=id WHERE tenancy_id=?",t.id),
   sql(c,"UPDATE tt_late_fee_policies SET reference=id WHERE tenancy_id=?",t.id),
   sql(c,"UPDATE tt_financial_revisions SET payload=json_set(payload,'$.payee','Retained resident','$.forwardingAddress',NULL,'$.reason','Retained accounting record','$.reference',action_id) WHERE action_id IN (SELECT id FROM tt_financial_actions WHERE tenancy_id=?)",t.id),
   sql(c,"UPDATE tt_refund_checks SET snapshot=json_set(snapshot,'$.payee','Retained resident','$.forwardingAddress',NULL,'$.reason','Retained accounting record','$.reference',action_id) WHERE action_id IN (SELECT id FROM tt_financial_actions WHERE tenancy_id=?)",t.id),
   sql(c,"UPDATE tt_financial_recordings SET reference=id WHERE action_id IN (SELECT id FROM tt_financial_actions WHERE tenancy_id=?)",t.id),
   sql(c,"UPDATE tt_financial_cancellations SET reason='Retained accounting record' WHERE action_id IN (SELECT id FROM tt_financial_actions WHERE tenancy_id=?)",t.id),
   sql(c,"UPDATE tt_late_fee_waivers SET reason='Retained accounting record' WHERE fee_id IN (SELECT f.id FROM tt_late_fees f JOIN tt_charges q ON q.id=f.fee_charge_id WHERE q.tenancy_id=?)",t.id),
   sql(c,"UPDATE tt_late_fees SET snapshot=json_set(snapshot,'$.description','Retained accounting record') WHERE fee_charge_id IN (SELECT id FROM tt_charges WHERE tenancy_id=?)",t.id),
   sql(c,"UPDATE tt_payment_events SET reference=id WHERE payment_id IN (SELECT id FROM tt_payments WHERE tenancy_id=?)",t.id),
   sql(c,"UPDATE tt_receipt_reversals SET reference=id,reason='Retained accounting record' WHERE receipt_id IN (SELECT r.id FROM tt_receipts r JOIN tt_charges q ON q.id=r.charge_id WHERE q.tenancy_id=?)",t.id),
   sql(c,'UPDATE tt_receipts SET reference=id WHERE charge_id IN (SELECT id FROM tt_charges WHERE tenancy_id=?)',t.id),
   sql(c,"UPDATE tt_hap_charges SET payer='Retained housing authority',contract_reference=id,source_clause='Retained accounting record' WHERE tenancy_id=?",t.id),
   sql(c,"UPDATE tt_adjustments SET reason='Retained accounting record',reference=NULL WHERE charge_id IN (SELECT id FROM tt_charges WHERE tenancy_id=?)",t.id),
   sql(c,'UPDATE tt_audit SET subject=tenancy_id,source=NULL WHERE tenancy_id=?',t.id))
  for(const run of await all(c,'SELECT id,snapshot FROM tt_late_fee_runs WHERE tenancy_id=?',t.id)){
   const snapshot=JSON.parse(run.snapshot);for(const line of snapshot.lines)line.description='Retained accounting record'
   native.push(sql(c,'UPDATE tt_late_fee_runs SET snapshot=? WHERE id=?',JSON.stringify(snapshot),run.id))
  }
  for(const close of await all(c,'SELECT id,statement FROM tt_period_closes')){
   const rows=JSON.parse(close.statement);let changed=false
   for(const row of rows)if(row.tenancyId===t.id){row.reference=row.id;changed=true}
   if(changed)native.push(sql(c,'UPDATE tt_period_closes SET statement=? WHERE id=?',JSON.stringify(rows),close.id))
  }
  for(const correction of await all(c,'SELECT id,payload FROM tt_close_corrections WHERE tenancy_id=?',t.id)){
   const payload=JSON.parse(correction.payload);if(payload.description)payload.description='Retained accounting record';if(payload.reference)payload.reference=correction.id
   native.push(sql(c,"UPDATE tt_close_corrections SET payload=?,reason='Retained accounting record' WHERE id=?",JSON.stringify(payload),correction.id))
  }
  native.push(sql(c,'DELETE FROM tt_delinquency_assignments WHERE tenancy_id=?',t.id),sql(c,'DELETE FROM tt_delinquency_assignment_events WHERE tenancy_id=?',t.id),sql(c,'DELETE FROM tt_proposals WHERE tenancy_id=?',t.id),sql(c,'DELETE FROM tt_lease_terms WHERE tenancy_id=?',t.id),
   sql(c,"UPDATE tt_tenancies SET tenant_name=?,tenant_email=?,address=?,owner_name='Retained owner',owner_email='retained@invalid.test',import_revision=NULL,erased_at=?,version=version+1 WHERE id=?",alias,alias+'@invalid.test','Retained tenancy '+t.id,c.now,t.id),
   sql(c,"UPDATE tt_legal_holds SET reason='Released legal hold',release_reason=CASE WHEN released_at IS NULL THEN NULL ELSE 'Released by owner' END WHERE tenancy_id=?",t.id),
   sql(c,"UPDATE tt_privacy_requests SET source='Resident request recorded by staff',review=NULL WHERE tenancy_id=?",t.id),sql(c,'DELETE FROM tt_erasure_work WHERE tenancy_id=?',t.id))
 }else native.push(sql(c,'UPDATE tt_tenancies SET version=version+1 WHERE id=?',t.id))
 c.source=null
 native.push(audit(c,'tenancy.erase',t.id))
 await retireTenancy(c,t,native,checkpoint)
 return {tenancyId:review.personalRetained?t.id:'',kept:review.kept,alias:review.personalRetained?null:alias,notice:review.personalRetained?'Eligible lease evidence and import custody erased. Accounting identity remains retained; amounts and close evidence are kept.':'Eligible tenancy evidence and import custody erased. Financial evidence remains under an opaque alias. Download a new backup to retain the restore fence.'}
}
