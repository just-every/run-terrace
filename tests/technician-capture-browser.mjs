import assert from 'node:assert/strict'
import {mkdir} from 'node:fs/promises'
import {resolve,join} from 'node:path'
import {chromium} from '@playwright/test'
import {journey} from './technician-capture.mjs'
import {png} from './record-media.mjs'
const dir=resolve(process.env.TECHNICIAN_SCREENSHOTS??'.rer/technician-capture-screens');await mkdir(dir,{recursive:true})
const browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']})
let context,page
async function picture(name){for(const width of [1440,390]){await page.setViewportSize({width,height:900});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),name+' fits '+width);await page.screenshot({path:join(dir,name+'-'+width+'.png'),fullPage:true})}}
try{
 await journey({assets:true,inspect:async c=>{
  const {h,t,j,technician}=c
  if(!context){context=await browser.newContext({viewport:{width:390,height:844}});await context.addCookies(technician.split('; ').map(p=>{const i=p.indexOf('=');return{name:p.slice(0,i),value:p.slice(i+1),url:h.origin}}));page=await context.newPage()}
  if(c.phase==='before-scope-change'){
   await page.goto(h.origin+'/app?tab=technician&tenancy='+t.id);const form=page.locator('form[data-field-capture][data-record="'+j.id+'"]')
   await context.setOffline(true)
   for(const key of ['completedDate','laborMinutes','materials','summary','reference','completedTasks'])await form.locator('[name="'+key+'"]').fill(c.payload[key])
   await form.locator('[name=beforeFile]').setInputFiles({name:'before-valve.png',mimeType:'image/png',buffer:png});await form.locator('[name=afterFile]').setInputFiles({name:'after-valve.mp4',mimeType:'video/mp4',buffer:c.video})
   await form.locator('[name=deviceConsent]').check();await form.getByRole('button',{name:'Save offline draft on this device'}).click();await form.getByRole('status').filter({hasText:'Saved offline'}).waitFor();await picture('technician-offline-draft')
   await c.changeScope();await context.setOffline(false);await page.reload();await form.getByRole('status').filter({hasText:'recovered'}).waitFor();await form.getByRole('button',{name:'Submit direct field report'}).click();await form.getByRole('heading',{name:'Scope changed — reconcile before submitting'}).waitFor();assert.equal((await h.state(t.id)).work.attempts.filter(a=>a.job_id===j.id).length,0);await picture('technician-scope-conflict')
   await form.getByRole('button',{name:'Review current scope and reconcile draft'}).click();await form.locator('[name=completedTasks]').fill(c.revised.join('\n'));await form.getByRole('button',{name:'Submit direct field report'}).click();await page.getByText('No handed-off work is waiting for a direct field report.',{exact:true}).waitFor()
  }else{
   await page.goto(h.origin+'/app?tab=work&tenancy='+t.id);await page.getByText('Field evidence · 75 minutes',{exact:true}).click();await picture('technician-submission-awaiting-resident')
   assert.ok((await page.locator('main').textContent()).includes('Direct field report by signed-in Jordan Field Technician'));assert.ok((await page.locator('main').textContent()).includes('awaiting the resident'))
   const file=page.getByRole('link',{name:'after-valve.mp4',exact:true});assert.equal((await page.request.get(h.origin+await file.getAttribute('href'))).status(),200)
   await page.getByRole('link',{name:'Manage people'}).focus();await page.getByRole('tooltip',{name:'Manage people'}).waitFor();await picture('technician-tooltip')
  }
 }})
 console.log('WORK-007 direct offline time/photos/video, retained files, scope reconciliation and human-review submission passed at 1440/390')
}finally{await context?.close();await browser.close()}
