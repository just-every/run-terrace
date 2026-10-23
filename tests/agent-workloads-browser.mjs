// AGENT-008: the owner-readable evidence door at desktop and phone widths.
import assert from 'node:assert/strict'
import {mkdir} from 'node:fs/promises'
import {join,resolve} from 'node:path'
import {chromium} from '@playwright/test'
import {journey} from './agent-workloads.mjs'
const pictures=resolve(process.env.AGENT_SCREENSHOTS??'.rer/agent-screens')
await mkdir(pictures,{recursive:true})
const browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']})
try {
 await journey({assets:true,inspect:async({h,preparedId,revokedId,cancelledId})=>{
  const context=await browser.newContext()
  try {
   await context.addCookies(h.cookie.split('; ').map(pair=>{const i=pair.indexOf('=');return {name:pair.slice(0,i),value:pair.slice(i+1),url:h.origin}}))
   const page=await context.newPage()
   for(const [width,height] of [[1440,900],[390,844]]){
    await page.setViewportSize({width,height})
    await page.goto(h.origin+'/api/agent-workloads?format=text')
    const text=await page.locator('body').innerText()
    for(const value of [preparedId,revokedId,cancelledId,'Ignored; content not retained or executed.','humanApproval','modelCents','stopped','cancel'])assert.ok(text.includes(value),value+' is inspectable at '+width)
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'readable evidence fits '+width)
    await page.screenshot({path:join(pictures,`agent-evidence-${width}.png`),fullPage:true})
   }
  } finally {await context.close()}
 }})
} finally {await browser.close()}
