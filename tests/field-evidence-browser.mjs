// WORK-007: native staff evidence submission, original-photo readback and portable snapshot preservation.
import assert from 'node:assert/strict'
import {mkdir} from 'node:fs/promises'
import {join,resolve} from 'node:path'
import {chromium} from '@playwright/test'
import {journey as dispatchJourney} from './dispatch.mjs'
import {journey as fieldJourney} from './field-evidence.mjs'
import {installation} from './api/harness.mjs'
const pictures=resolve(process.env.FIELD_SCREENSHOTS??'.rer/field-evidence-screens')
await mkdir(pictures,{recursive:true})
const browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']})
let context,page
async function picture(name,section) {
 for (const [width,height] of [[1440,900],[390,844]]) {
  await page.setViewportSize({width,height})
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'WORK-007 '+name+' fits '+width)
  await section.screenshot({path:join(pictures,`${name}-${width}.png`)})
 }
}
try {
 await dispatchJourney({assets:true,inspect:async c=>{
  if (c.phase!=='replacement-complete') return
  await fieldJourney({...c,inspect:async({phase,h,t,j,payload,saved})=>{
   if (!context) {
    context=await browser.newContext({viewport:{width:1440,height:900}})
    await context.addCookies(h.cookie.split('; ').map(pair=>{const i=pair.indexOf('=');return {name:pair.slice(0,i),value:pair.slice(i+1),url:h.origin}}))
    page=await context.newPage()
   }
   await page.goto(h.origin+'/app?tab=work&tenancy='+t.id)
   const card=page.locator('article').filter({has:page.getByRole('heading',{name:'Kitchen sink inlet leak',exact:true})}),section=card.locator('section.completion')
   if (phase==='before-field-report') {
    await section.getByText('Record the vendor’s completion',{exact:true}).click()
    const form=section.locator('form:has(input[value="completion.record"])')
    await form.locator('[name="completedDate"]').fill(payload.completedDate)
    await form.locator('[name="summary"]').fill(payload.summary)
    await form.locator('[name="reference"]').fill(payload.reference)
    await form.getByText('Include technician field evidence',{exact:true}).click()
    await form.locator('[name="fieldEvidence"]').check()
    await form.locator('[name="laborMinutes"]').fill(payload.laborMinutes)
    await form.locator('[name="materials"]').fill(payload.materials)
    await form.locator('[name="accessOutcome"]').selectOption(payload.accessOutcome)
    await form.locator('[name="completedTasks"]').fill(payload.completedTasks)
    await form.locator('[name="beforePhotoId"]').selectOption(payload.beforePhotoId)
    await form.locator('[name="afterPhotoId"]').selectOption(payload.afterPhotoId)
    await picture('field-report-form',section)
    await page.setViewportSize({width:390,height:844})
    await form.getByRole('button',{name:'Record completion',exact:true}).click()
    await page.getByRole('status').filter({hasText:'Vendor’s completion report recorded'}).first().waitFor()
    return true
   }
   await section.getByText('Field evidence · 75 minutes',{exact:true}).click()
   await picture('saved-field-report',section)
   assert.match(await section.innerText(),/awaiting the resident’s check/)
   const after=section.getByRole('link',{name:'inlet-valve-after.png',exact:true})
   assert.equal((await page.request.get(h.origin+await after.getAttribute('href'))).status(),200)
   const archive=await(await h.request('/api/backup')).text(),fresh=await installation()
   try {
    await fresh.formCommand('data.restore',{confirm:'RESTORE',backup:new File([archive],'field-evidence.rer')})
    const restored=(await fresh.state(t.id)).work.attempts.find(x=>x.id===saved.id)
    assert.equal(restored.field_evidence,saved.field_evidence,'WORK-007 retained scope, time, materials, checklist and original-media provenance survive restore')
    for (const p of [payload.beforePhotoId,payload.afterPhotoId]) {
     const original=Buffer.from(await(await h.request('/api/inspections/photos/'+p)).arrayBuffer())
     assert.deepEqual(Buffer.from(await(await fresh.request('/api/inspections/photos/'+p)).arrayBuffer()),original)
    }
    assert.equal(fresh.messages.filter(m=>m.subject?.startsWith('Approved Terrace work')).length,0)
   }finally{await fresh.close()}
  }})
 }})
 console.log('WORK-007 staff field evidence forms and portable scope/media passed at 1440/390')
}finally{await context?.close();await browser.close()}
