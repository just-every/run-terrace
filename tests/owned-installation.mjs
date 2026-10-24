// SAFE-007: real CLI, Git upgrade, Worker/D1, setup, tenancy, export and restore.
// Slow clean-install work belongs to release/nightly, not every push.
import assert from 'node:assert/strict'
import {mkdtemp,readFile,writeFile,mkdir,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'
import {randomBytes} from 'node:crypto'
import {chromium} from '@playwright/test'
import {command,commandEnv,git,launch,reviewedMerge} from './owned-process.mjs'

const source=resolve('.'),target=git(source,'rev-parse','HEAD'),prior=git(source,'rev-parse','HEAD^')
const rer=resolve('node_modules/@runeditrun/rer/global/rer.mjs'),root=await mkdtemp(join(tmpdir(),'terrace-owned-'))
const screenshots=resolve(process.env.SAFE_SCREENSHOTS??'.rer/owned-screens')
if(screenshots)await mkdir(screenshots,{recursive:true})
const browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']})
let active
const outside=[]
async function openOwner(server){
 const context=await browser.newContext({viewport:{width:1440,height:900}})
 await context.route('**/*',route=>{const u=new URL(route.request().url());if(['http:','https:'].includes(u.protocol)&&u.origin!==server.origin){outside.push(u.origin);return route.abort()}return route.continue()})
 const page=await context.newPage();await page.goto(server.open);await page.waitForURL(u=>u.pathname==='/setup'||u.pathname==='/app')
 return {context,page}
}
async function picture(page,name){
 for(const [width,height]of [[1440,900],[390,844]]){
  await page.setViewportSize({width,height})
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),name+' fits '+width)
  if(screenshots)await page.screenshot({path:join(screenshots,`${name}-${width}.png`),fullPage:true})
 }
 await page.setViewportSize({width:1440,height:900})
}
async function finishSetup(page){
 assert.equal(new URL(page.url()).pathname,'/setup')
 await picture(page,'setup')
 await page.getByRole('checkbox').check();await page.getByRole('button',{name:'Finish setup'}).click()
 await page.goto(active.origin+'/app')
 const state=await (await page.request.get(active.origin+'/api/state')).json()
 assert.deepEqual(state.tenancies,[],'a fresh owned installation has no sample portfolio')
}
try {
 console.log('SAFE-007: clean prior installation through rer dev')
 const first=join(root,'source'),review=join(root,'review')
 for(const cwd of [first,review]){
  git(root,'clone','--no-hardlinks',source,cwd);git(cwd,'checkout','-b','owner-install',prior)
  git(cwd,'config','user.name','Installation owner');git(cwd,'config','user.email','owner@example.test')
 }
 active=await launch(first,rer)
 let {context,page}=await openOwner(active);await finishSetup(page)
 const form=page.locator('#add-tenancy form')
 for(const [label,value]of Object.entries({'Property address':'Unit 2B, 1840 Alder Street, Oakland, CA 94610','Property owner':'Okafor Family Trust','Owner email':'okafor@example.test','Tenant name':'Maya Chen','Tenant email':'maya@example.test','Lease starts':'2026-02-01','Lease ends':'2027-01-31','Rent (USD)':'1850.00'}))await form.getByLabel(label,{exact:true}).fill(value)
 await form.getByRole('button',{name:'Add tenancy'}).click();await page.waitForURL(u=>!!u.searchParams.get('tenancy'))
 const tenancyId=new URL(page.url()).searchParams.get('tenancy')
 const expected=(await(await page.request.get(active.origin+'/api/state')).json()).tenancies
 assert.equal(expected.length,1);assert.equal(expected[0].tenant_name,'Maya Chen')
 const firstOwner=(await(await page.request.get(active.origin+'/auth/session')).json()).operator.id
 await picture(page,'entered-tenancy')
 const health=await(await page.request.get(active.origin+'/health')).json();assert.equal(health.ok,true)
 const forbidden=await page.request.post(active.origin+'/api/commands',{headers:{origin:'https://other.example.test'},data:{command:'tenancy.create'}})
 assert.equal(forbidden.status(),403);const denial=await forbidden.text();assert.match(denial,/origin|site/i)
 assert.ok(!JSON.stringify(health).includes(new URL(active.open).hash.slice(1)))
 assert.ok(!denial.includes(new URL(active.open).hash.slice(1)))
 await page.goto(active.origin+'/app?tab=settings');await picture(page,'backup')
 await context.close();await active.stop();active=null
 const archive=join(root,'before-upgrade.rer')
 await command(first,process.execPath,[rer,'export','--output',archive])
 assert.ok((await readFile(archive)).length>0,'CLI export contains the entered installation')

 console.log('SAFE-007: separate owned review installation and private backup restore')
 active=await launch(review,rer);({context,page}=await openOwner(active));await finishSetup(page)
 await page.goto(active.origin+'/app?tab=settings')
 await page.getByText('Restore an archive into this empty installation',{exact:true}).click()
 const restore=page.locator('form:has(input[name="command"][value="data.restore"])')
 await restore.locator('input[name="backup"]').setInputFiles(archive)
 await restore.getByLabel('Type RESTORE',{exact:true}).fill('RESTORE')
 await restore.getByRole('button',{name:'Restore archive'}).click();await page.waitForURL(u=>u.searchParams.has('notice'))
 assert.deepEqual((await(await page.request.get(active.origin+'/api/state')).json()).tenancies,expected)
 assert.notEqual((await(await page.request.get(active.origin+'/auth/session')).json()).operator.id,firstOwner,'restore keeps the separate installation owner')
 await picture(page,'restored-installation')
 await context.close();await active.stop();active=null

 // Real owner changes in tracked source and documentation survive a real
 // upstream commit merge; the data store is never copied over the checkout.
 const ownerNote='Owner operating rule: inspect the restored ledger before deployment.\n'
 await mkdir(join(review,'src/ext'),{recursive:true});await writeFile(join(review,'src/ext/OWNER.md'),ownerNote)
 await writeFile(join(review,'README.md'),(await readFile(join(review,'README.md'),'utf8'))+'\n'+ownerNote)
 const ownerView=join(review,'src/terrace/tenancy-view.ts'),originalView=await readFile(ownerView,'utf8')
 const customView=originalView.replace('<a class="back-link"','<a data-owner-upgrade="reviewed" class="back-link"')
 assert.notEqual(customView,originalView,'the owner edits an existing rendered source module')
 await writeFile(ownerView,customView)
 git(review,'add','src/ext/OWNER.md','src/terrace/tenancy-view.ts','README.md');git(review,'commit','-m','Keep installation owner operating instructions')
 const ownerCommit=git(review,'rev-parse','HEAD')
 git(review,'fetch','origin');await reviewedMerge(review,target,await readFile(join(source,'README.md'),'utf8'),ownerNote)
 assert.equal(git(review,'merge-base','--is-ancestor',ownerCommit,'HEAD'),'')
 assert.equal(git(review,'merge-base','--is-ancestor',target,'HEAD'),'')
 assert.equal(await readFile(join(review,'src/ext/OWNER.md'),'utf8'),ownerNote)
 assert.ok((await readFile(join(review,'README.md'),'utf8')).includes(ownerNote))
 assert.ok((await readFile(ownerView,'utf8')).includes('data-owner-upgrade="reviewed"'))
 console.log('SAFE-007: merged upgrade preserves owner source and entered data')
 active=await launch(review,rer);({context,page}=await openOwner(active))
 await page.goto(active.origin+'/app')
 assert.deepEqual((await(await page.request.get(active.origin+'/api/state')).json()).tenancies,expected)
 await page.goto(active.origin+'/app?tab=tenancy&tenancy='+tenancyId);await picture(page,'upgraded-tenancy')
 assert.equal(await page.locator('[data-owner-upgrade="reviewed"]').count(),1,'the owner source customisation is rendered after upgrade')
 const unsigned=await fetch(active.origin+'/api/state');assert.equal(unsigned.status,401)
 // The public upgrade guide uses the existing docs screen and navigation.
 const docs=await browser.newPage();assert.ok(active.site,'rer dev exposes the run site')
 assert.equal((await docs.goto(active.site+'/docs/upgrades')).status(),200)
 const guides=await docs.locator('.guide-nav a').evaluateAll(links=>links.map(a=>new URL(a.href).pathname))
 for(const path of guides){
  assert.equal((await docs.goto(active.site+path)).status(),200)
  await picture(docs,path==='/docs/upgrades'?'upgrade-guide':'docs-'+(path.split('/').at(-1)||'index'))
 }
 await docs.close()
 const privateKey=new URL(active.open).hash.slice(1),sentinel=randomBytes(32).toString('hex')
 // Cloudflare credentials are deployment inputs, not local doctor failures.
 // Provoke a genuine missing local input and restore the private file exactly.
 const settingsPath=join(review,'.dev.vars'),settings=await readFile(settingsPath,'utf8')
 const missingOwner=settings.replace(/^OWNER_EMAIL=.*(?:\r?\n|$)/m,'')
 assert.notEqual(missingOwner,settings,'the fixture removes the saved local owner email')
 let diagnostic
 try {
  await writeFile(settingsPath,missingOwner)
  diagnostic=await command(review,process.execPath,[rer,'doctor','--json'],{status:3,env:{...commandEnv,MAIL_API_KEY:sentinel}})
 } finally {await writeFile(settingsPath,settings)}
 assert.ok(!diagnostic.includes(sentinel)&&!diagnostic.includes(privateKey),'health/doctor never publish private credentials')
 const events=diagnostic.trim().split('\n').filter(line=>line.startsWith('{')).map(line=>JSON.parse(line)),result=events.findLast(e=>e.event==='result')?.diagnostics
 assert.ok(result&&result.missingInputs.length>0,'doctor reports actionable missing local inputs')
 assert.deepEqual(result.missingInputs,['OWNER_EMAIL'],'doctor identifies the missing local setting')
 assert.ok(result.deploymentInputs.length>0,'doctor separately reports missing production inputs')
 assert.ok(result.deploymentInputs.every(name=>result.sources[name]),'production diagnostics point to repair instructions')
 await context.close();await active.stop();active=null
 await command(review,process.execPath,[rer,'export','--output',join(root,'after-upgrade.rer')])
 assert.ok((await readFile(join(root,'after-upgrade.rer'))).length>0)
 assert.deepEqual(outside,[],'the installed browser contacts no telemetry or remote license service')
 console.log('SAFE-007 passed: clean launch, empty setup, real tenancy, CLI backups, separate restore, reviewed upgrade preserving source/data, redacted diagnostics and browser no-egress')
} finally {await active?.stop();await browser.close();await rm(root,{recursive:true,force:true})}
