import {commit,guard,id,insist,one,sql,text,type Context,type Row} from './core'
import {journalProperty} from './journal'
import {STATES,OVERLAYS} from './rule-registry'

export async function jurisdictionCommand(c:Context,command:string,p:Row):Promise<Row|undefined>{
 if(!['property.rules','property.rules.propose','property.rules.confirm'].includes(command))return
 const proposal=command==='property.rules.confirm'?await one(c,'SELECT * FROM tt_property_rule_proposals WHERE id=?',text(p.proposalId,'Proposal',100)):null
 if(command==='property.rules.confirm')insist(proposal,'not_found','Proposal not found.',404)
 const property=await journalProperty(c,proposal?.property_id??p.propertyId)
 const state=proposal?.state_code??text(p.stateCode,'State',2)
 const overlays=proposal?JSON.parse(proposal.overlays):Array.isArray(p.overlays)?p.overlays:Object.keys(p).filter(k=>k.startsWith('overlay:')).map(k=>k.slice(8))
 insist(STATES.some(s=>s[0]===state)&&overlays.every((code:string)=>OVERLAYS.some(o=>o[0]===code&&o[2]===state)),'invalid_pack','Choose the property state and only its applicable overlays.')
 const old=await one(c,'SELECT version FROM tt_property_rules WHERE property_id=?',property.id),base=old?.version??0
 insist(Number(proposal?.base_version??p.version??0)===base,'conflict','Reload the property jurisdiction before changing it. A stale proposal needs a new review.',409)
 const reference=text(p.reference,'Jurisdiction review source',500),list=JSON.stringify([...new Set(overlays)])
 const fence=guard(c,'COALESCE((SELECT version FROM tt_property_rules WHERE property_id=?),0)=?',property.id,base)
 if(command==='property.rules.propose'){
  const key=id()
  await commit(c,[fence,sql(c,'INSERT INTO tt_property_rule_proposals(id,property_id,state_code,overlays,base_version,reference,proposed_by,proposed_at) VALUES(?,?,?,?,?,?,?,?)',key,property.id,state,list,base,reference,c.actor.id,c.now)],command,property.id)
  return{id:key,notice:'Jurisdiction proposal pending owner confirmation. The property assignment has not changed.'}
 }
 const version=base+1,writes=[fence,
  sql(c,'INSERT INTO tt_property_rules(property_id,state_code,overlays,version,set_by,set_at) VALUES(?,?,?,?,?,?) ON CONFLICT(property_id) DO UPDATE SET state_code=excluded.state_code,overlays=excluded.overlays,version=excluded.version,set_by=excluded.set_by,set_at=excluded.set_at',property.id,state,list,version,c.actor.id,c.now),
  sql(c,'INSERT INTO tt_property_rule_events(id,property_id,state_code,overlays,version,reference,set_by,set_at) VALUES(?,?,?,?,?,?,?,?)',id(),property.id,state,list,version,reference,c.actor.id,c.now)]
 if(proposal){
  insist(!await one(c,'SELECT 1 FROM tt_property_rule_confirmations WHERE proposal_id=?',proposal.id),'conflict','This proposal was already confirmed.',409)
  writes.push(guard(c,'NOT EXISTS(SELECT 1 FROM tt_property_rule_confirmations WHERE proposal_id=?)',proposal.id),sql(c,'INSERT INTO tt_property_rule_confirmations(proposal_id,version,reference,confirmed_by,confirmed_at) VALUES(?,?,?,?,?)',proposal.id,version,reference,c.actor.id,c.now))
 }
 await commit(c,writes,command,property.id)
 return{version,notice:'Property jurisdiction confirmed by the owner. An inactive or incomplete required pack holds its rule-dependent preview.'}
}
