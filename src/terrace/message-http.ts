import type {Bindings} from '../auth.server'
import {all,Fault,guard,insist,one,sha256,sql,type Context,type Row} from './core'
import {arrivalReplyStatements} from './appointments'
import {messageEvent,messageInstallation} from './message-context'
import {twilioConfig} from './message-send'
import {verifyTwilio} from './twilio'
const headers={'cache-control':'no-store','x-content-type-options':'nosniff'}
const ok=()=>new Response('<Response/>',{headers:{...headers,'content-type':'text/xml'}})
const statusRank:Record<string,number>={claimed:0,accepted:1,queued:1,initiated:1,ringing:2,sent:2,'in-progress':3,completed:4,delivered:4,failed:5,undelivered:5,busy:5,'no-answer':5,canceled:5}
export async function twilioResponse(request:Request,env:Bindings){
 try{
  insist(request.method==='POST','method','Use POST.',405);insist(!env.RER_DEMO,'demo_delivery','Demo messaging callbacks are disabled.',403)
  const cfg=twilioConfig(env);insist(cfg,'provider_unconfigured','Messaging is not configured.',503)
  insist(request.headers.get('content-type')?.startsWith('application/x-www-form-urlencoded'),'content_type','Send form data.',415)
  const raw=await request.text();insist(raw.length<=16000,'body_limit','Callback is too large.',413)
  const params=new URLSearchParams(raw),url=new URL(request.url),canonical=new URL(url.pathname+url.search,env.AUTH_ORIGIN).href
  insist(await verifyTwilio(cfg,{url:canonical,params,signature:request.headers.get('x-twilio-signature')??''}),'signature','Invalid callback signature.',403)
  insist(params.get('AccountSid')===cfg.accountSid,'account','Wrong messaging account.',403)
  const c:Context={db:env.DB,actor:{id:'provider:twilio',role:'owner',displayName:'Twilio'},now:new Date().toISOString(),secret:env.SESSION_SECRET}
  const installation=await messageInstallation(c),fixture=env.TWILIO_MODE==='test'?'signed test fixture':'signed provider webhook'
  if(url.pathname==='/api/twilio/status'){
   const sid=params.get('MessageSid')??params.get('CallSid'),state=params.get('MessageStatus')??params.get('CallStatus')??''
   insist(sid&&Object.hasOwn(statusRank,state),'invalid_event','Unknown callback outcome.')
   const m=await one(c,'SELECT * FROM tt_messages WHERE provider_id=? AND installation=?',sid,installation)
   insist(m&&m.channel!=='email'&&params.get('To')===(await one(c,'SELECT phone FROM tt_message_contacts WHERE id=?',m.contact_id))?.phone&&params.get('From')===cfg.from,'not_found','Message not found.',404)
   const key=`status:${m.id}:${state}`
   const previous=await one(c,'SELECT id FROM tt_message_events WHERE id=?',key);if(previous)return ok()
   await c.db.batch([guard(c,'EXISTS(SELECT 1 FROM tt_messages WHERE id=? AND version=?)',m.id,m.version),messageEvent(c,m.id,state,`${fixture}: ${state}; no human acknowledgement claimed`,key),...(statusRank[state]>=(statusRank[m.state]??0)?[sql(c,'UPDATE tt_messages SET state=?,error_code=?,version=version+1 WHERE id=?',state,/^\d{1,10}$/.test(params.get('ErrorCode')??'')?params.get('ErrorCode'):null,m.id)]:[])])
   return ok()
  }
  insist(params.get('To')===cfg.from&&params.get('NumMedia')==='0','invalid_event','Unsupported recipient or media.')
  const from=params.get('From')??'',sid=params.get('MessageSid')??'',body=params.get('Body')??''
  insist(/^\+[1-9]\d{7,14}$/.test(from)&&sid.length>0&&sid.length<=128&&body.length>0&&body.length<=1600,'invalid_event','Invalid message.')
  const key='reply:'+await sha256(new TextEncoder().encode(cfg.accountSid+':'+sid))
  if(await one(c,'SELECT id FROM tt_message_webhooks WHERE id=?',key))return ok()
  const changes=[sql(c,'INSERT INTO tt_message_webhooks(id,received_at) VALUES(?,?)',key,c.now)]
  const stop=['STOP','STOPALL','UNSUBSCRIBE','CANCEL','END','QUIT','REVOKE','OPTOUT'].includes(body.trim().toUpperCase())
  const contacts=await all(c,'SELECT * FROM tt_message_contacts WHERE phone=? AND installation=?',from,installation)
  if(stop){
   const digest=await sha256(new TextEncoder().encode(from))
   changes.push(sql(c,'INSERT INTO tt_message_suppressions(phone_hash,stopped_at) VALUES(?,?) ON CONFLICT DO NOTHING',digest,c.now),sql(c,"UPDATE tt_message_contacts SET stopped=1,sms_consent=0,voice_consent=0,version=version+1,recorded_by='provider:twilio',recorded_at=? WHERE phone=?",c.now,from),sql(c,"INSERT INTO tt_message_contact_versions SELECT id,version,json_object('name',name,'email',email,'phone',phone,'timezone',time_zone,'emailConsent',email_consent,'smsConsent',sms_consent,'voiceConsent',voice_consent,'source',consent_reference,'stopped',stopped),'provider:twilio',? FROM tt_message_contacts WHERE phone=?",c.now,from))
  }
  // A shared phone never selects one household or appointment by guesswork.
  if(contacts.length!==1){await c.db.batch(changes);return ok()}
  const r=contacts[0],messages=await all(c,"SELECT * FROM tt_messages WHERE contact_id=? AND installation=? AND channel='sms' AND claimed_at IS NOT NULL ORDER BY claimed_at DESC,rowid DESC",r.id,installation),m=messages[0]
  if(!m){await c.db.batch(changes);return ok()}
  let reply: D1PreparedStatement[]=[]
  const arrivals=messages.filter(x=>x.purpose==='arrival'&&['accepted','sent','delivered'].includes(x.state))
  const outstanding:Row[]=[]
  for(const arrival of arrivals){const a=await one(c,"SELECT id FROM tt_appointments WHERE id=? AND state IN ('proposed','confirmed') AND resident_confirmed_at IS NULL AND ends_at>?",arrival.appointment_id,c.now);if(a&&!outstanding.some(x=>x.appointment_id===arrival.appointment_id))outstanding.push(arrival)}
  if(!stop&&!r.stopped&&r.sms_consent===1&&body.trim().toUpperCase()==='Y'&&outstanding.length===1&&new Set(arrivals.map(x=>x.appointment_id)).size===1&&outstanding[0].contact_version===r.version){
   try{reply=await arrivalReplyStatements(c,outstanding[0].appointment_id,JSON.parse(outstanding[0].snapshot),sid,`Resident Y reply via ${fixture}; access permission remains separate`)}catch(e){if(!(e instanceof Fault))throw e}
  }
  await c.db.batch([...changes,guard(c,'EXISTS(SELECT 1 FROM tt_message_contacts WHERE id=? AND version=?)',r.id,stop?r.version+1:r.version),messageEvent(c,m.id,stop?'opted_out':reply.length?'arrival_confirmed':'received',`${fixture}: ${body}`,key),...reply])
  return ok()
 }catch(e){const x=e as Fault;return Response.json({error:x.code??'callback_rejected',message:x instanceof Fault?x.message:'Callback not applied. Inspect stored state before replay.'},{status:x.status??409,headers})}
}
