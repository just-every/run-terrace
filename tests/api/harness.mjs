import {Miniflare,convertV4MiniflareOptions} from 'miniflare'
import {unstable_splitSqlQuery} from 'wrangler'
import {build} from 'esbuild'
import {mkdtemp,readFile,readdir,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'
import {randomBytes} from 'node:crypto'
import assert from 'node:assert/strict'
/** legacy(db): writes rows as an older release would, before migration 0018 (PORT-001) runs. */
export async function installation({legacy,beforeMigration,assets=false,demo=false,mailResponse,mailProvider='resend'}={}){
 const root=await mkdtemp(join(tmpdir(),'terrace-api-')),bundle=await build({entryPoints:[demo?'tests/api/demo-worker.ts':'tests/api/worker.ts'],bundle:true,write:false,format:'esm',platform:'neutral',target:'es2022',external:['node:*','cloudflare:*'],loader:{'.css':'text','.svg':'text','.txt':'text'}})
 const secret=()=>randomBytes(32).toString('hex'),setup=secret(),devKey=secret(),sessionSecret=secret()
 const messages=[]
 let origin='http://localhost'
 const options=port=>({...convertV4MiniflareOptions({host:'127.0.0.1',port,modules:true,script:bundle.outputFiles[0].text,compatibilityDate:'2026-09-08',compatibilityFlags:['nodejs_compat'],d1Databases:['DB'],bindings:{AUTH_LOCAL:demo?'false':'true',...(demo?{RER_DEMO:'1'}:{}),AUTH_ORIGIN:origin,OWNER_EMAIL:'owner@example.test',SESSION_SECRET:sessionSecret,SETUP_TOKEN:setup,MAIL_PROVIDER:mailProvider,MAIL_API_KEY:'synthetic-terrace-1',MAIL_FROM:'auth@localhost.test',RER_DEV_KEY:devKey},...(assets?{assets:{directory:resolve('public'),routerConfig:{has_user_worker:true}}}:{}),outboundService:async request=>{assert.equal(new URL(request.url).hostname,'api.resend.com');const message=await request.json();messages.push(message);return mailResponse?mailResponse(message):Response.json({id:crypto.randomUUID()})}}),resourcePersistencePath:root})
 let mf=new Miniflare(options(0)),port=0;let cookie=''
 try {
  const address=await mf.ready;origin=demo?address.origin.replace('http:','https:'):address.origin;port=Number(address.port);await mf.setOptions(options(port))
  const db=await mf.getD1Database('DB')
  for(const f of (await readdir('migrations/core')).filter(f=>f.endsWith('.sql')).sort()){if(beforeMigration)await beforeMigration(f,db);if(legacy&&f.startsWith('0018'))await legacy(db);await db.batch(unstable_splitSqlQuery(await readFile('migrations/core/'+f,'utf8')).map(q=>db.prepare(q)))}
  const request=(path,{method='GET',body,as=cookie,originHeader=origin,form,headers={}}={})=>(demo?mf.dispatchFetch.bind(mf):fetch)(origin+path,{method,redirect:'manual',headers:{origin:originHeader,...(!form?{'content-type':'application/json'}:{}),...(as?{cookie:as}:{}),...headers},...(form?{body:form}:body!==undefined?{body:JSON.stringify(body)}:{})})
  const boot=await request('/auth/bootstrap',{method:'POST',body:{token:setup,displayName:'Terrace owner'}});assert.equal(boot.status,303,await boot.text());cookie=boot.headers.getSetCookie().map(v=>v.split(';')[0]).join('; ')
  const first=await request('/setup',{method:'POST',form:new URLSearchParams({confirm:'yes'})});assert.equal(first.status,303)
  const command=async(command,p={},opts={})=>{const r=await request('/api/commands',{method:'POST',body:{command,...p},...opts});const b=await r.json();if(opts.status){assert.equal(r.status,opts.status,JSON.stringify(b));return b}assert.equal(r.status,200,JSON.stringify(b));return b.result}
  const formCommand=async(command,p={},opts={})=>{const form=new FormData();form.set('command',command);for(const [k,v]of Object.entries(p))form.set(k,v);const r=await request('/api/commands',{method:'POST',form,...opts});const b=await r.json();assert.equal(r.status,opts.status??200,JSON.stringify(b));return b.result??b}
  const state=async id=>{const r=await request('/api/state'+(id?'?tenancy='+id:''));assert.equal(r.status,200);return r.json()}
  const invite=async(role,email)=>{
   const r=await request('/auth/invite',{method:'POST',body:{email,displayName:role+' person',role}});assert.equal(r.status,202,await r.text())
   return accept(email)
  }
  /** Follows the newest invitation link sent to email and returns the new operator's session cookie. */
  const accept=async(email,as='')=>{
   const message=messages.findLast(message=>message.to.includes(email));assert.ok(message,'Invitation reached the provider edge')
   const match=(message.html??message.text).match(/(?:href=")?([^"\s<>]*\/auth\/confirm\?token=[^"\s<>]+)/);assert.ok(match,'Invitation includes a confirmation link')
   const token=new URL(match[1].replaceAll('&amp;','&'),origin).searchParams.get('token');const confirm=await request('/auth/confirm',{method:'POST',as,body:{token}});assert.equal(confirm.status,303,await confirm.text());return confirm.headers.getSetCookie().map(v=>v.split(';')[0]).join('; ')
  }
  /** A new sign-in by email link: a fresh session cookie for email. */
  const signIn=async email=>{const r=await request('/auth/magic-link',{method:'POST',as:'',body:{email}});assert.equal(r.status,202,await r.text());return accept(email)}
  /** Base's step-up: the email link completes in the session that asked (default the owner's). */
  const stepUp=async(email='owner@example.test',as=cookie)=>{const r=await request('/auth/step-up',{method:'POST',as,body:{action:'credentials:mint'}});assert.equal(r.status,202,await r.text());await accept(email,as)}
  /** A new worker process over the same persisted D1: nothing in memory survives. */
  const restart=async()=>{await mf.dispose();mf=new Miniflare(options(port));await mf.ready}
  return {get mf(){return mf},scheduled:async scheduledTime=>(await mf.getWorker()).scheduled({scheduledTime,cron:'0 * * * *'}),configureMail:async provider=>{mailProvider=provider;await mf.setOptions(options(port))},restart,origin,request,command,formCommand,state,invite,accept,signIn,stepUp,cookie,messages,async close(){await mf.dispose();await rm(root,{recursive:true,force:true})}}
 }catch(e){await mf.dispose();await rm(root,{recursive:true,force:true});throw e}
}
export const tenancyInput={address:'Unit 1C, 1840 Alder Street, Oakland, CA',ownerName:'Rowan Ellis',ownerEmail:'rowan@example.test',tenantName:'Alex Chen',tenantEmail:'alex@example.test',startDate:'2025-01-01',endDate:'2026-12-31',rent:'620.00',cadence:'weekly'}
