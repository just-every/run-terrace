import type {Bindings} from '../auth.server'
import {Fault,insist,type Context,type Row} from './core'
import {publicListings,submitEnquiry} from './listings'
import {vacanciesView,vacancyShell} from './listing-view'
const headers={'cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer','content-security-policy':"default-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'; style-src 'self'; font-src 'self'; img-src 'self'; script-src 'self'; connect-src 'self'"}
const html=(body:string,status=200)=>new Response(body,{status,headers:{...headers,'content-type':'text/html;charset=utf-8'}})
const json=(body:unknown,status=200)=>Response.json(body,{status,headers})
export async function listingResponse(request:Request,env:Bindings) {
 const url=new URL(request.url),match=/^\/vacancies(?:\/(api))?(?:\/([a-f0-9-]+))?(?:\/(enquire))?\/?$/.exec(url.pathname),api=!!match?.[1]||(request.method==='POST'&&request.headers.get('content-type')?.includes('application/json'))
 try {
  insist(match,'not_found','Listing not found.',404)
  insist(url.origin===env.AUTH_ORIGIN,'origin','Installation origin required.',403)
  insist(['GET','POST'].includes(request.method),'method','Use GET or POST.',405)
  const c:Context={db:env.DB,now:new Date().toISOString(),actor:{id:'visitor:own-site',role:'member',displayName:'Unverified visitor'}}
  const listingId=match[2]
  if(request.method==='POST') {
   insist(listingId&&match[3]&&!match[1],'not_found','Listing not found.',404)
   insist(!request.headers.get('authorization'),'credential_scope','Use the public enquiry form.',403)
   insist(request.headers.get('origin')===env.AUTH_ORIGIN&&request.headers.get('sec-fetch-site')!=='cross-site','origin','Same-origin confirmation required.',403)
   const raw=await request.text()
   insist(new TextEncoder().encode(raw).length<=16384,'body_limit','Enquiry is too large.',413)
   let p:Row
   try {p=api?JSON.parse(raw):Object.fromEntries(new URLSearchParams(raw))}catch{throw new Fault('input','Send a valid enquiry.')}
   insist(p&&typeof p==='object'&&!Array.isArray(p),'input','Send a valid enquiry.')
   const result=await submitEnquiry(c,listingId,p)
   if(api)return json(result,202)
   return html(vacancyShell('Enquiry received','<section role="status"><p>Your enquiry was received for staff review. No application or payment was started.</p><a href="/vacancies">Back to available homes</a></section>'),202)
  }
  insist(!match[3],'not_found','Listing not found.',404)
  const listings=await publicListings(c,listingId)
  const list=Array.isArray(listings)?listings:(listings as Row).listings
  const selected=listingId?list.find((x:Row)=>x.id===listingId):undefined
  insist(!listingId||selected,'not_found','Listing not found.',404)
  return api?json(listingId?selected:{listings:list}):html(vacanciesView(list,selected))
 }catch(error) {
  if(error instanceof Fault)return api?json({error:error.code,message:error.message},error.status):html(vacancyShell('Enquiry needs attention',`<section><p role="alert">${error.message.replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]!))}</p><a href="/vacancies">Back to available homes</a></section>`),error.status)
  throw error
 }
}
