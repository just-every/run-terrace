import { all, audit, cents, commit, date, email, guard, id, insist, manager, one, sha256, sql, tenancy, text, type Context, type Row } from './core'

export async function tenancyCommand(c: Context, command: string, p: Row): Promise<Row | undefined> {
 if (command === 'tenancy.create') {
  manager(c)
  const key = id(), start = date(p.startDate,'Lease start'), end = date(p.endDate,'Lease end')
  insist(end >= start,'lease_dates','Lease end must follow its start.')
  insist(['weekly','fortnightly','monthly'].includes(p.cadence),'cadence','Choose a rent cadence.')
  const tenantEmail=email(p.tenantEmail)
  await commit(c,[
   guard(c,'NOT EXISTS(SELECT 1 FROM tt_erasures WHERE subject=?)',await sha256(new TextEncoder().encode(tenantEmail))),
   sql(c,'INSERT INTO tt_tenancies(id,address,owner_name,owner_email,tenant_name,tenant_email,start_date,end_date,rent_cents,cadence,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)',key,text(p.address,'Property address',300),text(p.ownerName,'Owner name',150),email(p.ownerEmail),text(p.tenantName,'Tenant name',150),tenantEmail,start,end,cents(p.rent),p.cadence,c.now)
  ],command,key)
  return {id:key}
 }
 if (command === 'renewal.prepare' || command === 'arrears.prepare') {
  const t=await tenancy(c,p.tenancyId), key=id()
  let payload:Row
  if(command==='renewal.prepare') {
   const end=date(p.endDate,'Proposed lease end'); insist(end>t.end_date,'renewal_date','The proposed end must be later than the current lease end.')
   payload={endDate:end,rentCents:cents(p.rent),source:text(p.source,'Lease reference / reason',1000)}
  } else {
   payload={message:text(p.message,'Follow-up message',3000),followUpDate:date(p.followUpDate,'Follow-up date')}
  }
  await commit(c,[sql(c,'INSERT INTO tt_proposals(id,tenancy_id,kind,payload,tenancy_version,prepared_by,prepared_at) VALUES(?,?,?,?,?,?,?)',key,t.id,command.split('.')[0],JSON.stringify(payload),t.version,c.actor.id,c.now)],command,key)
  return {id:key,state:'pending'}
 }
 if(command==='proposal.approve' || command==='proposal.reject') {
  manager(c)
  const r=await one(c,'SELECT * FROM tt_proposals WHERE id=?',text(p.proposalId,'Proposal',100))
  insist(r && ['renewal','arrears'].includes(r.kind),'not_found','Proposal not found.',404)
  insist(r.state==='pending','proposal_state','This proposal has already been decided.',409)
  const t=await tenancy(c,r.tenancy_id), payload=JSON.parse(r.payload), approved=command==='proposal.approve'
  // Adapted from Locket obligations.ts confirmTermsWrites: a proposal names the
  // exact term revision; confirmation preserves its source and superseded terms.
  const writes=[guard(c,"EXISTS(SELECT 1 FROM tt_proposals WHERE id=? AND state='pending')",r.id),guard(c,'EXISTS(SELECT 1 FROM tt_tenancies WHERE id=? AND version=?)',t.id,r.tenancy_version),sql(c,'UPDATE tt_proposals SET state=?,approved_by=?,approved_at=? WHERE id=?',approved?'approved':'rejected',c.actor.id,c.now,r.id)]
  if(approved && r.kind==='renewal') {
   writes.push(sql(c,'INSERT INTO tt_lease_history(id,tenancy_id,start_date,end_date,rent_cents,proposal_id,confirmed_by,confirmed_at) VALUES(?,?,?,?,?,?,?,?)',id(),t.id,t.start_date,t.end_date,t.rent_cents,r.id,c.actor.id,c.now),sql(c,'UPDATE tt_tenancies SET end_date=?,rent_cents=?,version=version+1 WHERE id=?',payload.endDate,payload.rentCents,t.id))
  }
  await commit(c,writes,command,r.id)
  return {id:r.id,state:approved?'approved':'rejected'}
 }
}
export const tenancyData = (c:Context) => all(c,'SELECT * FROM tt_tenancies ORDER BY address,tenant_name')
export const proposals = (c:Context,tenancyId:string) => all(c,"SELECT * FROM tt_proposals WHERE tenancy_id=? AND kind IN ('renewal','arrears') ORDER BY prepared_at DESC",tenancyId)
