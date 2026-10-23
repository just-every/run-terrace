// OPS-001: inspect the existing credential, work and action-history screens after an interrupted API write.
import assert from 'node:assert/strict'
import {mkdir} from 'node:fs/promises'
import {join,resolve} from 'node:path'
import {chromium} from '@playwright/test'
import {journey} from './credentials.mjs'
const pictures=resolve(process.env.CREDENTIAL_SCREENSHOTS??'.rer/credential-screens')
await mkdir(pictures,{recursive:true})
const browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']})
try {
 await journey({assets:true,inspect:async({h})=>{
  const context=await browser.newContext()
  try {
   await context.addCookies(h.cookie.split('; ').map(pair=>{const i=pair.indexOf('=');return {name:pair.slice(0,i),value:pair.slice(i+1),url:h.origin}}))
   const page=await context.newPage()
   for(const [tab,label] of [['settings','API credentials'],['work','synthetic-terrace-35 interrupted proposal'],['history','maintenance.prepare']]){
    for(const [width,height] of [[1440,900],[390,844]]){
     await page.setViewportSize({width,height})
     await page.goto(h.origin+'/app?tab='+tab)
     assert.ok(await page.getByText(label,{exact:false}).count(),label+' is readable at '+width)
     assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),tab+' fits '+width)
     const person=page.getByRole('link',{name:'Manage people'})
     await person.focus()
     await page.getByRole('tooltip',{name:'Manage people'}).waitFor({state:'visible'})
     await page.locator('h1').click()
     await person.hover()
     await page.waitForTimeout(350)
     await page.getByRole('tooltip',{name:'Manage people'}).waitFor({state:'visible'})
     await page.screenshot({path:join(pictures,`${tab}-${width}.png`),fullPage:true})
    }
   }
  } finally {await context.close()}
 }})
} finally {await browser.close()}
