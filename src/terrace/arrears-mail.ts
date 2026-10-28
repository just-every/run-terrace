import type {Bindings} from '../auth.server'
import {operatorMail} from '../mail.server.mjs'
import {createDeliveryEventIntake,createD1EventStore} from '../modules/mail/index.mjs'
import {all,allow,commit,escape,Fault,guard,insist,one,sha256,sql,tenancyGuard,type Context,type Row} from './core'
import {actionCurrent,installationKey,native} from './arrears-state'
import {event} from './arrears'

export async function sendArrears(c:Context,env:Bindings,p:Row){
 native(c);allow(c,'arrears.send');insist(!env.RER_DEMO,'demo_delivery','Demo messaging is disabled.',403)
 const a=await one(c,'SELECT * FROM tt_arrears_actions WHERE id=?',p.id)
 insist(a&&a.version===p.version&&a.state==='approved','approval','Only a current human-approved action can be sent once.',409)
 const {state:s,s:snapshot,fence}=await actionCurrent(c,a)
 insist(a.installation===await installationKey(c)&&s.config!.installation===a.installation,'restored_authority','Restored evidence cannot authorize sending.',409)
 const recent=await all(c,'SELECT id FROM tt_arrears_actions WHERE tenancy_id=? AND claimed_at>=?',a.tenancy_id,new Date(Date.parse(c.now)-7*86400000).toISOString())
 insist(recent.length<s.config!.contact_limit,'contact_limit','Weekly contact limit reached. Human review is required.',409)
 insist(s.asOf>=a.due_on,'not_due','This sequence step is not due yet.',409)
 const mail=operatorMail(env);insist(mail&&env.MAIL_FROM,'provider_unconfigured','Configure the installation mail provider before sending.',409)
 const body=a.body+(snapshot.installments?'\n\nApproved plan (exact cents):\n'+snapshot.installments.map((x:Row)=>x.on+': '+x.cents+' '+s.tenancy.currency+' cents').join('\n'):'')
 await commit(c,[tenancyGuard(c,s.tenancy),fence,guard(c,"EXISTS(SELECT 1 FROM tt_arrears_actions WHERE id=? AND version=? AND state='approved')",a.id,a.version),guard(c,'(SELECT COUNT(*) FROM tt_arrears_actions WHERE tenancy_id=? AND claimed_at>=?)<?',a.tenancy_id,new Date(Date.parse(c.now)-7*86400000).toISOString(),s.config!.contact_limit),sql(c,"UPDATE tt_arrears_actions SET state='claimed',claimed_at=?,provider=?,version=version+1 WHERE id=?",c.now,env.MAIL_PROVIDER,a.id),event(c,a.tenancy_id,'claimed',{actionId:a.id},'One provider attempt reserved; interruption requires human reconciliation',s.asOf)],'arrears.send',a.id)
 let outcome='uncertain',providerId:string|null=null
 try{const result=await mail.send({deliveryId:a.id,from:env.MAIL_FROM,to:[snapshot.recipient],subject:'Terrace collection: '+a.kind.replaceAll('_',' '),text:body,html:'<p>'+escape(body).replaceAll('\n','<br>')+'</p>',headers:{'Auto-Submitted':'auto-generated'}});outcome=result.status;providerId=result.providerMessageId??null}catch{}
 await c.db.batch([sql(c,"UPDATE tt_arrears_actions SET state=?,provider_id=?,version=version+1 WHERE id=? AND state='claimed'",outcome,providerId,a.id),event(c,a.tenancy_id,outcome,{actionId:a.id,providerId},'Provider acceptance is not delivery, physical service or settlement',s.asOf)])
 return{outcome,notice:outcome==='accepted'?'Accepted by the mail provider. Delivery and physical service are not established.':'Mail outcome '+outcome+'; review with the provider, never automatically resend.'}
}
export async function arrearsMailWebhook(request:Request,env:Bindings){
 try{
  insist(request.method==='POST','method','Use POST.',405)
  insist(!env.RER_DEMO,'demo_delivery','Demo messaging is disabled.',403)
  insist(['resend','sendgrid'].includes(env.MAIL_PROVIDER??'')&&env.RESIDENT_MAIL_WEBHOOK_KEY,'unconfigured','Configure authenticated collection mail events.',503)
  insist(Number(request.headers.get('content-length')??0)<=1024*1024,'body_limit','Event too large.',413)
  const reader=request.body?.getReader(),chunks:Uint8Array[]=[];let length=0
  if(reader)try{for(;;){const {value,done}=await reader.read();if(done)break;length+=value.length;insist(length<=1024*1024,'body_limit','Event too large.',413);chunks.push(value)}}finally{await reader.cancel()}
  const rawBody=new Uint8Array(length);let offset=0;for(const part of chunks){rawBody.set(part,offset);offset+=part.length}
  const installation=await sha256(new TextEncoder().encode(env.SESSION_SECRET??'')),owned=new Map<string,Row>()
  const intake=createDeliveryEventIntake({provider:env.MAIL_PROVIDER,tenantId:env.AUTH_ORIGIN,eventNamespace:'terrace-arrears',key:env.RESIDENT_MAIL_WEBHOOK_KEY,clock:()=>Date.now(),store:createD1EventStore({db:env.DB}),authorize:async e=>{
   const a=await env.DB.prepare('SELECT a.*,t.erased_at,t.custody_retired_at FROM tt_arrears_actions a JOIN tt_tenancies t ON t.id=a.tenancy_id WHERE a.provider_id=?').bind(e.providerMessageId).first<Row>()
   if(!a||a.erased_at||a.custody_retired_at||a.installation!==installation||a.provider!==e.provider||e.recipients.length!==1||e.recipients[0]!==JSON.parse(a.snapshot).recipient||!a.claimed_at||e.deliveryId&&e.deliveryId!==a.id)return false
   owned.set(a.id,a);return true
  }})
  await intake.ingestWebhook({rawBody,headers:request.headers})
  for(const a of owned.values()){
   const state=await env.DB.prepare('SELECT * FROM rer_mail_event_states WHERE provider=? AND tenant_id=? AND event_namespace=? AND provider_message_id=? AND recipient=?').bind(a.provider,env.AUTH_ORIGIN,'terrace-arrears',a.provider_id,JSON.parse(a.snapshot).recipient).first<Row>()
   if(!state)continue
   // The verified event store owns ordering and replay. A failed update is recoverable on replay.
   await env.DB.batch([env.DB.prepare("UPDATE tt_arrears_actions SET state=?,version=version+1 WHERE id=? AND state<>? AND state<>'served'").bind(state.status,a.id,state.status),env.DB.prepare('INSERT INTO tt_arrears_events(id,tenancy_id,kind,detail,reference,on_day,actor,at) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT DO NOTHING').bind('provider:'+a.id+':'+state.event_id,a.tenancy_id,state.status,JSON.stringify({actionId:a.id,providerId:a.provider_id}),state.event_id,new Date(state.occurred_at).toISOString().slice(0,10),'provider:'+a.provider,new Date(state.occurred_at).toISOString())])
  }
  return Response.json({received:true},{headers:{'cache-control':'no-store'}})
 }catch(e){return Response.json({error:e instanceof Fault?e.code:'delivery_event_rejected',message:e instanceof Fault?e.message:'Invalid, unverified or unauthorized provider event.'},{status:e instanceof Fault?e.status:400,headers:{'cache-control':'no-store'}})}
}
