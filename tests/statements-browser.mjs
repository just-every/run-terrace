import assert from 'node:assert/strict'
import {mkdir} from 'node:fs/promises'
import {resolve,join} from 'node:path'
import {chromium} from '@playwright/test'
import {journey} from './statements.mjs'
const out=resolve(process.env.RECONCILE_SCREENSHOTS??'.rer/reconcile-screens');await mkdir(out,{recursive:true})
const browser=await chromium.launch({headless:true,...(process.env.TERRACE_CHROMIUM?{executablePath:process.env.TERRACE_CHROMIUM}:{}),args:['--no-sandbox','--use-mock-keychain','--password-store=basic']})
try{await journey({assets:true,inspect:async({h,seller,sellerCookie,portalQuery,oldFile})=>{
 const context=await browser.newContext();await context.addCookies(h.cookie.split('; ').map(pair=>{const i=pair.indexOf('=');return{name:pair.slice(0,i),value:pair.slice(i+1),url:h.origin}}));const page=await context.newPage()
 try{for(const[width,height]of [[1440,900],[390,844]]){
  await page.setViewportSize({width,height});const response=await page.goto(h.origin+'/app?tab=properties');assert.equal(response.status(),200,await page.locator('body').innerText());const form=page.locator('form[action="/api/owner-statement"]');assert.equal(await form.count(),1,await page.locator('body').innerText());await form.locator('select[name=ownerId]').selectOption(seller.id);await form.getByLabel('Period start').fill('2026-09-01');await form.getByLabel('Period end').fill('2026-09-30');assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.keyboard.press('Tab');await page.getByRole('link',{name:'Manage people'}).focus();assert.equal(await page.locator('#people-tooltip').evaluate(el=>getComputedStyle(el).visibility),'visible');await page.screenshot({path:join(out,'cash-draft-download-'+width+'.png'),fullPage:true})
  const download=page.waitForEvent('download');await form.getByRole('button',{name:'Download allocation statement'}).click();const stream=await(await download).createReadStream();let csv='';for await(const chunk of stream)csv+=chunk.toString();assert.match(csv,/1450.00/);assert.match(csv,/Owner cash draft/)
 }
  await context.clearCookies();await context.addCookies(sellerCookie.split('; ').map(pair=>{const i=pair.indexOf('=');return{name:pair.slice(0,i),value:pair.slice(i+1),url:h.origin}}))
  for(const[width,height]of [[1440,900],[390,844]]){
   await page.setViewportSize({width,height});const response=await page.goto(h.origin+portalQuery);assert.equal(response.status(),200)
   assert.equal(await page.getByRole('heading',{name:'Approved expenses',exact:true}).count(),1);assert.equal(await page.getByRole('heading',{name:'Fees and reserve requirements',exact:true}).count(),1);assert.match(await page.locator('body').innerText(),/synthetic-terrace-10/);assert.ok(!(await page.locator('body').innerText()).includes('synthetic-terrace-11'))
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth))
   const link=page.getByRole('link',{name:'Download '+oldFile.name,exact:true});await link.focus();await page.screenshot({path:join(out,'owner-invoices-'+width+'.png'),fullPage:true})
   const downloading=page.waitForEvent('download');await link.click();const stream=await(await downloading).createReadStream();let bytes='';for await(const chunk of stream)bytes+=chunk.toString();assert.equal(bytes,'%PDF-1.4\nsynthetic-terrace-10\n%%EOF')
   assert.equal(await page.locator('button:not(:has-text("Sign out"))').count(),0,'the statement uses named links, with no icon-only controls')
  }
 }finally{await context.close()}
}})}finally{await browser.close()}
