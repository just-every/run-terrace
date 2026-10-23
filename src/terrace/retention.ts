import { moveChecklistData } from './move-checklists'
/** SAFE-004. Calendar-year default retention, with owner-only legal holds. PORT-008 may only lengthen these. */
import { all, allow, commit, guard, id, insist, one, sha256, sql, tenancy, text, type Context, type Row } from './core'
import { billRetentionDay,billSharedHolds,residentBillSources } from './bills-retention'
import { leaseData } from './lease-versions'
import { localDate } from './zones'
export const RETENTION_COMMANDS=['privacy.request','privacy.review','privacy.hold','privacy.release']
export const CLASSES=['lease','accounting','screening','communications','all']
export const DEFAULTS={lease:7,accounting:7,screening:2,adverseScreening:5,communications:3}
// Anniversary of the last retained day, inclusive. Feb 29 clamps to Feb 28 in a non-leap year.
export function retainedThrough(day:string,years:number){const y=Number(day.slice(0,4))+years,m=day.slice(5,7),d=Math.min(Number(day.slice(8,10)),new Date(Date.UTC(y,Number(m),0)).getUTCDate());return `${y}-${m}-${String(d).padStart(2,'0')}`}
export async function retentionReview(c:Context,t:Row){
 const today=localDate(c.now,t.time_zone),holds=await all(c,'SELECT * FROM tt_legal_holds WHERE tenancy_id=? AND released_at IS NULL ORDER BY placed_at',t.id)
 const accounting=await one<Row>(c,`SELECT MAX(day) AS day FROM (SELECT due_date AS day FROM tt_charges WHERE tenancy_id=? UNION ALL SELECT r.received_date FROM tt_net_receipts r JOIN tt_charges q ON q.id=r.charge_id WHERE q.tenancy_id=? UNION ALL SELECT MAX(received_date) FROM tt_payments WHERE tenancy_id=? UNION ALL SELECT day FROM tt_journal WHERE tenancy_id=? UNION ALL SELECT substr(a.at,1,10) FROM tt_adjustments a JOIN tt_charges q ON q.id=a.charge_id WHERE q.tenancy_id=?)`,t.id,t.id,t.id,t.id,t.id)
 const assignmentDays=(await all(c,'SELECT assigned_at FROM tt_delinquency_assignment_events WHERE tenancy_id=?',t.id)).map(a=>localDate(a.assigned_at,t.time_zone))
 const docDays=Object.fromEntries((await all(c,'SELECT retention_class AS class,MAX(created_at) AS day FROM (SELECT d.retention_class,v.uploaded_at AS created_at FROM tt_documents d JOIN tt_document_versions v ON v.document_id=d.id WHERE d.tenancy_id=?) GROUP BY retention_class',t.id)).map(r=>[r.class,localDate(r.day,t.time_zone)]))
 const billDay=await billRetentionDay(c,t.id),sharedHolds=await billSharedHolds(c,t.id),accountingDay=[accounting?.day,billDay,docDays.accounting,...assignmentDays].filter(Boolean).sort().at(-1)
 const leaseThrough=retainedThrough(t.end_date,7),accountingThrough=accountingDay?retainedThrough(accountingDay.slice(0,4)+'-12-31',7):null
 holds.push(...sharedHolds.map(h=>({...h,class:'accounting',reason:'Shared accounting evidence: '+h.reason})))
 const classes=[{class:'lease',through:leaseThrough,reason:'Lease: 7 years after lease end',present:true},{class:'accounting',through:accountingThrough,reason:'Accounting: 7 years after the calendar fiscal year; ledger amounts and close evidence remain permanently under an opaque alias',present:!!accountingThrough},{class:'screening',through:docDays.screening?retainedThrough(docDays.screening,2):null,reason:docDays.screening?'Screening documents: 2 years after the last upload (PORT-007). LEASE-009 inherits 2 years after decision, 5 years for adverse action.':'No screening records exist. LEASE-009 inherits 2 years after decision, 5 years for adverse action.',present:!!docDays.screening},{class:'communications',through:docDays.communications?retainedThrough(docDays.communications,3):null,reason:docDays.communications?'Notice documents: 3 years after the last upload (PORT-007). PORTAL-005/PORTAL-006 inherit 3 years after communication.':'No delivered resident communications exist. PORTAL-005/PORTAL-006 inherit 3 years after communication.',present:!!docDays.communications}].map(r=>({...r,holds:holds.filter(h=>h.class===r.class||h.class==='all'),retained:!!(r.through&&today<=r.through)||holds.some(h=>h.class===r.class||h.class==='all')}))
 // Photos, inspection originals and work approvals are lease evidence, not automatically disposable messages.
 const lease=classes.find(x=>x.class==='lease')!,account=classes.find(x=>x.class==='accounting')!
 const personalRetained=lease.retained||account.retained
 const result={tenancyId:t.id,version:t.version,today,classes,holds,personalRetained,eligible:!lease.retained&&!classes.some(x=>['screening','communications'].includes(x.class)&&x.present&&x.retained),alreadyErased:!!t.erased_at,kept:classes.filter(x=>x.retained).map(x=>({class:x.class,through:x.through,reasons:[x.reason,...x.holds.map(h=>'Legal hold: '+h.reason)]})),ledger:'Amounts, dates, currency and accounting links are never erased. Personal free text is redacted when lease and accounting retention and holds permit.'}
 return {...result,fingerprint:await sha256(new TextEncoder().encode(JSON.stringify(result)))}
}
export async function retentionData(c:Context,rows:Row[]){if(c.actor.role!=='owner')return [];return Promise.all(rows.map(async t=>({tenancy:t,review:await retentionReview(c,t),requests:await all(c,'SELECT * FROM tt_privacy_requests WHERE tenancy_id=? ORDER BY requested_at DESC',t.id),holds:await all(c,'SELECT * FROM tt_legal_holds WHERE tenancy_id=? ORDER BY placed_at DESC',t.id)})))}
export async function retentionCommand(c:Context,command:string,p:Row):Promise<Row|undefined>{
 if(!RETENTION_COMMANDS.includes(command))return
 allow(c,command)
 const t=await tenancy(c,p.tenancyId)
 if(command==='privacy.request'){
  insist(['access','erase'].includes(p.kind),'request_kind','Choose access or erasure.')
  const key=id(),source=text(p.source,'Resident request reference',500)
  await commit(c,[sql(c,'INSERT INTO tt_privacy_requests(id,tenancy_id,kind,source,requested_by,requested_at) VALUES(?,?,?,?,?,?)',key,t.id,p.kind,source,c.actor.id,c.now)],command,key)
  return {id:key,tenancyId:t.id,notice:'Resident request recorded by staff. Terrace has not contacted the resident.'}
 }
 if(command==='privacy.hold'){
  insist(CLASSES.includes(p.class),'retention_class','Choose a retention class.')
  const key=id();await commit(c,[sql(c,'INSERT INTO tt_legal_holds(id,tenancy_id,class,reason,placed_by,placed_at) VALUES(?,?,?,?,?,?)',key,t.id,p.class,text(p.reason,'Legal hold reason',1000),c.actor.id,c.now),sql(c,'UPDATE tt_tenancies SET version=version+1 WHERE id=?',t.id)],command,t.id)
  return {id:key,tenancyId:t.id,notice:'Legal hold placed. Review any erasure again.'}
 }
 if(command==='privacy.release'){
  const hold=await one(c,'SELECT * FROM tt_legal_holds WHERE id=? AND tenancy_id=? AND released_at IS NULL',text(p.holdId,'Hold'),t.id);insist(hold,'not_found','Active hold not found.',404)
  await commit(c,[sql(c,'UPDATE tt_legal_holds SET released_by=?,released_at=?,release_reason=? WHERE id=? AND released_at IS NULL',c.actor.id,c.now,text(p.reason,'Release reason',1000),hold.id),sql(c,'UPDATE tt_tenancies SET version=version+1 WHERE id=?',t.id)],command,t.id)
  return {tenancyId:t.id,notice:'Legal hold released. Review retention again before erasure.'}
 }
 const request=await one(c,'SELECT * FROM tt_privacy_requests WHERE id=? AND tenancy_id=?',text(p.requestId,'Request'),t.id);insist(request,'not_found','Request not found.',404)
 const review=await retentionReview(c,t)
 await commit(c,[guard(c,'EXISTS(SELECT 1 FROM tt_tenancies WHERE id=? AND version=?)',t.id,t.version),sql(c,'UPDATE tt_privacy_requests SET review=?,reviewed_at=? WHERE id=?',JSON.stringify(review),c.now,request.id)],command,request.id)
 return {tenancyId:t.id,requestId:request.id,review,notice:'Retention reviewed. Kept records and reasons are listed below.'}
}
/** Owner records the request; no public or bearer identity is implied. Subject-only access omits owner and other household contacts. */
export async function residentAccess(c:Context,tenancyId:unknown){
 allow(c,'privacy.request');const t=await tenancy(c,tenancyId)
 const result={paymentPolicies:await all(c,'SELECT version,terms,reference FROM tt_payment_policies WHERE tenancy_id=? ORDER BY version',t.id),financialActions:await all(c,"SELECT a.kind,a.state,v.version,json_extract(v.payload,'$.amountCents') AS amount_cents,json_extract(v.payload,'$.on') AS on_day,json_extract(v.payload,'$.reason') AS reason,json_extract(v.payload,'$.method') AS method,x.reference AS external_reference FROM tt_financial_actions a JOIN tt_financial_revisions v ON v.action_id=a.id AND v.version=a.version LEFT JOIN tt_financial_recordings x ON x.action_id=a.id WHERE a.tenancy_id=? ORDER BY a.created_at,a.id",t.id),payments:await all(c,'SELECT id,state,amount_cents,credit_cents,method,received_date,reference FROM tt_payments WHERE tenancy_id=?',t.id),journal:await all(c,'SELECT id,day,currency,fund,source_kind,source_id,reference,lines,reversal_of FROM tt_journal WHERE tenancy_id=? ORDER BY day,id',t.id),moveChecklists:await moveChecklistData(c,t.id),documents:await all(c,'SELECT d.id,d.kind,d.title,d.retention_class,v.version,v.name,v.media_type,v.size,v.sha256,v.note,v.uploaded_at FROM tt_documents d JOIN tt_document_versions v ON v.document_id=d.id WHERE d.tenancy_id=? ORDER BY d.created_at,v.version',t.id),followupAssignments:await all(c,'SELECT reference,version,assigned_at FROM tt_delinquency_assignment_events WHERE tenancy_id=? ORDER BY version',t.id),leaseVersions:await leaseData(c,t.id),billSources:await residentBillSources(c,t.id),resident:{name:t.tenant_name,email:t.tenant_email},lease:{id:t.id,address:t.address,start:t.start_date,end:t.end_date,rentCents:t.rent_cents,currency:t.currency},charges:await all(c,'SELECT id,due_date,amount_cents,description,reference,currency FROM tt_charges WHERE tenancy_id=?',t.id),adjustments:await all(c,'SELECT a.id,a.charge_id,a.amount_cents,a.reason,a.at,a.currency FROM tt_adjustments a JOIN tt_charges q ON q.id=a.charge_id WHERE q.tenancy_id=?',t.id),leaseHistory:await all(c,'SELECT start_date,end_date,rent_cents,currency,confirmed_at FROM tt_lease_history WHERE tenancy_id=?',t.id),inspections:await all(c,'SELECT id,inspection_date,notes,state FROM tt_inspections WHERE tenancy_id=?',t.id),media:await all(c,'SELECT p.id,p.filename,p.media_type,p.sha256 FROM tt_inspection_photos p JOIN tt_inspections i ON i.id=p.inspection_id WHERE i.tenancy_id=?',t.id),proposals:await all(c,"SELECT kind,payload,state,prepared_at,approved_at FROM tt_proposals WHERE tenancy_id=? AND kind IN ('renewal','arrears')",t.id),receipts:await all(c,'SELECT r.id,r.charge_id,r.amount_cents,r.received_date,r.reference,r.currency FROM tt_net_receipts r JOIN tt_charges q ON q.id=r.charge_id WHERE q.tenancy_id=?',t.id),retention:await retentionReview(c,t)}
 return new Response(JSON.stringify(result,null,2),{headers:{'content-type':'application/json','content-disposition':'attachment; filename="terrace-resident-access.json"','cache-control':'private, no-store'}})
}
