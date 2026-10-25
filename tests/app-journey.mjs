import {queuedEntrypoint} from '@runeditrun/rer/queued-entry';
const queued=await queuedEntrypoint(import.meta.url,'verify:app-journey');if(queued!==null)process.exit(queued);
// TER-012: the built run site and the emitted app, each served by Cloudflare's asset server as deployed. The site
// opens /, /run, /docs and a missing path; a signed-in owner enters a tenancy, follows its linked row and ledger
// action, records rent and reads the ledger at 1440 and 390 pixels. Only the paid mail provider is replaced.
import assert from 'node:assert/strict'
import { assertRunSite } from './site/assert-run-site.mjs'
import { randomBytes } from 'node:crypto'
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { Miniflare, convertV4MiniflareOptions } from 'miniflare'
import { unstable_splitSqlQuery } from 'wrangler'
import { chromium } from '@playwright/test'

assertRunSite()

const { SITE_ASSETS_CONFIG, SITE_WORKER } = await import(pathToFileURL(resolve('node_modules/@runeditrun/rer/modules/deploy-kit/site.mjs')).href)
const directory=await mkdtemp(join(tmpdir(),'terrace-app-journey-')),secret=()=>randomBytes(32).toString('base64url')
const vars={AUTH_LOCAL:'true',AUTH_ORIGIN:'http://localhost',OWNER_EMAIL:'owner@example.test',SESSION_SECRET:secret(),SETUP_TOKEN:secret(),MAIL_PROVIDER:'resend',MAIL_API_KEY:'example-test-mail',MAIL_FROM:'auth@localhost.test'}
const modules=[{type:'ESModule',path:resolve('dist/server/index.js')},...(await readdir('dist/server/assets')).filter(name=>name.endsWith('.js')).map(name=>({type:'ESModule',path:resolve('dist/server/assets',name)}))]
const appOptions=port=>({...convertV4MiniflareOptions({host:'127.0.0.1',port,modules,compatibilityDate:'2026-09-08',compatibilityFlags:['nodejs_compat'],d1Databases:['DB'],bindings:vars,outboundService:async()=>Response.json({id:crypto.randomUUID()}),assets:{directory:resolve('dist/client'),routerConfig:{has_user_worker:true}}}),resourcePersistencePath:join(directory,'app')})
const site=new Miniflare(convertV4MiniflareOptions({host:'127.0.0.1',port:0,modules:true,script:SITE_WORKER,compatibilityDate:'2026-09-08',assets:{directory:resolve('dist/site'),binding:'ASSETS',assetConfig:SITE_ASSETS_CONFIG,routerConfig:{has_user_worker:true}}}))
const app=new Miniflare(appOptions(0))
const browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']})
try {
 const siteOrigin=(await site.ready).origin,origin=(await app.ready).origin
 vars.AUTH_ORIGIN=origin;await app.setOptions(appOptions(Number(new URL(origin).port)))
 const db=await app.getD1Database('DB')
 for(const file of (await readdir('migrations/core')).filter(f=>f.endsWith('.sql')).sort())await db.batch(unstable_splitSqlQuery(await readFile('migrations/core/'+file,'utf8')).map(sql=>db.prepare(sql)))

 // The run site: the homepage's Run Terrace action, the docs and a real not-found document.
 const visitor=await browser.newPage({viewport:{width:1440,height:900}})
 assert.equal((await visitor.goto(siteOrigin+'/')).status(),200)
 await visitor.getByRole('link',{name:/^Run Terrace/}).first().click()
 await visitor.waitForURL(url=>url.pathname==='/run')
 assert.equal(await visitor.title(),'Run Terrace')
 assert.equal((await visitor.goto(siteOrigin+'/docs')).status(),200)
 assert.equal(await visitor.title(),'Terrace docs')
 const missing=await visitor.goto(siteOrigin+'/no-such-page')
 assert.equal(missing.status(),404,'a missing path is a real 404')
 assert.equal(await visitor.title(),'Not found · Terrace')

 // The installed root stays the shared Lobby; the owner finishes setup and works in /app.
 const boot=await fetch(origin+'/auth/bootstrap',{method:'POST',redirect:'manual',headers:{origin,'content-type':'application/json'},body:JSON.stringify({token:vars.SETUP_TOKEN,displayName:'Terrace owner'})})
 assert.equal(boot.status,303)
 const context=await browser.newContext({viewport:{width:1440,height:900}})
 await context.addCookies(boot.headers.getSetCookie().map(line=>{const [pair]=line.split(';'),at=pair.indexOf('=');return {name:pair.slice(0,at),value:pair.slice(at+1),url:origin}}))
 const page=await context.newPage()
 assert.equal((await page.goto(origin+'/')).status(),200)
 assert.equal(await page.locator('html[data-state]').count(),1,'the installed root is the shared Lobby')
 await page.goto(origin+'/setup')
 await page.getByRole('checkbox').check()
 await page.getByRole('button',{name:'Finish setup'}).click()
 await page.goto(origin+'/app')
 const add=page.locator('#add-tenancy form')
 await add.getByLabel('Property address').fill('Unit 2B, 1840 Alder Street, Oakland, CA 94610')
 await add.getByLabel('Property owner').fill('Okafor Family Trust')
 await add.getByLabel('Owner email').fill('okafor@example.test')
 await add.getByLabel('Tenant name').fill('Maya Chen')
 await add.getByLabel('Tenant email').fill('maya@example.test')
 await add.getByLabel('Lease starts').fill('2026-02-01')
 await add.getByLabel('Lease ends').fill('2027-01-31')
 await add.getByLabel('Rent (USD)').fill('1850.00')
 await add.getByRole('button',{name:'Add tenancy'}).click()
 await page.waitForURL(url=>url.searchParams.get('tenancy')?.length>0)
 const tenancyId=new URL(page.url()).searchParams.get('tenancy')

 // The tenancy list row opens that tenancy; its ledger action carries the same identity.
 await page.goto(origin+'/app')
 await page.locator(`a.tenancy-row[href="/app?tab=tenancy&tenancy=${tenancyId}"]`).click()
 await page.waitForURL(url=>url.searchParams.get('tenancy')===tenancyId)
 assert.equal(await page.locator('form input[name="tenancyId"]').first().inputValue(),tenancyId)
 await page.getByRole('link',{name:'Open ledger →'}).click()
 await page.waitForURL(url=>url.searchParams.get('tab')==='ledger'&&url.searchParams.get('tenancy')===tenancyId)
 const charge=page.locator('form:has(input[name="command"][value="rent.charge"])')
 assert.equal(await charge.locator('input[name="tenancyId"]').inputValue(),tenancyId)
 await charge.getByLabel('Due date').fill('2026-10-01')
 await charge.getByLabel('Unique charge reference').fill('RENT-OCT-2B')
 await charge.getByRole('button',{name:'Record charge'}).click()
 await page.waitForURL(url=>url.searchParams.get('tab')==='ledger')
 const receipt=page.locator('form:has(input[name="command"][value="rent.receipt"])')
 await receipt.getByLabel('Amount (USD)').fill('600.00')
 await receipt.getByLabel('Received date').fill('2026-10-02')
 await receipt.getByLabel('Unique external receipt reference').fill('BANK-2B-001')
 await receipt.getByRole('button',{name:'Record receipt'}).click()
 await page.waitForURL(url=>url.searchParams.get('tab')==='ledger')
 await page.locator('.recorded-rows',{hasText:'BANK-2B-001'}).waitFor()

 // 1440: the ledger is a table with headings. 390: the same rows stack and nothing scrolls sideways.
 const row=page.locator('.ledger-table tbody tr',{hasText:'RENT-OCT-2B'})
 assert.equal(await row.locator('td').allInnerTexts().then(cells=>cells.map(cell=>cell.trim()).join('|')),'Oct 1, 2026|Monthly rent|RENT-OCT-2B|$1,850.00|$1,250.00')
 assert.notEqual(await page.locator('.ledger-table thead').evaluate(el=>getComputedStyle(el).display),'none')
 await page.setViewportSize({width:390,height:844})
 assert.equal(await page.locator('.ledger-table thead').evaluate(el=>getComputedStyle(el).display),'none','the phone ledger drops the table header')
 assert.equal(await row.evaluate(el=>getComputedStyle(el).display),'grid','each phone ledger row stacks its cells')
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),'the phone ledger fits 390 pixels without sideways scrolling')
 await row.getByText('$1,250.00').waitFor()

 // The existing work, move-in and data/access forms remain on their tabs.
 for(const [tab,command] of [['work','inspection.create'],['import','import.preview'],['settings','data.restore']]){
  assert.equal((await page.goto(`${origin}/app?tab=${tab}&tenancy=${tenancyId}`)).status(),200,tab)
  assert.equal(await page.locator(`form input[name="command"][value="${command}"]`).count(),1,`${tab} keeps ${command}`)
 }
 console.log('TER-012 passed: run site /, /run, /docs and a 404 document; linked tenancy and ledger actions with a stacked 390-pixel ledger')
} finally {await browser.close();await site.dispose();await app.dispose();await rm(directory,{recursive:true,force:true})}
