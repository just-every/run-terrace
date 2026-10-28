// Read-only continuing evidence for an owner-configured renewal workload. Every action remains human-operated.
import {all,one,tenancy,type Context,type Row} from './core'
import {renewalData,renewalRoster} from './renewals'
import {previewLease} from './charge-run'
import {renewalSourceState,sourceReader,SOURCE_REVIEW} from './renewal-sources'
export async function renewalStewardship(c:Context,w:Row,authorityCurrent:boolean){
 const args=JSON.parse(w.payload),campaign=(await renewalData(c,w.tenancy_id)).find((r:Row)=>r.id===args.renewalId) as Row|undefined
 if(!campaign)return {phase:'unavailable',sources:null,nextStep:'Owner reviews the unavailable renewal record',dueOn:w.due_at}
 const t=await tenancy(c,w.tenancy_id),reader=await sourceReader(c,w.credential_id)
 const sources=await renewalSourceState(reader??c,t,args.documentSources,args.sourceInstallation)
 const offer=campaign.offer,base={renewalId:campaign.id,campaignVersion:campaign.version,offerId:offer?.id??null,requiredSigners:offer?.payload.requiredSigners??[],events:campaign.events,dueOn:offer?.payload.deadline??w.due_at,sources}
 if(!authorityCurrent)return {...base,phase:'authority_changed',nextStep:'Owner reviews changed credential authority; no further execution is permitted'}
 if(sources?.stale)return {...base,phase:'sources_changed',nextStep:SOURCE_REVIEW}
 if(!w.result_subject)return {...base,phase:'preparation_pending',nextStep:'Owner reviews the queued preparation; only its assigned credential can prepare the offer'}
 if(campaign.state!=='executed'&&offer&&(offer.payload.householdRoster&&JSON.stringify(offer.payload.householdRoster)!==JSON.stringify(await renewalRoster(c,t.id))||offer.tenancy_version!==undefined&&offer.tenancy_version!==t.version))return {...base,phase:'sources_changed',nextStep:'Owner reviews changed lease or household sources and prepares a new offer'}
 if(campaign.state==='executed'){
  const v=await one(c,'SELECT * FROM tt_lease_versions WHERE id=? AND approved_at IS NOT NULL',campaign.lease_version_id)
  if(!v)return {...base,phase:'charge_mismatch',nextStep:'Owner reconciles missing executed lease evidence; do not post charges'}
  const payload=JSON.parse(v.payload),terms=await all(c,'SELECT * FROM tt_lease_terms WHERE tenancy_id=? AND superseded_by IS NULL ORDER BY id',t.id)
  const exact=t.end_date===payload.renewal.endDate&&t.rent_cents===payload.renewal.rentCents&&payload.terms.length===terms.filter(x=>x.lease_version_id===v.id).length&&payload.terms.every((p:Row)=>terms.some(x=>x.id===p.id&&x.lease_version_id===v.id&&x.kind===p.kind&&x.amount_cents===p.amountCents&&x.starts===p.starts&&x.ends===p.ends&&x.source_clause===p.sourceClause))
  const charges=await previewLease(c,t,terms,v.approval_month)
  const expectedTerms=payload.terms.map((p:Row)=>({id:p.id,tenancy_id:t.id,kind:p.kind,description:p.description,amount_cents:p.amountCents,currency:p.currency,starts:p.starts,ends:p.ends,version:1,source_clause:p.sourceClause,lease_version_id:v.id}))
  const expected=await previewLease(c,t,expectedTerms,v.approval_month)
  const [recorded,hap,concessions]=await Promise.all([all(c,'SELECT * FROM tt_charges WHERE tenancy_id=?',t.id),all(c,'SELECT * FROM tt_hap_charges WHERE tenancy_id=?',t.id),all(c,'SELECT a.*,q.reference AS rent_reference FROM tt_adjustments a JOIN tt_charges q ON q.id=a.charge_id WHERE q.tenancy_id=?',t.id)])
  const recordedMatch=charges.lines.filter((line:Row)=>line.posted).every((line:Row)=>line.kind==='concession'?concessions.some(a=>a.reference===line.reference&&a.rent_reference===line.rentReference&&a.amount_cents===line.amountCents&&a.currency===line.currency):(line.kind==='hap'?hap:recorded).some(q=>q.reference===line.reference&&q.amount_cents===line.amountCents&&q.currency===line.currency&&q.term_id===line.termId&&q.period_start===line.periodStart&&q.period_end===line.periodEnd&&q.due_date===line.dueDate))
  const matching=recordedMatch&&exact&&!charges.missing.length&&!expected.missing.length&&JSON.stringify(charges.lines)===JSON.stringify(expected.lines)
  const posted=matching&&charges.lines.length>0&&charges.lines.every((line:Row)=>line.posted)
  return {...base,phase:matching?(posted?'future_charges_recorded':'future_charges_ready'):'charge_mismatch',leaseId:v.id,signatureEvidence:'Staff-recorded roster completeness only; legal execution remains LEASE-011',futureCharges:charges,nextStep:posted?'Human monitors the recorded renewal charges; reconcile any later discrepancy before further action':matching?'Human reviews the verified future charge schedule and explicitly posts the ordinary run':'Owner reconciles changed future charges against the reviewed original; do not post charges'}
 }
 if(campaign.state==='accepted'){
  const versions=await all(c,'SELECT id,payload FROM tt_lease_versions WHERE renewal_id=? AND approved_at IS NULL ORDER BY prepared_at,id',campaign.id)
  const ready=versions.find(v=>{const p=JSON.parse(v.payload);return p.renewal?.proposalId===offer?.id&&(offer?.payload.requiredSigners??[]).every((name:string)=>p.signers.some((s:Row)=>s.name.toLocaleLowerCase('en-US')===name.toLocaleLowerCase('en-US')))})
  return {...base,phase:ready?'charge_review':'signatures_needed',leaseId:ready?.id??null,signatureEvidence:'Staff-recorded roster completeness only; legal execution remains LEASE-011',nextStep:ready?'Another person reviews and approves the signed original and exact future charges':'Human collects all required signatures and records the reviewed original; provider execution remains LEASE-011'}
 }
 return {...base,phase:offer?.state==='pending'?'approval_needed':campaign.state==='countered'?'counteroffer_review':'offer_follow_up',nextStep:campaign.nextAction}
}
