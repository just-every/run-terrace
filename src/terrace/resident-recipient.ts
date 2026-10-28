import {all,guard,insist,one,type Context,type Row} from './core'
import {localDate} from './zones'

// PORT-004: delivery and document rights follow current property-local
// household membership. Email additionally requires the email preference.
function scope(emailOnly:boolean){return `g.access='resident' AND g.revoked_at IS NULL AND i.kind='resident' AND i.status='active' AND t.erased_at IS NULL AND t.custody_retired_at IS NULL AND ((i.email=t.tenant_email ${emailOnly?"AND NOT EXISTS(SELECT 1 FROM tt_message_contacts mc WHERE mc.tenancy_id=t.id AND mc.kind='resident' AND mc.subject_id=t.id AND mc.email=i.email AND mc.email_consent=0)":''} AND t.start_date<=? AND (t.ended_on IS NULL OR t.ended_on>=?)) OR EXISTS(SELECT 1 FROM tt_household_members h WHERE h.tenancy_id=t.id AND h.email=i.email AND h.role IN ('co_tenant','guarantor','authorized_contact') ${emailOnly?"AND h.contact_by='email'":''} AND h.joined<=? AND (h.left_on IS NULL OR h.left_on>=?)))`}
const join='tt_portal_grants g JOIN tt_portal_identities i ON i.id=g.identity_id JOIN tt_tenancies t ON t.id=g.tenancy_id'
export async function statementRecipient(c:Context,key:string,emailOnly=false):Promise<Row>{
 const g=await one(c,`SELECT g.*,i.email,t.time_zone FROM ${join} WHERE g.id=?`,key)
 insist(g,'recipient_unavailable','Resident document recipient unavailable.',404)
 const day=localDate(c.now,g.time_zone),eligible=await one(c,`SELECT g.id FROM ${join} WHERE g.id=? AND ${scope(emailOnly)}`,key,day,day,day,day)
 insist(eligible,'recipient_unavailable',emailOnly?'The recipient must be a current household member who permits email.':'Resident document not found.',emailOnly?409:404)
 return{...g,localDay:day}
}
export async function statementRecipientGuard(c:Context,d:Row){
 const g=await statementRecipient(c,d.grant_id,true)
 return guard(c,`EXISTS(SELECT 1 FROM ${join} WHERE g.id=? AND g.tenancy_id=? AND g.identity_id=? AND i.email=? AND t.time_zone=? AND ${scope(true)})`,d.grant_id,d.tenancy_id,d.identity_id,d.recipient,g.time_zone,g.localDay,g.localDay,g.localDay,g.localDay)
}
export async function statementRecipients(c:Context,t:Row){
 const day=localDate(c.now,t.time_zone)
 return all(c,`SELECT g.id,i.display_name,i.email FROM ${join} WHERE g.tenancy_id=? AND ${scope(true)} ORDER BY i.display_name,g.id`,t.id,day,day,day,day)
}
