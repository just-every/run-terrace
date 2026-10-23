import assert from 'node:assert/strict'
import {mkdir} from 'node:fs/promises'
import {resolve,join} from 'node:path'
import {chromium} from '@playwright/test'
import {journey} from './late-fees.mjs'
const out=resolve(process.env.LATE_FEE_SCREENSHOTS??'.rer/late-fee-screens');await mkdir(out,{recursive:true})
const browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']})
try{await journey({assets:true,inspect:async({phase,h,places})=>{
 const context=await browser.newContext();await context.addCookies(h.cookie.split('; ').map(pair=>{const i=pair.indexOf('=');return{name:pair.slice(0,i),value:pair.slice(i+1),url:h.origin}}));const page=await context.newPage(),t=places.TX.t
 const proof=async name=>{for(const[width,height]of [[1440,900],[390,844]]){await page.setViewportSize({width,height});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no page overflow at '+width);await page.getByRole('link',{name:'Manage people',exact:true}).focus();assert.equal(await page.locator('#people-tooltip').evaluate(e=>getComputedStyle(e).visibility),'visible');await page.locator('h1').click();await page.screenshot({path:join(out,name+'-'+width+'.png'),fullPage:true})}}
 const preview=async(tenancy,on)=>{await page.goto(h.origin+'/app?tab=ledger&tenancy='+tenancy);const form=page.locator('form:has(input[name=command][value="latefee.preview"])');await form.getByLabel('Schedule day',{exact:true}).fill(on);await form.getByRole('button',{name:'Review late-fee schedule',exact:true}).click();await page.getByRole('heading',{name:'Schedule review · '+on,exact:true}).waitFor()}
 try{
  if(phase==='calculation'){
   await preview(t.id,'2026-10-06');await page.getByText('TX v1: 2 full unpaid days; first fee day 2026-10-06; cap 12% ($120.00) of monthly rent; timely pending protected $0.00. Tex. Prop. Code §92.019.',{exact:true}).waitFor();await proof('texas-calculation')
   await preview(places.CA.t.id,'2026-10-07');await page.getByText(/CA v1: 4 full unpaid days/).waitFor();await proof('california-calculation')
  }else if(phase==='post'){
   await preview(t.id,'2026-10-06');await page.getByRole('button',{name:'Post reviewed late-fee schedule',exact:true}).click();await page.getByText('Reviewed late-fee schedule recorded once. Original policies retained; no compounding or message sent.',{exact:true}).waitFor();await proof('posted-fee');return{posted:true}
  }else if(phase==='waiver'){
   await page.goto(h.origin+'/app?tab=ledger&tenancy='+t.id);const form=page.locator('form:has(input[name=command][value="latefee.waive"])');await form.getByLabel('Waiver USD',{exact:true}).fill('100.00');await form.getByLabel('Waiver date',{exact:true}).fill('2026-10-07');await form.getByLabel('Waiver reason',{exact:true}).fill('synthetic-terrace-80 hardship waiver');await form.getByLabel('Unique waiver reference',{exact:true}).fill('synthetic-terrace-80');await proof('review-waiver');await form.getByRole('button',{name:'Record reasoned waiver',exact:true}).click();await page.getByText('Reasoned late-fee waiver recorded; original fee and policy retained.',{exact:true}).waitFor();await proof('reasoned-waiver');return{waived:true}
  }else{
   await preview(t.id,'2026-10-06');await page.getByText(/timely pending protected \$1,000\.00/).waitFor();await proof('timely-pending-protected')
  }
 }finally{await context.close()}
}})}finally{await browser.close()}
