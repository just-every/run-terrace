import assert from 'node:assert/strict'
import {mkdir} from 'node:fs/promises'
import {resolve,join} from 'node:path'
import {chromium} from '@playwright/test'
import {journey} from './portal-threads.mjs'
const out=resolve(process.env.THREAD_SCREENSHOTS??'.rer/thread-screens');await mkdir(out,{recursive:true})
const browser=await chromium.launch({headless:true,...(process.env.RER_CHROMIUM_PATH?{executablePath:process.env.RER_CHROMIUM_PATH}:{}),args:['--no-sandbox','--use-mock-keychain','--password-store=basic']})
async function open(r,cookie){const context=await browser.newContext({viewport:{width:1440,height:900}});await context.addCookies(cookie.split('; ').map(pair=>{const at=pair.indexOf('=');return{name:pair.slice(0,at),value:pair.slice(at+1),url:r.origin}}));return{context,page:await context.newPage()}}
async function capture(page,name,staff=false){for(const [width,height]of [[1440,900],[390,844]]){await page.setViewportSize({width,height});if(width===1440)assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),name+' fits '+width)
 if(staff&&width===1440){const control=page.getByRole('link',{name:'Manage people',exact:true});await control.focus();await page.waitForTimeout(30);assert.equal(await control.locator('[role=tooltip]').evaluate(el=>getComputedStyle(el).opacity),'1');await page.locator('h1').click();await control.hover();await page.waitForTimeout(400);assert.equal(await control.locator('[role=tooltip]').evaluate(el=>getComputedStyle(el).opacity),'1')}
 if(staff&&width===390)await page.getByRole('link',{name:'Manage people',exact:true}).focus()
 await page.screenshot({path:join(out,`${name}-${width}.png`),fullPage:true})}await page.setViewportSize({width:1440,height:900})}
try{await journey({assets:true,inspect:async({r,t,cookies,ownerCookie,vendorCookie,threadId,legal,manager,householdCookie})=>{
 const {context,page}=await open(r,r.cookie)
 try{
  await page.goto(r.origin+'/app?tab=messages&tenancy='+t.id)
  await page.setViewportSize({width:1440,height:900})
  await page.getByRole('heading',{name:'Shared conversations',exact:true}).waitFor()
  await page.getByRole('heading',{name:'Building broadcast results',exact:true}).waitFor();assert.ok(await page.getByText(/Resident 1.*Staff-recorded failed/).count()>0)
  await capture(page,'messages-results',true)
  const card=page.locator('article').filter({has:page.getByRole('heading',{name:'Kitchen repair conversation',exact:true})}).first()
  await card.locator('summary').filter({hasText:'Conversation history'}).click()
  assert.ok(await card.getByText(/Revision 0 to 1/).count()>0)
  await capture(page,'messages-history',true)
  await card.locator('summary').filter({hasText:'Conversation history'}).click()
  await card.locator('summary').filter({hasText:'Conversation actions'}).click()
  const assign=card.locator('form').filter({has:page.getByRole('button',{name:'Assign conversation',exact:true})})
  await assign.locator('[name=assignedTo]').selectOption({label:'manager'})
  await assign.locator('[name=deadline]').fill('2026-11-02')
  await capture(page,'messages-assignment',true)
  await assign.getByRole('button',{name:'Assign conversation',exact:true}).click()
  await page.getByRole('status').filter({hasText:'Recorded. No outbound action performed.'}).waitFor()
  const legalCard=page.locator('article').filter({has:page.getByRole('heading',{name:'Exact reviewed informational notice',exact:true})}).first()
  await legalCard.locator('summary').filter({hasText:'Conversation actions'}).click()
  const recovery=legalCard.locator('form').filter({has:page.getByRole('button',{name:'Record reconciliation',exact:true})})
  await recovery.locator('[name=outcome]').selectOption('delivered')
  await recovery.locator('[name=assignedTo]').selectOption(manager)
  await recovery.locator('[name=nextAction]').fill('Receipt reviewed; physical attempt reconciled without retry.')
  await recovery.locator('[name=dueOn]').fill('2026-10-28')
  await recovery.locator('[name=reference]').fill('Synthetic independent witness receipt')
  await recovery.locator('[name=consent]').check()
  await capture(page,'messages-reconciliation',true)
  await recovery.getByRole('button',{name:'Record reconciliation',exact:true}).click()
  await page.getByRole('status').filter({hasText:'Recorded. No outbound action performed.'}).waitFor()
  const reconciled=(await(await r.request('/api/threads?id='+legal.id)).json()).threads[0]
  assert.equal(reconciled.service.outcome,'uncertain');assert.equal(reconciled.reconciliations.at(-1).outcome,'delivered')
  await page.getByText('Prepare a conversation or notice',{exact:true}).click()
  const compose=page.locator('form').filter({has:page.getByRole('button',{name:'Prepare conversation',exact:true})})
  await compose.locator('[name=subject]').fill('Browser reviewed legal notice')
  await compose.locator('[name=kind]').selectOption('legal')
  const residentGrant=(await(await r.request('/api/threads?id='+threadId)).json()).threads[0].grant_id
  await compose.locator('[name=grantId]').selectOption(residentGrant)
  await compose.locator('[name=consentReference]').fill('Synthetic professionally reviewed required service authority')
  await compose.locator('[name=body]').fill('Exact synthetic legal notice terms for review.')
  await compose.locator('[name=deadline]').fill('2026-11-01')
  await compose.locator('[name=file]').setInputFiles({name:'browser-notice.txt',mimeType:'text/plain',buffer:Buffer.from('Synthetic browser notice original')})
  await capture(page,'messages-compose',true)
  await compose.getByRole('button',{name:'Prepare conversation',exact:true}).click()
  await page.getByRole('status').filter({hasText:'Prepared for exact review.'}).waitFor()
  let notice=page.locator('article').filter({has:page.getByRole('heading',{name:'Browser reviewed legal notice',exact:true})}).first()
  await notice.locator('summary').filter({hasText:'Conversation actions'}).click()
  const approval=notice.locator('form').filter({has:page.getByRole('button',{name:'Approve exact message',exact:true})})
  await approval.locator('[name=reference]').fill('Synthetic exact legal approval reference')
  await approval.locator('[name=consent]').check()
  await capture(page,'messages-legal-approval',true)
  await approval.getByRole('button',{name:'Approve exact message',exact:true}).click()
  await page.getByRole('status').filter({hasText:'Recorded. No outbound action performed.'}).waitFor()
  notice=page.locator('article').filter({has:page.getByRole('heading',{name:'Browser reviewed legal notice',exact:true})}).first()
  await notice.locator('summary').filter({hasText:'Conversation actions'}).click()
  const service=notice.locator('form').filter({has:page.getByRole('button',{name:'Record service evidence',exact:true})})
  await service.locator('[name=outcome]').selectOption('failed')
  await service.locator('[name=method]').fill('Staff-recorded physical posting attempt')
  await service.locator('[name=reference]').fill('Synthetic named service witness')
  await service.locator('[name=servedAt]').fill('2026-10-27')
  await service.locator('[name=consent]').check()
  await capture(page,'messages-service-record',true)
  await service.getByRole('button',{name:'Record service evidence',exact:true}).click()
  await page.getByRole('status').filter({hasText:'Recorded. No outbound action performed.'}).waitFor()
  const prepared=(await(await r.request('/api/threads?q=Browser%20reviewed%20legal%20notice')).json()).threads
  assert.equal(prepared.length,1);assert.equal(prepared[0].service.outcome,'failed');assert.equal(prepared[0].reconciliations[0].outcome,'failed')
  assert.equal(prepared[0].entries[0].body,'Exact synthetic legal notice terms for review.');assert.ok(prepared[0].entries[0].sha256)

 }finally{await context.close()}
 const external=await open(r,cookies[0]);try{
  await external.page.goto(r.origin+'/portal/threads')
  await external.page.getByRole('heading',{name:'Kitchen repair conversation',exact:true}).waitFor()
  assert.ok(!(await external.page.content()).includes('PRIVATE STAFF NOTE'))
  assert.equal(await external.page.getByRole('link',{name:'Download private.txt',exact:true}).count(),0)
  await capture(external.page,'resident-conversations')
  const card=external.page.locator('article').filter({has:external.page.getByRole('heading',{name:'Kitchen repair conversation',exact:true})}).first()
  await card.getByRole('button',{name:'Mark read',exact:true}).click()
  await external.page.getByRole('heading',{name:'Kitchen repair conversation',exact:true}).waitFor()
  const response=await r.request('/portal/api/threads?id='+threadId,{as:cookies[0]});assert.equal((await response.json()).threads[0].unread,false)
 }finally{await external.context.close()}
 for(const [cookie,subject,name]of [[ownerCookie,'Owner repair update','owner-conversations'],[vendorCookie,'Vendor repair update','vendor-conversations']]){
  const external=await open(r,cookie);try{
   await external.page.setViewportSize({width:1440,height:900});await external.page.goto(r.origin+'/portal/threads')
   const card=external.page.locator('article').filter({has:external.page.getByRole('heading',{name:subject,exact:true})}).first()
   await card.locator('[name=body]').fill('Synthetic browser reply from '+name)
   await card.locator('[name=consent]').check();await capture(external.page,name)
   await card.getByRole('button',{name:'Send reply',exact:true}).click()
   await external.page.getByText('Synthetic browser reply from '+name,{exact:true}).waitFor()
   const data=(await(await r.request('/portal/api/threads',{as:cookie})).json()).threads
   assert.deepEqual(data.map(x=>x.subject),[subject]);assert.equal(data[0].entries.at(-1).body,'Synthetic browser reply from '+name)
  }finally{await external.context.close()}
 }
 const household=await open(r,householdCookie);try{
  await household.page.setViewportSize({width:1440,height:900});await household.page.goto(r.origin+'/portal/threads')
  await household.page.getByRole('heading',{name:'Household service announcement',exact:true}).waitFor()
  assert.equal(await household.page.getByRole('button',{name:'Send reply',exact:true}).count(),0)
  assert.equal(await household.page.getByRole('heading',{name:'Kitchen repair conversation',exact:true}).count(),0)
  await capture(household.page,'household-notices')
 }finally{await household.context.close()}
 const other=await open(r,cookies[2]);try{await other.page.goto(r.origin+'/portal/threads');assert.equal(await other.page.getByRole('heading',{name:'Water shutoff',exact:true}).count(),0);await capture(other.page,'other-building-conversations')}finally{await other.context.close()}
}});console.log('Shared thread native screens passed at 1440 and 390.')}finally{await browser.close()}
