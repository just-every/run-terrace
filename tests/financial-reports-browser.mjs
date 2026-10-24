import assert from 'node:assert/strict'
import {mkdir} from 'node:fs/promises'
import {resolve,join} from 'node:path'
import {chromium} from '@playwright/test'
import {journey} from './financial-reports.mjs'
const out=resolve(process.env.FINANCIAL_SCREENSHOTS||'.rer/financial-screens');await mkdir(out,{recursive:true})
const browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']})
try{await journey({assets:true,inspect:async({h,a,q,bill})=>{
 const context=await browser.newContext();await context.addCookies(h.cookie.split('; ').map(pair=>{const i=pair.indexOf('=');return{name:pair.slice(0,i),value:pair.slice(i+1),url:h.origin}}));const page=await context.newPage()
 for(const [width,height]of [[1440,900],[390,844]]){
  await page.setViewportSize({width,height});await page.goto(h.origin+'/app?tab=properties');await page.getByRole('link',{name:'Open financial reports',exact:true}).waitFor();await page.screenshot({path:join(out,'properties-'+width+'.png'),fullPage:true});await page.goto(h.origin+'/app?tab=financial-reports&'+new URLSearchParams(q));await page.getByRole('heading',{name:'Income statement',exact:true}).waitFor()
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'financial page fits '+width)
  await page.screenshot({path:join(out,'accrual-'+width+'.png'),fullPage:true})
  assert.match(await page.getByRole('heading',{name:'Income statement',exact:true}).locator('..').innerText(),/1,000\.00.*300\.00.*700\.00/s)
  assert.match(await page.getByRole('heading',{name:'Balance sheet',exact:true}).locator('..').innerText(),/1,000\.00.*300\.00.*700\.00/s)
  const person=page.getByRole('link',{name:'Manage people',exact:true}),tip=page.getByRole('tooltip',{name:'Manage people',exact:true})
  await person.hover();await page.waitForTimeout(350);await tip.waitFor({state:'visible'});await page.screenshot({path:join(out,'tooltip-hover-'+width+'.png')})
  await page.mouse.move(0,0);await person.focus();await tip.waitFor({state:'visible'});await page.screenshot({path:join(out,'tooltip-focus-'+width+'.png')})
  await page.getByLabel('Basis',{exact:true}).selectOption('cash');await page.getByRole('button',{name:'View financials',exact:true}).click();await page.waitForURL(u=>u.searchParams.get('basis')==='cash')
  assert.match(await page.getByRole('heading',{name:'Income statement',exact:true}).locator('..').innerText(),/Income \$0\.00.*expenses \$0\.00.*net \$0\.00/s)
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:join(out,'cash-'+width+'.png'),fullPage:true});if(width===390){const scroll=page.getByRole('heading',{name:'Income',exact:true}).locator('..').locator('.scroll');assert.ok(await scroll.evaluate(el=>el.scrollWidth>el.clientWidth));await scroll.evaluate(el=>{el.scrollLeft=el.scrollWidth});await scroll.screenshot({path:join(out,'source-columns-390.png')})}
  const drill=page.getByRole('link',{name:/synthetic-terrace-3 earned rent/}).first();await drill.click();assert.match(new URL(page.url()).hash,/^#entry-/);await page.locator(':target').screenshot({path:join(out,'source-'+width+'.png')})
  assert.match(await page.locator(':target').innerText(),/source charge/)
  await page.getByRole('link',{name:new RegExp(bill.id)}).first().click();assert.match(await page.locator(':target').innerText(),/source bill/);await page.locator(':target').screenshot({path:join(out,'bill-source-'+width+'.png')})
 }
 await context.close()
}})}finally{await browser.close()}
