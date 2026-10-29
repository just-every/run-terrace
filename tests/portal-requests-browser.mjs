import assert from 'node:assert/strict'
import {mkdir} from 'node:fs/promises'
import {resolve,join} from 'node:path'
import {chromium} from '@playwright/test'
import {journey} from './portal-requests.mjs'
import {launchOptions,landmarks,invalidForm,keyboardTo,visibleFocus} from './accessibility-browser.mjs'
const out=resolve(process.env.REQUEST_SCREENSHOTS??'.rer/request-screens');await mkdir(out,{recursive:true})
const browser=await chromium.launch(launchOptions)
const shoot=async(page,name)=>{for(const [width,height] of [[1440,900],[390,844]]){await page.setViewportSize({width,height});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),name+' fits '+width);await page.screenshot({path:join(out,`${name}-${width}.png`),fullPage:true})}}
try {await journey({assets:true,inspect:async({phase,r,t,resident,path})=>{
 const context=await browser.newContext({viewport:{width:1440,height:900}});await context.addCookies([{name:'tt_portal',value:resident.split('=')[1],url:r.origin}]);const page=await context.newPage()
 try {
  if(phase==='intake') {
   await page.goto(r.origin+'/portal/repairs?tenancy='+t.id)
   await landmarks(page)
   const form=page.getByRole('form',{name:'Request a repair',exact:true}),description=form.getByRole('textbox',{name:'Describe the issue',exact:true})
   await invalidForm(page,form,description,'Describe the issue');await page.keyboard.type('Bathroom handle repair')
   assert.equal(await description.getAttribute('aria-invalid'),null)
   await keyboardTo(page,page.getByRole('textbox',{name:'Access restrictions',exact:true}));await page.keyboard.type('Call me first')
   await keyboardTo(page,page.getByRole('textbox',{name:'Pets',exact:true}));await page.keyboard.type('No pets')
   await keyboardTo(page,page.getByRole('textbox',{name:'Preferred times',exact:true}));await page.keyboard.type('Weekday afternoons')
   await page.getByLabel('Photo or video (up to 5 MB)').setInputFiles({name:'browser-video.mp4',mimeType:'video/mp4',buffer:Buffer.from([0,0,0,16,102,116,121,112,105,115,111,109,0,0,0,0])})
   await shoot(page,'resident-intake')
   await page.setViewportSize({width:1440,height:900});const submit=page.getByRole('button',{name:'Submit repair request'});await keyboardTo(page,submit);await visibleFocus(submit);assert.equal(await form.getByRole('alert').isVisible(),false);await page.keyboard.press('Enter');await page.waitForURL(/\/portal\/repair\?id=/)
   await page.getByRole('status').waitFor();await shoot(page,'resident-received')
   await page.goto(r.origin+'/portal/lease?tenancy='+t.id);await shoot(page,'resident-lease-repairs')
  } else {
   await page.goto(r.origin+path);await page.getByRole('heading',{name:'Repair tracking',exact:true}).waitFor();await shoot(page,'resident-'+phase)
   if(phase==='scheduled'||phase==='emergency') {
    const staff=await browser.newContext({viewport:{width:1440,height:900}});await staff.addCookies(r.cookie.split('; ').map(x=>({name:x.slice(0,x.indexOf('=')),value:x.slice(x.indexOf('=')+1),url:r.origin})));const sp=await staff.newPage();await sp.goto(r.origin+'/app?tab=settings')
    if(phase==='emergency'){await sp.goto(r.origin+'/app?tab=emergencies');await sp.getByText('Gas smell in kitchen',{exact:true}).waitFor();await shoot(sp,'staff-emergency');await staff.close();return}
    const section=sp.locator('section').filter({has:sp.getByRole('heading',{name:'Resident repair requests',exact:true})}).last();await section.waitFor()
    for(const [width,height] of [[1440,900],[390,844]]){await sp.setViewportSize({width,height});await section.getByRole('link',{name:'Review original tap.png'}).first().waitFor();await section.screenshot({path:join(out,`staff-requests-${width}.png`)});const person=sp.getByRole('link',{name:'Manage people',exact:true}),tip=sp.getByRole('tooltip',{name:'Manage people',exact:true});await person.hover();await sp.waitForTimeout(350);await tip.waitFor({state:'visible'});await sp.mouse.move(0,0);await person.focus();await tip.waitFor({state:'visible'});await sp.screenshot({path:join(out,`staff-tooltip-${width}.png`),fullPage:true})}
    await staff.close()
   }
  }
  // The touched portal pages use text-labelled controls; every button exposes its visible purpose.
  for(const button of await page.getByRole('button').all())assert.ok((await button.innerText()).trim(),'buttons have visible labels')
 } finally {await context.close()}
}})} finally {await browser.close()}
console.log('resident request screens passed at 1440 and 390')
