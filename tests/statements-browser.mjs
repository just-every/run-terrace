import assert from 'node:assert/strict'
import {mkdir} from 'node:fs/promises'
import {resolve,join} from 'node:path'
import {chromium} from '@playwright/test'
import {journey} from './statements.mjs'
const out=resolve(process.env.RECONCILE_SCREENSHOTS??'.rer/reconcile-screens');await mkdir(out,{recursive:true})
const browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']})
try{await journey({assets:true,inspect:async({h,seller})=>{
 const context=await browser.newContext();await context.addCookies(h.cookie.split('; ').map(pair=>{const i=pair.indexOf('=');return{name:pair.slice(0,i),value:pair.slice(i+1),url:h.origin}}));const page=await context.newPage()
 try{for(const[width,height]of [[1440,900],[390,844]]){
  await page.setViewportSize({width,height});const response=await page.goto(h.origin+'/app?tab=properties');assert.equal(response.status(),200,await page.locator('body').innerText());const form=page.locator('form[action="/api/owner-statement"]');assert.equal(await form.count(),1,await page.locator('body').innerText());await form.locator('select[name=ownerId]').selectOption(seller.id);await form.getByLabel('Period start').fill('2026-09-01');await form.getByLabel('Period end').fill('2026-09-30');assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.keyboard.press('Tab');await page.getByRole('link',{name:'Manage people'}).focus();assert.equal(await page.locator('#people-tooltip').evaluate(el=>getComputedStyle(el).visibility),'visible');await page.screenshot({path:join(out,'cash-draft-download-'+width+'.png'),fullPage:true})
  const download=page.waitForEvent('download');await form.getByRole('button',{name:'Download allocation statement'}).click();const stream=await(await download).createReadStream();let csv='';for await(const chunk of stream)csv+=chunk.toString();assert.match(csv,/1450.00/);assert.match(csv,/Owner cash draft/)
 }}finally{await context.close()}
}})}finally{await browser.close()}
