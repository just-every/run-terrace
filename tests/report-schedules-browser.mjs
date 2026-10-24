import assert from 'node:assert/strict'
import {mkdir} from 'node:fs/promises'
import {resolve,join} from 'node:path'
import {chromium} from '@playwright/test'
import {journey} from './report-schedules.mjs'
const out=resolve(process.env.REPORT_SCHEDULE_SCREENSHOTS||'.rer/report-schedule-screens');await mkdir(out,{recursive:true})
const browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']})
try{await journey({assets:true,inspect:async({h,base,native,person})=>{
 const context=await browser.newContext();await context.addCookies(h.cookie.split('; ').map(pair=>{const i=pair.indexOf('=');return{name:pair.slice(0,i),value:pair.slice(i+1),url:h.origin}}));const page=await context.newPage()
 await page.goto(h.origin+'/app?tab=report-schedules')
 for(const [width,height]of [[1440,900],[390,844]]){
  await page.setViewportSize({width,height});await page.getByRole('heading',{name:'Generation receipts',exact:true}).waitFor();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth))
  const person=page.getByRole('link',{name:'Manage people',exact:true}),tip=page.getByRole('tooltip',{name:'Manage people',exact:true});await person.hover();await page.waitForTimeout(350);await tip.waitFor({state:'visible'});await page.screenshot({path:join(out,'schedules-hover-'+width+'.png'),fullPage:true});await page.mouse.move(0,0);await person.focus();await tip.waitFor({state:'visible'});await page.screenshot({path:join(out,'schedules-focus-'+width+'.png')})
 }
 const form=page.locator('form:has(input[name=command][value="report.schedule"])')
 await form.getByLabel('Schedule name',{exact:true}).fill('Native rent roll generation');await form.getByLabel('Report',{exact:true}).selectOption('rent_roll');await form.getByLabel('IANA time zone',{exact:true}).fill(base.zone);await form.getByLabel('Local day of month',{exact:true}).fill('28');await form.getByLabel('Schedule source',{exact:true}).fill('synthetic-terrace-5 native review');await form.getByLabel('Type GENERATE ONLY to consent',{exact:true}).fill('GENERATE ONLY');await form.getByRole('button',{name:'Save generation schedule',exact:true}).click();await page.getByText('Monthly report generation scheduled. No recipient or outbound delivery has been authorized.',{exact:true}).waitFor()
 for(const [width,height]of [[1440,900],[390,844]]){await page.setViewportSize({width,height});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:join(out,'schedule-saved-'+width+'.png'),fullPage:true})}
 const card=page.locator('article').filter({has:page.getByRole('heading',{name:person.email,exact:true})})
 await card.getByLabel('Send authorization reference',{exact:true}).fill('synthetic-terrace-19 native send')
 await card.getByLabel('Type SEND LINK to approve',{exact:true}).fill('SEND LINK')
 await card.getByRole('button',{name:'Send private report link',exact:true}).click()
 await page.getByText('Provider accepted the link; mailbox delivery is not confirmed',{exact:true}).waitFor()
 for(const [width,height]of [[1440,900],[390,844]]){await page.setViewportSize({width,height});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:join(out,'delivery-accepted-'+width+'.png'),fullPage:true})}
 const portal=await browser.newContext();await portal.addCookies(person.cookie.split('; ').map(pair=>{const i=pair.indexOf('=');return{name:pair.slice(0,i),value:pair.slice(i+1),url:h.origin}}));const report=await portal.newPage()
 await report.goto(h.origin+'/portal/report?id='+native.id);await report.getByRole('heading',{name:'Statement',exact:true}).waitFor()
 for(const [width,height]of [[1440,900],[390,844]]){await report.setViewportSize({width,height});assert.ok(await report.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await report.screenshot({path:join(out,'owner-statement-'+width+'.png'),fullPage:true})}
 await card.getByLabel('Provider outcome',{exact:true}).selectOption('bounced');await card.getByLabel('Provider evidence reference',{exact:true}).fill('synthetic-terrace-20 native provider bounce');await card.getByRole('button',{name:'Record provider outcome',exact:true}).click();await page.getByText('Bounce recorded. Failed-delivery task opened.',{exact:true}).waitFor()
 for(const [width,height]of [[1440,900],[390,844]]){await page.setViewportSize({width,height});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:join(out,'delivery-bounced-'+width+'.png'),fullPage:true})}
 assert.equal((await report.goto(h.origin+'/portal/report?id='+native.id)).status(),404)
 await portal.close()
 await context.close()
}})}finally{await browser.close()}
