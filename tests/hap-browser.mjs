import assert from 'node:assert/strict'
import {mkdir} from 'node:fs/promises'
import {resolve,join} from 'node:path'
import {chromium} from '@playwright/test'
import {journey} from './hap.mjs'
const out=resolve(process.env.HAP_SCREENSHOTS??'.rer/hap-screens');await mkdir(out,{recursive:true})
const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{}),args:['--no-sandbox','--use-mock-keychain','--password-store=basic']})
try{await journey({assets:true,inspect:async({h,leases,phase})=>{
 const context=await browser.newContext();await context.addCookies(h.cookie.split('; ').map(pair=>{const i=pair.indexOf('=');return{name:pair.slice(0,i),value:pair.slice(i+1),url:h.origin}}));const page=await context.newPage()
 const proof=async name=>{for(const [width,height]of [[1440,900],[390,844]]){
  await page.setViewportSize({width,height});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no page overflow at '+width)
  const people=page.getByRole('link',{name:'Manage people',exact:true});await people.focus();assert.equal(await page.locator('#people-tooltip').evaluate(e=>getComputedStyle(e).visibility),'visible');await page.locator('h1').click();await page.mouse.move(0,0);await people.hover();await page.waitForTimeout(100);assert.equal(await page.locator('#people-tooltip').evaluate(e=>getComputedStyle(e).visibility),'hidden');await page.waitForTimeout(250);assert.equal(await page.locator('#people-tooltip').evaluate(e=>getComputedStyle(e).visibility),'visible');await page.locator('h1').click()
  await page.screenshot({path:join(out,name+'-'+width+'.png'),fullPage:true})
 }}
 try{
  await page.goto(h.origin+'/app?tab=ledger&tenancy='+leases[0].t.id+'&run=2026-07')
  if(phase==='preview'){await page.getByRole('heading',{name:'Charge run · 2026-07',exact:true}).waitFor();await page.getByText('Synthetic Housing Authority',{exact:false}).first().waitFor();await proof('voucher-preview');return}
  await page.getByRole('heading',{name:'Housing authority receivables',exact:true}).waitFor();await proof('separate-pha-ledger')
  await page.goto(h.origin+'/app?tab=delinquency&asOf=2026-10-01&tenancyId='+leases[0].t.id);await page.getByText('Housing authority balance:',{exact:false}).waitFor();await proof('separate-pha-aging')
  const downloadPromise=page.waitForEvent('download');await page.getByRole('link',{name:'Download CSV',exact:true}).click();const download=await downloadPromise;assert.equal(await download.failure(),null);await download.saveAs(join(out,'hap-aging.csv'))
 }finally{await context.close()}
}});console.log('HAP native browser proof PASS')}finally{await browser.close()}
