import type { Bindings } from '../auth.server'
import { Fault, all, audit, id, insist, one, recordRead, sha256, sql, type Context, type Row } from './core'
import { APPLICATION_COOKIE, acceptApplication, currentApplicant, sendApplicationLink } from './application-access'
import { applicantData, applicantWrite, applicationFile } from './application-answers'
import { applicationFeeData, currentApplicationFee, reconcileApplicationFee, startApplicationFee } from './application-fees'
import { applicantView, applicationSignin, applicationAccept, applicationShell } from './application-view'

const headers = {'cache-control':'private, no-store','x-content-type-options':'nosniff','referrer-policy':'strict-origin','content-security-policy':"default-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; form-action 'self' https://checkout.stripe.com; frame-ancestors 'none'"}
const json = (value: unknown, status=200) => Response.json(value,{status,headers})
const html = (body: string, status=200) => new Response(body,{status,headers:{...headers,'content-type':'text/html;charset=utf-8'}})
const cookie = (env: Bindings, value: string, age=43200) => `${APPLICATION_COOKIE}=${value}; Path=/apply; HttpOnly; SameSite=Lax; Max-Age=${age}${env.AUTH_ORIGIN.startsWith('https:')?'; Secure':''}`
export async function applicationResponse(request: Request, env: Bindings) {
 const url=new URL(request.url), path=url.pathname.replace(/\/$/,'')||'/apply', now=new Date().toISOString(), api=path.startsWith('/apply/api/')
 try {
  insist(url.origin===env.AUTH_ORIGIN,'origin','Installation origin required.',403)
  insist(['GET','POST'].includes(request.method),'method','Use GET or POST.',405)
  if(request.method==='POST')insist(request.headers.get('origin')===env.AUTH_ORIGIN && request.headers.get('sec-fetch-site')!=='cross-site','origin','Same-origin confirmation required.',403)
  insist(Number(request.headers.get('content-length')??0)<=6*1024*1024,'body_limit','Submission too large.',413)
  const form=request.method==='POST'?await request.formData():new FormData()
  const anonymous:Context={db:env.DB,now,actor:{id:'applicant:signin',role:'member',displayName:'Applicant'}}
  if(path==='/apply/signin') {
   if(request.method==='GET')return html(applicationSignin())
   const email=String(form.get('email')??'').trim().toLowerCase()
   const adults=await all(anonymous,'SELECT id FROM tt_application_adults WHERE email=? AND revoked_at IS NULL',email)
   // One fresh link per matching application; the response never enumerates accounts.
   for(const a of adults)await sendApplicationLink(anonymous,env,a.id)
   return html(applicationSignin('If this address has an application, a one-time link has been sent.'),202)
  }
  if(path==='/apply/accept') {
   const token=String(request.method==='POST'?form.get('token')??'':url.searchParams.get('token')??'')
   if(request.method==='GET')return html(applicationAccept(token))
   const session=token?await acceptApplication(env.DB,token,now):null
   insist(session,'invalid_link','This link expired, was used, or access was revoked. Request a new sign-in link.')
   return new Response(null,{status:303,headers:{...headers,'set-cookie':cookie(env,session),location:'/apply'}})
  }
  const current=await currentApplicant(env.DB,request.headers.get('cookie'),now)
  if(!current)return api?json({error:'unauthorized',message:'Sign in first.'},401):new Response(null,{status:303,headers:{...headers,location:'/apply/signin'}})
  const {adult,sessionHash}=current,c:Context={db:env.DB,now,actor:{id:'applicant:'+adult.id,role:'member',displayName:adult.name}},feeInput={adultId:adult.id,sessionHash,now}
  if(path==='/apply/signout') {
   insist(request.method==='POST','method','Use POST.',405)
   await sql(c,'UPDATE tt_application_sessions SET revoked_at=? WHERE hash=?',now,sessionHash).run()
   return new Response(null,{status:303,headers:{...headers,'set-cookie':cookie(env,'',0),location:'/apply/signin'}})
  }
  if(path==='/apply/file') {
   insist(request.method==='GET','method','Use GET.',405)
   return await applicationFile(c,String(url.searchParams.get('id')??''),adult.id)
  }
  insist(['/apply','/apply/api/application','/apply/api/fee','/apply/fee'].includes(path),'not_found','Not found.',404)
  if(request.method==='POST') {
   if(path==='/apply/fee'||path==='/apply/api/fee') {
    const result=form.get('action')==='reconcile'?await reconcileApplicationFee(env,{...feeInput,eventId:form.get('eventId')}):await startApplicationFee(env,{...feeInput,origin:url.origin,requestKey:form.get('requestKey'),consent:form.get('consent'),consentVersion:form.get('consentVersion')})
    return api?json(result):new Response(null,{status:303,headers:{...headers,location:'checkoutUrl' in result?String(result.checkoutUrl):'/apply'}})
   }
   const result=await applicantWrite(c,adult,sessionHash,form)
   return api?json(result):new Response(null,{status:303,headers:{...headers,location:'/apply'}})
  }
  const app=await one(c,'SELECT id,disclosures,fee_cents FROM tt_applications WHERE id=?',adult.application_id)
  insist(app,'not_found','Application not found.',404)
  const data={applicant:await applicantData(c,adult),disclosures:JSON.parse(app.disclosures),disclosureHash:await sha256(new TextEncoder().encode(app.disclosures)),feeCents:app.fee_cents,fees:await applicationFeeData(env.DB,app.id),currentFee:await currentApplicationFee(env,feeInput),requestKey:id()}
  await recordRead(c,'application.applicant.read',adult.id)
  return api?json(data):html(applicantView(data))
 } catch(e) {
  if(e instanceof Fault)return api?json({error:e.code,message:e.message},e.status):html(applicationShell('Application needs attention',`<section><p>${escapeHtml(e.message)}</p><a href="/apply">Return to your application</a></section>`),e.status)
  throw e
 }
}
const escapeHtml=(s:string)=>s.replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]!))
