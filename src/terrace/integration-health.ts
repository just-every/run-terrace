import type {Bindings} from '../auth.server'
import {all,commit,date,insist,sha256,sql,type Context,type Row} from './core'

export const PROVIDERS = ['stripe','resend','sendgrid','cloudflare','rer'] as const
export type Provider = typeof PROVIDERS[number]
export type Health = 'success'|'missing_configuration'|'credential_expired'|'denied_scope'|'transient_failure'|'semantic_error'|'uncertain'|'suppressed'
export const HEALTH:Record<Health,string> = {
 success:'Last exchange succeeded; acceptance does not confirm delivery or settlement.',
 missing_configuration:'Required installation configuration is missing. Configure the provider privately.',
 credential_expired:'The provider rejected the credential; it may be invalid or expired. Replace it privately.',
 denied_scope:'The provider denied access. Review the account, resource and permitted scope.',
 transient_failure:'The provider or transport failed temporarily. Reconcile the original operation before any manual retry.',
 semantic_error:'The provider rejected the operation or returned an unsupported result. Review its requirements.',
 uncertain:'An operation began but its result is uncertain. Reconcile it before any further action.',
 suppressed:'Development or demo operation suppressed; no provider exchange was made.',
}
export const providerFromMail=(env:Bindings):Provider|null=>PROVIDERS.includes(env.MAIL_PROVIDER as Provider)?env.MAIL_PROVIDER as Provider:null
export function configured(env:Bindings,provider:Provider){
 if(env.RER_DEMO)return false
 if(provider==='stripe')return !!env.STRIPE_SECRET_KEY?.trim()&&!/^(sk|rk)_live_/i.test(env.STRIPE_SECRET_KEY.trim())
 return provider===env.MAIL_PROVIDER&&!!env.MAIL_API_KEY?.trim()&&!!env.MAIL_FROM?.trim()&&(provider!=='cloudflare'||!!env.MAIL_ACCOUNT_ID)&&(provider!=='rer'||!!env.MAIL_RELAY_URL)
}
export const httpHealth=(status:number):Health=>status===401?'credential_expired':status===403?'denied_scope':status===408||status===429||status>=500?'transient_failure':status>=200&&status<300?'success':'semantic_error'
const instance=(env:Pick<Bindings,'SESSION_SECRET'>)=>sha256(new TextEncoder().encode(env.SESSION_SECRET))
/** Durable observation before egress. Only fixed classifications and counts are stored, never request or response data. */
export async function beginExchange(env:Bindings,provider:Provider,operation:string,now:string,outbound:boolean){
 const installation=await instance(env)
 await env.DB.prepare(`INSERT INTO tt_integration_health(provider,installation,operation,operations,requests,last_attempt,last_outcome) VALUES(?,?,?,1,?,?, 'uncertain') ON CONFLICT(provider,installation,operation) DO UPDATE SET operations=operations+1,requests=requests+excluded.requests,last_attempt=excluded.last_attempt,last_outcome='uncertain'`).bind(provider,installation,operation,outbound?1:0,now).run()
 return async(outcome:Health)=>{
  await env.DB.batch([env.DB.prepare(`UPDATE tt_integration_health SET successes=successes+?,failures=failures+?,last_success=CASE WHEN ?='success' THEN ? ELSE last_success END,last_outcome=? WHERE provider=? AND installation=? AND operation=?`).bind(outcome==='success'?1:0,['success','suppressed'].includes(outcome)?0:1,outcome,now,outcome,provider,installation,operation),
   env.DB.prepare(`INSERT INTO tt_integration_outcomes(provider,installation,operation,outcome,operations,last_observed) VALUES(?,?,?,?,1,?) ON CONFLICT(provider,installation,operation,outcome) DO UPDATE SET operations=operations+1,last_observed=excluded.last_observed`).bind(provider,installation,operation,outcome,now)])
 }
}
export async function countMailRequest(env:Bindings,provider:Provider,operation:string){
 await env.DB.prepare('UPDATE tt_integration_health SET requests=requests+1 WHERE provider=? AND installation=? AND operation=?').bind(provider,await instance(env),operation).run()
}
export function integrationOwner(c:Context){insist(c.actor.role==='owner'&&!c.actor.credential,'forbidden','Only the signed-in installation owner can manage integration diagnostics.',403)}
export async function integrationData(c:Context,env:Bindings){
 integrationOwner(c)
 const installation=await instance(env),metadata=await all(c,'SELECT * FROM tt_integration_metadata'),observations=await all(c,'SELECT * FROM tt_integration_health ORDER BY provider,operation,installation'),outcomes=await all(c,'SELECT * FROM tt_integration_outcomes ORDER BY outcome')
 const providers=[...new Set<Provider>(['stripe',...(providerFromMail(env)?[providerFromMail(env)!]:[]),...metadata.map(r=>r.provider as Provider),...observations.map(r=>r.provider as Provider)])]
 return {providers:providers.map(provider=>{
  const history=observations.filter(r=>r.provider===provider),current=history.filter(r=>r.installation===installation),latest=current.toSorted((a,b)=>b.last_attempt.localeCompare(a.last_attempt))[0],lastSuccess=current.map(r=>r.last_success).filter(Boolean).sort().at(-1)??null
  const ageSeconds=lastSuccess?Math.max(0,Math.floor((Date.parse(c.now)-Date.parse(lastSuccess))/1000)):null
  return {provider,configured:configured(env,provider),metadata:metadata.find(r=>r.provider===provider)??null,observations:history.map(({installation:source,...r})=>({...r,currentInstallation:source===installation,outcomes:outcomes.filter(o=>o.provider===provider&&o.installation===source&&o.operation===r.operation).map(({installation:ignored,...o})=>o)})),lastSuccess,ageSeconds,freshness:ageSeconds===null?'No successful exchange in this installation':ageSeconds<=86400?'Within the last 24 hours':'Older than 24 hours',outcome:!configured(env,provider)?'missing_configuration':latest?.last_outcome??(history.length?'restored_evidence':'not_checked'),operations:current.reduce((n,r)=>n+r.operations,0),requests:current.reduce((n,r)=>n+r.requests,0),successes:current.reduce((n,r)=>n+r.successes,0),failures:current.reduce((n,r)=>n+r.failures,0),measuredBilling:null}
 }),mailConfigured:!!providerFromMail(env),notice:'Diagnostics observe existing operations only. No setup check, send, collection or retry is initiated here.'}
}
export async function saveIntegration(c:Context,env:Bindings,p:Row){
 integrationOwner(c);c.source=null
 const provider=p.provider as Provider;insist(PROVIDERS.includes(provider),'invalid_input','Choose a supported provider.')
 const scope=String(p.scope??'unknown'),entitlement=String(p.entitlement??'unknown')
 insist(['unknown',provider==='stripe'?'hosted_test_payments':'transactional_mail'].includes(scope),'invalid_input','Choose a supported declared permission.')
 insist(['unknown','owner_reported_available','owner_reported_unavailable'].includes(entitlement),'invalid_input','Choose an entitlement state.')
 const raw=String(p.centsPerThousand??'').trim(),rate=raw===''?null:Number(raw),asOf=rate===null?null:date(p.costAsOf,'Cost assumption date')
 insist(rate===null||/^\d+$/.test(raw)&&Number.isSafeInteger(rate)&&rate>=0&&rate<=100000000,'invalid_input','Enter whole USD cents per thousand operations, or leave unknown.')
 await commit(c,[sql(c,`INSERT INTO tt_integration_metadata(provider,declared_scope,entitlement,cents_per_thousand,cost_as_of,updated_at) VALUES(?,?,?,?,?,?) ON CONFLICT(provider) DO UPDATE SET declared_scope=excluded.declared_scope,entitlement=excluded.entitlement,cents_per_thousand=excluded.cents_per_thousand,cost_as_of=excluded.cost_as_of,updated_at=excluded.updated_at`,provider,scope,entitlement,rate,asOf,c.now)],'integration.save',provider)
 return {notice:'Integration metadata saved. Provider permissions and entitlements remain unverified.',tab:'settings'}
}
