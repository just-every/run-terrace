import assert from 'node:assert/strict'
import {mkdir} from 'node:fs/promises'
import {join} from 'node:path'

export const screenshots = process.env.DEMO_SCREENSHOTS || 'artifacts/demo'
export async function capture(page, name, locator) {
 await mkdir(screenshots, {recursive:true})
 for (const width of [1440,390]) {
  await page.setViewportSize({width,height:900})
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth), `${name} fits its viewport`)
  const path=join(screenshots,`${name}-${width}.png`)
  if(locator) await locator.screenshot({path})
  else await page.screenshot({path})
 }
}
export async function read(context, origin, path='/api/state') {
 const response=await context.request.get(origin+path)
 assert.equal(response.status(),200,`DEMO-001 reads ${path.split('?')[0]}`)
 return response.json()
}
export async function start(browser, origin, measurement, name) {
 const context=await browser.newContext({viewport:{width:1440,height:900}})
 await context.addCookies([{name:'rer_demo_measure',value:measurement,url:origin,secure:true,httpOnly:true,sameSite:'Strict'}])
 const page=await context.newPage()
 page.setDefaultTimeout(60000)
 const network=[]
 page.on('requestfailed',request=>network.push(`${new URL(request.url()).origin}${new URL(request.url()).pathname}: ${request.failure()?.errorText}`))
 page.on('response',response=>{const path=new URL(response.url()).pathname;if(path.startsWith('/__demo/'))network.push(`${path}: ${response.status()}`)})
 try {
  assert.equal((await page.goto(origin)).status(),200)
  // The real widget runs with the official test host's published test keys.
  // Its normal callback submits the form; no token or callback is injected.
  await Promise.race([
   page.waitForURL(url=>url.pathname==='/app',{timeout:180000}),
   page.locator('#start[data-state="failed"] #notice:visible').waitFor({timeout:180000}).then(async()=>{throw Error(await page.locator('#notice').innerText())}),
  ])
  assert.equal((await read(context,origin)).actor.role,'owner')
  return {context,page}
 } catch(error) {
  let notice=''
  const location=new URL(page.url()).pathname
  try {
   await capture(page,`${name}-admission-failure`)
   notice=await page.evaluate(()=>document.getElementById('notice')?.textContent??'')
  } finally {await stop({context},origin)}
  throw new Error(`DEMO-001 ${name} admission failed at ${location}: ${notice||'no start-page notice'}; network: ${network.slice(-20).join('; ')}`,{cause:error})
 }
}
export async function stop(visitor, origin) {
 if(!visitor)return
 try {
  const response=await visitor.context.request.post(origin+'/__demo/cancel',{headers:{origin}})
  assert.equal(response.status(),204,'DEMO-001 destroys its visitor copy')
 } finally {await visitor.context.close()}
}
export const detail = (origin,id,tab='tenancy') => `${origin}/app?tab=${tab}&tenancy=${encodeURIComponent(id)}`
