import {CARD_CONSENT_TEXT,CARD_CONSENT_VERSION} from './card-consent'
import type {Bindings} from '../auth.server'
import {all,audit,cents,Fault,guard,id,insist,one,sql,tenancy,type Context,type Row} from './core'
import {preparePayment,receipt,event} from './payment-admission'
import {localDate} from './zones'
import {createCheckout,stripe} from './stripe-provider'

export async function cardRows(c:Context,tenancyId:string){
 return all(c,`SELECT c.payment_id,c.request_key,c.initiated_by,c.state,c.checkout_id,c.intent_id,c.charge_id,c.payer_fee_cents,c.provider_fee_cents,c.provider_net_cents,c.last_event_id,r.outcome AS recovery_outcome,r.session_id AS recovery_session,r.event_id AS recovery_event,r.assigned_to,r.next_action,r.updated_at AS recovery_updated,o.display_name AS recovery_assignee,l.payment_id AS originating,p.amount_cents,p.recorded_at,p.state AS funds_state FROM tt_card_payments c JOIN tt_payments p ON p.id=c.payment_id LEFT JOIN tt_payment_recovery r ON r.payment_id=c.payment_id LEFT JOIN oa_operators o ON o.id=r.assigned_to LEFT JOIN tt_card_checkout_links l ON l.payment_id=c.payment_id WHERE p.tenancy_id=? ORDER BY p.recorded_at,c.payment_id`,tenancyId)
}
/** Provider reads must bind the same hosted operation, including recovery before local acknowledgment. */
export const matchesCardSession=(session:Row,payment:Row,knownSession?:string|null)=>typeof session.id==='string'&&/^cs_test_[A-Za-z0-9]+$/.test(session.id)&&session.livemode===false&&session.mode==='payment'&&session.metadata?.terrace_payment_id===payment.payment_id&&session.amount_total===payment.amount_cents&&session.currency==='usd'&&(!payment.checkout_id||session.id===payment.checkout_id)&&(!knownSession||session.id===knownSession)
/** No browser or staff outcome can post these funds: only verified provider events below. */
export async function startCard(c:Context,env:Bindings,p:Row,proof:D1PreparedStatement[]){
 insist(env.RER_DEMO!=='1','demo_payment','Card collection is disabled in the demo.',403)
 insist(env.STRIPE_SECRET_KEY,'stripe_unavailable','Stripe test-mode collection is not configured.',503)
 insist(p.consent==='yes'&&p.consentVersion===CARD_CONSENT_VERSION,'consent_required','Confirm this one-time card payment and the disclosed total.')
 insist(typeof p.requestKey==='string'&&/^[a-f0-9-]{36}$/.test(p.requestKey),'request_key','Open the payment form again.')
 const t=await tenancy(c,p.tenancyId),amount=String(p.amount),amountCents=cents(amount);insist(amountCents>=50,'invalid_money','Card payments must be at least $0.50.');const prior=await one(c,'SELECT c.*,p.amount_cents,p.tenancy_id,p.recorded_at FROM tt_card_payments c JOIN tt_payments p ON p.id=c.payment_id WHERE c.initiated_by=? AND c.request_key=?',c.actor.id,p.requestKey)
 insist(!await one(c,'SELECT 1 FROM tt_card_payments c LEFT JOIN tt_card_checkout_links l ON l.payment_id=c.payment_id WHERE c.request_key=? AND l.payment_id IS NULL',p.requestKey),'restore_hold','This restored request is evidence only; reconcile it in its originating installation.',409)
 let key=prior?.payment_id
 if(prior){insist(await one(c,'SELECT 1 FROM tt_card_checkout_links WHERE payment_id=?',prior.payment_id),'restore_hold','This restored payment is evidence only; reconcile it in its originating installation.',409);insist(prior.checkout_id||Date.parse(c.now)-Date.parse(prior.recorded_at)<23*3600000,'provider_review','This uncertain attempt needs provider reconciliation before another collection.',409);insist(prior.tenancy_id===t.id&&prior.amount_cents===amountCents,'conflict','This payment request already has a different amount.',409);insist(['reserved','checkout'].includes(prior.state),'payment_state','This payment attempt has finished.',409);await c.db.batch(proof)}
 else{
  key=id()
  const responsible=c.actor.id.startsWith('portal:')?(await one(c,"SELECT id FROM oa_operators WHERE role='owner' AND status='active' LIMIT 1"))!.id:c.actor.id
  const prepared=await preparePayment(c,{paymentKey:key,tenancyId:t.id,amount,state:'pending',payerKind:'resident',method:'card',receivedDate:localDate(c.now,t.time_zone),reference:'stripe:'+key})
  try{await c.db.batch([...proof,...prepared.writes,sql(c,"INSERT INTO tt_card_payments(payment_id,request_key,initiated_by,consent_version,consent_text,consented_at,state) VALUES(?,?,?,?,?,?,'reserved')",key,p.requestKey,c.actor.id,CARD_CONSENT_VERSION,CARD_CONSENT_TEXT,c.now),sql(c,'INSERT INTO tt_card_checkout_links VALUES(?,NULL)',key),sql(c,"INSERT INTO tt_payment_recovery VALUES(?,'unknown',NULL,NULL,?,'inspect_provider',?)",key,responsible,c.now),audit(c,'card.start',key)])}
  catch(e){const concurrent=await one(c,'SELECT c.payment_id,p.amount_cents,p.tenancy_id,p.recorded_at FROM tt_card_payments c JOIN tt_payments p ON p.id=c.payment_id WHERE c.initiated_by=? AND c.request_key=?',c.actor.id,p.requestKey);if(concurrent&&concurrent.amount_cents===amountCents&&concurrent.tenancy_id===t.id)key=concurrent.payment_id;else if(String(e).includes('CHECK constraint')||String(e).includes('UNIQUE constraint'))throw new Fault('conflict','The balance, access or payment request changed. Review the account again.',409);else throw e}
 }
 const saved=await one(c,'SELECT c.*,l.checkout_url FROM tt_card_payments c LEFT JOIN tt_card_checkout_links l ON l.payment_id=c.payment_id WHERE c.payment_id=?',key)
 if(saved?.checkout_id){insist(saved.checkout_url,'restore_hold','This restored payment has no active hosted link. Ask staff to reconcile it.',409);return{paymentId:key,checkoutUrl:saved.checkout_url,tenancyId:t.id}}
 let checkout:Row
 try{checkout=await createCheckout(env,{id:key,amountCents:prior?.amount_cents??amountCents,origin:env.AUTH_ORIGIN,tenancyId:t.id,staff:!c.actor.id.startsWith('portal:')})}
 catch(e){if(e instanceof Fault&&e.code==='stripe_rejected')await c.db.batch([guard(c,"EXISTS(SELECT 1 FROM tt_card_payments WHERE payment_id=? AND state='reserved' AND checkout_id IS NULL)",key),sql(c,"UPDATE tt_payments SET state='failed',version=version+1 WHERE id=? AND state='pending'",key),sql(c,"UPDATE tt_card_payments SET state='expired' WHERE payment_id=?",key),sql(c,"UPDATE tt_payment_recovery SET outcome='resolved',next_action='complete',updated_at=? WHERE payment_id=?",c.now,key),event(c,key,'failed','Stripe rejected Checkout creation',localDate(c.now,t.time_zone)),audit(c,'card.rejected',key)]);throw e}
 await c.db.batch([guard(c,"EXISTS(SELECT 1 FROM tt_card_payments WHERE payment_id=? AND (state='reserved' OR (state='checkout' AND checkout_id=?)))",key,checkout.id),sql(c,"UPDATE tt_card_payments SET checkout_id=?,state='checkout' WHERE payment_id=?",checkout.id,key),sql(c,'INSERT INTO tt_card_checkout_links VALUES(?,?) ON CONFLICT(payment_id) DO UPDATE SET checkout_url=excluded.checkout_url',key,checkout.url),sql(c,"UPDATE tt_payment_recovery SET outcome='awaiting_event',session_id=?,updated_at=? WHERE payment_id=?",checkout.id,c.now,key)])
 return{paymentId:key,checkoutUrl:checkout.url,tenancyId:t.id}
}
/** Retrieve the canonical event using the installation credential. Request payload fields never supply money or state. */
export async function verifiedCardEvent(env:Bindings,eventId:unknown,now:string,scopeTenancyId?:string,expectedPaymentId?:string,proof:D1PreparedStatement[]=[]){
 insist(typeof eventId==='string'&&/^evt_[A-Za-z0-9]{5,100}$/.test(eventId),'provider_event','Supply a Stripe event id.')
 const ev=await stripe(env,'events/'+eventId)
 insist(ev.id===eventId&&ev.livemode===false,'provider_event','A Stripe test-mode event is required.',409)
 const db=env.DB,c:Context={db,now,actor:{id:'provider:stripe',role:'member',displayName:'Stripe verified event',staff:{role:'provider',all:true,version:1,actions:[],portfolios:[],units:new Set()}},zone:'UTC'}
 const object=ev.data?.object
 insist(object&&['checkout.session.completed','checkout.session.expired','payment_intent.payment_failed'].includes(ev.type),'provider_event','This Stripe event does not complete a supported card outcome.',409)
 const paymentId=object.metadata?.terrace_payment_id
 const payment=await one(c,'SELECT c.*,p.tenancy_id,p.amount_cents,p.state AS funds_state FROM tt_card_payments c JOIN tt_payments p ON p.id=c.payment_id JOIN tt_tenancies t ON t.id=p.tenancy_id WHERE c.payment_id=? AND t.erased_at IS NULL',String(paymentId??''))
 insist(payment,'not_found','Card payment not found.',404);insist(!scopeTenancyId||payment.tenancy_id===scopeTenancyId,'not_found','Card payment not found.',404);insist(!expectedPaymentId||payment.payment_id===expectedPaymentId,'provider_conflict','The event belongs to a different original payment.',409);c.tenancyId=payment.tenancy_id
 insist(await one(c,'SELECT 1 FROM tt_card_checkout_links WHERE payment_id=?',payment.payment_id),'restore_hold','This payment requires reconciliation in its originating installation.',409)
 const recovery=await one(c,'SELECT session_id FROM tt_payment_recovery WHERE payment_id=?',payment.payment_id)
 const replay=await one(c,'SELECT id FROM tt_card_events WHERE id=?',ev.id)
 if(replay){if(proof.length)await db.batch(proof);return{paymentId:payment.payment_id,replayed:true,state:payment.state,tenancyId:payment.tenancy_id}}
 const failed=ev.type==='payment_intent.payment_failed',expired=ev.type==='checkout.session.expired'
 let intent:Row|undefined,charge:Row|undefined
 if(failed){
  const sessionId=payment.checkout_id??recovery?.session_id
  insist(sessionId,'provider_event','The failed attempt has no confirmed hosted session.',409)
  const session=await stripe(env,'/checkout/sessions/'+sessionId)
  insist(matchesCardSession(session,payment,sessionId)&&session.payment_intent===object.id&&object.livemode===false&&object.currency==='usd'&&object.amount===payment.amount_cents,'provider_event','The failed attempt does not match this hosted session.',409)
 }else{
  insist(matchesCardSession(object,payment,recovery?.session_id)&&(expired?object.status==='expired'&&object.payment_status==='unpaid':object.status==='complete'&&object.payment_status==='paid'),'provider_event','The hosted mode, amount, session or outcome does not match.',409)
  if(!expired){
   insist(typeof object.payment_intent==='string','provider_event','The hosted payment has no provider payment.',409)
   intent=await stripe(env,'payment_intents/'+object.payment_intent)
   insist(intent.id===object.payment_intent&&intent.livemode===false&&intent.status==='succeeded'&&intent.currency==='usd'&&intent.amount===payment.amount_cents&&intent.amount_received===payment.amount_cents&&intent.metadata?.terrace_payment_id===payment.payment_id&&typeof intent.latest_charge==='string','provider_event','The provider payment does not match the reserved amount.',409)
   charge=await stripe(env,'charges/'+intent.latest_charge)
   if(typeof charge.balance_transaction==='string')charge.balance_transaction=await stripe(env,'balance_transactions/'+charge.balance_transaction)
   insist(charge.id===intent.latest_charge&&charge.livemode===false&&charge.paid===true&&charge.captured===true&&charge.refunded===false&&charge.currency==='usd'&&charge.amount===payment.amount_cents&&charge.amount_captured===payment.amount_cents&&charge.amount_refunded===0&&charge.payment_intent===intent.id,'provider_event','The provider charge is not a matching completed payment.',409)
  }
 }
 insist(!['paid','expired'].includes(payment.state)||payment.state===(expired?'expired':failed?payment.state:'paid'),'provider_conflict','This payment already has a different terminal outcome.',409)
 const writes:D1PreparedStatement[]=[...proof,guard(c,'EXISTS(SELECT 1 FROM tt_card_checkout_links WHERE payment_id=?)',payment.payment_id),guard(c,'EXISTS(SELECT 1 FROM tt_tenancies WHERE id=? AND erased_at IS NULL)',payment.tenancy_id),guard(c,'EXISTS(SELECT 1 FROM tt_card_payments WHERE payment_id=? AND state=?)',payment.payment_id,payment.state),sql(c,'INSERT INTO tt_card_events VALUES(?,?,?,?,?,?)',ev.id,payment.payment_id,ev.type,object.id,ev.created,now)]
 if(!failed&&payment.funds_state==='pending'){
  const state=expired?'failed':'settled',t=await tenancy(c,payment.tenancy_id),day=localDate(new Date(ev.created*1000).toISOString(),t.time_zone)
  writes.push(guard(c,"EXISTS(SELECT 1 FROM tt_payments WHERE id=? AND state='pending')",payment.payment_id),sql(c,'UPDATE tt_payments SET state=?,version=version+1 WHERE id=?',state,payment.payment_id))
  if(!expired){for(const a of await all(c,'SELECT charge_id AS chargeId,amount_cents AS amountCents,receipt_id AS receiptId FROM tt_payment_allocations WHERE payment_id=?',payment.payment_id))writes.push(receipt(c,{id:payment.payment_id,method:'card'},a,day,'USD'))}
  writes.push(event(c,payment.payment_id,state,ev.id,day),sql(c,'UPDATE tt_card_payments SET checkout_id=COALESCE(checkout_id,?),state=?,intent_id=?,charge_id=?,provider_fee_cents=?,provider_net_cents=?,last_event_id=? WHERE payment_id=?',object.id,expired?'expired':'paid',intent?.id??null,charge?.id??null,charge?.balance_transaction?.fee??null,charge?.balance_transaction?.net??null,ev.id,payment.payment_id))
 }
 // A decline stays retryable in the same hosted session. Capacity is released only when Stripe expires the session.
 writes.push(sql(c,"UPDATE tt_payment_recovery SET outcome=CASE WHEN outcome='resolved' THEN outcome ELSE ? END,session_id=COALESCE(session_id,?),event_id=CASE WHEN outcome='resolved' THEN event_id ELSE ? END,next_action=CASE WHEN outcome='resolved' THEN next_action ELSE ? END,updated_at=? WHERE payment_id=?",!failed?'resolved':'awaiting_event',failed?payment.checkout_id:object.id,ev.id,!failed?'complete':'obtain_event',now,payment.payment_id),audit(c,'card.event',payment.payment_id,ev.type))
 try{await db.batch(writes)}catch(e){if(/UNIQUE constraint|CHECK constraint/.test(String(e))&&await one(c,'SELECT id FROM tt_card_events WHERE id=?',ev.id)){if(proof.length)await db.batch(proof);return{paymentId:payment.payment_id,replayed:true,tenancyId:payment.tenancy_id}}throw e}
 return{paymentId:payment.payment_id,replayed:false,state:expired?'expired':failed?'declined':'paid',tenancyId:payment.tenancy_id}
}
