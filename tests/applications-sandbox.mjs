import assert from 'node:assert/strict'
import {execFileSync} from 'node:child_process'
import {writeFile} from 'node:fs/promises'
import {randomUUID} from 'node:crypto'
import {chromium} from '@playwright/test'
import {installation} from './api/harness.mjs'
import {applicationSetup,activateApplicationPack,applicantCookie,applicantPost,ownData,applicantEmail} from './applications.mjs'

const key=process.env.STRIPE_SECRET_KEY
assert.ok(key,'Run with the named held Stripe test binding through the fleet injector.')
assert.ok(!/^(sk|rk)_live_/i.test(key),'Sandbox requires test mode.')
const provider=async(path,body)=>{
 const response=await fetch('https://api.stripe.com/v1/'+path,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+key,'Stripe-Version':'2026-09-30.endive',...(body?{'content-type':'application/x-www-form-urlencoded'}:{})},...(body?{body}:{}),signal:AbortSignal.timeout(30000)})
 const data=await response.json()
 assert.equal(response.status,200,'Stripe sandbox HTTP '+response.status+' '+(data.error?.code??''))
 return data
}
const h=await installation({stripeKey:key,stripeRequest:async request=>{
 const response=await fetch(request.url,{method:request.method,headers:request.headers,...(request.method==='POST'?{body:await request.text()}:{}),signal:AbortSignal.timeout(30000)})
 const body=await response.text()
 if(!response.ok){let error;try{error=JSON.parse(body).error}catch{};console.error(JSON.stringify({status:response.status,type:error?.type,code:error?.code,param:error?.param,message:String(error?.message??'').replaceAll(key,'REDACTED').replace(/https?:\/\/[^\s]+/g,'URL')}))}
 return new Response(body,{status:response.status,headers:{'content-type':'application/json'}})
}})
try{
 const {property,open}=await applicationSetup(h);await activateApplicationPack(h,property)
 const app=await h.command('application.open',open),a=await applicantCookie(h,app,app.adults[0],1)
 const started=await applicantPost(h,a.cookie,{requestKey:randomUUID(),consent:'yes',consentVersion:'application-fee-1'},200,'/apply/api/fee')
 assert.match(started.checkoutUrl,/^https:\/\/checkout\.stripe\.com\//)
 const pending=await ownData(h,a.cookie),fee=pending.fees.find(f=>f.id===started.paymentId)
 const session=await provider('checkout/sessions/'+fee.checkout_id)
 assert.equal(session.livemode,false);assert.equal(session.amount_total,4500);assert.equal(session.currency,'usd')
 assert.equal(session.metadata.terrace_application_fee_id,fee.id)
 assert.equal(session.payment_status,'unpaid')
 const expired=await provider('checkout/sessions/'+fee.checkout_id+'/expire',new URLSearchParams())
 assert.equal(expired.status,'expired')
 const events=await provider('events?type=checkout.session.expired&limit=20')
 const event=events.data.find(e=>e.data.object.id===fee.checkout_id)
 assert.ok(event,'Stripe supplies a canonical expiry event for this exact hosted session')
 const verified=await applicantPost(h,a.cookie,{action:'reconcile',eventId:event.id},200,'/apply/api/fee')
 assert.equal(verified.state,'expired')
 assert.equal((await applicantPost(h,a.cookie,{action:'reconcile',eventId:event.id},200,'/apply/api/fee')).replayed,true)
 const next=await applicantPost(h,a.cookie,{requestKey:randomUUID(),consent:'yes',consentVersion:'application-fee-1'},200,'/apply/api/fee')
 const paidFee=(await ownData(h,a.cookie)).fees.find(f=>f.id===next.paymentId)
 await hostedCheckout(next.checkoutUrl,h,a.cookie)
 const paidSession=await provider('checkout/sessions/'+paidFee.checkout_id)
 assert.equal(paidSession.payment_status,'paid')
 assert.equal((await ownData(h,a.cookie)).fees.find(f=>f.id===next.paymentId).state,'checkout','provider return cannot post fee outcome')
 let completed
 for(let attempt=0;attempt<5&&!completed;attempt++){
  completed=(await provider('events?type=checkout.session.completed&limit=20')).data.find(e=>e.data.object.id===paidFee.checkout_id)
  if(!completed)await new Promise(resolve=>setTimeout(resolve,1000))
 }
 assert.ok(completed,'Stripe supplies this hosted completion event')
 const captured=await applicantPost(h,a.cookie,{action:'reconcile',eventId:completed.id},200,'/apply/api/fee')
 assert.equal(captured.state,'paid')
 const replay=await h.command('application.fee.reconcile',{applicationId:app.id,eventId:completed.id});assert.equal(replay.replayed,true)
 const recorded=(await ownData(h,a.cookie)).fees.find(f=>f.id===next.paymentId)
 assert.ok(recorded.intent_id&&recorded.charge_id)
 const receipt={head:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),test:'held Stripe test hosted application fee creation and canonical expiry',applicationId:app.id,feeId:fee.id,checkoutId:fee.checkout_id,eventId:event.id,livemode:false,amountCents:4500,currency:'usd',state:'paid',paidCheckoutId:paidFee.checkout_id,paidEventId:completed.id,intentId:recorded.intent_id,chargeId:recorded.charge_id,replayed:true,boundary:'Hosted test fee captured and canonical expiry verified. No live charge or bank settlement is claimed.'}
 if(process.env.APPLICATION_SANDBOX_RECEIPT)await writeFile(process.env.APPLICATION_SANDBOX_RECEIPT,JSON.stringify(receipt,null,2)+'\n',{mode:0o600})
 console.log(JSON.stringify(receipt))
}finally{await h.close()}

async function hostedCheckout(url,h,cookie){
 const proxy=process.env.HTTPS_PROXY||process.env.HTTP_PROXY
 const browser=await chromium.launch({headless:true,executablePath:process.env.RER_CHROMIUM_PATH??'/usr/bin/chromium',args:['--no-sandbox','--use-mock-keychain','--password-store=basic'],...(proxy?{proxy:{server:proxy,bypass:'localhost,127.0.0.1'}}:{})})
 let page
 try{
  const context=await browser.newContext({viewport:{width:1440,height:1000}})
  await context.addCookies(cookie.split('; ').map(pair=>{const i=pair.indexOf('=');return{name:pair.slice(0,i),value:pair.slice(i+1),url:h.origin}}))
  page=await context.newPage();page.setDefaultTimeout(30000)
  await page.goto(url,{waitUntil:'domcontentloaded',timeout:60000})
  await page.locator('input[name="email"]').fill(applicantEmail(1))
  await page.locator('input[name="cardNumber"]').fill('4242424242424242')
  await page.locator('input[name="cardExpiry"]').fill('1240')
  await page.locator('input[name="cardCvc"]').fill('123')
  const name=page.locator('input[name="billingName"]');if(await name.count())await name.fill('Synthetic Terrace Applicant')
  const country=page.getByLabel('Country or region',{exact:true});if(await country.count())await country.selectOption('US')
  await page.locator('input[name="billingPostalCode"]').fill('94607')
  const save=page.getByLabel(/Save my information/);if(await save.count())await save.uncheck()
  await page.locator('button[type=submit][data-testid=hosted-payment-submit-button]').click({noWaitAfter:true})
  await page.waitForURL(h.origin+'/apply**',{timeout:60000,waitUntil:'domcontentloaded'})
  await context.close()
 }catch(error){await page?.screenshot({path:'/tmp/terrace-stripe-failure.png',fullPage:true}).catch(()=>{});if(page)console.error('Hosted validation: '+JSON.stringify(await page.locator('[role=alert],.FieldError').allTextContents()));throw new Error(String(error).replaceAll(key,'REDACTED').replace(/https?:\/\/[^\s)]+/g,'URL'))}
 finally{await browser.close()}
}
