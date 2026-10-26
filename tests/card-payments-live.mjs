// Run only with the held test credential injected into the process environment.
import assert from 'node:assert/strict'
import {mkdir} from 'node:fs/promises'
import {join,resolve} from 'node:path'
import {chromium} from '@playwright/test'
import {request as httpRequest} from 'node:http'
import {cardFixture} from './card-payments.mjs'
const out=resolve(process.env.CARD_SCREENSHOTS??'.rer/card-screens');await mkdir(out,{recursive:true})
assert.ok(process.env.STRIPE_SECRET_KEY,'Inject the Stripe test secret key; never put it in a file.')
const browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']})
const api=async path=>{console.log('Stripe live proof: reading '+path.split('/')[0]);const r=await fetch('https://api.stripe.com/v1/'+path,{headers:{authorization:'Bearer '+process.env.STRIPE_SECRET_KEY,'Stripe-Version':'2026-09-30.endive'},signal:AbortSignal.timeout(15000)});const d=await r.json();assert.ok(r.ok,'Stripe API status '+r.status+' code '+(d.error?.code??''));assert.equal(d.livemode??false,false);return d}
const cookies=(cookie,url)=>cookie.split('; ').map(p=>{const i=p.indexOf('=');return{name:p.slice(0,i),value:p.slice(i+1),url}})
console.log('Stripe live proof: starting public-door fixture')
try{await cardFixture({assets:true,live:true,inspect:async({h,t,resident})=>{
 console.log('Stripe live proof: resident and staff doors ready')
 const ctx=await browser.newContext();ctx.setDefaultTimeout(30000);ctx.setDefaultNavigationTimeout(60000);await ctx.addCookies(cookies(resident,h.origin));const page=await ctx.newPage()
 const staffCtx=await browser.newContext();staffCtx.setDefaultTimeout(30000);staffCtx.setDefaultNavigationTimeout(60000);await staffCtx.addCookies(cookies(h.cookie,h.origin));const staff=await staffCtx.newPage()
 const local=async(path,{method='GET',body,as=h.cookie}={})=>new Promise((resolve,reject)=>{const payload=body===undefined?undefined:JSON.stringify(body),r=httpRequest(h.origin+path,{method,headers:{origin:h.origin,...(as?{cookie:as}:{}),...(payload?{'content-type':'application/json','content-length':Buffer.byteLength(payload)}:{})}},response=>{const chunks=[];response.on('data',c=>chunks.push(c));response.on('error',reject);response.on('end',()=>{try{assert.equal(response.statusCode,200,'public HTTP status '+response.statusCode+' '+Buffer.concat(chunks).toString().slice(0,500));resolve(JSON.parse(Buffer.concat(chunks).toString()))}catch(error){reject(error)}})});r.setTimeout(15000,()=>r.destroy(Error('Local public HTTP timeout')));r.on('error',reject);r.end(payload)})
 const state=()=>local('/api/state?tenancy='+t.id)
 const proof=async(page,name)=>{for(const [width,height]of [[1440,900],[390,844]]){console.log('Stripe live proof: capturing '+name+' '+width);await page.setViewportSize({width,height});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no overflow '+name+' '+width);await page.screenshot({path:join(out,name+'-'+width+'.png'),fullPage:true,timeout:15000})}}
 const staffProof=async(name,eventId)=>{await staff.goto(h.origin+'/app?tab=ledger&tenancy='+t.id);if(eventId){await staff.getByText('Reconcile a Stripe event',{exact:true}).click();await staff.getByLabel('Stripe event id',{exact:true}).fill(eventId);await staff.getByRole('button',{name:'Verify provider event',exact:true}).click();await staff.getByRole('heading',{name:'Online card payments',exact:true}).waitFor()}const people=staff.getByRole('link',{name:'Manage people',exact:true});await people.focus();assert.equal(await staff.locator('#people-tooltip').evaluate(el=>getComputedStyle(el).visibility),'visible');await proof(staff,name)}
 const eventFor=async(type,id)=>{
  for(let i=0;i<10;i++){const events=await api('events?type='+encodeURIComponent(type)+'&limit=50');const e=events.data.find(e=>e.data.object.id===id);if(e)return e;await new Promise(r=>setTimeout(r,1000))}
  throw Error('No Stripe '+type+' event for '+id)
 }
 const publish=event=>local('/api/stripe/events',{method:'POST',as:'',body:{id:event.id}})
 try{for(const scenario of ['success','declined','authentication']){
  await page.goto(h.origin+'/portal/card?tenancy='+t.id);await page.getByLabel('Payment amount USD',{exact:true}).fill(scenario==='declined'?'12.00':'10.00');await page.getByLabel('I authorize this one-time payment',{exact:false}).check();assert.ok((await page.locator('main').innerText()).includes('Payer fee: $0.00'));await proof(page,scenario+'-review');await page.setViewportSize({width:1440,height:1000});const postResponse=page.waitForResponse(r=>r.request().method()==='POST'&&new URL(r.url()).pathname==='/portal/card');await page.getByRole('button',{name:'Continue to Stripe',exact:true}).click({noWaitAfter:true});const posted=await postResponse;if(posted.status()!==303)throw Error('Checkout submission '+posted.status()+': '+await page.locator('main').innerText());await page.waitForURL('https://checkout.stripe.com/**',{timeout:60000,waitUntil:'domcontentloaded'});
  const sessionId=page.url().match(/cs_test_[A-Za-z0-9]+/)?.[0];assert.ok(sessionId)
  await page.locator('input[name="email"]').fill('stripe-card-proof@example.test',{timeout:60000})
  await page.locator('input[name="cardNumber"]').fill(scenario==='success'?'4242424242424242':scenario==='declined'?'4000000000000002':'4000000000003220')
  await page.locator('input[name="cardExpiry"]').fill('1230');await page.locator('input[name="cardCvc"]').fill('123');
  const name=page.locator('input[name="billingName"]');if(await name.count())await name.fill('Alex Chen')
  const country=page.getByLabel('Country or region',{exact:true});await country.selectOption('US');await page.locator('input[name="billingPostalCode"]').fill('94607')
  await proof(page,scenario+'-stripe');console.log('Stripe live proof: '+scenario+' submitting hosted form');await page.getByRole('button',{name:/^Pay(?:\s|$)/}).click({noWaitAfter:true});console.log('Stripe live proof: '+scenario+' hosted form submitted')
  if(scenario==='declined'){
   await page.getByText(/Your card was declined/i).first().waitFor({timeout:60000});await proof(page,'declined-stripe-result')
   const session=await api('checkout/sessions/'+sessionId);assert.equal(session.payment_status,'unpaid');const failed=await eventFor('payment_intent.payment_failed',session.payment_intent);await publish(failed);assert.equal((await state()).ledger.receipts.length,1)
   console.log(JSON.stringify({scenario,session:sessionId,intent:session.payment_intent,event:failed.id,ledgerReceiptCount:1}))
   // Expire this explicit test attempt; its provider event releases the reservation.
   const expired=await fetch('https://api.stripe.com/v1/checkout/sessions/'+sessionId+'/expire',{method:'POST',headers:{authorization:'Bearer '+process.env.STRIPE_SECRET_KEY},signal:AbortSignal.timeout(15000)});assert.ok(expired.ok,'Stripe expiry '+expired.status);await expired.body?.cancel();await publish(await eventFor('checkout.session.expired',sessionId));await page.goto(h.origin+'/portal/card?tenancy='+t.id);await proof(page,'declined-resident-result');await staffProof('declined-staff-result');continue
  }
  if(scenario==='authentication'){
   const until=Date.now()+60000;let authenticate
   while(Date.now()<until&&!authenticate){for(const frame of page.frames()){const button=frame.getByRole('button',{name:'Complete authentication',exact:true});if(await button.isVisible().catch(()=>false)){authenticate=button;break}}if(!authenticate)await page.waitForTimeout(250)}
   assert.ok(authenticate,'Stripe exposed the required 3DS challenge');await proof(page,'authentication-challenge');await authenticate.click({noWaitAfter:true})
  }
  await page.waitForURL(h.origin+'/portal/card**',{timeout:60000,waitUntil:'domcontentloaded'});console.log('Stripe live proof: '+scenario+' returned to Terrace')
  const session=await api('checkout/sessions/'+sessionId);assert.equal(session.payment_status,'paid');const completed=await eventFor('checkout.session.completed',sessionId);console.log(JSON.stringify({scenario,stage:'provider_paid',session:sessionId,intent:session.payment_intent,event:completed.id}));console.log('Stripe live proof: '+scenario+' reading pre-event ledger')
  assert.equal((await state()).ledger.receipts.length,scenario==='success'?0:1,'browser return cannot post money');console.log('Stripe live proof: '+scenario+' pre-event ledger checked')
  await page.getByRole('heading',{name:/Awaiting Stripe confirmation/}).first().waitFor();await proof(page,scenario+'-awaiting-event');await publish(completed);console.log('Stripe live proof: '+scenario+' event posted');await h.restart();console.log('Stripe live proof: '+scenario+' worker restarted');const replay=await publish(completed);assert.equal(replay.replayed,true)
  await page.reload();await page.getByRole('heading',{name:/Card payment receipt/}).first().waitFor();await proof(page,scenario+'-resident-receipt');await staffProof(scenario+'-staff-reconciled',completed.id)
  const intent=await api('payment_intents/'+session.payment_intent),charge=await api('charges/'+intent.latest_charge),balance=await api('balance_transactions/'+charge.balance_transaction),ledger=(await state()).ledger
  assert.equal(charge.currency,'usd');assert.equal(charge.amount,1000);assert.equal(balance.currency,'usd');assert.equal(balance.net,charge.amount-balance.fee)
  const shown=await staff.locator('article').filter({hasText:charge.id}).innerText(),usd=n=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(n/100)
  assert.ok(shown.includes(usd(balance.fee))&&shown.includes(usd(balance.net)),'staff reconciliation shows the actual provider fee and net');assert.ok((await page.locator('main').innerText()).includes(charge.id),'resident receipt carries the matching charge reference')
  assert.equal(ledger.receipts.length,scenario==='success'?1:2);assert.equal(ledger.balanceCents,scenario==='success'?99000:98000);assert.equal(ledger.receipts.reduce((n,r)=>n+r.amount_cents,0),scenario==='success'?1000:2000);if(scenario==='authentication')assert.equal(charge.payment_method_details.card.three_d_secure.result,'authenticated')
  console.log(JSON.stringify({scenario,session:sessionId,intent:intent.id,charge:charge.id,event:completed.id,authentication:charge.payment_method_details.card.three_d_secure?.result??null,providerFeeCents:balance.fee,providerNetCents:balance.net,ledgerReceiptCount:ledger.receipts.length,replayNoDoublePosting:true}))
 }}catch(error){console.log('Live browser failure origin '+new URL(page.url()).origin);const safe=String(error).split(process.env.STRIPE_SECRET_KEY).join('[redacted]').replace(/https:\/\/checkout\.stripe\.com[^\s)]+/g,'https://checkout.stripe.com/[redacted]');console.log(safe);await page.screenshot({path:join(out,'live-failure.png'),fullPage:true,timeout:15000}).catch(()=>console.log('Failure capture unavailable'));throw Error(safe)}
 await staffCtx.close();await ctx.close()
}})}finally{await browser.close()}
