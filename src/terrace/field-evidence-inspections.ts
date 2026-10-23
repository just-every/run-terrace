import {independence} from './dual-control'
import {all,allow,cents,commit,date,guard,id,insist,one,sha256,sql,tenancy,text,type Context,type Row} from './core'
export const INSPECTION_COMMANDS=['inspection.configure','inspection.capture','inspection.acknowledge','inspection.propose','inspection.decide']
export async function inspectionRecord(c:Context,key:unknown) {
 const r=await one(c,'SELECT * FROM tt_inspections WHERE id=?',text(key,'Inspection',100));insist(r,'not_found','Inspection not found.',404);await tenancy(c,r.tenancy_id);return r
}
const versionGuard=(c:Context,r:Row,v:number)=>guard(c,'EXISTS(SELECT 1 FROM tt_inspections WHERE id=? AND version=?)',r.id,v)
export async function inspectionCaptures(c:Context,tenancyId:string) {
 const captures=await all(c,'SELECT f.* FROM tt_inspection_captures f JOIN tt_inspections i ON i.id=f.inspection_id WHERE i.tenancy_id=? ORDER BY f.inspection_version,f.id',tenancyId)
 const acknowledgements=await all(c,'SELECT a.* FROM tt_inspection_acknowledgements a JOIN tt_inspection_captures f ON f.id=a.capture_id JOIN tt_inspections i ON i.id=f.inspection_id WHERE i.tenancy_id=? ORDER BY a.recorded_at,a.id',tenancyId)
 const proposals=await all(c,'SELECT p.* FROM tt_inspection_proposals p JOIN tt_inspection_captures f ON f.id=p.capture_id JOIN tt_inspections i ON i.id=f.inspection_id WHERE i.tenancy_id=? ORDER BY p.prepared_at,p.id',tenancyId)
 return {captures,acknowledgements,inspectionProposals:proposals}
}
const list=(v:unknown,label:string)=>{let a=v;try{if(typeof v==='string')a=JSON.parse(v)}catch{}insist(Array.isArray(a)&&a.length>0&&a.length<=50,'checklist',`${label} must contain 1 to 50 items.`);return a as Row[]}
async function capture(c:Context,key:unknown){const f=await one(c,'SELECT * FROM tt_inspection_captures WHERE id=?',text(key,'Capture',100));insist(f,'not_found','Capture not found.',404);const r=await inspectionRecord(c,f.inspection_id);return {f,r}}
export async function inspectionCommand(c:Context,command:string,p:Row):Promise<Row|undefined> {
 if(!INSPECTION_COMMANDS.includes(command))return
 allow(c,command)
 if(command==='inspection.configure'){
  const r=await inspectionRecord(c,p.inspectionId);insist(r.state==='draft','inspection_state','Completed inspections keep their configuration.',409)
  insist(Number(p.version)===r.version,'scope_changed','The inspection changed. Review the current checklist.',409)
  insist(['routine','move_in','move_out'].includes(p.kind),'inspection_kind','Choose routine, move-in or move-out.')
  const entries=typeof p.checklist==='string'&&!p.checklist.trim().startsWith('[')?p.checklist.split('\n').filter(Boolean).map((line:string)=>{const [key,room,asset]=line.split('|').map(s=>s.trim());return {key,room,asset}}):list(p.checklist,'Checklist')
  const items=list(entries,'Checklist').map(x=>({key:text(x.key,'Stable item key',80),room:text(x.room,'Room',100),asset:text(x.asset,'Asset',150)}))
  insist(new Set(items.map(x=>x.key)).size===items.length,'checklist','Checklist keys must be unique.')
  let entry=null
  if(p.entryId){entry=await inspectionRecord(c,p.entryId);insist(p.kind==='move_out'&&entry.tenancy_id===r.tenancy_id&&entry.kind==='move_in'&&entry.id!==r.id&&entry.inspection_date<=r.inspection_date,'entry_inspection','Choose this tenancy’s move-in inspection.');insist(await one(c,'SELECT 1 FROM tt_inspection_captures WHERE inspection_id=?',entry.id),'entry_inspection','The entry inspection needs a captured condition record.',409)}
  await commit(c,[versionGuard(c,r,r.version),sql(c,'UPDATE tt_inspections SET kind=?,entry_id=?,checklist=?,version=version+1 WHERE id=?',p.kind,entry?.id??null,JSON.stringify(items),r.id)],command,r.id)
  return {tenancyId:r.tenancy_id,notice:'Inspection checklist configured. Existing captures and disagreements remain unchanged.'}
 }
 if(command==='inspection.capture'){
  const r=await inspectionRecord(c,p.inspectionId),items=list(p.items,'Findings'),client=text(p.clientId,'Capture replay identifier',100),payload=JSON.stringify({inspectionId:r.id,version:Number(p.version),items,capturedAt:p.capturedAt,source:p.source}),hash=await sha256(new TextEncoder().encode(payload))
  const old=await one(c,'SELECT * FROM tt_inspection_captures WHERE client_id=?',client)
  if(old){insist(old.inspection_id===r.id&&old.recorded_by===c.actor.id&&old.payload_hash===hash,'capture_replay','This draft id already records different evidence.',409);return {id:old.id,tenancyId:r.tenancy_id,replayed:true,notice:'Capture already synchronized.'}}
  insist(r.state==='draft'&&Number(p.version)===r.version,'scope_changed','The inspection changed while offline. Review and reconcile against the current checklist before syncing.',409)
  const expected:Row[]=JSON.parse(r.checklist??'[]');insist(expected.length&&items.length===expected.length&&new Set(items.map(x=>x.key)).size===items.length&&items.every(x=>expected.some(v=>v.key===x.key)),'checklist','Capture every configured room/asset once; retain removed findings in a separate note before reconciling.',409)
  const normalized=[]
  for(const x of items){const definition=expected.find(v=>v.key===x.key)!;insist(['good','worn','damaged','missing','unknown'].includes(x.condition),'condition','Choose a condition for each item.')
   const media=Array.isArray(x.mediaIds)?x.mediaIds:[];insist(media.length<=10,'media','At most ten originals per finding.')
   const originals=[]
   for(const key of media){const m=await one(c,"SELECT id,name,sha256,captured_at,media_type FROM tt_record_media WHERE id=? AND inspection_id=? AND state='ready'",text(key,'Original',100),r.id);insist(m,'media_scope','Choose original media on this inspection.',404);originals.push(m)}
   normalized.push({...definition,condition:x.condition,notes:text(x.notes,'Finding notes',2000),reading:text(x.reading,'Reading or explicitly none',200),media:originals})
  }
  const key=id();await commit(c,[versionGuard(c,r,r.version),sql(c,'INSERT INTO tt_inspection_captures(id,inspection_id,client_id,payload_hash,inspection_version,items,device_consent_at,reconciliation,source,captured_at,recorded_by,recorded_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)',key,r.id,client,hash,r.version,JSON.stringify(normalized),p.deviceConsentAt?text(p.deviceConsentAt,'Device consent time',40):null,p.reconciliation?text(JSON.stringify(p.reconciliation),'Reconciliation record',20000):null,text(p.source,'Capture source',500),date(p.capturedAt,'Capture date'),c.actor.id,c.now),sql(c,'UPDATE tt_inspections SET version=version+1 WHERE id=?',r.id)],command,r.id)
  return {id:key,tenancyId:r.tenancy_id,notice:'Original inspection findings synchronized. Resident acknowledgement and any human decision remain separate.'}
 }
 if(command==='inspection.acknowledge'){
  const {f,r}=await capture(c,p.captureId),key=text(p.itemKey,'Item',80);insist(JSON.parse(f.items).some((x:Row)=>x.key===key),'finding','Finding not found.',404)
  insist(['acknowledged','disputed'].includes(p.outcome),'acknowledgement','Record acknowledged or disputed.')
  await commit(c,[sql(c,'INSERT INTO tt_inspection_acknowledgements(id,capture_id,item_key,outcome,note,source,recorded_by,recorded_at) VALUES(?,?,?,?,?,?,?,?)',id(),f.id,key,p.outcome,text(p.note,'Resident’s words',2000),text(p.source,'Resident acknowledgement source',500),c.actor.id,c.now)],command,r.id)
  return {tenancyId:r.tenancy_id,notice:'Resident’s sourced acknowledgement recorded by staff; no signature or contact by Terrace is claimed. Disagreements are retained.'}
 }
 if(command==='inspection.propose'){
  const {f,r}=await capture(c,p.captureId),key=text(p.itemKey,'Item',80);insist(r.kind==='move_out'&&JSON.parse(f.items).some((x:Row)=>x.key===key),'comparison','Choose a move-out finding.',409)
  const entry=r.entry_id?await one(c,'SELECT * FROM tt_inspection_captures WHERE inspection_id=? ORDER BY inspection_version DESC LIMIT 1',r.entry_id):null
  insist(['work','deduction'].includes(p.kind),'proposal_kind','Choose work or deduction.')
  const proposal=id();await commit(c,[versionGuard(c,r,r.version),sql(c,'INSERT INTO tt_inspection_proposals(id,capture_id,entry_capture_id,item_key,kind,amount_cents,reason,prepared_by,prepared_at) VALUES(?,?,?,?,?,?,?,?,?)',proposal,f.id,entry?.id??null,key,p.kind,p.kind==='deduction'?cents(p.amount):null,text(p.reason,'Proposal rationale',2000),c.actor.id,c.now)],command,r.id)
  return {id:proposal,tenancyId:r.tenancy_id,notice:'Proposal saved for a person to review. No work order or deposit charge was created.'}
 }
 const proposal=await one(c,'SELECT * FROM tt_inspection_proposals WHERE id=?',text(p.proposalId,'Proposal',100));insist(proposal,'not_found','Proposal not found.',404)
 const {f,r}=await capture(c,proposal.capture_id);insist(!proposal.decision,'proposal_decided','This proposal already has a decision.',409)
 insist(['approved','rejected'].includes(p.decision),'proposal_decision','Approve or reject the proposal.')
 let independent={label:null as string|null,guards:[] as D1PreparedStatement[]}
 if(p.decision==='approved'){
  independent=await independence(c,'inspection.decide',[proposal.prepared_by])
  const entry=proposal.entry_capture_id?await one(c,'SELECT * FROM tt_inspection_captures WHERE id=?',proposal.entry_capture_id):null,before=entry?JSON.parse(entry.items).find((x:Row)=>x.key===proposal.item_key):null,after=JSON.parse(f.items).find((x:Row)=>x.key===proposal.item_key)
  insist(before&&after&&before.media.length&&after.media.length&&before.room===after.room&&before.asset===after.asset&&before.media.some((b:Row)=>after.media.some((a:Row)=>a.sha256!==b.sha256))&&['damaged','missing'].includes(after.condition)&&before.condition!==after.condition,'unsupported_finding','This proposal has no supported entry/exit damage comparison. Reject it or capture supported findings first.',409)
  insist(await one(c,'SELECT id FROM tt_inspection_captures WHERE inspection_id=? ORDER BY inspection_version DESC LIMIT 1',r.id).then(x=>x?.id===f.id),'comparison_changed','New findings require a new reviewed proposal.',409)
 }
 await commit(c,[...independent.guards,versionGuard(c,r,r.version),guard(c,'EXISTS(SELECT 1 FROM tt_inspection_proposals WHERE id=? AND decision IS NULL)',proposal.id),sql(c,'UPDATE tt_inspection_proposals SET decision=?,decision_reason=?,decided_by=?,decided_at=? WHERE id=?',p.decision,text(p.reason,'Decision reason',1000)+(independent.label?' · '+independent.label:''),c.actor.id,c.now,proposal.id)],command,r.id)
 return {tenancyId:r.tenancy_id,notice:'Human decision recorded. Disputed findings remain; no deposit deduction, work order or outbound action was executed.'}
}
