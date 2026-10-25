// PORT-007 and ROLE-002 native screens at 1440 and 390: the Documents page (search, upload, new version), the staff portal-access section and each portal person's pages.
import assert from 'node:assert/strict'
import {mkdir,writeFile} from 'node:fs/promises'
import {resolve,join} from 'node:path'
import {chromium} from '@playwright/test'
import {journey as documents} from './documents.mjs'
import {journey as portal} from './portal.mjs'
const out=resolve(process.env.DOCUMENT_SCREENSHOTS??'.rer/document-screens');await mkdir(out,{recursive:true})
const browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']})
const open=async(origin,cookie,names)=>{const context=await browser.newContext();await context.addCookies(cookie.split('; ').map(pair=>{const i=pair.indexOf('=');return{name:pair.slice(0,i),value:pair.slice(i+1),url:origin}}));return {context,page:await context.newPage()}}
const shoot=async(page,name)=>{for(const [width,height] of [[1440,900],[390,844]]){await page.setViewportSize({width,height});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),name+' fits '+width);await page.screenshot({path:join(out,`${name}-${width}.png`),fullPage:true})}}
try{
 await documents({assets:true,inspect:async({r,north,staff})=>{
  const {context,page}=await open(r.origin,r.cookie)
  await page.goto(r.origin+'/app?tab=documents&q=4B');await page.getByRole('heading',{name:'Documents',exact:true,level:2}).waitFor()
  assert.ok(await page.getByText('Lease with amendments').count()>0);assert.ok(await page.getByRole('link',{name:'Download original'}).count()>0)
  await shoot(page,'documents-search')
  const upload=page.locator('details:has(summary:text("Upload a document"))');await upload.locator('summary').click()
  await upload.locator('select[name=tenancyId]').selectOption(north.t.id);await upload.locator('select[name=kind]').selectOption('notice')
  await upload.locator('input[name=title]').fill('Pest treatment notice');await upload.locator('input[name=source]').fill('Posted at the door 5 Nov')
  const noteFile=join(out,'pest-notice.txt');await writeFile(noteFile,'Pest treatment on Friday between 9 and 11');await upload.locator('input[name=file]').setInputFiles(noteFile)
  await shoot(page,'documents-upload-open')
  await Promise.all([page.waitForURL(/tab=documents/),upload.getByRole('button',{name:'Store document'}).click()])
  await page.goto(r.origin+'/app?tab=documents&q=pest+treatment');assert.ok(await page.getByText('Pest treatment notice').count()>0,'a native upload is found by its content');assert.ok(await page.getByText(/Found by its details/).count()===0)
  await shoot(page,'documents-content-hit')
  await page.goto(r.origin+'/app?tab=documents&q=4B');const revise=page.locator('article:has-text("Lease with amendments") details:has(summary:text("Upload a new version"))').first();await revise.locator('summary').click()
  await shoot(page,'documents-new-version');await context.close()
  for(const role of ['leasing','accountant']){
   const {context,page}=await open(r.origin,staff[role]);await page.goto(r.origin+'/app?tab=documents')
   assert.equal(await page.getByRole('heading',{name:'Screening report',exact:true}).count(),0)
   if(role==='accountant'){
    await page.getByRole('heading',{name:'Owner 1099 copy',exact:false}).waitFor()
    assert.equal(await page.getByText('Upload a document',{exact:true}).count(),0)
    assert.equal(await page.getByText('Upload a new version',{exact:true}).count(),0)
   }else{
    await page.getByRole('heading',{name:'Rental application',exact:false}).waitFor()
    assert.equal(await page.getByRole('heading',{name:'Owner 1099 copy',exact:false}).count(),0)
   }
   await shoot(page,'documents-'+role);await context.close()
  }
 }})
 await portal({assets:true,revokeDelegate:async({r,north,cookies})=>{
  await r.request('/portal/signin',{method:'POST',as:'',form:new URLSearchParams({email:'northres@example.test'})})
  const context=await browser.newContext(),page=await context.newPage();await page.goto(r.origin+'/portal/accept?token='+r.portalToken('northres@example.test'))
  await shoot(page,'portal-open-link');await page.getByRole('button',{name:'Continue',exact:true}).click();await page.waitForURL(r.origin+'/portal')
  await page.goto(r.origin+'/portal/lease?tenancy='+north.id)
  await page.getByRole('button',{name:'Revoke access',exact:true}).click();await page.getByRole('status').waitFor()
  assert.equal(await page.getByRole('button',{name:'Revoke access',exact:true}).count(),0)
  await shoot(page,'portal-delegate-revoked');await context.close()
 },inspect:async({phase,r,north,cookies})=>{
  if(phase==='staff-portal'){const {context,page}=await open(r.origin,r.cookie);await page.goto(r.origin+'/app?tab=settings');await page.getByRole('heading',{name:'Portal access',exact:true,level:2}).waitFor();await page.locator('details:has(summary:text("Invite a resident"))').locator('summary').click();await shoot(page,'portal-staff-access');for(const [width,height] of [[1440,900],[390,844]]){await page.setViewportSize({width,height});await page.locator('details:has(summary:text("Invite a resident"))').screenshot({path:join(out,`portal-staff-invite-form-${width}.png`)})}await context.close()}
  if(phase==='vendor-response'){
   const {context,page}=await open(r.origin,cookies.vendor1)
   await page.goto(r.origin+'/portal/work');await page.getByRole('heading',{name:'Your work',exact:true}).waitFor()
   await page.getByRole('checkbox').check();await shoot(page,'vendor-response-review')
   await page.getByRole('button',{name:'Accept work',exact:true}).click()
   await page.getByRole('status').filter({hasText:'Your response: accepted'}).waitFor();await shoot(page,'vendor-response-accepted')
   await context.close()
  }
  if(phase==='portal-people')for(const [name,cookie,path] of [['resident',cookies.resident,'/portal/lease?tenancy='+north.id],['delegate',cookies.delegate,'/portal/lease?tenancy='+north.id],['owner',cookies.owner1,'/portal/owner'],['sold-owner',cookies.owner2,'/portal/owner'],['sold-owner-statement',cookies.owner2,'/portal/owner-statement?from=2026-10-01&to=2026-12-31'],['owner-statement',cookies.owner1,'/portal/owner-statement?from=2026-01-01&to=2026-12-31'],['vendor',cookies.vendor2,'/portal/work'],['home',cookies.resident,'/portal']]){const {context,page}=await open(r.origin,cookie);await page.goto(r.origin+path);await page.getByRole('heading',{level:1}).waitFor();if(name==='delegate')assert.equal(await page.getByRole('heading',{name:'Recorded payments'}).count(),0);await shoot(page,'portal-'+name);await context.close()}
  if(phase==='portal-revoked'){const {context,page}=await open(r.origin,cookies.resident);await page.goto(r.origin+'/portal/lease?tenancy='+north.id);assert.equal(new URL(page.url()).pathname,'/portal/signin');await shoot(page,'portal-access-ended');await context.close()}
 }})
}finally{await browser.close()}
