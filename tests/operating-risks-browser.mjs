import assert from 'node:assert/strict'
import {mkdir} from 'node:fs/promises'
import {resolve,join} from 'node:path'
import {chromium} from '@playwright/test'
import {journey} from './operating-risks.mjs'
const out=resolve(process.env.OPERATING_RISK_SCREENSHOTS??'.rer/operating-risk-screens')
await mkdir(out,{recursive:true})
const browser=await chromium.launch({headless:true,...(process.env.RER_CHROMIUM_PATH?{executablePath:process.env.RER_CHROMIUM_PATH}:{}),args:['--no-sandbox','--use-mock-keychain','--password-store=basic']})
try{
 await journey({assets:true,inspect:async({h,q,data,hvac,repair,shown})=>{
  const context=await browser.newContext({viewport:{width:1440,height:1000}})
  try{
   await context.addCookies(h.cookie.split('; ').map(pair=>{const i=pair.indexOf('=');return{name:pair.slice(0,i),value:pair.slice(i+1),url:h.origin}}))
   const page=await context.newPage()
   await page.goto(h.origin+'/app?tab=properties')
   await page.getByRole('link',{name:'Analyze operating risks',exact:true}).click()
   await page.getByLabel('Property',{exact:true}).selectOption(q.propertyId)
   await page.getByRole('button',{name:'Choose equipment',exact:true}).click()
   await page.locator('input[name=asset][value="'+hvac.id+'"]').check()
   await page.getByLabel('From',{exact:true}).fill(q.from)
   await page.getByLabel('To',{exact:true}).fill(q.to)
   await page.getByText('Optional dated scenario',{exact:true}).click()
   for(const [label,key]of [['Assumption date','assumptionDate'],['Assumption source','assumptionReference'],['Preventive cost in USD','preventiveCost'],['Cost per avoided callback in USD','callbackCost'],['Assumed avoided callbacks','avoidedCallbacks']])await page.getByLabel(label,{exact:true}).fill(q[key])
   await page.getByRole('button',{name:'Analyze selected sources',exact:true}).click()
   const section=page.locator('#operating-risks')
   await section.getByRole('heading',{name:'Repeated callbacks recorded',exact:true}).waitFor()
   const content=await section.innerText()
   for(const expected of [repair.id,shown.id,'2 callbacks (1 warranty, 1 billable)','1 of 2 · 50%','2 of 2 · 100%','$60.03 net benefit','Evidence gaps and boundaries','not settled costs','No resident answer yet'])assert.ok(content.includes(expected),'native findings show '+expected)
   assert.ok(content.includes(data.hvac[0].jobs[0].checks[0].id),'source check identifiers are inspectable')
   assert.deepEqual(await section.evaluate(root=>[...root.querySelectorAll('p,label,button,input,select,li,summary')].filter(el=>el.getClientRects().length&&parseFloat(getComputedStyle(el).fontSize)<13).map(el=>el.tagName)),[],'native report text is at least 13px')
   const people=page.getByRole('link',{name:'Manage people',exact:true});await people.focus()
   assert.equal(await people.locator('[role=tooltip]').evaluate(el=>getComputedStyle(el).visibility),'visible','shared icon control tooltip appears on focus')
   await section.getByRole('heading',{name:'Operating risks',exact:true}).click();await people.hover();await page.waitForTimeout(400)
   assert.equal(await people.locator('[role=tooltip]').evaluate(el=>getComputedStyle(el).visibility),'visible','shared icon control tooltip appears after hover')
   for(const [width,height]of [[1440,1000],[390,844]]){
    await page.setViewportSize({width,height})
    if(width===1440)assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'analysis fits desktop')
    await section.screenshot({path:join(out,'operating-risks-'+width+'.png')})
   }
  }finally{await context.close()}
 }})
 console.log('PROBE AGENT-007 native findings: source selection, callback and funnel cases, dated scenario and gaps passed at 1440; findings inspected at 1440 and 390.')
}finally{await browser.close()}
