import type {Bindings} from '../auth.server'
import {operatorMail} from '../mail.server.mjs'
import {createMailSender} from '../modules/mail/index.mjs'
import {beginExchange,countMailRequest,configured,httpHealth,providerFromMail,type Health} from './integration-health'

/** Observe the existing mail boundary without retries or new destinations. Raw responses never enter diagnostics. */
export function integrationMail(env:Bindings,operation:'dispatch_mail'|'message_mail',now:string){
 const provider=providerFromMail(env),original=operatorMail(env)
 if(!provider)return original
 return {async send(message:Parameters<NonNullable<ReturnType<typeof operatorMail>>['send']>[0]){
  const ready=configured(env,provider),suppressed=!!env.RER_DEMO
  const finish=await beginExchange(env,provider,operation,now,false)
  if(suppressed){const result=await original!.send(message);await finish('suppressed');return result}
  if(!ready){await finish('missing_configuration');return {provider,status:'unconfigured',providerMessageId:null}}
  const observed:{health:Health;started:boolean}={health:'transient_failure',started:false}
  try{
   const sender=createMailSender({provider,mode:'production',apiKey:env.MAIL_API_KEY,...(provider==='rer'?{relayUrl:env.MAIL_RELAY_URL}:{}),...(provider==='cloudflare'?{accountId:env.MAIL_ACCOUNT_ID}:{})},{fetch:async(url:RequestInfo|URL,init?:RequestInit)=>{
    await countMailRequest(env,provider,operation);observed.started=true
    const response=await fetch(url,init);observed.health=httpHealth(response.status);return response
   }})
   const result=await sender.send(message)
   if(observed.health==='success'&&result.status!=='accepted')observed.health=result.status==='uncertain'?'uncertain':'semantic_error'
   await finish(observed.health)
   return result
  }catch{
   await finish(!observed.started||observed.health==='success'?'semantic_error':observed.health)
   return {provider,status:'uncertain',providerMessageId:null}
  }
 }}
}
