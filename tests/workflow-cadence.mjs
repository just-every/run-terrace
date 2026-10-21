// OPS-003: actual hourly delivery on an owned installed container runtime.
// This slow journey runs explicitly, outside push Verify. No fake clock, direct
// scheduled dispatch or Run now is used. The declared cron remains hourly.
import assert from 'node:assert/strict'
import {mkdir,writeFile,mkdtemp,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {randomBytes} from 'node:crypto'
import {createServer} from 'node:net'
import {spawn} from 'node:child_process'
import {buildContainer} from '../node_modules/@runeditrun/rer/modules/container/build.mjs'
import {startHost} from '../node_modules/@runeditrun/rer/modules/container/host.mjs'
import {resolve,join} from 'node:path'
import {setTimeout as delay} from 'node:timers/promises'
import {chromium} from '@playwright/test'
import {git} from './owned-process.mjs'
import {tenancyInput} from './api/harness.mjs'
const abort=new AbortController()
process.once('SIGTERM',()=>abort.abort())
const sha=git(process.cwd(),'rev-parse','HEAD')
assert.equal(git(process.cwd(),'status','--porcelain','--untracked-files=no'),'','Cadence needs a clean committed candidate')
const out=resolve(process.env.WORKFLOW_CADENCE_RESULTS??'.rer/workflow-cadence')
await mkdir(out,{recursive:true})
const runId='workflow-cadence-'+new Date().toISOString().replaceAll(/[:.]/g,'-')
const browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']})
let active,lock
const scratch=await mkdtemp(join(tmpdir(),'terrace-cadence-'))
try {
 const packaged=await buildContainer(process.cwd(),{output:join(scratch,'image'),engine:'workerd'})
 const socket=createServer();await new Promise(resolve=>socket.listen(0,'127.0.0.1',resolve));const port=socket.address().port;await new Promise(resolve=>socket.close(resolve))
 const origin='http://127.0.0.1:'+port,setup=randomBytes(32).toString('hex')
 await mkdir(join(scratch,'data'),{recursive:true})
 lock=spawn('flock',['--exclusive','--nonblock',join(scratch,'data/host.lock'),'sh','-c','echo locked; cat >/dev/null'],{stdio:['pipe','pipe','pipe']})
 await new Promise((resolve,reject)=>{lock.stdout.once('data',resolve);lock.once('error',reject);lock.once('exit',code=>reject(Error('Volume lock exited '+code)))})
 const host=await startHost({root:join(packaged.output,'app'),data:join(scratch,'data'),port,settings:{AUTH_ORIGIN:origin,AUTH_LOCAL:'true',OWNER_EMAIL:'owner@example.test',SESSION_SECRET:randomBytes(32).toString('hex'),SETUP_TOKEN:setup,MAIL_PROVIDER:'none',MAIL_FROM:'auth@localhost.test'}})
 active={origin,stop:()=>host.close()}
 const context=await browser.newContext(),page=await context.newPage()
 const boot=await context.request.post(origin+'/auth/bootstrap',{headers:{origin},data:{token:setup,displayName:'Cadence owner'},maxRedirects:0});assert.equal(boot.status(),303)
 await page.goto(origin+'/setup');await page.getByRole('checkbox').check();await page.getByRole('button',{name:'Finish setup'}).click()
 const get=async path=>{const r=await context.request.get(active.origin+path);assert.equal(r.status(),200);return r.json()}
 const command=async(command,fields)=>{const r=await context.request.post(active.origin+'/api/commands',{headers:{origin:active.origin},data:{command,...fields}});assert.equal(r.status(),200,await r.text());return (await r.json()).result}
 const owner=(await get('/auth/session')).operator.id
 const today=new Date().toISOString().slice(0,10)
 const lease=await command('tenancy.create',{...tenancyInput,tenantEmail:'cadence@example.test',timeZone:'America/New_York',startDate:'2025-01-01',endDate:'2036-12-31'})
 await command('rent.charge',{tenancyId:lease.id,dueDate:new Date(Date.now()-5*864e5).toISOString().slice(0,10),amount:'100.00',description:'Cadence overdue rent',reference:runId})
 const template=await command('workflow.template',{name:runId,kind:'rent',minDaysPastDue:1,steps:[{kind:'task',title:'Review balance',dueDays:2}],escalateTo:owner,reference:'synthetic-terrace-1'})
 const initial=await get('/api/workflows')
 assert.ok(initial.ready.some(r=>r.templateKey===template.templateKey&&r.subjects.some(s=>s.id===lease.id)),'The actual-clock fixture matches the rent reminder window before waiting')
 const startedAt=new Date().toISOString(),existing=new Set(initial.ticks.map(t=>t.id))
 console.log(JSON.stringify({runId,sha,startedAt,proof:'Waiting for two real hourly Cron deliveries; no manual dispatch'}))
 const deadline=Date.now()+125*60_000,seen=[]
 while(seen.length<2&&Date.now()<deadline){
  await delay(30_000,undefined,{signal:abort.signal})
  const catalog=await get('/api/workflows')
  for(const tick of catalog.ticks.filter(t=>t.id.startsWith('cron:')&&!existing.has(t.id)).sort((a,b)=>a.at.localeCompare(b.at))){
   existing.add(tick.id)
   assert.equal(tick.actor,'scheduler:workflows');assert.equal(tick.requested_by,null)
   const at=new Date(tick.at)
   assert.equal(at.getUTCMinutes(),0,'The actual delivered tick is on the declared hourly minute')
   assert.ok(Date.now()-at.getTime()<90_000,'The unattended receipt is readable within 90 seconds of delivery')
   seen.push({id:tick.id,at:tick.at,observedAt:new Date().toISOString(),detail:tick.detail})
   console.log(JSON.stringify({runId,sha,tick:seen.at(-1)}))
  }
  if(seen.length){
   const runs=catalog.runs.filter(r=>r.template_key===template.templateKey)
   assert.equal(runs.length,1,'The hourly sweep starts the matching run once')
   assert.equal(runs[0].subject_id,lease.id)
   assert.equal(runs[0].state,'running');assert.equal(runs[0].contacts,0)
   assert.ok(runs[0].next_action);assert.ok(!runs[0].events.some(e=>['attempt','reply','completed','closed','resumed'].includes(e.kind)))
  }
 }
 assert.equal(seen.length,2,'Two actual hourly deliveries must be observed')
 assert.ok(Math.abs(Date.parse(seen[1].at)-Date.parse(seen[0].at)-3600_000)<2000,'Consecutive unattended deliveries are one hour apart')
 await page.goto(active.origin+'/app?tab=workflows');await page.getByText('Sweep history',{exact:true}).click()
 for(const [width,height]of [[1440,900],[390,844]]){
  await page.setViewportSize({width,height});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth))
  await page.screenshot({path:join(out,'hourly-'+width+'.png'),fullPage:true})
 }
 const result={runId,sha,startedAt,finishedAt:new Date().toISOString(),runtime:'installed container runtime from rer 0.2.63; real wall clock; declared 0 * * * *',status:'passed',ticks:seen}
 await writeFile(join(out,runId+'.json'),JSON.stringify(result,null,2)+'\n')
 console.log(JSON.stringify(result))
 await context.close()
} finally {await active?.stop();if(lock){lock.stdin.end();await new Promise(resolve=>lock.exitCode!==null?resolve():lock.once('exit',resolve))}await browser.close();await rm(scratch,{recursive:true,force:true})}
