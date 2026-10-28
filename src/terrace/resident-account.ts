import {all,audit,guard,id,insist,one,recordRead,sql,tenancy,type Context,type Row} from './core'
import {statementRecipient} from './resident-recipient'
import {messageInstallation} from './message-context'
import type {Portal} from './portal-session'
import {residentMonthlyStatement,residentTransaction} from './resident-statements'

// Account settings change only the verified person's existing contact preference.
// They never change a destination, another member's consent or a bank method.
export async function residentPreference(c:Context,g:Row){
 const eligible=await statementRecipient(c,g.id)
 const t=await tenancy(c,g.tenancy_id),person=await one(c,'SELECT email FROM tt_portal_identities WHERE id=?',g.identity_id)
 if(person?.email===t.tenant_email){
  const r=await one(c,"SELECT id,version,email_consent FROM tt_message_contacts WHERE tenancy_id=? AND kind='resident' AND subject_id=?",t.id,t.id)
  return {email:person!.email,by:r?.email_consent===0?'none':'email',version:r?.version??0,primary:true,memberId:null}
 }
 const m=await one(c,"SELECT id,contact_by,version FROM tt_household_members WHERE tenancy_id=? AND email=? AND role IN ('co_tenant','guarantor','authorized_contact') AND joined<=? AND (left_on IS NULL OR left_on>=?) ORDER BY joined DESC LIMIT 1",t.id,person?.email,eligible.localDay,eligible.localDay)
 insist(m,'not_found','Contact preference not found.',404)
 return {email:person!.email,by:m.contact_by,version:m.version,primary:false,memberId:m.id}
}

export async function saveResidentPreference(c:Context,p:Portal,g:Row,input:Row){
 const current=await residentPreference(c,g),t=await tenancy(c,g.tenancy_id)
 insist(['email','none'].includes(input.contactBy),'contact_preference','Choose email or no optional contact.')
 insist(Number(input.version)===current.version,'conflict','Reload your current contact preference.',409)
 const live=guard(c,"EXISTS(SELECT 1 FROM tt_portal_sessions s JOIN tt_portal_identities i ON i.id=s.identity_id JOIN tt_portal_grants g ON g.identity_id=i.id JOIN tt_tenancies t ON t.id=g.tenancy_id WHERE s.hash=? AND s.revoked_at IS NULL AND s.expires_at>? AND i.status='active' AND g.id=? AND g.access='resident' AND g.revoked_at IS NULL AND t.id=? AND t.version=? AND t.erased_at IS NULL)",p.sessionHash,c.now,g.id,t.id,t.version)
 const writes=[live],source='Resident selected optional contact preference, declaration version 1',mail=input.contactBy==='email'?1:0
 if(current.primary){
  const old=await one(c,"SELECT * FROM tt_message_contacts WHERE tenancy_id=? AND kind='resident' AND subject_id=?",t.id,t.id),key=old?.id??id(),version=current.version+1
  writes.push(guard(c,"COALESCE((SELECT version FROM tt_message_contacts WHERE tenancy_id=? AND kind='resident' AND subject_id=?),0)=?",t.id,t.id,current.version))
  writes.push(sql(c,"INSERT INTO tt_message_contacts(id,tenancy_id,kind,subject_id,name,email,phone,time_zone,email_consent,sms_consent,voice_consent,consent_reference,stopped,version,installation,recorded_by,recorded_at) VALUES(?,?,'resident',?,?,?,'',?,?,0,0,?,0,?,?,?,?) ON CONFLICT(id) DO UPDATE SET email_consent=excluded.email_consent,consent_reference=excluded.consent_reference,version=excluded.version,recorded_by=excluded.recorded_by,recorded_at=excluded.recorded_at",key,t.id,t.id,t.tenant_name,current.email,t.time_zone,mail,source,version,await messageInstallation(c),c.actor.id,c.now))
  const evidence={name:t.tenant_name,email:current.email,phone:old?.phone??'',timeZone:old?.time_zone??t.time_zone,emailConsent:mail,smsConsent:old?.sms_consent??0,voiceConsent:old?.voice_consent??0,stopped:!!old?.stopped,source}
  writes.push(sql(c,'INSERT INTO tt_message_contact_versions(contact_id,version,evidence,recorded_by,recorded_at) VALUES(?,?,?,?,?)',key,version,JSON.stringify(evidence),c.actor.id,c.now))
 }else{
  writes.push(guard(c,'EXISTS(SELECT 1 FROM tt_household_members WHERE id=? AND tenancy_id=? AND email=? AND version=?)',current.memberId,t.id,current.email,current.version),sql(c,'UPDATE tt_household_members SET contact_by=?,version=version+1 WHERE id=?',input.contactBy,current.memberId))
 }
 c.tenancyId=t.id
 await c.db.batch([...writes,audit(c,'portal.contact',g.id)])
 return {contactBy:input.contactBy,version:current.version+1}
}

export async function residentDocuments(c:Context,g:Row):Promise<Row[]>{
 await statementRecipient(c,g.id)
 const docs=await all(c,"SELECT v.id,d.title,v.name,v.sha256 FROM tt_documents d JOIN tt_document_versions v ON v.document_id=d.id AND v.version=d.version WHERE d.tenancy_id=? AND d.kind='lease' AND COALESCE(d.restriction,'')='' AND EXISTS(SELECT 1 FROM tt_resident_document_shares x WHERE x.tenancy_id=d.tenancy_id AND x.source='document' AND x.version_id=v.id AND x.sha256=v.sha256) ORDER BY d.created_at,d.id",g.tenancy_id)
 const signed=await all(c,"SELECT v.id,s.name,s.sha256,v.effective FROM tt_lease_versions v JOIN tt_lease_sources s ON s.lease_version_id=v.id WHERE v.tenancy_id=? AND v.approved_at IS NOT NULL AND EXISTS(SELECT 1 FROM tt_resident_document_shares x WHERE x.tenancy_id=v.tenancy_id AND x.source='signed' AND x.version_id=v.id AND x.sha256=s.sha256) ORDER BY v.effective,v.id",g.tenancy_id)
 return [...docs.map((d):Row=>({...d,source:'document'})),...signed.map((d):Row=>({...d,title:'Signed lease effective '+d.effective,source:'signed'}))].map(d=>({...d,url:'/portal/lease-document?tenancyId='+encodeURIComponent(g.tenancy_id)+'&id='+encodeURIComponent(d.id)+'&source='+d.source}))
}

export async function residentOriginal(c:Context,g:Row,key:string,source:string){
 const docs=await residentDocuments(c,g),doc=docs.find(d=>d.id===key&&d.source===source)
 insist(doc,'not_found','Lease document not found.',404)
 const f=source==='signed'?await one(c,'SELECT bytes,name,media_type,sha256 FROM tt_lease_sources WHERE lease_version_id=?',key):await one(c,'SELECT bytes,name,media_type,sha256 FROM tt_document_versions WHERE id=?',key)
 insist(f,'not_found','Lease document not found.',404)
 await recordRead(c,'portal.read:lease-document',key)
 return new Response(new Uint8Array(f.bytes),{headers:{'content-type':f.media_type,'content-disposition':'attachment; filename="'+String(f.name).replace(/[^a-zA-Z0-9._-]/g,'_')+'"','x-document-sha256':f.sha256,'cache-control':'private, no-store','x-content-type-options':'nosniff','content-security-policy':"default-src 'none'; sandbox"}})
}

export async function residentReceipt(c:Context,g:Row,key:string){
 const tx=await residentTransaction(c,g,'receipt:'+key)
 insist(tx.transaction.amountCents>0,'not_found','Receipt not found.',404)
 const d=await residentMonthlyStatement(c,g,tx.transaction.date.slice(0,7))
 return {...d,receipt:{id:tx.transaction.id,date:tx.transaction.date,amountCents:tx.transaction.amountCents,description:tx.transaction.description}}
}
