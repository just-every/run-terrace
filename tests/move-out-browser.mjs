import {journey as checklistJourney} from './move-checklists.mjs'
// PORT-006: use the ordinary end/transfer forms and inspect their linked tasks at desktop and phone widths.
import assert from 'node:assert/strict'
import {mkdir} from 'node:fs/promises'
import {join,resolve} from 'node:path'
import {chromium} from '@playwright/test'
import {journey} from './move-out.mjs'
const pictures=resolve(process.env.MOVE_OUT_SCREENSHOTS??'.rer/move-out-screens')
await mkdir(pictures,{recursive:true})
const browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']})
let context,page
async function picture(name,section=page) {
 for (const [width,height] of [[1440,900],[390,844]]) {
  await page.setViewportSize({width,height})
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'PORT-006 '+name+' fits '+width)
  await section.screenshot({path:join(pictures,`${name}-${width}.png`),fullPage:true})
 }
}
try {
 await journey({assets:true,inspect:async({phase,h,a,b,rosa,sam,board,source})=>{
  if (!context) {
   context=await browser.newContext({viewport:{width:1440,height:900}})
   await context.addCookies(h.cookie.split('; ').map(pair=>{const i=pair.indexOf('=');return {name:pair.slice(0,i),value:pair.slice(i+1),url:h.origin}}))
   page=await context.newPage()
  }
  await page.goto(h.origin+'/app?tab=properties')
  if (phase==='before-end') {
   const form=page.locator('form:has(input[value="tenancy.end"])').filter({has:page.locator('input[value="'+sam.id+'"]')})
   await form.locator('xpath=..').locator('summary').first().click()
   await form.getByLabel('Move-out date',{exact:true}).fill('2026-11-15')
   await form.getByLabel('Reason',{exact:true}).fill('Moving closer to family')
   await picture('end-lease-form')
   await page.setViewportSize({width:1440,height:900})
   await form.getByRole('button',{name:'End lease',exact:true}).click()
   await page.getByRole('status').filter({hasText:'Make-ready board and dependent tasks opened'}).first().waitFor()
   const created=(await h.state()).turnovers.find(x=>x.unit_id===b.id)
   await picture('ended-with-tasks')
   return {turnoverId:created.id}
  }
  if (phase==='after-end') {
   const link=page.locator('a[href="#turnover-'+board.id+'"]')
   await link.click();assert.ok(await page.locator('#turnover-'+board.id).isVisible())
   await picture('linked-end-tasks')
   const form=page.locator('form:has(input[value="tenancy.transfer"])').filter({has:page.locator('input[value="'+rosa.id+'"]')})
   await form.locator('xpath=..').locator('summary').first().click()
   await form.locator('select[name="unitId"]').selectOption(b.id)
   await form.getByLabel('Move-in date',{exact:true}).fill('2026-11-16')
   await picture('transfer-form')
   await page.setViewportSize({width:390,height:844})
   await form.getByRole('button',{name:'Transfer resident',exact:true}).click()
   await page.getByRole('status').filter({hasText:'Both leases are kept'}).first().waitFor()
   const state=await h.state(),made=state.tenancies.find(t=>t.transferred_from===rosa.id),boardA=state.turnovers.find(x=>x.unit_id===a.id)
   return {id:made.id,turnoverId:boardA.id}
  }
  if (phase==='after-transfer') {
   await page.locator('a[href="#turnover-'+source.id+'"]') .click()
   const tasks=page.locator('#turnover-'+source.id)
   assert.ok(await tasks.isVisible());assert.equal(await tasks.getByRole('button',{name:'Publish available date',exact:true}).isDisabled(),true)
   await picture('transferred-linked-tasks')
   const task=(await h.state()).turnovers.find(x=>x.id===source.id).tasks.find(x=>x.kind==='repair')
   await tasks.getByText('Edit task',{exact:true}).nth(task.position).click()
   const form=tasks.locator('form:has(input[value="turnover.task.update"])').filter({has:page.locator('input[value="'+task.id+'"]')})
   await form.getByLabel('Assignee',{exact:true}).fill('River Property Services')
   await form.getByLabel('Delay (days)',{exact:true}).fill('2')
   await picture('linked-repair-follow-up')
   await form.getByRole('button',{name:'Save task',exact:true}).click()
   await page.getByRole('status').filter({hasText:'Task updated'}).first().waitFor()
   assert.equal((await h.state()).turnovers.find(x=>x.id===source.id).tasks.find(x=>x.id===task.id).assignee,'River Property Services')
   await picture('updated-linked-repair')
  }
 }})
 await context.close();context=null
 await checklistJourney({assets:true,inspect:async({phase,h,lease,payload})=>{
  if(!context){
   context=await browser.newContext({viewport:{width:1440,height:900}})
   await context.addCookies(h.cookie.split('; ').map(pair=>{const i=pair.indexOf('=');return {name:pair.slice(0,i),value:pair.slice(i+1),url:h.origin}}))
   page=await context.newPage()
  }
  await page.goto(h.origin+'/app?tab=tenancy&tenancy='+lease.id+'#move-checklists')
  const section=page.locator('#move-checklists'),out=payload.kind==='move_out',name=out?'move-out':'move-in'
  if(phase.startsWith('before-')){
   await section.getByText('Record '+name+' checklist',{exact:true}).click()
   const form=section.locator('form').filter({has:page.locator('input[name="kind"][value="'+payload.kind+'"]')})
   await form.getByLabel('Handover date',{exact:true}).fill(payload.moveDate)
   for(const [key,label] of [['keys','Keys'],['meters','Meters and readings'],['condition','Condition'],['possession','Possession'],['forwarding','Forwarding address']]){
    await form.getByLabel(label+' status',{exact:true}).selectOption(payload[key+'State'])
    await form.getByLabel(label+' details or reason',{exact:true}).fill(payload[key+'Notes'])
   }
   await form.getByLabel('Handover source reference',{exact:true}).fill(payload.reference)
   await picture(name+'-checklist-form',section)
   await page.setViewportSize({width:390,height:844})
   await form.getByRole('button',{name:'Save handover checklist',exact:true}).click()
   await page.getByRole('status').first().waitFor()
   assert.match(await page.getByRole('status').first().innerText(),/Handover checklist recorded/)
   return true
  }
  if(!out)await section.getByText('Earlier move-in revisions (1)',{exact:true}).click()
  assert.ok(await section.getByRole('definition').filter({hasText:payload.keysNotes}).isVisible())
  await picture(name+'-checklist-saved',section)
 }})
 console.log('PORT-006 native handover revisions, end/transfer, linked tasks and follow-up passed at 1440/390')
}finally {await context?.close();await browser.close()}
