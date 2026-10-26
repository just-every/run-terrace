import {createDeliveryEventIntake,createD1EventStore} from '../modules/mail/index.mjs'
import type {Bindings} from '../auth.server'
import {Fault,insist,sha256,type Row} from './core'
import {residentPdf} from './resident-pdf'
import {residentMonthlyCsv,residentMonthlyPage} from './resident-statements'
import {escape as e} from './core'

export function residentDocumentResponse(d:Row,format:string,person:Row={}){
 const headers={'cache-control':'private, no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer'}
 if(format==='json')return Response.json(d,{headers})
 if(format==='pdf')return new Response(residentPdf(d,d.delivery?.kind==='receipt'),{headers:{...headers,'content-type':'application/pdf','content-disposition':'attachment; filename="terrace-resident-document.pdf"'}})
 if(format==='csv')return new Response(residentMonthlyCsv(d),{headers:{...headers,'content-type':'text/csv;charset=utf-8','content-disposition':'attachment; filename="terrace-resident-document.csv"'}})
 insist(format==='html','document_format','Choose HTML, PDF, CSV or JSON.')
 const receipt=d.receipt?`<section><h2>Payment receipt</h2><p>${e(d.receipt.date)} · ${e(d.receipt.description)} · ${(d.receipt.amountCents/100).toFixed(2)} USD</p><a href="/portal/transaction?tenancyId=${e(d.tenancy.id)}&amp;id=${e(d.receipt.id)}">Inspect payment source</a></section>`:''
 const delivery=d.delivery?`<section><h2>Document delivery</h2><p>${e(d.delivery.state)} · ${e(d.delivery.nextAction)}</p><p>Prepared ${e(d.delivery.preparedAt)}. This document preserves the balances recorded at preparation. <a href="/portal/statement?tenancyId=${e(d.tenancy.id)}&amp;month=${e(d.month)}">Read the current statement</a></p><p><a href="?id=${e(d.delivery.id)}&amp;format=pdf">Download document (PDF)</a> · <a href="?id=${e(d.delivery.id)}&amp;format=csv">Download document (CSV)</a></p></section>`:''
 const back=person.staff?`<p><a href="/app?tab=ledger&amp;tenancy=${e(d.tenancy.id)}">Back to Rent &amp; arrears</a></p>`:''
 const body=residentMonthlyPage(person,d).replace('</main>',receipt+delivery+back+'</main>')
 return new Response(body,{headers:{...headers,'content-type':'text/html;charset=utf-8','content-security-policy':"default-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self' data:; img-src 'self' data:; frame-ancestors 'none'"}})
}
export async function residentDeliveryWebhook(request:Request,env:Bindings){
 const headers={'cache-control':'no-store'}
 try{
  insist(request.method==='POST','method','Use POST.',405)
  insist(!env.RER_DEMO,'demo_delivery','Demo delivery events are disabled.',403)
  insist(['resend','sendgrid'].includes(env.MAIL_PROVIDER??'')&&env.RESIDENT_MAIL_WEBHOOK_KEY,'delivery_unconfigured','Configure authenticated resident mail events.',503)
  insist(Number(request.headers.get('content-length')??0)<=1024*1024,'body_limit','Delivery event too large.',413)
  const reader=request.body?.getReader(),chunks:Uint8Array[]=[];let length=0
  if(reader)try{for(;;){const {value,done}=await reader.read();if(done)break;length+=value.length;insist(length<=1024*1024,'body_limit','Delivery event too large.',413);chunks.push(value)}}finally{await reader.cancel()}
  const rawBody=new Uint8Array(length);let at=0;for(const part of chunks){rawBody.set(part,at);at+=part.length}
  const now=new Date().toISOString(),installation=await sha256(new TextEncoder().encode(JSON.stringify(env.SESSION_SECRET))),owned=new Map<string,Row>()
  const intake=createDeliveryEventIntake({provider:env.MAIL_PROVIDER,tenantId:env.AUTH_ORIGIN,eventNamespace:'terrace-resident-documents',key:env.RESIDENT_MAIL_WEBHOOK_KEY,clock:()=>Date.parse(now),store:createD1EventStore({db:env.DB}),authorize:async event=>{
   const d=event.deliveryId?await env.DB.prepare('SELECT * FROM tt_resident_deliveries WHERE id=?').bind(event.deliveryId).first<Row>():await env.DB.prepare('SELECT * FROM tt_resident_deliveries WHERE provider_id=?').bind(event.providerMessageId).first<Row>()
   if(!d||d.installation!==installation||d.provider!==event.provider||!['accepted','delivered','bounced','failed','rejected','deferred','complained'].includes(d.state)||event.recipients.length!==1||event.recipients[0]!==d.recipient||!d.provider_id||event.providerMessageId.split('.')[0]!==d.provider_id.split('.')[0])return false
   owned.set(d.id,{...d,message:event.providerMessageId});return true
  }})
  await intake.ingestWebhook({rawBody,headers:request.headers})
  // Intake owns replay and ordering. Re-apply persisted state even on duplicate
  // notifications so a crash between intake and this transaction is recoverable.
  for(const d of owned.values()){
   const s=await env.DB.prepare('SELECT * FROM rer_mail_event_states WHERE provider=? AND tenant_id=? AND event_namespace=? AND provider_message_id=? AND recipient=?').bind(d.provider,env.AUTH_ORIGIN,'terrace-resident-documents',d.message,d.recipient).first<Row>()
   if(!s)continue
   const failed=['bounced','failed','rejected','complained'].includes(s.status),next=failed?'Delivery follow-up: contact the resident, correct the cause and review before preparing a new send':s.status==='delivered'?'Recipient mail server confirmed delivery; this does not prove the person read it':'Provider delivery pending; no automatic resend'
   await env.DB.batch([env.DB.prepare('UPDATE tt_resident_deliveries SET state=?,next_action=?,task_open=?,applied_event_id=?,version=version+1 WHERE id=? AND applied_event_id IS NOT ? AND ?=(SELECT event_id FROM rer_mail_event_states WHERE provider=? AND tenant_id=? AND event_namespace=? AND provider_message_id=? AND recipient=?)').bind(s.status,next,failed?1:0,s.event_id,d.id,s.event_id,s.event_id,d.provider,env.AUTH_ORIGIN,'terrace-resident-documents',d.message,d.recipient),env.DB.prepare('INSERT INTO tt_resident_delivery_events(id,delivery_id,kind,reference,actor,at) VALUES(?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING').bind('provider:'+d.id+':'+s.event_id,d.id,s.status,s.event_id,'provider:'+d.provider,new Date(s.occurred_at).toISOString())])
  }
  return Response.json({received:true},{headers})
 }catch(error){if(error instanceof Fault)return Response.json({error:error.code,message:error.message},{status:error.status,headers});return Response.json({error:'delivery_event_rejected',message:'Invalid, unverified or unauthorized delivery event.'},{status:(error as {code?:string})?.code==='event_storage_failed'?503:400,headers})}
}
