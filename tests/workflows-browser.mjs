// OPS-003: the workflows page and its native forms at desktop and phone widths, over the same journey's real Worker and D1 records.
import assert from 'node:assert/strict'
import {mkdir} from 'node:fs/promises'
import {join,resolve} from 'node:path'
import {chromium} from '@playwright/test'
import {journey,scheduledJourney} from './workflows.mjs'
const pictures=resolve(process.env.WORKFLOW_SCREENSHOTS??'.rer/workflow-screens')
await mkdir(pictures,{recursive:true})
const browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']})
let page
async function picture(name,region){
 for(const [width,height]of [[1440,900],[390,844]]){
  await page.setViewportSize({width,height})
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'OPS-003 '+name+' fits '+width)
  if(region)await region.screenshot({path:join(pictures,`${name}-${width}.png`)})
  else await page.screenshot({path:join(pictures,`${name}-${width}.png`),fullPage:true})
 }
 await page.setViewportSize({width:1440,height:900})
}
try {
 await journey({assets:true,inspect:async({h})=>{
  const context=await browser.newContext({viewport:{width:1440,height:900}})
  await context.addCookies(h.cookie.split('; ').map(pair=>{const i=pair.indexOf('=');return {name:pair.slice(0,i),value:pair.slice(i+1),url:h.origin}}))
  page=await context.newPage()
  await page.goto(h.origin+'/app?tab=properties');await page.getByRole('link',{name:'Open workflows'}).click()
  await page.getByRole('heading',{name:'Needs a person',exact:true}).waitFor()
  for(const shown of ['paused','escalated','closed','cancelled','completed'])assert.ok(await page.locator('.pill',{hasText:shown}).first().isVisible(),shown+' runs are listed')
  await picture('workflows')
  const card=page.locator('article').filter({has:page.getByRole('heading',{name:/Prospect enquiry/})})
  await card.getByText('Record a contact attempt',{exact:true}).click()
  await card.locator('select[name=channel]').selectOption('phone')
  await card.locator('select[name=outcome]').first().selectOption('no_answer')
  await card.getByLabel('External reference (message id, call note, letter)',{exact:true}).fill('call-note-synthetic-terrace-8')
  await picture('attempt-form')
  await card.getByRole('button',{name:'Record attempt',exact:true}).click()
  await page.getByText('Attempt 2 of 2 recorded').waitFor()
  const after=page.locator('article').filter({has:page.getByRole('heading',{name:/Prospect enquiry/})})
  await after.locator('p.notice').filter({hasText:/^Escalated to/}).waitFor()
  await picture('escalated')
  const paused=page.locator('article').filter({has:page.getByRole('heading',{name:/Delinquency/})})
  await paused.getByText('Review and resume',{exact:true}).click()
  await paused.getByLabel('What you reviewed',{exact:true}).fill('Checked the ledger')
  await paused.getByRole('button',{name:'Resume',exact:true}).click()
  await page.getByText('Still paused').waitFor()
  await picture('still-paused')
 }})
 await scheduledJourney({assets:true,inspect:async({h,pausedId,renewalPausedId})=>{
  const context=await browser.newContext({viewport:{width:1440,height:900}})
  await context.addCookies(h.cookie.split('; ').map(pair=>{const i=pair.indexOf('=');return {name:pair.slice(0,i),value:pair.slice(i+1),url:h.origin}}))
  page=await context.newPage()
  await page.goto(h.origin+'/app?tab=workflows')
  await page.getByText('Sweep history',{exact:true}).click()
  await page.getByText('Needs a new configurer: needs a configurer:',{exact:false}).first().waitFor()
  await picture('scheduler-history')
  await picture('scheduler-detail',page.getByRole('heading',{name:'Sweep',exact:true}).locator('..'))
  await page.getByRole('button',{name:'Run now',exact:true}).click()
  await page.getByText(/Sweep: 0 started, 0 escalated, 0 maintenance orders/).first().waitFor()
  await picture('run-now')
  for(const id of [pausedId,renewalPausedId]){
   const card=page.locator('#workflow-'+id)
   await card.getByText('History',{exact:true}).click()
   assert.ok(await card.getByText('uncertain',{exact:false}).count())
   await picture(id===pausedId?'prospect-provider-detail':'renewal-provider-detail',card)
  }
  await picture('provider-outcomes')
  await context.close()
 }})
} finally {await browser.close()}
