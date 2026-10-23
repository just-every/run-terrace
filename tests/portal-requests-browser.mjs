import assert from 'node:assert/strict'
import {mkdir} from 'node:fs/promises'
import {resolve,join} from 'node:path'
import {chromium} from '@playwright/test'
import {journey} from './portal-requests.mjs'
const out=resolve(process.env.REQUEST_SCREENSHOTS??'.rer/request-screens');await mkdir(out,{recursive:true})
const browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']})
const shoot=async(page,name)=>{for(const [width,height] of [[1440,900],[390,844]]){await page.setViewportSize({width,height});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),name+' fits '+width);await page.screenshot({path:join(out,`${name}-${width}.png`),fullPage:true})}}
try {await journey({assets:true,inspect:async({phase,r,t,resident,path})=>{
 const context=await browser.newContext();await context.addCookies([{name:'tt_portal',value:resident.split('=')[1],url:r.origin}]);const page=await context.newPage()
 try {
  if(phase==='intake') {
   await page.goto(r.origin+'/portal/requests?tenancy='+t.id)
   await page.getByLabel('Describe the issue').fill('Bathroom handle repair')
   await page.getByLabel('Access restrictions').fill('Call me first')
   await page.getByLabel('Pets',{exact:true}).fill('No pets')
   await page.getByLabel('Preferred times').fill('Weekday afternoons')
   await shoot(page,'resident-intake')
   await page.getByRole('button',{name:'Submit repair request'}).click();await page.waitForURL(/\/portal\/request\?id=/)
   await page.getByRole('status').waitFor();await shoot(page,'resident-received')
   await page.goto(r.origin+'/portal/lease?tenancy='+t.id);await shoot(page,'resident-lease-repairs')
  } else {
   await page.goto(r.origin+path);await page.getByRole('heading',{name:'Repair tracking',exact:true}).waitFor();await shoot(page,'resident-'+phase)
   if(phase==='scheduled') {
    const staff=await browser.newContext();await staff.addCookies(r.cookie.split('; ').map(x=>({name:x.slice(0,x.indexOf('=')),value:x.slice(x.indexOf('=')+1),url:r.origin})));const sp=await staff.newPage();await sp.goto(r.origin+'/app?tab=settings')
    const section=sp.locator('section').filter({has:sp.getByRole('heading',{name:'Resident repair requests',exact:true})}).last();await section.waitFor()
    for(const [width,height] of [[1440,900],[390,844]]){await sp.setViewportSize({width,height});await section.screenshot({path:join(out,`staff-requests-${width}.png`)})}
    await staff.close()
   }
  }
  // The touched portal pages use text-labelled controls; every button exposes its visible purpose.
  for(const button of await page.getByRole('button').all())assert.ok((await button.innerText()).trim(),'buttons have visible labels')
 } finally {await context.close()}
}})} finally {await browser.close()}
console.log('resident request screens passed at 1440 and 390')
