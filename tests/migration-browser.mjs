import assert from 'node:assert/strict'
import {mkdir} from 'node:fs/promises'
import {resolve,join} from 'node:path'
import {chromium} from '@playwright/test'
import {journey} from './migration.mjs'
const out=resolve(process.env.MIGRATION_SCREENSHOTS??'.rer/migration-screens');await mkdir(out,{recursive:true})
const browser=await chromium.launch({headless:true,...(process.env.RER_CHROMIUM_PATH?{executablePath:process.env.RER_CHROMIUM_PATH}:{}),args:['--no-sandbox','--use-mock-keychain','--password-store=basic']})
async function capture(page,name){
 const control=page.getByRole('link',{name:'Manage people',exact:true})
 await control.focus();await page.waitForTimeout(30);assert.equal(await control.locator('[role=tooltip]').evaluate(el=>getComputedStyle(el).opacity),'1')
 await page.getByRole('heading',{name:'Move in',exact:true}).click();await control.hover();await page.waitForTimeout(400);assert.equal(await control.locator('[role=tooltip]').evaluate(el=>getComputedStyle(el).opacity),'1')
 for(const [width,height]of [[1440,900],[390,844]]){
  await page.setViewportSize({width,height})
  await page.screenshot({path:join(out,name+'-'+width+'.png'),fullPage:true})
 }
 await page.setViewportSize({width:1440,height:900})
}
try{
 await journey({assets:true,inspect:async({h,manifest,review,applied,leases,phase})=>{
  const context=await browser.newContext({viewport:{width:1440,height:900}})
  try{
   await context.addCookies(h.cookie.split('; ').map(pair=>{const at=pair.indexOf('=');return{name:pair.slice(0,at),value:pair.slice(at+1),url:h.origin}}))
   const page=await context.newPage();await page.goto(h.origin+'/app?tab=import')
   if(phase==='preview'){
    await page.getByLabel('Complete migration manifest',{exact:true}).fill(JSON.stringify(manifest))
    await page.getByRole('button',{name:'Preview complete migration',exact:true}).click()
    await page.getByRole('heading',{name:'Review complete migration',exact:true}).waitFor()
    assert.ok((await page.getByRole('table',{name:'Source inventory reconciliation'}).innerText()).toLowerCase().includes('lease'))
    const tie=page.getByRole('table',{name:'Opening account tie-out (USD)'})
    assert.equal(await tie.locator('tbody tr').count(),11)
    assert.equal(await page.getByRole('button',{name:'Approve exact migration manifest',exact:true}).count(),1)
    assert.ok((await page.content()).includes(review.migrationPreview.fingerprint))
    assert.ok((await page.content()).includes('Commercial source stays in its specialist system'))
    await capture(page,'migration-review')
   }else{
    const history=page.locator('form').filter({has:page.locator('[name=migrationId][value="'+applied.migration.id+'"]')})
    await history.getByRole('button',{name:'Inspect retained manifest and tie-out',exact:true}).click()
    await page.getByRole('heading',{name:'Retained migration '+applied.migration.id,exact:true}).waitFor()
    assert.equal(await page.getByRole('table',{name:'Opening account tie-out (USD)'}).locator('tbody tr').count(),11)
    await capture(page,'migration-retained')
    await page.goto(h.origin+'/app?tab=ledger&tenancy='+leases[0].targetId)
    await page.getByRole('heading',{name:'Migrated resident history',exact:true}).waitFor()
    const section=page.locator('section').filter({has:page.getByRole('heading',{name:'Migrated resident history',exact:true})}).last()
    assert.ok((await section.innerText()).includes('$240.00'))
    assert.ok((await section.innerText()).includes('synthetic-terrace-13'))
    for(const [width,height]of [[1440,900],[390,844]]){await page.setViewportSize({width,height});await page.screenshot({path:join(out,'migration-ledger-'+width+'.png'),fullPage:true})}
   }
  }finally{await context.close()}
 }})
 console.log('MOVE-001 native migration screens passed at 1440; browser proof captured at 1440 and 390.')
}finally{await browser.close()}
