import {createDeliveryEventIntake,createD1EventStore} from '../modules/mail/index.mjs'
import type {Bindings} from '../auth.server'
import {Fault,guard,insist,sql,type Context,type Row} from './core'
import {messageInstallation} from './message-context'

const namespace='terrace-repair-messages'
export function repairMailNextAction(state:string){
 if(['bounced','failed','rejected','complained'].includes(state))return 'Delivery failed. Contact the recipient through an authorized channel, resolve the cause and review a new message. No automatic resend.'
 if(state==='delivered')return 'Recipient mail server confirmed delivery. A reply, appointment confirmation and human acknowledgement remain separate.'
 if(state==='deferred')return 'Provider deferred delivery. Monitor the provider outcome; no automatic resend.'
 return ''
}
// This fence runs inside the intake transaction as well as projection. Erasure
// or a concurrent identity change cannot leave new provider artifacts behind.
function fence(c:Context,m:Row){return guard(c,"EXISTS(SELECT 1 FROM tt_messages m JOIN tt_tenancies t ON t.id=m.tenancy_id WHERE m.id=? AND m.installation=? AND m.mail_provider=? AND m.provider_id=? AND m.mail_recipient=? AND m.channel='email' AND m.claimed_at IS NOT NULL AND t.erased_at IS NULL AND t.custody_retired_at IS NULL)",m.id,m.installation,m.mail_provider,m.provider_id,m.mail_recipient)}
export async function repairMailWebhook(request:Request,env:Bindings){
 const headers={'cache-control':'no-store','x-content-type-options':'nosniff'}
 try{
  insist(request.method==='POST','method','Use POST.',405)
  insist(!env.RER_DEMO,'demo_delivery','Demo delivery events are disabled.',403)
  insist(['resend','sendgrid'].includes(env.MAIL_PROVIDER??'')&&env.REPAIR_MAIL_WEBHOOK_KEY,'delivery_unconfigured','Configure authenticated repair mail events.',503)
  insist(Number(request.headers.get('content-length')??0)<=1024*1024,'body_limit','Delivery event too large.',413)
  const reader=request.body?.getReader(),chunks:Uint8Array[]=[];let length=0
  if(reader)try{for(;;){const {value,done}=await reader.read();if(done)break;length+=value.length;insist(length<=1024*1024,'body_limit','Delivery event too large.',413);chunks.push(value)}}finally{await reader.cancel()}
  const rawBody=new Uint8Array(length);let at=0;for(const part of chunks){rawBody.set(part,at);at+=part.length}
  const now=new Date().toISOString(),c:Context={db:env.DB,actor:{id:'provider:'+env.MAIL_PROVIDER,role:'owner',displayName:'Mail provider'},now,secret:env.SESSION_SECRET}
  const installation=await messageInstallation(c),owned=new Map<string,Row>()
  const store=createD1EventStore({db:{prepare:env.DB.prepare.bind(env.DB),exec:env.DB.exec.bind(env.DB),dump:env.DB.dump.bind(env.DB),withSession:env.DB.withSession.bind(env.DB),async batch<T=unknown>(statements:D1PreparedStatement[]){
   const fences=[...owned.values()].map(m=>fence(c,m))
   return (await env.DB.batch<T>([...fences,...statements])).slice(fences.length)
  }}})
  const intake=createDeliveryEventIntake({provider:env.MAIL_PROVIDER,key:env.REPAIR_MAIL_WEBHOOK_KEY,tenantId:env.AUTH_ORIGIN,eventNamespace:namespace,clock:()=>Date.parse(now),store,authorize:async event=>{
   const m=await env.DB.prepare("SELECT m.* FROM tt_messages m JOIN tt_tenancies t ON t.id=m.tenancy_id WHERE m.provider_id=? AND m.channel='email' AND t.erased_at IS NULL AND t.custody_retired_at IS NULL").bind(event.providerMessageId).first<Row>()
   if(!m||m.installation!==installation||m.mail_provider!==event.provider||!m.claimed_at||!m.approved_at||!m.mail_recipient||event.recipients.length!==1||event.recipients[0]!==m.mail_recipient||(event.deliveryId!==null&&event.deliveryId!==m.id))return false
   owned.set(m.id,m);return true
  }})
  await intake.ingestWebhook({rawBody,headers:request.headers})
  // Reproject from durable receipts even on duplicate redelivery. Both history
  // and state are read within the transaction, so concurrent callbacks cannot
  // apply an older snapshot. No callback can initiate any business action.
  const statements:D1PreparedStatement[]=[]
  for(const m of owned.values()){
   const scope=[m.mail_provider,env.AUTH_ORIGIN,namespace,m.provider_id,m.mail_recipient]
   statements.push(fence(c,m),sql(c,`INSERT INTO tt_message_events(id,message_id,kind,body,actor,at)
    SELECT 'mail:'||?||':'||event_id,?,json_extract(event_json,'$.status'),
     'Authenticated mail evidence: '||json_extract(event_json,'$.status')||'; occurred '||json_extract(event_json,'$.occurredAt')||'; event '||event_id,?,?
    FROM rer_mail_event_receipts WHERE provider=? AND tenant_id=? AND event_namespace=?
     AND json_extract(event_json,'$.providerMessageId')=? AND json_extract(event_json,'$.recipients[0]')=?
     AND json_extract(event_json,'$.status') IS NOT NULL ON CONFLICT(id) DO NOTHING`,m.id,m.id,c.actor.id,now,...scope),
    sql(c,`UPDATE tt_messages SET state=s.status,mail_event_id=s.event_id,version=version+1
     FROM rer_mail_event_states s WHERE tt_messages.id=? AND s.provider=? AND s.tenant_id=? AND s.event_namespace=? AND s.provider_message_id=? AND s.recipient=? AND tt_messages.mail_event_id IS NOT s.event_id`,m.id,...scope))
  }
  if(statements.length)try{await env.DB.batch(statements)}catch{throw new Fault('delivery_projection_pending','Delivery evidence stored; retry the event to recover the thread.',503)}
  return Response.json({received:true},{headers})
 }catch(error){if(error instanceof Fault)return Response.json({error:error.code,message:error.message},{status:error.status,headers});const code=(error as {code?:string})?.code;return Response.json({error:'delivery_event_rejected',message:'Invalid, unverified or unauthorized delivery event.'},{status:code==='event_storage_failed'?503:400,headers})}
}
