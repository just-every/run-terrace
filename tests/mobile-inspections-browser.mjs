import assert from 'node:assert/strict'
import {mkdir} from 'node:fs/promises'
import {resolve,join} from 'node:path'
import {chromium} from '@playwright/test'
import {journey,definitions} from './mobile-inspections.mjs'
import {png} from './record-media.mjs'
const dir=resolve(process.env.INSPECTION_SCREENSHOTS??'.rer/mobile-inspection-screens');await mkdir(dir,{recursive:true})
const browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']})
let context,page
async function picture(name){for(const width of [1440,390]){await page.setViewportSize({width,height:900});await page.screenshot({path:join(dir,name+'-'+width+'.png'),fullPage:true});const fits=await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth);if(!fits)console.log(await page.evaluate(()=>[...document.querySelectorAll('main *')].filter(el=>el.getBoundingClientRect().right>innerWidth).slice(0,8).map(el=>({tag:el.tagName,class:el.className,width:el.getBoundingClientRect().width}))));assert.ok(fits,name+' fits '+width)}}
try{
 await journey({assets:true,inspect:async c=>{
  const {h,t,exit}=c
  if(!context){context=await browser.newContext({viewport:{width:390,height:844}});await context.addCookies(h.cookie.split('; ').map(p=>{const i=p.indexOf('=');return{name:p.slice(0,i),value:p.slice(i+1),url:h.origin}}));page=await context.newPage()}
  await page.goto(h.origin+'/app?tab=field&tenancy='+t.id)
  const form=page.locator('form[data-field-capture][data-record="'+exit.id+'"]')
  if(c.phase==='before-exit'){
   await context.setOffline(true)
   for(const key of ['sink','meter','door']){await form.locator('[name="condition:'+key+'"]').selectOption(key==='door'?'good':'damaged');await form.locator('[name="notes:'+key+'"]').fill(key==='meter'?'Cracked meter cover':key==='sink'?'Chip on sink rim':'Door and latch unchanged');await form.locator('[name="reading:'+key+'"]').fill(key==='meter'?'1145':'none')}
   await form.locator('[name="file:sink"]').setInputFiles({name:'offline-exit-sink.png',mimeType:'image/png',buffer:Buffer.concat([png,Buffer.from('mobile exit original')])})
   await form.locator('[name=source]').fill('Original offline phone inspection with resident')
   await form.getByRole('button',{name:'Save offline draft on this device'}).click();await form.getByRole('status').filter({hasText:'Explicitly consent'}).waitFor()
   await form.locator('[name=deviceConsent]').check();await form.getByRole('button',{name:'Save offline draft on this device'}).click();await form.getByRole('status').filter({hasText:'Saved offline'}).waitFor();await picture('offline-capture')
   await h.command('inspection.configure',{inspectionId:exit.id,version:3,kind:'move_out',entryId:c.i.id,checklist:[...definitions,{key:'door',room:'Entry',asset:'Door'},{key:'window',room:'Kitchen',asset:'Window'}]})
   await context.setOffline(false);await page.reload();await form.getByRole('status').filter({hasText:'recovered'}).waitFor();await form.getByRole('button',{name:'Sync findings for review'}).click();await form.getByRole('heading',{name:'Scope changed — reconcile before submitting'}).waitFor();assert.equal((await h.state(t.id)).work.captures.filter(f=>f.inspection_id===exit.id).length,0);await picture('scope-conflict')
   await form.getByRole('button',{name:'Review current scope and reconcile draft'}).click();await form.locator('[name="notes:window"]').fill('Window unchanged after review');await form.locator('[name="reading:window"]').fill('none');await form.locator('[name="condition:window"]').selectOption('good');await form.getByRole('button',{name:'Sync findings for review'}).click();await page.getByRole('heading',{name:'Entry and exit comparison'}).first().waitFor()
   const state=(await h.state(t.id)).work,capture=state.captures.find(f=>f.inspection_id===exit.id);assert.ok(capture);assert.ok(capture.device_consent_at);assert.ok(capture.reconciliation.includes('previousValues'));assert.equal(JSON.parse(capture.items).find(x=>x.key==='sink').media.length,1,'offline original file survived reload and sync')
   assert.equal(await page.evaluate(()=>new Promise((resolve,reject)=>{const r=indexedDB.open('TerraceFieldDrafts',1);r.onsuccess=()=>{const q=r.result.transaction('drafts').objectStore('drafts').count();q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error)}})),0,'successful sync deletes the private draft')
  }else{
   await page.getByText('Capture history (1)',{exact:true}).first().click();await picture('comparison-and-retained-dispute');await page.getByRole('link',{name:'Manage people'}).focus();await page.getByRole('tooltip',{name:'Manage people'}).waitFor();assert.ok((await page.locator('#mobile-inspections').textContent()).includes('Meter cover was cracked before move-in'));assert.ok((await page.locator('#mobile-inspections').textContent()).includes('No entry/exit media supports this deduction'))
  }
 }})
 console.log('WORK-011 offline originals, persisted drafts, manual scope reconciliation and disputed comparison passed at 1440/390')
}finally{await context?.close();await browser.close()}
