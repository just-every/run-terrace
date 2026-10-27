import assert from 'node:assert/strict'
import {mkdir} from 'node:fs/promises'
import {join,resolve} from 'node:path'
import {journey} from './conversations.mjs'
export async function conversationBrowser(browser){
 const out=resolve(process.env.CONVERSATION_SCREENSHOTS??'.rer/conversation-screens');await mkdir(out,{recursive:true})
 await journey({assets:true,inspect:async({h,t,managerId})=>{
  const context=await browser.newContext({viewport:{width:1440,height:900}})
  try{
   await context.addCookies(h.cookie.split('; ').map(pair=>{const i=pair.indexOf('=');return{name:pair.slice(0,i),value:pair.slice(i+1),url:h.origin}}))
   const page=await context.newPage();await page.goto(h.origin+'/app?tab=messages&tenancy='+t.id)
   const panel=page.getByRole('region',{name:'Conversation accountability'})
   await panel.getByLabel('Conversation assignee').selectOption(managerId)
   await panel.getByRole('button',{name:'Assign conversation',exact:true}).click();await page.getByRole('status').filter({hasText:'Conversation assigned'}).waitFor()
   await page.getByText('Add a private note',{exact:true}).click();await page.getByLabel('Private staff note',{exact:true}).fill('synthetic-terrace-303 manager will call before entering')
   await page.getByRole('button',{name:'Save private note',exact:true}).click();await page.getByText('Private note: synthetic-terrace-303 manager will call before entering',{exact:true}).waitFor()
   assert.equal(await page.getByText('Assigned to: Alder Manager',{exact:true}).count(),1)
   assert.equal(await panel.getByText(/ · delivered/).count(),1);assert.equal(await panel.getByText(/ · undelivered/).count(),1)
   const control=page.getByRole('link',{name:'Manage people',exact:true});await control.focus();await page.waitForTimeout(30);assert.equal(await control.locator('[role="tooltip"]').evaluate(el=>getComputedStyle(el).opacity),'1');await page.locator('h1').click();await control.hover();await page.waitForTimeout(400);assert.equal(await control.locator('[role="tooltip"]').evaluate(el=>getComputedStyle(el).opacity),'1')
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'conversation screen fits at 1440')
   for(const [width,height]of [[1440,900],[390,844]]){
    await page.setViewportSize({width,height});await page.screenshot({path:join(out,'conversation-'+width+'.png'),fullPage:true})
   }
  }finally{await context.close()}
 }})
}
