import {all,allow,audit,commit,date,guard,id,insist,one,reaches,sha256,sql,tenancy,tenancyGuard,text,type Context,type Row} from './core'
import {type Portal} from './portal-session'
import {localDate} from './zones'
import {LIMIT,scan} from './document-scan'
export const THREAD_COMMANDS=['thread.create','thread.reply','thread.assign','thread.approve','thread.service','thread.readmark']
export function threadAccess(c:Context){insist(!c.actor.credential,'forbidden','Native staff sign-in is required.',403);allow(c,'thread.read')}
const missing=(ok:unknown)=>insist(ok,'not_found','Conversation not found.',404)
export async function threadGrant(c:Context,grantId:string,t:Row){
 const g=await one(c,"SELECT g.*,i.kind,i.email,i.display_name FROM tt_portal_grants g JOIN tt_portal_identities i ON i.id=g.identity_id WHERE g.id=? AND g.revoked_at IS NULL AND i.status='active'",grantId)
 if(!g)return null
 const day=localDate(c.now,t.time_zone)
 if(day<t.start_date||day>(t.ended_on??t.end_date))return null
 if(g.access==='resident')return g.tenancy_id===t.id&&g.email===t.tenant_email?g:null
 if(g.access==='owner')return await one(c,`SELECT 1 FROM tt_units u JOIN tt_ownership_sets s ON s.property_id=u.property_id JOIN tt_ownership_shares h ON h.set_id=s.id WHERE u.id=? AND h.owner_id=? AND s.effective_from=(SELECT MAX(x.effective_from) FROM tt_ownership_sets x WHERE x.property_id=u.property_id AND x.effective_from<=?)`,t.unit_id,g.owner_id,day)?g:null
 if(g.access==='vendor')return await one(c,"SELECT 1 FROM tt_maintenance_jobs WHERE tenancy_id=? AND vendor_id=? AND state IN ('approved','sent')",t.id,g.vendor_id)?g:null
 return null
}
function recipientFence(c:Context,g:Row,t:Row){
 const base="EXISTS(SELECT 1 FROM tt_portal_grants g JOIN tt_portal_identities i ON i.id=g.identity_id WHERE g.id=? AND g.identity_id=? AND g.revoked_at IS NULL AND i.status='active')"
 const args=[g.id,g.identity_id]
 if(g.access==='vendor')return guard(c,base+" AND EXISTS(SELECT 1 FROM tt_maintenance_jobs WHERE tenancy_id=? AND vendor_id=? AND state IN ('approved','sent'))",...args,t.id,g.vendor_id)
 if(g.access==='owner')return guard(c,base+" AND EXISTS(SELECT 1 FROM tt_units u JOIN tt_ownership_sets s ON s.property_id=u.property_id JOIN tt_ownership_shares h ON h.set_id=s.id WHERE u.id=? AND h.owner_id=? AND s.effective_from=(SELECT MAX(x.effective_from) FROM tt_ownership_sets x WHERE x.property_id=u.property_id AND x.effective_from<=?))",...args,t.unit_id,g.owner_id,localDate(c.now,t.time_zone))
 return guard(c,base,...args)
}
async function staffThread(c:Context,value:unknown){threadAccess(c);const r=await one(c,'SELECT * FROM tt_threads WHERE id=?',text(value,'Conversation',100));missing(r);const t=await tenancy(c,r!.tenancy_id);return {r:r!,t}}
async function attachment(c:Context,p:Row){
 if(!(p.file instanceof File)||!p.file.size)return {values:[null,null,null,null]}
 const f=p.file;insist(f.size<=LIMIT,'file_limit','Attachments are limited to 5 MB.',413)
 const bytes=new Uint8Array(await f.arrayBuffer()),checked=await scan(bytes,f.type)
 insist(checked.ok,'file_refused',checked.ok?'':checked.reason,422)
 const hash=await sha256(bytes);insist(!await one(c,'SELECT 1 FROM tt_erased_document_files WHERE sha256=?',hash),'erased_artifact','This original was erased.',409)
 return {values:[text(f.name,'Filename',200),f.type,hash,bytes]}
}
const revision=(r:Row,p:Row)=>insist(Number(p.version)===r.version,'conflict','Reload this conversation before acting.',409)
const fence=(c:Context,r:Row)=>guard(c,'EXISTS(SELECT 1 FROM tt_threads WHERE id=? AND version=?)',r.id,r.version)
async function entry(c:Context,r:Row,p:Row,privateNote=false){const a=await attachment(c,p);return sql(c,'INSERT INTO tt_thread_entries(id,thread_id,sequence,private,body,actor,at,filename,media_type,sha256,bytes) VALUES(?,?,?,?,?,?,?,?,?,?,?)',id(),r.id,r.version+1,privateNote?1:0,text(p.body,'Message',5000),c.actor.id,c.now,...a.values)}
export async function threadData(c:Context,q:Row={}){
 threadAccess(c);if(q.tenancyId)await tenancy(c,q.tenancyId)
 if(q.id)await staffThread(c,q.id)
 const scoped=(await all(c,'SELECT r.*,t.unit_id FROM tt_threads r JOIN tt_tenancies t ON t.id=r.tenancy_id WHERE t.erased_at IS NULL ORDER BY r.created_at DESC,r.id')).filter(r=>reaches(c,r.unit_id))
 const rows=scoped.filter(r=>(!q.id||r.id===q.id)&&(!q.tenancyId||r.tenancy_id===q.tenancyId))
 const result:Row[]=[]
 for(const r of rows){const entries=await all(c,'SELECT id,sequence,private,body,actor,at,filename,media_type,sha256 FROM tt_thread_entries WHERE thread_id=? ORDER BY sequence',r.id);if(q.q&&![r.subject,...entries.map(e=>e.body)].join(' ').toLowerCase().includes(String(q.q).toLowerCase()))continue
 const read=await one(c,'SELECT sequence FROM tt_thread_reads WHERE thread_id=? AND actor=?',r.id,c.actor.id)
 result.push({...r,entries,unread:entries.some(e=>e.actor!==c.actor.id&&e.sequence>(read?.sequence??0)),service:await one(c,'SELECT * FROM tt_thread_service WHERE thread_id=?',r.id)})}
 const batches=new Set(result.filter(r=>r.kind==='broadcast').map(r=>r.batch_id))
 const announcements=[]
 for(const r of scoped.filter(r=>batches.has(r.batch_id)))announcements.push({id:r.id,tenancyId:r.tenancy_id,batchId:r.batch_id,subject:r.subject,recipient:r.recipient_name,approved:!!r.approved_at,service:await one(c,'SELECT outcome FROM tt_thread_service WHERE thread_id=?',r.id)})
 return {threads:result,announcements}
}
export async function threadChoices(c:Context,tenancyId:string){
 threadAccess(c);const t=await tenancy(c,tenancyId),grants=[]
 for(const g of await all(c,'SELECT id FROM tt_portal_grants WHERE revoked_at IS NULL')){const live=await threadGrant(c,g.id,t);if(live)grants.push(live)}
 const staff=await all(c,"SELECT o.id,o.display_name FROM oa_operators o WHERE o.status='active' AND (o.role='owner' OR EXISTS(SELECT 1 FROM tt_staff_roles s WHERE s.operator_id=o.id AND s.role='portfolio_manager' AND (s.all_portfolios=1 OR EXISTS(SELECT 1 FROM tt_role_portfolios a JOIN tt_properties p ON p.portfolio_id=a.portfolio_id JOIN tt_units u ON u.property_id=p.id WHERE a.operator_id=o.id AND u.id=?))))",t.unit_id)
 return {grants,staff}
}
export async function threadCommand(c:Context,command:string,p:Row):Promise<Row|undefined>{
 if(!THREAD_COMMANDS.includes(command))return
 threadAccess(c)
 if(command==='thread.create'){
  const t=await tenancy(c,p.tenancyId),kind=String(p.kind??'conversation');insist(['conversation','broadcast','legal'].includes(kind),'kind','Choose conversation, broadcast or legal notice.')
  const consentReference=text(p.consentReference,'Explicit recipient consent evidence',1000)
  const subject=text(p.subject,'Subject',200),body=text(p.body,'Message',5000),deadline=p.deadline?date(p.deadline,'Service deadline'):null
  let recipients=[{t,grantId:text(p.grantId??'all','Recipient',100)}]
  if(kind==='broadcast'){
   const property=await one(c,'SELECT p.id FROM tt_properties p JOIN tt_units u ON u.property_id=p.id WHERE u.id=?',t.unit_id);missing(property)
   recipients=[]
   for(const row of await all(c,'SELECT t.* FROM tt_tenancies t JOIN tt_units u ON u.id=t.unit_id WHERE u.property_id=? AND t.erased_at IS NULL',property!.id)){
    await tenancy(c,row.id)
    for(const g of await all(c,"SELECT id FROM tt_portal_grants WHERE tenancy_id=? AND access='resident' AND revoked_at IS NULL",row.id))if(await threadGrant(c,g.id,row))recipients.push({t:row,grantId:g.id})
   }
   insist(recipients.length,'no_recipients','No active resident recipients in this property.',409)
  }
  const original=await attachment(c,p)
  const batch=id(),statements=[],ids=[]
  const seen=new Set<string>()
  for(const target of recipients){const g=await threadGrant(c,target.grantId,target.t);missing(g);if(seen.has(g!.identity_id+':'+target.t.id))continue;seen.add(g!.identity_id+':'+target.t.id)
   const key=id(),fingerprint=await sha256(new TextEncoder().encode(JSON.stringify({tenancy:target.t.id,grant:target.grantId,subject,body,kind,deadline,consentReference,attachmentSha256:original.values[2]})))
   statements.push(tenancyGuard(c,target.t),recipientFence(c,g!,target.t),sql(c,'INSERT INTO tt_threads(id,tenancy_id,grant_id,identity_id,recipient_name,recipient_kind,recipient_key,consent_reference,subject,kind,batch_id,deadline,fingerprint,created_by,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',key,target.t.id,g!.id,g!.identity_id,g!.display_name,g!.access,await sha256(new TextEncoder().encode(g!.email)),consentReference,subject,kind,batch,deadline,fingerprint,c.actor.id,c.now),sql(c,'INSERT INTO tt_thread_entries(id,thread_id,sequence,private,body,actor,at,filename,media_type,sha256,bytes) VALUES(?,?,1,0,?,?,?,?,?,?,?)',id(),key,body,c.actor.id,c.now,...original.values));ids.push(key)
  }
  await commit(c,statements,command,batch);return {id:ids[0],ids,tenancyId:t.id,tab:'messages',notice:'Prepared for exact review. Nothing sent; recipients see it only after approval.'}
 }
 const {r,t}=await staffThread(c,p.threadId);revision(r,p)
 if(command==='thread.readmark'){await commit(c,[fence(c,r),sql(c,'INSERT INTO tt_thread_reads(thread_id,actor,sequence) VALUES(?,?,?) ON CONFLICT(thread_id,actor) DO UPDATE SET sequence=MAX(sequence,excluded.sequence)',r.id,c.actor.id,r.version)],command,r.id);return {id:r.id,tenancyId:t.id,tab:'messages',notice:'Marked read.'}}
 let statements:D1PreparedStatement[]=[]
 if(command==='thread.assign'){
  if(r.kind!=='conversation')insist((p.deadline||null)===r.deadline,'immutable_notice','Notice deadlines are part of the approved content. Prepare a new notice to change them.',409)
  const choices=await threadChoices(c,t.id);insist(choices.staff.some(s=>s.id===p.assignedTo),'assignee','Choose an active owner or manager in this portfolio.')
  statements=[sql(c,'UPDATE tt_threads SET assigned_to=?,deadline=?,version=version+1 WHERE id=?',p.assignedTo,p.deadline?date(p.deadline,'Service deadline'):null,r.id)]
 }else if(command==='thread.reply'){
  insist(r.kind==='conversation','immutable_notice','Announcements and legal notices keep their exact content. Prepare a new notice for changed terms.',409)
  if(p.private!=='1'){missing(await threadGrant(c,r.grant_id,t));insist(p.consent==='SHARE EXACT MESSAGE','consent','Confirm sharing this exact reply with the named recipient.')}
  const g=p.private==='1'?null:await threadGrant(c,r.grant_id,t)
  statements=[...(g?[recipientFence(c,g,t)]:[]),await entry(c,r,p,p.private==='1'),sql(c,'UPDATE tt_threads SET version=version+1 WHERE id=?',r.id)]
 }else if(command==='thread.approve'){
  insist(!r.approved_at,'approved','This exact notice is already approved.',409);missing(await threadGrant(c,r.grant_id,t))
  insist(p.fingerprint===r.fingerprint&&p.consent==='APPROVE EXACT MESSAGE','approval','Confirm the exact recipient, content and fingerprint.',409)
  c.source=text(p.reference,'Permission and approval reference',500)
  const g=await threadGrant(c,r.grant_id,t)
  statements=[recipientFence(c,g!,t),sql(c,'UPDATE tt_threads SET approved_by=?,approved_at=?,version=version+1 WHERE id=?',c.actor.id,c.now,r.id)]
 }else{
  insist(r.approved_at&&p.fingerprint===r.fingerprint,'approval','Exact human approval is required before recording service.',409)
  insist(['delivered','failed','uncertain'].includes(p.outcome),'outcome','Choose delivered, failed or uncertain.')
  insist(!await one(c,'SELECT 1 FROM tt_thread_service WHERE thread_id=?',r.id),'recorded','Service evidence is already recorded. Reconcile it in History; never silently retry.',409)
  const served=date(p.servedAt,'Service date');insist(served<=localDate(c.now,t.time_zone),'future_service','Future service cannot be recorded.')
  const method=text(p.method,'Staff-recorded service method',200),reference=text(p.reference,'Named service evidence',1000)
  insist(p.consent==='RECORD EVIDENCE','consent','Confirm this is staff-recorded evidence, not legal validation.')
  statements=[sql(c,'INSERT INTO tt_thread_service(thread_id,outcome,method,reference,served_at,actor,recorded_at,fingerprint) VALUES(?,?,?,?,?,?,?,?)',r.id,p.outcome,method,reference,served,c.actor.id,c.now,r.fingerprint),sql(c,'UPDATE tt_threads SET version=version+1 WHERE id=?',r.id)]
 }
 await commit(c,[tenancyGuard(c,t),fence(c,r),...statements],command,r.id)
 return {id:r.id,tenancyId:t.id,tab:'messages',notice:'Recorded. No outbound action performed.'}
}
export async function externalThreads(c:Context,portal:Portal,q:Row={}){
 missing(portal.grants.some(g=>['resident','owner','vendor'].includes(g.access)))
 const rows=await all(c,'SELECT r.* FROM tt_threads r JOIN tt_tenancies t ON t.id=r.tenancy_id WHERE r.identity_id=? AND r.approved_at IS NOT NULL AND t.erased_at IS NULL ORDER BY r.created_at DESC,r.id',portal.identity.id),result=[]
 for(const r of rows){const t=await one(c,'SELECT * FROM tt_tenancies WHERE id=? AND erased_at IS NULL',r.tenancy_id);if(!t||!portal.grants.some(g=>g.id===r.grant_id)||!await threadGrant(c,r.grant_id,t))continue
  if(q.id&&r.id!==q.id)continue
  const entries=await all(c,'SELECT id,sequence,body,at,filename,media_type,sha256 FROM tt_thread_entries WHERE thread_id=? AND private=0 ORDER BY sequence',r.id)
  if(q.q&&![r.subject,...entries.map(e=>e.body)].join(' ').toLowerCase().includes(String(q.q).toLowerCase()))continue
  const read=await one(c,'SELECT sequence FROM tt_thread_reads WHERE thread_id=? AND actor=?',r.id,c.actor.id)
  result.push({id:r.id,subject:r.subject,kind:r.kind,version:r.version,deadline:r.deadline,entries,unread:entries.some(e=>e.sequence>(read?.sequence??0)),grantId:r.grant_id})
 }
 if(q.id)missing(result.length)
 return {threads:result}
}
export async function externalThreadPost(c:Context,portal:Portal,p:Row){
 const r=(await externalThreads(c,portal,{id:p.threadId})).threads[0];revision(r,p)
 const t=await one(c,'SELECT * FROM tt_tenancies WHERE id=?',(await one(c,'SELECT tenancy_id FROM tt_threads WHERE id=?',r.id))!.tenancy_id)
 const g=await threadGrant(c,r.grantId,t!);missing(g)
 const statements=[tenancyGuard(c,t!),recipientFence(c,g!,t!),fence(c,r)]
 if(p.action==='read')statements.push(sql(c,'INSERT INTO tt_thread_reads(thread_id,actor,sequence) VALUES(?,?,?) ON CONFLICT(thread_id,actor) DO UPDATE SET sequence=MAX(sequence,excluded.sequence)',r.id,c.actor.id,r.version))
 else{insist(r.kind==='conversation','read_only','This notice accepts no replies.',409);insist(p.consent==='SHARE EXACT MESSAGE','consent','Confirm sharing this exact reply.')
 statements.push(await entry(c,r,p),sql(c,'UPDATE tt_threads SET version=version+1 WHERE id=?',r.id))}
 await c.db.batch([...statements,audit(c,'portal.thread.'+(p.action==='read'?'read':'reply'),r.id)]);return {id:r.id}
}
export async function threadFile(c:Context,entryId:string,portal?:Portal){
 const f=await one(c,'SELECT e.*,r.tenancy_id FROM tt_thread_entries e JOIN tt_threads r ON r.id=e.thread_id WHERE e.id=? AND e.bytes IS NOT NULL',entryId);missing(f)
 if(portal){missing(!f!.private);await externalThreads(c,portal,{id:f!.thread_id})}else await staffThread(c,f!.thread_id)
 await audit(c,'read:thread-attachment',f!.id).run()
 return new Response(new Uint8Array(f!.bytes),{headers:{'content-type':f!.media_type,'content-disposition':'attachment; filename="'+String(f!.filename).replace(/[^a-zA-Z0-9._-]/g,'_')+'"','cache-control':'private, no-store','x-content-type-options':'nosniff','content-security-policy':"default-src 'none'; sandbox"}})
}
