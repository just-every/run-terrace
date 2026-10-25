import type {Bindings} from '../auth.server'
import {all,audit,authority,cents,Fault,guard,id,insist,one,sql,tenancy,type Context,type Row} from './core'
import {preparePayment,receipt,event} from './payment-admission'
import {localDate} from './zones'
import {createCheckout,stripe} from './stripe-provider'

export async function cardRows(c:Context,tenancyId:string){
 return all(c,`SELECT c.payment_id,c.state,c.checkout_id,c.intent_id,c.charge_id,c.payer_fee_cents,c.provider_fee_cents,c.provider_net_cents,c.last_event_id,p.amount_cents,p.recorded_at,p.state AS funds_state FROM tt_card_payments c JOIN tt_payments p ON p.id=c.payment_id WHERE p.tenancy_id=? ORDER BY p.recorded_at,c.payment_id`,tenancyId)
}
/** No browser or staff outcome can post these funds: only verified provider events below. */
export async function startCard(c:Context,env:Bindings,p:Row,proof:D1PreparedStatement[]){
 insist(env.RER_DEMO!=='1','demo_payment','Card collection is disabled in the demo.',403)
 insist(env.STRIPE_SECRET_KEY,'stripe_unavailable','Stripe test-mode collection is not configured.',503)
 insist(p.consent==='yes','consent_required','Confirm this one-time card payment and the disclosed total.')
 insist(typeof p.requestKey==='string'&&/^[a-f0-9-]{36}$/.test(p.requestKey),'request_key','Open the payment form again.')
 const t=await tenancy(c,p.tenancyId),amount=String(p.amount),amountCents=cents(amount);insist(amountCents>=50,'invalid_money','Card payments must be at least $0.50.');const prior=await one(c,'SELECT c.*,p.amount_cents,p.tenancy_id FROM tt_card_payments c JOIN tt_payments p ON p.id=c.payment_id WHERE c.initiated_by=? AND c.request_key=?',c.actor.id,p.requestKey)
 let key=prior?.payment_id
 if(prior){insist(prior.tenancy_id===t.id&&prior.amount_cents===amountCents,'conflict','This payment request already has a different amount.',409);insist(['reserved','checkout'].includes(prior.state),'payment_state','This payment attempt has finished.',409);await c.db.batch(proof)}
 else{
  key=id()
  const prepared=await preparePayment(c,{paymentKey:key,tenancyId:t.id,amount,state:'pending',payerKind:'resident',method:'card',receivedDate:localDate(c.now,t.time_zone),reference:'stripe:'+key})
  try{await c.db.batch([...proof,...prepared.writes,sql(c,"INSERT INTO tt_card_payments(payment_id,request_key,initiated_by,state) VALUES(?,?,?,'reserved')",key,p.requestKey,c.actor.id),audit(c,'card.start',key)])}
  catch(e){const concurrent=await one(c,'SELECT c.payment_id,p.amount_cents,p.tenancy_id FROM tt_card_payments c JOIN tt_payments p ON p.id=c.payment_id WHERE c.initiated_by=? AND c.request_key=?',c.actor.id,p.requestKey);if(concurrent&&concurrent.amount_cents===amountCents&&concurrent.tenancy_id===t.id)key=concurrent.payment_id;else if(String(e).includes('CHECK constraint')||String(e).includes('UNIQUE constraint'))throw new Fault('conflict','The balance, access or payment request changed. Review the account again.',409);else throw e}
 }
 const saved=await one(c,'SELECT c.*,l.checkout_url FROM tt_card_payments c LEFT JOIN tt_card_checkout_links l ON l.payment_id=c.payment_id WHERE c.payment_id=?',key)
 if(saved?.checkout_id){insist(saved.checkout_url,'restore_hold','This restored payment has no active hosted link. Ask staff to reconcile it.',409);return{paymentId:key,checkoutUrl:saved.checkout_url,tenancyId:t.id}}
 const checkout=await createCheckout(env,{id:key,amountCents:prior?.amount_cents??amountCents,origin:env.AUTH_ORIGIN,tenancyId:t.id})
 await c.db.batch([guard(c,"EXISTS(SELECT 1 FROM tt_card_payments WHERE payment_id=? AND (state='reserved' OR (state='checkout' AND checkout_id=?)))",key,checkout.id),sql(c,"UPDATE tt_card_payments SET checkout_id=?,state='checkout' WHERE payment_id=?",checkout.id,key),sql(c,'INSERT INTO tt_card_checkout_links VALUES(?,?) ON CONFLICT(payment_id) DO NOTHING',key,checkout.url)])
 return{paymentId:key,checkoutUrl:checkout.url,tenancyId:t.id}
}
/** Retrieve the canonical event using the installation credential. Request payload fields never supply money or state. */
export async function verifiedCardEvent(env:Bindings,eventId:unknown,now:string,scopeTenancyId?:string){
 insist(typeof eventId==='string'&&/^evt_[A-Za-z0-9]{5,100}$/.test(eventId),'provider_event','Supply a Stripe event id.')
 const ev=await stripe(env,'events/'+eventId)
 insist(ev.id===eventId&&ev.livemode===false,'provider_event','A Stripe test-mode event is required.',409)
 const db=env.DB,c:Context={db,now,actor:{id:'provider:stripe',role:'member',displayName:'Stripe verified event',staff:{role:'provider',all:true,version:1,actions:[],portfolios:[],units:new Set()}},zone:'UTC'}
 const object=ev.data?.object
 insist(object&&['checkout.session.completed','checkout.session.expired','payment_intent.payment_failed'].includes(ev.type),'provider_event','This Stripe event does not complete a supported card outcome.',409)
 const paymentId=object.metadata?.terrace_payment_id
 const payment=await one(c,'SELECT c.*,p.tenancy_id,p.amount_cents,p.state AS funds_state FROM tt_card_payments c JOIN tt_payments p ON p.id=c.payment_id JOIN tt_tenancies t ON t.id=p.tenancy_id WHERE c.payment_id=? AND t.erased_at IS NULL',String(paymentId??''))
 insist(payment,'not_found','Card payment not found.',404);insist(!scopeTenancyId||payment.tenancy_id===scopeTenancyId,'not_found','Card payment not found.',404);c.tenancyId=payment.tenancy_id
 insist(await one(c,'SELECT 1 FROM tt_card_checkout_links WHERE payment_id=?',payment.payment_id),'restore_hold','This payment requires reconciliation in its originating installation.',409)
 const replay=await one(c,'SELECT id FROM tt_card_events WHERE id=?',ev.id)
 if(replay)return{paymentId:payment.payment_id,replayed:true,state:payment.state,tenancyId:payment.tenancy_id}
 const failed=ev.type==='payment_intent.payment_failed',expired=ev.type==='checkout.session.expired'
 let intent:Row|undefined,charge:Row|undefined
 if(failed){
  const session=await stripe(env,'checkout/sessions/'+payment.checkout_id)
  insist(session.payment_intent===object.id,'provider_event','The failed attempt does not match this hosted session.',409)
 }else{
  insist(object.id===payment.checkout_id&&object.currency==='usd'&&object.amount_total===payment.amount_cents,'provider_event','The hosted amount or session does not match.',409)
  if(!expired){
   insist(object.payment_status==='paid','provider_event','The hosted payment is not paid.',409)
   intent=await stripe(env,'payment_intents/'+object.payment_intent)
   insist(intent.status==='succeeded'&&intent.currency==='usd'&&intent.amount_received===payment.amount_cents&&intent.metadata?.terrace_payment_id===payment.payment_id,'provider_event','The provider payment does not match the reserved amount.',409)
   charge=await stripe(env,'charges/'+intent.latest_charge)
   if(typeof charge.balance_transaction==='string')charge.balance_transaction=await stripe(env,'balance_transactions/'+charge.balance_transaction)
   insist(charge.paid&&charge.captured&&!charge.refunded&&charge.amount===payment.amount_cents&&charge.payment_intent===intent.id,'provider_event','The provider charge is not a matching completed payment.',409)
  }
 }
 const writes:D1PreparedStatement[]=[sql(c,'INSERT INTO tt_card_events VALUES(?,?,?,?,?,?)',ev.id,payment.payment_id,ev.type,object.id,ev.created,now)]
 if(!failed&&payment.funds_state==='pending'){
  const state=expired?'failed':'settled',t=await tenancy(c,payment.tenancy_id),day=localDate(new Date(ev.created*1000).toISOString(),t.time_zone)
  writes.push(guard(c,"EXISTS(SELECT 1 FROM tt_payments WHERE id=? AND state='pending')",payment.payment_id),sql(c,'UPDATE tt_payments SET state=?,version=version+1 WHERE id=?',state,payment.payment_id))
  if(!expired){for(const a of await all(c,'SELECT charge_id AS chargeId,amount_cents AS amountCents,receipt_id AS receiptId FROM tt_payment_allocations WHERE payment_id=?',payment.payment_id))writes.push(receipt(c,{id:payment.payment_id,method:'card'},a,day,'USD'))}
  writes.push(event(c,payment.payment_id,state,ev.id,day),sql(c,'UPDATE tt_card_payments SET state=?,intent_id=?,charge_id=?,provider_fee_cents=?,provider_net_cents=?,last_event_id=? WHERE payment_id=?',expired?'expired':'paid',intent?.id??null,charge?.id??null,charge?.balance_transaction?.fee??null,charge?.balance_transaction?.net??null,ev.id,payment.payment_id))
 }
 // A decline stays retryable in the same hosted session. Capacity is released only when Stripe expires the session.
 writes.push(audit(c,'card.event',payment.payment_id,ev.type))
 try{await db.batch(writes)}catch(e){if(String(e).includes('UNIQUE constraint')&&await one(c,'SELECT id FROM tt_card_events WHERE id=?',ev.id))return{paymentId:payment.payment_id,replayed:true,tenancyId:payment.tenancy_id};throw e}
 return{paymentId:payment.payment_id,replayed:false,state:expired?'expired':failed?'declined':'paid',tenancyId:payment.tenancy_id}
}
