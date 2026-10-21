import assert from 'node:assert/strict'
import {mkdir} from 'node:fs/promises'
import {resolve,join} from 'node:path'
import {chromium} from '@playwright/test'
import {journey} from './rule-packs.mjs'
const out=resolve(process.env.RULE_SCREENSHOTS??'.rer/rule-screens');await mkdir(out,{recursive:true})
const browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']})
try{await journey({assets:true,inspect:async({h,properties})=>{
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
}})}finally{await browser.close()}
