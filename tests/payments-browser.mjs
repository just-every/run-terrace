import assert from 'node:assert/strict'
import {mkdir} from 'node:fs/promises'
import {resolve,join} from 'node:path'
import {chromium} from '@playwright/test'
import {journey} from './payments.mjs'
const out=resolve(process.env.PAYMENT_SCREENSHOTS??'.rer/payment-screens');await mkdir(out,{recursive:true})
const browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']})
try{await journey({assets:true,inspect:async({phase,h,t,day,pending})=>{
 const context=await browser.newContext();await context.addCookies(h.cookie.split('; ').map(pair=>{const i=pair.indexOf('=');return{name:pair.slice(0,i),value:pair.slice(i+1),url:h.origin}}));const page=await context.newPage()
 const proof=async name=>{for(const[width,height]of [[1440,900],[390,844]]){await page.setViewportSize({width,height});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no page overflow at '+width);const people=page.getByRole('link',{name:'Manage people',exact:true});await people.focus();await page.keyboard.press('Tab');await page.keyboard.press('Shift+Tab');assert.ok(await people.evaluate(e=>e===document.activeElement),'keyboard returns to account control');assert.equal(await page.locator('#people-tooltip').evaluate(e=>getComputedStyle(e).visibility),'visible','tooltip is immediate on keyboard focus');await page.locator('h1').click();await people.evaluate(e=>e.blur());await page.mouse.move(0,0);await people.hover();await page.waitForTimeout(100);assert.equal(await page.locator('#people-tooltip').evaluate(e=>getComputedStyle(e).visibility),'hidden','hover tooltip waits before appearing');await page.waitForTimeout(250);assert.equal(await page.locator('#people-tooltip').evaluate(e=>getComputedStyle(e).visibility),'visible','tooltip appears after hover delay');await page.locator('h1').click();await page.screenshot({path:join(out,name+'-'+width+'.png'),fullPage:true})}}
 try{
  await page.goto(h.origin+'/app?tab=ledger&tenancy='+t.id);await page.getByRole('heading',{name:'Split payments and pending funds',exact:true}).waitFor()
  if(phase==='pending'){
   await proof('pending-allocation')
   const policy=page.locator('form:has(input[name=command][value="payment.policy"])');await policy.getByLabel('Approved lease policy reference',{exact:true}).fill('synthetic-terrace-52 native lease policy');await policy.getByRole('button',{name:'Record lease payment policy',exact:true}).click();await page.getByText('Lease payment policy recorded. Every payment also requires active reviewed property rules.',{exact:true}).waitFor();await proof('native-policy-stages')
   const form=page.locator('form:has(input[name=command][value="payment.settle"])');await form.getByLabel('Outcome date',{exact:true}).fill(day);await form.getByLabel('External outcome reference',{exact:true}).fill('synthetic-terrace-50 native settlement');await proof('review-settlement')
   await form.getByRole('button',{name:'Record settlement',exact:true}).click();await page.getByText('Settlement recorded once; reserved allocations are now receipts.',{exact:true}).waitFor();await proof('settled-credit');return{settled:true}
  }
  const form=page.locator('form:has(input[name=command][value="payment.record"])');await form.getByLabel('Payment amount USD',{exact:true}).fill('50.00');await form.getByLabel('Initiated or received date',{exact:true}).fill(day);await form.getByLabel('Unique external payment reference',{exact:true}).fill('synthetic-terrace-51 refused partial');await form.getByRole('button',{name:'Record external payment',exact:true}).click();await page.getByText('The reviewed delinquency stage blocks a partial payment.',{exact:true}).waitFor();await proof('partial-blocked')
 }finally{await context.close()}
}})}finally{await browser.close()}
