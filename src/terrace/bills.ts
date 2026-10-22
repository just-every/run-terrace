import { all, allow, commit, guard, id, insist, one, reachesPortfolio, sql, text, type Context, type Row } from './core'
import { attachment } from './bills-attachments'
import { approval, billAuthority } from './bills-authority'
import { BILL_COMMANDS, bill, billGuard, digest, input, revision, scopes, unique } from './bills-input'
import { billSubjects } from './bills-retention'
import { templateCommand } from './bills-templates'
import { endSessions } from './portal-session'
export { BILL_COMMANDS } from './bills-input'
export { billAttachment } from './bills-attachments'
/** Reopening an approved invoice removes its former markup with immutable reversing lines, including overrides. */
async function reverseMarkup(c: Context,b: Row) {
 const rows=await all(c,"SELECT * FROM tt_fees WHERE kind='markup' AND source=? ORDER BY created_at",`bill:${b.id}:v${b.version}`),writes:D1PreparedStatement[]=[]
 const groups=new Map<string,Row[]>()
 for(const r of rows){const k=r.property_id+'|'+r.owner_id;groups.set(k,[...(groups.get(k)??[]),r])}
 for(const lines of groups.values()) {
  const r=lines[0],amount=-lines.reduce((s,l)=>s+l.amount_cents,0),tax=-lines.reduce((s,l)=>s+l.tax_cents,0)
  if(amount||tax)writes.push(sql(c,'INSERT INTO tt_fees(id,property_id,owner_id,month,day,kind,source,source_label,base_cents,rate_bp,amount_cents,tax_bp,tax_cents,agreement_id,run_id,created_by,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',id(),r.property_id,r.owner_id,r.month,r.day,'markup',r.source,r.source_label+' (revision superseded)',r.base_cents,r.rate_bp,amount,r.tax_bp,tax,r.agreement_id,b.id,c.actor.id,c.now))
 }
 return [guard(c,"(SELECT COUNT(*) FROM tt_fees WHERE kind='markup' AND source=?)=?",`bill:${b.id}:v${b.version}`,rows.length),...writes]
}
export async function billCommand(c: Context,command: string,p: Row): Promise<Row|undefined> {
 if(!BILL_COMMANDS.includes(command))return
 if(command.startsWith('bill-template.'))return templateCommand(c,command,p)
 allow(c,command)
 if(command==='bill.create') {
  const terms=await input(c,p),key=id();await unique(c,terms)
  const a=await attachment(c,key,1,p.original??p.invoice,true)
  terms.attachments=[{id:a.id,sha256:a.sha}]
  const sha=await digest(terms)
  await commit(c,[guard(c,"NOT EXISTS(SELECT 1 FROM tt_bill_revisions WHERE json_extract(terms,'$.vendorId')=? AND lower(json_extract(terms,'$.invoiceNumber'))=?)",terms.vendorId,terms.invoiceNumber.toLowerCase()),sql(c,'INSERT INTO tt_bills(id,vendor_id,invoice_number,invoice_key,day,prepared_by,revised_by,created_at) VALUES(?,?,?,?,?,?,?,?)',key,terms.vendorId,terms.invoiceNumber,terms.invoiceNumber.toLowerCase(),terms.day,c.actor.id,c.actor.id,c.now),revision(c,key,1,terms,sha),...await billSubjects(c,key,terms),...a.statements],command,key)
  return {id:key,version:1,state:'pending',notice:'Original invoice retained privately. Fields were entered by staff and have not been extracted. Review authority before approving the payable.'}
 }
 const b=await bill(c,p.billId)
 insist(Number(p.version)===b.version,'conflict','Reload the current bill revision.',409)
 if(command==='bill.revise'||command==='bill.attach') {
  const terms=command==='bill.revise'?{...await input(c,p),attachments:b.parsed.attachments??[]}:structuredClone(b.parsed)
  await unique(c,terms,b.id)
  const version=b.version+1,a=command==='bill.attach'?await attachment(c,b.id,version,p.attachment??p.invoice,false):null
  if(a)terms.attachments=[...(terms.attachments??[]),{id:a.id,sha256:a.sha}]
  const sha=await digest(terms)
  await commit(c,[billGuard(c,b),...await reverseMarkup(c,b),...(a?.statements??[]),sql(c,"UPDATE tt_bills SET vendor_id=?,invoice_number=?,invoice_key=?,day=?,version=?,state='pending',revised_by=? WHERE id=?",terms.vendorId,terms.invoiceNumber,terms.invoiceNumber.toLowerCase(),terms.day,version,c.actor.id,b.id),revision(c,b.id,version,terms,sha),...await billSubjects(c,b.id,terms),...(b.vendor_id===terms.vendorId?[]:[endSessions(c,'vendor_id',[b.vendor_id,terms.vendorId])])],command,b.id)
  return {id:b.id,version,state:'pending',notice:'Bill changed: previous approval and owner decision no longer apply. Review the exact new terms before it becomes a payable.'}
 }
 if(command==='bill.owner') {
  insist(b.state==='pending','bill_state','Record an owner decision before approval.',409)
  const a=await billAuthority(c,b)
  insist(!a.decision,'owner_decision_recorded','This revision already has an owner decision. Revise the terms before recording another decision.',409)
  insist(a.needsOwner,'within_limit','This bill is within recorded spending authority.',409)
  insist(['approved','declined'].includes(p.decision)&&['email','document','call'].includes(p.source),'invalid_input','Record approved or declined and the source email, document or call.')
  const ref=text(p.reference,'Owner decision source',1000)
  await commit(c,[billGuard(c,b),...a.guards,sql(c,'INSERT INTO tt_bill_decisions(id,bill_id,version,sha256,decision,source,reference,recorded_by,recorded_at) VALUES(?,?,?,?,?,?,?,?,?)',id(),b.id,b.version,b.sha256,p.decision,p.source,ref,c.actor.id,c.now)],command,b.id)
  return {id:b.id,version:b.version,notice:'Owner decision recorded by staff for the owner on this exact revision. Terrace did not contact the owner.'}
 }
 if(command==='bill.approve') {
  const a=await approval(c,b)
  await commit(c,[billGuard(c,b),...a.guards,...a.writes],command,b.id)
  return {id:b.id,version:b.version,state:'payable',notice:'Approved as a payable to '+b.parsed.supplier+'. No money has moved.'}
 }
}
export async function billData(c: Context) {
 allow(c,'bills.read')
 const [rows,templates,properties,vendors]=await Promise.all([all(c,'SELECT b.*,r.terms,r.sha256 FROM tt_bills b JOIN tt_bill_revisions r ON r.bill_id=b.id AND r.version=b.version ORDER BY b.day,b.created_at'),all(c,'SELECT * FROM tt_bill_templates ORDER BY created_at'),all(c,'SELECT id,name,portfolio_id FROM tt_properties ORDER BY name'),all(c,'SELECT id,name FROM tt_vendors ORDER BY name')])
 const permitted=properties.filter(p=>reachesPortfolio(c,p.portfolio_id)),ids=new Set(permitted.map(p=>p.id))
 const visible=(r:Row)=>JSON.parse(r.terms).allocations.every((a:Row)=>ids.has(a.propertyId))
 const billHistory=await all(c,'SELECT bill_id,terms FROM tt_bill_revisions'),templateHistory=await all(c,'SELECT template_id,terms FROM tt_bill_template_revisions')
 const bills=await Promise.all(rows.filter(r=>visible(r)&&billHistory.filter(h=>h.bill_id===r.id).every(visible)).map(async b=>{b.parsed=JSON.parse(b.terms);const a=await billAuthority(c,b);return {...b,authority:{...a,guards:undefined},attachments:await all(c,'SELECT id,name,type,sha256,version,original FROM tt_bill_attachments WHERE bill_id=? ORDER BY recorded_at',b.id),approvals:await all(c,'SELECT * FROM tt_bill_approvals WHERE bill_id=? ORDER BY version',b.id),revisions:await all(c,'SELECT * FROM tt_bill_revisions WHERE bill_id=? ORDER BY version',b.id),expenses:await all(c,'SELECT x.*,o.legal_name,p.name AS property FROM tt_bill_expenses x JOIN tt_owners o ON o.id=x.owner_id JOIN tt_properties p ON p.id=x.property_id WHERE x.bill_id=? AND x.version=?',b.id,b.version)}}))
 return {bills,templates:await Promise.all(templates.filter(r=>visible(r)&&templateHistory.filter(h=>h.template_id===r.id).every(visible)).map(async t=>({...t,parsed:JSON.parse(t.terms),approvals:await all(c,'SELECT * FROM tt_bill_template_approvals WHERE template_id=? ORDER BY version',t.id)}))),properties:permitted,vendors}
}
export async function ownerExpenses(c: Context,ownerId: string,propertyIds: string[],from: string,to: string) {
 if(!propertyIds.length)return []
 return all(c,`SELECT x.*,p.name AS property,b.invoice_number,v.name AS supplier FROM tt_bill_expenses x JOIN tt_bills b ON b.id=x.bill_id AND b.version=x.version AND b.state='payable' JOIN tt_properties p ON p.id=x.property_id JOIN tt_vendors v ON v.id=b.vendor_id WHERE x.owner_id=? AND x.day BETWEEN ? AND ? AND x.property_id IN (${propertyIds.map(()=>'?').join(',')}) ORDER BY x.day,b.invoice_number`,ownerId,from,to,...propertyIds)
}
