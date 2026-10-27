import {all,allow,commit,id,insist,one,reachesPortfolio,sql,tenancy,tenancyGuard,text,type Context,type Row} from './core'
import {noCredential} from './credentials'
import {liveRecipient,messageEvent,messageInstallation} from './message-context'
import {localDate} from './zones'
export async function prepareBuildingNotice(c:Context,p:Row){
 noCredential(c,'prepare building notices');allow(c,'conversation.broadcast');allow(c,'message.prepare')
 const t=await tenancy(c,p.tenancyId),property=await one(c,'SELECT p.* FROM tt_properties p JOIN tt_units u ON u.property_id=p.id WHERE u.id=?',t.unit_id)
 insist(property&&reachesPortfolio(c,property.portfolio_id),'not_found','Building not found.',404)
 const channel=String(p.channel),body=text(p.body,'Building notice',1600)
 insist(['email','sms'].includes(channel),'invalid_input','Choose email or text.')
 const day=localDate(c.now,property.time_zone),rows=await all(c,'SELECT t.* FROM tt_tenancies t JOIN tt_units u ON u.id=t.unit_id WHERE u.property_id=? AND t.erased_at IS NULL AND t.start_date<=? AND t.end_date>=? AND (t.ended_on IS NULL OR t.ended_on>=?) ORDER BY t.id',property.id,day,day,day)
 insist(rows.length,'no_recipients','This building has no current resident recipients.',409)
 const noticeId=id(),installation=await messageInstallation(c),writes=[sql(c,'INSERT INTO tt_building_notices(id,property_id,created_by,created_at) VALUES(?,?,?,?)',noticeId,property.id,c.actor.id,c.now)],recipients:Row[]=[]
 for(const row of rows){
  const current=await tenancy(c,row.id),r=await one(c,"SELECT * FROM tt_message_contacts WHERE tenancy_id=? AND kind='resident' AND subject_id=?",row.id,row.id)
  insist(r&&r[`${channel}_consent`]===1&&r.installation===installation&&(channel==='email'||!r.stopped),'consent_required','Every current household needs current recorded permission for the selected channel. No drafts were created.',409)
  const fence=await liveRecipient(c,r,current),messageId=id()
  writes.push(tenancyGuard(c,current),fence,sql(c,'INSERT INTO tt_guard(ok) VALUES(CASE WHEN EXISTS(SELECT 1 FROM tt_message_contacts WHERE id=? AND version=?) THEN 1 ELSE 0 END)',r.id,r.version),sql(c,"INSERT INTO tt_messages(id,tenancy_id,contact_id,contact_version,channel,purpose,body,snapshot,prepared_by,prepared_at,installation) VALUES(?,?,?,?,?,'repair',?,'{}',?,?,?)",messageId,row.id,r.id,r.version,channel,body,c.actor.id,c.now,installation),messageEvent(c,messageId,'prepared','Building notice draft; exact recipient approval and explicit send remain required'),sql(c,'INSERT INTO tt_building_notice_recipients(notice_id,message_id,tenancy_id) VALUES(?,?,?)',noticeId,messageId,row.id))
  recipients.push({messageId,tenancyId:row.id,name:r.name})
 }
 await commit(c,writes,'conversation.broadcast',noticeId)
 return{id:noticeId,tenancyId:t.id,recipients,notice:'Building notice drafts prepared. Approve and explicitly send each exact recipient message. Nothing sent.'}
}
export async function residentConversation(c:Context,tenancyId:string){
 // Called only after the portal door checks a full live grant and the named primary resident.
 return{messages:await all(c,"SELECT m.id,m.body,m.channel,m.state,m.claimed_at FROM tt_messages m JOIN tt_message_contacts r ON r.id=m.contact_id JOIN tt_tenancies t ON t.id=m.tenancy_id WHERE m.tenancy_id=? AND r.kind='resident' AND r.email=t.tenant_email AND m.claimed_at IS NOT NULL AND m.state NOT IN ('prepared','approved','claimed') ORDER BY m.prepared_at,m.rowid",tenancyId)}
}
export async function buildingNoticeData(c:Context,tenancyId:unknown){
 noCredential(c,'read building notices');allow(c,'conversation.read');const t=await tenancy(c,tenancyId)
 const property=await one(c,'SELECT property_id FROM tt_units WHERE id=?',t.unit_id)
 if(!property)return[]
 const rows=await all(c,'SELECT n.id AS notice_id,n.created_at,m.id AS message_id,m.tenancy_id,r.name,m.channel,m.body,m.state,m.error_code FROM tt_building_notices n JOIN tt_building_notice_recipients nr ON nr.notice_id=n.id JOIN tt_messages m ON m.id=nr.message_id JOIN tt_message_contacts r ON r.id=m.contact_id WHERE n.property_id=? ORDER BY n.created_at,n.id,m.tenancy_id',property.property_id)
 const result=[]
 for(const row of rows){await tenancy(c,row.tenancy_id);result.push(row)}
 return result
}
