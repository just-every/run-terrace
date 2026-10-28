import {all,allow,commit,date,guard,id,insist,one,reachesPortfolio,sql,tenancy,tenancyGuard,text,type Context,type Row} from './core'
import {noCredential} from './credentials'
import {stored} from './documents'
import {journalProperty} from './journal'
import {ruleSource} from './rule-sources'

export const REFERRAL_COMMANDS=['referral.create','referral.response','referral.review']
const NOTICE='Documentary evidence only. The source hold remains; no rule activated, action approved, message sent or money moved.'
async function source(c:Context,value:unknown){
 const decision=await one(c,'SELECT d.*,s.revision,s.snapshot FROM tt_rule_decisions d LEFT JOIN tt_rule_decision_sources s ON s.decision_id=d.id WHERE d.id=?',text(value,'Saved preview',100))
 insist(decision,'not_found','Saved preview not found.',404)
 await journalProperty(c,decision.property_id)
 return decision
}
async function referral(c:Context,value:unknown){
 const r=await one(c,'SELECT * FROM tt_professional_referrals WHERE id=?',text(value,'Referral',100))
 insist(r,'not_found','Referral not found.',404)
 const t=await tenancy(c,r.tenancy_id)
 insist(!t.custody_retired_at,'not_found','Referral not found.',404)
 return{r,t,d:await source(c,r.decision_id)}
}
async function applicable(c:Context,d:Row,revision:string){return !!d.revision&&d.revision===revision&&(await ruleSource(c,d.property_id,d.on_day)).revision===revision}
async function responsible(c:Context,value:unknown,portfolioId:string){
 const person=await one(c,"SELECT o.id,o.display_name FROM oa_operators o LEFT JOIN tt_staff_roles r ON r.operator_id=o.id WHERE o.id=? AND o.status='active' AND (o.role='owner' OR (r.role='portfolio_manager' AND (r.all_portfolios=1 OR EXISTS(SELECT 1 FROM tt_role_portfolios p WHERE p.operator_id=o.id AND p.portfolio_id=?))))",text(value,'Responsible person',100),portfolioId)
 insist(person,'responsible_scope','Choose a current owner or portfolio manager in this property.',403)
 return person
}
export async function referralData(c:Context,q:Row={}){
 allow(c,'referral.read');noCredential(c,'read professional referrals')
 if(q.propertyId)await journalProperty(c,q.propertyId)
 const properties=await all(c,'SELECT p.* FROM tt_properties p ORDER BY name'),cases:Row[]=[],exceptions:Row[]=[]
 // tenancy() applies the same scope and erasure rule to every case and original.
 const tenancies:Row[]=[]
 for(const t of await all(c,'SELECT t.id,t.address,u.property_id,p.portfolio_id FROM tt_tenancies t JOIN tt_units u ON u.id=t.unit_id JOIN tt_properties p ON p.id=u.property_id WHERE t.erased_at IS NULL AND t.custody_retired_at IS NULL ORDER BY t.address')){
  if(q.propertyId&&t.property_id!==q.propertyId)continue
  if(reachesPortfolio(c,t.portfolio_id))tenancies.push(t)
 }
 const visible=new Set(tenancies.map(t=>t.id)),propertyIds=new Set(tenancies.map(t=>t.property_id))
 for(const d of await all(c,'SELECT d.*,s.revision FROM tt_rule_decisions d JOIN tt_rule_decision_sources s ON s.decision_id=d.id ORDER BY d.recorded_at,d.id')){
  if(!propertyIds.has(d.property_id)||JSON.parse(d.result).state!=='held')continue
  exceptions.push({id:d.id,propertyId:d.property_id,property:properties.find(p=>p.id===d.property_id)?.name,action:d.action,on:d.on_day,gaps:JSON.parse(d.result).gaps,sourceRevision:d.revision,current:await applicable(c,d,d.revision)})
 }
 for(const r of await all(c,'SELECT * FROM tt_professional_referrals ORDER BY recorded_at,id')){
  if(!visible.has(r.tenancy_id))continue
  const d=await source(c,r.decision_id),current=await applicable(c,d,r.source_revision)
  const responses=await all(c,'SELECT r.*,v.sha256,v.name,v.media_type,v.size,w.next_action,w.reference AS review_reference,w.reviewed_by,w.reviewed_at FROM tt_professional_responses r JOIN tt_document_versions v ON v.id=r.version_id LEFT JOIN tt_professional_reviews w ON w.response_id=r.id WHERE r.referral_id=? ORDER BY r.sequence',r.id)
  const last=responses.at(-1)
  cases.push({...r,source:JSON.parse(d.snapshot),action:d.action,gaps:JSON.parse(d.result).gaps,sourceCurrent:current,open:true,status:!current?'source_changed':!last?'awaiting_response':last.outcome==='rejected'?'response_rejected':last.reviewed_at?'reviewed_record_only':'needs_review',responses:responses.map(x=>({...x,applicable:current,url:'/api/document?id='+x.version_id}))})
 }
 const people=await all(c,"SELECT id,display_name FROM oa_operators WHERE status='active' ORDER BY display_name"),assignees:Row[]=[]
 for(const person of people)for(const propertyId of propertyIds){
  const p=properties.find(p=>p.id===propertyId)!
  try{await responsible(c,person.id,p.portfolio_id);assignees.push({...person,propertyId})}catch{}
 }
 return{cases,exceptions,tenancies,assignees,notice:NOTICE}
}
export async function referralCommand(c:Context,command:string,p:Row):Promise<Row|undefined>{
 if(!REFERRAL_COMMANDS.includes(command))return
 allow(c,command);noCredential(c,'record professional referrals')
 if(command==='referral.create'){
  const d=await source(c,p.decisionId),t=await tenancy(c,p.tenancyId),unit=await one(c,'SELECT property_id FROM tt_units WHERE id=?',t.unit_id)
  insist(!t.custody_retired_at&&unit?.property_id===d.property_id,'not_found','Tenancy not found in this preview property.',404)
  insist(JSON.parse(d.result).state==='held','held_source_required','Choose a held rule preview.',409)
  insist(await applicable(c,d,String(p.sourceRevision)),'source_changed','The source changed or predates source tracking. Save a new held preview and refer that revision.',409)
  const property=await journalProperty(c,d.property_id),person=await responsible(c,p.responsibleId,property.portfolio_id),key=id()
  await commit(c,[tenancyGuard(c,t),sql(c,'INSERT INTO tt_professional_referrals(id,tenancy_id,decision_id,source_revision,professional,reference,responsible_id,responsible_name,due_on,recorded_by,recorded_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)',key,t.id,d.id,d.revision,text(p.professional,'Named professional',200),text(p.reference,'External referral reference',500),person.id,person.display_name,date(p.dueOn,'Follow-up due date'),c.actor.id,c.now)],command,key)
  return{id:key,tenancyId:t.id,tab:'rules',notice:NOTICE}
 }
 const {r,t,d}=await referral(c,p.referralId)
 if(command==='referral.response'){
  const count=(await one(c,'SELECT COUNT(*) AS n FROM tt_professional_responses WHERE referral_id=?',r.id))!.n
  insist(Number(p.version)===count,'conflict','A response was added. Reload before recording another original.',409)
  insist(p.sourceRevision===r.source_revision,'source_changed','The response must name the exact referred source revision.',409)
  insist(['received','rejected','needs_information'].includes(p.outcome),'response_outcome','Choose received, rejected or needs information.')
  const key=id(),documentId=id(),reference=text(p.reference,'Response source',500),s=await stored(c,{file:p.file,source:reference},t.id,documentId,1)
  await commit(c,[tenancyGuard(c,t),guard(c,'(SELECT COUNT(*) FROM tt_professional_responses WHERE referral_id=?)=?',r.id,count),
   sql(c,"INSERT INTO tt_documents(id,tenancy_id,kind,title,retention_class,restriction,version,created_by,created_at,referral_original) VALUES(?,?,'other',?,'lease','screening',1,?,?,1)",documentId,t.id,'Professional response: '+r.professional,c.actor.id,c.now),...s.statements,
   sql(c,'INSERT INTO tt_professional_responses(id,referral_id,sequence,outcome,version_id,reference,recorded_by,recorded_at) VALUES(?,?,?,?,?,?,?,?)',key,r.id,count+1,p.outcome,s.key,reference,c.actor.id,c.now)],command,r.id)
  return{id:key,versionId:s.key,sha256:s.digest,tenancyId:t.id,tab:'rules',notice:NOTICE}
 }
 insist(await applicable(c,d,r.source_revision),'source_changed','Source revisions changed. This response is historical evidence; refer a fresh held preview before reviewing a next action.',409)
 const response=await one(c,'SELECT * FROM tt_professional_responses WHERE id=? AND referral_id=?',text(p.responseId,'Response',100),r.id)
 insist(response,'not_found','Response not found.',404)
 insist(p.consent==='RECORD ONLY','record_only','Type RECORD ONLY to retain a documentary next action.')
 insist(!await one(c,'SELECT 1 FROM tt_professional_reviews WHERE response_id=?',response.id),'conflict','This response already has its retained review.',409)
 const key=id()
 await commit(c,[tenancyGuard(c,t),sql(c,'INSERT INTO tt_professional_reviews(id,response_id,next_action,reference,reviewed_by,reviewed_at) VALUES(?,?,?,?,?,?)',key,response.id,text(p.nextAction,'Reviewed next action',1000),text(p.reference,'Review source',500),c.actor.id,c.now)],command,r.id)
 return{id:key,tenancyId:t.id,tab:'rules',notice:NOTICE}
}
export function referralErasure(c:Context,tenancyId:string){return sql(c,'DELETE FROM tt_professional_referrals WHERE tenancy_id=?',tenancyId)}
