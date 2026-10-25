import assert from 'node:assert/strict'
import {mkdir} from 'node:fs/promises'
import {resolve,join} from 'node:path'
import {chromium} from '@playwright/test'
import {journey} from './action-requests.mjs'
const out=resolve(process.env.ACTION_SCREENSHOTS??'.rer/action-request-screens');await mkdir(out,{recursive:true})
const browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']})
async function capture(r,cookie,path,name,staff=false){
 const context=await browser.newContext();await context.addCookies(cookie.split('; ').map(pair=>{const i=pair.indexOf('=');return {name:pair.slice(0,i),value:pair.slice(i+1),url:r.origin}}))
 const page=await context.newPage()
 try {
  await page.goto(r.origin+path);await page.getByRole('heading',{level:1}).waitFor()
  for(const [width,height] of [[1440,900],[390,844]]) {
   await page.setViewportSize({width,height})
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),name+' fits '+width)
   if(staff){
    const person=page.getByRole('link',{name:'Manage people'});await person.focus();await page.getByRole('tooltip',{name:'Manage people'}).waitFor({state:'visible'})
    await person.blur();await page.mouse.move(0,0);await person.hover();await page.waitForTimeout(350);await page.getByRole('tooltip',{name:'Manage people'}).waitFor({state:'visible'});await page.mouse.move(0,0)
   }
   const icons=await page.locator('button,a').evaluateAll(nodes=>nodes.filter(n=>getComputedStyle(n).display!=='none'&&!n.textContent.trim()&&!n.querySelector('img[alt]')).map(n=>n.outerHTML))
   assert.deepEqual(icons,[],'Every control has a visible label or tooltip')
   await page.screenshot({path:join(out,name+'-'+width+'.png'),fullPage:true})
  }
 } finally {await context.close()}
}
try {await journey({assets:true,inspect:async c=>{
 const {r,t,phase}=c
 if(phase==='open'){
  await capture(r,r.cookie,'/app?tab=requests&tenancy='+t.id,'staff-requests',true)
  await capture(r,c.residentCookie,c.path,'requested-upload')
 }
 if(phase==='submitted'||phase==='completed')await capture(r,r.cookie,'/app?tab=requests&tenancy='+t.id,'staff-'+phase,true)
 if(['sign','acknowledge'].includes(phase))await capture(r,c.residentCookie,c.path,'requested-'+phase)
 if(phase==='quote')await capture(r,c.ownerCookie,c.path,'requested-quote')
}})}finally {await browser.close()}
