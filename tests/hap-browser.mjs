import assert from 'node:assert/strict'
import {mkdir,readFile} from 'node:fs/promises'
import {resolve,join} from 'node:path'
import {chromium} from '@playwright/test'
import {journey} from './hap.mjs'
process.env.TERRACE_ASYNC_SQL='1'
const csvLine=values=>values.map(v=>'\"'+String(v).replaceAll('\"','\"\"').replace(/^[=+@-]/,"'$&")+'\"').join(',')
const money=n=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(n/100)
const out=resolve(process.env.HAP_SCREENSHOTS??'.rer/hap-screens');await mkdir(out,{recursive:true})
const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{}),args:['--no-sandbox','--use-mock-keychain','--password-store=basic']})
try{for(const [width,height]of [[1440,900],[390,844]])await journey({assets:true,inspect:async({h,leases,phase,preview,comparisons,residentCookie,ownerCookie,transactionId,approvalCookie,reconciliation,ownerPortals,run})=>{
 const context=await browser.newContext();await context.addCookies(h.cookie.split('; ').map(pair=>{const i=pair.indexOf('=');return{name:pair.slice(0,i),value:pair.slice(i+1),url:h.origin}}));const page=await context.newPage();await page.setViewportSize({width,height})
 const proof=async name=>{
  await page.setViewportSize({width,height});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no page overflow at '+width)
  const people=page.getByRole('link',{name:'Manage people',exact:true});await people.focus();assert.equal(await page.locator('#people-tooltip').evaluate(e=>getComputedStyle(e).visibility),'visible');await page.locator('h1').click();await page.mouse.move(0,0);await people.hover();await page.waitForTimeout(100);assert.equal(await page.locator('#people-tooltip').evaluate(e=>getComputedStyle(e).visibility),'hidden');await page.waitForTimeout(250);assert.equal(await page.locator('#people-tooltip').evaluate(e=>getComputedStyle(e).visibility),'visible');await page.locator('h1').click()
  await page.screenshot({path:join(out,name+'-'+width+'.png'),fullPage:true})
  for(const heading of ['PHA remittances and corrections','Payer and owner reconciliation','Recorded payer activity alongside forecasts']){const target=page.getByRole('heading',{name:heading,exact:true});if(await target.count())await target.locator('..').screenshot({path:join(out,name+'-'+heading.toLowerCase().replaceAll(' ','-')+'-'+width+'.png')})}
 }
 try{
  await page.goto(h.origin+'/app?tab=ledger&tenancy='+leases[0].t.id+'&run=2026-07')
  if(phase==='preview'){await page.getByRole('heading',{name:'Charge run · 2026-07',exact:true}).waitFor();await page.getByText('Synthetic Housing Authority',{exact:false}).first().waitFor();const table=page.getByRole('heading',{name:'Charge run · 2026-07',exact:true}).locator('..');for(const l of run.lines){const row=table.getByRole('row').filter({has:page.getByRole('cell',{name:l.address,exact:true})}).filter({has:page.getByRole('cell',{name:money(l.amountCents),exact:true})});assert.equal(await row.count(),1);const amount=row.getByRole('cell',{name:money(l.amountCents),exact:true});await amount.scrollIntoViewIfNeeded();assert.equal(await amount.evaluate(e=>{const r=document.createRange();r.selectNodeContents(e);return r.getClientRects().length}),1,'voucher preview keeps each amount readable on one line')}await table.screenshot({path:join(out,'voucher-preview-amounts-'+width+'.png')});await table.locator('.scroll').evaluate(e=>e.scrollLeft=0);await proof('voucher-preview');return}
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
   await page.locator('article').filter({has:page.getByRole('heading',{name:'Synthetic Housing Authority · synthetic-terrace-903',exact:true})}).getByText('Held unmatched remainder:',{exact:false}).filter({has:page.locator('strong').filter({hasText:'$1.00'})}).waitFor();await proof('held-pha-remittance');return
  }
  if(phase==='correction-review'){
   const review=page.locator('form').filter({has:page.locator('input[name="command"][value="hap.change.preview"]')}).filter({has:page.locator('input[name="changeId"][value="'+preview.changeId+'"]')})
   await review.getByRole('button',{name:'Review payer changes',exact:true}).click();await page.getByRole('heading',{name:'Review exact payer correction',exact:true}).waitFor();for(const l of preview.lines)await page.getByText(l.hap.period_start+': resident '+money(l.oldResident)+' → '+money(l.oldResident+l.residentDelta)+'; PHA '+money(l.oldPha)+' → '+money(l.oldPha+l.phaDelta),{exact:true}).waitFor();await proof('retroactive-pha-notice-review')
   await context.clearCookies();await context.addCookies(approvalCookie.split('; ').map(pair=>{const i=pair.indexOf('=');return{name:pair.slice(0,i),value:pair.slice(i+1),url:h.origin}}));await page.goto(h.origin+'/app?tab=ledger&tenancy='+leases[0].t.id)
   await page.locator('form').filter({has:page.locator('input[name="command"][value="hap.change.preview"]')}).filter({has:page.locator('input[name="changeId"][value="'+preview.changeId+'"]')}).getByRole('button',{name:'Review payer changes',exact:true}).click()
   await page.getByRole('button',{name:'Approve exact payer correction',exact:true}).click();await page.getByText('Reviewed PHA correction applied once.',{exact:false}).waitFor();await proof('approved-pha-correction');return {approved:true}
  }
  if(phase==='payer-portals'){
   for(const [name,cookie,path,heading]of [['resident',residentCookie,'/portal/lease?tenancy='+leases[0].t.id,'Separate housing authority balance'],...ownerPortals.map((o,i)=>['owner-'+i,o.cookie,'/portal/owner','Properties and ownership periods']),['resident-monthly',residentCookie,'/portal/statement?tenancyId='+leases[0].t.id+'&month=2026-10','Statement transactions'],['resident-correction',residentCookie,'/portal/transaction?tenancyId='+leases[0].t.id+'&id='+transactionId,'PHA-notice resident entitlement correction']]){
    await context.clearCookies();await context.addCookies(cookie.split('; ').map(pair=>{const i=pair.indexOf('=');return{name:pair.slice(0,i),value:pair.slice(i+1),url:h.origin}}));await page.goto(h.origin+path);await page.getByRole('heading',{name:heading,exact:true}).waitFor()
    if(name.startsWith('owner-')){
     const portal=ownerPortals[Number(name.slice(6))],b=portal.expected
     await page.getByText('Your resident receivable: '+money(b.residentCents)+'; your PHA receivable: '+money(b.phaCents)+'; combined: '+money(b.totalCents)+'.',{exact:true}).waitFor()
    }
    if(name==='resident'){
     const ledger=(await h.state(leases[0].t.id)).ledger
     const section=page.getByRole('heading',{name:'Separate housing authority balance',exact:true}).locator('..')
     assert.ok((await section.innerText()).includes('Housing authority balance: '+money(ledger.hapBalanceCents)))
     assert.equal(await page.getByRole('heading',{name:'Balance',exact:true}).locator('..').locator('strong').innerText(),money(ledger.balanceCents))
    }
    if(name==='resident-monthly'){
     assert.equal(await page.getByText('Closing receivable',{exact:true}).locator('..').locator('dd').nth(1).innerText(),money(-10000))
     assert.equal(await page.getByRole('row').filter({has:page.getByRole('cell',{name:'PHA-notice resident entitlement correction',exact:true})}).count(),3)
    }
    if(name==='resident-correction')assert.ok((await page.locator('main').innerText()).includes(money(-10000)))
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:join(out,'payer-'+name+'-portal-'+width+'.png'),fullPage:true})
   }return
  }
  if(phase==='payer-scenarios'){
   await page.goto(h.origin+'/app?tab=tenancy&tenancy='+leases[0].t.id+'&scenario=1&'+new URLSearchParams(comparisons[0].q))
   await page.getByRole('heading',{name:'Recorded payer activity alongside forecasts',exact:true}).waitFor()
   await page.locator('#cash-scenario details').evaluateAll(rows=>rows.forEach(d=>d.open=true))
   const actuals=comparisons[0].report.facts.payerActuals
   for(const p of [actuals.resident,actuals.housingAuthority]){
    const article=page.getByRole('heading',{name:p.payer+' actuals',exact:true}).locator('..')
    for(const [label,key]of [['Recorded charges','chargedCents'],['Signed receivable corrections','adjustmentCents'],['External receipts, net of recorded reversals','receivedCents'],['Pending allocated funds, excluded from receipts','pendingCents']])assert.equal(await article.locator('dt').filter({hasText:label}).locator('xpath=following-sibling::dd[1]').innerText(),money(p[key]))
   }
   await proof('separate-payer-forecast-sources')
   const market=page.getByRole('heading',{name:'Immediate marketing with concession',exact:true}).locator('..');const metric=label=>market.locator('dt').filter({hasText:label}).locator('xpath=following-sibling::dd[1]');assert.equal(await metric('Expected collected rent').innerText(),money(comparisons[0].report.plans[1].collectedRentCents));await page.locator('[name="marketCollectionPercent"]').fill('60');await page.getByRole('button',{name:'Compare cash and vacant days',exact:true}).click();await page.getByRole('heading',{name:'Recorded payer activity alongside forecasts',exact:true}).waitFor();const q={...comparisons[0].q,marketCollectionPercent:'60'},r=await(await h.request('/api/cash-scenario?'+new URLSearchParams(q))).json();assert.notEqual(r.plans[1].collectedRentCents,comparisons[0].report.plans[1].collectedRentCents);assert.equal(await metric('Expected collected rent').innerText(),money(r.plans[1].collectedRentCents));assert.equal(await metric('Operating cash after distributions').innerText(),money(r.plans[1].afterDistributionsCents));await proof('recalculated-payer-forecast');return
  }
  await page.getByRole('heading',{name:'Housing authority receivables',exact:true}).waitFor();const ledger=(await h.state(leases[0].t.id)).ledger;await page.getByText('Resident balance excludes '+money(ledger.hapBalanceCents)+' due from the housing authority. No receipt or bank settlement is inferred.',{exact:true}).waitFor();const phaSection=page.getByRole('heading',{name:'Housing authority receivables',exact:true}).locator('..');for(const [i,q]of ledger.hapCharges.entries()){const amount=phaSection.locator('tbody tr').nth(i).locator('td').last();assert.equal(await amount.innerText(),money(q.balance_cents));await amount.scrollIntoViewIfNeeded();assert.equal(await amount.evaluate(e=>{const r=document.createRange();r.selectNodeContents(e);return r.getClientRects().length}),1,'PHA ledger keeps each amount readable on one line')}await phaSection.screenshot({path:join(out,'separate-pha-balances-'+width+'.png')});await phaSection.locator('.scroll').evaluate(e=>e.scrollLeft=0);await proof('separate-pha-ledger')
  if(phase==='reconciled'){
   const section=page.getByRole('heading',{name:'Payer and owner reconciliation',exact:true}).locator('..')
   await section.getByText('Resident net: '+money(reconciliation.residentNetCents)+'; resident credit: '+money(reconciliation.resident.creditCents)+'. PHA net: '+money(reconciliation.phaNetCents)+'; PHA credit: '+money(reconciliation.pha.creditCents)+'.',{exact:true}).waitFor()
   for(const o of reconciliation.owners)await section.getByText('Owner '+o.name+': receivable '+money(o.receivableCents)+'; recorded external cash '+money(o.externalCashCents)+'; income '+money(o.incomeCents)+'.',{exact:true}).waitFor()
   const downloadPromise=page.waitForEvent('download');await page.getByRole('link',{name:'Download payer reconciliation',exact:true}).click();const download=await downloadPromise;assert.equal(await download.failure(),null);await download.saveAs(join(out,'payer-reconciliation-'+width+'.csv'));const csv=await readFile(await download.path(),'utf8');assert.equal(csv,await(await h.request('/api/hap-reconciliation?tenancyId='+leases[0].t.id+'&format=csv')).text());for(const values of [['Resident',reconciliation.resident.balanceCents,reconciliation.resident.creditCents,reconciliation.residentNetCents],['Housing authority',reconciliation.pha.balanceCents,reconciliation.pha.creditCents,reconciliation.phaNetCents],...reconciliation.owners.map(o=>[o.ownerId,o.receivableCents,o.externalCashCents,o.incomeCents])])assert.ok(csv.includes(csvLine(values)),'download contains exact payer and beneficiary cents')
  }
  await page.goto(h.origin+'/app?tab=delinquency&asOf=2026-10-26&tenancyId='+leases[0].t.id);await page.getByText('Housing authority balance:',{exact:false}).waitFor();const aging=await(await h.request('/api/delinquency?asOf=2026-10-26&tenancyId='+leases[0].t.id)).json(),row=aging.rows[0];await page.getByText('Housing authority balance: '+money(row.phaAging.balanceCents)+' · overdue '+money(row.phaAging.overdueCents)+'. PHA credit '+money(row.phaAging.creditCents)+'; resident credit '+money(row.creditCents)+'. Excluded from resident arrears.',{exact:true}).waitFor();await page.getByText('Dated housing authority and payer correction sources',{exact:true}).click();await proof('separate-pha-aging')
  const downloadPromise=page.waitForEvent('download');await page.getByRole('link',{name:'Download CSV',exact:true}).click();const download=await downloadPromise;assert.equal(await download.failure(),null);await download.saveAs(join(out,'hap-aging-'+width+'.csv'));const csv=await readFile(await download.path(),'utf8');assert.equal(csv,await(await h.request('/api/delinquency?asOf=2026-10-26&tenancyId='+leases[0].t.id+'&format=csv')).text());const amount=n=>(n/100).toFixed(2);assert.ok(csv.includes(csvLine([leases[0].t.id,'USD',amount(row.phaAging.balanceCents),amount(row.phaAging.overdueCents)])));for(const e of row.payerCorrections)assert.ok(csv.includes(csvLine([leases[0].t.id,e.id,e.effective_from,e.effective_to,e.posting_day,amount(e.resident_delta),amount(e.pha_delta),e.notice_version_id])))
 }finally{await context.close()}
}});console.log('HAP native browser proof PASS')}finally{await browser.close()}
