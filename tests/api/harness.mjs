import {Miniflare,convertV4MiniflareOptions} from 'miniflare'
import {unstable_splitSqlQuery} from 'wrangler'
import {build} from 'esbuild'
import {mkdtemp,readFile,readdir,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {randomBytes} from 'node:crypto'
import assert from 'node:assert/strict'
export async function installation(){
 const root=await mkdtemp(join(tmpdir(),'terrace-api-')),bundle=await build({entryPoints:['tests/api/worker.ts'],bundle:true,write:false,format:'esm',platform:'neutral',target:'es2022',external:['node:*','cloudflare:*'],loader:{'.css':'text','.svg':'text'}})
 const secret=()=>randomBytes(32).toString('hex'),setup=secret(),devKey=secret(),sessionSecret=secret()
 const messages=[]
 let origin='http://localhost'
 const options=port=>({...convertV4MiniflareOptions({host:'127.0.0.1',port,modules:true,script:bundle.outputFiles[0].text,compatibilityDate:'2026-09-08',compatibilityFlags:['nodejs_compat'],d1Databases:['DB'],bindings:{AUTH_LOCAL:'true',AUTH_ORIGIN:origin,OWNER_EMAIL:'owner@example.test',SESSION_SECRET:sessionSecret,SETUP_TOKEN:setup,MAIL_PROVIDER:'resend',MAIL_API_KEY:'example-test-mail',MAIL_FROM:'auth@localhost.test',RER_DEV_KEY:devKey},outboundService:async request=>{assert.equal(new URL(request.url).hostname,'api.resend.com');messages.push(await request.json());return Response.json({id:crypto.randomUUID()})}}),resourcePersistencePath:root})
 const mf=new Miniflare(options(0));let cookie=''
 try {
  const address=await mf.ready;origin=address.origin;await mf.setOptions(options(Number(address.port)))
  const db=await mf.getD1Database('DB')
  for(const f of (await readdir('migrations/core')).filter(f=>f.endsWith('.sql')).sort()){await db.batch(unstable_splitSqlQuery(await readFile('migrations/core/'+f,'utf8')).map(q=>db.prepare(q)))}
  const request=(path,{method='GET',body,as=cookie,originHeader=origin,form,headers={}}={})=>fetch(origin+path,{method,redirect:'manual',headers:{origin:originHeader,...(!form?{'content-type':'application/json'}:{}),...(as?{cookie:as}:{}),...headers},...(form?{body:form}:body!==undefined?{body:JSON.stringify(body)}:{})})
  const boot=await request('/auth/bootstrap',{method:'POST',body:{token:setup,displayName:'Terrace owner'}});assert.equal(boot.status,303,await boot.text());cookie=boot.headers.getSetCookie().map(v=>v.split(';')[0]).join('; ')
  const first=await request('/setup',{method:'POST',form:new URLSearchParams({confirm:'yes'})});assert.equal(first.status,303)
  const command=async(command,p={},opts={})=>{const r=await request('/api/commands',{method:'POST',body:{command,...p},...opts});const b=await r.json();if(opts.status){assert.equal(r.status,opts.status,JSON.stringify(b));return b}assert.equal(r.status,200,JSON.stringify(b));return b.result}
  const formCommand=async(command,p={},opts={})=>{const form=new FormData();form.set('command',command);for(const [k,v]of Object.entries(p))form.set(k,v);const r=await request('/api/commands',{method:'POST',form,...opts});const b=await r.json();assert.equal(r.status,opts.status??200,JSON.stringify(b));return b.result??b}
  const state=async id=>{const r=await request('/api/state'+(id?'?tenancy='+id:''));assert.equal(r.status,200);return r.json()}
  const invite=async(role,email)=>{
   const r=await request('/auth/invite',{method:'POST',body:{email,displayName:role+' person',role}});assert.equal(r.status,202,await r.text())
   const message=messages.findLast(message=>message.to.includes(email));assert.ok(message,'Invitation reached the provider edge')
   const match=(message.html??message.text).match(/(?:href=")?([^"\s<>]*\/auth\/confirm\?token=[^"\s<>]+)/);assert.ok(match,'Invitation includes a confirmation link')
   const token=new URL(match[1].replaceAll('&amp;','&'),origin).searchParams.get('token');const confirm=await request('/auth/confirm',{method:'POST',as:'',body:{token}});assert.equal(confirm.status,303,await confirm.text());return confirm.headers.getSetCookie().map(v=>v.split(';')[0]).join('; ')
  }
  return {mf,origin,request,command,formCommand,state,invite,cookie,async close(){await mf.dispose();await rm(root,{recursive:true,force:true})}}
 }catch(e){await mf.dispose();await rm(root,{recursive:true,force:true});throw e}
}
export const tenancyInput={address:'Unit 1C, 1840 Alder Street, Oakland, CA',ownerName:'Rowan Ellis',ownerEmail:'rowan@example.test',tenantName:'Alex Chen',tenantEmail:'alex@example.test',startDate:'2025-01-01',endDate:'2026-12-31',rent:'620.00',cadence:'weekly'}
