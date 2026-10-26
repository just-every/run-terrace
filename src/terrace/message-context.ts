import {all,allow,guard,insist,one,sha256,sql,tenancy,text,type Context,type Row} from './core'
import {noCredential} from './credentials'
import {localDate} from './zones'

export const messageInstallation=(c:Context)=>sha256(new TextEncoder().encode(c.secret??''))
export function messageAccess(c:Context,action:string){noCredential(c,'manage repair communications');allow(c,action)}
export const messageEvent=(c:Context,messageId:string,kind:string,body:string,key:string=crypto.randomUUID())=>sql(c,'INSERT INTO tt_message_events(id,message_id,kind,body,actor,at) VALUES(?,?,?,?,?,?)',key,messageId,kind,body,c.actor.id,c.now)
export async function contact(c:Context,value:unknown){
 const r=await one(c,'SELECT * FROM tt_message_contacts WHERE id=?',text(value,'Contact',100));insist(r,'not_found','Contact not found.',404)
 const t=await tenancy(c,r.tenancy_id);return{r,t}
}
export async function message(c:Context,value:unknown){
 const m=await one(c,'SELECT * FROM tt_messages WHERE id=?',text(value,'Message',100));insist(m,'not_found','Message not found.',404)
 const {r,t}=await contact(c,m.contact_id);return{m,r,t}
}
export async function liveRecipient(c:Context,r:Row,t:Row){
 const day=localDate(c.now,t.time_zone)
 if(r.kind==='resident')insist(r.subject_id===t.id&&r.email===t.tenant_email,'recipient_changed','The primary resident changed. Review the contact again.',409)
 if(r.kind==='vendor')insist(await one(c,'SELECT id FROM tt_maintenance_jobs WHERE tenancy_id=? AND vendor_id=? AND state IN (\'approved\',\'sent\') AND trade_email=?',t.id,r.subject_id,r.email),'recipient_changed','The vendor has no current assigned approved work here.',409)
 if(r.kind==='responder')insist(await one(c,"SELECT o.id FROM oa_operators o JOIN tt_emergencies e ON e.primary_id=o.id OR e.backup_id=o.id WHERE e.tenancy_id=? AND e.emergency=1 AND e.state='open' AND o.id=? AND o.email=? AND o.status='active' AND (o.role='owner' OR EXISTS(SELECT 1 FROM tt_staff_roles s JOIN tt_role_actions a ON a.role=s.role WHERE s.operator_id=o.id AND a.action='emergency.acknowledge' AND (s.all_portfolios=1 OR EXISTS(SELECT 1 FROM tt_role_portfolios p WHERE p.operator_id=o.id AND p.portfolio_id=e.portfolio_id))))",t.id,r.subject_id,r.email),'recipient_changed','The named responder is no longer available for an open case.',409)
 // The property-local day is deliberately evaluated before any outbound decision.
 insist(day>=t.start_date&&day<=t.end_date,'recipient_changed','This tenancy is outside its current term. Review authority before contacting a former resident.',409)
 return r.kind==='vendor'?guard(c,"EXISTS(SELECT 1 FROM tt_maintenance_jobs WHERE tenancy_id=? AND vendor_id=? AND trade_email=? AND state IN ('approved','sent'))",t.id,r.subject_id,r.email):r.kind==='responder'?guard(c,"EXISTS(SELECT 1 FROM oa_operators o JOIN tt_emergencies e ON e.primary_id=o.id OR e.backup_id=o.id WHERE e.tenancy_id=? AND e.state='open' AND o.id=? AND o.email=? AND o.status='active' AND (o.role='owner' OR EXISTS(SELECT 1 FROM tt_staff_roles s JOIN tt_role_actions a ON a.role=s.role WHERE s.operator_id=o.id AND a.action='emergency.acknowledge' AND (s.all_portfolios=1 OR EXISTS(SELECT 1 FROM tt_role_portfolios p WHERE p.operator_id=o.id AND p.portfolio_id=e.portfolio_id)))))",t.id,r.subject_id,r.email):guard(c,'EXISTS(SELECT 1 FROM tt_tenancies WHERE id=? AND tenant_email=? AND version=? AND erased_at IS NULL)',t.id,r.email,t.version)
}
export async function messageTerms(c:Context,m:Row){
 const s=JSON.parse(m.snapshot)
 if(m.appointment_id){
  const a=await one(c,'SELECT a.*,j.version AS job_version,j.state AS job_state,(SELECT id FROM tt_maintenance_approvals WHERE job_id=j.id ORDER BY job_version DESC LIMIT 1) AS current_approval FROM tt_appointments a JOIN tt_maintenance_jobs j ON j.id=a.job_id WHERE a.id=?',m.appointment_id)
  insist(a&&['proposed','confirmed'].includes(a.state)&&['approved','sent'].includes(a.job_state)&&a.current_approval===s.approvalId&&a.approval_id===s.approvalId&&a.job_version===s.jobVersion&&a.ends_at>c.now,'stale_window','The appointment or approved work changed. Prepare a new message.',409)
  return guard(c,"EXISTS(SELECT 1 FROM tt_appointments a JOIN tt_maintenance_jobs j ON j.id=a.job_id WHERE a.id=? AND a.version=? AND j.version=? AND j.state IN ('approved','sent'))",a.id,a.version,a.job_version)
 }
 if(m.emergency_id){
  const e=await one(c,"SELECT * FROM tt_emergencies WHERE id=? AND state='open' AND emergency=1",m.emergency_id)
  insist(e&&[e.primary_id,e.backup_id].includes(s.recipientId),'case_changed','This case was acknowledged, resolved or reassigned. No page sent.',409)
  return guard(c,"EXISTS(SELECT 1 FROM tt_emergencies WHERE id=? AND version=? AND state='open')",e.id,e.version)
 }
 return guard(c,'1=1')
}
export async function messageData(c:Context,tenancyId:unknown){
 messageAccess(c,'message.read');const t=await tenancy(c,tenancyId)
 const [contacts,messages,events,appointments,emergencies]=await Promise.all([
  all(c,'SELECT * FROM tt_message_contacts WHERE tenancy_id=? ORDER BY name',t.id),
  all(c,"SELECT m.*,json_extract(v.evidence,'$.name') AS name,CASE WHEN m.channel='email' THEN json_extract(v.evidence,'$.email') ELSE json_extract(v.evidence,'$.phone') END AS recipient FROM tt_messages m JOIN tt_message_contact_versions v ON v.contact_id=m.contact_id AND v.version=m.contact_version WHERE m.tenancy_id=? ORDER BY m.prepared_at,m.rowid",t.id),
  all(c,'SELECT e.* FROM tt_message_events e JOIN tt_messages m ON m.id=e.message_id WHERE m.tenancy_id=? ORDER BY e.at,e.rowid',t.id),
  all(c,"SELECT a.id,a.starts_at,a.ends_at,a.time_zone FROM tt_appointments a JOIN tt_maintenance_jobs j ON j.id=a.job_id WHERE j.tenancy_id=? AND a.state IN ('proposed','confirmed') AND j.state IN ('approved','sent') ORDER BY a.starts_at",t.id),
  all(c,"SELECT id,risk,primary_id,backup_id FROM tt_emergencies WHERE tenancy_id=? AND state='open' AND emergency=1",t.id)])
 return{tenancy:t,contacts,messages,events,appointments,emergencies,
  vendorChoices:await all(c,"SELECT DISTINCT v.id,v.name FROM tt_vendors v JOIN tt_maintenance_jobs j ON j.vendor_id=v.id WHERE j.tenancy_id=? AND j.state IN ('approved','sent')",t.id),
  responderChoices:await all(c,"SELECT DISTINCT o.id,o.display_name AS name FROM oa_operators o JOIN tt_emergencies e ON e.primary_id=o.id OR e.backup_id=o.id WHERE e.tenancy_id=? AND e.state='open' AND o.status='active'",t.id)}
}
