import assert from 'node:assert/strict'
import {mkdir} from 'node:fs/promises'
import {resolve,join} from 'node:path'
import {chromium} from '@playwright/test'
import {journey} from './households.mjs'
const out=resolve(process.env.HOUSEHOLD_SCREENSHOTS??'.rer/household-screens');await mkdir(out,{recursive:true})
const browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']})
try{await journey({assets:true,inspect:async({h,future,active})=>{
 const context=await browser.newContext()
 await context.addCookies(h.cookie.split('; ').map(pair=>{const i=pair.indexOf('=');return{name:pair.slice(0,i),value:pair.slice(i+1),url:h.origin}}))
 const page=await context.newPage()
 for(const [name,t]of [['before-joining',future],['on-joining',active]]){
  await page.goto(h.origin+'/app?tab=tenancy&tenancy='+t.id)
  const household=page.locator('.household');await household.getByRole('heading',{name:'Household',exact:true}).waitFor()
  if(name==='before-joining'){assert.equal(await household.getByText(/not current/).count(),2);assert.equal(await household.getByText(/receives notices|sees lease documents/).count(),0)}
  else assert.equal(await household.getByText(/receives notices by email · sees lease documents/).count(),1)
  for(const [width,height]of [[1440,900],[390,844]]){
   await page.setViewportSize({width,height});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth))
   await page.screenshot({path:join(out,name+'-'+width+'.png'),fullPage:true})
  }
 }
 await context.close()
}})}finally{await browser.close()}
