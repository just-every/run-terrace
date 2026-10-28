import assert from 'node:assert/strict'
import {mkdir} from 'node:fs/promises'
import {resolve,join} from 'node:path'
import {chromium} from '@playwright/test'
import {journey} from './arrears.mjs'
const out=resolve(process.env.ARREARS_SCREENSHOTS??'.rer/arrears-screens');await mkdir(out,{recursive:true})
const browser=await chromium.launch({headless:true,...(process.env.RER_CHROMIUM_PATH?{executablePath:process.env.RER_CHROMIUM_PATH}:{}),args:['--no-sandbox','--use-mock-keychain','--password-store=basic']})
try{
 await journey({assets:true,inspect:async({h,cases,goodDraft,staff})=>{
  const context=await browser.newContext({viewport:{width:1440,height:900}})
  try{
   await context.addCookies(h.cookie.split('; ').map(pair=>{const at=pair.indexOf('=');return{name:pair.slice(0,at),value:pair.slice(at+1),url:h.origin}}))
   const page=await context.newPage(),url=t=>h.origin+'/app?tab=delinquency&tenancy='+t.id
   async function capture(name){
    const control=page.getByRole('link',{name:'Manage people',exact:true})
    await control.focus();await page.waitForTimeout(30);assert.equal(await control.locator('[role=tooltip]').evaluate(el=>getComputedStyle(el).opacity),'1')
    await page.getByRole('heading',{name:'Delinquency',exact:true}).click();await control.hover();await page.waitForTimeout(400);assert.equal(await control.locator('[role=tooltip]').evaluate(el=>getComputedStyle(el).opacity),'1')
    for(const [width,height]of [[1440,900],[390,844]]){await page.setViewportSize({width,height});await page.screenshot({path:join(out,name+'-'+width+'.png'),fullPage:true})}
    await page.setViewportSize({width:1440,height:900})
   }
   await page.goto(url(cases[0].t));await page.getByRole('heading',{name:'Collection case · Synthetic household 0',exact:true}).waitFor()
   assert.ok((await page.getByRole('table',{name:'Collection option comparison'}).first().innerText()).includes('pay or quit notice'))
   assert.ok((await page.content()).includes('Actual recorded cash since forecast: $500.00'))
   const dated=await page.getByRole('list',{name:'Dated expected plan receipts'}).first().innerText()
   assert.match(dated,/2026-10-24.*expected \$166\.65/)
   assert.match(dated,/2026-10-26.*expected \$166\.65/)
   assert.ok((await page.content()).includes('Notice and turnover timeline: 28 days.'))
   const draftDetails=page.locator('details').filter({has:page.getByText('Prepare the next collection sequence step',{exact:true})})
   await draftDetails.locator('summary').click()
   await draftDetails.getByLabel('Action kind',{exact:true}).selectOption('plan')
   await draftDetails.getByLabel('Due date',{exact:true}).fill('2026-10-23')
   await draftDetails.getByLabel('Exact message',{exact:true}).fill('Synthetic native plan review: the first installment has been received.')
   await draftDetails.getByRole('button',{name:'Prepare collection action',exact:true}).click()
   await page.getByText('Synthetic native plan review: the first installment has been received.',{exact:true}).waitFor()
   await context.clearCookies();await context.addCookies(staff[0].split('; ').map(pair=>{const at=pair.indexOf('=');return{name:pair.slice(0,at),value:pair.slice(at+1),url:h.origin}}));await page.reload()
   const action=page.locator('article').filter({has:page.getByText('Synthetic native plan review: the first installment has been received.',{exact:true})})
   await action.getByLabel('Evidence reference',{exact:true}).fill('synthetic-terrace-270 native human review')
   await action.getByRole('button',{name:'Approve exact collection action',exact:true}).click()
   await action.getByRole('button',{name:'Send exact collection action',exact:true}).waitFor()
   await action.getByRole('button',{name:'Send exact collection action',exact:true}).click()
   assert.ok((await action.innerText()).includes('accepted'))
   await context.clearCookies();await context.addCookies(h.cookie.split('; ').map(pair=>{const at=pair.indexOf('=');return{name:pair.slice(0,at),value:pair.slice(at+1),url:h.origin}}));await page.reload()
   await capture('collection-plan-and-forecast')
   await page.goto(url(cases[1].t));await page.getByRole('heading',{name:'Collection case · Synthetic household 1',exact:true}).waitFor()
   assert.ok((await page.content()).includes('Expiry: <strong>2026-10-26</strong>'))
   assert.ok((await page.content()).includes('Payment plan: <strong>broken</strong>'))
   assert.ok((await page.getByText('Forecast paused:',{exact:true}).count())>=4,'held comparisons show a visible pause')
   await capture('collection-notice-and-hold')
   await page.goto(url(cases[2].t));await page.getByRole('heading',{name:'Collection case · Synthetic household 2',exact:true}).waitFor()
   assert.ok((await page.content()).includes('No overdue balance; stop collection messages'))
   await capture('collection-paid-and-stopped')
   await page.goto(h.origin+'/app?tab=settings&tenancy='+cases[1].t.id)
   await page.getByRole('heading',{name:'Collection contact and holds',exact:true}).waitFor()
   assert.equal(await page.getByLabel('Collection hold',{exact:true}).inputValue(),'manual')
   for(const [width,height]of [[1440,900],[390,844]]){await page.setViewportSize({width,height});await page.screenshot({path:join(out,'collection-settings-'+width+'.png'),fullPage:true})}
  }finally{await context.close()}
 },inspectOutcome:async({h,cases})=>{
  const context=await browser.newContext({viewport:{width:1440,height:900}})
  try{
   await context.addCookies(h.cookie.split('; ').map(pair=>{const at=pair.indexOf('=');return{name:pair.slice(0,at),value:pair.slice(at+1),url:h.origin}}))
   const page=await context.newPage()
   for(const [index,name,cash,vacancy]of [[0,'completed-plan-forecast','$1,000.00',0],[1,'completed-notice-forecast','$300.00',12]]){
    await page.goto(h.origin+'/app?tab=delinquency&tenancy='+cases[index].t.id)
    await page.getByRole('heading',{name:'Collection case · Synthetic household '+index,exact:true}).waitFor()
    const forecast=page.locator('article').filter({has:page.getByRole('heading',{name:'Cash and vacant days · 2026-10-23',exact:true})})
    const chosen=forecast.filter({hasText:index===0?'Chosen actions: plan':'Chosen actions: pay or quit notice'})
    assert.equal(await chosen.count(),1,'the forecast retains the option a person actually sent')
    const result=await chosen.innerText()
    assert.ok(result.includes('Actual recorded cash since forecast: '+cash))
    assert.ok(result.includes('Actual vacant days: '+vacancy))
    assert.ok((await chosen.getByRole('table',{name:'Collection option comparison'}).innerText()).includes(index===0?'$333.30':'$950.00'),'expected cash remains beside the completed actual')
    for(const [width,height]of [[1440,900],[390,844]]){await page.setViewportSize({width,height});await page.screenshot({path:join(out,name+'-'+width+'.png'),fullPage:true})}
   }
  }finally{await context.close()}
 }})
 console.log('Collection native actions passed at 1440; changed screens captured at 1440 and 390.')
}finally{await browser.close()}
