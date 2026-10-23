// PORT-009 uses ROLE-002's existing live vendor grant; it adds no grant or submission authority.
import {all,escape as e,one,recordRead,type Row} from './core'
import {current,portalContext} from './portal-session'
import {mediaBytes} from './field-evidence-media'
import {shell} from './portal-view'
import type {Bindings} from '../auth.server'
export async function portalMedia(request:Request,env:Bindings) {
 const url=new URL(request.url),headers={'cache-control':'private, no-store','x-content-type-options':'nosniff','referrer-policy':'strict-origin','content-security-policy':"default-src 'none'; style-src 'self'; font-src 'self'; img-src 'self'; frame-ancestors 'none'"}
 const fail=(status:number)=>Response.json({error:status===401?'unauthorized':'not_found'},{status,headers})
 if(url.origin!==env.AUTH_ORIGIN||request.method!=='GET')return fail(404)
 const now=new Date().toISOString(),p=await current(env.DB,request.headers.get('cookie'),now)
 if(!p)return fail(401)
 if(p.identity.kind!=='vendor')return fail(404)
 const c=portalContext(env.DB,p,now),vendors=p.grants.filter(g=>g.access==='vendor').map(g=>g.vendor_id)
 const visible=async(r:Row)=>{
  if(r.job_id){const j=await one(c,"SELECT j.vendor_id FROM tt_maintenance_jobs j JOIN tt_tenancies t ON t.id=j.tenancy_id WHERE j.id=? AND j.state IN ('approved','sent') AND t.erased_at IS NULL",r.job_id);return j&&vendors.includes(j.vendor_id)}
  if(r.bill_id){const b=await one(c,'SELECT vendor_id FROM tt_bills WHERE id=?',r.bill_id);return b&&vendors.includes(b.vendor_id)}
  return false
 }
 if(url.searchParams.has('file')){
  const r=await one(c,"SELECT * FROM tt_record_media WHERE id=? AND state='ready'",url.searchParams.get('file'))
  if(!r||!await visible(r))return fail(404)
  const bytes=await mediaBytes(c,r);await recordRead(c,'read:record-media',r.id)
  return new Response(bytes,{headers:{...headers,'content-type':r.media_type,'content-disposition':`attachment; filename*=UTF-8''${encodeURIComponent(r.name)}`,'x-content-sha256':r.sha256,'content-security-policy':"default-src 'none'; sandbox"}})
 }
 const files=[]
 for(const r of await all(c,"SELECT id,job_id,bill_id,name,version,size,sha256 FROM tt_record_media WHERE state='ready' ORDER BY uploaded_at,id"))if(await visible(r))files.push(r)
 return new Response(shell('Your work and invoice attachments',`<section><h2>Original attachments</h2><p>Only work currently assigned to your vendor and your vendor’s invoices appear here.</p><ul>${files.map(r=>`<li><a href="/portal/record-media?file=${e(r.id)}">${e(r.name)}</a> · version ${r.version} · ${r.size} bytes · SHA-256 <code>${e(r.sha256)}</code></li>`).join('')}</ul><a href="/portal">Back to your portal</a></section>`),{headers:{...headers,'content-type':'text/html;charset=utf-8'}})
}
