// OPEN-001: run precisely the public npm/repository door in an empty directory.
// Registry and Git acquisition are expected; the installed app sends nothing.
import assert from 'node:assert/strict'
import {mkdtemp,mkdir,rm} from 'node:fs/promises'
import {join,resolve} from 'node:path'
import {tmpdir} from 'node:os'
import {chromium} from '@playwright/test'
import {launchPublished} from './owned-process.mjs'

const root=await mkdtemp(join(tmpdir(),'terrace-open-')),screens=resolve(process.env.OPEN_SCREENSHOTS??'.rer/open-screens')
await mkdir(screens,{recursive:true})
let active,browser
try {
 console.log('OPEN-001: npx -y @runeditrun/rer dev just-every/run-terrace in an empty directory')
 active=await launchPublished(root)
 browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']})
 const context=await browser.newContext(),outside=[]
 await context.route('**/*',route=>{const u=new URL(route.request().url());if(['http:','https:'].includes(u.protocol)&&![active.origin,active.site].includes(u.origin)){outside.push(u.origin);return route.abort()}return route.continue()})
 const page=await context.newPage()
 await page.goto(active.open);await page.waitForURL(u=>u.pathname==='/setup')
 for(const [width,height]of [[1440,900],[390,844]]){
  await page.setViewportSize({width,height})
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth))
  await page.screenshot({path:join(screens,`published-setup-${width}.png`),fullPage:true})
 }
 await page.getByRole('checkbox').check();await page.getByRole('button',{name:'Finish setup'}).click()
 await page.goto(active.origin+'/app')
 const state=await(await page.request.get(active.origin+'/api/state')).json()
 assert.deepEqual(state.tenancies,[],'OPEN-001: the public command starts an empty owned installation')
 assert.deepEqual(state.portfolios,[],'OPEN-001: no demo portfolio or owner cap gate')
 for(const [width,height]of [[1440,900],[390,844]]){
  await page.setViewportSize({width,height})
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth))
  await page.screenshot({path:join(screens,`published-empty-${width}.png`),fullPage:true})
 }
 assert.equal((await fetch(active.origin+'/api/state')).status,401,'OPEN-001: the local runner owns the installation')
 assert.deepEqual(outside,[],'OPEN-001: no browser telemetry/license/paid gate requests')
 console.log('OPEN-001 passed: published command, owned setup, empty portfolio, no browser telemetry at 1440/390')
} finally {await browser?.close();await active?.stop();await rm(root,{recursive:true,force:true})}
