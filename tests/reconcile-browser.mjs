import assert from 'node:assert/strict'
import {mkdir} from 'node:fs/promises'
import {resolve,join} from 'node:path'
import {chromium} from '@playwright/test'
import {journey} from './reconcile.mjs'
const out=resolve(process.env.RECONCILE_SCREENSHOTS??'.rer/reconcile-screens');await mkdir(out,{recursive:true})
const browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']})
try{await journey({assets:true,inspect:async({phase,h,statementId,fee})=>{
 const context=await browser.newContext();await context.addCookies(h.cookie.split('; ').map(pair=>{const i=pair.indexOf('=');return{name:pair.slice(0,i),value:pair.slice(i+1),url:h.origin}}));const page=await context.newPage()
 try{
  const proof=async name=>{for(const[width,height]of [[1440,900],[390,844]]){await page.setViewportSize({width,height});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no horizontal overflow at '+width);const people=page.getByRole('link',{name:'Manage people'});await page.keyboard.press('Tab');await people.focus();assert.equal(await people.locator('[role=tooltip]').evaluate(el=>getComputedStyle(el).visibility),'visible');await page.getByRole('heading',{name:'Bank reconciliation',exact:true}).click();await people.hover();await page.waitForTimeout(350);assert.equal(await people.locator('[role=tooltip]').evaluate(el=>getComputedStyle(el).visibility),'visible');await page.mouse.move(0,0);await page.screenshot({path:join(out,name+'-'+width+'.png'),fullPage:true})}}
  await page.goto(h.origin+'/app?tab=reconcile&statementId='+statementId);await page.getByRole('heading',{name:'Three-way reconciliation',exact:true}).waitFor()
  if(phase==='exceptions'){
   await page.getByText('Exceptions prevent sign-off',{exact:true}).waitFor();await proof('exceptions')
   const feeCard=page.getByRole('article').filter({hasText:'bank id fee'});await feeCard.getByLabel('Book source keys, one per line').fill(fee);await feeCard.getByLabel('Reviewed matching reference').fill('synthetic-terrace-23 native fee review');await feeCard.getByRole('button',{name:'Match exact sources'}).click();await page.getByText('Reviewed reconciliation evidence recorded.',{exact:true}).waitFor();await proof('remaining-missing-deposit')
   await page.getByText('Import a reviewed statement',{exact:true}).click();await proof('reviewed-import')
  }else if(phase==='balanced'){
   await page.getByText('Balanced; awaiting sign-off',{exact:true}).waitFor();await proof('balanced-review');await page.getByRole('button',{name:'Sign balanced reconciliation',exact:true}).click();await page.getByText('Balanced and signed',{exact:true}).waitFor();await proof('signed')
  }else{
   await page.getByText('Balanced and signed',{exact:true}).waitFor();await proof('restored-signed');await page.getByRole('link',{name:'Trust account custody',exact:true}).click();await page.getByRole('link',{name:'Review bank statements and reconciliation',exact:true}).waitFor()
   for(const[width,height]of [[1440,900],[390,844]]){await page.setViewportSize({width,height});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:join(out,'trust-navigation-'+width+'.png'),fullPage:true})}
  }
 }finally{await context.close()}
}})}finally{await browser.close()}
