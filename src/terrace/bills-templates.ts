import { all, allow, commit, guard, id, insist, one, sql, text, type Context, type Row } from './core'
import { billSubjects } from './bills-retention'
import { independence } from './dual-control'
import { month } from './periods'
import { localDate } from './zones'
import { billAuthority } from './bills-authority'
import { digest, input, revision, scopes, unique } from './bills-input'
async function template(c: Context,v: unknown) {
 const t=await one(c,'SELECT * FROM tt_bill_templates WHERE id=?',text(v,'Recurring template',100))
 insist(t,'not_found','Recurring payable not found.',404);t.parsed=JSON.parse(t.terms);await scopes(c,t.parsed);for(const r of await all(c,'SELECT terms FROM tt_bill_template_revisions WHERE template_id=?',t.id))await scopes(c,JSON.parse(r.terms));return t
}
export async function templateCommand(c: Context,command: string,p: Row): Promise<Row|undefined> {
 if(!command.startsWith('bill-template.'))return
 allow(c,command)
 if(command==='bill-template.create'||command==='bill-template.revise') {
  const old=command==='bill-template.revise'?await template(c,p.templateId):null
  if(old)insist(Number(p.version)===old.version,'conflict','Reload the current template revision.',409)
  const terms=await input(c,p,true),sha=await digest(terms),key=old?.id??id(),version=(old?.version??0)+1
  await commit(c,[...(old?[guard(c,'EXISTS(SELECT 1 FROM tt_bill_templates WHERE id=? AND version=?)',key,old.version),sql(c,"UPDATE tt_bill_templates SET terms=?,sha256=?,version=?,state='pending',revised_by=? WHERE id=?",JSON.stringify(terms),sha,version,c.actor.id,key)]:[sql(c,'INSERT INTO tt_bill_templates(id,terms,sha256,prepared_by,revised_by,created_at) VALUES(?,?,?,?,?,?)',key,JSON.stringify(terms),sha,c.actor.id,c.actor.id,c.now)]),sql(c,'INSERT INTO tt_bill_template_revisions(template_id,version,terms,sha256,prepared_by,prepared_at) VALUES(?,?,?,?,?,?)',key,version,JSON.stringify(terms),sha,c.actor.id,c.now),...await billSubjects(c,key,terms,'template')],command,key)
  return {id:key,version,state:'pending',notice:'Recurring terms prepared. Approve this exact revision before generating bills; each generated bill needs its own approval.'}
 }
 const t=await template(c,p.templateId)
 insist(Number(p.version)===t.version,'conflict','Reload the current template revision.',409)
 const live=guard(c,'EXISTS(SELECT 1 FROM tt_bill_templates WHERE id=? AND version=? AND state=?)',t.id,t.version,t.state)
 if(command==='bill-template.approve') {
  insist(t.state==='pending','template_state','This template revision is already approved.',409)
  const a=await billAuthority(c,{id:t.id,version:t.version,sha256:t.sha256,parsed:t.parsed})
  insist(!a.blockers.length,'bill_held',a.blockers.join('; '),409)
  const independent=await independence(c,command,[t.prepared_by,t.revised_by])
  await commit(c,[live,...a.guards,...independent.guards,sql(c,'INSERT INTO tt_bill_template_approvals(id,template_id,version,sha256,approved_by,approved_at,label) VALUES(?,?,?,?,?,?,?)',id(),t.id,t.version,t.sha256,c.actor.id,c.now,independent.label),sql(c,"UPDATE tt_bill_templates SET state='approved' WHERE id=?",t.id)],command,t.id)
  return {id:t.id,version:t.version,state:'approved',notice:'Exact recurring template approved. Generated bills remain pending separate approval.'}
 }
 if(command==='bill-template.run') {
  insist(t.state==='approved','template_not_approved','Approve the current template revision before a run.',409)
  const m=month(p.month),end=new Date(Date.UTC(Number(m.slice(0,4)),Number(m.slice(5,7)),0)).getUTCDate(),day=m+'-'+String(Math.min(t.parsed.dayOfMonth,end)).padStart(2,'0')
  insist(day>=t.parsed.starts&&day<=t.parsed.endDate,'outside_schedule','This bill date is outside the template’s start and end dates.',409)
  const zones=await all(c,`SELECT time_zone FROM tt_properties WHERE id IN (${t.parsed.allocations.map(()=>'?').join(',')})`,...t.parsed.allocations.map((a:Row)=>a.propertyId))
  insist(zones.every(p=>day<=localDate(c.now,p.time_zone)),'future_bill','Run a recurring payable only when its bill date has arrived at every allocated property.',409)
  const old=await one(c,'SELECT id,version,state FROM tt_bills WHERE template_id=? AND period=?',t.id,m)
  if(old)return {...old,generated:false,notice:'This period already has its one bill. Review its current approval.'}
  const terms={...t.parsed,day,invoiceNumber:t.parsed.invoiceNumber+'-'+m,templateId:t.id,templateVersion:t.version,templateSha256:t.sha256,period:m},key=id(),sha=await digest(terms)
  await unique(c,terms)
  await commit(c,[live,guard(c,'NOT EXISTS(SELECT 1 FROM tt_bills WHERE template_id=? AND period=?)',t.id,m),sql(c,'INSERT INTO tt_bills(id,vendor_id,invoice_number,invoice_key,day,prepared_by,revised_by,created_at,template_id,period) VALUES(?,?,?,?,?,?,?,?,?,?)',key,terms.vendorId,terms.invoiceNumber,terms.invoiceNumber.toLowerCase(),day,t.prepared_by,c.actor.id,c.now,t.id,m),revision(c,key,1,terms,sha),...await billSubjects(c,key,terms)],command,key)
  return {id:key,version:1,state:'pending',generated:true,notice:'One bill generated for this month, awaiting separate approval. No payment has been made.'}
 }
}
