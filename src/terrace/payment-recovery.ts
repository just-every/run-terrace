import type {Bindings} from '../auth.server'
import {allow,authority,commit,Fault,guard,insist,one,sql,tenancy,tenancyGuard,type Context,type Row} from './core'
import {stripe} from './stripe-provider'
import {verifiedCardEvent} from './card-payments'

/** Cases are evidence. Only the nonportable Checkout link row grants originating-installation admission. */
export async function recoveryPayment(c:Context,p:Row){
 const t=await tenancy(c,p.tenancyId)
 const row=await one(c,'SELECT c.*,r.outcome,r.session_id,p.amount_cents FROM tt_card_payments c JOIN tt_payments p ON p.id=c.payment_id JOIN tt_payment_recovery r ON r.payment_id=c.payment_id WHERE c.payment_id=? AND p.tenancy_id=?',String(p.paymentId??''),t.id)
 insist(row,'not_found','Payment recovery case not found.',404)
 insist(await one(c,'SELECT 1 FROM tt_card_checkout_links WHERE payment_id=?',row.payment_id),'restore_hold','Recovery evidence is read-only outside its originating installation.',409)
 return {row,t}
}
export async function paymentRecovery(c:Context,env:Bindings,name:string,p:Row){
 allow(c,name);insist(!c.actor.credential,'forbidden','API credentials cannot resolve card payments.',403)
 const {row,t}=await recoveryPayment(c,p)
 if(name==='payment.card.review'){
  insist(['inspect_provider','obtain_event','resolve_conflict'].includes(p.nextAction),'next_action','Choose a recovery next action.')
  await commit(c,[tenancyGuard(c,t),sql(c,'UPDATE tt_payment_recovery SET assigned_to=?,next_action=?,updated_at=? WHERE payment_id=?',c.actor.id,p.nextAction,c.now,row.payment_id)],name,row.payment_id)
  return {tenancyId:t.id,notice:'Recovery responsibility and next action saved.'}
 }
 const hasEvent=typeof p.eventId==='string'&&p.eventId.trim()!==''
 if(hasEvent)insist(/^evt_[A-Za-z0-9]{5,100}$/.test(p.eventId),'provider_event','Supply a Stripe event id.')
 else insist(typeof p.sessionId==='string'&&/^cs_test_[A-Za-z0-9]{5,150}$/.test(p.sessionId),'provider_session','Supply the original Stripe test session id or a canonical event id.')
 let outcome='unknown',sessionId:string|null=null
 try{
  if(hasEvent){
   const result=await verifiedCardEvent(env,p.eventId,c.now,t.id,row.payment_id,[authority(c,name),tenancyGuard(c,t)])
   return {...result,notice:'Canonical event verified. Recovery evidence and ledger outcome saved.'}
  }
  const session=await stripe(env,'checkout/sessions/'+p.sessionId)
  insist(session.id===p.sessionId&&session.livemode===false&&session.mode==='payment'&&session.metadata?.terrace_payment_id===row.payment_id&&session.amount_total===row.amount_cents&&session.currency==='usd'&&(!row.checkout_id||row.checkout_id===session.id)&&(!row.session_id||row.session_id===session.id),'provider_conflict','Provider evidence conflicts with this original payment.',409)
  sessionId=session.id;outcome='awaiting_event'
 }catch(error){
  if(!(error instanceof Fault))throw error
  outcome=['provider_conflict','provider_event','not_found'].includes(error.code)?'conflicting':'unknown'
  // No provider payload or error text is retained; uncertainty never releases the reservation.
 }
 await commit(c,[tenancyGuard(c,t),guard(c,'EXISTS(SELECT 1 FROM tt_card_checkout_links WHERE payment_id=?)',row.payment_id),sql(c,"UPDATE tt_payment_recovery SET outcome=CASE WHEN outcome='resolved' THEN outcome ELSE ? END,session_id=COALESCE(session_id,?),updated_at=? WHERE payment_id=?",outcome,sessionId,c.now,row.payment_id)],name,row.payment_id)
 return {tenancyId:t.id,paymentId:row.payment_id,outcome,notice:outcome==='conflicting'?'Conflicting provider evidence. Reservation remains held for staff review.':outcome==='unknown'?'Provider outcome remains unknown. Reservation remains held.':'Session found. Obtain its canonical event to confirm a financial outcome; lookup changed no money.'}
}
