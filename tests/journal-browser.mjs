import assert from 'node:assert/strict'
import {mkdir} from 'node:fs/promises'
import {resolve,join} from 'node:path'
import {chromium} from '@playwright/test'
import {journey} from './journal.mjs'
const out=resolve(process.env.JOURNAL_SCREENSHOTS??'.rer/journal-screens');await mkdir(out,{recursive:true})
const browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']})
try{await journey({assets:true,inspect:async({h,a,day})=>{
 const context=await browser.newContext();await context.addCookies(h.cookie.split('; ').map(pair=>{const i=pair.indexOf('=');return{name:pair.slice(0,i),value:pair.slice(i+1),url:h.origin}}));const page=await context.newPage()
 await page.goto(h.origin+'/app?tab=journal')
 await page.getByRole('heading',{name:'Trial balance',exact:true}).waitFor()
 assert.ok(await page.getByText(/reverses entry/).count());await page.getByRole('heading',{name:'Record a balanced entry',exact:true}).waitFor()
 const form=page.locator('form:has(input[name=command][value="journal.post"])')
 await form.getByLabel('Property',{exact:true}).selectOption(a.p.id);await form.getByLabel('Beneficiary owner',{exact:true}).selectOption(a.o.id)
 await form.getByLabel('Entry kind',{exact:true}).selectOption('contribution');await form.getByLabel('Posting date',{exact:true}).fill(day);await form.getByLabel('Source reference',{exact:true}).fill('synthetic-terrace-9 native contribution')
 await form.locator('select[name=account0]').selectOption('cash');await form.locator('input[name=debit0]').fill('12.34');await form.locator('select[name=account1]').selectOption('contribution');await form.locator('input[name=credit1]').fill('12.34')
 for(const [width,height]of [[1440,900],[390,844]]){await page.setViewportSize({width,height});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'ledger fits '+width);await page.screenshot({path:join(out,'entry-review-'+width+'.png'),fullPage:true});await form.screenshot({path:join(out,'entry-form-'+width+'.png')});await page.getByRole('heading',{name:'Trial balance',exact:true}).locator('..').screenshot({path:join(out,'trial-balance-'+width+'.png')});if(width===390){const scroll=page.getByRole('heading',{name:'Trial balance',exact:true}).locator('..').locator('.scroll');await scroll.hover();await page.mouse.wheel(800,0);await page.waitForFunction(()=>document.querySelector('.journal-table').parentElement.scrollLeft>0);await scroll.screenshot({path:join(out,'trial-numbers-390.png')})}}
 await form.getByRole('button',{name:'Record balanced entry',exact:true}).click();await page.getByText('Balanced USD entry recorded from your external source. No money moved.',{exact:true}).waitFor()
 for(const [width,height]of [[1440,900],[390,844]]){await page.setViewportSize({width,height});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:join(out,'entry-recorded-'+width+'.png'),fullPage:true})}
 const filters=page.locator('form').filter({has:page.getByRole('button',{name:'View subledger',exact:true})});await filters.getByLabel('Property',{exact:true}).selectOption(a.p.id);await filters.getByRole('button',{name:'View subledger',exact:true}).click();await page.waitForURL(u=>u.searchParams.get('propertyId')===a.p.id)
 assert.equal(await page.getByText(/Property Birch House/).count(),0)
 await context.close()
}})}finally{await browser.close()}
