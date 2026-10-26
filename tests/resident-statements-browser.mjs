import assert from 'node:assert/strict'
import {mkdir,writeFile} from 'node:fs/promises'
import {resolve,join} from 'node:path'
import {chromium} from '@playwright/test'
import {journey} from './resident-statements.mjs'
const out=resolve(process.env.STATEMENT_SCREENSHOTS??'.rer/statement-screens');await mkdir(out,{recursive:true})
const browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']})
try{await journey({assets:true,inspect:async({h,t,as,transaction,receiptPath,pdf})=>{
 const session=async cookie=>{const c=await browser.newContext();await c.addCookies(cookie.split('; ').map(pair=>{const i=pair.indexOf('=');return{name:pair.slice(0,i),value:pair.slice(i+1),url:h.origin}}));return c}
 const resident=await session(as),owner=await session(h.cookie),page=await resident.newPage(),staff=await owner.newPage()
 const proof=async(name,p=page)=>{for(const[width,height]of [[1440,900],[390,844]]){await p.setViewportSize({width,height});assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no page overflow at '+width);const people=p.getByRole('link',{name:'Manage people',exact:true});if(await people.count()){await people.focus();await p.keyboard.press('Tab');await p.keyboard.press('Shift+Tab');assert.ok(await people.evaluate(e=>e===document.activeElement));assert.equal(await p.locator('#people-tooltip').evaluate(e=>getComputedStyle(e).visibility),'visible');await p.locator('h1').click()}await p.screenshot({path:join(out,name+'-'+width+'.png'),fullPage:true})}}
 try{
  await page.goto(h.origin+'/portal/lease?tenancy='+t.id);await page.getByLabel('Statement month',{exact:true}).fill('2026-10');await proof('choose-month');await page.getByRole('button',{name:'View monthly statement',exact:true}).click();await page.getByRole('heading',{name:'Monthly statement',exact:true}).waitFor();await page.getByText('Pending external funds (not deducted)',{exact:true}).waitFor();await proof('monthly-balances')
  const pdfDownload=page.waitForEvent('download');await page.getByRole('link',{name:'Download monthly statement (PDF)',exact:true}).click();assert.equal((await pdfDownload).suggestedFilename(),'terrace-monthly-statement.pdf');await writeFile(join(out,'resident-receipt.pdf'),pdf)
  const download=page.waitForEvent('download');await page.getByRole('link',{name:'Download monthly statement (CSV)',exact:true}).click();assert.equal((await download).suggestedFilename(),'terrace-monthly-statement.csv')
  await page.goto(h.origin+transaction);await page.getByRole('heading',{name:'Recorded transaction',exact:true}).waitFor();await page.getByRole('heading',{name:'Recorded external payment',exact:true}).waitFor();await proof('source-transaction')
  await page.goto(h.origin+receiptPath);await page.getByRole('heading',{name:'Payment receipt',exact:true}).waitFor();await page.getByText(/Recipient mail server confirmed delivery/).waitFor();await proof('delivered-payment-receipt')
  await staff.goto(h.origin+'/app?tab=ledger&tenancy='+t.id);await staff.getByRole('heading',{name:'Resident statements and receipts',exact:true}).waitFor();await staff.getByText('bounced · Open delivery task',{exact:true}).waitFor();await proof('failed-statement-follow-up',staff)
  await staff.goto(h.origin+'/app?tab=delinquency&tenancyId='+t.id+'&asOf=2026-10-04');await staff.getByText(/Manually recorded pending funds: \$100.00/).waitFor();await proof('matching-staff-aging',staff)
 }finally{await resident.close();await owner.close()}
}})}finally{await browser.close()}
