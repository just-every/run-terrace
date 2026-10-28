import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'

/** LEASE-007 fake only at the provider edge. Used by the public application journey. */
export function applicationFeeProvider() {
 const sessions = new Map(), events = new Map(), intents = new Map(), charges = new Map(), calls = []
 const edge = {uncertainNextCreate:false}
 const stripeRequest = async request => {
  const url = new URL(request.url)
  calls.push({method:request.method,path:url.pathname})
  if (url.pathname === '/v1/checkout/sessions' && request.method === 'POST') {
   const body = new URLSearchParams(await request.text()), key = request.headers.get('idempotency-key')
   assert.ok(key?.startsWith('terrace-application-fee:'))
   assert.equal(body.get('payment_method_types[0]'),'card')
   assert.equal(body.get('line_items[0][price_data][currency]'),'usd')
   assert.equal(body.has('customer_email'),false)
   assert.equal(body.has('customer'),false)
   assert.equal(body.has('application_fee_amount'),false)
   const feeId = body.get('metadata[terrace_application_fee_id]')
   assert.equal(body.get('payment_intent_data[metadata][terrace_application_fee_id]'),feeId)
   let session = sessions.get(key)
   if (!session) {
    session = {id:'cs_test_'+randomUUID().replaceAll('-',''),url:'https://checkout.stripe.com/c/pay/synthetic-terrace-1',livemode:false,mode:'payment',currency:'usd',amount_total:Number(body.get('line_items[0][price_data][unit_amount]')),metadata:{terrace_application_fee_id:feeId},payment_status:'unpaid',status:'open'}
    sessions.set(key,session)
   }
   if (edge.uncertainNextCreate) { edge.uncertainNextCreate=false; return Response.json({error:{code:'synthetic_terrace_uncertain'}},{status:503}) }
   return Response.json(session)
  }
  for (const [path, rows] of [['events',events],['payment_intents',intents],['charges',charges]]) {
   if (url.pathname.startsWith('/v1/'+path+'/')) { const value = rows.get(url.pathname.split('/').at(-1)); return value ? Response.json(value) : Response.json({error:{code:'resource_missing'}},{status:404}) }
  }
  if (url.pathname.startsWith('/v1/checkout/sessions/')) {
   const session = [...sessions.values()].find(s=>s.id===url.pathname.split('/').at(-1))
   return session ? Response.json(session) : Response.json({error:{code:'resource_missing'}},{status:404})
  }
  throw Error('Unexpected application fee provider edge '+url.pathname)
 }
 const event = (type,object) => {
  const result = {id:'evt_syntheticterrace'+randomUUID().replaceAll('-',''),livemode:false,type,created:Date.parse('2026-10-28T12:00:00Z')/1000,data:{object:structuredClone(object)}}
  events.set(result.id,result)
  return result
 }
 const paid = session => {
  const intent='pi_syntheticterrace'+randomUUID().replaceAll('-',''),charge='ch_syntheticterrace'+randomUUID().replaceAll('-','')
  session.payment_intent=intent;session.payment_status='paid';session.status='complete'
  intents.set(intent,{id:intent,livemode:false,status:'succeeded',currency:'usd',amount:session.amount_total,amount_received:session.amount_total,latest_charge:charge,metadata:session.metadata})
  charges.set(charge,{id:charge,livemode:false,paid:true,captured:true,refunded:false,currency:'usd',amount:session.amount_total,amount_captured:session.amount_total,amount_refunded:0,payment_intent:intent})
  return event('checkout.session.completed',session)
 }
 const expired = session => {session.status='expired';return event('checkout.session.expired',session)}
 const declined = session => {
  const intent='pi_syntheticterrace'+randomUUID().replaceAll('-','');session.payment_intent=intent
  return event('payment_intent.payment_failed',{id:intent,livemode:false,amount:session.amount_total,currency:'usd',metadata:session.metadata})
 }
 return {stripeRequest,sessions,events,intents,charges,calls,edge,event,paid,expired,declined}
}
