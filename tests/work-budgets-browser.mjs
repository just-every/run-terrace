import assert from 'node:assert/strict'
import {mkdir} from 'node:fs/promises'
import {resolve,join} from 'node:path'
import {chromium} from '@playwright/test'
import {journey} from './work-budgets.mjs'
const out=resolve(process.env.BUDGET_SCREENSHOTS||'.rer/budget-screens');await mkdir(out,{recursive:true})
const browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']})
try{await journey({assets:true,inspect:async({h,t,asset,property})=>{
 const context=await browser.newContext();await context.addCookies(h.cookie.split('; ').map(pair=>{const i=pair.indexOf('=');return{name:pair.slice(0,i),value:pair.slice(i+1),url:h.origin}}));const page=await context.newPage()
 for(const [width,height]of [[1440,900],[390,844]]){
  await page.setViewportSize({width,height});await page.goto(h.origin+'/app?tab=work&tenancy='+t.id)
  const section=page.getByRole('heading',{name:'Operating and capital budgets',exact:true}).locator('..')
  await section.waitFor();assert.match(await section.innerText(),/capital.*\$200\.00.*\$190\.00/s);assert.match(await section.innerText(),/operating.*\$100\.00.*\$115\.00/s)
  await section.scrollIntoViewIfNeeded();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'work page fits '+width)
  await page.screenshot({path:join(out,'budgets-'+width+'.png'),fullPage:true});await section.screenshot({path:join(out,'budget-section-'+width+'.png')})
  await section.getByText('Record an approved category budget',{exact:true}).click()
  const form=section.locator('form').first();await form.getByLabel('Budget year',{exact:true}).fill('2028');await form.getByLabel('Budget category',{exact:true}).selectOption('capital');await form.getByLabel('Budget scope',{exact:true}).selectOption(asset.id);await form.getByLabel('Approved budget (USD)',{exact:true}).fill('123.45');await form.getByLabel('Approved budget source',{exact:true}).fill('synthetic-terrace-12 browser '+width)
  await form.screenshot({path:join(out,'budget-form-'+width+'.png')})
  // Submit once, then inspect the same form at the phone width.
  if(width===1440){await form.getByRole('button',{name:'Save approved budget',exact:true}).click();await page.getByText('Source: synthetic-terrace-12 browser 1440',{exact:false}).waitFor()}
  const person=page.getByRole('link',{name:'Manage people',exact:true}),tip=page.getByRole('tooltip',{name:'Manage people',exact:true})
  await person.hover();await page.waitForTimeout(350);await tip.waitFor({state:'visible'});await page.screenshot({path:join(out,'tooltip-hover-'+width+'.png')});await page.mouse.move(0,0);await person.focus();await tip.waitFor({state:'visible'});await page.screenshot({path:join(out,'tooltip-focus-'+width+'.png')})
  await page.goto(h.origin+'/app?tab=bills');await page.getByText('Capture an invoice',{exact:true}).click();await page.locator('form:has(input[name=command][value="bill.create"])').getByLabel('Unlinked cost category for Budget house',{exact:true}).selectOption('capital');assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'bill page fits '+width);await page.screenshot({path:join(out,'bills-'+width+'.png'),fullPage:true})
 }
 await context.close()
}})}finally{await browser.close()}
