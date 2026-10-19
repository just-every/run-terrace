// DEMO-001: production entry readback, then the same Worker on the sanctioned
// isolated Turnstile test-key host. This never completes a production CAPTCHA.
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {chromium} from '@playwright/test'
import {capture,read,start,stop,detail} from './demo-hosted-support.mjs'

const config=JSON.parse(await readFile('deploy-site.json','utf8'))
const production=new URL(process.env.DEMO_PRODUCTION_ORIGIN || `https://demo.${config.domain}`).origin
const origin=new URL(process.env.DEMO_TEST_ORIGIN || `https://demo.test.${config.domain}`).origin
assert.ok(new URL(origin).hostname.startsWith('demo.test.'),'Use only the isolated hosted test door')
const measurement=process.env.RER_DEMO_MEASUREMENT_TOKEN
assert.ok(measurement,'The hosted journey requires its private measurement credential')
const browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']})
let owner,preparer
try {
 // Static production readback follows the actual homepage link. JavaScript is
 // off here so the production widget cannot start a visitor during this check.
 const publicContext=await browser.newContext({javaScriptEnabled:false})
 try {
  const page=await publicContext.newPage()
  assert.equal((await page.goto(`https://${config.domain}`)).status(),200)
  const link=page.getByRole('link',{name:/Try the demo/i}).first()
  assert.equal(new URL(await link.getAttribute('href'),page.url()).origin,production)
  await link.click();await page.waitForURL(url=>url.origin===production)
  await page.getByRole('heading',{name:/Try Terrace/}).waitFor()
  assert.ok(!(await publicContext.cookies()).some(cookie=>cookie.name==='rer_demo'))
  await capture(page,'production-signed-out')
 } finally {await publicContext.close()}

 ;[owner,preparer]=await Promise.all([start(browser,origin,measurement),start(browser,origin,measurement)])
 const before=await read(owner.context,origin)
 assert.ok(before.tenancies.length,'the owner receives a lived-in portfolio')
 const states=await Promise.all(before.tenancies.map(t=>read(owner.context,origin,'/api/state?tenancy='+encodeURIComponent(t.id))))
 const renewalState=states.find(s=>s.proposals.some(p=>p.kind==='renewal'&&p.state==='pending'))
 assert.ok(renewalState,'the demo has a renewal awaiting a person')
 const proposal=renewalState.proposals.find(p=>p.kind==='renewal'&&p.state==='pending')
 const tenancy=renewalState.tenancies.find(t=>t.id===proposal.tenancy_id)
 const workState=states.find(s=>s.work.jobs.some(j=>j.state==='pending'&&j.tenancy_id!==tenancy.id))
 assert.ok(workState,'the demo has maintenance awaiting approval')
 const job=workState.work.jobs.find(j=>j.state==='pending'&&j.tenancy_id!==tenancy.id)
 assert.ok(states.some(s=>s.work.photos.length),'the portfolio includes photographed inspections')
 await capture(owner.page,'owner-home')

 await preparer.page.goto(origin+'/signin?returnTo=/app')
 await preparer.page.getByRole('link',{name:'Sign in as Jamie Ellis',exact:true}).click()
 await preparer.page.waitForURL(url=>url.pathname==='/app')
 assert.equal((await read(preparer.context,origin)).actor.staffRole,'member')
 const refused=await preparer.context.request.post(origin+'/api/commands',{headers:{origin},data:{command:'proposal.approve',proposalId:proposal.id}})
 assert.equal(refused.status(),403,'a preparer cannot approve their draft')
 await capture(preparer.page,'preparer-home')

 await owner.page.goto(detail(origin,tenancy.id))
 const renewal=owner.page.locator(`form:has(input[name="proposalId"][value="${proposal.id}"])`).filter({has:owner.page.getByRole('button',{name:'Approve renewal',exact:true})})
 await renewal.getByRole('button',{name:'Approve renewal',exact:true}).click()
 await renewal.waitFor({state:'detached'})
 await owner.page.waitForURL(url=>url.searchParams.has('notice'))
 const changed=await read(owner.context,origin,'/api/state?tenancy='+encodeURIComponent(tenancy.id))
 assert.equal(changed.proposals.find(p=>p.id===proposal.id).state,'approved')
 assert.equal(changed.tenancies.find(t=>t.id===tenancy.id).rent_cents,JSON.parse(proposal.payload).rentCents)
 await capture(owner.page,'approved-renewal',owner.page.locator('.decision').filter({hasText:JSON.parse(proposal.payload).source}))

 await owner.page.goto(detail(origin,job.tenancy_id,'work'))
 const card=owner.page.locator('article.card').filter({has:owner.page.getByRole('heading',{name:job.title,exact:true})})
 await capture(owner.page,'maintenance-prepared',card)
 await card.getByRole('button',{name:'Approve maintenance',exact:true}).click()
 await card.getByLabel('Email or external handoff reference').waitFor()
 await owner.page.waitForURL(url=>url.searchParams.has('notice'))
 const packet=await owner.context.request.get(origin+`/api/maintenance/${encodeURIComponent(job.id)}/packet`)
 assert.equal(packet.status(),200)
 assert.ok((await packet.text()).includes(job.trade_email),'the approved packet is addressed to the selected demo vendor')
 await card.getByLabel('Email or external handoff reference').fill('DEMO-001 simulated external handoff; no email sent')
 await card.getByRole('button',{name:'Record external handoff',exact:true}).click()
 await card.getByRole('button',{name:'Record external handoff',exact:true}).waitFor({state:'detached'})
 await owner.page.waitForURL(url=>url.searchParams.has('notice'))
 const handedOff=await read(owner.context,origin,'/api/state?tenancy='+encodeURIComponent(job.tenancy_id))
 assert.equal(handedOff.work.jobs.find(j=>j.id===job.id).state,'sent')
 await capture(owner.page,'maintenance-handoff',card)

 const otherRenewal=await read(preparer.context,origin,'/api/state?tenancy='+encodeURIComponent(tenancy.id))
 assert.equal(otherRenewal.proposals.find(p=>p.id===proposal.id).state,'pending','another visitor retains the pending renewal')
 assert.equal(otherRenewal.tenancies.find(t=>t.id===tenancy.id).rent_cents,tenancy.rent_cents)
 const otherWork=await read(preparer.context,origin,'/api/state?tenancy='+encodeURIComponent(job.tenancy_id))
 assert.equal(otherWork.work.jobs.find(j=>j.id===job.id).state,'pending','another visitor retains unapproved maintenance')
 await owner.page.reload()
 assert.equal((await read(owner.context,origin,'/api/state?tenancy='+encodeURIComponent(job.tenancy_id))).work.jobs.find(j=>j.id===job.id).state,'sent','refresh never reseeds over a visitor action')
 console.log('DEMO-001 passed: production homepage/landing readback, official test-key hosted owner/preparer flows, independent visitors, approved renewal and external-handoff record, 1440/390. No production CAPTCHA completion claimed.')
} finally {
 const results=await Promise.allSettled([stop(owner,origin),stop(preparer,origin)])
 await browser.close()
 for(const result of results)if(result.status==='rejected')throw result.reason
}
