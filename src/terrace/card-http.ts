import {paymentRecovery} from './payment-recovery'
import {BALANCE} from './ledger'
import {RESERVED} from './payment-admission'
import type {Bindings} from '../auth.server'
import {allow,authority,escape as e,money,shown,Fault,guard,insist,one,recordRead,tenancy,type Context,type Row} from './core'
import type {Portal} from './portal-session'
import {cardRows,startCard,verifiedCardEvent} from './card-payments'
import {cardStart,cardHistory} from './card-view'
import {shell} from './portal-view'
export const CARD_COMMANDS=['payment.card','payment.card.reconcile','payment.card.lookup','payment.card.review']
export async function staffCard(c:Context,env:Bindings,name:string,p:Row){
 if(!CARD_COMMANDS.includes(name))return
 allow(c,name);insist(!c.actor.credential,'forbidden','API credentials cannot collect card payments.',403)
 const t=await tenancy(c,p.tenancyId)
 if(name==='payment.card.lookup'||name==='payment.card.review')return paymentRecovery(c,env,name,p)
 if(name==='payment.card')return startCard(c,env,p,[authority(c,name)])
 const result=await verifiedCardEvent(env,p.eventId,c.now,t.id,undefined,[authority(c,name)])
 await recordRead(c,'card.reconcile',result.paymentId)
 return{...result,notice:'Stripe event verified. The stored provider outcome is shown below.'}
}
export async function portalCard(request:Request,env:Bindings,c:Context,p:Portal,form:FormData){
 const url=new URL(request.url),tenancyId=request.method==='POST'?String(form.get('tenancyId')??''):url.searchParams.get('tenancy')
 const grant=p.grants.find(g=>g.access==='resident'&&g.tenancy_id===tenancyId)
 insist(grant,'not_found','Account not found.',404)
 const t=await tenancy(c,tenancyId)
 if(request.method==='POST'){
  const live=guard(c,"EXISTS(SELECT 1 FROM tt_portal_sessions s JOIN tt_portal_identities i ON i.id=s.identity_id JOIN tt_portal_grants g ON g.identity_id=i.id WHERE s.hash=? AND s.revoked_at IS NULL AND s.expires_at>? AND i.status='active' AND g.id=? AND g.access='resident' AND g.revoked_at IS NULL AND g.tenancy_id=?)",p.sessionHash,c.now,grant.id,t.id)
  const result=await startCard(c,env,{...Object.fromEntries(form),tenancyId:t.id},[live])
  if(url.pathname==='/portal/api/card')return Response.json(result,{headers:{'cache-control':'no-store'}})
  return new Response(null,{status:303,headers:{location:result.checkoutUrl,'cache-control':'no-store','referrer-policy':'no-referrer'}})
 }
 const paymentId=url.searchParams.get('payment'),rows=(await cardRows(c,t.id)).filter(r=>!paymentId||r.payment_id===paymentId)
 insist(!paymentId||rows.length,'not_found','Payment not found.',404)
 const link=paymentId?await one(c,'SELECT checkout_url FROM tt_card_checkout_links WHERE payment_id=?',paymentId):null
 const balance=await one(c,`SELECT COALESCE(SUM(${BALANCE}),0) AS outstanding,COALESCE(SUM(${RESERVED}),0) AS pending FROM tt_charges q WHERE tenancy_id=?`,t.id)
 const retry=paymentId?await one(c,"SELECT c.request_key,p.amount_cents FROM tt_card_payments c JOIN tt_payments p ON p.id=c.payment_id WHERE c.payment_id=? AND c.initiated_by=? AND c.state='reserved'",paymentId,c.actor.id):null
 const body=shell('Pay by card',`<section><h2>${e(t.address)}</h2><p><strong>Outstanding ${money(balance!.outstanding,shown(t))}</strong> · pending allocations ${money(balance!.pending,shown(t))}</p><p>Stripe test mode · no live money moves. Card details and authentication are handled on Stripe’s hosted page.</p>${paymentId?'':env.STRIPE_SECRET_KEY&&!env.RER_DEMO?cardStart(t.id):'<p>Card collection is not configured. Contact your property manager.</p>'}${cardHistory(rows,t.id)}${retry?'<h3>Resume the same Checkout request</h3><p>An uncertain request remains reserved. This explicitly asks Stripe for the same request again; it does not allocate another payment.</p>'+cardStart(t.id,false,retry):''}${link&&rows[0]?.state==='checkout'?`<p><a href="${link.checkout_url.replaceAll('&','&amp;')}">Resume secure Stripe checkout</a></p>`:''}<a href="/portal/lease?tenancy=${t.id}">Back to your account</a></section>`,p.identity)
 return new Response(body,{headers:{'content-type':'text/html;charset=utf-8','cache-control':'private, no-store','x-content-type-options':'nosniff','referrer-policy':'strict-origin','content-security-policy':"default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; form-action 'self' https://checkout.stripe.com; frame-ancestors 'none'"}})
}
export async function stripeEventResponse(request:Request,env:Bindings){
 try{
  insist(request.method==='POST','method','Use POST.',405)
  const raw=await request.text();insist(raw.length<=4096,'body_limit','Event notification too large.',413)
  let data:Row;try{data=JSON.parse(raw)}catch{throw new Fault('provider_event','Send a Stripe event notification.')}
  const result=await verifiedCardEvent(env,data.id,new Date().toISOString())
  return Response.json({received:true,replayed:result.replayed},{headers:{'cache-control':'no-store'}})
 }catch(e){if(e instanceof Fault)return Response.json({error:e.code,message:e.message},{status:e.status,headers:{'cache-control':'no-store'}});throw e}
}
