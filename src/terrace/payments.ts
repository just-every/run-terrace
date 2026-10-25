import {preparePayment,receipt,event} from './payment-admission'
import {tenancyGuard,all,allow,can,cents,commit,date,guard,id,insist,one,shown,sql,tenancy,text,type Context,type Row} from './core'
import {BALANCE} from './ledger'
import {localDate} from './zones'
import {rulePreview} from './rule-packs'
export const PAYMENT_COMMANDS=['payment.policy','payment.record','payment.settle','payment.fail']
export {RESERVED} from './payment-admission'
const parsed=(v:unknown)=>{if(typeof v==='string'){try{return JSON.parse(v)}catch{throw Error('Policy must be valid JSON.')}}return v}
function stages(v:unknown){
 insist(Array.isArray(v)&&v.length>0&&v.length<=20,'payment_policy','Supply stage rules beginning at zero days past due.')
 let prior=-1
 for(const r of v){insist(Number.isInteger(r.minDaysPastDue)&&r.minDaysPastDue>=0&&r.minDaysPastDue<=3660&&r.minDaysPastDue>prior&&typeof r.allowPartial==='boolean'&&['reject','credit'].includes(r.overpayment),'payment_policy','Stages are ordered unique day thresholds with explicit allowPartial and overpayment.');prior=r.minDaysPastDue}
 insist(v[0].minDaysPastDue===0,'payment_policy','The first stage starts at zero days past due.');return v as Row[]
}
export async function paymentData(c:Context,tenancyId:string){
 allow(c,'ledger.read');await tenancy(c,tenancyId)
 const privileged=can(c,'payment.record')&&!c.actor.credential
 const policies=privileged?await all(c,'SELECT * FROM tt_payment_policies WHERE tenancy_id=? ORDER BY version',tenancyId):[]
 const payments=await all(c,'SELECT p.*,EXISTS(SELECT 1 FROM tt_card_payments c WHERE c.payment_id=p.id) AS provider_owned FROM tt_payments p WHERE tenancy_id=? ORDER BY recorded_at,id',tenancyId)
 return{restricted:!privileged,coTenants:privileged?await all(c,"SELECT id,name,joined,left_on FROM tt_household_members WHERE tenancy_id=? AND role='co_tenant' ORDER BY name,id",tenancyId):[],policies:policies.map(r=>({...r,terms:JSON.parse(r.terms)})),payments:await Promise.all((privileged?payments:[]).map(async r=>({...r,snapshot:JSON.parse(r.snapshot),allocations:await all(c,'SELECT * FROM tt_payment_allocations WHERE payment_id=? ORDER BY charge_id',r.id),events:await all(c,'SELECT * FROM tt_payment_events WHERE payment_id=? ORDER BY recorded_at,id',r.id)}))),pendingCents:payments.filter(r=>r.state==='pending').reduce((n,r)=>n+r.amount_cents,0),creditCents:payments.filter(r=>r.state==='settled').reduce((n,r)=>n+r.credit_cents,0)}
}
export async function paymentCommand(c:Context,command:string,p:Row):Promise<Row|undefined>{
 if(!PAYMENT_COMMANDS.includes(command))return
 allow(c,command)
 insist(!c.actor.credential,'forbidden','API credentials cannot record payment outcomes.',403)
 if(command==='payment.policy')insist(c.actor.role==='owner','forbidden','Only the owner configures lease payment policy.',403)
 if(command==='payment.policy'){
  const t=await tenancy(c,p.tenancyId)
  const ranked=Object.entries(p).filter(([k,v])=>k.startsWith('priority:')&&String(v).trim()!=='').map(([k,v])=>({id:k.slice(9),rank:Number(v)}))
  if(p.terms===undefined)insist(ranked.every(x=>Number.isInteger(x.rank)&&x.rank>0&&x.rank<=500)&&new Set(ranked.map(x=>x.rank)).size===ranked.length,'payment_priority','Allocation positions must be unique whole numbers from 1 to 500.')
  const terms=p.terms===undefined?{stages:Object.keys(p).filter(k=>/^stageMin:\d+$/.test(k)&&String(p[k]).trim()!=='').sort((a,b)=>Number(a.split(':')[1])-Number(b.split(':')[1])).map(k=>{const i=k.split(':')[1];return{minDaysPastDue:Number(p[k]),allowPartial:p['stagePartial:'+i]==='true',overpayment:p['stageExcess:'+i]}}),priority:ranked.sort((a,b)=>a.rank-b.rank).map(x=>x.id)}:parsed(p.terms)
  insist(terms&&typeof terms==='object','payment_policy','Supply the lease policy.');stages(terms.stages)
  insist(Array.isArray(terms.priority)&&terms.priority.length>0&&terms.priority.length<=500&&terms.priority.every((x:unknown)=>typeof x==='string')&&new Set(terms.priority).size===terms.priority.length,'payment_priority','Name each charge once in its allocation order.')
  for(const q of terms.priority)insist(await one(c,'SELECT 1 FROM tt_charges WHERE id=? AND tenancy_id=?',q,t.id),'not_found','Priority charge not found.',404)
  const old=await one(c,'SELECT MAX(version) AS version FROM tt_payment_policies WHERE tenancy_id=?',t.id),version=(old?.version??0)+1,key=id()
  insist(Number(p.version)===version-1,'conflict','Review the current policy revision.',409)
  await commit(c,[tenancyGuard(c,t),guard(c,'COALESCE((SELECT MAX(version) FROM tt_payment_policies WHERE tenancy_id=?),0)=?',t.id,version-1),sql(c,'INSERT INTO tt_payment_policies(id,tenancy_id,version,terms,reference,created_by,created_at) VALUES(?,?,?,?,?,?,?)',key,t.id,version,JSON.stringify({stages:terms.stages,priority:terms.priority}),text(p.reference,'Approved lease policy reference',500),c.actor.id,c.now)],command,key)
  return{id:key,tenancyId:t.id,version,notice:'Lease payment policy recorded. Every payment also requires active reviewed property rules.'}
 }
 if(command==='payment.record'){
  const {t,key,writes,allocations,credit}=await preparePayment(c,p)
  await commit(c,writes,command,key)
  return{id:key,tenancyId:t.id,allocations,creditCents:credit,state:p.state,notice:p.state==='pending'?'Pending external funds reserved. Receivable unchanged; no settled receipt recorded.':'Settled external funds allocated; excess is separate unapplied credit. No funds moved.'}
 }
 const payment=await one(c,'SELECT * FROM tt_payments WHERE id=?',text(p.paymentId,'Payment',100));insist(payment,'not_found','Payment not found.',404)
 insist(!await one(c,'SELECT 1 FROM tt_card_payments WHERE payment_id=?',payment.id),'provider_only','Hosted card outcomes require a verified Stripe event.',409)
 const t=await tenancy(c,payment.tenancy_id),day=date(p.on),state=command==='payment.settle'?'settled':'failed'
 insist(payment.state==='pending'&&Number(p.version)===payment.version,'payment_state','Only the reviewed pending payment can transition once.',409)
 insist(day>=payment.received_date&&day<=localDate(c.now,t.time_zone),'invalid_date','Outcome date is between initiation and property-local today.')
 const allocations=await all(c,'SELECT charge_id AS chargeId,amount_cents AS amountCents,receipt_id AS receiptId FROM tt_payment_allocations WHERE payment_id=?',payment.id)
 const writes=[tenancyGuard(c,t),guard(c,"EXISTS(SELECT 1 FROM tt_payments WHERE id=? AND state='pending' AND version=?)",payment.id,payment.version),sql(c,'UPDATE tt_payments SET state=?,version=version+1 WHERE id=?',state,payment.id)]
 if(state==='settled')for(const a of allocations)writes.push(receipt(c,payment,a,day,t.currency))
 writes.push(event(c,payment.id,state,text(p.reference,'External outcome reference',500),day))
 await commit(c,writes,command,payment.id)
 return{id:payment.id,tenancyId:t.id,notice:state==='settled'?'Settlement recorded once; reserved allocations are now receipts.':'External failure recorded; reservations released with no receipt.'}
}
/** Effective external outcomes known now, on an inclusive property-local day. Never a bank/provider assertion. */
export async function externalFundsAsOf(c:Context,tenancyId:string,on:string){
 const rows=await all(c,"SELECT p.id,p.amount_cents,p.credit_cents,p.received_date,p.method,(SELECT e.state FROM tt_payment_events e WHERE e.payment_id=p.id AND e.on_day<=? ORDER BY e.on_day DESC,e.recorded_at DESC,CASE e.state WHEN 'pending' THEN 0 ELSE 1 END DESC LIMIT 1) AS as_of_state FROM tt_payments p WHERE p.tenancy_id=? AND p.received_date<=? ORDER BY p.received_date,p.id",on,tenancyId,on)
 const pending=rows.filter(r=>r.as_of_state==='pending').map(r=>({id:r.id,amountCents:r.amount_cents,initiatedOn:r.received_date,method:r.method}))
 return{pending,pendingCents:pending.reduce((n,r)=>n+r.amountCents,0),creditCents:rows.filter(r=>r.as_of_state==='settled').reduce((n,r)=>n+r.credit_cents,0)}
}
