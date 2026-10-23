import assert from 'node:assert/strict'
import {mkdir} from 'node:fs/promises'
import {resolve,join} from 'node:path'
import {chromium} from '@playwright/test'
import {journey,png} from './record-media.mjs'
const dir=resolve(process.env.MEDIA_SCREENSHOTS??'.rer/record-media-screens');await mkdir(dir,{recursive:true})
const browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']})
try{
 await journey({assets:true,inspect:async({h,t,i,video})=>{
  const context=await browser.newContext(),page=await context.newPage()
  try{
   await context.addCookies(h.cookie.split('; ').map(pair=>{const n=pair.indexOf('=');return {name:pair.slice(0,n),value:pair.slice(n+1),url:h.origin}}))
   await page.goto(h.origin+'/app?tab=media&tenancy='+t.id)
   const card=page.locator('article').filter({has:page.getByRole('heading',{name:'Inspection · 10/20/2026'})})
   const form=page.locator('form[data-media-upload][data-record="'+i.id+'"]')
   const fill=async()=>{await form.locator('[name=file]').setInputFiles({name:'mobile-resume.mp4',mimeType:'video/mp4',buffer:video});await form.locator('[name=capturedAt]').fill('2026-10-20');await form.locator('[name=source]').fill('Original mobile walkthrough, interrupted upload')}
   await fill();let chunks=0,interrupted=false
   await page.route('**/api/commands',async route=>{if(route.request().postData()?.includes('media.chunk')&&++chunks===3&&!interrupted){interrupted=true;return route.abort('internetdisconnected')}return route.continue()})
   await form.getByRole('button',{name:'Attach original'}).click()
   await form.getByRole('status').filter({hasText:'resume'}).waitFor();assert.equal(interrupted,true)
   for(const width of [1440,390]){await page.setViewportSize({width,height:900});await page.screenshot({path:join(dir,'interrupted-'+width+'.png'),fullPage:true});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth))}
   await page.reload();await fill();await form.getByRole('button',{name:'Attach original'}).click();await page.getByRole('link',{name:'mobile-resume.mp4',exact:true}).waitFor()
   for(const width of [1440,390]){
    await page.setViewportSize({width,height:900});const person=page.getByRole('link',{name:'Manage people',exact:true});await person.focus();await page.getByRole('tooltip',{name:'Manage people'}).waitFor();await page.screenshot({path:join(dir,'attachments-'+width+'.png'),fullPage:true});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.locator('h1').click();await person.hover();await page.waitForTimeout(100);assert.equal(await page.getByRole('tooltip').isVisible(),false);await page.getByRole('tooltip').waitFor();assert.equal(await page.getByRole('tooltip').textContent(),'Manage people')
   }
   assert.equal((await(await h.request('/api/record-media?kind=inspection&recordId='+i.id)).json()).files.filter(f=>f.name==='mobile-resume.mp4').length,1)
  }finally{await context.close()}
 }})
 console.log('PORT-009 native resumable media upload and tooltips passed at 1440/390')
}finally{await browser.close()}
