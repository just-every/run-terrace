import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {installation,tenancyInput} from './api/harness.mjs'
import {syntheticPack} from './rule-packs.mjs'

export async function cardFixture({assets=false,live=false,provider,inspect}={}){
 const edge={failNextCreate:false},calls=[],sessions=new Map(),events=new Map(),intents=new Map(),charges=new Map()
 const stripeRequest=async request=>{
  const url=new URL(request.url);calls.push(url.pathname)
  if(live){
   const response=await fetch(request.url,{method:request.method,headers:Object.fromEntries([...request.headers].filter(([name])=>['authorization','content-type','stripe-version','idempotency-key'].includes(name.toLowerCase()))),...(['GET','HEAD'].includes(request.method)?{}:{body:await request.arrayBuffer()})})
   if(!response.ok){const error=await response.clone().json();const key=process.env.STRIPE_SECRET_KEY;const message=String(error.error?.message??'').split(key).join('[redacted]').replace(/\b(?:sk|pk|rk)_(?:test|live)_[^\s<>"']+/g,'[redacted]');console.log(JSON.stringify({stripeStatus:response.status,type:error.error?.type,code:error.error?.code,message}))}
   return response
  }
  if(provider)return provider(request)
  const body=new URLSearchParams(await request.text()),key=request.headers.get('idempotency-key')
  if(url.pathname==='/v1/checkout/sessions'&&request.method==='POST'){
   if(sessions.has(key))return Response.json(sessions.get(key))
   assert.equal(body.get('allowed_payment_method_types[0]'),'card');assert.equal(body.get('line_items[0][price_data][currency]'),'usd')
   assert.equal(body.has('customer_email'),false,'no resident contact is disclosed')
   const session={id:'cs_test_'+randomUUID().replaceAll('-',''),url:'https://checkout.stripe.com/c/pay/synthetic-terrace-1',livemode:false,currency:'usd',amount_total:Number(body.get('line_items[0][price_data][unit_amount]')),metadata:{terrace_payment_id:body.get('metadata[terrace_payment_id]')},payment_status:'unpaid'}
   sessions.set(key,session);if(edge.failNextCreate){edge.failNextCreate=false;return Response.json({error:{code:'synthetic_terrace_uncertain'}},{status:503})}return Response.json(session)
  }
  for(const [path,rows]of [['events',events],['payment_intents',intents],['charges',charges]])if(url.pathname.startsWith('/v1/'+path+'/')){const row=rows.get(url.pathname.split('/').at(-1));return row?Response.json(row):Response.json({error:{code:'resource_missing'}},{status:404})}
  if(url.pathname.startsWith('/v1/checkout/sessions/'))return Response.json([...sessions.values()].find(s=>s.id===url.pathname.split('/').at(-1)))
  throw Error('Unexpected provider edge '+url.pathname)
 }
 const h=await installation({assets,asyncDatabase:live||undefined,stripeKey:live?process.env.STRIPE_SECRET_KEY:'synthetic-terrace-1',stripeRequest,now:live?undefined:'2026-10-26T12:00:00.000Z'})
 try{
  const f=await h.command('portfolio.add',{name:'Alder Homes'}),property=await h.command('property.add',{portfolioId:f.id,name:'Alder Court',address:'1840 Alder Street, Oakland, CA',kind:'duplex',timeZone:'America/Los_Angeles'}),u=await h.command('unit.add',{propertyId:property.id,identifier:'1C',bedrooms:'2',bathrooms:'1'}),t=await h.command('tenancy.create',{...tenancyInput,unitId:u.id,rent:'1000.00',cadence:'monthly'})
  const day=(await h.state(t.id)).ledger.today
  const q=await h.command('rent.charge',{tenancyId:t.id,dueDate:day,amount:'1000.00',description:'October rent',reference:'synthetic-terrace-80'})
  const stages=[{minDaysPastDue:0,allowPartial:true,overpayment:'credit'}]
  await h.command('payment.policy',{tenancyId:t.id,version:0,terms:{stages,priority:[q.id]},reference:'synthetic-terrace-81'})
  const cardForm=await(await h.request('/app?tab=ledger&tenancy='+t.id)).text(),consentVersion=cardForm.match(/name="consentVersion" value="([^"]+)"/)?.[1];assert.ok(consentVersion)
  const pay={tenancyId:t.id,amount:'100.00',requestKey:randomUUID(),consent:'yes',consentVersion}
  await h.command('payment.card',pay,{status:409});assert.equal(calls.length,0,'missing reviewed rules hold before provider egress')
  await h.command('property.rules',{propertyId:property.id,stateCode:'CA',version:0,reference:'synthetic-terrace-82'})
  const pack=syntheticPack('CA');pack.fields.partialPayments.value={stages};const published=await h.command('rules.pack',pack);await h.command('rules.activate',{packId:published.id,consent:'REVIEWED'})
  await h.stepUp();await h.command('portal.invite',{source:'synthetic-terrace-84 authorized portal invitation',kind:'resident',displayName:'Alex Chen',email:tenancyInput.tenantEmail,tenancyId:t.id});const resident=await h.portalSignIn(tenancyInput.tenantEmail)
  await h.command('portal.invite',{source:'synthetic-terrace-84 authorized portal invitation',kind:'resident',displayName:'Different resident',email:'other-card@example.test',tenancyId:t.id,access:'delegate'});const delegate=await h.portalSignIn('other-card@example.test')
  const post=(params,as=resident)=>h.request('/portal/api/card',{method:'POST',as,form:new URLSearchParams(params)})
  return await inspect({h,t,q,day,resident,delegate,pay,post,calls,sessions,events,intents,charges,edge})
 }finally{await h.close()}
}
export async function journey({assets=false,inspect}={}){
 await cardFixture({assets,inspect:async({h,t,q,day,resident,delegate,pay,post,calls,sessions,events,intents,charges,edge})=>{
  assert.equal((await post(pay,delegate)).status,404)
  assert.equal((await post({...pay,tenancyId:randomUUID()})).status,404)
  assert.equal((await post({...pay,consent:'no'})).status,400)
  assert.equal((await post({...pay,consentVersion:'synthetic-terrace-outdated'})).status,400,'changed consent terms require a new review')
  assert.equal((await h.request('/portal/api/card',{method:'POST',as:resident,originHeader:'https://elsewhere.test',form:new URLSearchParams(pay)})).status,403)
  const member=await h.invite('member','card-preparer@example.test');await h.command('payment.card',pay,{as:member,status:403})
  await inspect?.({phase:'review',h,t,resident,pay})
  const starts=await Promise.all([post(pay),post(pay)]);const started=starts[0];assert.equal(starts[1].status,200,await starts[1].clone().text());assert.equal(started.status,200,(await started.clone().text())+' provider calls '+JSON.stringify(calls));const result=await started.json()
  assert.equal((await post(pay)).status,200,'same request resumes without another reservation')
  assert.equal((await h.state(t.id)).ledger.balanceCents,100000,'hosted redirect posts no receipt')
  const p=(await h.state(t.id)).ledger.payments.payments[0];assert.equal(p.amount_cents,10000);assert.equal(p.state,'pending')
  await h.command('payment.settle',{paymentId:p.id,version:p.version,on:day,reference:'synthetic-terrace-83'},{status:409})
  const session=[...sessions.values()][0],intent='pi_syntheticterrace1',charge='ch_syntheticterrace1'
  session.payment_intent=intent;intents.set(intent,{id:intent,livemode:false,status:'succeeded',currency:'usd',amount_received:10000,latest_charge:charge,metadata:session.metadata});charges.set(charge,{id:charge,livemode:false,paid:true,captured:true,refunded:false,amount:10000,payment_intent:intent,balance_transaction:{fee:320,net:9680}})
  const notify=async ev=>{events.set(ev.id,ev);return h.request('/api/stripe/events',{method:'POST',as:'',body:{id:ev.id,data:{object:{amount_total:1}}}})}
  const make=(kind,obj,n)=>({id:'evt_syntheticterrace'+n,livemode:false,type:kind,created:Date.parse('2026-10-26T12:00:00Z')/1000,data:{object:structuredClone(obj)}})
  assert.equal((await h.request('/api/stripe/events',{method:'POST',as:'',body:{id:'evt_unknownterrace'}})).status,409,'invented events cannot post')
  assert.equal((await notify(make('payment_intent.payment_failed',{id:intent,metadata:session.metadata},1))).status,200)
  assert.equal((await h.state(t.id)).ledger.receipts.length,0,'decline posts nothing and can retry in the same hosted session')
  session.payment_status='paid';const success=make('checkout.session.completed',session,2)
  const results=await Promise.all([notify(success),notify(success)]);for(const r of results)assert.equal(r.status,200,await r.clone().text())
  let ledger=(await h.state(t.id)).ledger;assert.equal(ledger.receipts.length,1);assert.equal(ledger.receipts[0].amount_cents,10000);assert.equal(ledger.balanceCents,90000);assert.equal(ledger.payments.pendingCents,0)
  await h.restart();assert.equal((await notify(success)).status,200);assert.equal((await h.state(t.id)).ledger.receipts.length,1)
  const receipt=await h.request('/portal/card?tenancy='+t.id+'&payment='+result.paymentId,{as:resident});assert.equal(receipt.status,200);assert.match(await receipt.text(),new RegExp(charge))
  const staff=await h.request('/app?tab=ledger&tenancy='+t.id);assert.match(await staff.text(),/ch_syntheticterrace1/)
  await inspect?.({phase:'paid',h,t,resident,pay,paymentId:result.paymentId})
  const uncertainPay={...pay,requestKey:randomUUID(),amount:'50.00'};edge.failNextCreate=true
  await h.command('payment.card',uncertainPay,{status:503});assert.equal((await h.state(t.id)).ledger.payments.pendingCents,5000,'an uncertain creation holds the original reservation')
  await inspect?.({phase:'uncertain',h,t,resident,pay:uncertainPay})
  const expiredStart=await h.command('payment.card',uncertainPay),second=[...sessions.values()].find(s=>s.metadata.terrace_payment_id===expiredStart.paymentId)
  const expired=make('checkout.session.expired',second,3);assert.equal((await notify(expired)).status,200);ledger=(await h.state(t.id)).ledger;assert.equal(ledger.payments.pendingCents,0);assert.equal(ledger.receipts.length,1)
  const archive=await(await h.request('/api/backup')).text();assert.equal(archive.includes('checkout_url'),false,'hosted links stay in their installation')
  const fresh=await installation();try{await fresh.formCommand('data.restore',{confirm:'RESTORE',backup:new File([archive],'cards.rer')});assert.equal((await fresh.state(t.id)).ledger.receipts.length,1)}finally{await fresh.close()}
 }})
 const h=await installation({demo:true,stripeKey:'synthetic-terrace-1',stripeRequest:()=>{throw Error('Demo escaped to Stripe')}})
 try{const s=await h.state();await h.command('payment.card',{tenancyId:s.tenancies[0].id},{status:403});assert.equal((await h.request('/api/stripe/events',{method:'POST',as:'',body:{id:'evt_syntheticterrace1'}})).status,503)}finally{await h.close()}
}
