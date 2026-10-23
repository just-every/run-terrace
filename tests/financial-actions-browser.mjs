import assert from 'node:assert/strict'
import {mkdir} from 'node:fs/promises'
import {resolve,join} from 'node:path'
import {chromium} from '@playwright/test'
import {journey} from './financial-actions.mjs'
const out=resolve(process.env.FINANCIAL_SCREENSHOTS??'.rer/financial-screens');await mkdir(out,{recursive:true})
const browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']})
try{await journey({assets:true,inspect:async({phase,h,t,revised,manager,check,cancellation})=>{
 const cookie=phase==='approval'?manager:h.cookie,context=await browser.newContext();await context.addCookies(cookie.split('; ').map(pair=>{const i=pair.indexOf('=');return{name:pair.slice(0,i),value:pair.slice(i+1),url:h.origin}}));const page=await context.newPage()
 const proof=async name=>{for(const[width,height]of [[1440,900],[390,844]]){await page.setViewportSize({width,height});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no page overflow at '+width);const people=page.getByRole('link',{name:'Manage people',exact:true});await people.focus();await page.keyboard.press('Tab');await page.keyboard.press('Shift+Tab');assert.ok(await people.evaluate(e=>e===document.activeElement),'keyboard returns to account control');assert.equal(await page.locator('#people-tooltip').evaluate(e=>getComputedStyle(e).visibility),'visible');await page.locator('h1').click();await page.screenshot({path:join(out,name+'-'+width+'.png'),fullPage:true})}}
 try{
  await page.goto(h.origin+'/app?tab=ledger&tenancy='+t.id);await page.getByRole('heading',{name:'Refunds, credits and write-offs',exact:true}).waitFor()
  if(phase==='approval'){
   await proof('changed-source-approval');await page.getByRole('button',{name:'Approve exact financial action',exact:true}).click();await page.getByText('Exact payee, amount, source and owner effects approved. No refund or check sent.',{exact:true}).waitFor();await proof('independent-approval');return{approved:true}
  }else if(phase==='refund'){
   const form=page.locator('form:has(input[name=command][value="finance.record"])');await form.getByLabel('External execution or correction reference',{exact:true}).fill('synthetic-terrace-110 native provider confirmation');await form.getByLabel('Type RECORDED after checking the external fact or approved correction',{exact:true}).fill('RECORDED');await proof('review-external-refund');await form.getByRole('button',{name:'Record external refund',exact:true}).click();await page.getByText('External refund recorded once in resident and original-owner ledgers. Original receipt retained; no instruction sent.',{exact:true}).waitFor();await proof('external-refund-recorded');return{recorded:true}
  }else if(phase==='cancel'){
   const card=page.getByRole('article').filter({hasText:'synthetic-terrace-103 cancelled refund'});await card.getByText('Cancel this unexecuted action',{exact:true}).click();const form=card.locator('form:has(input[name=command][value="finance.cancel"])');await form.getByLabel('Cancellation reason',{exact:true}).fill('synthetic-terrace-111 native cancellation');await proof('cancel-unexecuted-refund');await form.getByRole('button',{name:'Cancel financial action',exact:true}).click();await page.getByText('Unexecuted financial action cancelled; source reservation released. History retained.',{exact:true}).waitFor();await proof('cancelled-refund');return{cancelled:true}
  }else if(phase==='check'){
   await page.getByText('Exact payee Alex Chen · check · forwarding address 89 Synthetic Forwarding Road, Chicago IL 60601 · check 1001',{exact:true}).waitFor();await proof('forwarding-check-approval');await page.getByRole('button',{name:'Register non-negotiable check draft',exact:true}).click();await page.getByText('Non-negotiable refund check draft registered. No check was printed, mailed or issued.',{exact:true}).waitFor();await proof('non-negotiable-check-register');return{registered:true}
  }else{await page.getByRole('heading',{name:'Check 1001 · external issuance recorded',exact:true}).waitFor();await proof('financial-corrections-and-check-record')}
 }finally{await context.close()}
}})}finally{await browser.close()}
