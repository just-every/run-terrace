import assert from 'node:assert/strict'
import {mkdir} from 'node:fs/promises'
import {resolve,join} from 'node:path'
import {chromium} from '@playwright/test'
import {journey} from './listings.mjs'
const out=resolve(process.env.LISTING_SCREENSHOTS??'.rer/listing-screens')
await mkdir(out,{recursive:true})
const browser=await chromium.launch({headless:true,...(process.env.RER_CHROMIUM_PATH?{executablePath:process.env.RER_CHROMIUM_PATH}:{}),args:['--no-sandbox','--use-mock-keychain','--password-store=basic']})
try {
 await journey({assets:true,inspect:async({h,b})=>{
  const owner=await browser.newContext({viewport:{width:1440,height:1000}}),visitor=await browser.newContext({viewport:{width:390,height:844}})
  try {
   await owner.addCookies(h.cookie.split('; ').map(pair=>{const at=pair.indexOf('=');return{name:pair.slice(0,at),value:pair.slice(at+1),url:h.origin}}))
   const page=await owner.newPage()
   await page.goto(h.origin+'/app?tab=prospects')
   await page.getByRole('link',{name:'Manage vacancy listings',exact:true}).click()
   await page.getByRole('heading',{name:'Vacancy listings',exact:true}).waitFor()
   const card=page.locator('[data-listing-id="'+b.id+'"]')
   await card.getByText('Revise listing',{exact:true}).click()
   await card.getByLabel('Monthly rent in USD',{exact:true}).fill('2520.17')
   await card.getByLabel('Listing title',{exact:true}).fill('Owner-reviewed courtyard home')
   await card.getByRole('button',{name:'Save frozen draft',exact:true}).click()
   await card.getByRole('button',{name:'Preview exact draft',exact:true}).click()
   const preview=page.getByRole('region',{name:'Exact listing preview',exact:true})
   await preview.waitFor()
   assert.ok((await preview.innerText()).includes('$2,520.17'))
   await preview.getByRole('checkbox').check()
   await preview.getByRole('button',{name:'Publish exact listing',exact:true}).click()
   await card.getByText('Published on own site',{exact:false}).waitFor()
   const person=page.getByRole('link',{name:'Manage people',exact:true})
   await person.focus();assert.equal(await person.locator('[role=tooltip]').evaluate(el=>getComputedStyle(el).opacity),'1')
   await page.getByRole('heading',{name:'Vacancy listings',exact:true}).click();await person.hover();await page.waitForTimeout(400)
   assert.equal(await person.locator('[role=tooltip]').evaluate(el=>getComputedStyle(el).opacity),'1')
   for(const [width,height]of [[1440,1000],[390,844]]){
    await page.setViewportSize({width,height})
    await page.screenshot({path:join(out,'owner-listings-'+width+'.png'),fullPage:true})
   }
   // The visitor's first enquiry is submitted through the mobile form.
   const phone=await visitor.newPage()
   await phone.goto(h.origin+'/vacancies/'+b.id)
   assert.ok((await phone.locator('main').innerText()).includes('$2,520.17'))
   await phone.getByLabel('Your name',{exact:true}).fill('Synthetic mobile visitor')
   await phone.getByLabel('Email',{exact:true}).fill(['synthetic-terrace-4','example.test'].join('@'))
   for(const [label,value]of [['email','granted'],['phone','refused'],['text','refused']])await phone.getByLabel('Consent to '+label+' contact',{exact:true}).selectOption(value)
   assert.ok(await phone.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'mobile form fits')
   await phone.screenshot({path:join(out,'visitor-enquiry-390.png'),fullPage:true})
   await phone.getByRole('button',{name:'Send enquiry for review',exact:true}).click()
   await phone.getByRole('heading',{name:'Enquiry received',exact:true}).waitFor()
   assert.ok((await phone.getByRole('status').innerText()).includes('staff review'))
   const prospects=(await(await h.request('/api/prospects')).json()).prospects
   const mobile=prospects.find(x=>x.name==='Synthetic mobile visitor')
   assert.equal(mobile.first_source,'own_site');assert.equal(mobile.consent.email.state,'granted')
   await phone.screenshot({path:join(out,'visitor-receipt-390.png'),fullPage:true})
   await phone.goto(h.origin+'/vacancies/'+b.id)
   await phone.setViewportSize({width:1440,height:1000})
   await phone.screenshot({path:join(out,'visitor-enquiry-1440.png'),fullPage:true})
   await page.setViewportSize({width:1440,height:1000})
   await card.getByRole('button',{name:'Withdraw listing',exact:true}).click()
   await card.getByText('Unpublished',{exact:false}).waitFor()
   assert.equal((await h.request('/vacancies/'+b.id,{as:''})).status,404)
   // Republish under a fresh explicit preview so the shared journey can verify A-only occupancy suppression.
   await card.getByRole('button',{name:'Preview exact draft',exact:true}).click()
   await preview.getByRole('checkbox').check()
   await preview.getByRole('button',{name:'Publish exact listing',exact:true}).click()
   await card.getByText('Published on own site',{exact:false}).waitFor()
   console.log('PROBE LEASE-001 mobile enquiry: 390px public form -> unverified own-site prospect and generic receipt; owner preview, publish and withdraw at 1440; both screens captured at 1440 and 390')
  }finally{await owner.close();await visitor.close()}
 }})
}finally{await browser.close()}
