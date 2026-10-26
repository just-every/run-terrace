import { independence } from './dual-control'
import { all, audit, cents, commit, date, email, guard, id, insist, allow, one, sha256, sql, tenancy, text, reaches, everywhere, type Context, type Row } from './core'
import { officeZone } from './company'
import { usZone } from './zones'
import { freeUnit, unitAddress, unitFor } from './properties'
import { offerInput, renewalItem } from './renewals'

export async function tenancyCommand(c: Context, command: string, p: Row): Promise<Row | undefined> {
 if (command === 'tenancy.create') {
  allow(c, command)
  const key = id(), start = date(p.startDate,'Lease start'), end = date(p.endDate,'Lease end')
  insist(end >= start,'lease_dates','Lease end must follow its start.')
  insist(['weekly','fortnightly','monthly'].includes(p.cadence),'cadence','Choose a rent cadence.')
  const tenantEmail=email(p.tenantEmail)
  // PORT-001: a new tenancy is USD. PORT-002: on a unit it takes the unit's address and its property's zone;
  // otherwise the given address and zone (default the office zone).
  const unit=p.unitId?await unitFor(c,p.unitId):null
  if(!unit)everywhere(c)
  const zone=unit?unit.time_zone:usZone(p.timeZone??await officeZone(c))
  await commit(c,[
   guard(c,'NOT EXISTS(SELECT 1 FROM tt_erasures WHERE subject=?)',await sha256(new TextEncoder().encode(tenantEmail))),
   ...(unit?[freeUnit(c,unit.id,start,end)]:[]),
   sql(c,"INSERT INTO tt_tenancies(id,address,owner_name,owner_email,tenant_name,tenant_email,start_date,end_date,rent_cents,cadence,created_at,currency,time_zone,unit_id) VALUES(?,?,?,?,?,?,?,?,?,?,?,'USD',?,?)",key,unit?unitAddress(unit):text(p.address,'Property address',300),text(p.ownerName,'Owner name',150),email(p.ownerEmail),text(p.tenantName,'Tenant name',150),tenantEmail,start,end,cents(p.rent),p.cadence,c.now,zone,unit?.id??null)
  ],command,key)
  return {id:key}
 }
 if (command === 'renewal.prepare' || command === 'arrears.prepare') {
  const t=await tenancy(c,p.tenancyId), key=id()
  let payload:Row
  if(command==='renewal.prepare') {
   // LEASE-012: a scheduled campaign item takes its offer, comparison and recipients; TER-003's direct recorded terms stay for leases without one.
   if(p.renewalId)payload=await offerInput(c,t,p)
   else {
    insist(!await one(c,"SELECT 1 FROM tt_renewals WHERE tenancy_id=? AND lease_end=? AND state<>'executed'",t.id,t.end_date),'renewal_campaign','This lease end has scheduled renewal work. Prepare the offer from its renewal.',409)
    const end=date(p.endDate,'Proposed lease end'); insist(end>t.end_date,'renewal_date','The proposed end must be later than the current lease end.')
    payload={endDate:end,rentCents:cents(p.rent),source:text(p.source,'Lease reference / reason',1000)}
   }
  } else {
   payload={message:text(p.message,'Follow-up message',3000),followUpDate:date(p.followUpDate,'Follow-up date')}
  }
  const campaign=payload.renewalId?(await renewalItem(c,payload.renewalId)).r:null
  const sequence=campaign?Number((await one(c,"SELECT COALESCE(MAX(renewal_sequence),0)+1 AS n FROM tt_proposals WHERE json_extract(payload,'$.renewalId')=?",campaign.id))!.n):null
  await commit(c,[...(campaign?[guard(c,'EXISTS(SELECT 1 FROM tt_renewals WHERE id=? AND version=?)',campaign.id,payload.renewalVersion),guard(c,'EXISTS(SELECT 1 FROM tt_tenancies WHERE id=? AND version=?)',t.id,t.version)]:[]),sql(c,'INSERT INTO tt_proposals(id,tenancy_id,kind,payload,tenancy_version,prepared_by,prepared_at,renewal_sequence) VALUES(?,?,?,?,?,?,?,?)',key,t.id,command.split('.')[0],JSON.stringify(payload),t.version,c.actor.id,c.now,sequence)],command,key)
  return {id:key,state:'pending'}
 }
 if(command==='proposal.approve' || command==='proposal.reject') {
  allow(c, command)
  const r=await one(c,'SELECT * FROM tt_proposals WHERE id=?',text(p.proposalId,'Proposal',100))
  insist(r && ['renewal','arrears'].includes(r.kind),'not_found','Proposal not found.',404)
  insist(r.state==='pending','proposal_state','This proposal has already been decided.',409)
  const t=await tenancy(c,r.tenancy_id), payload=JSON.parse(r.payload), approved=command==='proposal.approve', solo=approved?await independence(c,command,[r.prepared_by]):{label:null,guards:[]}
  // Adapted from Locket obligations.ts confirmTermsWrites: a proposal names the
  // exact term revision; confirmation preserves its source and superseded terms.
  const writes=[guard(c,"EXISTS(SELECT 1 FROM tt_proposals WHERE id=? AND state='pending')",r.id),guard(c,'EXISTS(SELECT 1 FROM tt_tenancies WHERE id=? AND version=?)',t.id,r.tenancy_version),...solo.guards,sql(c,'UPDATE tt_proposals SET state=?,approved_by=?,approved_at=?,approval_label=? WHERE id=?',approved?'approved':'rejected',c.actor.id,c.now,solo.label,r.id)]
  // LEASE-012: approving a campaign offer approves its exact terms, recipients and deadline for sending; the signed renewal activates later.
  if(payload.renewalId){
   const {r:campaign}=await renewalItem(c,payload.renewalId)
   writes.push(guard(c,"EXISTS(SELECT 1 FROM tt_renewals WHERE id=? AND version=? AND state IN ('open','countered') AND lease_end=?)",campaign.id,campaign.version,t.end_date))
   if(approved)writes.push(sql(c,"UPDATE tt_renewals SET state='open',version=version+1 WHERE id=?",campaign.id))
  }
  if(approved && r.kind==='renewal' && !payload.renewalId) {
   writes.push(sql(c,'INSERT INTO tt_lease_history(id,tenancy_id,start_date,end_date,rent_cents,proposal_id,confirmed_by,confirmed_at,currency) VALUES(?,?,?,?,?,?,?,?,?)',id(),t.id,t.start_date,t.end_date,t.rent_cents,r.id,c.actor.id,c.now,t.currency),sql(c,'UPDATE tt_tenancies SET end_date=?,rent_cents=?,version=version+1 WHERE id=?',payload.endDate,payload.rentCents,t.id))
  }
  await commit(c,writes,command,r.id)
  return {id:r.id,state:approved?'approved':'rejected'}
 }
}
export const tenancyData = (c:Context) => all(c,'SELECT * FROM tt_tenancies WHERE erased_at IS NULL ORDER BY address,tenant_name').then(rows=>rows.filter(t=>reaches(c,t.unit_id)))
export const proposals = (c:Context,tenancyId:string) => all(c,"SELECT p.*,COALESCE(a.display_name,p.prepared_by) AS prepared_name,COALESCE(b.display_name,p.approved_by) AS approved_name FROM tt_proposals p LEFT JOIN oa_operators a ON a.id=p.prepared_by LEFT JOIN oa_operators b ON b.id=p.approved_by WHERE p.tenancy_id=? AND p.kind IN ('renewal','arrears') ORDER BY p.prepared_at DESC",tenancyId)
