import {prepareBuildingNotice,buildingNoticeData} from './building-notices'
import {all,allow,commit,guard,id,insist,one,recordRead,sql,tenancy,tenancyGuard,text,type Context,type Row} from './core'
import {noCredential} from './credentials'
export const CONVERSATION_COMMANDS=['conversation.assign','conversation.note','conversation.broadcast']
const access=(c:Context,action:string)=>{noCredential(c,'manage conversations');allow(c,action)}
const assigneeScope="(o.role='owner' OR EXISTS(SELECT 1 FROM tt_staff_roles r JOIN tt_role_actions a ON a.role=r.role WHERE r.operator_id=o.id AND a.action='conversation.read' AND (r.all_portfolios=1 OR EXISTS(SELECT 1 FROM tt_units u JOIN tt_properties p ON p.id=u.property_id JOIN tt_role_portfolios f ON f.portfolio_id=p.portfolio_id WHERE u.id=? AND f.operator_id=o.id))))"
export async function conversationCommand(c:Context,command:string,p:Row):Promise<Row|undefined>{
 if(!CONVERSATION_COMMANDS.includes(command))return
 access(c,command)
 if(command==='conversation.broadcast')return prepareBuildingNotice(c,p)
 const t=await tenancy(c,p.tenancyId),key=id(),writes=[tenancyGuard(c,t)]
 if(command==='conversation.assign'){
  const old=await one(c,'SELECT * FROM tt_conversations WHERE tenancy_id=?',t.id)
  insist(Number(p.version)===(old?.version??0),'conflict','Reload the conversation before assigning it.',409)
  const target=await one(c,`SELECT o.id,o.display_name,o.version FROM oa_operators o WHERE o.id=? AND o.status='active' AND ${assigneeScope}`,text(p.assigneeId,'Assignee',100),t.unit_id)
  insist(target,'not_found','An active staff assignee in this portfolio is required.',404)
  writes.push(guard(c,`EXISTS(SELECT 1 FROM oa_operators o WHERE o.id=? AND o.status='active' AND o.version=? AND ${assigneeScope})`,target.id,target.version,t.unit_id),old?guard(c,'EXISTS(SELECT 1 FROM tt_conversations WHERE tenancy_id=? AND version=?)',t.id,old.version):guard(c,'NOT EXISTS(SELECT 1 FROM tt_conversations WHERE tenancy_id=?)',t.id),sql(c,'INSERT INTO tt_conversations(tenancy_id,assignee_id,assignee_name,version,assigned_by,assigned_at) VALUES(?,?,?,?,?,?) ON CONFLICT(tenancy_id) DO UPDATE SET assignee_id=excluded.assignee_id,assignee_name=excluded.assignee_name,version=excluded.version,assigned_by=excluded.assigned_by,assigned_at=excluded.assigned_at',t.id,target.id,target.display_name,(old?.version??0)+1,c.actor.id,c.now),sql(c,"INSERT INTO tt_conversation_events(id,tenancy_id,sequence,kind,body,actor,actor_name,at) SELECT ?,?,COALESCE(MAX(sequence),0)+1,'assigned',?,?,?,? FROM tt_conversation_events WHERE tenancy_id=?",key,t.id,JSON.stringify({assigneeId:target.id,name:target.display_name,previousAssigneeId:old?.assignee_id??null}),c.actor.id,c.actor.displayName,c.now,t.id))
 }else{
  writes.push(sql(c,"INSERT INTO tt_conversation_events(id,tenancy_id,sequence,kind,body,actor,actor_name,at) SELECT ?,?,COALESCE(MAX(sequence),0)+1,'private_note',?,?,?,? FROM tt_conversation_events WHERE tenancy_id=?",key,t.id,text(p.body,'Private note',2000),c.actor.id,c.actor.displayName,c.now,t.id))
 }
 await commit(c,writes,command,key)
 return{id:key,tenancyId:t.id,tab:'messages',notice:command==='conversation.assign'?'Conversation assigned. No message sent.':'Private staff note saved. Never shared with the resident.'}
}
export async function conversationData(c:Context,tenancyId:unknown){
 access(c,'conversation.read');const t=await tenancy(c,tenancyId)
 const assignment=await one(c,'SELECT * FROM tt_conversations WHERE tenancy_id=?',t.id),events=await all(c,'SELECT * FROM tt_conversation_events WHERE tenancy_id=? ORDER BY sequence',t.id)
 const assignees=await all(c,`SELECT o.id,o.display_name FROM oa_operators o WHERE o.status='active' AND ${assigneeScope} ORDER BY o.display_name,o.id`,t.unit_id)
 await recordRead(c,'conversation.read',t.id)
 return{tenancyId:t.id,assignment,events,assignees,notices:await buildingNoticeData(c,t.id)}
}
export async function conversationSearch(c:Context,value:unknown){
 access(c,'conversation.read');const query=text(value,'Search',200).toLocaleLowerCase(),hits:Row[]=[]
 // Filter scope before matching or returning any content, including private notes.
 const rows=await all(c,'SELECT id,unit_id FROM tt_tenancies WHERE erased_at IS NULL ORDER BY id')
 for(const t of rows){
  if(c.actor.role!=='owner'&&!c.actor.staff?.all&&!(t.unit_id&&c.actor.staff?.units.has(t.unit_id)))continue
  const events=await all(c,'SELECT id,tenancy_id,kind,body,actor,actor_name,at FROM tt_conversation_events WHERE tenancy_id=? ORDER BY sequence',t.id)
  hits.push(...events.filter(e=>e.body.toLocaleLowerCase().includes(query)))
 }
 await recordRead(c,'conversation.search','scoped conversations')
 return{results:hits}
}
