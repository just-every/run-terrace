import assert from 'node:assert/strict'
import {mkdir} from 'node:fs/promises'
import {resolve,join} from 'node:path'
import {chromium} from '@playwright/test'
import {journey} from './portal-threads.mjs'
const out=resolve(process.env.THREAD_SCREENSHOTS??'.rer/thread-screens');await mkdir(out,{recursive:true})
const browser=await chromium.launch({headless:true,...(process.env.RER_CHROMIUM_PATH?{executablePath:process.env.RER_CHROMIUM_PATH}:{}),args:['--no-sandbox','--use-mock-keychain','--password-store=basic']})
async function open(r,cookie){const context=await browser.newContext();await context.addCookies(cookie.split('; ').map(pair=>{const at=pair.indexOf('=');return{name:pair.slice(0,at),value:pair.slice(at+1),url:r.origin}}));return{context,page:await context.newPage()}}
async function capture(page,name,staff=false){for(const [width,height]of [[1440,900],[390,844]]){await page.setViewportSize({width,height});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),name+' fits '+width)
 if(staff){const control=page.getByRole('link',{name:'Manage people',exact:true});await control.focus();await page.waitForTimeout(30);assert.equal(await control.locator('[role=tooltip]').evaluate(el=>getComputedStyle(el).opacity),'1');await page.locator('h1').click();await control.hover();await page.waitForTimeout(400);assert.equal(await control.locator('[role=tooltip]').evaluate(el=>getComputedStyle(el).opacity),'1')}
 await page.screenshot({path:join(out,`${name}-${width}.png`),fullPage:true})}}
try{await journey({assets:true,inspect:async({r,t,cookies,threadId})=>{
 const {context,page}=await open(r,r.cookie)
 try{
  await page.goto(r.origin+'/app?tab=messages&tenancy='+t.id)
  await page.getByRole('heading',{name:'Shared conversations',exact:true}).waitFor()
  await page.getByRole('heading',{name:'Building broadcast results',exact:true}).waitFor();assert.ok(await page.getByText(/Resident 1.*Staff-recorded failed/).count()>0)
  await capture(page,'messages-results',true)
  const card=page.locator('article').filter({has:page.getByRole('heading',{name:'Kitchen repair conversation',exact:true})}).first()
  await card.locator('summary').filter({hasText:'Conversation actions'}).click()
  const assign=card.locator('form').filter({has:page.getByRole('button',{name:'Assign conversation',exact:true})})
  await assign.locator('[name=assignedTo]').selectOption({label:'manager'})
  await assign.locator('[name=deadline]').fill('2026-11-02')
  await capture(page,'messages-assignment',true)
  await assign.getByRole('button',{name:'Assign conversation',exact:true}).click()
  await page.getByRole('status').filter({hasText:'Recorded. No outbound action performed.'}).waitFor()
  await page.getByText('Prepare a conversation or notice',{exact:true}).click()
  await capture(page,'messages-compose',true)
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
 const other=await open(r,cookies[2]);try{await other.page.goto(r.origin+'/portal/threads');assert.equal(await other.page.getByRole('heading',{name:'Water shutoff',exact:true}).count(),0);await capture(other.page,'other-building-conversations')}finally{await other.context.close()}
}});console.log('Shared thread native screens passed at 1440 and 390.')}finally{await browser.close()}
