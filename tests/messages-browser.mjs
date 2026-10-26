import assert from 'node:assert/strict'
import {mkdir} from 'node:fs/promises'
import {join,resolve} from 'node:path'
import {chromium} from '@playwright/test'
import {journey} from './messages.mjs'
const out=resolve(process.env.MESSAGE_SCREENSHOTS??'.rer/message-screens');await mkdir(out,{recursive:true})
const browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']})
let context,page,currentOrigin
async function capture(name){
 for(const [width,height]of [[1440,900],[390,844]]){
  await page.setViewportSize({width,height})
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),name+' fits '+width)
  const control=page.getByRole('link',{name:'Manage people',exact:true})
  await control.focus();await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(resolve)));assert.equal(await control.locator('[role="tooltip"]').evaluate(el=>getComputedStyle(el).opacity),'1')
  await page.locator('h1').click();await control.hover();await page.waitForTimeout(400)
  assert.equal(await control.locator('[role="tooltip"]').evaluate(el=>getComputedStyle(el).opacity),'1')
  await page.screenshot({path:join(out,`${name}-${width}.png`),fullPage:true})
  if(['thread','opted-out','complete','arrival-reply'].includes(name))await page.locator('article').last().screenshot({path:join(out,`${name}-latest-${width}.png`)})
 }
 await page.setViewportSize({width:1440,height:900})
}
try{
 await journey({assets:true,inspect:async({phase,h,t})=>{
  if(!context||currentOrigin!==h.origin){await context?.close();currentOrigin=h.origin;context=await browser.newContext();await context.addCookies(h.cookie.split('; ').map(pair=>{const i=pair.indexOf('=');return{name:pair.slice(0,i),value:pair.slice(i+1),url:h.origin}}));page=await context.newPage()}
  if(phase==='ready'){
   await page.goto(h.origin+'/app?tab=settings&tenancy='+t.id)
   await page.getByText('Record a recipient',{exact:true}).click();await capture('permissions')
   await page.goto(h.origin+'/app?tab=work&tenancy='+t.id)
   await page.getByRole('link',{name:'Open repair messages',exact:true}).click()
   await page.getByText('Prepare a message',{exact:true}).click()
   await page.getByLabel('Repair message',{exact:true}).fill('River Plumbing will inspect your kitchen valve. Please tell us if access arrangements change.')
   await page.getByRole('button',{name:'Prepare message',exact:true}).click();await page.getByRole('button',{name:'Approve exact message',exact:true}).waitFor();await capture('prepared')
   await page.getByRole('checkbox').check();await page.getByRole('button',{name:'Approve exact message',exact:true}).click();await page.getByRole('button',{name:'Send approved message',exact:true}).waitFor();await capture('approved')
   await page.getByRole('button',{name:'Send approved message',exact:true}).click();await page.getByRole('status').filter({hasText:'accepted by provider'}).waitFor();await capture('email-accepted')
  }else if(phase==='confirmed'){
   await page.goto(h.origin+'/app?tab=work&tenancy='+t.id);await capture('arrival-confirmed')
   await page.goto(h.origin+'/app?tab=messages&tenancy='+t.id)
   await page.locator('details').filter({has:page.locator('summary').filter({hasText:'Message history'})}).last().locator('summary').click();await capture('arrival-reply')
  }else{
   await page.goto(h.origin+'/app?tab=messages&tenancy='+t.id)
   const article=phase==='thread'?page.locator('article').filter({hasText:'Will the plumber bring a replacement valve?'}):page.locator('article').last();await article.locator('summary').click();await capture(phase)
   if(phase==='complete'){await page.goto(h.origin+'/app?tab=emergencies');await capture('manual-page-case')}
   if(phase==='ambiguous'){await page.goto(h.origin+'/app?tab=work&tenancy='+t.id);await capture('ambiguous-window')}
  }
 }})
}finally{await context?.close();await browser.close()}
