import {tenancyGuard,all,allow,can,cents,commit,date,guard,id,insist,one,sha256,shown,sql,tenancy,text,type Context,type Row} from './core'
import {BALANCE} from './ledger'
import {RESERVED} from './payments'
import {independence} from './dual-control'
import {split} from './owners'
import {localDate} from './zones'
export const FINANCIAL_COMMANDS=['finance.prepare','finance.revise','finance.approve','finance.record','finance.check','finance.cancel']
const hash=(v:unknown)=>sha256(new TextEncoder().encode(JSON.stringify(v)))
const eligible=(c:Context)=>c.actor.role==='owner'||c.actor.staff?.role==='portfolio_manager'
async function action(c:Context,value:unknown):Promise<Row>{
 const a=await one(c,'SELECT * FROM tt_financial_actions WHERE id=?',text(value,'Financial action',100));insist(a,'not_found','Financial action not found.',404);await tenancy(c,a.tenancy_id)
 const r=await one(c,'SELECT * FROM tt_financial_revisions WHERE action_id=? AND version=?',a.id,a.version),cancellation=await one(c,'SELECT * FROM tt_financial_cancellations WHERE action_id=? AND version=?',a.id,a.version);return{...a,state:cancellation?'cancelled':a.state,cancellation,revision:r!,payload:JSON.parse(r!.payload),source:JSON.parse(r!.source_snapshot)}
}
async function input(c:Context,p:Row,kind:string){
 insist(['refund','credit','write_off'].includes(kind),'financial_kind','Choose refund, credit or write_off.')
 const receipt=kind==='refund'?await one(c,'SELECT * FROM tt_receipts WHERE id=?',text(p.receiptId,'Original receipt',100)):null
 insist(kind!=='refund'||receipt,'not_found','Original receipt not found.',404)
 const q=await one(c,'SELECT * FROM tt_charges WHERE id=?',receipt?.charge_id??text(p.chargeId,'Charge',100));insist(q,'not_found','Charge not found.',404)
 const t=await tenancy(c,q.tenancy_id),on=date(p.on)
 insist(shown(t)==='USD','currency','Financial actions require confirmed USD.',409)
 insist(on<=localDate(c.now,t.time_zone)&&(!receipt||on>=receipt.received_date),'invalid_date','Use an elapsed property-local day, no earlier than the original receipt.')
 const payload:Row={kind,chargeId:q.id,receiptId:receipt?.id??null,amountCents:cents(p.amount),on,reason:text(p.reason,'Financial reason',1000),reference:text(p.reference,'Preparation source',500),payee:kind==='refund'?text(p.payee,'Exact refund payee',200):null,method:kind==='refund'?String(p.method):null,forwardingAddress:null,checkNumber:null}
 if(kind==='refund'){
  insist(payload.method!=='original'||receipt?.method,'source_method_required','Record the original payment method before preparing an original-method refund.',409)
  insist(['original','ach','check'].includes(payload.method),'refund_method','Choose original method, ACH or check.')
  if(payload.method==='check'){payload.forwardingAddress=text(p.forwardingAddress,'Forwarding mailing address',500);payload.checkNumber=text(p.checkNumber,'External check number',30);insist(/^[0-9]{1,20}$/.test(payload.checkNumber),'check_number','Use the bank check number, digits only.')}
 }
 return{t,payload}
}
const AVAILABLE=`r.amount_cents-CASE WHEN EXISTS(SELECT 1 FROM tt_receipt_reversals WHERE receipt_id=r.id) THEN r.amount_cents ELSE 0 END-COALESCE((SELECT SUM(amount_cents) FROM tt_financial_recordings WHERE receipt_id=r.id),0)-COALESCE((SELECT SUM(json_extract(v.payload,'$.amountCents')) FROM tt_financial_actions a JOIN tt_financial_revisions v ON v.action_id=a.id AND v.version=a.version WHERE a.state='approved' AND a.kind='refund' AND json_extract(v.payload,'$.receiptId')=r.id AND a.id<>?),0)`
async function source(c:Context,p:Row,exclude=''){
 const q=await one(c,`SELECT q.*,${BALANCE} AS balance_cents,${RESERVED} AS reserved_cents,u.property_id FROM tt_charges q JOIN tt_tenancies t ON t.id=q.tenancy_id LEFT JOIN tt_units u ON u.id=t.unit_id WHERE q.id=?`,p.chargeId);insist(q,'not_found','Source charge not found.',404)
 const t=await tenancy(c,q.tenancy_id)
 const receipt=p.receiptId?await one(c,`SELECT r.*,${AVAILABLE} AS available,r.amount_cents-COALESCE((SELECT SUM(amount_cents) FROM tt_financial_recordings WHERE receipt_id=r.id),0) AS unrefunded FROM tt_receipts r WHERE r.id=?`,exclude,p.receiptId):null
 const available=receipt?receipt.available:q.balance_cents-q.reserved_cents
 insist(p.amountCents<=available,'excessive_financial_action','The action exceeds the available original receipt or unreserved unpaid charge.',409)
 let shares:Row[]=[],setId:string|null=null
 if(receipt){
  const original=await all(c,"SELECT j.owner_key AS owner_id,SUM(l.debit_cents)-COALESCE((SELECT SUM(f.credit_cents) FROM tt_journal jf JOIN tt_journal_lines f ON f.id=jf.id AND f.account='cash' JOIN tt_financial_recordings x ON x.id=jf.source_id WHERE jf.source_kind='refund' AND jf.owner_key=j.owner_key AND x.receipt_id=?),0) AS amount FROM tt_journal j JOIN tt_journal_lines l ON l.id=j.id AND l.account='cash' WHERE j.source_kind='receipt' AND j.source_id=? GROUP BY j.owner_key ORDER BY amount DESC,j.owner_key",receipt.id,receipt.id)
  insist(original.length,'receipt_ledger','The receipt has no confirmed USD owner allocation.',409)
  insist(original.every(r=>r.amount>=0),'refund_owner_hold','Prior owner refund allocations need manual reconciliation before another refund.',409)
  const remaining=original.reduce((n,r)=>n+r.amount,0);insist(remaining===receipt.unrefunded,'refund_owner_hold','Original-owner entries do not reconcile to the unrefunded receipt; review the source.',409);insist(remaining>0,'refund_owner_hold','No original-owner receipt amount remains.',409)
  const allocated=original.map(r=>({ownerId:r.owner_id,cents:Number(BigInt(p.amountCents)*BigInt(r.amount)/BigInt(remaining))}));let rest=p.amountCents-allocated.reduce((n,r)=>n+r.cents,0)
  for(let i=0;i<allocated.length&&rest>0;i++){const extra=Math.min(rest,original[i].amount-allocated[i].cents);allocated[i].cents+=extra;rest-=extra}
  insist(rest===0,'refund_owner_hold','Owner refund capacity needs manual review.',409);shares=allocated
 }else{
  const set=await one(c,'SELECT id FROM tt_ownership_sets WHERE property_id=? AND effective_from<=? ORDER BY effective_from DESC LIMIT 1',q.property_id,p.on);setId=set?.id??null
  shares=set?split(p.amountCents,await all(c,'SELECT * FROM tt_ownership_shares WHERE set_id=? ORDER BY position',set.id)):[{ownerId:'lease-owner:'+q.tenancy_id,cents:p.amountCents}]
 }
 const effects:Row[]=[]
 for(const s of shares){
  const balances=await one(c,"SELECT COALESCE(SUM(CASE WHEN l.account='cash' THEN l.debit_cents-l.credit_cents ELSE 0 END),0) AS cash,COALESCE(SUM(CASE WHEN l.account='receivable' THEN l.debit_cents-l.credit_cents ELSE 0 END),0) AS receivable,COALESCE(SUM(CASE WHEN l.account='lease_income' THEN l.credit_cents-l.debit_cents ELSE 0 END),0) AS income FROM tt_journal j JOIN tt_journal_lines l ON l.id=j.id WHERE j.property_id IS ? AND j.owner_key=? AND j.fund='operating'",q.property_id,s.ownerId)
  if(p.kind==='refund')insist(balances!.cash>=s.cents,'insufficient_owner_funds','This original owner has insufficient recorded property operating cash for the refund.',409)
  const delta={cash:p.kind==='refund'?-s.cents:0,receivable:p.kind==='refund'?s.cents:-s.cents,income:p.kind==='refund'||q.tax_rule_id?0:-s.cents}
  effects.push({ownerId:s.ownerId,amountCents:s.cents,before:balances,delta,after:{cash:balances!.cash+delta.cash,receivable:balances!.receivable+delta.receivable,income:balances!.income+delta.income}})
 }
 const snapshot={tenancyId:q.tenancy_id,tenancyVersion:t.version,chargeId:q.id,chargeCents:q.amount_cents,balanceCents:q.balance_cents,reservedCents:q.reserved_cents,availableCents:available,receiptId:receipt?.id??null,receiptCents:receipt?.amount_cents??null,receiptUnrefundedCents:receipt?.unrefunded??null,receiptMethod:receipt?.method??null,propertyId:q.property_id??null,ownershipSetId:setId,residentBeforeCents:q.balance_cents,residentAfterCents:q.balance_cents+(p.kind==='refund'?p.amountCents:-p.amountCents),ownerEffects:effects}
 const guards=[tenancyGuard(c,t),guard(c,`(SELECT ${BALANCE} FROM tt_charges q WHERE id=?)=?`,q.id,q.balance_cents),guard(c,`(SELECT ${RESERVED} FROM tt_charges q WHERE id=?)=?`,q.id,q.reserved_cents)]
 if(receipt)guards.push(guard(c,`(SELECT ${AVAILABLE} FROM tt_receipts r WHERE r.id=?)=?`,exclude,receipt.id,available),guard(c,'(SELECT r.amount_cents-COALESCE((SELECT SUM(amount_cents) FROM tt_financial_recordings WHERE receipt_id=r.id),0) FROM tt_receipts r WHERE r.id=?)=?',receipt.id,receipt.unrefunded))
 else guards.push(guard(c,'(SELECT id FROM tt_ownership_sets WHERE property_id=? AND effective_from<=? ORDER BY effective_from DESC LIMIT 1) IS ?',q.property_id,p.on,setId))
 for(const s of effects)for(const [account,value]of [['cash',s.before.cash],['receivable',s.before.receivable],['lease_income',-s.before.income]])guards.push(guard(c,`(SELECT COALESCE(SUM(l.debit_cents-l.credit_cents),0) FROM tt_journal j JOIN tt_journal_lines l ON l.id=j.id WHERE j.property_id IS ? AND j.owner_key=? AND j.fund='operating' AND l.account=?)=?`,q.property_id,s.ownerId,account,value))
 return{snapshot,guards}
}
export async function financialData(c:Context,tenancyId:string){
 await tenancy(c,tenancyId);if(!eligible(c)||c.actor.credential)return{restricted:true,actions:[],checks:[],ownerNames:{}}
 const actions=await all(c,'SELECT id FROM tt_financial_actions WHERE tenancy_id=? ORDER BY created_at,id',tenancyId)
 const items:Row[]=await Promise.all(actions.map(async r=>{const a=await action(c,r.id);return{...a,approvals:await all(c,'SELECT * FROM tt_financial_approvals WHERE action_id=? ORDER BY version',a.id),recording:await one(c,'SELECT * FROM tt_financial_recordings WHERE action_id=?',a.id)}}))
 const ids=[...new Set(items.flatMap(a=>a.source.ownerEffects.map((o:Row)=>o.ownerId)))],ownerNames=Object.fromEntries((await all(c,'SELECT id,legal_name FROM tt_owners WHERE id IN (SELECT value FROM json_each(?))',JSON.stringify(ids))).map(o=>[o.id,o.legal_name]))
 return{restricted:false,ownerNames,actions:items,checks:await all(c,"SELECT x.*,a.version AS current_version,CASE WHEN c.action_id IS NOT NULL THEN 'cancelled' ELSE a.state END AS action_state FROM tt_refund_checks x JOIN tt_financial_actions a ON a.id=x.action_id LEFT JOIN tt_financial_cancellations c ON c.action_id=x.action_id AND c.version=x.version WHERE a.tenancy_id=? ORDER BY x.prepared_at",tenancyId)}
}
export async function financialCommand(c:Context,command:string,p:Row):Promise<Row|undefined>{
 if(!FINANCIAL_COMMANDS.includes(command))return
 allow(c,command);insist(eligible(c)&&!c.actor.credential,'forbidden','Only the owner or an in-scope portfolio manager handles these financial actions.',403)
 if(command==='finance.prepare'||command==='finance.revise'){
  const old=command==='finance.revise'?await action(c,p.actionId):null
  insist(!old||!['recorded','cancelled'].includes(old.state),'financial_state','A recorded action is immutable; prepare a new correction.',409)
  if(old)insist(Number(p.version)===old.version,'conflict','Review the current revision.',409)
  const {t,payload}=await input(c,p,old?.kind??p.kind);insist(!old||old.tenancy_id===t.id,'source_lease','A revised source must belong to the same tenancy.',409)
  const key=old?.id??id(),version=(old?.version??0)+1,current=await source(c,payload,key),fingerprint=await hash({payload,source:current.snapshot})
  const writes=[tenancyGuard(c,t),...current.guards]
  if(old)writes.push(guard(c,"EXISTS(SELECT 1 FROM tt_financial_actions WHERE id=? AND version=? AND state<>'recorded')",key,old.version),sql(c,"UPDATE tt_financial_actions SET version=?,state='pending',revised_by=? WHERE id=?",version,c.actor.id,key))
  else writes.push(sql(c,"INSERT INTO tt_financial_actions(id,tenancy_id,kind,version,state,prepared_by,revised_by,created_at) VALUES(?,?,?,?,'pending',?,?,?)",key,t.id,payload.kind,version,c.actor.id,c.actor.id,c.now))
  writes.push(sql(c,'INSERT INTO tt_financial_revisions(action_id,version,payload,source_snapshot,fingerprint,prepared_by,prepared_at) VALUES(?,?,?,?,?,?,?)',key,version,JSON.stringify(payload),JSON.stringify(current.snapshot),fingerprint,c.actor.id,c.now))
  await commit(c,writes,command,key)
  return{id:key,tenancyId:t.id,version,fingerprint,source:current.snapshot,notice:'Exact financial action prepared with resident and owner effects. Prior approval is invalid; nothing sent or posted.'}
 }
 const a=await action(c,p.actionId),r=a.revision
 insist(Number(p.version)===a.version&&p.fingerprint===r.fingerprint,'review_changed','The financial revision changed; review and approve it again.',409)
 if(command==='finance.record'&&a.state==='recorded'){
  const x=await one(c,'SELECT * FROM tt_financial_recordings WHERE action_id=?',a.id);insist(x?.reference===p.externalReference,'already_recorded','A different external reference cannot replay this financial action.',409);return{id:x!.id,tenancyId:a.tenancy_id,replayed:true,notice:'The same external action was already recorded once.'}
 }
 if(command==='finance.cancel'){
  if(a.state==='cancelled')return{id:a.id,tenancyId:a.tenancy_id,replayed:true,notice:'This action was already cancelled; no reservation remains.'}
  insist(a.state!=='recorded','financial_state','A recorded financial action cannot be cancelled; prepare a correction.',409)
  const reason=text(p.reason,'Cancellation reason',1000),t=await tenancy(c,a.tenancy_id)
  await commit(c,[tenancyGuard(c,t),guard(c,"EXISTS(SELECT 1 FROM tt_financial_actions WHERE id=? AND version=? AND state IN ('pending','approved'))",a.id,a.version),sql(c,'INSERT INTO tt_financial_cancellations(action_id,version,reason,cancelled_by,cancelled_at) VALUES(?,?,?,?,?)',a.id,a.version,reason,c.actor.id,c.now),sql(c,"UPDATE tt_financial_actions SET state='pending' WHERE id=?",a.id)],command,a.id)
  return{id:a.id,tenancyId:a.tenancy_id,notice:'Unexecuted financial action cancelled; source reservation released. History retained.'}
 }
 insist(a.state!=='cancelled','financial_state','A cancelled action cannot execute or be reapproved. Prepare a new action.',409)
 const current=await source(c,a.payload,a.id)
 insist(JSON.stringify(current.snapshot)===r.source_snapshot,'source_changed','The source balance, reservation or owner effects changed after preparation. Revise and approve again.',409)
 const writes=[guard(c,'EXISTS(SELECT 1 FROM tt_financial_actions WHERE id=? AND version=? AND state=?)',a.id,a.version,a.state),...current.guards]
 if(command==='finance.approve'){
  insist(a.state==='pending','financial_state','Only a pending exact revision can be approved.',409)
  const independent=await independence(c,command,[a.prepared_by,a.revised_by]);writes.push(...independent.guards,sql(c,'INSERT INTO tt_financial_approvals(action_id,version,fingerprint,approved_by,approved_at,approval_label) VALUES(?,?,?,?,?,?)',a.id,a.version,r.fingerprint,c.actor.id,c.now,independent.label),sql(c,"UPDATE tt_financial_actions SET state='approved' WHERE id=?",a.id))
  await commit(c,writes,command,a.id)
  return{id:a.id,tenancyId:a.tenancy_id,notice:'Exact payee, amount, source and owner effects approved. No refund or check sent.'}
 }
 insist(a.state==='approved','financial_state','The unchanged action needs human approval first.',409)
 const approval=await one(c,'SELECT * FROM tt_financial_approvals WHERE action_id=? AND version=?',a.id,a.version);insist(approval,'financial_state','Current approval not found.',409)
 // A departed, demoted or out-of-portfolio approver cannot authorize later execution recording.
 const live=`EXISTS(SELECT 1 FROM oa_operators o WHERE o.id=? AND o.status='active' AND (o.role='owner' OR EXISTS(SELECT 1 FROM tt_staff_roles s WHERE s.operator_id=o.id AND s.role='portfolio_manager' AND (s.all_portfolios=1 OR EXISTS(SELECT 1 FROM tt_role_portfolios f WHERE f.operator_id=o.id AND f.portfolio_id=(SELECT portfolio_id FROM tt_properties WHERE id=?))))))`
 insist(await one(c,'SELECT 1 WHERE '+live,approval!.approved_by,current.snapshot.propertyId),'approval_authority','The approver no longer has authority in this portfolio; prepare new approval.',409);writes.push(guard(c,live,approval!.approved_by,current.snapshot.propertyId))
 if(command==='finance.check'){
  insist(a.kind==='refund'&&a.payload.method==='check','check_method','Only an approved forwarding-address check refund has a draft register entry.',409)
  const old=await one(c,'SELECT * FROM tt_refund_checks WHERE action_id=? AND version=?',a.id,a.version)
  if(!old){writes.push(sql(c,"INSERT INTO tt_refund_checks(action_id,version,number,state,snapshot,prepared_by,prepared_at) VALUES(?,?,?,'draft',?,?,?)",a.id,a.version,a.payload.checkNumber,JSON.stringify(a.payload),c.actor.id,c.now));await commit(c,writes,command,a.id)}
  return{id:a.id,tenancyId:a.tenancy_id,notice:'Non-negotiable refund check draft registered. No check was printed, mailed or issued.'}
 }
 insist(p.confirm==='RECORDED','external_confirmation','Type RECORDED only after checking the actual external refund or approved correction.')
 const key=id(),external=text(p.externalReference,'Unique external execution or correction reference',150)
 if(a.kind==='refund'&&a.payload.method==='check'){
  insist(await one(c,'SELECT 1 FROM tt_refund_checks WHERE action_id=? AND version=?',a.id,a.version),'check_register','Register the approved check draft before recording external issuance.',409)
  writes.push(sql(c,"UPDATE tt_refund_checks SET state='recorded_external' WHERE action_id=? AND version=?",a.id,a.version))
 }
 if(a.kind!=='refund')writes.push(sql(c,'INSERT INTO tt_adjustments(id,charge_id,amount_cents,reason,at,currency,reference,posting_day) VALUES(?,?,?,?,?,?,?,?)',key,a.payload.chargeId,a.payload.amountCents,a.kind.replace('_',' ') + ': '+a.payload.reason,c.now,'USD','financial:'+a.id,a.payload.on))
 writes.push(sql(c,'INSERT INTO tt_financial_recordings(id,action_id,version,receipt_id,amount_cents,on_day,reference,recorded_by,recorded_at) VALUES(?,?,?,?,?,?,?,?,?)',key,a.id,a.version,a.payload.receiptId,a.payload.amountCents,a.payload.on,external,c.actor.id,c.now),sql(c,"UPDATE tt_financial_actions SET state='recorded' WHERE id=?",a.id))
 await commit(c,writes,command,a.id)
 return{id:key,tenancyId:a.tenancy_id,notice:a.kind==='refund'?'External refund recorded once in resident and original-owner ledgers. Original receipt retained; no instruction sent.':'Approved financial correction posted once with its reason and owner effects.'}
}
