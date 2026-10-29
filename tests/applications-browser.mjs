import assert from 'node:assert/strict'
import {mkdir} from 'node:fs/promises'
import {resolve,join} from 'node:path'
import {chromium} from '@playwright/test'
import {journey,applicationSetup,activateApplicationPack,applicantCookie,ownData,applicantEmail} from './applications.mjs'
import {installation} from './api/harness.mjs'
const out=resolve(process.env.APPLICATION_SCREENSHOTS??'.rer/application-screens');await mkdir(out,{recursive:true})
const browser=await chromium.launch({headless:true,...(process.env.RER_CHROMIUM_PATH?{executablePath:process.env.RER_CHROMIUM_PATH}:{}),args:['--no-sandbox','--use-mock-keychain','--password-store=basic']})
async function open(h,cookie){const context=await browser.newContext({viewport:{width:1440,height:900}});await context.addCookies(cookie.split('; ').map(x=>{const i=x.indexOf('=');return{name:x.slice(0,i),value:x.slice(i+1),url:h.origin}}));return{context,page:await context.newPage()}}
async function capture(page,name,staff=false){for(const[width,height]of [[1440,900],[390,844]]){
 await page.setViewportSize({width,height})
 if(width===1440){assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),name+' fits');assert.ok(await page.locator('main').isVisible());const small=await page.locator('main').evaluate(root=>[...root.querySelectorAll('p,label,button,input,textarea,a,li,dt,dd')].filter(el=>el.getClientRects().length&&parseFloat(getComputedStyle(el).fontSize)<13).map(el=>el.tagName));assert.deepEqual(small,[],name+' uses readable text')}
 if(staff&&width===1440){const control=page.getByRole('link',{name:'Manage people',exact:true});await control.focus();await page.waitForTimeout(30);assert.equal(await control.locator('[role=tooltip]').evaluate(el=>getComputedStyle(el).opacity),'1');await page.locator('h1').click();await control.hover();await page.waitForTimeout(400);assert.equal(await control.locator('[role=tooltip]').evaluate(el=>getComputedStyle(el).opacity),'1')}
 await page.screenshot({path:join(out,`${name}-${width}.png`),fullPage:true})
}await page.setViewportSize({width:1440,height:900})}
try{
 // Form interaction assertions use one desktop width. The phone render is release proof.
 const h=await installation({assets:true,now:'2026-10-28T12:00:00.000Z'})
 try{
  const {property,open:input}=await applicationSetup(h);await activateApplicationPack(h,property)
  const app=await h.command('application.open',input),a=await applicantCookie(h,app,app.adults[0],1)
  const {context,page}=await open(h,a.cookie)
  try{
   await page.goto(h.origin+'/apply')
   await page.getByRole('heading',{name:'Your answers',exact:true}).waitFor()
   const form=page.locator('form').filter({has:page.getByRole('button',{name:'Save progress',exact:true})})
   await form.locator('[name=identity]').fill('Synthetic browser adult and contact reference')
   await form.locator('[name=income]').fill('Synthetic browser monthly income 5200 USD')
   await form.locator('[name=rentalHistory]').fill('Synthetic browser prior rental and manager reference')
   await form.locator('[name=references]').fill('Synthetic browser reference and consent')
   await capture(page,'application-draft')
   await form.getByRole('button',{name:'Save progress',exact:true}).click()
   await page.getByRole('heading',{name:'Your answers',exact:true}).waitFor()
   await page.reload();assert.equal(await page.locator('[name=income]').inputValue(),'Synthetic browser monthly income 5200 USD')
   const upload=page.locator('form').filter({has:page.getByRole('button',{name:'Upload original',exact:true})})
   await upload.locator('[name=file]').setInputFiles({name:'income.txt',mimeType:'text/plain',buffer:Buffer.from('Synthetic browser income evidence')})
   await upload.getByRole('button',{name:'Upload original',exact:true}).click()
   await page.getByRole('link',{name:'income.txt',exact:true}).waitFor()
   await page.locator('[name=consent][value="SUBMIT MY ANSWERS"]').check()
   await page.getByRole('button',{name:'Submit my application',exact:true}).click()
   await page.getByRole('heading',{name:'Submitted answers',exact:true}).waitFor()
   assert.equal((await ownData(h,a.cookie)).applicant.state,'submitted')
   await capture(page,'application-submitted')
  }finally{await context.close()}
 }finally{await h.close()}
 await journey({assets:true,inspect:async({h,a,staff,incomeReview})=>{
  const applicant=await open(h,a.cookie),manager=await open(h,staff.manager)
  try{
   await applicant.page.goto(h.origin+'/apply')
   await applicant.page.getByRole('heading',{name:'Submitted answers',exact:true}).waitFor()
   await applicant.page.getByText('Corrected employer income: 5400 USD monthly',{exact:true}).first().waitFor()
   const history=applicant.page.locator('details').filter({has:applicant.page.getByText(/^Revision 5 · submitted/)});await history.locator('summary').click()
   assert.ok(await history.getByText('Synthetic employer, 5200 USD monthly, verified by attached evidence',{exact:true}).count())
   await capture(applicant.page,'application-revision-history')
   await manager.page.goto(h.origin+'/app?tab=applications')
   await manager.page.getByRole('heading',{name:'Online applications',exact:true}).waitFor()
   await manager.page.getByRole('button',{name:'Request document',exact:true}).first().waitFor()
   const adult=manager.page.locator('article').filter({has:manager.page.getByRole('heading',{name:/Synthetic adult A · submitted/})}).last()
   await adult.locator('details').getByText('Revisions for Synthetic adult A',{exact:true}).click()
   assert.ok(await manager.page.getByText('Corrected employer income: 5400 USD monthly',{exact:true}).count())
   assert.ok(await manager.page.getByText('paid',{exact:true}).count())
   await capture(manager.page,'application-manager',true)
   const input=incomeReview.input,page=manager.page
   await page.locator('[name=firstSource]').selectOption(input.firstAdultId)
   await page.locator('[name=secondSource]').selectOption(input.secondAdultId)
   await page.getByRole('button',{name:'Select submitted sources',exact:true}).click()
   await page.getByRole('button',{name:'Recompute income review',exact:true}).waitFor()
   const reviewForm=page.locator('form[action="/app/application-review"]')
   for(const name of ['multiple','criterionReference','firstRent','firstIncome','firstVerification','firstVerifiedOn','firstVerificationReference','secondRent','secondIncome','secondVerification','secondVerifiedOn','secondVerificationReference'])await reviewForm.locator('[name='+name+']').fill(String(input[name]))
   await reviewForm.locator('[name=firstEvidenceState]').selectOption('verified')
   await reviewForm.locator('[name=secondEvidenceState]').selectOption('verified')
   await reviewForm.locator('[name=disclosed]').check()
   await reviewForm.getByRole('button',{name:'Recompute income review',exact:true}).click()
   const results=page.getByRole('region',{name:'Computed income review',exact:true})
   await results.getByRole('heading',{name:'Synthetic adult A: Meets income criterion',exact:true}).waitFor()
   await results.getByRole('heading',{name:'Synthetic review adult: Below income criterion',exact:true}).waitFor()
   assert.ok((await results.textContent()).includes('300003100001 ÷ 1000000'))
   assert.ok((await results.textContent()).includes('I VERIFIED INCOME'))
   await results.getByText('Submitted original fingerprints',{exact:true}).first().click()
   assert.ok((await results.textContent()).includes(input.firstFileHash))
   await capture(page,'income-review-computed',true)
   await page.locator('[name=firstIncome]').fill('3000.03')
   await page.locator('[name=disclosed]').check()
   await page.getByRole('button',{name:'Recompute income review',exact:true}).click()
   await results.getByRole('heading',{name:'Synthetic adult A: Below income criterion',exact:true}).waitFor()
   await page.locator('[name=firstEvidenceState]').selectOption('contested')
   await page.locator('[name=disclosed]').check()
   await page.getByRole('button',{name:'Recompute income review',exact:true}).click()
   await results.getByRole('heading',{name:'Synthetic adult A: Held',exact:true}).waitFor()
   assert.ok((await results.textContent()).includes('Contested evidence: authorized human review required'))
   await capture(page,'income-review-held',true)
   await h.command('application.request',{applicationId:input.secondApplicationId,adultId:input.secondAdultId,version:input.secondVersion,message:'Synthetic changed browser source'})
   await page.locator('[name=disclosed]').check()
   await page.getByRole('button',{name:'Recompute income review',exact:true}).click()
   await page.getByText('Reload and select the current submitted revision before recomputing.',{exact:true}).waitFor()
   assert.equal(await page.getByRole('region',{name:'Computed income review',exact:true}).count(),0,'stale native submission returns no computed result')
  }finally{await applicant.context.close();await manager.context.close()}
 }})
 console.log('Application forms, submitted revisions and safe fee outcomes passed; desktop and phone proof captured.')
}finally{await browser.close()}
