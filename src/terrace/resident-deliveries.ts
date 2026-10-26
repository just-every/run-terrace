import {statementRecipient,statementRecipientGuard,statementRecipients} from './resident-recipient'
import {all,audit,authority,commit,guard,id,insist,one,sha256,sql,tenancy,text,type Context,type Row} from './core'
import {residentMonthlyStatement,residentTransaction} from './resident-statements'
import {operatorMail} from '../mail.server.mjs'
import type {Bindings} from '../auth.server'

export const RESIDENT_DELIVERY_COMMANDS=['resident.delivery.prepare','resident.delivery.send','resident.delivery.outcome']
export const DELIVERY_CONSENT='resident-statement-link-v1'
const digest=(v:unknown)=>sha256(new TextEncoder().encode(JSON.stringify(v)))
const owner=(c:Context)=>insist(c.actor.role==='owner'&&!c.actor.credential&&!c.scheduler,'forbidden','Only the signed-in installation owner manages resident delivery.',403)
export const deliveryEvent=(c:Context,d:string,kind:string,reference:string)=>sql(c,'INSERT INTO tt_resident_delivery_events(id,delivery_id,kind,reference,actor,at) VALUES(?,?,?,?,?,?)',id(),d,kind,reference,c.actor.id,c.now)
const recipient=(c:Context,key:string)=>statementRecipient(c,key,true)
const live=statementRecipientGuard
async function source(c:Context,g:Row,month:string,transactionId:string|null){
 const d=await residentMonthlyStatement(c,g,month);insist(d.currency==='USD','currency','Resident delivery requires confirmed USD.',409)
 if(transactionId){const r=await residentTransaction(c,g,transactionId);insist(r.transaction.receivableDeltaCents<0&&transactionId.startsWith('receipt:')&&r.transaction.date>=d.from&&r.transaction.date<=d.to,'receipt_source','Choose a positive payment receipt in this statement month.',409);return{...d,receipt:r.transaction}}
 return d
}
export async function residentDeliveryCommand(c:Context,name:string,p:Row){
 if(!RESIDENT_DELIVERY_COMMANDS.includes(name))return
 owner(c)
 if(name==='resident.delivery.prepare'){
  const t=await tenancy(c,p.tenancyId),g=await recipient(c,text(p.grantId,'Resident grant',100));insist(g.tenancy_id===t.id,'not_found','Resident grant not found.',404)
  insist(['statement','receipt'].includes(p.kind),'delivery_kind','Choose a monthly statement or payment receipt.')
  insist(p.consentVersion===DELIVERY_CONSENT&&p.consent==='RESIDENT REQUESTED EMAIL','consent_required','Record the resident request for private statement links and its current consent version.')
  const reference=text(p.reference,'Resident consent source',500),transaction=p.kind==='receipt'?text(p.transactionId,'Payment source',100):null,d=await source(c,g,text(p.month,'Month',7),transaction),key=id(),fingerprint=await digest(d),identity={grant_id:g.id,tenancy_id:t.id,identity_id:g.identity_id,recipient:g.email}
  await commit(c,[await live(c,identity),guard(c,"NOT EXISTS(SELECT 1 FROM tt_resident_deliveries WHERE grant_id=? AND kind=? AND fingerprint=? AND state IN ('prepared','accepted','delivered','uncertain'))",g.id,p.kind,fingerprint),sql(c,"INSERT INTO tt_resident_deliveries(id,tenancy_id,grant_id,identity_id,recipient,kind,month,transaction_id,snapshot,fingerprint,prepared_by,prepared_at,consent_reference,consent_version,installation,next_action) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",key,t.id,g.id,g.identity_id,g.email,p.kind,d.month,transaction,JSON.stringify(d),fingerprint,c.actor.id,c.now,reference,DELIVERY_CONSENT,await digest(c.secret),'Review the exact document and recipient, then explicitly approve sending its private link'),deliveryEvent(c,key,'prepared',reference)],name,key)
  return{id:key,fingerprint,tenancyId:t.id,notice:'Document frozen for review. No email sent.'}
 }
 const d=await one(c,'SELECT * FROM tt_resident_deliveries WHERE id=?',text(p.deliveryId,'Delivery',100));insist(d,'not_found','Delivery not found.',404);await tenancy(c,d.tenancy_id)
 if(name==='resident.delivery.outcome'){
  insist(['accepted','delivered'].includes(d.state),'delivery_state','Only a provider-accepted email can have a recorded delivery outcome.',409)
  insist(['delivered','bounced'].includes(p.outcome),'delivery_outcome','Choose delivered or bounced with provider evidence.')
  const reference=text(p.reference,'Provider evidence reference',500),next=p.outcome==='delivered'?'Delivery recorded by the owner from provider evidence; this does not prove the person read it':'Delivery follow-up: contact the resident and reconcile the bounced email before preparing a new send'
  await commit(c,[guard(c,'EXISTS(SELECT 1 FROM tt_resident_deliveries WHERE id=? AND version=?)',d.id,d.version),sql(c,'UPDATE tt_resident_deliveries SET state=?,next_action=?,task_open=?,version=version+1 WHERE id=?',p.outcome,next,p.outcome==='bounced'?1:0,d.id),deliveryEvent(c,d.id,'staff_recorded_'+p.outcome,reference)],name,d.id)
  return{tenancyId:d.tenancy_id,notice:next}
 }
 insist(d.installation===await digest(c.secret),'restored_delivery','A restored delivery cannot be sent. Prepare a new document after inviting the resident again.',409)
 insist(d.state==='prepared','delivery_state','A send was already claimed. Inspect the delivery task; do not send it again.',409)
 insist(p.consent==='SEND PRIVATE LINK'&&p.fingerprint===d.fingerprint,'consent_required','Review the exact document fingerprint and confirm SEND PRIVATE LINK.')
 const g=await recipient(c,d.grant_id);insist(g.email===d.recipient&&g.identity_id===d.identity_id,'recipient_changed','The recipient changed. Prepare a new document.',409)
 insist(await digest(await source(c,g,d.month,d.transaction_id))===d.fingerprint,'statement_changed','The statement changed. Prepare a new document.',409)
 await commit(c,[await live(c,d),guard(c,"EXISTS(SELECT 1 FROM tt_resident_deliveries WHERE id=? AND state='prepared' AND version=?)",d.id,d.version),sql(c,"UPDATE tt_resident_deliveries SET state='uncertain',version=version+1,task_open=1,next_action='Reconcile the provider outcome before any further send; no automatic retry' WHERE id=?",d.id),deliveryEvent(c,d.id,'send_claimed',text(p.reference,'Send authorization source',500))],name,d.id)
 return{residentEmail:{...d,version:d.version+1},tenancyId:d.tenancy_id}
}
export async function sendResidentLink(c:Context,env:Bindings,d:Row){
 owner(c);const g=await recipient(c,d.grant_id);insist(await digest(await source(c,g,d.month,d.transaction_id))===d.fingerprint,'statement_changed','The statement changed after send review. Reconcile the open task; no email was sent.',409);await c.db.batch([authority(c,'resident.delivery.send'),await live(c,d),guard(c,"EXISTS(SELECT 1 FROM tt_resident_deliveries WHERE id=? AND version=? AND state='uncertain')",d.id,d.version)])
 const mail=operatorMail(env),link=env.AUTH_ORIGIN+'/portal/resident-document?id='+encodeURIComponent(d.id)
 let outcome='unconfigured',provider:string|null=null
 if(mail)try{const r=await mail.send({deliveryId:d.id,from:env.MAIL_FROM!,to:[d.recipient],subject:d.kind==='receipt'?'Your Terrace payment receipt is ready':'Your Terrace monthly statement is ready',text:'Sign in to your existing resident portal to read your document: '+link,html:'<p>Sign in to your existing resident portal to read your <a href="'+link+'">document</a>.</p>',headers:{}} as Parameters<NonNullable<typeof mail>['send']>[0]);outcome=r.status;provider=r.providerMessageId??null}catch{outcome='uncertain'}
 const next=outcome==='accepted'?'Accepted by the mail provider; delivery is not yet confirmed':outcome==='development'?'Not sent: development email is suppressed':'Delivery follow-up: '+outcome+'. Contact the resident and reconcile the provider before preparing another send'
 await c.db.batch([sql(c,'UPDATE tt_resident_deliveries SET state=?,provider=?,provider_id=?,next_action=?,task_open=? WHERE id=? AND version=?',outcome,env.MAIL_PROVIDER??null,provider,next,outcome==='accepted'?0:1,d.id,d.version),deliveryEvent(c,d.id,outcome,provider??'No provider message reference'),audit(c,'resident.delivery.result',d.id,outcome)])
 return{outcome,notice:next}
}
export async function residentDeliveryData(c:Context,tenancyId:string){
 owner(c);const t=await tenancy(c,tenancyId)
 return{consentVersion:DELIVERY_CONSENT,
  receipts:await all(c,'SELECT r.id,r.received_date,r.amount_cents,q.description FROM tt_net_receipts r JOIN tt_charges q ON q.id=r.charge_id WHERE q.tenancy_id=? AND r.amount_cents>0 ORDER BY r.received_date,r.id',tenancyId),
  deliveries:await all(c,'SELECT * FROM tt_resident_deliveries WHERE tenancy_id=? ORDER BY prepared_at,id',tenancyId),
  recipients:await statementRecipients(c,t)}
}
export async function deliveryDocument(c:Context,key:string,portal?:{identity:Row,grants:Row[]}){
 const d=await one(c,'SELECT * FROM tt_resident_deliveries WHERE id=?',key);insist(d,'not_found','Document not found.',404)
 if(portal){await statementRecipient(c,d.grant_id);insist(d.identity_id===portal.identity.id&&portal.grants.some(g=>g.id===d.grant_id&&g.tenancy_id===d.tenancy_id&&g.access==='resident')&&d.installation===await digest(c.secret),'not_found','Document not found.',404)}
 else{owner(c);await tenancy(c,d.tenancy_id)}
 const snapshot=JSON.parse(d.snapshot);insist(await digest(snapshot)===d.fingerprint,'document_integrity','Document integrity check failed.',409)
 return{...snapshot,delivery:{id:d.id,kind:d.kind,state:d.state,nextAction:d.next_action,preparedAt:d.prepared_at},fingerprint:d.fingerprint}
}
