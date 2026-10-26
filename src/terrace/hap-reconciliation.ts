import {all,allow,date,insist,tenancy,type Context,type Row} from './core'
import {effectiveCharges,hapEffects} from './hap-balances'
import {hapRemittanceData} from './hap-remittances'
import {ageReceivables} from './delinquency-math'
import {localDate} from './zones'

export async function phaReceipts(c:Context,tenancyId:string){return all(c,"SELECT a.id,a.charge_id,a.amount_cents,r.outcome_date AS received_date,r.currency,r.reference,a.remittance_id FROM tt_hap_allocations a JOIN tt_hap_remittances r ON r.id=a.remittance_id JOIN tt_hap_charges q ON q.id=a.charge_id WHERE q.tenancy_id=? AND r.state='received'",tenancyId)}
export async function hapReconciliation(c:Context,tenancyId:string,on?:string){
 allow(c,'ledger.read');const t=await tenancy(c,tenancyId),asOf=on?date(on):localDate(c.now,t.time_zone)
 insist(asOf<=localDate(c.now,t.time_zone),'invalid_as_of','Use an elapsed property-local date.')
 const [charges,haps,receipts,adjustments,effects,phaPaid,journal,remittances]=await Promise.all([
  all(c,'SELECT * FROM tt_charges WHERE tenancy_id=?',t.id),all(c,'SELECT * FROM tt_hap_charges WHERE tenancy_id=?',t.id),
  all(c,'SELECT r.* FROM tt_net_receipts r JOIN tt_charges q ON q.id=r.charge_id WHERE q.tenancy_id=?',t.id),
  all(c,'SELECT a.* FROM tt_adjustments a JOIN tt_charges q ON q.id=a.charge_id WHERE q.tenancy_id=?',t.id),hapEffects(c,t.id),phaReceipts(c,t.id),
  all(c,'SELECT * FROM tt_journal WHERE tenancy_id=? AND day<=? ORDER BY day,id',t.id,asOf),hapRemittanceData(c,t.id)
 ])
 const resident=ageReceivables(t,effectiveCharges(charges,effects,asOf,'resident'),receipts,adjustments,asOf),pha=ageReceivables(t,effectiveCharges(haps,effects,asOf,'pha'),phaPaid,[],asOf)
 const owners:Row[]=[]
 for(const j of journal){let owner=owners.find(o=>o.ownerId===j.owner_key);if(!owner){owner={ownerId:j.owner_key,receivableCents:0,externalCashCents:0,incomeCents:0,sources:[]};owners.push(owner)}
  for(const l of JSON.parse(j.lines)){const net=l.debit-l.credit;if(l.account==='receivable')owner.receivableCents+=net;if(l.account==='cash')owner.externalCashCents+=net;if(l.account==='lease_income')owner.incomeCents-=net}
  owner.sources.push({id:j.id,kind:j.source_kind,sourceId:j.source_id,day:j.day})
 }
 const residentNetCents=resident.balanceCents-resident.creditCents,phaNetCents=pha.balanceCents-pha.creditCents,ownerNetCents=owners.reduce((n,o)=>n+o.receivableCents,0)
 return {tenancyId:t.id,asOf,currency:t.currency,resident,pha,residentNetCents,phaNetCents,owners,ownerNetCents,differenceCents:ownerNetCents-residentNetCents-phaNetCents,effects,remittances:remittances.remittances,
  boundary:'Recorded external receipts are documentary evidence, never verified bank settlement. Pending allocations do not reduce receivables. Held remainder has no owner allocation or automatic use. Payer credits remain separate; no refund or transfer is authorized.'}
}
export function hapReconciliationTable(r:Awaited<ReturnType<typeof hapReconciliation>>){
 return [['Payer reconciliation',r.tenancyId,r.asOf,r.currency],['Payer','Unpaid','Credit','Net'],['Resident',r.resident.balanceCents,r.resident.creditCents,r.residentNetCents],['Housing authority',r.pha.balanceCents,r.pha.creditCents,r.phaNetCents],['Owner','Receivable','Recorded external cash','Income'],...r.owners.map(o=>[o.ownerId,o.receivableCents,o.externalCashCents,o.incomeCents]),['Reconciliation difference',r.differenceCents],['Correction','Effective from','Effective to','Approval posting day','Resident delta','PHA delta','Notice'],...r.effects.map(e=>[e.id,e.effective_from,e.effective_to,e.posting_day,e.resident_delta,e.pha_delta,e.notice_version_id]),['Remittance','Outcome','Amount','Held remainder'],...r.remittances.map(x=>[x.id,x.state,x.amount_cents,x.held_cents]),[r.boundary]]
}
