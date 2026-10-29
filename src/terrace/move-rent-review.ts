// PORT-006: compare recorded rent with current dated terms; a read never corrects money.
import {allow,insist,sha256,tenancy,type Context,type Row} from './core'
import {noCredential} from './credentials'
import {previewLease,terms} from './charge-run'
import {ledgerData} from './ledger'
import {localDate} from './zones'

const BOUNDARY='Recorded rent review only. Deposits, disposition, other obligations, settlement and a complete final account remain separate. No money, work or message is authorized.'
const monthNumber=(day:string)=>Number(day.slice(0,4))*12+Number(day.slice(5,7))-1
const monthName=(month:number)=>String(Math.floor(month/12)).padStart(4,'0')+'-'+String(month%12+1).padStart(2,'0')
async function sources(c:Context,value:unknown){
 const t=await tenancy(c,value)
 insist(!t.custody_retired_at,'custody_retired','This lease evidence is retired.',409)
 return {t,terms:await terms(c,t.id),ledger:await ledgerData(c,t.id)}
}
export async function moveRentReview(c:Context,value:unknown){
 allow(c,'reports.read');allow(c,'ledger.read');noCredential(c,'review move-out rent')
 const source=await sources(c,value),{t,ledger}=source,end=t.ended_on??t.end_date
 insist(end<=localDate(c.now,t.time_zone),'lease_active','Record the move-out before reviewing its rent account.',409)
 const expected:Row[]=[],holds:string[]=[]
 // Use the charge engine for monthly, weekly and fortnightly periods, including concessions.
 for(let month=monthNumber(t.start_date);month<=monthNumber(end);month++){
  const run=await previewLease(c,t,source.terms,monthName(month))
  expected.push(...run.lines)
  holds.push(...run.missing.map((m:Row)=>m.period.join(' to ')+': '+m.reason))
 }
 if(expected.some(l=>l.kind==='hap')||ledger.hapCharges.length||ledger.hapEffects.length)holds.push('Housing-authority portions require their separate payer reconciliation.')
 if(ledger.currency==='unconfirmed')holds.push('Confirm the recorded currency before reconciling rent.')
 const rows:Row[]=[],matched=new Set<string>()
 for(const line of expected.filter(l=>l.kind==='rent')){
  const charge=ledger.charges.find(q=>q.reference===line.reference)
  if(charge)matched.add(charge.id)
  const concessions=expected.filter(l=>l.kind==='concession'&&l.rentReference===line.reference)
  const expectedCents=line.amountCents-concessions.reduce((n,l)=>n+l.amountCents,0)
  const receipts=charge?ledger.receipts.filter(r=>r.charge_id===charge.id).sort((a,b)=>a.received_date.localeCompare(b.received_date)||a.id.localeCompare(b.id)):[]
  const adjustments=charge?ledger.adjustments.filter(a=>a.charge_id===charge.id).sort((a,b)=>a.at.localeCompare(b.at)||a.id.localeCompare(b.id)):[]
  const receiptCents=receipts.reduce((n,r)=>n+r.amount_cents,0),reductionCents=adjustments.reduce((n,a)=>n+a.amount_cents,0)
  const payerEffectCents=charge?charge.balance_cents+receiptCents-charge.amount_cents+reductionCents:0
  const recordedCents=(charge?.amount_cents??0)-reductionCents+payerEffectCents
  const differenceCents=recordedCents-expectedCents
  rows.push({reference:line.reference,termId:line.termId,sourceClause:line.sourceClause,leaseVersionId:line.leaseVersionId,periodStart:line.periodStart,periodEnd:line.periodEnd,coveredFrom:line.coveredFrom,coveredTo:line.coveredTo,coveredDays:line.coveredDays,periodDays:line.periodDays,expectedCents,chargeId:charge?.id??null,issuedCents:charge?.amount_cents??0,reductionCents,payerEffectCents,receiptCents,recordedCents,differenceCents,receivableCents:recordedCents-receiptCents,receipts,adjustments,concessions,status:!charge?'unposted':differenceCents!==0?'difference':charge.reserved_cents?'pending_payment':'matched'})
 }
 // Never offset unexplained records or differences against a different period or lease.
 const otherCharges=ledger.charges.filter(q=>!matched.has(q.id)).sort((a,b)=>a.due_date.localeCompare(b.due_date)||a.id.localeCompare(b.id))
 for(const q of otherCharges)holds.push(q.reference+': charge outside this current rent comparison requires separate review.')
 for(const r of rows.filter(r=>r.status!=='matched'))holds.push(r.reference+': '+r.status.replace('_',' '))
 const current=await sources(c,t.id)
 insist(JSON.stringify(current)===JSON.stringify(source),'review_changed','The lease or rent records changed while preparing this review. Download it again.',409)
 const report={tenancyId:t.id,transferredFrom:t.transferred_from,moveOut:end,currency:ledger.currency,rows,otherCharges,holds,rentMatched:holds.length===0,recordedReceivableCents:ledger.balanceCents,housingAuthorityReceivableCents:ledger.hapBalanceCents,boundary:BOUNDARY}
 const fingerprint=await sha256(new TextEncoder().encode(JSON.stringify(report)))
 return {...report,generatedAt:c.now,fingerprint}
}
export function moveRentTable(review:Awaited<ReturnType<typeof moveRentReview>>){
 const amount=(n:number)=>(n/100).toFixed(2)
 return [
  ['Move-out recorded rent review',review.tenancyId],['Move-out',review.moveOut],['Currency',review.currency],['Generated at',review.generatedAt],['Source fingerprint',review.fingerprint],['Rent comparison',review.rentMatched?'Matched':'Review required'],
  ['Period start','Period end','Covered from','Covered to','Covered days','Period days','Term','Signed version','Source clause','Reference','Charge','Expected rent','Issued','Reductions','Payer corrections','Recorded net','Receipts','Receivable','Difference','Status'],
  ...review.rows.map(r=>[r.periodStart,r.periodEnd,r.coveredFrom,r.coveredTo,r.coveredDays,r.periodDays,r.termId,r.leaseVersionId??'',r.sourceClause??'',r.reference,r.chargeId??'',amount(r.expectedCents),amount(r.issuedCents),amount(r.reductionCents),amount(r.payerEffectCents),amount(r.recordedCents),amount(r.receiptCents),amount(r.receivableCents),amount(r.differenceCents),r.status]),
  ['Kind','Charge','Source','Recorded date','Amount'],
  ...review.rows.flatMap(r=>[...r.receipts.map((p:Row)=>['Recorded external receipt',r.chargeId,p.reference,p.received_date,amount(p.amount_cents)]),...r.adjustments.map((a:Row)=>['Recorded reduction',r.chargeId,a.reason,a.posting_day??a.at,amount(a.amount_cents)])]),
  ...review.otherCharges.map(q=>['Other obligation; separate review',q.id,q.reference,q.due_date,amount(q.balance_cents)]),
  ['Recorded lease receivable',amount(review.recordedReceivableCents)],['Housing-authority receivable; separate reconciliation',amount(review.housingAuthorityReceivableCents)],
  ...review.holds.map(h=>['Open review',h]),[review.boundary],
 ]
}
