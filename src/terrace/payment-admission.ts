import {tenancyGuard,all,cents,date,guard,id,insist,one,shown,sql,tenancy,text,type Context,type Row} from './core'
import {BALANCE} from './ledger'
import {localDate} from './zones'
import {rulePreview} from './rule-packs'
export const RESERVED='COALESCE((SELECT amount_cents FROM tt_payment_reserved WHERE charge_id=q.id),0)'
export function stages(v:unknown){
 insist(Array.isArray(v)&&v.length>0&&v.length<=20,'payment_policy','Supply stage rules beginning at zero days past due.')
 let prior=-1
 for(const r of v){insist(Number.isInteger(r.minDaysPastDue)&&r.minDaysPastDue>=0&&r.minDaysPastDue<=3660&&r.minDaysPastDue>prior&&typeof r.allowPartial==='boolean'&&['reject','credit'].includes(r.overpayment),'payment_policy','Stages are ordered unique day thresholds with explicit allowPartial and overpayment.');prior=r.minDaysPastDue}
 insist(v[0].minDaysPastDue===0,'payment_policy','The first stage starts at zero days past due.');return v as Row[]
}
/** Shared PAY-005 policy, capacity and frozen allocation gate for external records and hosted collection. */
export async function preparePayment(c:Context,p:Row){
  const t=await tenancy(c,p.tenancyId),today=localDate(c.now,t.time_zone),day=date(p.receivedDate),amount=cents(p.amount)
  insist(shown(t)==='USD','currency','Split payments require confirmed USD.',409)
  insist(day<=today,'future_receipt','Record only an external payment already initiated or received.')
  insist(['pending','settled'].includes(p.state)&&['ach','card','cash','check','other'].includes(p.method),'payment_state','Choose pending or settled and an external method.')
  const policy=await one(c,'SELECT * FROM tt_payment_policies WHERE tenancy_id=? ORDER BY version DESC LIMIT 1',t.id)
  insist(policy,'payment_policy','Record the approved lease policy first.',409)
  const property=await one(c,'SELECT property_id FROM tt_units WHERE id=?',t.unit_id)
  insist(property,'rule_hold','A property and active reviewed rule pack are required.',409)
  const rule=await rulePreview(c,{propertyId:property.property_id,action:'partial_payment',on:today})
  insist(rule.state==='reviewed_preview','rule_hold',rule.gaps.join('; '),409)
  const qs=await all(c,`SELECT q.*,${BALANCE} AS balance_cents,${RESERVED} AS reserved_cents FROM tt_charges q WHERE tenancy_id=? ORDER BY due_date,id`,t.id),terms=JSON.parse(policy.terms)
  const overdue=Math.max(0,...qs.filter(q=>q.balance_cents>0).map(q=>Math.floor((Date.parse(today)-Date.parse(q.due_date))/86400000)))
  const choose=(s:Row[])=>stages(s).filter(r=>r.minDaysPastDue<=overdue).at(-1)!
  const lease=choose(terms.stages),rules=[lease,...rule.packs.map((r:Row)=>choose(r.fields.partialPayments.value.stages))]
  const available=qs.reduce((n,q)=>n+q.balance_cents-q.reserved_cents,0)
  insist(amount>=available||rules.every(r=>r.allowPartial),'partial_blocked','The reviewed delinquency stage blocks a partial payment.',409)
  const credit=Math.max(0,amount-available)
  insist(!credit||rules.every(r=>r.overpayment==='credit'),'overpayment','The reviewed policy rejects overpayment.',409)
  insist(qs.filter(q=>q.balance_cents>q.reserved_cents).every(q=>terms.priority.includes(q.id)),'payment_priority','Review charge priority to include every unpaid charge.',409)
  let payer=t.tenant_name,payerId:string|null=null,payerSource:Row|null=null
  insist(['resident','co_tenant','housing_authority'].includes(p.payerKind),'payer','Choose a resident, co-tenant or housing authority.')
  const writes:D1PreparedStatement[]=[tenancyGuard(c,t)]
  if(p.payerKind==='co_tenant'){
   const m=await one(c,"SELECT * FROM tt_household_members WHERE id=? AND tenancy_id=? AND role='co_tenant' AND joined<=? AND (left_on IS NULL OR left_on>=?)",text(p.payerId,'Co-tenant',100),t.id,day,day)
   insist(m,'not_found','Co-tenant not found for this lease and payment day.',404);payer=m.name;payerId=m.id;payerSource={memberId:m.id,version:m.version}
   writes.push(guard(c,'EXISTS(SELECT 1 FROM tt_household_members WHERE id=? AND version=?)',m.id,m.version))
  }
  if(p.payerKind==='housing_authority'){
   const v=await one(c,'SELECT id,payload FROM tt_lease_versions WHERE tenancy_id=? AND approved_at IS NOT NULL AND effective<=? ORDER BY effective DESC LIMIT 1',t.id,day)
   const hap=v&&JSON.parse(v.payload).obligations.find((o:Row)=>o.kind==='hap'&&o.housingAuthority&&o.starts<=day&&(!o.ends||o.ends>=day))
   insist(hap,'hap_required','An approved HAP lease obligation is required; PAY-013 owns subsidy reconciliation.',409)
   payer=hap.housingAuthority;payerId=v!.id;payerSource={leaseVersionId:v!.id,reference:hap.reference,sourceClause:hap.sourceClause}
   writes.push(guard(c,'(SELECT id FROM tt_lease_versions WHERE tenancy_id=? AND approved_at IS NOT NULL AND effective<=? ORDER BY effective DESC LIMIT 1)=?',t.id,day,v!.id))
  }
  const key=p.paymentKey??id(),allocations:Row[]=[];let remaining=amount
  for(const qid of terms.priority){const q=qs.find(q=>q.id===qid);if(!q)continue;const n=Math.min(remaining,q.balance_cents-q.reserved_cents);if(n<=0)continue;allocations.push({chargeId:q.id,amountCents:n,receiptId:id()});remaining-=n}
  const snapshot={payerSource,policyVersion:policy.version,leaseStage:lease,daysPastDue:overdue,packs:rule.packs,allocationOrder:terms.priority,availableCents:available,allowPartial:rules.every(r=>r.allowPartial),overpayment:rules.every(r=>r.overpayment==='credit')?'credit':'reject'}
  writes.push(guard(c,'(SELECT id FROM tt_payment_policies WHERE tenancy_id=? ORDER BY version DESC LIMIT 1)=?',t.id,policy.id))
  // Fence the whole balance, including competing reservations and manual corrections, in the write transaction.
  for(const q of qs)writes.push(guard(c,`(SELECT ${BALANCE} FROM tt_charges q WHERE id=?)=?`,q.id,q.balance_cents),guard(c,`(SELECT ${RESERVED} FROM tt_charges q WHERE id=?)=?`,q.id,q.reserved_cents))
  writes.push(guard(c,'(SELECT COUNT(*) FROM tt_charges WHERE tenancy_id=?)=?',t.id,qs.length))
  const jurisdiction=await one(c,'SELECT version FROM tt_property_rules WHERE property_id=?',property.property_id)
  writes.push(guard(c,'(SELECT version FROM tt_property_rules WHERE property_id=?)=?',property.property_id,jurisdiction!.version))
  for(const pack of rule.packs)writes.push(guard(c,'(SELECT id FROM tt_rule_packs WHERE code=? AND effective_from<=? ORDER BY effective_from DESC,version DESC LIMIT 1)=?',pack.code,today,pack.id))
  writes.push(sql(c,'INSERT INTO tt_payments(id,tenancy_id,policy_id,amount_cents,credit_cents,state,payer_kind,payer_id,payer_name,method,received_date,reference,snapshot,recorded_by,recorded_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',key,t.id,policy.id,amount,credit,p.state,p.payerKind,payerId,payer,p.method,day,text(p.reference,'Unique external payment reference',150),JSON.stringify(snapshot),c.actor.id,c.now))
  for(const a of allocations){writes.push(sql(c,'INSERT INTO tt_payment_allocations(payment_id,charge_id,amount_cents,receipt_id) VALUES(?,?,?,?)',key,a.chargeId,a.amountCents,a.receiptId));if(p.state==='settled')writes.push(receipt(c,{...p,id:key,method:p.method},a,day,t.currency))}
  writes.push(event(c,key,p.state,p.reference,day))
  return {t,key,writes,allocations,credit}
}
export function receipt(c:Context,p:Row,a:Row,day:string,currency:string){return sql(c,'INSERT INTO tt_receipts(id,charge_id,amount_cents,received_date,reference,created_at,currency,method) VALUES(?,?,?,?,?,?,?,?)',a.receiptId,a.chargeId,a.amountCents,day,'payment:'+p.id+':'+a.chargeId,c.now,currency,p.method)}
export function event(c:Context,paymentId:string,state:string,reference:string,day:string){return sql(c,'INSERT INTO tt_payment_events(id,payment_id,state,reference,on_day,recorded_by,recorded_at) VALUES(?,?,?,?,?,?,?)',id(),paymentId,state,reference,day,c.actor.id,c.now)}

