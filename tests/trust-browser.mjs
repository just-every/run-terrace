import assert from 'node:assert/strict'
import {mkdir} from 'node:fs/promises'
import {resolve,join} from 'node:path'
import {chromium} from '@playwright/test'
import {journey} from './trust.mjs'
const out=resolve(process.env.TRUST_SCREENSHOTS??'.rer/trust-screens');await mkdir(out,{recursive:true})
const browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']})
try{await journey({assets:true,inspect:async({h,b,day,rent,second,manager})=>{
 const session=async cookie=>{const context=await browser.newContext();await context.addCookies(cookie.split('; ').map(pair=>{const i=pair.indexOf('=');return{name:pair.slice(0,i),value:pair.slice(i+1),url:h.origin}}));return context}
 const owner=await session(h.cookie),page=await owner.newPage()
 const proof=async(name,p=page)=>{for(const[width,height]of [[1440,900],[390,844]]){await p.setViewportSize({width,height});assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no horizontal overflow at '+width);await p.screenshot({path:join(out,name+'-'+width+'.png'),fullPage:true})}}
 await page.goto(h.origin+'/app?tab=trust');await page.getByRole('heading',{name:'Bank beneficiary balances',exact:true}).waitFor();await proof('custody-balances')
 await page.getByText('Add a designated bank account',{exact:true}).click()
 const account=page.locator('form:has(input[name=command][value="trust.account.add"])')
 await account.getByLabel('Account name',{exact:true}).fill('Native rent trust');await account.getByLabel('Bank',{exact:true}).fill('Synthetic Bank');await account.getByLabel('Last four digits',{exact:true}).fill('1021');await proof('authorize-bank')
 await account.getByRole('button',{name:'Record bank reference',exact:true}).click();await page.getByText('Designated USD bank reference recorded. No bank verification or money movement.',{exact:true}).waitFor()
 const prepare=page.locator('form:has(input[name=command][value="trust.prepare"])')
 await prepare.getByLabel('Property',{exact:true}).selectOption(b.p.id);await prepare.getByLabel('Beneficiary owner',{exact:true}).selectOption(b.o.id);await prepare.getByLabel('From bank',{exact:true}).selectOption(rent.id);await prepare.getByLabel('To bank',{exact:true}).selectOption(second.id);await prepare.getByLabel('Transfer amount USD',{exact:true}).fill('50.00');await prepare.getByLabel('External transfer date',{exact:true}).fill(day);await prepare.getByLabel('Reason',{exact:true}).fill('synthetic-terrace-20 native custody transfer');await proof('transfer-review')
 await prepare.getByRole('button',{name:'Prepare exact transfer',exact:true}).click();await page.getByText('Exact transfer prepared for human approval. Nothing sent or posted.',{exact:true}).waitFor()
 const approver=await session(manager),review=await approver.newPage();await review.goto(h.origin+'/app?tab=trust')
 const card=review.getByRole('article').filter({hasText:'synthetic-terrace-20 native custody transfer'});await card.getByText('Awaiting human approval',{exact:true}).waitFor();assert.equal(await review.getByRole('heading',{name:'Authorize bank custody',exact:true}).count(),0);await proof('human-approval',review)
 await card.getByRole('button',{name:'Approve exact transfer',exact:true}).click();await review.getByText('Exact transfer approved. No bank instruction sent.',{exact:true}).waitFor()
 await page.reload();const approved=page.getByRole('article').filter({hasText:'synthetic-terrace-20 native custody transfer'});await approved.getByLabel('External bank reference',{exact:true}).fill('synthetic-terrace-21 external bank receipt');await proof('bank-reference')
 await approved.getByRole('button',{name:'Record external transfer',exact:true}).click();await page.getByText('External bank transfer recorded once. Beneficiary and fund unchanged; Terrace sent no instruction.',{exact:true}).waitFor();await page.getByText('External transfer recorded: synthetic-terrace-21 external bank receipt',{exact:true}).waitFor();await proof('transfer-recorded')
 await page.getByRole('link',{name:'Back to balanced property ledger',exact:true}).click();await page.getByRole('link',{name:'Trust accounts and beneficiary balances',exact:true}).waitFor();await proof('ledger-navigation')
 await approver.close();await owner.close()
}})}finally{await browser.close()}
