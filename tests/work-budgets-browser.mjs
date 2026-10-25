import assert from 'node:assert/strict'
import {mkdir} from 'node:fs/promises'
import {resolve,join} from 'node:path'
import {chromium} from '@playwright/test'
import {journey} from './work-budgets.mjs'
const out=resolve(process.env.BUDGET_SCREENSHOTS||'.rer/budget-screens');await mkdir(out,{recursive:true})
const browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']})
try{await journey({assets:true,inspect:async({h,t,asset,property,future,capture,approveBill,lot,resident,owner})=>{
 const context=await browser.newContext();await context.addCookies(h.cookie.split('; ').map(pair=>{const i=pair.indexOf('=');return{name:pair.slice(0,i),value:pair.slice(i+1),url:h.origin}}));const page=await context.newPage()
 for(const [width,height]of [[1440,900],[390,844]]){
  await page.setViewportSize({width,height});await page.goto(h.origin+'/app?tab=work&tenancy='+t.id)
  await page.getByRole('heading',{name:'Maintenance stock',exact:true}).waitFor();assert.match(await page.getByRole('heading',{name:'Maintenance stock',exact:true}).locator('..').innerText(),/Furnace filter.*2 parts remaining.*\$13\.34/s)
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
  const purchased=await capture(30+width,'20',null);await approveBill(purchased)
  await page.goto(h.origin+'/app?tab=work&tenancy='+t.id)
  const stock=page.getByRole('heading',{name:'Maintenance stock',exact:true}).locator('..')
  await stock.getByText('Receive purchased parts',{exact:true}).click()
  const receipt=stock.locator('form:has(input[name="billId"][value="'+purchased.id+'"])')
  await receipt.getByLabel('Part name',{exact:true}).fill('Browser filter '+width);await receipt.getByLabel('Recorded date',{exact:true}).fill('2026-06-08');await receipt.getByLabel('Whole parts',{exact:true}).fill('1');await receipt.getByLabel('Source reference',{exact:true}).fill('synthetic-terrace-22 browser receipt '+width)
  await receipt.screenshot({path:join(out,'stock-receipt-'+width+'.png')});await receipt.getByRole('button',{name:'Receive stock',exact:true}).click();await page.getByText('Browser filter '+width,{exact:true}).waitFor()
  const part=page.getByRole('heading',{name:'Furnace filter',exact:true}).locator('..')
  await part.getByText('Use on approved repair',{exact:true}).click();const use=part.locator('form');await use.getByLabel('Approved repair',{exact:true}).selectOption({label:'Next year operating'});await use.getByLabel('Recorded date',{exact:true}).fill('2026-06-04');await use.getByLabel('Whole parts',{exact:true}).fill('1');await use.getByLabel('Source reference',{exact:true}).fill('synthetic-terrace-23 reviewed use')
  await stock.screenshot({path:join(out,'stock-use-'+width+'.png')});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'stock controls fit '+width)
  await page.goto(h.origin+'/app?tab=work&tenancy='+t.id)
  const chargebacks=page.getByRole('heading',{name:'Repair chargebacks',exact:true}).locator('..')
  const allocation=chargebacks.locator('details').first();await allocation.getByText('Propose cost allocation',{exact:true}).click()
  const allocationForm=allocation.locator('form');await allocationForm.getByLabel('Named recipient or insurance reference',{exact:true}).fill(resident.id);await allocationForm.getByLabel('Allocation amount (USD)',{exact:true}).fill('1');await allocationForm.getByLabel('Allocation date',{exact:true}).fill('2026-06-11');await allocationForm.getByLabel('Exact-content authorization evidence',{exact:true}).fill('synthetic-terrace-56 browser authority '+width);await allocationForm.getByRole('checkbox').check()
  await allocationForm.screenshot({path:join(out,'chargeback-proposal-'+width+'.png')});await allocationForm.getByRole('button',{name:'Propose chargeback',exact:true}).click()
  await page.getByText('synthetic-terrace-56 browser authority '+width,{exact:true}).waitFor()
  await chargebacks.screenshot({path:join(out,'chargeback-pending-'+width+'.png')});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'chargebacks fit '+width)
  const row=(await h.state(t.id)).work.chargebacks.proposals.find(p=>p.terms.authority==='synthetic-terrace-56 browser authority '+width)
  await context.clearCookies();await context.addCookies(manager.split('; ').map(pair=>{const i=pair.indexOf('=');return{name:pair.slice(0,i),value:pair.slice(i+1),url:h.origin}}));await page.reload()
  const review=page.locator('article').filter({has:page.getByText('synthetic-terrace-56 browser authority '+width,{exact:true})});await review.getByRole('button',{name:'Approve exact allocation',exact:true}).click();await page.getByText('Approved allocation',{exact:true}).first().waitFor();await chargebacks.screenshot({path:join(out,'chargeback-approved-'+width+'.png')})
  assert.ok((await h.state(t.id)).work.chargebacks.proposals.find(p=>p.id===row.id).approved_at)
  await context.clearCookies();await context.addCookies(h.cookie.split('; ').map(pair=>{const i=pair.indexOf('=');return{name:pair.slice(0,i),value:pair.slice(i+1),url:h.origin}}))
  await page.goto(h.origin+'/app?tab=bills');await page.getByText('Capture an invoice',{exact:true}).click();await page.locator('form:has(input[name=command][value="bill.create"])').getByLabel('Unlinked cost category for Budget house',{exact:true}).selectOption('capital');assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'bill page fits '+width);await page.screenshot({path:join(out,'bills-'+width+'.png'),fullPage:true})
 }
 await context.close()
}})}finally{await browser.close()}
