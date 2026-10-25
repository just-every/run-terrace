import type { Bindings } from '../auth.server'
import { operatorMail } from '../mail.server.mjs'
import { all, allow, audit, commit, date, guard, id, insist, one, reaches, sql, tenancy, text, type Context, type Row } from './core'
import { hash, linkExpiry, secret, type Portal } from './portal-session'
import { digest } from './quotes'
import { stored } from './documents'

export const REQUEST_COMMANDS = ['request.create','request.replace','request.expire','request.remind','request.validate']
export const event = (c: Context, requestId: string, kind: string, detail: string) => sql(c,'INSERT INTO tt_action_events(id,request_id,kind,actor,at,detail) VALUES(?,?,?,?,?,?)',id(),requestId,kind,c.actor.id,c.now,detail)
const missing = (ok: unknown) => insist(ok,'not_found','Request not found.',404)
export async function liveGrant(c: Context, grantId: string, tenancyId: string) {
 const g = await one(c, "SELECT g.*,i.kind,i.display_name,i.email FROM tt_portal_grants g JOIN tt_portal_identities i ON i.id=g.identity_id WHERE g.id=? AND g.revoked_at IS NULL AND i.status IN ('invited','active')",grantId)
 if (!g) return null
 if (g.access === 'resident' && g.tenancy_id === tenancyId) return g
 if (g.access !== 'owner') return null
 const owner = await one(c, `SELECT 1 FROM tt_tenancies t JOIN tt_units u ON u.id=t.unit_id JOIN tt_ownership_sets s ON s.property_id=u.property_id JOIN tt_ownership_shares h ON h.set_id=s.id
 WHERE t.id=? AND h.owner_id=? AND s.effective_from<=? AND s.effective_from=(SELECT MAX(x.effective_from) FROM tt_ownership_sets x WHERE x.property_id=u.property_id AND x.effective_from<=?)`,tenancyId,g.owner_id,c.now.slice(0,10),c.now.slice(0,10))
 return owner ? g : null
}
async function staffRequest(c: Context, value: unknown) {
 const r = await one(c,'SELECT * FROM tt_action_requests WHERE id=?',text(value,'Request',100));missing(r)
 await tenancy(c,r!.tenancy_id);return r!
}
export async function requestData(c: Context, q: Row) {
 allow(c,'request.read');insist(!c.actor.credential,'forbidden','Staff sign-in is required.',403)
 if (q.tenancyId) await tenancy(c,q.tenancyId)
 if (q.id) { const r=await staffRequest(c,q.id);return {requests:[await detail(c,r)]} }
 const rows=await all(c,'SELECT r.*,t.unit_id FROM tt_action_requests r JOIN tt_tenancies t ON t.id=r.tenancy_id WHERE t.erased_at IS NULL ORDER BY r.created_at DESC,r.id')
 return {requests:await Promise.all(rows.filter(r=>reaches(c,r.unit_id)&&(!q.tenancyId||r.tenancy_id===q.tenancyId)).map(r=>detail(c,r)))}
}
async function detail(c: Context,r: Row) {
 const {unit_id,...fields}=r
 const links=await all(c,'SELECT created_at,expires_at,revoked_at FROM tt_action_links WHERE request_id=? ORDER BY created_at',r.id)
 return {...fields,missing:r.state!=='completed',links,events:await all(c,'SELECT kind,actor,at,detail FROM tt_action_events WHERE request_id=? ORDER BY at,id',r.id)}
}
export async function requestCommand(c: Context,command: string,p: Row): Promise<Row|undefined> {
 if (!REQUEST_COMMANDS.includes(command)) return
 insist(!c.actor.credential,'forbidden','Staff sign-in is required.',403)
 if (command==='request.create') {
  const t=await tenancy(c,p.tenancyId),g=await liveGrant(c,text(p.grantId,'Recipient grant',100),t.id);missing(g)
  const action=String(p.action);insist(['upload','sign','acknowledge','quote'].includes(action),'request_action','Choose upload, sign, acknowledge or quote.')
  const key=id(),title=text(p.title,'Title',200),instructions=text(p.instructions,'Instructions',2000)
  let document:Row|null=null,j:Row|null=null,sha:string|null=null
  if (['sign','acknowledge'].includes(action)) {
   document=await one(c,"SELECT v.id,v.sha256 FROM tt_document_versions v JOIN tt_documents d ON d.id=v.document_id WHERE v.id=? AND d.tenancy_id=? AND d.kind=?",text(p.documentVersionId,'Document version',100),t.id,action==='sign'?'lease':'notice');missing(document)
   if(action==='acknowledge') insist(p.permitted==='PERMITTED','notice_permission','Explicitly confirm that this notice permits acknowledgement; this is not proof of legal service.')
  }
  if(action==='quote') {
   insist(g!.access==='owner','owner_required','A quote decision needs the named property owner.')
   j=await one(c,"SELECT * FROM tt_maintenance_jobs WHERE id=? AND tenancy_id=? AND state='pending' AND quote_id IS NOT NULL",text(p.jobId,'Selected quoted job',100),t.id);missing(j);sha=await digest(j!)
  }
  await commit(c,[sql(c,'INSERT INTO tt_action_requests(id,tenancy_id,grant_id,identity_id,recipient_name,recipient_email,action,title,instructions,document_version_id,document_sha256,job_id,job_version,terms_sha256,snapshot,created_by,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',key,t.id,g!.id,g!.identity_id,g!.display_name,g!.email,action,title,instructions,document?.id??null,document?.sha256??null,j?.id??null,j?.version??null,sha,j?JSON.stringify({title:j.title,scope:j.scope,vendor:j.trade_name,dueDate:j.due_date,tasks:JSON.parse(j.checklist),estimateCents:j.estimate_cents,currency:j.currency,quoteId:j.quote_id}):null,c.actor.id,c.now),event(c,key,'created',instructions)],command,key)
  return {id:key,tenancyId:t.id,notice:'Request prepared. Review it and explicitly send its scoped link.'}
 }
 const r=await staffRequest(c,p.requestId);insist(Number(p.version)===r.version,'conflict','This request changed. Reload before acting.',409)
 insist(r.state!=='completed','completed','This request is already validated; reminders and replacements have stopped.',409)
 const fence=guard(c,"EXISTS(SELECT 1 FROM tt_action_requests WHERE id=? AND version=? AND state<>'completed')",r.id,r.version)
 if(command==='request.validate') {
  insist(r.action==='upload'&&r.state==='submitted','not_submitted','Review a submitted original before validating.',409)
  const result=JSON.parse(r.result),original=await one(c,'SELECT sha256 FROM tt_document_versions WHERE id=?',result.versionId)
  insist(original?.sha256===result.sha256&&p.sha256===result.sha256,'original_changed','Review the exact original fingerprint before validating.',409)
  await commit(c,[fence,sql(c,"UPDATE tt_action_requests SET state='completed',completed_by=?,completed_at=?,version=version+1 WHERE id=?",c.actor.id,c.now,r.id),sql(c,'UPDATE tt_action_links SET revoked_at=COALESCE(revoked_at,?) WHERE request_id=?',c.now,r.id),event(c,r.id,'validated',text(p.reference,'Review reference',500))],command,r.id)
  return {id:r.id,tenancyId:r.tenancy_id,notice:'Original validated. Reminders have stopped.'}
 }
 const reason=text(p.reference,'Reference',500)
 if(command==='request.expire') {
  await commit(c,[fence,sql(c,'UPDATE tt_action_links SET expires_at=MIN(expires_at,?) WHERE request_id=?',c.now,r.id),sql(c,'UPDATE tt_action_requests SET version=version+1 WHERE id=?',r.id),event(c,r.id,'expired',reason)],command,r.id)
  return {id:r.id,tenancyId:r.tenancy_id,notice:'Links expired; the missing item and its history remain.'}
 }
 insist(p.consent==='SEND LINK','consent','Explicitly confirm SEND LINK for this message.')
 const g=await liveGrant(c,r.grant_id,r.tenancy_id);missing(g)
 const pending=await one(c,"SELECT kind FROM tt_action_events WHERE request_id=? AND kind LIKE 'mail.%' ORDER BY rowid DESC LIMIT 1",r.id)
 insist(!pending||!['mail.claimed','mail.uncertain'].includes(pending.kind),'uncertain_mail','The previous send has an uncertain outcome. Review it before any further send.',409)
 const token=secret(),tokenHash=await hash(token),expires=linkExpiry(c.now),attempt=id()
 await commit(c,[fence,sql(c,'UPDATE tt_action_links SET revoked_at=COALESCE(revoked_at,?) WHERE request_id=?',c.now,r.id),sql(c,'INSERT INTO tt_action_links(token_hash,request_id,created_at,expires_at) VALUES(?,?,?,?)',tokenHash,r.id,c.now,expires),sql(c,'UPDATE tt_action_requests SET version=version+1 WHERE id=?',r.id),event(c,r.id,command==='request.remind'?'reminder':'replacement',reason),event(c,r.id,'mail.claimed',attempt)],command,r.id)
 return {id:r.id,tenancyId:r.tenancy_id,requestEmail:{requestId:r.id,attempt,to:g!.email,token,title:r.title,expires},notice:'Scoped link prepared.'}
}
export async function sendRequestEmail(c: Context,env: Bindings,m: Row) {
 const mail=operatorMail(env),link=`${env.AUTH_ORIGIN}/portal/request?token=${m.token}`;let outcome='unconfigured'
 if(mail) { outcome='uncertain';try {outcome=(await mail.send({deliveryId:m.attempt,from:env.MAIL_FROM!,to:[m.to],subject:'Terrace request: '+m.title,text:`${m.title}\nSign in to your existing Terrace portal, then open this action link: ${link}\nExpires ${m.expires}. Opening does not complete the action.`,html:'',headers:{}} as Parameters<NonNullable<typeof mail>['send']>[0])).status} catch {outcome='uncertain'} }
 await event(c,m.requestId,'mail.'+outcome,m.attempt).run()
 return {outcome,notice:outcome==='accepted'?'Mail provider accepted the request; delivery and completion are not confirmed.':'Request mail outcome: '+outcome+'. Review before any further send.'}
}
export async function externalRequest(c: Context,portal: Portal,token: string) {
 const r=await one(c,'SELECT r.*,l.token_hash,l.expires_at FROM tt_action_links l JOIN tt_action_requests r ON r.id=l.request_id WHERE l.token_hash=? AND l.revoked_at IS NULL AND l.expires_at>?',await hash(token),c.now)
 missing(r&&r.identity_id===portal.identity.id&&portal.grants.some(g=>g.id===r.grant_id))
 missing(await liveGrant(c,r!.grant_id,r!.tenancy_id))
 const t=await one(c,'SELECT 1 FROM tt_tenancies WHERE id=? AND erased_at IS NULL',r!.tenancy_id);missing(t)
 c.tenancyId=r!.tenancy_id
 return r!
}
export async function completeRequest(c: Context,portal: Portal,r: Row,p: Row) {
 insist(r.state==='open','request_state','This action was already submitted or completed.',409)
 insist(p.consent==='I AGREE','consent','Explicit consent is required.')
 insist(text(p.name,'Your full name',200)===portal.identity.display_name,'signer','Use the exact name on your portal identity.')
 const grant=await liveGrant(c,r.grant_id,r.tenancy_id);missing(grant)
 const statements=[guard(c,"EXISTS(SELECT 1 FROM tt_action_requests WHERE id=? AND state='open' AND version=?) AND EXISTS(SELECT 1 FROM tt_action_links WHERE token_hash=? AND revoked_at IS NULL AND expires_at>?) AND EXISTS(SELECT 1 FROM tt_portal_grants WHERE id=? AND revoked_at IS NULL) AND EXISTS(SELECT 1 FROM tt_portal_sessions WHERE hash=? AND revoked_at IS NULL AND expires_at>?)",r.id,r.version,r.token_hash,c.now,r.grant_id,portal.sessionHash,c.now)]
 statements.push(guard(c,"EXISTS(SELECT 1 FROM tt_portal_identities WHERE id=? AND status='active') AND EXISTS(SELECT 1 FROM tt_tenancies WHERE id=? AND erased_at IS NULL)",portal.identity.id,r.tenancy_id))
 if(grant!.access==='owner') statements.push(guard(c,`EXISTS(SELECT 1 FROM tt_tenancies t JOIN tt_units u ON u.id=t.unit_id JOIN tt_ownership_sets s ON s.property_id=u.property_id JOIN tt_ownership_shares h ON h.set_id=s.id WHERE t.id=? AND h.owner_id=? AND s.effective_from=(SELECT MAX(x.effective_from) FROM tt_ownership_sets x WHERE x.property_id=u.property_id AND x.effective_from<=?))`,r.tenancy_id,grant!.owner_id,c.now.slice(0,10)))
 if(r.document_version_id) statements.push(guard(c,'EXISTS(SELECT 1 FROM tt_document_versions WHERE id=? AND sha256=?)',r.document_version_id,r.document_sha256))
 let result:Row={name:portal.identity.display_name,identityId:portal.identity.id,documentSha256:r.document_sha256},submitted=false
 if(r.action==='upload') {
  const documentId=id(),original=await stored(c,{file:p.file,source:'Requested original from portal identity '+portal.identity.id},r.tenancy_id,documentId,1)
  statements.push(sql(c,"INSERT INTO tt_documents(id,tenancy_id,kind,title,retention_class,version,created_by,created_at) VALUES(?,?,'other',?,'lease',1,?,?)",documentId,r.tenancy_id,r.title,c.actor.id,c.now),...original.statements)
  result={...result,documentId,versionId:original.key,sha256:original.digest};submitted=true
 }
 if(r.action==='quote') {
  const j=await one(c,"SELECT * FROM tt_maintenance_jobs WHERE id=? AND version=? AND state='pending'",r.job_id,r.job_version)
  insist(j&&await digest(j)===r.terms_sha256,'stale_quote','The quoted terms changed. Ask staff for a new request.',409)
  insist(['approved','declined'].includes(p.decision),'decision','Choose approved or declined.')
  statements.push(guard(c,"EXISTS(SELECT 1 FROM tt_maintenance_jobs WHERE id=? AND version=? AND state='pending')",r.job_id,r.job_version),sql(c,"INSERT INTO tt_owner_decisions(id,job_id,job_version,terms_sha256,decision,source,reference,recorded_by,recorded_role,recorded_at) VALUES(?,?,?,?,?,'document',?,?,'owner',?)",id(),r.job_id,r.job_version,r.terms_sha256,p.decision,'Portal request '+r.id,c.actor.id,c.now))
  result.decision=p.decision
 }
 statements.push(sql(c,'UPDATE tt_action_requests SET state=?,submitted_by=?,submitted_at=?,result=?,completed_by=?,completed_at=?,version=version+1 WHERE id=?',submitted?'submitted':'completed',c.actor.id,c.now,JSON.stringify(result),submitted?null:c.actor.id,submitted?null:c.now,r.id),event(c,r.id,submitted?'submitted':'completed',JSON.stringify(result)),audit(c,'portal.request.'+r.action,r.id))
 try {await c.db.batch(statements)}catch(error) {if(/CHECK constraint|UNIQUE constraint/.test(String(error))) insist(false,'conflict','The request or your access changed. Reload and review before trying again.',409);throw error}
 return {...r,state:submitted?'submitted':'completed',result:JSON.stringify(result)}
}

export async function requestChoices(c: Context,t:Row|undefined) {
 if(!t)return {grants:[],documents:[],jobs:[]}
 const grants=[]
 for(const g of await all(c,'SELECT g.id FROM tt_portal_grants g WHERE revoked_at IS NULL')) {const live=await liveGrant(c,g.id,t.id);if(live)grants.push(live)}
 return {grants,documents:await all(c,"SELECT v.id,d.title,v.version FROM tt_documents d JOIN tt_document_versions v ON v.document_id=d.id AND v.version=d.version WHERE d.tenancy_id=? AND d.kind IN ('lease','notice')",t.id),jobs:await all(c,"SELECT id,title,estimate_cents,currency FROM tt_maintenance_jobs WHERE tenancy_id=? AND state='pending' AND quote_id IS NOT NULL",t.id)}
}
