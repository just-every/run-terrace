import assert from 'node:assert/strict'
import {mkdir} from 'node:fs/promises'
import {resolve,join} from 'node:path'
import {chromium} from '@playwright/test'
import {journey} from './professional-referrals.mjs'
const out=resolve(process.env.REFERRAL_SCREENSHOTS??'.rer/referral-screens');await mkdir(out,{recursive:true})
const browser=await chromium.launch({headless:true,...(process.env.RER_CHROMIUM_PATH?{executablePath:process.env.RER_CHROMIUM_PATH}:{}),args:['--no-sandbox','--use-mock-keychain','--password-store=basic']})
try{
 await journey({assets:true,inspect:async({h,t})=>{
  const context=await browser.newContext({viewport:{width:1440,height:900}})
  try{
   await context.addCookies(h.cookie.split('; ').map(pair=>{const at=pair.indexOf('=');return{name:pair.slice(0,at),value:pair.slice(at+1),url:h.origin}}))
   const page=await context.newPage();await page.goto(h.origin+'/app?tab=rules')
   const section=page.locator('#professional-referrals')
   assert.ok((await section.innerText()).includes('Open · reviewed record only'))
   const start=section.locator('details').filter({has:page.locator('summary:text-is("Record an external referral")')}).first()
   await start.locator('summary').first().click()
   const exception=start.locator('details').first();await exception.locator('summary').first().click()
   await exception.getByLabel('Related tenancy',{exact:true}).selectOption(t.id)
   await exception.getByLabel('Named professional',{exact:true}).fill('Native counsel referral')
   await exception.getByLabel('External referral reference',{exact:true}).fill('synthetic-terrace-18')
   await exception.getByLabel('Follow-up due date',{exact:true}).fill('2026-10-26')
   await exception.getByRole('button',{name:'Record referral',exact:true}).click()
   const card=section.locator('article').filter({has:page.getByRole('heading',{name:'Native counsel referral · entry',exact:true})})
   await card.waitFor();assert.ok((await card.innerText()).includes('No professional response recorded'))
   const record=card.locator('details').filter({has:page.locator('summary:text-is("Record another original response")')})
   await record.locator('summary').click()
   await record.getByLabel('Response outcome',{exact:true}).selectOption('rejected')
   await record.getByLabel('Response source',{exact:true}).fill('synthetic-terrace-19')
   await record.getByLabel('Response original',{exact:true}).setInputFiles({name:'native-response.txt',mimeType:'text/plain',buffer:Buffer.from('synthetic-terrace-20 native counsel rejects the proposal.')})
   await record.getByRole('button',{name:'Store response evidence',exact:true}).click()
   await card.getByRole('heading',{name:'Response 1 · rejected',exact:true}).waitFor()
   const review=card.locator('details').filter({has:page.locator('summary:text-is("Record reviewed next action")')})
   await review.locator('summary').click()
   await review.getByLabel('Reviewed next action',{exact:true}).fill('Retain the hold and request clarification from counsel')
   await review.getByLabel('Review source',{exact:true}).fill('synthetic-terrace-21')
   await review.getByLabel('Type RECORD ONLY',{exact:true}).fill('RECORD ONLY')
   await review.getByRole('button',{name:'Retain documentary review',exact:true}).click()
   await card.getByText('Retain the hold and request clarification from counsel',{exact:false}).waitFor()
   assert.ok((await card.innerText()).includes('Open · response rejected'))
   const download=await card.getByRole('link',{name:'Download response original',exact:true}).getAttribute('href')
   const original=await h.request(download);assert.equal(await original.text(),'synthetic-terrace-20 native counsel rejects the proposal.')
   const person=page.getByRole('link',{name:'Manage people',exact:true})
   await person.focus();await page.waitForTimeout(30);assert.equal(await person.locator('[role=tooltip]').evaluate(el=>getComputedStyle(el).opacity),'1')
   await page.getByRole('heading',{name:'State & local rules',exact:true}).click();await person.hover();await page.waitForTimeout(400);assert.equal(await person.locator('[role=tooltip]').evaluate(el=>getComputedStyle(el).opacity),'1')
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'referral screen fits at 1440')
   for(const [width,height]of [[1440,900],[390,844]]){
    await page.setViewportSize({width,height});await section.scrollIntoViewIfNeeded()
    await section.screenshot({path:join(out,'professional-referrals-'+width+'.png')})
   }
  }finally{await context.close()}
 }})
 console.log('Professional referral native recording, response, review and download passed at 1440; proof captured at 1440 and 390.')
}finally{await browser.close()}
