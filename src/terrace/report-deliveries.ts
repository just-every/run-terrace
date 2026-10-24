import {REPORT_CUSTODY_COMMANDS,reportCustody,deliveryHolds} from './report-custody'
import type {Bindings} from '../auth.server'
import {operatorMail} from '../mail.server.mjs'
import {all,audit,authority,commit,escape,guard,id,insist,one,recordRead,sha256,sql,text,type Context,type Row} from './core'
import {generatedReport} from './report-schedules'
import {ownerData,ownerPeriodStatement} from './portal-data'
import type {Portal} from './portal-session'
const digest=(v:unknown)=>sha256(new TextEncoder().encode(JSON.stringify(v)))
const owner=(c:Context)=>insist(c.actor.role==='owner'&&!c.actor.credential&&!c.scheduler,'forbidden','Only the signed-in installation owner manages report delivery.',403)
export const REPORT_DELIVERY_COMMANDS=['report.delivery.prepare','report.delivery.send','report.delivery.outcome',...REPORT_CUSTODY_COMMANDS]
const event=(c:Context,d:string,kind:string,reference:string)=>sql(c,'INSERT INTO tt_report_delivery_events(id,delivery_id,kind,reference,actor,at) VALUES(?,?,?,?,?,?)',id(),d,kind,reference,c.actor.id,c.now)
async function grant(c:Context,key:string){
 const g=await one(c,"SELECT g.*,i.email,i.status FROM tt_portal_grants g JOIN tt_portal_identities i ON i.id=g.identity_id WHERE g.id=? AND g.revoked_at IS NULL AND g.access='owner' AND i.kind='owner' AND i.status='active'",key)
 insist(g,'recipient_unavailable','Choose an active owner portal grant.',409);return g
}
async function scope(c:Context,ownerId:string,propertyId:string){return digest((await ownerData(c,ownerId)).properties.filter(p=>p.id===propertyId))}
const live=(c:Context,d:Row)=>guard(c,"EXISTS(SELECT 1 FROM tt_portal_grants g JOIN tt_portal_identities i ON i.id=g.identity_id WHERE g.id=? AND g.owner_id=? AND g.identity_id=? AND g.revoked_at IS NULL AND g.access='owner' AND i.kind='owner' AND i.status='active' AND i.email=?)",d.grant_id,d.owner_id,d.identity_id,d.recipient)
async function verified(c:Context,d:Row){
 const g=await grant(c,d.grant_id)
 insist(g.owner_id===d.owner_id&&g.identity_id===d.identity_id&&g.email===d.recipient,'recipient_changed','Recipient authority changed. Prepare a new reviewed report.',409)
 const {generation:generation}=await generatedReport(c,d.generation_id)
 insist(await scope(c,d.owner_id,d.property_id)===d.scope_fingerprint,'scope_changed','Ownership scope changed. Prepare a new report.',409)
 const current=await ownerPeriodStatement(c,d.owner_id,generation.report_from,generation.report_to,d.property_id)
 insist(await digest(current)===d.fingerprint,'report_changed','Owner statement sources changed. Review a new generation.',409)
 return current
}
export async function reportDeliveryCommand(c:Context,name:string,p:Row):Promise<Row|undefined>{
 if(!REPORT_DELIVERY_COMMANDS.includes(name))return
 owner(c)
 if(name==='report.delivery.prepare'){
  insist(p.consent==='DELIVER OWNER REPORT','consent_required','Confirm DELIVER OWNER REPORT to prepare a private owner statement.')
  const {generation:g}=await generatedReport(c,p.generationId),s=await one(c,'SELECT * FROM tt_report_schedules WHERE id=?',g.schedule_id),recipient=await grant(c,text(p.grantId,'Owner portal grant',100))
  insist(s?.kind==='financial'&&s.owner_id&&s.owner_id===recipient.owner_id,'recipient_scope','Use a financial generation filtered to this portal owner.',409)
  insist(p.fingerprint===g.fingerprint,'report_changed','Review the current generation fingerprint.',409)
  const statement=await ownerPeriodStatement(c,s.owner_id,g.report_from,g.report_to,s.property_id),owned=(await ownerData(c,s.owner_id)).properties.find(x=>x.id===s.property_id)
  insist(owned?.periods.some(x=>x.from<=g.report_to&&(!x.to||x.to>=g.report_from)),'recipient_scope','This owner held no share in the report period.',409)
  const key=id(),fingerprint=await digest(statement),d={grant_id:recipient.id,owner_id:recipient.owner_id,identity_id:recipient.identity_id,recipient:recipient.email}
  await commit(c,[live(c,d),guard(c,'NOT EXISTS(SELECT 1 FROM tt_report_deliveries WHERE generation_id=? AND grant_id=?)',g.id,recipient.id),sql(c,"INSERT INTO tt_report_deliveries(id,generation_id,grant_id,identity_id,owner_id,property_id,recipient,snapshot,fingerprint,scope_fingerprint,prepared_by,prepared_at,next_action) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)",key,g.id,recipient.id,recipient.identity_id,s.owner_id,s.property_id,recipient.email,JSON.stringify(statement),fingerprint,await scope(c,s.owner_id,s.property_id),c.actor.id,c.now,'Review the frozen owner allocation statement, then explicitly send its private link'),event(c,key,'prepared',text(p.reference,'Authorization reference',500))],name,key)
  return{id:key,fingerprint,tab:'report-schedules',notice:'Owner statement frozen for review. No email sent.'}
 }
 const d=await one(c,'SELECT * FROM tt_report_deliveries WHERE id=?',text(p.deliveryId,'Delivery',100));insist(d,'not_found','Delivery not found.',404)
 const custody=await reportCustody(c,name,p,d);if(custody)return custody
 insist(d.prepared_by===c.actor.id&&!d.deleted_at,'not_found','Delivery not found.',404)
 if(name==='report.delivery.outcome'){
  insist(['accepted','delivered'].includes(d.state),'delivery_state','Only a provider-accepted link can have a recorded delivery or bounce.',409)
  insist(['delivered','bounced'].includes(p.outcome),'delivery_outcome','Record delivered or bounced with a provider reference.')
  const reference=text(p.reference,'Provider evidence reference',500)
  await commit(c,[guard(c,'EXISTS(SELECT 1 FROM tt_report_deliveries WHERE id=? AND version=?)',d.id,d.version),sql(c,'UPDATE tt_report_deliveries SET state=?,version=version+1,next_action=? WHERE id=?',p.outcome,p.outcome==='bounced'?'Failed-delivery task: contact the owner and correct their portal address; do not resend this report':'Delivery recorded from staff-supplied provider evidence',d.id),event(c,d.id,p.outcome,reference)],name,d.id)
  return{tab:'report-schedules',notice:p.outcome==='bounced'?'Bounce recorded. Failed-delivery task opened.':'Delivery recorded from provider evidence.'}
 }
 insist(p.consent==='SEND LINK'&&p.fingerprint===d.fingerprint,'consent_required','Review the fingerprint and confirm SEND LINK.')
 insist(['prepared','rejected','rate_limited','development','unconfigured'].includes(d.state),'delivery_state','This link was accepted or its outcome is uncertain. Reconcile it; never resend blindly.',409)
 await verified(c,d)
 await commit(c,[live(c,d),guard(c,'EXISTS(SELECT 1 FROM tt_report_deliveries WHERE id=? AND version=?)',d.id,d.version),sql(c,"UPDATE tt_report_deliveries SET state='uncertain',attempts=attempts+1,version=version+1,next_action='Reconcile the provider outcome before taking any further action; no automatic retry' WHERE id=?",d.id),event(c,d.id,'send_claimed',text(p.reference,'Send authorization reference',500))],name,d.id)
 return{reportEmail:{...d,version:d.version+1},tab:'report-schedules'}
}
export async function sendReportLink(c:Context,env:Bindings,d:Row){
 // The durable uncertain claim survives a crash. Re-read the grant and source before crossing the mail boundary.
 owner(c);await verified(c,d);await c.db.batch([authority(c,'report.delivery.send'),live(c,d),guard(c,"EXISTS(SELECT 1 FROM tt_report_deliveries WHERE id=? AND version=? AND state='uncertain' AND deleted_at IS NULL)",d.id,d.version)])
 const mail=operatorMail(env),link=env.AUTH_ORIGIN+'/portal/report?id='+encodeURIComponent(d.id)
 let outcome='unconfigured',provider:string|null=null
 if(mail)try{const result=await mail.send({deliveryId:d.id,from:env.MAIL_FROM!,to:[d.recipient],subject:'Your Terrace owner report is ready',text:'Sign in with your existing owner portal account to read your report: '+link,html:'<p>Sign in with your existing owner portal account to read your <a href="'+escape(link)+'">owner report</a>.</p>',headers:{}} as Parameters<NonNullable<typeof mail>['send']>[0]);outcome=result.status;provider=result.providerMessageId??null}catch{outcome='uncertain'}
 const next=outcome==='accepted'?'Provider accepted the link; mailbox delivery is not confirmed':['rejected','rate_limited','development','unconfigured'].includes(outcome)?'Not sent: '+outcome+'. Correct the cause, review current scope and explicitly retry':'Outcome uncertain: reconcile with the provider; never resend blindly'
 await c.db.batch([sql(c,'UPDATE tt_report_deliveries SET state=?,provider_id=?,next_action=? WHERE id=? AND version=?',outcome,provider,next,d.id,d.version),event(c,d.id,outcome,provider||'No provider message reference'),audit(c,'report.delivery.result',d.id,outcome)])
 return{outcome,notice:next}
}
export async function portalReport(c:Context,portal:Portal,key:string){
 const d=await one(c,'SELECT * FROM tt_report_deliveries WHERE id=?',key)
 insist(d&&d.identity_id===portal.identity.id&&portal.grants.some(g=>g.id===d.grant_id&&g.owner_id===d.owner_id)&&['accepted','delivered'].includes(d.state),'not_found','Report not found.',404)
 insist(await scope(c,d.owner_id,d.property_id)===d.scope_fingerprint,'not_found','Report not found.',404)
 const generation=await one(c,'SELECT g.*,s.retired_at,s.require_close FROM tt_report_generations g JOIN tt_report_schedules s ON s.id=g.schedule_id WHERE g.id=?',d.generation_id)
 insist(generation&&!generation.retired_at&&await one(c,"SELECT o.id FROM oa_operators o JOIN tt_report_schedules s ON s.created_by=o.id WHERE s.id=? AND o.status='active' AND o.role='owner'",generation.schedule_id),'not_found','Report not found.',404)
 if(generation.require_close)insist(await one(c,'SELECT id FROM tt_period_closes WHERE month=? AND reopened_at IS NULL',generation.report_from.slice(0,7)),'not_found','Report not found.',404)
 const current=await ownerPeriodStatement(c,d.owner_id,generation.report_from,generation.report_to,d.property_id)
 insist(await digest(current)===d.fingerprint&&await digest(JSON.parse(d.snapshot))===d.fingerprint,'not_found','Report sources changed. Request a newly reviewed report.',404)
 await recordRead(c,'portal.read:scheduled-report',d.id);return JSON.parse(d.snapshot)
}
export async function reviewedReport(c:Context,key:string){owner(c);const d=await one(c,'SELECT * FROM tt_report_deliveries WHERE id=? AND prepared_by=? AND deleted_at IS NULL',key,c.actor.id);insist(d,'not_found','Report not found.',404);await verified(c,d);await recordRead(c,'read:report-delivery',d.id);return{fingerprint:d.fingerprint,statement:JSON.parse(d.snapshot)}}
export async function reportDeliveries(c:Context){owner(c);return{holds:await deliveryHolds(c),deliveries:await all(c,'SELECT id,generation_id,grant_id,recipient,fingerprint,state,version,attempts,provider_id,next_action,deleted_at FROM tt_report_deliveries ORDER BY prepared_at,id'),recipients:await all(c,"SELECT g.id,g.owner_id,i.display_name FROM tt_portal_grants g JOIN tt_portal_identities i ON i.id=g.identity_id WHERE g.access='owner' AND g.revoked_at IS NULL AND i.kind='owner' AND i.status='active' ORDER BY i.display_name,g.id")}}
