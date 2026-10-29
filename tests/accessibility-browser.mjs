import assert from 'node:assert/strict'
import {mkdir} from 'node:fs/promises'
import {join,resolve} from 'node:path'
import {pathToFileURL} from 'node:url'
import {chromium} from '@playwright/test'
import {installation,tenancyInput} from './api/harness.mjs'

export const launchOptions={headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{}),args:['--no-sandbox','--use-mock-keychain','--password-store=basic']}
export async function keyboardTo(page,target){
 for(let n=0;n<100;n++){
  if(await target.evaluate(el=>el===document.activeElement))return
  await page.keyboard.press('Tab')
 }
 assert.fail('Keyboard traversal did not reach '+await target.evaluate(el=>el.outerHTML))
}
export async function visibleFocus(target){
 const proof=await target.evaluate(el=>{
  const r=el.getBoundingClientRect(),style=getComputedStyle(el),x=Math.max(0,Math.min(innerWidth-1,r.x+r.width/2)),y=Math.max(0,Math.min(innerHeight-1,r.y+r.height/2)),top=document.elementFromPoint(x,y)
  return {label:el.textContent.trim(),focused:el===document.activeElement,left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:innerWidth,height:innerHeight,outline:parseFloat(style.outlineWidth),unobscured:el.contains(top)||top?.contains(el)}
 })
 assert.ok(proof.focused&&proof.left>=0&&proof.right<=proof.width&&proof.top>=0&&proof.bottom<=proof.height&&proof.outline>=2&&proof.unobscured,'Keyboard focus is visible and unobscured: '+JSON.stringify(proof))
}
export async function landmarks(page){
 await page.getByRole('main',{name:(await page.getByRole('heading',{level:1}).innerText()).replace(/\.$/,'')}).waitFor()
 await page.keyboard.press('Tab');const skip=page.getByRole('link',{name:'Skip to content',exact:true})
 assert.ok(await skip.evaluate(el=>el===document.activeElement))
 await page.keyboard.press('Enter');assert.ok(await page.getByRole('main').evaluate(el=>el===document.activeElement))
}
export async function invalidForm(page,form,field,label){
 await keyboardTo(page,form.getByRole('button',{name:/Continue to Stripe|Submit repair request|Prepare for approval/}));await page.keyboard.press('Enter')
 const summary=form.getByRole('alert');await summary.waitFor()
 assert.ok(await summary.evaluate(el=>el===document.activeElement))
 assert.equal(await field.getAttribute('aria-invalid'),'true')
 const described=await field.getAttribute('aria-describedby');assert.ok(described)
 const error=page.locator('[id="'+described.split(' ').at(-1)+'"]');assert.ok((await error.innerText()).length>0)
 const ax=await page.context().newCDPSession(page)
 try{
  const {nodes}=await ax.send('Accessibility.getFullAXTree'),node=nodes.find(n=>n.name?.value===label&&n.properties?.some(p=>p.name==='invalid'&&p.value.value==='true'))
  assert.ok(node,'Accessibility tree exposes the invalid field by its stable name')
  assert.ok(node.description?.value?.includes(await error.innerText()),'Accessible description contains the visible validation error')
 }finally{await ax.detach()}
 await keyboardTo(page,summary.getByRole('link').first());await page.keyboard.press('Enter');await visibleFocus(field)
}
export async function screenshots(page,name,out){
 for(const [width,height]of [[1440,900],[390,844]]){await page.setViewportSize({width,height});await page.screenshot({path:join(out,`${name}-${width}.png`),fullPage:true})}
}
async function workJourney(){
 const out=resolve(process.env.ACCESSIBILITY_SCREENSHOTS??'.rer/accessibility-screens');await mkdir(out,{recursive:true})
 const mail=n=>['synthetic-terrace-'+n,'localhost.test'].join('@')
 const h=await installation({assets:true,asyncDatabase:true,now:'2026-10-26T12:00:00.000Z'}),browser=await chromium.launch(launchOptions)
 try{
  const portfolio=await h.command('portfolio.add',{name:'Accessible homes'}),other=await h.command('portfolio.add',{name:'Separate homes'})
  const property=await h.command('property.add',{portfolioId:portfolio.id,name:'Alder',address:'1 Alder Street, Oakland, CA',kind:'duplex',timeZone:'America/Los_Angeles'})
  const unit=await h.command('unit.add',{propertyId:property.id,identifier:'1',bedrooms:2,bathrooms:1}),t=await h.command('tenancy.create',{...tenancyInput,unitId:unit.id})
  const admin=await h.invite('admin',mail(91)),member=await h.invite('member',mail(92))
  await h.stepUp();await h.command('operator.invite',{displayName:'Other portfolio manager',email:mail(93),role:'portfolio_manager',['portfolio:'+other.id]:'1'});const outsider=await h.accept(mail(93))
  const vendor=await h.command('vendor.add',{name:'Alder Repairs',email:mail(94),phone:'510-555-0190',specialties:'plumbing',serviceAreas:'Oakland',w9:'received',insuranceExpires:'2036-12-31',licenseNumber:'PL-240',licenseExpires:'2036-12-31',availability:'Weekdays',rate:'95',standing:'approved'})
  const job=await h.command('maintenance.prepare',{tenancyId:t.id,title:'Repair accessible entry handle',trade:'plumbing',vendorId:vendor.id,dueDate:'2026-11-20',estimate:'180.00'})
  const before=(await h.state(t.id)).work.jobs.find(j=>j.id===job.id)
  for(const [as,status]of [[outsider,404],[member,403]]){
   const context=await browser.newContext({viewport:{width:1440,height:900}});await context.addCookies(as.split('; ').map(p=>({name:p.split('=')[0],value:p.slice(p.indexOf('=')+1),url:h.origin})));const page=await context.newPage()
   try{assert.equal((await page.goto(h.origin+'/app?tab=work&tenancy='+t.id)).status(),as===member?200:status);assert.equal(await page.getByRole('button',{name:'Approve maintenance',exact:true}).count(),0);const refused=await page.request.post(h.origin+'/app/command',{form:{command:'maintenance.approve',tenancyId:t.id,tab:'work',jobId:job.id,version:String(before.version)},headers:{origin:h.origin}});assert.equal(refused.status(),status)}finally{await context.close()}
   await h.command('maintenance.approve',{jobId:job.id,version:before.version},{as,status})
   const after=(await h.state(t.id)).work.jobs.find(j=>j.id===job.id);assert.equal(after.state,before.state);assert.equal(after.version,before.version);assert.equal(after.approval_snapshot,before.approval_snapshot)
  }
  const context=await browser.newContext({viewport:{width:1440,height:900}});await context.addCookies(admin.split('; ').map(p=>({name:p.split('=')[0],value:p.slice(p.indexOf('=')+1),url:h.origin})));const page=await context.newPage()
  try{
   await page.goto(h.origin+'/app?tab=work&tenancy='+t.id);await landmarks(page)
   const card=page.getByRole('article',{name:'Repair accessible entry handle',exact:true}),approve=card.getByRole('button',{name:'Approve maintenance',exact:true})
   await keyboardTo(page,approve);await visibleFocus(approve);await screenshots(page,'work-review',out)
   await page.setViewportSize({width:1440,height:900});const response=page.waitForResponse(r=>r.request().method()==='POST'&&new URL(r.url()).pathname==='/app/command');await page.keyboard.press('Enter');const submitted=await response;assert.equal(submitted.status(),303,submitted.status()===303?'':(await submitted.text()).match(/<div role="status" class="notice">([^<]+)/)?.[1]??'Approval failed');await page.getByRole('status').filter({hasText:/approved/i}).waitFor()
   const approved=(await h.state(t.id)).work.jobs.find(j=>j.id===job.id);assert.equal(approved.state,'approved');assert.ok(approved.approval_snapshot.includes('Repair accessible entry handle'));assert.equal(approved.approved_version,before.version)
   const replay=await page.request.post(h.origin+'/app/command',{form:{command:'maintenance.approve',tenancyId:t.id,tab:'work',jobId:job.id,version:String(before.version)},headers:{origin:h.origin}});assert.equal(replay.status(),409);assert.equal((await h.state(t.id)).work.jobs.find(j=>j.id===job.id).approval_snapshot,approved.approval_snapshot);await card.getByText('Approval evidence',{exact:true}).waitFor();await screenshots(page,'work-approved',out)
   await page.setViewportSize({width:390,height:844});await page.goto(h.origin+'/app?tab=work&tenancy='+t.id)
   // The phone smoke includes every header link, even links scrolled horizontally.
   for(const link of await page.locator('.app-nav a').all()){await keyboardTo(page,link);await visibleFocus(link)}
   const person=page.getByRole('link',{name:'Manage people',exact:true});await keyboardTo(page,person);await visibleFocus(person)
   assert.equal(await page.getByRole('tooltip',{name:'Manage people',exact:true}).evaluate(el=>getComputedStyle(el).visibility),'visible')
   await screenshots(page,'staff-focus',out)
  }finally{await context.close()}
 }finally{await browser.close();await h.close()}
 console.log('Accessible work approval: keyboard completion, exact snapshot, role and portfolio refusals; phone focus smoke passed.')
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)await workJourney()
