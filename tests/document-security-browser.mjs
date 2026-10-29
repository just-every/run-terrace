import assert from 'node:assert/strict'
import {mkdir} from 'node:fs/promises'
import {resolve,join} from 'node:path'
import {chromium} from '@playwright/test'
import {securityJourney} from './documents.mjs'
const out=resolve(process.env.DOCUMENT_SCREENSHOTS??'.rer/document-security-screens');await mkdir(out,{recursive:true})
const browser=await chromium.launch({headless:true,...(process.env.RER_CHROMIUM_PATH?{executablePath:process.env.RER_CHROMIUM_PATH}:{}),args:['--no-sandbox','--use-mock-keychain','--password-store=basic']})
try{
 await securityJourney({assets:true,inspect:async({h,report,tin})=>{
  const context=await browser.newContext({viewport:{width:1440,height:900}})
  try{
   await context.addCookies(h.cookie.split('; ').map(pair=>{const at=pair.indexOf('=');return{name:pair.slice(0,at),value:pair.slice(at+1),url:h.origin}}))
   const page=await context.newPage();await page.goto(h.origin+'/app?tab=documents&q=Restricted')
   await page.getByRole('heading',{name:'Restricted report [Restricted identifier]',exact:false}).waitFor()
   assert.ok(!(await page.content()).includes(tin),'native metadata redacts the restricted identifier')
   assert.ok((await page.locator('main').innerText()).includes('expires after five minutes'))
   const pending=page.waitForEvent('download');await page.getByRole('link',{name:'Download original',exact:true}).click()
   const download=await pending;assert.equal(await download.failure(),null)
   const person=page.getByRole('link',{name:'Manage people',exact:true})
   await person.focus();await page.waitForTimeout(30);assert.equal(await person.locator('[role=tooltip]').evaluate(el=>getComputedStyle(el).opacity),'1')
   await page.getByRole('heading',{name:'Documents',exact:true,level:2}).click();await person.hover();await page.waitForTimeout(400);assert.equal(await person.locator('[role=tooltip]').evaluate(el=>getComputedStyle(el).opacity),'1')
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'documents fit at 1440')
   for(const [width,height]of [[1440,900],[390,844]]){await page.setViewportSize({width,height});await page.screenshot({path:join(out,'restricted-document-'+width+'.png'),fullPage:true})}
  }finally{await context.close()}
 }})
 console.log('Restricted native metadata and authorized download passed at 1440; proof captured at 1440 and 390.')
}finally{await browser.close()}
