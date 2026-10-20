// WORK-006: native approved dispatch and human escalation at desktop and phone widths.
import assert from 'node:assert/strict'
import {mkdir} from 'node:fs/promises'
import {join,resolve} from 'node:path'
import {chromium} from '@playwright/test'
import {journey} from './dispatch.mjs'
import {installation} from './api/harness.mjs'
const pictures=resolve(process.env.DISPATCH_SCREENSHOTS??'.rer/dispatch-screens')
await mkdir(pictures,{recursive:true})
const browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']})
let context,page
async function picture(name){
 for(const [width,height]of [[1440,900],[390,844]]){
  await page.setViewportSize({width,height})
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'WORK-006 '+name+' fits '+width)
  await page.screenshot({path:join(pictures,`${name}-${width}.png`),fullPage:true})
 }
 await page.setViewportSize({width:1440,height:900})
}
try {
 await journey({assets:true,inspect:async({phase,h,t,j})=>{
  if(!context){
   context=await browser.newContext({viewport:{width:1440,height:900}})
   await context.addCookies(h.cookie.split('; ').map(pair=>{const i=pair.indexOf('=');return {name:pair.slice(0,i),value:pair.slice(i+1),url:h.origin}}))
   page=await context.newPage()
  }
  await page.goto(h.origin+'/app?tab=work&tenancy='+t.id)
  const card=page.locator('article').filter({has:page.getByRole('heading',{name:'Kitchen sink inlet leak',exact:true})})
  await picture(phase)
  if(phase==='approved'){
   await card.getByRole('button',{name:'Dispatch approved work by email',exact:true}).click()
   await page.getByRole('status').filter({hasText:'Email accepted by the mail provider'}).first().waitFor()
   await picture('dispatch-accepted')
  }
  if(phase==='parts-hold'){
   await card.getByLabel('Human escalation, contact evidence and next action',{exact:true}).fill('Called River and Jordan; Bay will attend after fresh approval')
   await card.getByRole('button',{name:'Record human escalation',exact:true}).click()
   await page.getByRole('status').filter({hasText:'Human escalation recorded'}).first().waitFor()
   await picture('escalated')
   return true
  }
  if(phase==='replacement-complete'){
   assert.equal(await card.getByText('completed',{exact:true}).count(),1)
   assert.ok((await card.innerText()).includes('parts needed'))
   assert.ok((await card.innerText()).includes('resident issue'))
   // SAFE-005 inheritance: dispatch snapshots and sourced replies survive a real public restore, with no send replay.
   const archive=await(await h.request('/api/backup')).text(),fresh=await installation()
   try{
    await fresh.formCommand('data.restore',{confirm:'RESTORE',backup:new File([archive],'dispatch.rer')})
    const source=(await h.state(t.id)).work,restored=(await fresh.state(t.id)).work
    assert.deepEqual(restored.dispatches,source.dispatches);assert.deepEqual(restored.dispatchEvents,source.dispatchEvents)
    assert.equal(fresh.messages.filter(m=>m.subject?.startsWith('Approved Terrace work')).length,0)
    await fresh.command('maintenance.dispatch',{jobId:j.id,version:restored.jobs.find(x=>x.id===j.id).version})
    assert.equal(fresh.messages.filter(m=>m.subject?.startsWith('Approved Terrace work')).length,0,'WORK-006 restore cannot resend an accepted dispatch')
   }finally{await fresh.close()}
  }
 }})
 console.log('WORK-006 native dispatch/escalation, snapshots and no-replay restore passed at 1440/390')
}finally{await context?.close();await browser.close()}
