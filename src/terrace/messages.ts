import {all,commit,email,guard,id,insist,one,sha256,sql,tenancy,tenancyGuard,text,type Context,type Row} from './core'
import {anyZone} from './zones'
import {contact,liveRecipient,message,messageAccess,messageEvent,messageInstallation,messageTerms} from './message-context'
export const MESSAGE_COMMANDS=['message.contact','message.prepare','message.approve','message.send']
const consent=(value:unknown)=>value==='granted'?1:0
const revision=(r:Row,p:Row)=>insist(Number(p.version)===r.version,'conflict','Reload the current version.',409)

export async function messageCommand(c:Context,command:string,p:Row):Promise<Row|undefined>{
 if(!MESSAGE_COMMANDS.includes(command))return
 messageAccess(c,command)
 if(command==='message.contact'){
  const t=await tenancy(c,p.tenancyId),[kind,subjectId]=p.recipient?String(p.recipient).split(':'):[String(p.kind),String(p.subjectId)]
  insist(['resident','vendor','responder'].includes(kind),'invalid_input','Choose a current resident, assigned vendor or named responder.')
  let target:Row|null=null
  if(kind==='resident'&&subjectId===t.id)target={id:t.id,name:t.tenant_name,email:t.tenant_email}
  if(kind==='vendor')target=await one(c,"SELECT v.id,v.name,v.email FROM tt_vendors v JOIN tt_maintenance_jobs j ON j.vendor_id=v.id WHERE v.id=? AND j.tenancy_id=? AND j.state IN ('approved','sent')",subjectId,t.id)
  if(kind==='responder')target=await one(c,"SELECT o.id,o.display_name AS name,o.email FROM oa_operators o JOIN tt_emergencies e ON e.primary_id=o.id OR e.backup_id=o.id WHERE o.id=? AND e.tenancy_id=? AND e.state='open' AND o.status='active'",subjectId,t.id)
  insist(target,'not_found','Recipient not found.',404)
  const phone=String(p.phone??'').trim();insist(!phone||/^\+[1-9]\d{7,14}$/.test(phone),'invalid_phone','Use an international phone number beginning with +.')
  const zone=anyZone(p.timeZone),reference=text(p.reference,'Explicit contact consent and identity source',1000),old=await one(c,'SELECT * FROM tt_message_contacts WHERE tenancy_id=? AND kind=? AND subject_id=?',t.id,kind,subjectId)
  if(old)revision(old,p)
  const sms=consent(p.smsConsent),voice=consent(p.voiceConsent),mail=consent(p.emailConsent)
  insist(!(sms||voice)||phone,'invalid_phone','A consented phone channel needs a phone number.')
  const fingerprint=await sha256(new TextEncoder().encode(phone)),stopped=phone?!!await one(c,'SELECT 1 FROM tt_message_suppressions WHERE phone_hash=?',fingerprint):false
  insist(!stopped||(!sms&&!voice),'opted_out','This number opted out. Phone consent cannot override STOP.',409)
  const r={kind,subject_id:subjectId,email:target.email};await liveRecipient(c,r,t)
  const key=old?.id??id(),version=(old?.version??0)+1
  c.source=reference
  await commit(c,[tenancyGuard(c,t),...(old?[guard(c,'EXISTS(SELECT 1 FROM tt_message_contacts WHERE id=? AND version=?)',key,old.version)]:[]),
   sql(c,'INSERT INTO tt_message_contacts(id,tenancy_id,kind,subject_id,name,email,phone,time_zone,email_consent,sms_consent,voice_consent,consent_reference,stopped,version,installation,recorded_by,recorded_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,email=excluded.email,phone=excluded.phone,time_zone=excluded.time_zone,email_consent=excluded.email_consent,sms_consent=excluded.sms_consent,voice_consent=excluded.voice_consent,consent_reference=excluded.consent_reference,stopped=excluded.stopped,version=excluded.version,installation=excluded.installation,recorded_by=excluded.recorded_by,recorded_at=excluded.recorded_at',key,t.id,kind,subjectId,target.name,email(target.email),phone,zone,mail,sms,voice,reference,stopped?1:0,version,await messageInstallation(c),c.actor.id,c.now),sql(c,'INSERT INTO tt_message_contact_versions(contact_id,version,evidence,recorded_by,recorded_at) VALUES(?,?,?,?,?)',key,version,JSON.stringify({name:target.name,email:target.email,phone,timeZone:zone,emailConsent:mail,smsConsent:sms,voiceConsent:voice,source:reference,stopped}),c.actor.id,c.now)],command,key)
  return{id:key,version,tenancyId:t.id,tab:'messages',notice:'Contact evidence recorded. No message sent.'}
 }
 if(command==='message.prepare'){
  const {r,t}=await contact(c,p.contactId),recipientFence=await liveRecipient(c,r,t)
  const channel=String(p.channel),purpose=String(p.purpose??'repair');insist(['email','sms','voice'].includes(channel)&&['repair','arrival','page'].includes(purpose),'invalid_input','Choose a channel and message purpose.')
  insist(r[`${channel}_consent`]===1&&r.installation===await messageInstallation(c)&&(channel==='email'||!r.stopped),'consent_required','Record current explicit consent before preparing this channel.',409)
  let body=text(p.body??'Arrival window','Message',1600),appointmentId:string|null=null,emergencyId:string|null=null,snapshot:Row={}
  if(purpose==='arrival'){
   insist(r.kind==='resident'&&channel==='sms','invalid_input','Arrival acknowledgements use the resident SMS contact.')
   const a=await one(c,'SELECT a.*,j.tenancy_id,j.version AS job_version FROM tt_appointments a JOIN tt_maintenance_jobs j ON j.id=a.job_id WHERE a.id=?',text(p.appointmentId,'Appointment',100));insist(a&&a.tenancy_id===t.id,'not_found','Appointment not found.',404)
   appointmentId=a.id;snapshot={approvalId:a.approval_id,jobVersion:a.job_version}
   const fmt=(at:string)=>new Intl.DateTimeFormat('en-US',{timeZone:a.time_zone,dateStyle:'medium',timeStyle:'short'}).format(new Date(at))
   body=`Terrace repair arrival: ${fmt(a.starts_at)} to ${fmt(a.ends_at)} (${a.time_zone}). Reply Y to confirm this window. If this thread contains an earlier arrival window, staff must review your reply. Access permission remains as separately recorded. Reply STOP to stop texts.`
  }
  if(purpose==='page'){
   insist(r.kind==='responder'&&['sms','voice'].includes(channel),'invalid_input','Pages use a named responder and a phone channel.')
   const e=await one(c,'SELECT * FROM tt_emergencies WHERE id=? AND tenancy_id=?',text(p.emergencyId,'Safety case',100),t.id);insist(e&&[e.primary_id,e.backup_id].includes(r.subject_id),'not_found','Safety case not found.',404)
   if(r.subject_id===e.backup_id)insist(await one(c,"SELECT id FROM tt_emergency_events WHERE emergency_id=? AND kind='escalated' AND recipient_id=?",e.id,r.subject_id),'escalation_required','Record the manual escalation and its reason on the safety case before paging the backup.',409)
   emergencyId=e.id;snapshot={recipientId:r.subject_id}
   body='Urgent: a Terrace safety case needs a person now. Sign in to Terrace and acknowledge the case. Provider acceptance does not confirm anyone was reached.'
  }
  if(channel==='voice')insist(purpose==='page','invalid_input','Voice is reserved for manually approved safety pages.')
  const key=id(),m={snapshot:JSON.stringify(snapshot),appointment_id:appointmentId,emergency_id:emergencyId}
  await commit(c,[tenancyGuard(c,t),recipientFence,await messageTerms(c,m),guard(c,'EXISTS(SELECT 1 FROM tt_message_contacts WHERE id=? AND version=?)',r.id,r.version),
   sql(c,'INSERT INTO tt_messages(id,tenancy_id,contact_id,contact_version,channel,purpose,body,snapshot,appointment_id,emergency_id,prepared_by,prepared_at,installation) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)',key,t.id,r.id,r.version,channel,purpose,body,m.snapshot,appointmentId,emergencyId,c.actor.id,c.now,await messageInstallation(c)),messageEvent(c,key,'prepared','Awaiting explicit human approval')],command,key)
  return{id:key,version:1,tenancyId:t.id,tab:'messages',notice:'Message prepared. Review its exact recipient and content before approval.'}
 }
 const {m,r,t}=await message(c,p.messageId);revision(m,p)
 insist(m.installation===await messageInstallation(c)&&r.installation===m.installation,'restored_authority','Restored evidence cannot authorize sends. Record consent and prepare a new message.',409)
 if(command==='message.approve'){
  insist(m.state==='prepared','message_state','Only a prepared message can be approved.',409)
  insist(p.consent==='APPROVE EXACT MESSAGE','confirmation','Confirm the exact message and recipient.')
  const recipientFence=await liveRecipient(c,r,t)
  insist(r.version===m.contact_version&&r[`${m.channel}_consent`]===1&&(m.channel==='email'||!r.stopped),'consent_required','Contact consent changed. Prepare a new message.',409)
  await commit(c,[tenancyGuard(c,t),recipientFence,await messageTerms(c,m),guard(c,'EXISTS(SELECT 1 FROM tt_message_contacts WHERE id=? AND version=?)',r.id,r.version),guard(c,"EXISTS(SELECT 1 FROM tt_messages WHERE id=? AND version=? AND state='prepared')",m.id,m.version),sql(c,"UPDATE tt_messages SET state='approved',approved_by=?,approved_at=?,version=version+1 WHERE id=?",c.actor.id,c.now,m.id),messageEvent(c,m.id,'approved','Exact content and recipient approved')],command,m.id)
  return{id:m.id,version:m.version+1,tenancyId:t.id,tab:'messages',notice:'Approved. Sending still requires an explicit action.'}
 }
 return{id:m.id,tenancyId:t.id,tab:'messages',messageSend:{id:m.id,version:m.version}}
}
