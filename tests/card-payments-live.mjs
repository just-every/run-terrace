// Run only with the held test credential injected into the process environment.
import assert from 'node:assert/strict'
import {mkdir} from 'node:fs/promises'
import {join,resolve} from 'node:path'
import {chromium} from '@playwright/test'
import {cardFixture} from './card-payments.mjs'
const out=resolve(process.env.CARD_SCREENSHOTS??'.rer/card-screens');await mkdir(out,{recursive:true})
assert.ok(process.env.STRIPE_SECRET_KEY,'Inject the Stripe test secret key; never put it in a file.')
const browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']})
const api=async path=>{const r=await fetch('https://api.stripe.com/v1/'+path,{headers:{authorization:'Bearer '+process.env.STRIPE_SECRET_KEY,'Stripe-Version':'2026-09-30.endive'}});const d=await r.json();assert.ok(r.ok,'Stripe API status '+r.status+' code '+(d.error?.code??''));assert.equal(d.livemode??false,false);return d}
const cookies=(cookie,url)=>cookie.split('; ').map(p=>{const i=p.indexOf('=');return{name:p.slice(0,i),value:p.slice(i+1),url}})
console.log('Stripe live proof: starting public-door fixture')
try{await cardFixture({assets:true,live:true,inspect:async({h,t,resident})=>{
 console.log('Stripe live proof: resident and staff doors ready')
 const ctx=await browser.newContext();await ctx.addCookies(cookies(resident,h.origin));const page=await ctx.newPage()
 const staffCtx=await browser.newContext();await staffCtx.addCookies(cookies(h.cookie,h.origin));const staff=await staffCtx.newPage()
 const proof=async(page,name)=>{for(const [width,height]of [[1440,900],[390,844]]){await page.setViewportSize({width,height});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no overflow '+name+' '+width);await page.screenshot({path:join(out,name+'-'+width+'.png'),fullPage:true})}}
 const staffProof=async name=>{await staff.goto(h.origin+'/app?tab=ledger&tenancy='+t.id);const people=staff.getByRole('link',{name:'Manage people',exact:true});await people.focus();assert.equal(await staff.locator('#people-tooltip').evaluate(el=>getComputedStyle(el).visibility),'visible');await proof(staff,name)}
 const eventFor=async(type,id)=>{
  for(let i=0;i<10;i++){const events=await api('events?type='+encodeURIComponent(type)+'&limit=50');const e=events.data.find(e=>e.data.object.id===id);if(e)return e;await new Promise(r=>setTimeout(r,1000))}
  throw Error('No Stripe '+type+' event for '+id)
 }
 const publish=async event=>{const r=await h.request('/api/stripe/events',{method:'POST',as:'',body:{id:event.id}});assert.equal(r.status,200,await r.clone().text());return r.json()}
 for(const scenario of ['success','declined','authentication']){
  await page.goto(h.origin+'/portal/card?tenancy='+t.id);await page.getByLabel('Payment amount USD',{exact:true}).fill(scenario==='declined'?'12.00':'10.00');await page.getByLabel('I authorize this one-time payment',{exact:false}).check();await proof(page,scenario+'-review');await page.setViewportSize({width:1440,height:1000});const postResponse=page.waitForResponse(r=>r.request().method()==='POST'&&new URL(r.url()).pathname==='/portal/card');await page.getByRole('button',{name:'Continue to Stripe',exact:true}).click({noWaitAfter:true});const posted=await postResponse;assert.equal(posted.status(),303,await page.locator('main').innerText());await page.waitForURL('https://checkout.stripe.com/**',{timeout:60000,waitUntil:'domcontentloaded'});
  const sessionId=page.url().match(/cs_test_[A-Za-z0-9]+/)?.[0];assert.ok(sessionId)
  await page.locator('input[name="email"]').fill('stripe-card-proof@example.test',{timeout:60000})
  await page.locator('input[name="cardNumber"]').fill(scenario==='success'?'4242424242424242':scenario==='declined'?'4000000000000002':'4000000000003220')
  await page.locator('input[name="cardExpiry"]').fill('1230');await page.locator('input[name="cardCvc"]').fill('123');
  const name=page.locator('input[name="billingName"]');if(await name.count())await name.fill('Alex Chen')
  const zip=page.locator('input[name="billingPostalCode"]');if(await zip.count())await zip.fill('94607')
  await proof(page,scenario+'-stripe');await page.getByRole('button',{name:/Pay \$/}).click()
  if(scenario==='declined'){
   await page.getByText(/Your card was declined/i).first().waitFor({timeout:60000});await proof(page,'declined-stripe-result')
   const session=await api('checkout/sessions/'+sessionId);assert.equal(session.payment_status,'unpaid');const failed=await eventFor('payment_intent.payment_failed',session.payment_intent);await publish(failed);assert.equal((await h.state(t.id)).ledger.receipts.length,1)
   console.log(JSON.stringify({scenario,session:sessionId,intent:session.payment_intent,event:failed.id,ledgerReceiptCount:1}))
   // Expire this explicit test attempt; its provider event releases the reservation.
   const expired=await fetch('https://api.stripe.com/v1/checkout/sessions/'+sessionId+'/expire',{method:'POST',headers:{authorization:'Bearer '+process.env.STRIPE_SECRET_KEY}});assert.ok(expired.ok,'Stripe expiry '+expired.status);await publish(await eventFor('checkout.session.expired',sessionId));await page.goto(h.origin+'/portal/card?tenancy='+t.id);await proof(page,'declined-resident-result');await staffProof('declined-staff-result');continue
  }
  if(scenario==='authentication'){
   const until=Date.now()+60000;let authenticate
   while(Date.now()<until&&!authenticate){for(const frame of page.frames()){const button=frame.getByRole('button',{name:'Complete authentication',exact:true});if(await button.isVisible().catch(()=>false)){authenticate=button;break}}if(!authenticate)await page.waitForTimeout(250)}
   assert.ok(authenticate,'Stripe exposed the required 3DS challenge');await proof(page,'authentication-challenge');await authenticate.click()
  }
  await page.waitForURL(h.origin+'/portal/card**',{timeout:60000})
  const session=await api('checkout/sessions/'+sessionId);assert.equal(session.payment_status,'paid');const completed=await eventFor('checkout.session.completed',sessionId)
  assert.equal((await h.state(t.id)).ledger.receipts.length,scenario==='success'?0:1,'browser return cannot post money')
  await proof(page,scenario+'-awaiting-event');await publish(completed);await h.restart();const replay=await publish(completed);assert.equal(replay.replayed,true)
  await page.reload();await page.getByRole('heading',{name:/Card payment receipt/}).waitFor();await proof(page,scenario+'-resident-receipt');await staffProof(scenario+'-staff-reconciled')
  const intent=await api('payment_intents/'+session.payment_intent),charge=await api('charges/'+intent.latest_charge),ledger=(await h.state(t.id)).ledger
  assert.equal(ledger.receipts.length,scenario==='success'?1:2);if(scenario==='authentication')assert.equal(charge.payment_method_details.card.three_d_secure.result,'authenticated')
  console.log(JSON.stringify({scenario,session:sessionId,intent:intent.id,charge:charge.id,event:completed.id,authentication:charge.payment_method_details.card.three_d_secure?.result??null,ledgerReceiptCount:ledger.receipts.length,replayNoDoublePosting:true}))
 }
 await staffCtx.close();await ctx.close()
}})}finally{await browser.close()}
