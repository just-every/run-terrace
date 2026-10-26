import assert from 'node:assert/strict'
import {mkdir} from 'node:fs/promises'
import {resolve,join} from 'node:path'
import {chromium} from '@playwright/test'
import {journey} from './hap.mjs'
const out=resolve(process.env.HAP_SCREENSHOTS??'.rer/hap-screens');await mkdir(out,{recursive:true})
const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{}),args:['--no-sandbox','--use-mock-keychain','--password-store=basic']})
try{await journey({assets:true,inspect:async({h,leases,phase,preview,comparisons,residentCookie,ownerCookie,transactionId})=>{
 const context=await browser.newContext();await context.addCookies(h.cookie.split('; ').map(pair=>{const i=pair.indexOf('=');return{name:pair.slice(0,i),value:pair.slice(i+1),url:h.origin}}));const page=await context.newPage()
 const proof=async name=>{for(const [width,height]of [[1440,900],[390,844]]){
  await page.setViewportSize({width,height});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no page overflow at '+width)
  const people=page.getByRole('link',{name:'Manage people',exact:true});await people.focus();assert.equal(await page.locator('#people-tooltip').evaluate(e=>getComputedStyle(e).visibility),'visible');await page.locator('h1').click();await page.mouse.move(0,0);await people.hover();await page.waitForTimeout(100);assert.equal(await page.locator('#people-tooltip').evaluate(e=>getComputedStyle(e).visibility),'hidden');await page.waitForTimeout(250);assert.equal(await page.locator('#people-tooltip').evaluate(e=>getComputedStyle(e).visibility),'visible');await page.locator('h1').click()
  await page.screenshot({path:join(out,name+'-'+width+'.png'),fullPage:true})
  for(const heading of ['PHA remittances and corrections','Payer and owner reconciliation','Recorded payer activity alongside forecasts']){const target=page.getByRole('heading',{name:heading,exact:true});if(await target.count())await target.locator('..').screenshot({path:join(out,name+'-'+heading.toLowerCase().replaceAll(' ','-')+'-'+width+'.png')})}
 }}
 try{
  await page.goto(h.origin+'/app?tab=ledger&tenancy='+leases[0].t.id+'&run=2026-07')
  if(phase==='preview'){await page.getByRole('heading',{name:'Charge run · 2026-07',exact:true}).waitFor();await page.getByText('Synthetic Housing Authority',{exact:false}).first().waitFor();await proof('voucher-preview');return}
  if(phase==='remittances'){
   await page.goto(h.origin+'/app?tab=documents&tenancyId='+leases[0].t.id)
   await page.getByText('Upload a document',{exact:true}).click()
   const upload=page.locator('form').filter({has:page.locator('input[name="command"][value="document.upload"]')})
   await upload.locator('[name="tenancyId"]').selectOption(leases[0].t.id);await upload.locator('[name="kind"]').selectOption('hap');await upload.locator('[name="title"]').fill('synthetic-terrace-901');await upload.locator('[name="source"]').fill('synthetic-terrace-902')
   await upload.locator('[name="file"]').setInputFiles({name:'synthetic-terrace-901.txt',mimeType:'text/plain',buffer:Buffer.from('synthetic-terrace-901 PHA check remittance detail')})
   await upload.getByRole('button',{name:'Store document',exact:true}).click();await page.getByRole('heading',{name:'synthetic-terrace-901',exact:true}).waitFor();await proof('pha-document-custody')
   const documents=await(await h.request('/api/documents?tenancyId='+leases[0].t.id)).json(),source=documents.documents.find(d=>d.title==='synthetic-terrace-901')
   assert.ok(source)
   await page.goto(h.origin+'/app?tab=ledger&tenancy='+leases[0].t.id)
   await page.getByText('Record an external PHA remittance',{exact:true}).click()
   const record=page.locator('form').filter({has:page.locator('input[name="command"][value="hap.remittance.record"]')})
   await record.locator('[name="amount"]').fill('2.00');await record.locator('[name="receivedDate"]').fill('2026-10-26');await record.locator('[name="method"]').selectOption('check');await record.locator('[name="state"]').selectOption('pending');await record.locator('[name="sourceDocumentVersionId"]').selectOption(source.versionId);await record.locator('[name="reference"]').fill('synthetic-terrace-903')
   await record.getByRole('button',{name:'Record PHA remittance',exact:true}).click()
   const data=await(await h.request('/api/hap-remittances?tenancyId='+leases[0].t.id)).json(),remittance=data.remittances.find(r=>r.reference==='synthetic-terrace-903');assert.ok(remittance)
   const article=page.locator('article').filter({has:page.getByRole('heading',{name:'Synthetic Housing Authority · synthetic-terrace-903',exact:true})})
   await article.getByText('Allocate from held remainder',{exact:true}).click()
   const allocate=article.locator('form').filter({has:page.locator('input[name="command"][value="hap.remittance.allocate"]')})
   await allocate.locator('input[name^="allocation:"]').first().fill('1.00');await allocate.locator('[name="reference"]').fill('synthetic-terrace-904');await allocate.getByRole('button',{name:'Allocate exact remittance detail',exact:true}).click()
   const after=(await(await h.request('/api/hap-remittances?tenancyId='+leases[0].t.id)).json()).remittances.find(r=>r.id===remittance.id);assert.equal(after.state,'pending');assert.equal(after.held_cents,100);assert.equal(after.allocations.length,1)
   await proof('held-pha-remittance');return
  }
  if(phase==='correction-review'){
   const review=page.locator('form').filter({has:page.locator('input[name="command"][value="hap.change.preview"]')}).filter({has:page.locator('input[name="changeId"][value="'+preview.changeId+'"]')})
   await review.getByRole('button',{name:'Review payer changes',exact:true}).click();await page.getByRole('heading',{name:'Review exact payer correction',exact:true}).waitFor();await proof('retroactive-pha-notice-review');return
  }
  if(phase==='payer-portals'){
   for(const [name,cookie,path,heading]of [['resident',residentCookie,'/portal/lease?tenancy='+leases[0].t.id,'Separate housing authority balance'],['owner',ownerCookie,'/portal/owner','Properties and ownership periods'],['resident-monthly',residentCookie,'/portal/statement?tenancyId='+leases[0].t.id+'&month=2026-10','Statement transactions'],['resident-correction',residentCookie,'/portal/transaction?tenancyId='+leases[0].t.id+'&id='+transactionId,'PHA-notice resident entitlement correction']]){
    await context.clearCookies();await context.addCookies(cookie.split('; ').map(pair=>{const i=pair.indexOf('=');return{name:pair.slice(0,i),value:pair.slice(i+1),url:h.origin}}));await page.goto(h.origin+path);await page.getByRole('heading',{name:heading,exact:true}).waitFor()
    for(const [width,height]of [[1440,900],[390,844]]){await page.setViewportSize({width,height});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:join(out,'payer-'+name+'-portal-'+width+'.png'),fullPage:true})}
   }return
  }
  if(phase==='payer-scenarios'){
   await page.goto(h.origin+'/app?tab=tenancy&tenancy='+leases[0].t.id+'&scenario=1&'+new URLSearchParams(comparisons[0].q))
   await page.getByRole('heading',{name:'Recorded payer activity alongside forecasts',exact:true}).waitFor()
   await page.locator('#cash-scenario details').evaluateAll(rows=>rows.forEach(d=>d.open=true))
   await proof('separate-payer-forecast-sources')
   await page.locator('[name="marketCollectionPercent"]').fill('60');await page.getByRole('button',{name:'Compare cash and vacant days',exact:true}).click();await page.getByRole('heading',{name:'Recorded payer activity alongside forecasts',exact:true}).waitFor();return
  }
  await page.getByRole('heading',{name:'Housing authority receivables',exact:true}).waitFor();await proof('separate-pha-ledger')
  if(phase==='reconciled'){
   const downloadPromise=page.waitForEvent('download');await page.getByRole('link',{name:'Download payer reconciliation',exact:true}).click();const download=await downloadPromise;assert.equal(await download.failure(),null);await download.saveAs(join(out,'payer-reconciliation.csv'))
  }
  await page.goto(h.origin+'/app?tab=delinquency&asOf=2026-10-01&tenancyId='+leases[0].t.id);await page.getByText('Housing authority balance:',{exact:false}).waitFor();await proof('separate-pha-aging')
  const downloadPromise=page.waitForEvent('download');await page.getByRole('link',{name:'Download CSV',exact:true}).click();const download=await downloadPromise;assert.equal(await download.failure(),null);await download.saveAs(join(out,'hap-aging.csv'))
 }finally{await context.close()}
}});console.log('HAP native browser proof PASS')}finally{await browser.close()}
