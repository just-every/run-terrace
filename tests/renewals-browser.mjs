// Renewal alternatives, fresh counteroffer approval and future terms through native screens.
import assert from 'node:assert/strict'
import {mkdir} from 'node:fs/promises'
import {join,resolve} from 'node:path'
import {chromium} from '@playwright/test'
import {journey} from './renewals.mjs'
const out=resolve(process.env.RENEWAL_SCREENSHOTS??'.rer/renewal-screens');await mkdir(out,{recursive:true})
const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{}),args:['--no-sandbox','--use-mock-keychain','--password-store=basic']})
try{await journey({assets:true,inspect:async({h,stage,renewalId,leaseId})=>{
 const context=await browser.newContext()
 try{
  await context.addCookies(h.cookie.split('; ').map(pair=>{const i=pair.indexOf('=');return{name:pair.slice(0,i),value:pair.slice(i+1),url:h.origin}}))
  const page=await context.newPage()
  for(const [width,height]of [[1440,900],[390,844]]){
   await page.setViewportSize({width,height});await page.goto(h.origin+'/app?tab=renewals')
   const card=page.locator('#renewal-'+renewalId)
   if(stage==='options'){
    assert.match(await card.innerText(),/Sourced alternatives.*1,890\.00.*1,850\.00/s)
    assert.match(await card.innerText(),/estimated concession \$100\.00/)
    assert.ok((await card.locator('dd').first().boundingBox()).width>width/2,'alternative values have readable width')
    assert.equal(await card.getByRole('button',{name:'Approve offer',exact:true}).count(),1)
   }else if(stage==='counteroffer'){
    assert.match(await card.innerText(),/Counteroffer received: prepare a revised offer/)
    assert.equal(await card.getByRole('button',{name:'Send offer',exact:true}).count(),0)
   }else{
    assert.match(await card.innerText(),/Renewed terms active/)
    assert.match(await page.locator('body').innerText(),/Eli Soon.*Escalate unanswered offer to the owner before 2026-10-28/s)
   }
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'renewals fit '+width)
   await page.screenshot({path:join(out,stage+'-'+width+'.png'),fullPage:true})
   await card.scrollIntoViewIfNeeded();await page.screenshot({path:join(out,stage+'-detail-'+width+'.png')})
   const person=page.getByRole('link',{name:'Manage people',exact:true}),tip=page.getByRole('tooltip',{name:'Manage people',exact:true})
   await person.hover();await page.waitForTimeout(350);await tip.waitFor({state:'visible'})
   await page.mouse.move(0,0);await person.focus();await tip.waitFor({state:'visible'})
   await page.screenshot({path:join(out,stage+'-tooltip-'+width+'.png')})
   if(leaseId){
    const data=await h.state();const tenancyId=data.tenancies.find(t=>t.tenant_name==='Ana Ruiz').id
    await page.goto(h.origin+'/app?tab=tenancy&tenancy='+tenancyId)
    assert.match(await page.locator('body').innerText(),/signature recorded by staff/)
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'signed terms fit '+width)
    await page.screenshot({path:join(out,'signed-terms-'+width+'.png'),fullPage:true})
   }
  }
 }finally{await context.close()}
}});console.log('Renewal browser proof passed at 1440 and 390')}finally{await browser.close()}
