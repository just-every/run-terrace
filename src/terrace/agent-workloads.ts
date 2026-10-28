// AGENT-008: owner-controlled structured workloads. Document text is fingerprinted and discarded, never interpreted.
import {all,allow,commit,date,guard,id,insist,one,policy,reaches,sha256,sql,tenancy,text,type Context,type Row} from './core'
import {workCommand} from './work'
import {tenancyCommand} from './tenancies'
import {appointmentCommand} from './appointments'
import {renewalItem,renewalRoster} from './renewals'
import {renewalStewardship} from './renewal-stewardship'
import {pinRenewalSources,renewalSourceGuards,renewalSourceState,sourceInstallation,sourceReader,SOURCE_REVIEW} from './renewal-sources'
export const AGENT_COMMANDS=['agent.enqueue','agent.pause','agent.cancel','agent.resume','agent.reassign','agent.reply','agent.execute']
const fields:Record<string,string[]>={
 'maintenance.prepare':['tenancyId','title','vendorId','trade','tradeName','tradeEmail','dueDate','estimate','checklist','scope','assetId'],
 'arrears.prepare':['tenancyId','message','followUpDate'],
 'renewal.prepare':['tenancyId','renewalId','endDate','rent','deadline','marketRent','marketRentDate','marketRentSource','vacantDays','makeReadyCost','makeReadySource','leasingCost','leasingSource','source','alternatives','conditionSource','communicationSource','cashSource','requiredSigners','documentSources'],
 'appointment.book':['tenancyId','jobId','startsAt','endsAt','accessStartsAt','accessEndsAt','permission','permissionReference','noticeReference','noticeAt','keysAccess','availabilityReference','staffId','previousId','reason'],
}
const event=(c:Context,key:string,kind:string,detail:string)=>sql(c,'INSERT INTO tt_agent_workload_events(workload_id,kind,actor,at,detail) VALUES(?,?,?,?,?)',key,kind,c.actor.id,c.now,detail)
function owner(c:Context){insist(c.actor.role==='owner'&&!c.actor.credential,'forbidden','Only the owner manages agent workloads.',403)}
async function assigned(c:Context,credentialId:unknown,command:string,unitId:string){
 const k=await one(c,"SELECT * FROM tt_api_credentials WHERE id=? AND revoked_at IS NULL AND scope='prepare'",text(credentialId,'Credential',100))
 insist(k,'agent_credential','Choose a current prepare-only credential.',409)
 insist(await one(c,'SELECT 1 FROM tt_role_actions WHERE role=? AND action=?',k.role,command),'forbidden','The credential role cannot prepare this action.',403)
 insist(k.all_portfolios||await one(c,'SELECT 1 FROM tt_api_credential_portfolios a JOIN tt_properties p ON p.portfolio_id=a.portfolio_id JOIN tt_units u ON u.property_id=p.id WHERE a.credential_id=? AND u.id=?',k.id,unitId),'not_found','Tenancy not found in the credential portfolios.',404)
 return k
}
const current=(c:Context,r:Row)=>guard(c,'EXISTS(SELECT 1 FROM tt_agent_workloads WHERE id=? AND version=? AND state=?)',r.id,r.version,r.state)
const live=(c:Context,k:Row,command:string)=>guard(c,"EXISTS(SELECT 1 FROM tt_api_credentials k JOIN tt_role_actions a ON a.role=k.role WHERE k.id=? AND k.version=? AND k.revoked_at IS NULL AND k.scope='prepare' AND a.action=?)",k.id,k.version,command)
export async function agentCommand(c:Context,name:string,p:Row):Promise<Row|undefined>{
 if(!AGENT_COMMANDS.includes(name))return
 if(name!=='agent.execute')owner(c)
 if(name==='agent.enqueue'){
  const command=text(p.action,'Proposal action',100)
  insist(Object.hasOwn(fields,command),'agent_action','Choose maintenance.prepare, arrears.prepare, renewal.prepare or appointment.book; this door never sends, pays or approves.')
  insist(p.arguments&&typeof p.arguments==='object'&&!Array.isArray(p.arguments),'agent_arguments','Supply structured proposal arguments.')
  insist(Object.keys(p.arguments).every(k=>fields[command].includes(k)),'agent_arguments','Unexpected proposal argument; documents cannot supply actions or authority.')
  const t=await tenancy(c,p.arguments.tenancyId),k=await assigned(c,p.credentialId,command,t.unit_id),key=id()
  const args={...p.arguments}
  const sourceWrites:D1PreparedStatement[]=[]
  if(command==='renewal.prepare'){
   const {r}=await renewalItem(c,args.renewalId)
   insist(r.tenancy_id===t.id,'not_found','Renewal not found.',404)
   insist(Array.isArray(args.alternatives)&&args.alternatives.length>=2,'renewal_options','Supply at least two sourced alternatives.')
   for(const key of ['conditionSource','communicationSource','cashSource'])text(args[key],key,1000)
   insist(Array.isArray(args.requiredSigners)&&args.requiredSigners.length>0,'renewal_signers','Name the required signers from the owner-reviewed legal source.')
   args.expectedRoster=await renewalRoster(c,t.id);args.expectedTenancyVersion=t.version;args.expectedRenewalVersion=r.version
   if(args.documentSources!==undefined){
    const reader=await sourceReader(c,k.id)
    args.documentSources=await pinRenewalSources(c,t,args.documentSources,reader)
    args.sourceInstallation=await sourceInstallation(c)
    sourceWrites.push(...renewalSourceGuards(c,t,args.documentSources),...renewalSourceGuards(reader!,t,args.documentSources))
   }
  }
  const purpose=text(p.purpose,'Purpose',1000),next=text(p.nextStep,'Next step',1000),due=date(p.dueOn,'Due date')
  const document=p.untrustedDocument===undefined?null:await sha256(new TextEncoder().encode(text(p.untrustedDocument,'Untrusted document',20000)))
  await commit(c,[live(c,k,command),...sourceWrites,sql(c,'INSERT INTO tt_agent_workloads(id,tenancy_id,credential_id,credential_version,command,payload,purpose,next_step,due_at,document_sha256,created_by,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)',key,t.id,k.id,k.version,command,JSON.stringify(args),purpose,next,due,document,c.actor.id,c.now),event(c,key,'queued',command==='renewal.prepare'?JSON.stringify({policy:policy(c),reason:purpose,before:null,after:{state:'queued',version:1,arguments:args,nextStep:next,dueOn:due}}):document?'Document instructions ignored; only owner-entered structured arguments apply.':'Owner entered structured proposal arguments.')],name,key)
  return {id:key,version:1,state:'queued',notice:'Workload queued. The live assigned credential records only the structured action; human authority remains separate.'}
 }
 const r=await one(c,'SELECT * FROM tt_agent_workloads WHERE id=?',text(p.workloadId,'Workload',100))
 insist(r,'not_found','Workload not found.',404)
 if(name==='agent.execute')insist(c.actor.credential&&c.actor.id===r.credential_id,'not_found','Workload not found.',404)
 const t=await tenancy(c,r.tenancy_id)
 insist(Number(p.version)===r.version,'conflict','Reload the current workload version.',409)
 if(name==='agent.execute'){
  insist(r.state==='queued','agent_stopped','This workload is not queued. The owner must review it before any execution.',409)
  insist(c.actor.version===r.credential_version,'agent_stopped','The assigned credential changed.',409)
  allow(c,r.command)
  const args=JSON.parse(r.payload)
  if(r.command==='renewal.prepare'){
   const {r:campaign}=await renewalItem(c,args.renewalId)
   const sources=await renewalSourceState(c,t,args.documentSources,args.sourceInstallation)
   if(sources?.stale){
    await commit(c,[current(c,r),sql(c,"UPDATE tt_agent_workloads SET state='paused',version=version+1 WHERE id=?",r.id),event(c,r.id,'stopped',SOURCE_REVIEW)],name,r.id)
    insist(false,'renewal_sources_changed',SOURCE_REVIEW,409)
   }
   if(args.expectedTenancyVersion!==t.version||args.expectedRenewalVersion!==campaign.version||JSON.stringify(args.expectedRoster)!==JSON.stringify(await renewalRoster(c,t.id))){
    await commit(c,[current(c,r),sql(c,"UPDATE tt_agent_workloads SET state='paused',version=version+1 WHERE id=?",r.id),event(c,r.id,'stopped','Lease terms, household roster or renewal history changed; owner review and a new workload are required.')],name,r.id)
    insist(false,'renewal_changed','Lease terms, household roster or renewal history changed. The workload is paused for owner review.',409)
   }
  }
  await commit(c,[current(c,r),sql(c,"UPDATE tt_agent_workloads SET state='running',attempts=attempts+1,version=version+1 WHERE id=?",r.id),event(c,r.id,'attempt',r.command==='renewal.prepare'?JSON.stringify({policy:policy(c),reason:'Execute owner-configured renewal preparation',before:{state:r.state,version:r.version,attempts:r.attempts},after:{state:'running',version:r.version+1,attempts:r.attempts+1}}):'Executing the structured action. No external send, payment or approval is permitted.')],name,r.id)
  c.action=r.command;c.agentWorkload={id:r.id,version:r.version+1}
  // The domain commit atomically checks cancellation and revocation again and records its proposal result.
  try{
   const result=await workCommand(c,r.command,args)??await tenancyCommand(c,r.command,args)??await appointmentCommand(c,r.command,args)
   insist(result,'agent_action','Unsupported proposal action.')
   return {...result,workloadId:r.id}
  }catch(error){
   const reader=r.command==='renewal.prepare'?await sourceReader(c,r.credential_id):null
   if(reader&&(await renewalSourceState(reader,t,args.documentSources,args.sourceInstallation))?.stale){
    const stopped={...c,agentWorkload:undefined,action:name},liveWork=await one(c,'SELECT * FROM tt_agent_workloads WHERE id=?',r.id)
    if(liveWork?.state==='running')await commit(stopped,[current(stopped,liveWork),sql(stopped,"UPDATE tt_agent_workloads SET state='paused',version=version+1 WHERE id=?",r.id),event(stopped,r.id,'stopped',SOURCE_REVIEW)],name,r.id)
    insist(false,'renewal_sources_changed',SOURCE_REVIEW,409)
   }
   throw error
  }
 }
 insist(!['cancelled','prepared','recorded'].includes(r.state),'agent_terminal','This workload is terminal; inspect its record instead of repeating it.',409)
 const reason=text(p.reason,'Review reference or reply',3000)
 if(name==='agent.reply'){
  await commit(c,[current(c,r),event(c,r.id,'reply',reason)],name,r.id)
  return {id:r.id,version:r.version,notice:'Reply recorded as evidence, never as an instruction.'}
 }
 let state=name==='agent.cancel'?'cancelled':'paused',credentialId=r.credential_id,credentialVersion=r.credential_version
 const writes=[current(c,r)]
 if(name==='agent.reassign'||name==='agent.resume'){
  insist(r.state!=='running','agent_running','Pause the in-flight attempt before reassignment or resumption.',409)
  const k=await assigned(c,name==='agent.reassign'?p.credentialId:r.credential_id,r.command,t.unit_id)
  const args=JSON.parse(r.payload),reader=await sourceReader(c,k.id)
  insist(!(await renewalSourceState(reader!,t,args.documentSources,args.sourceInstallation))?.stale,'renewal_sources_changed',SOURCE_REVIEW,409)
  writes.push(...renewalSourceGuards(reader!,t,args.documentSources))
  writes.push(live(c,k,r.command));credentialId=k.id;credentialVersion=k.version
  if(name==='agent.resume')state='queued'
 }
 writes.push(sql(c,'UPDATE tt_agent_workloads SET state=?,credential_id=?,credential_version=?,version=version+1 WHERE id=?',state,credentialId,credentialVersion,r.id),event(c,r.id,name.slice(6),reason))
 await commit(c,writes,name,r.id)
 return {id:r.id,version:r.version+1,state,notice:'Workload '+state+'. No proposal, message or payment was created by this control.'}
}
export async function agentWorkloads(c:Context){
 insist(c.actor.role==='owner'||c.actor.credential,'forbidden','Only the owner or the assigned credential can inspect agent workloads.',403)
 const rows=await all(c,'SELECT w.*,t.unit_id FROM tt_agent_workloads w JOIN tt_tenancies t ON t.id=w.tenancy_id WHERE t.erased_at IS NULL ORDER BY w.created_at,w.id')
 const visible=rows.filter(r=>c.actor.role==='owner'||r.credential_id===c.actor.id&&reaches(c,r.unit_id))
 return {workloads:await Promise.all(visible.map(async r=>{
  const k=await one(c,'SELECT label,role,version,revoked_at FROM tt_api_credentials WHERE id=?',r.credential_id)
  const stewardship=r.command==='renewal.prepare'?await renewalStewardship(c,r,!!k&&!k.revoked_at&&k.version===r.credential_version):null
  return {stewardship,id:r.id,version:r.version,purpose:r.purpose,arguments:JSON.parse(r.payload),permittedData:{tenancyId:r.tenancy_id},permittedActions:[r.command],credential:{id:r.credential_id,label:k?.label??'Unavailable after restore',role:k?.role??null,version:r.credential_version},state:r.state,executionAvailable:!!k&&!k.revoked_at&&k.version===r.credential_version&&r.state==='queued'&&!stewardship?.sources?.stale,nextStep:stewardship?.nextStep??r.next_step,dueOn:stewardship?.dueOn??r.due_at,attempts:r.attempts,humanApproval:r.command==='appointment.book'?'Existing human work approval and documented resident access are required; this workload grants neither.':'Required separately through the existing proposal door; this workload never approves.',costs:{currency:'USD',modelCents:0,providerCents:0,reason:'No model or provider is called by this workload.'},untrustedDocument:r.document_sha256?{sha256:r.document_sha256,instructions:'Ignored; content not retained or executed.'}:null,outcomeEvidence:r.result_subject?{subjectId:r.result_subject}:null,events:await all(c,'SELECT id,kind,actor,at,detail FROM tt_agent_workload_events WHERE workload_id=? ORDER BY id',r.id)}
 }))}
}
export function workloadText(data:Awaited<ReturnType<typeof agentWorkloads>>){return data.workloads.map(w=>JSON.stringify(w,null,2)).join('\n\n')||'No visible agent workloads.\n'}
