import assert from 'node:assert/strict'
import {mkdir} from 'node:fs/promises'
import {resolve,join} from 'node:path'
import {chromium} from '@playwright/test'
import {journey,diagnostics,readiness} from './integration-health.mjs'
process.env.TERRACE_ASYNC_SQL='1'
const out=resolve(process.env.INTEGRATION_SCREENSHOTS??'.rer/integration-screens');await mkdir(out,{recursive:true})
const browser=await chromium.launch({headless:true,...(process.env.RER_CHROMIUM_PATH?{executablePath:process.env.RER_CHROMIUM_PATH}:{}),args:['--no-sandbox','--use-mock-keychain','--password-store=basic']})
try{
 await journey({assets:true,inspect:async({h,phase})=>{
  const context=await browser.newContext({viewport:{width:1440,height:900}})
  try{
   await context.addCookies(h.cookie.split('; ').map(pair=>{const i=pair.indexOf('=');return{name:pair.slice(0,i),value:pair.slice(i+1),url:h.origin}}))
   const page=await context.newPage();await page.goto(h.origin+'/app?tab=settings')
   const section=page.locator('#integration-diagnostics');await section.getByRole('heading',{name:'Integration diagnostics',exact:true}).waitFor()
   const setup=page.locator('#setup-readiness'),ready=await readiness(h)
   await setup.getByRole('heading',{name:'Setup readiness',exact:true}).waitFor()
   assert.equal(await setup.locator('form,button,input,select').count(),0,'readiness offers no configuration or activation controls')
   assert.ok((await setup.innerText()).includes('Authority and activation readiness remain unverified'))
   for(const limit of ready.limits)assert.ok((await setup.locator('[data-limit="'+limit.id+'"]').innerText()).includes(limit.maxBytes.toLocaleString('en-US')+' bytes'),'native limit matches the public endpoint: '+limit.id)
   for(const target of ready.capacity.targets)assert.ok((await setup.locator('[data-capacity="'+target.id+'"]').innerText()).includes('Measured: unavailable'),'target bounds do not acquire fabricated results')
   assert.ok((await setup.innerText()).includes('Storage and external fees are unknown'))
   assert.ok((await setup.innerText()).includes('Agreement and authority: unverified'))
   await setup.getByText('Provider requirements and gaps',{exact:true}).click()
   assert.equal(await setup.locator('[data-dependency]').first().isVisible(),false,'owner can condense the requirements')
   await setup.getByText('Provider requirements and gaps',{exact:true}).press('Enter')
   assert.equal(await setup.locator('[data-dependency]').first().isVisible(),true,'keyboard opens required setup disclosures')
   if(phase==='diagnostics'){
    const stripe=section.locator('article').filter({has:page.getByRole('heading',{name:'Stripe',exact:true})})
    assert.ok((await stripe.innerText()).includes('Older than 24 hours'));assert.ok((await stripe.innerText()).includes('outbound requests 6'))
    await stripe.getByText('Edit Stripe setup metadata',{exact:true}).click()
    await stripe.locator('[name=centsPerThousand]').fill('425')
    await stripe.getByRole('button',{name:'Save integration metadata',exact:true}).click()
    await page.getByRole('status').filter({hasText:'Integration metadata saved'}).waitFor()
    assert.equal((await diagnostics(h)).providers.find(p=>p.provider==='stripe').metadata.cents_per_thousand,425,'native form saves dated estimate without provider validation')
    await page.reload();assert.ok((await section.innerText()).includes('$4.25 per thousand'))
   }else{
    assert.ok((await section.innerText()).includes('Restored evidence retained'))
    assert.ok((await section.innerText()).includes('No successful exchange in this installation'))
   }
   const people=page.getByRole('link',{name:'Manage people',exact:true});await people.focus()
   assert.equal(await people.locator('[role=tooltip]').evaluate(el=>getComputedStyle(el).visibility),'visible')
   await page.locator('h1').click();await people.hover();await page.waitForTimeout(400)
   assert.equal(await people.locator('[role=tooltip]').evaluate(el=>getComputedStyle(el).visibility),'visible')
   const small=await section.evaluate(root=>[...root.querySelectorAll('p,label,button,input,select,li,dt,dd,summary')].filter(el=>el.getClientRects().length&&parseFloat(getComputedStyle(el).fontSize)<13).map(el=>el.tagName))
   assert.deepEqual(small,[],'diagnostics text is at least 13px')
   assert.deepEqual(await setup.evaluate(root=>[...root.querySelectorAll('p,li,dt,dd,summary,a')].filter(el=>el.getClientRects().length&&parseFloat(getComputedStyle(el).fontSize)<13).map(el=>el.tagName)),[],'setup disclosures are readable at native font sizes')
   const reconnect=section.getByText('Stripe reconnect information',{exact:true});await reconnect.click()
   for(const [width,height]of [[1440,900],[390,844]]){
    await page.setViewportSize({width,height})
    if(width===1440)assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'diagnostics fit the desktop screen')
    await section.screenshot({path:join(out,phase+'-'+width+'.png')})
    await setup.screenshot({path:join(out,phase+'-readiness-'+width+'.png')})
   }
  }finally{await context.close()}
 }})
 console.log('PROBE SAFE-008 native use: owner Settings disclosures and keyboard summaries passed at 1440; native diagnostics and setup proof captured at 1440 and 390.')
}finally{await browser.close()}
