// PORT-006: successor occupancy retains documentary work, never vacancy or execution authority.
import {all,allow,can,commit,date,guard,id,insist,one,reaches,sha256,sql,tenancy,tenancyGuard,text,type Context,type Row} from './core'
import {noCredential} from './credentials'
export const MOVE_FOLLOWUP_COMMANDS=['move.followup.update','move.followup.resolve']
const nextDay=(day:string)=>new Date(Date.parse(day+'T00:00:00Z')+86400000).toISOString().slice(0,10)
const NOTICE='Staff follow-up recorded. No entry, work, availability, message or money is authorized.'
const PERSON_SQL="SELECT o.id,o.display_name,o.version,r.version AS staff_version FROM oa_operators o LEFT JOIN tt_staff_roles r ON r.operator_id=o.id WHERE o.id=? AND o.status='active' AND (o.role='owner' OR (EXISTS(SELECT 1 FROM tt_role_actions a WHERE a.role=r.role AND a.action='tenancy.end') AND (r.all_portfolios=1 OR EXISTS(SELECT 1 FROM tt_role_portfolios p JOIN tt_properties h ON h.portfolio_id=p.portfolio_id JOIN tt_units u ON u.property_id=h.id WHERE p.operator_id=o.id AND u.id=?))))"
async function person(c:Context,value:unknown,unitId:string){
 const row=await one(c,PERSON_SQL,text(value,'Responsible staff',100),unitId)
 insist(row,'responsible_scope','Choose active staff with move-out responsibility in this portfolio.',403)
 return row
}
const personGuard=(c:Context,p:Row,unitId:string)=>guard(c,`EXISTS(${PERSON_SQL} AND o.version=? AND r.version IS ?)`,p.id,unitId,p.version,p.staff_version??null)
export async function occupiedFollowup(c:Context,t:Row,moveOut:string,blocker:Row){
 noCredential(c,'record move-out follow-ups')
 const key=id(),responsible=await person(c,c.actor.id,t.unit_id)
 return {followupId:key,statements:[
  guard(c,'NOT EXISTS(SELECT 1 FROM tt_move_followups WHERE tenancy_id=?)',t.id),
  guard(c,'EXISTS(SELECT 1 FROM tt_tenancies WHERE id=? AND version=? AND unit_id=? AND erased_at IS NULL AND start_date<=? AND COALESCE(ended_on,end_date)>=?)',blocker.id,blocker.version,t.unit_id,nextDay(moveOut),nextDay(moveOut)),
  personGuard(c,responsible,t.unit_id),
  sql(c,'INSERT INTO tt_move_followups(id,tenancy_id,unit_id,move_out,blocker_id,blocker_start,blocker_end,created_by,created_at) VALUES(?,?,?,?,?,?,?,?,?)',key,t.id,t.unit_id,moveOut,blocker.id,blocker.start_date,blocker.ended_on??blocker.end_date,c.actor.id,c.now),
  sql(c,'INSERT INTO tt_move_followup_origins(followup_id) VALUES(?)',key),
  sql(c,"INSERT INTO tt_move_followup_revisions(followup_id,version,state,responsible_id,responsible_name,due_on,next_action,evidence,reason,recorded_by,recorded_at) VALUES(?,1,'open',?,?,?,?,?,'',?,?)",key,responsible.id,responsible.display_name,nextDay(moveOut),'Review the occupied unit and arrange permitted follow-up; confirm any work separately.','[]',c.actor.id,c.now),
 ]}
}
async function evidence(c:Context,unitId:string,jobId:string):Promise<Row>{
 const row=await one(c,'SELECT j.id,j.tenancy_id,j.version,j.state,j.resolution,t.version AS lease_version,t.unit_id,t.custody_retired_at,t.erased_at FROM tt_maintenance_jobs j JOIN tt_tenancies t ON t.id=j.tenancy_id WHERE j.id=?',jobId)
 insist(row&&row.unit_id===unitId&&!row.erased_at&&!row.custody_retired_at&&reaches(c,row.unit_id),'not_found','Repair evidence not found in this unit.',404)
 const records=await all(c,"SELECT id,'report' AS kind FROM tt_completion_attempts WHERE job_id=? UNION ALL SELECT id,'check' FROM tt_resident_checks WHERE job_id=? UNION ALL SELECT id,'closure' FROM tt_job_closures WHERE job_id=? ORDER BY kind,id",row.id,row.id,row.id)
 return {...row,records}
}
const evidenceGuard=(c:Context,j:Row)=>guard(c,'EXISTS(SELECT 1 FROM tt_maintenance_jobs j JOIN tt_tenancies t ON t.id=j.tenancy_id WHERE j.id=? AND j.version=? AND j.state=? AND j.resolution IS ? AND t.version=? AND t.unit_id=? AND t.erased_at IS NULL AND t.custody_retired_at IS NULL) AND (SELECT COUNT(*) FROM tt_completion_attempts WHERE job_id=?)+(SELECT COUNT(*) FROM tt_resident_checks WHERE job_id=?)+(SELECT COUNT(*) FROM tt_job_closures WHERE job_id=?)=?',j.id,j.version,j.state,j.resolution,j.lease_version,j.unit_id,j.id,j.id,j.id,j.records.length)
async function details(c:Context,f:Row){
 const history=await all(c,'SELECT * FROM tt_move_followup_revisions WHERE followup_id=? ORDER BY version DESC',f.id),latest=history[0]
 const linked:Row[]=JSON.parse(latest.evidence),current:Row[]=[]
 for(const item of linked){try{current.push(await evidence(c,f.unit_id,item.id))}catch{current.push({id:item.id,unavailable:true})}}
 const t=await tenancy(c,f.tenancy_id),sourceCurrent=t.unit_id===f.unit_id&&t.ended_on===f.move_out&&!t.custody_retired_at
 const responsible=await one(c,PERSON_SQL,latest.responsible_id,f.unit_id)
 const origin=!!await one(c,'SELECT 1 FROM tt_move_followup_origins WHERE followup_id=?',f.id)
 const needsReview=!sourceCurrent||!responsible||JSON.stringify(linked)!==JSON.stringify(current)
 const fingerprint=await sha256(new TextEncoder().encode(JSON.stringify({id:f.id,version:latest.version,leaseVersion:t.version,sourceCurrent,current,responsible,origin})))
 return {...f,...latest,history:history.map(r=>({...r,evidence:JSON.parse(r.evidence)})),evidence:linked,currentEvidence:current,sourceCurrent,needsReview,restored:!origin,fingerprint,status:latest.state!=='open'&&needsReview?'open':latest.state}
}
export async function moveFollowupData(c:Context,value?:unknown){
 allow(c,'move.followup.read');noCredential(c,'read staff move-out follow-ups')
 const cases:Row[]=[]
 for(const f of await all(c,'SELECT f.*,u.identifier AS unit_label,p.name AS property_name FROM tt_move_followups f JOIN tt_units u ON u.id=f.unit_id JOIN tt_properties p ON p.id=u.property_id JOIN tt_tenancies t ON t.id=f.tenancy_id WHERE t.erased_at IS NULL AND t.custody_retired_at IS NULL ORDER BY f.move_out,f.id')){
  if(reaches(c,f.unit_id)&&(!value||f.id===value))cases.push(await details(c,f))
 }
 if(value)insist(cases.length,'not_found','Move-out follow-up not found.',404)
 const units=[...new Set(cases.map(f=>f.unit_id))],people:Row[]=[],repairs:Row[]=[]
 for(const unitId of units){
  for(const o of await all(c,"SELECT id FROM oa_operators WHERE status='active'")){
   const eligible=await one(c,PERSON_SQL,o.id,unitId)
   if(eligible)people.push({id:eligible.id,name:eligible.display_name,unitId})
  }
  if(can(c,'work.read'))for(const j of await all(c,'SELECT j.id,j.scope,j.state,j.resolution,t.unit_id FROM tt_maintenance_jobs j JOIN tt_tenancies t ON t.id=j.tenancy_id WHERE t.unit_id=? AND t.erased_at IS NULL AND t.custody_retired_at IS NULL ORDER BY j.id',unitId))repairs.push(j)
 }
 return {cases,people,repairs,notice:NOTICE}
}
export async function moveFollowupCommand(c:Context,command:string,p:Row):Promise<Row|undefined>{
 if(!MOVE_FOLLOWUP_COMMANDS.includes(command))return
 allow(c,command);noCredential(c,'manage staff move-out follow-ups')
 const f=(await moveFollowupData(c,text(p.followupId,'Follow-up',100))).cases[0],t=await tenancy(c,f.tenancy_id)
 insist(!f.restored,'restore_hold','Restored follow-ups are historical evidence only; arrange any new work through current authorized doors.',409)
 insist(Number(p.version)===f.version&&p.fingerprint===f.fingerprint&&f.sourceCurrent,'review_changed','The follow-up or its evidence changed. Reload and review again.',409)
 const responsible=await person(c,command==='move.followup.update'?p.responsibleId:f.responsible_id,f.unit_id)
 let linked:Row[]=f.currentEvidence
 insist(!linked.some(j=>j.unavailable),'evidence_unavailable','Linked evidence is no longer available. Keep this follow-up open for custody review.',409)
 let state='open',reason=''
 if(command==='move.followup.update'){
  if(p.jobId){
   allow(c,'work.read')
   const item=await evidence(c,f.unit_id,text(p.jobId,'Repair evidence',100))
   if(!linked.some(j=>j.id===item.id))linked=[...linked,item]
  }
 }else{
  insist(f.state==='open'||f.needsReview,'already_reviewed','This revision is already resolved. Record a new follow-up revision before another review.',409)
  insist(['resolved','no_work'].includes(p.outcome),'review_outcome','Choose reviewed repair resolution or no work required.')
  insist(p.outcome==='resolved'?linked.length>0&&linked.every(j=>j.state==='sent'&&['resolved','closed'].includes(j.resolution)):linked.length===0,'unfinished_work','Unfinished linked work stays open. No-work requires no linked repairs.',409)
  insist(p.consent==='REVIEWED','review_required','Type REVIEWED after checking the exact current evidence.')
  state=p.outcome;reason=text(p.reason,'Reviewed resolution or no-work reason',1000)
 }
 const due=command==='move.followup.update'?date(p.dueOn,'Follow-up due date'):f.due_on,next=command==='move.followup.update'?text(p.nextAction,'Next action',1000):f.next_action
 await commit(c,[tenancyGuard(c,t),personGuard(c,responsible,f.unit_id),guard(c,'EXISTS(SELECT 1 FROM tt_move_followup_origins WHERE followup_id=?) AND (SELECT MAX(version) FROM tt_move_followup_revisions WHERE followup_id=?)=?',f.id,f.id,f.version),...linked.map(j=>evidenceGuard(c,j)),
  sql(c,'INSERT INTO tt_move_followup_revisions(followup_id,version,state,responsible_id,responsible_name,due_on,next_action,evidence,reason,recorded_by,recorded_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)',f.id,f.version+1,state,responsible.id,responsible.display_name,due,next,JSON.stringify(linked),reason,c.actor.id,c.now),
 ],command,f.id)
 return {id:f.id,followupId:f.id,tab:'properties',notice:NOTICE}
}
