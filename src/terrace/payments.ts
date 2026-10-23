import {all,allow,cents,commit,date,guard,id,insist,one,shown,sql,tenancy,text,type Context,type Row} from './core'
import {BALANCE} from './ledger'
import {localDate} from './zones'
import {rulePreview} from './rule-packs'
export const PAYMENT_COMMANDS=['payment.policy','payment.record','payment.settle','payment.fail']
export const RESERVED='COALESCE((SELECT amount_cents FROM tt_payment_reserved WHERE charge_id=q.id),0)'
const parsed=(v:unknown)=>{if(typeof v==='string'){try{return JSON.parse(v)}catch{throw Error('Policy must be valid JSON.')}}return v}
function stages(v:unknown){
 insist(Array.isArray(v)&&v.length>0&&v.length<=20,'payment_policy','Supply stage rules beginning at zero days past due.')
 let prior=-1
 for(const r of v){insist(Number.isInteger(r.minDaysPastDue)&&r.minDaysPastDue>=0&&r.minDaysPastDue<=3660&&r.minDaysPastDue>prior&&typeof r.allowPartial==='boolean'&&['reject','credit'].includes(r.overpayment),'payment_policy','Stages are ordered unique day thresholds with explicit allowPartial and overpayment.');prior=r.minDaysPastDue}
 insist(v[0].minDaysPastDue===0,'payment_policy','The first stage starts at zero days past due.');return v as Row[]
}
export async function paymentData(c:Context,tenancyId:string){
 allow(c,'ledger.read');await tenancy(c,tenancyId)
 const policies=await all(c,'SELECT * FROM tt_payment_policies WHERE tenancy_id=? ORDER BY version',tenancyId)
 const payments=await all(c,'SELECT * FROM tt_payments WHERE tenancy_id=? ORDER BY recorded_at,id',tenancyId)
 return{policies:policies.map(r=>({...r,terms:JSON.parse(r.terms)})),payments:await Promise.all(payments.map(async r=>({...r,snapshot:JSON.parse(r.snapshot),allocations:await all(c,'SELECT * FROM tt_payment_allocations WHERE payment_id=? ORDER BY charge_id',r.id),events:await all(c,'SELECT * FROM tt_payment_events WHERE payment_id=? ORDER BY recorded_at,id',r.id)}))),pendingCents:payments.filter(r=>r.state==='pending').reduce((n,r)=>n+r.amount_cents,0),creditCents:payments.filter(r=>r.state==='settled').reduce((n,r)=>n+r.credit_cents,0)}
}
export async function paymentCommand(c:Context,command:string,p:Row):Promise<Row|undefined>{
 if(!PAYMENT_COMMANDS.includes(command))return
 allow(c,command)
 // Conservative default pending ct: only the owner configures policies or records external payment facts.
 insist(c.actor.role==='owner'&&!c.actor.credential,'forbidden','Only the installation owner records split payment policy and external outcomes.',403)
 if(command==='payment.policy'){
  const t=await tenancy(c,p.tenancyId),terms=parsed(p.terms)
  insist(terms&&typeof terms==='object','payment_policy','Supply the lease policy.');stages(terms.stages)
  insist(Array.isArray(terms.priority)&&terms.priority.length>0&&terms.priority.length<=500&&terms.priority.every((x:unknown)=>typeof x==='string')&&new Set(terms.priority).size===terms.priority.length,'payment_priority','Name each charge once in its allocation order.')
  for(const q of terms.priority)insist(await one(c,'SELECT 1 FROM tt_charges WHERE id=? AND tenancy_id=?',q,t.id),'not_found','Priority charge not found.',404)
  const old=await one(c,'SELECT MAX(version) AS version FROM tt_payment_policies WHERE tenancy_id=?',t.id),version=(old?.version??0)+1,key=id()
  insist(Number(p.version)===version-1,'conflict','Review the current policy revision.',409)
  await commit(c,[guard(c,'COALESCE((SELECT MAX(version) FROM tt_payment_policies WHERE tenancy_id=?),0)=?',t.id,version-1),sql(c,'INSERT INTO tt_payment_policies(id,tenancy_id,version,terms,reference,created_by,created_at) VALUES(?,?,?,?,?,?,?)',key,t.id,version,JSON.stringify({stages:terms.stages,priority:terms.priority}),text(p.reference,'Approved lease policy reference',500),c.actor.id,c.now)],command,key)
  return{id:key,tenancyId:t.id,version,notice:'Lease payment policy recorded. Every payment also requires active reviewed property rules.'}
 }
 if(command==='payment.record'){
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
  let payer=t.tenant_name,payerId:string|null=null
  insist(['resident','co_tenant','housing_authority'].includes(p.payerKind),'payer','Choose a resident, co-tenant or housing authority.')
  const writes:D1PreparedStatement[]=[]
  if(p.payerKind==='co_tenant'){
   const m=await one(c,"SELECT * FROM tt_household_members WHERE id=? AND tenancy_id=? AND role='co_tenant' AND joined<=? AND (left_on IS NULL OR left_on>=?)",text(p.payerId,'Co-tenant',100),t.id,day,day)
   insist(m,'not_found','Co-tenant not found for this lease and payment day.',404);payer=m.name;payerId=m.id
   writes.push(guard(c,'EXISTS(SELECT 1 FROM tt_household_members WHERE id=? AND version=?)',m.id,m.version))
  }
  if(p.payerKind==='housing_authority'){
   const v=await one(c,'SELECT payload FROM tt_lease_versions WHERE tenancy_id=? AND approved_at IS NOT NULL AND effective<=? ORDER BY effective DESC LIMIT 1',t.id,day)
   const hap=v&&JSON.parse(v.payload).obligations.find((o:Row)=>o.kind==='hap'&&o.housingAuthority&&o.starts<=day&&(!o.ends||o.ends>=day))
   insist(hap,'hap_required','An approved HAP lease obligation is required; PAY-013 owns subsidy reconciliation.',409)
   payer=hap.housingAuthority;payerId=hap.id??null
  }
  const key=id(),allocations:Row[]=[];let remaining=amount
  for(const qid of terms.priority){const q=qs.find(q=>q.id===qid);if(!q)continue;const n=Math.min(remaining,q.balance_cents-q.reserved_cents);if(n<=0)continue;allocations.push({chargeId:q.id,amountCents:n,receiptId:id()});remaining-=n}
  const snapshot={policyVersion:policy.version,leaseStage:lease,daysPastDue:overdue,packs:rule.packs,allocationOrder:terms.priority,availableCents:available,allowPartial:rules.every(r=>r.allowPartial),overpayment:rules.every(r=>r.overpayment==='credit')?'credit':'reject'}
  writes.push(guard(c,'(SELECT id FROM tt_payment_policies WHERE tenancy_id=? ORDER BY version DESC LIMIT 1)=?',t.id,policy.id))
  // Fence the whole balance, including competing reservations and manual corrections, in the write transaction.
  for(const q of qs)writes.push(guard(c,`(SELECT ${BALANCE}-${RESERVED} FROM tt_charges q WHERE id=?)=?`,q.id,q.balance_cents-q.reserved_cents))
  writes.push(guard(c,'(SELECT COUNT(*) FROM tt_charges WHERE tenancy_id=?)=?',t.id,qs.length))
  const jurisdiction=await one(c,'SELECT version FROM tt_property_rules WHERE property_id=?',property.property_id)
  writes.push(guard(c,'(SELECT version FROM tt_property_rules WHERE property_id=?)=?',property.property_id,jurisdiction!.version))
  for(const pack of rule.packs)writes.push(guard(c,'(SELECT id FROM tt_rule_packs WHERE code=? AND effective_from<=? ORDER BY effective_from DESC,version DESC LIMIT 1)=?',pack.code,today,pack.id))
  writes.push(sql(c,'INSERT INTO tt_payments(id,tenancy_id,policy_id,amount_cents,credit_cents,state,payer_kind,payer_id,payer_name,method,received_date,reference,snapshot,recorded_by,recorded_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',key,t.id,policy.id,amount,credit,p.state,p.payerKind,payerId,payer,p.method,day,text(p.reference,'Unique external payment reference',150),JSON.stringify(snapshot),c.actor.id,c.now))
  for(const a of allocations){writes.push(sql(c,'INSERT INTO tt_payment_allocations(payment_id,charge_id,amount_cents,receipt_id) VALUES(?,?,?,?)',key,a.chargeId,a.amountCents,a.receiptId));if(p.state==='settled')writes.push(receipt(c,{...p,id:key,method:p.method},a,day,t.currency))}
  writes.push(event(c,key,p.state,p.reference,day))
  await commit(c,writes,command,key)
  return{id:key,tenancyId:t.id,allocations,creditCents:credit,state:p.state,notice:p.state==='pending'?'Pending external funds reserved. Receivable unchanged; no settled receipt recorded.':'Settled external funds allocated; excess is separate unapplied credit. No funds moved.'}
 }
 const payment=await one(c,'SELECT * FROM tt_payments WHERE id=?',text(p.paymentId,'Payment',100));insist(payment,'not_found','Payment not found.',404)
 const t=await tenancy(c,payment.tenancy_id),day=date(p.on),state=command==='payment.settle'?'settled':'failed'
 insist(payment.state==='pending'&&Number(p.version)===payment.version,'payment_state','Only the reviewed pending payment can transition once.',409)
 insist(day>=payment.received_date&&day<=localDate(c.now,t.time_zone),'invalid_date','Outcome date is between initiation and property-local today.')
 const allocations=await all(c,'SELECT charge_id AS chargeId,amount_cents AS amountCents,receipt_id AS receiptId FROM tt_payment_allocations WHERE payment_id=?',payment.id)
 const writes=[guard(c,"EXISTS(SELECT 1 FROM tt_payments WHERE id=? AND state='pending' AND version=?)",payment.id,payment.version),sql(c,'UPDATE tt_payments SET state=?,version=version+1 WHERE id=?',state,payment.id)]
 if(state==='settled')for(const a of allocations)writes.push(receipt(c,payment,a,day,t.currency))
 writes.push(event(c,payment.id,state,text(p.reference,'External outcome reference',500),day))
 await commit(c,writes,command,payment.id)
 return{id:payment.id,tenancyId:t.id,notice:state==='settled'?'Settlement recorded once; reserved allocations are now receipts.':'External failure recorded; reservations released with no receipt.'}
}
function receipt(c:Context,p:Row,a:Row,day:string,currency:string){return sql(c,'INSERT INTO tt_receipts(id,charge_id,amount_cents,received_date,reference,created_at,currency,method) VALUES(?,?,?,?,?,?,?,?)',a.receiptId,a.chargeId,a.amountCents,day,'payment:'+p.id+':'+a.chargeId,c.now,currency,p.method)}
function event(c:Context,paymentId:string,state:string,reference:string,day:string){return sql(c,'INSERT INTO tt_payment_events(id,payment_id,state,reference,on_day,recorded_by,recorded_at) VALUES(?,?,?,?,?,?,?)',id(),paymentId,state,reference,day,c.actor.id,c.now)}
