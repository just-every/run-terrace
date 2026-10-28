import assert from 'node:assert/strict'
import {mkdir} from 'node:fs/promises'
import {join,resolve} from 'node:path'
import {chromium} from '@playwright/test'
import {journey} from './card-payments.mjs'
const out=resolve(process.env.CARD_SCREENSHOTS??'.rer/card-native-screens');await mkdir(out,{recursive:true})
const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{}),args:['--no-sandbox','--use-mock-keychain','--password-store=basic']})
try{await journey({assets:true,bufferedTransport:process.argv.includes('--buffered-http'),inspect:async({phase,h,t,resident,pay,paymentId,sessionId})=>{
 const ctx=await browser.newContext(),cookies=value=>value.split('; ').map(p=>{const i=p.indexOf('=');return{name:p.slice(0,i),value:p.slice(i+1),url:h.origin}});await ctx.addCookies(cookies(resident??h.cookie));const page=await ctx.newPage()
 const proof=async name=>{for(const [width,height]of [[1440,900],[390,844]]){await page.setViewportSize({width,height});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),name+' fits '+width);await page.screenshot({path:join(out,name+'-'+width+'.png'),fullPage:true})}}
 try{
  if(phase.startsWith('recovery-')){
   await ctx.clearCookies();await ctx.addCookies(cookies(h.cookie));await page.setViewportSize({width:1440,height:900})
   await page.goto(h.origin+'/app?tab=ledger&tenancy='+t.id)
   const worklist=page.getByRole('region',{name:'Payment recovery',exact:true}),item=worklist.locator(`[data-recovery="${paymentId}"]`)
   await item.waitFor();assert.match(await item.innerText(),new RegExp(paymentId))
   const labels={'recovery-unknown':'unknown','recovery-conflicting':'conflicting','recovery-awaiting':'awaiting event','recovery-resolved':'resolved','recovery-restored':'Restored evidence only'}
   assert.ok((await item.innerText()).includes(labels[phase]))
   if(phase==='recovery-awaiting'){
    await item.getByText('Inspect original Stripe outcome',{exact:true}).click()
    await item.getByLabel('Original Stripe session id',{exact:true}).fill(sessionId)
    const response=page.waitForResponse(r=>r.request().method()==='POST'&&new URL(r.url()).pathname==='/app/command')
    await item.getByRole('button',{name:'Look up original outcome',exact:true}).click();assert.equal((await response).status(),303)
    await page.getByRole('status').filter({hasText:'Session found.'}).waitFor();await item.getByText('Assign recovery next action',{exact:true}).click()
    await item.getByLabel('Recovery next action',{exact:true}).selectOption('obtain_event')
    await item.getByRole('button',{name:'Take responsibility',exact:true}).click();await page.getByRole('status').filter({hasText:'Recovery responsibility and next action saved.'}).waitFor()
    assert.ok((await item.innerText()).includes('Obtain canonical Stripe event'))
   }
   if(phase==='recovery-restored')assert.equal(await item.getByRole('button').count(),0)
   await proof(phase)
  }else if(phase==='review'){
   await page.goto(h.origin+'/portal/lease?tenancy='+t.id);await page.getByRole('link',{name:'Pay by card',exact:true}).click();await page.getByLabel('Payment amount USD',{exact:true}).fill(pay.amount);await page.getByRole('checkbox').check();pay.requestKey=await page.locator('input[name="requestKey"]').inputValue();await proof('resident-card-review')
   await page.route('https://checkout.stripe.com/**',route=>route.abort());const response=page.waitForResponse(r=>r.request().method()==='POST'&&new URL(r.url()).pathname==='/portal/card');await page.getByRole('button',{name:'Continue to Stripe',exact:true}).click({noWaitAfter:true});assert.equal((await response).status(),303);await page.goto(h.origin+'/portal/card?tenancy='+t.id);await proof('resident-card-pending')
  }else if(phase==='uncertain'){
   await ctx.clearCookies();await ctx.addCookies(cookies(h.cookie));await page.route('https://checkout.stripe.com/**',route=>route.abort());await page.goto(h.origin+'/app?tab=ledger&tenancy='+t.id);await page.getByText('Resume uncertain Checkout request',{exact:true}).click();const f=page.locator('details').filter({has:page.getByText('Resume uncertain Checkout request',{exact:true})}).locator('form').first();await f.getByRole('checkbox').check();await proof('staff-uncertain-request-review');const response=page.waitForResponse(r=>r.request().method()==='POST'&&new URL(r.url()).pathname==='/app/command');await f.getByRole('button',{name:'Continue to Stripe',exact:true}).click({noWaitAfter:true});assert.equal((await response).status(),303);await page.goto(h.origin+'/app?tab=ledger&tenancy='+t.id);await proof('staff-uncertain-request-resumed')
  }else{
   await page.goto(h.origin+'/portal/card?tenancy='+t.id+'&payment='+paymentId);await page.getByRole('heading',{name:/Card payment receipt/}).waitFor();await proof('resident-card-receipt');await ctx.clearCookies();await ctx.addCookies(cookies(h.cookie));await page.goto(h.origin+'/app?tab=ledger&tenancy='+t.id);await page.getByRole('heading',{name:'Online card payments',exact:true}).waitFor();const people=page.getByRole('link',{name:'Manage people',exact:true});await people.focus();assert.equal(await page.locator('#people-tooltip').evaluate(e=>getComputedStyle(e).visibility),'visible');await proof('staff-card-reconciled')
  }
 }finally{await ctx.close()}
}})}finally{await browser.close()}
