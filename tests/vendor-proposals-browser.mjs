import assert from 'node:assert/strict'
import {mkdir} from 'node:fs/promises'
import {join,resolve} from 'node:path'
import {chromium} from '@playwright/test'
import {journey} from './portal.mjs'
const out=resolve(process.env.VENDOR_PROPOSAL_SCREENSHOTS??'.rer/vendor-proposal-screens');await mkdir(out,{recursive:true})
const browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']})
try{await journey({assets:true,inspect:async({phase,r,north,cookies,invoiceOriginal,billId})=>{
 if(!['vendor-proposal','vendor-proposal-recorded','vendor-invoice','vendor-invoice-recorded'].includes(phase))return
 const ctx=await browser.newContext();await ctx.addCookies(cookies.vendor1.split('; ').map(p=>{const i=p.indexOf('=');return{name:p.slice(0,i),value:p.slice(i+1),url:r.origin}}));const page=await ctx.newPage()
 const shoot=async name=>{for(const [width,height]of [[1440,900],[390,844]]){await page.setViewportSize({width,height});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:join(out,name+'-'+width+'.png'),fullPage:true})}}
 await page.goto(r.origin+'/portal/work')
 if(phase==='vendor-proposal'){
  await page.getByText('Propose an appointment',{exact:true}).click();const f=page.locator('form[action="/portal/appointment-proposal"]');await f.getByLabel('Proposed start',{exact:true}).fill('2026-11-02T09:00-08:00');await f.getByLabel('Proposed end',{exact:true}).fill('2026-11-02T11:00-08:00');await f.getByLabel('Proposal reason',{exact:true}).fill('Available after collecting the replacement valve');await f.getByRole('checkbox').check();await shoot('vendor-availability-review');await f.getByRole('button',{name:'Submit availability',exact:true}).click();await page.getByText(/^Proposed availability:/).waitFor();await shoot('vendor-availability-submitted')
 }else if(phase==='vendor-proposal-recorded'){
  await shoot('vendor-availability-retained');await ctx.clearCookies();await ctx.addCookies(r.cookie.split('; ').map(p=>{const i=p.indexOf('=');return{name:p.slice(0,i),value:p.slice(i+1),url:r.origin}}));await page.goto(r.origin+'/app?tab=work&tenancy='+north.id);await page.getByRole('heading',{name:'Vendor proposed availability',exact:true}).waitFor();const people=page.getByRole('link',{name:'Manage people',exact:true});await people.focus();assert.equal(await page.locator('#people-tooltip').evaluate(el=>getComputedStyle(el).visibility),'visible');await shoot('staff-availability-review')
 }
 if(phase==='vendor-invoice'){
  await page.getByText('Submit an invoice',{exact:true}).click();const f=page.locator('form[action="/portal/invoice"]');for(const [name,value]of Object.entries({invoiceNumber:'INV-VENDOR-PORTAL-1',date:'2026-10-25',description:'Kitchen valve diagnosis',amount:'60.00',tax:'6.00'}))await f.locator(`[name="${name}"]`).fill(value);await f.locator('input[name="original"]').setInputFiles({name:invoiceOriginal.name,mimeType:invoiceOriginal.type,buffer:Buffer.from(invoiceOriginal.base64,'base64')});await f.getByRole('checkbox').check();await shoot('vendor-invoice-review');await f.getByRole('button',{name:'Submit invoice for review',exact:true}).click();await page.getByText(/INV-VENDOR-PORTAL-1/).first().waitFor();await shoot('vendor-invoice-submitted')
 }
 if(phase==='vendor-invoice-recorded'){
  await shoot('vendor-invoice-status');await ctx.clearCookies();await ctx.addCookies(r.cookie.split('; ').map(p=>{const i=p.indexOf('=');return{name:p.slice(0,i),value:p.slice(i+1),url:r.origin}}));await page.goto(r.origin+'/app?tab=bills');await page.getByText('INV-VENDOR-PORTAL-1',{exact:false}).first().waitFor();await shoot('staff-vendor-invoice-review')
 }
 await ctx.close()
}})}finally{await browser.close()}
