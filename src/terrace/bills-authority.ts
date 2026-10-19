import { all, guard, id, insist, one, sql, type Context, type Row } from './core'
import { agreementOn, fee, ownershipData, sharesOn, split } from './owners'
import { independence } from './dual-control'
/** Evaluate each property separately; the whole shared bill is private to staff reaching every allocation. */
export async function billAuthority(c: Context, b: Row) {
 const terms=b.parsed, data=await ownershipData(c), reasons:string[]=[], blockers:string[]=[], properties:Row[]=[],guards:D1PreparedStatement[]=[]
 const count=(await one<{n:number}>(c,'SELECT COUNT(*) AS n FROM tt_bill_expenses'))!.n
 guards.push(guard(c,'(SELECT COUNT(*) FROM tt_bill_expenses)=?',count))
 for(const a of terms.allocations) {
  const d=data.byProperty[a.propertyId], set=sharesOn(d,terms.day), agreement=agreementOn(d,terms.day)
  const prop=await one(c,'SELECT name FROM tt_properties WHERE id=?',a.propertyId),limit=await one(c,'SELECT * FROM tt_work_limits WHERE scope=?','property:'+a.propertyId)
  if(!set) blockers.push(`${prop!.name}: no ownership share set on invoice date`)
  if(!agreement) blockers.push(`${prop!.name}: no management agreement on invoice date`)
  guards.push(guard(c,'COALESCE((SELECT id FROM tt_ownership_sets WHERE property_id=? AND effective_from<=? ORDER BY effective_from DESC LIMIT 1),\'\')=?',a.propertyId,terms.day,set?.id??''),guard(c,'COALESCE((SELECT id FROM tt_management_agreements WHERE property_id=? AND starts<=? ORDER BY starts DESC LIMIT 1),\'\')=?',a.propertyId,terms.day,agreement?.id??''))
  const jobs=await all(c,"SELECT j.id,j.version,j.estimate_cents FROM tt_maintenance_jobs j JOIN tt_tenancies t ON t.id=j.tenancy_id JOIN tt_units u ON u.id=t.unit_id WHERE u.property_id=? AND j.state IN ('approved','sent') AND substr(j.due_date,1,4)=?",a.propertyId,terms.day.slice(0,4))
  // Existing work estimates already reserve the linked work's cost; unpaid bills add only costs not covered by a work order.
  const bills=await all(c,"SELECT r.terms FROM tt_bills b JOIN tt_bill_revisions r ON r.bill_id=b.id AND r.version=b.version WHERE b.state='payable' AND b.id<>? AND substr(b.day,1,4)=?",b.id,terms.day.slice(0,4))
  const prior=bills.flatMap(r=>JSON.parse(r.terms).allocations).filter((x:Row)=>x.propertyId===a.propertyId)
  const actual=new Map<string,number>()
  for(const x of prior.filter((x:Row)=>x.jobId))actual.set(x.jobId,(actual.get(x.jobId)??0)+x.amountCents)
  const reservations=new Map<string,number>(jobs.map(j=>[j.id,j.estimate_cents]))
  for(const [key,amount] of actual)reservations.set(key,Math.max(reservations.get(key)??0,amount))
  const spent=prior.filter((x:Row)=>!x.jobId).reduce((n:number,x:Row)=>n+x.amountCents,0)+[...reservations.values()].reduce((n,x)=>n+x,0)
  const projected=a.jobId?spent-(reservations.get(a.jobId)??0)+Math.max(reservations.get(a.jobId)??0,(actual.get(a.jobId)??0)+a.amountCents):spent+a.amountCents
  if(limit) {
   guards.push(guard(c,'EXISTS(SELECT 1 FROM tt_work_limits WHERE scope=? AND version=?)',limit.scope,limit.version))
   if(limit.currency!=='USD') blockers.push(`${prop!.name}: spending authority is not recorded in USD`)
   if(limit.quotes_needed && a.amountCents>limit.quotes_above_cents && !a.jobId) blockers.push(`${prop!.name}: link approved work with the owner’s required quotes`)
   if(a.amountCents>limit.limit_cents) reasons.push(`${prop!.name}: above owner's per-job limit`)
   if(limit.budget_cents && projected>limit.budget_cents) reasons.push(`${prop!.name}: above ${terms.day.slice(0,4)} maintenance budget`)
  } else guards.push(guard(c,'NOT EXISTS(SELECT 1 FROM tt_work_limits WHERE scope=?)','property:'+a.propertyId))
  if(a.jobId) {
   const j=await one(c,'SELECT j.*,u.property_id FROM tt_maintenance_jobs j JOIN tt_tenancies t ON t.id=j.tenancy_id JOIN tt_units u ON u.id=t.unit_id WHERE j.id=?',a.jobId)
   if(!j) { blockers.push(`${prop!.name}: linked work evidence has been retired`); properties.push({...a,name:prop!.name,set,agreement,spentCents:spent,projectedCents:projected}); continue }
   insist(j.property_id===a.propertyId,'not_found','Work order not found for this property.',404)
   if(!['approved','sent'].includes(j.state)) blockers.push(`${prop!.name}: linked work is awaiting approval`)
   if(j.vendor_id!==terms.vendorId) blockers.push(`${prop!.name}: supplier differs from the approved work`)
   if(j.currency!=='USD') blockers.push(`${prop!.name}: linked work currency differs`)
   if(a.amountCents>j.estimate_cents) reasons.push(`${prop!.name}: invoice exceeds approved work amount`)
   guards.push(guard(c,'EXISTS(SELECT 1 FROM tt_maintenance_jobs WHERE id=? AND version=? AND state=?)',j.id,j.version,j.state))
   const others=await all(c,"SELECT r.terms FROM tt_bills b JOIN tt_bill_revisions r ON r.bill_id=b.id AND r.version=b.version WHERE b.state='payable' AND b.id<>?",b.id)
   const prior=others.reduce((n,r)=>n+JSON.parse(r.terms).allocations.filter((x:Row)=>x.jobId===a.jobId).reduce((s:number,x:Row)=>s+x.amountCents,0),0)
   if(prior+a.amountCents>j.estimate_cents) reasons.push(`${prop!.name}: cumulative invoices exceed approved work amount`)
  }
  // A concurrent work approval changes the exact budget basis and must trigger a fresh review.
  guards.push(guard(c,"(SELECT COALESCE(SUM(j.version),0) FROM tt_maintenance_jobs j JOIN tt_tenancies t ON t.id=j.tenancy_id JOIN tt_units u ON u.id=t.unit_id WHERE u.property_id=? AND j.state IN ('approved','sent') AND substr(j.due_date,1,4)=?)=?",a.propertyId,terms.day.slice(0,4),jobs.reduce((s,j)=>s+j.version,0)))
  guards.push(guard(c,"(SELECT COUNT(*) FROM tt_maintenance_jobs j JOIN tt_tenancies t ON t.id=j.tenancy_id JOIN tt_units u ON u.id=t.unit_id WHERE u.property_id=? AND j.state IN ('approved','sent') AND substr(j.due_date,1,4)=?)=?",a.propertyId,terms.day.slice(0,4),jobs.length),...jobs.map(j=>guard(c,"EXISTS(SELECT 1 FROM tt_maintenance_jobs WHERE id=? AND version=? AND state IN ('approved','sent'))",j.id,j.version)))
  properties.push({...a,name:prop!.name,set,agreement,spentCents:spent,projectedCents:projected})
 }
 const decision=await one(c,'SELECT * FROM tt_bill_decisions WHERE bill_id=? AND version=? AND sha256=?',b.id,b.version,b.sha256)
 return {reasons,blockers,needsOwner:reasons.length>0,decision,properties,guards}
}
export async function approval(c: Context,b: Row) {
 insist(b.state==='pending','bill_state','This revision is already a payable.',409)
 const a=await billAuthority(c,b)
 insist(!a.blockers.length,'bill_held',a.blockers.join('; '),409)
 insist(!a.needsOwner || a.decision?.decision==='approved','owner_approval_required','Held for the owner’s decision on these exact terms: '+a.reasons.join('; '),409)
 const independent=await independence(c,'bill.approve',[b.prepared_by,b.revised_by]),writes:D1PreparedStatement[]=[]
 for(const p of a.properties) for(const s of split(p.amountCents,p.set.shares)) {
  writes.push(sql(c,'INSERT INTO tt_bill_expenses(id,bill_id,version,property_id,owner_id,share_set_id,agreement_id,day,share_bp,property_cents,amount_cents) VALUES(?,?,?,?,?,?,?,?,?,?,?)',id(),b.id,b.version,p.propertyId,s.ownerId,p.set.id,p.agreement.id,b.day,s.bp,p.amountCents,s.cents))
  const amount=fee(s.cents,p.agreement.markup_bp)
  if(amount) writes.push(sql(c,'INSERT INTO tt_fees(id,property_id,owner_id,month,day,kind,source,source_label,base_cents,rate_bp,amount_cents,tax_bp,tax_cents,agreement_id,run_id,created_by,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',id(),p.propertyId,s.ownerId,b.day.slice(0,7),b.day,'markup',`bill:${b.id}:v${b.version}`,`${b.parsed.supplier} invoice ${b.invoice_number}`,s.cents,p.agreement.markup_bp,amount,p.agreement.fee_tax_bp,fee(amount,p.agreement.fee_tax_bp),p.agreement.id,b.id,c.actor.id,c.now))
 }
 const snapshot={terms:b.parsed,sha256:b.sha256,decision:a.decision,authority:a.properties.map(({set,agreement,...p})=>({...p,shareSetId:set.id,agreementId:agreement.id,agreementReference:agreement.reference})),label:independent.label}
 writes.push(sql(c,'INSERT INTO tt_bill_approvals(id,bill_id,version,sha256,snapshot,approved_by,approved_at,label) VALUES(?,?,?,?,?,?,?,?)',id(),b.id,b.version,b.sha256,JSON.stringify(snapshot),c.actor.id,c.now,independent.label),sql(c,"UPDATE tt_bills SET state='payable' WHERE id=?",b.id))
 return {guards:[...a.guards,...independent.guards],writes}
}
