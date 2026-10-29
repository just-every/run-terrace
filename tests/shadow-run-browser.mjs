import assert from 'node:assert/strict'
import {mkdir} from 'node:fs/promises'
import {resolve,join} from 'node:path'
import {chromium} from '@playwright/test'
import {journey} from './shadow-run.mjs'
const out=resolve(process.env.SHADOW_SCREENSHOTS??'.rer/shadow-screens');await mkdir(out,{recursive:true})
const browser=await chromium.launch({headless:true,...(process.env.RER_CHROMIUM_PATH?{executablePath:process.env.RER_CHROMIUM_PATH}:{}),args:['--no-sandbox','--use-mock-keychain','--password-store=basic']})
try{
 await journey({assets:true,inspect:async({h,property,leases})=>{
  const context=await browser.newContext({viewport:{width:1440,height:900}})
  try{
   await context.addCookies(h.cookie.split('; ').map(pair=>{const at=pair.indexOf('=');return{name:pair.slice(0,at),value:pair.slice(at+1),url:h.origin}}))
   const page=await context.newPage();await page.goto(h.origin+'/app?tab=import')
   await page.getByRole('link',{name:'Open shadow rent comparison',exact:true}).click()
   await page.getByRole('heading',{name:'Shadow rent',exact:true}).waitFor()
   assert.ok((await page.locator('main').innerText()).includes('Reviewed documentary match'))
   assert.ok((await page.locator('main').innerText()).includes('Source replaced'))
   const intake=page.locator('#shadow-rent')
   await intake.locator('summary').first().click()
   const rows=leases.map((t,i)=>({sourceRef:'synthetic-terrace-native-'+i,tenancyId:t.id,currency:'USD',openingCents:0,chargesCents:i===0?2000:0,receiptsCents:0,reductionsCents:0,closingCents:i===0?2000:0}))
   await intake.getByLabel('Property',{exact:true}).selectOption(property.id)
   await intake.getByLabel('Period start',{exact:true}).fill('2026-09-01')
   await intake.getByLabel('Period end',{exact:true}).fill('2026-09-30')
   await intake.getByLabel('Source statement original',{exact:true}).setInputFiles({name:'synthetic-native-statement.txt',mimeType:'text/plain',buffer:Buffer.from('Explicitly synthetic original. synthetic-terrace-26 native September statement.')})
   await intake.getByLabel('Source statement reference',{exact:true}).fill('synthetic-terrace-27 native source')
   await intake.getByLabel('Evidence origin',{exact:true}).selectOption('yes')
   await intake.getByLabel('Source rows and mappings',{exact:true}).fill(JSON.stringify(rows))
   await intake.getByRole('button',{name:'Capture documentary comparison',exact:true}).click()
   const card=page.locator('[data-shadow-id]').filter({has:page.getByText('Source: synthetic-terrace-27 native source',{exact:false})})
   await card.waitFor();assert.ok((await card.innerText()).includes('Awaiting exact review'))
   const lease=card.locator('details').filter({has:page.locator('summary:text-is("synthetic-terrace-native-0 · Alex Synthetic · USD")')}).first()
   await lease.locator('summary').first().click()
   const table=card.getByRole('table',{name:'Source row 1 · synthetic-terrace-native-0',exact:true})
   assert.ok((await table.innerText()).includes('$20.00'))
   assert.equal(await table.locator('tbody tr').count(),5)
   await card.getByLabel('Review reference',{exact:true}).fill('synthetic-terrace-28 exact native review')
   await card.getByLabel('Type RECORD ONLY',{exact:true}).fill('RECORD ONLY')
   await card.getByRole('button',{name:'Record exact documentary review',exact:true}).click()
   await card.getByText('Reviewed documentary match',{exact:false}).waitFor()
   assert.ok((await card.innerText()).includes('matched'))
   const download=await card.getByRole('link',{name:'Download exact source original',exact:true}).getAttribute('href')
   const original=await h.request(download);assert.equal(await original.text(),'Explicitly synthetic original. synthetic-terrace-26 native September statement.')
   const person=page.getByRole('link',{name:'Manage people',exact:true})
   await person.focus();await page.waitForTimeout(30);assert.equal(await person.locator('[role=tooltip]').evaluate(el=>getComputedStyle(el).opacity),'1')
   await page.getByRole('heading',{name:'Shadow rent',exact:true}).click();await person.hover();await page.waitForTimeout(400);assert.equal(await person.locator('[role=tooltip]').evaluate(el=>getComputedStyle(el).opacity),'1')
   await card.locator('summary').filter({hasText:'synthetic-terrace-native-0'}).first().click()
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'comparison screen fits at 1440')
   for(const [width,height]of [[1440,900],[390,844]]){
    await page.setViewportSize({width,height})
    await card.screenshot({path:join(out,'native-shadow-review-'+width+'.png')})
   }
  }finally{await context.close()}
 }})
 console.log('Shadow rent native capture, exact review and original download passed at 1440; screens captured at 1440 and 390.')
}finally{await browser.close()}
