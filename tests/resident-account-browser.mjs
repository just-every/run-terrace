import assert from 'node:assert/strict'
import {mkdir,readFile} from 'node:fs/promises'
import {resolve,join} from 'node:path'
import {chromium} from '@playwright/test'
import {journey} from './card-payments.mjs'

process.env.TERRACE_ASYNC_SQL='1'
const out=resolve(process.env.RESIDENT_ACCOUNT_SCREENSHOTS??'.rer/resident-account-screens')
await mkdir(out,{recursive:true})
const browser=await chromium.launch({headless:true,...(process.env.RER_CHROMIUM_PATH?{executablePath:process.env.RER_CHROMIUM_PATH}:{}),args:['--no-sandbox','--use-mock-keychain','--password-store=basic']})
async function capture(page,name){
 for(const [width,height] of [[1440,900],[390,844]]){
  await page.setViewportSize({width,height})
  await page.screenshot({path:join(out,name+'-'+width+'.png'),fullPage:true})
 }
 await page.setViewportSize({width:1440,height:900})
}
try{
 await journey({assets:true,bufferedTransport:true,accountInspect:async f=>{
  if(!['account-share','account','account-settings','account-paid'].includes(f.phase))return
  const {h,t,resident,current}=f,context=await browser.newContext({viewport:{width:1440,height:900}})
  try{
   await context.addCookies((f.phase==='account-share'?h.cookie:resident).split('; ').map(pair=>{const i=pair.indexOf('=');return{name:pair.slice(0,i),value:pair.slice(i+1),url:h.origin}}))
   const page=await context.newPage()
   if(f.phase==='account-share'){
    await page.goto(h.origin+'/app?tab=settings&tenancy='+t.id)
    const shares=page.locator('details').filter({has:page.locator('summary').getByText('Share a lease original',{exact:true})})
    await shares.locator('summary').click()
    await shares.getByRole('checkbox').check()
    const people=page.getByRole('link',{name:'Manage people',exact:true})
    await people.focus();assert.equal(await page.locator('#people-tooltip').evaluate(el=>getComputedStyle(el).visibility),'visible')
    await page.getByRole('heading',{name:'Portal access',exact:true}).click();await people.hover();await page.waitForTimeout(400)
    assert.equal(await page.locator('#people-tooltip').evaluate(el=>getComputedStyle(el).visibility),'visible')
    await capture(page,'resident-original-sharing')
    await shares.getByRole('button',{name:'Share exact lease original',exact:true}).click()
    await page.getByRole('status').filter({hasText:'Exact lease original shared'}).waitFor()
   }else if(f.phase==='account'){
    await page.goto(h.origin+'/portal')
    assert.equal(await page.getByRole('link',{name:/Lease account:/}).count(),2)
    await capture(page,'resident-two-leases')
    await page.goto(h.origin+'/portal/lease?tenancy='+t.id)
    for(const heading of ['Charges','Pending payments','Deposits','Lease documents','Household obligations'])await page.getByRole('heading',{name:heading,exact:true}).waitFor()
    assert.ok((await page.locator('main').innerText()).includes('$500.00'))
    assert.ok(!(await page.content()).includes('Synthetic private'))
    const download=page.waitForEvent('download');await page.getByRole('link',{name:'Download synthetic-terrace-202.txt'}).click()
    assert.equal(await readFile(await(await download).path(),'utf8'),'Synthetic lease original 202')
    await capture(page,'resident-account')
    await page.goto(h.origin+'/portal/lease?tenancy='+f.second.id)
    assert.ok((await page.locator('main').innerText()).includes('Future parking'))
    assert.ok((await page.locator('main').innerText()).includes('$75.00'))
    await capture(page,'resident-future-charges')
   }else if(f.phase==='account-settings'){
    await page.goto(h.origin+'/portal/settings?tenancyId='+t.id)
    await page.getByLabel('Optional contact',{exact:true}).selectOption('none')
    await page.getByRole('button',{name:'Save contact preference',exact:true}).click()
    await page.getByRole('status').waitFor()
    assert.equal(await page.getByLabel('Optional contact',{exact:true}).inputValue(),'none')
    await capture(page,'resident-contact-settings')
    await page.getByLabel('Optional contact',{exact:true}).selectOption('email')
    await page.getByRole('button',{name:'Save contact preference',exact:true}).click()
    await page.getByRole('status').waitFor()
    assert.equal(await page.getByLabel('Optional contact',{exact:true}).inputValue(),'email')
   }else{
    await page.goto(h.origin+'/portal/lease?tenancy='+t.id)
    assert.ok((await page.locator('main').innerText()).includes('$900.00'))
    const download=page.waitForEvent('download');await page.getByRole('link',{name:'Download receipt (PDF)',exact:true}).click()
    const bytes=await readFile(await(await download).path());assert.ok(bytes.toString('latin1').startsWith('%PDF-'))
    const receipt=await context.request.get(h.origin+current.receipts[0].url+'&format=json')
    assert.equal((await receipt.json()).receipt.amountCents,10000)
    await capture(page,'resident-paid-receipt')
   }
  }finally{await context.close()}
 }})
 console.log('Resident account browser journey passed at 1440; screens captured at 1440 and 390.')
}finally{await browser.close()}
