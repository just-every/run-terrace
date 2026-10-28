import type {Bindings} from '../auth.server'
import {integrationMail} from './integration-mail'
import {audit,commit,escape,guard,insist,one,sha256,sql,tenancyGuard,type Context,type Row} from './core'
import {liveRecipient,message,messageAccess,messageEvent,messageInstallation,messageTerms} from './message-context'
import {event as emergencyEvent} from './emergencies'
import {sendTwilio,type TwilioConfig} from './twilio'
export function twilioConfig(env:Bindings):TwilioConfig|null{
 return env.TWILIO_ACCOUNT_SID&&env.TWILIO_AUTH_TOKEN&&env.TWILIO_FROM_NUMBER&&['test','live'].includes(env.TWILIO_MODE??'')?{accountSid:env.TWILIO_ACCOUNT_SID,authToken:env.TWILIO_AUTH_TOKEN,from:env.TWILIO_FROM_NUMBER}:null
}
export async function sendMessage(c:Context,env:Bindings,p:Row){
 messageAccess(c,'message.send');insist(!env.RER_DEMO,'demo_delivery','Demo messaging is disabled.',403)
 const {m,r,t}=await message(c,p.id)
 insist(m.state==='approved'&&m.version===Number(p.version),'message_state','Only the current approved message can be sent once.',409)
 insist(m.installation===await messageInstallation(c)&&r.installation===m.installation,'restored_authority','Restored evidence cannot authorize sending.',409)
 const recipientFence=await liveRecipient(c,r,t)
 const phoneHash=await sha256(new TextEncoder().encode(r.phone)),stopped=await one(c,'SELECT 1 FROM tt_message_suppressions WHERE phone_hash=?',phoneHash)
 const hour=Number(new Intl.DateTimeFormat('en-US',{timeZone:r.time_zone,hourCycle:'h23',hour:'2-digit'}).format(new Date(c.now)))
 const suppressed=r.version!==m.contact_version||r[`${m.channel}_consent`]!==1||(m.channel!=='email'&&(r.stopped||stopped||hour<8||hour>=20))
 const terms=await messageTerms(c,m)
 if(suppressed){
  await commit(c,[tenancyGuard(c,t),guard(c,"EXISTS(SELECT 1 FROM tt_messages WHERE id=? AND version=? AND state='approved')",m.id,m.version),sql(c,"UPDATE tt_messages SET state='suppressed',version=version+1 WHERE id=?",m.id),messageEvent(c,m.id,'suppressed','Consent changed, STOP applies, or outside 8 a.m. to 8 p.m. in the recorded recipient timezone. No send scheduled.')],'message.send',m.id)
  return{outcome:'suppressed',notice:'Message suppressed. Review consent and quiet hours; no send is scheduled.'}
 }
 const config=twilioConfig(env),mail=integrationMail(env,'message_mail',c.now)
 insist(m.channel==='email'?!!mail:!!config,'provider_unconfigured','Configure the installation provider before sending.',409)
 if(m.channel!=='email'&&env.TWILIO_MODE==='test')insist(r.phone==='+15005550006'&&config!.from==='+15005550006','test_boundary','Test mode only sends to the approved magic number.',409)
 // Persist a claim before the provider request. A lost outcome can never authorize a second attempt.
 await commit(c,[tenancyGuard(c,t),recipientFence,terms,guard(c,'EXISTS(SELECT 1 FROM tt_message_contacts WHERE id=? AND version=?)',r.id,r.version),...(m.channel!=='email'?[guard(c,'NOT EXISTS(SELECT 1 FROM tt_message_suppressions WHERE phone_hash=?)',phoneHash)]:[]),guard(c,"EXISTS(SELECT 1 FROM tt_messages WHERE id=? AND version=? AND state='approved')",m.id,m.version),sql(c,"UPDATE tt_messages SET state='claimed',claimed_at=?,version=version+1 WHERE id=?",c.now,m.id),messageEvent(c,m.id,'claimed','Single provider attempt; interruption requires manual reconciliation')],'message.send',m.id)
 let outcome='uncertain',providerId:string|null=null,errorCode:string|null=null
 if(m.channel==='email'){
  try{const sent=await mail!.send({deliveryId:m.id,from:env.MAIL_FROM!,to:[r.email],subject:'Terrace repair update',text:m.body,html:`<p>${escape(m.body).replaceAll('\n','<br>')}</p>`,headers:{'Auto-Submitted':'auto-generated'}});outcome=sent.status;providerId=sent.providerMessageId??null}catch{outcome='uncertain'}
 }else{
  const result=await sendTwilio(config!,{to:r.phone,body:m.body,channel:m.channel,...(new URL(env.AUTH_ORIGIN).protocol==='https:'?{statusCallback:new URL('/api/twilio/status',env.AUTH_ORIGIN).href}:{})});outcome=result.outcome;providerId=result.providerId;errorCode=result.errorCode
 }
 const label=(env.TWILIO_MODE==='test'&&m.channel!=='email'?'Twilio TEST request: ':'')+(outcome==='accepted'?'accepted by provider; delivery and human acknowledgement are not confirmed':outcome==='uncertain'?'outcome uncertain; inspect stored state and provider before any new send':`provider outcome: ${outcome}; follow up manually`)
 await c.db.batch([sql(c,'UPDATE tt_messages SET state=?,provider_id=?,error_code=?,version=version+1 WHERE id=? AND state=\'claimed\'',outcome,providerId,errorCode,m.id),messageEvent(c,m.id,outcome,label),audit(c,'message.result',m.id,outcome),...(m.emergency_id?[emergencyEvent(c,m.emergency_id,'alert',providerId??'no provider reference',m.channel+' page: '+label,r.subject_id,outcome)]:[])])
 return{outcome,notice:label}
}
