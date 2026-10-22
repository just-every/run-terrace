import assert from 'node:assert/strict'
import {mkdir} from 'node:fs/promises'
import {resolve,join} from 'node:path'
import {chromium} from '@playwright/test'
import {journey} from './rule-packs.mjs'
const out=resolve(process.env.RULE_SCREENSHOTS??'.rer/rule-screens');await mkdir(out,{recursive:true})
const browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']})
try{await journey({assets:true,inspect:async({h,properties,staff,pendingProperty})=>{
 const context=await browser.newContext();await context.addCookies(h.cookie.split('; ').map(pair=>{const i=pair.indexOf('=');return{name:pair.slice(0,i),value:pair.slice(i+1),url:h.origin}}));const page=await context.newPage()
 await page.goto(h.origin+'/app?tab=rules');await page.getByRole('heading',{name:'State and local registry',exact:true}).waitFor()
 assert.equal(await page.getByRole('heading',{name:/Wyoming · WY/}).count(),1);assert.ok(await page.getByText(/CA:san_francisco: no dated pack/).count())
 const form=page.locator('form:has(input[name=command][value="rules.preview"])');await form.getByLabel('Property',{exact:true}).selectOption(properties.TX.id);await form.getByLabel('Action',{exact:true}).selectOption('late_fee');await form.getByLabel('Action day',{exact:true}).fill('2026-10-04');await form.getByText('Late fee',{exact:true}).click()
 for(const [label,value]of [['Monthly rent (USD)','1000'],['Still unpaid (USD)','1000'],['Rent due date','2026-10-01'],['Units in the structure','4']])await form.getByLabel(label,{exact:true}).fill(value)
 for(const [width,height]of [[1440,900],[390,844]]){await page.setViewportSize({width,height});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'rules fit '+width);await page.screenshot({path:join(out,'preview-'+width+'.png'),fullPage:true});await form.screenshot({path:join(out,'preview-form-'+width+'.png')})}
 await form.getByRole('button',{name:'Keep sourced preview',exact:true}).click();await page.waitForURL(u=>u.searchParams.has('notice'))
 const data=await(await context.request.get(h.origin+'/api/rules')).json();assert.ok(data.decisions.some(d=>d.action==='late_fee'&&d.result.calculations[0]?.feeCents===12000))
 for(const [width,height]of [[1440,900],[390,844]]){await page.setViewportSize({width,height});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:join(out,'preview-saved-'+width+'.png'),fullPage:true});await page.locator('article.card').filter({hasText:'Maximum fee $120.00'}).last().screenshot({path:join(out,'late-fee-decision-'+width+'.png')})}
 await context.close()
 const signed=async cookie=>{const c=await browser.newContext();await c.addCookies(cookie.split('; ').map(pair=>{const i=pair.indexOf('=');return{name:pair.slice(0,i),value:pair.slice(i+1),url:h.origin}}));return c}
 const picture=async(page,name)=>{for(const [width,height]of [[1440,900],[390,844]]){await page.setViewportSize({width,height});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),name+' fits '+width);await page.screenshot({path:join(out,name+'-'+width+'.png'),fullPage:true})}}
 const leasing=await signed(staff.leasing),read=await leasing.newPage()
 await read.goto(h.origin+'/app?tab=properties');await read.getByRole('link',{name:'Open state & local rules',exact:true}).click()
 await read.getByRole('heading',{name:'Property pack status',exact:true}).waitFor()
 assert.ok(await read.getByText(/CA:san_francisco: no dated pack/).count());assert.equal(await read.getByRole('heading',{name:'Record a counsel-sourced pack'}).count(),0)
 const ca=read.locator('article').filter({has:read.getByRole('heading',{name:'California · CA',exact:true})});await ca.getByText('Versions and sourced fields',{exact:true}).click();assert.ok(await ca.getByText('Cal. Civ. Code §1950.5(g)',{exact:false}).count())
 await picture(read,'leasing-pack-values-and-held-reasons');await leasing.close()
 const manager=await signed(staff.portfolio_manager),propose=await manager.newPage()
 await propose.goto(h.origin+'/app?tab=rules')
 const proposalForm=propose.locator('form:has(input[name=command][value="property.rules.propose"])')
 await proposalForm.getByLabel('Property',{exact:true}).selectOption(pendingProperty.id);await proposalForm.getByLabel('State',{exact:true}).selectOption('TX');await proposalForm.getByLabel('Current jurisdiction revision (0 when not assigned)',{exact:true}).fill('1');await proposalForm.getByLabel('Source for state and applicable overlay review',{exact:true}).fill('synthetic-terrace-11 native manager proposal')
 await picture(propose,'manager-jurisdiction-proposal');await proposalForm.getByRole('button',{name:'Propose jurisdiction',exact:true}).click();await propose.waitForURL(u=>u.searchParams.has('notice'))
 await propose.getByText('Pending owner confirmation · current assignment unchanged',{exact:true}).waitFor();await picture(propose,'manager-proposal-pending')
 let data=await(await manager.request.get(h.origin+'/api/rules')).json();assert.equal(data.assignments.find(a=>a.property_id===pendingProperty.id).state_code,'CA')
 await manager.close()
 const owner=await signed(h.cookie),confirm=await owner.newPage();await confirm.goto(h.origin+'/app?tab=rules')
 const confirmation=confirm.locator('form:has(input[name=command][value="property.rules.confirm"])');await confirmation.getByLabel('Owner confirmation source',{exact:true}).fill('synthetic-terrace-12 native owner review')
 await picture(confirm,'owner-jurisdiction-confirmation');await confirmation.getByRole('button',{name:'Confirm proposed jurisdiction',exact:true}).click();await confirm.waitForURL(u=>u.searchParams.has('notice'))
 data=await(await owner.request.get(h.origin+'/api/rules')).json();assert.deepEqual([data.assignments.find(a=>a.property_id===pendingProperty.id).state_code,data.assignments.find(a=>a.property_id===pendingProperty.id).version],['TX',2])
 await picture(confirm,'owner-jurisdiction-confirmed');await owner.close()
}})}finally{await browser.close()}
