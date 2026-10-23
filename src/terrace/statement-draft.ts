// ACCT-012 foundation: a staff-only cash draft from authoritative, dated beneficiary postings.
import {all,type Context,type Row} from './core'
import {journalData} from './journal'
import {banks,reconciliation} from './reconcile-data'
export async function statementCash(c:Context,ownerId:string,from:string,to:string,reserves:Row[]){
 const ledger=await journalData(c,{ownerId,to}),groups=new Map<string,Row>(),cashAccounts=new Set(ledger.accounts.filter(a=>a.cash).map(a=>a.code)),liabilityAccounts=new Set(ledger.accounts.filter(a=>a.kind==='liability').map(a=>a.code))
 for(const j of ledger.entries){
  const k=j.property_id+':'+j.fund,g=groups.get(k)??{propertyId:j.property_id,property:ledger.properties.find(p=>p.id===j.property_id)?.name??'Unlinked historical property',fund:j.fund,openingCents:0,inflowCents:0,outflowCents:0,closingCents:0,liabilitiesCents:0,reserveCents:j.fund==='operating'?reserves.find(r=>r.propertyId===j.property_id&&r.to===to)?.ownerReserveCents??0:0,lines:[]}
  const cash=j.lines.filter((l:Row)=>cashAccounts.has(l.account)),debit=cash.reduce((n:number,l:Row)=>n+l.debit,0),credit=cash.reduce((n:number,l:Row)=>n+l.credit,0)
  g.closingCents+=debit-credit;g.liabilitiesCents+=j.lines.filter((l:Row)=>liabilityAccounts.has(l.account)).reduce((n:number,l:Row)=>n+l.credit-l.debit,0)
  if(j.day<from)g.openingCents+=debit-credit
  else{g.inflowCents+=debit;g.outflowCents+=credit;g.lines.push({id:j.id,day:j.day,sourceKind:j.source_kind,sourceId:j.source_id,reference:j.reference,cashCents:debit-credit,postings:j.lines})}
  groups.set(k,g)
 }
 const permitted=new Set((await banks(c)).map(b=>b.id)),maps=await all(c,'SELECT property_id,bank_id,fund FROM tt_trust_mappings'),statements=await all(c,'SELECT * FROM tt_reconcile_statements WHERE from_day=? AND to_day=?',from,to)
 const rows:Row[]=[]
 for(const g of groups.values()){
  const accounts=maps.filter(m=>m.property_id===g.propertyId&&m.fund===g.fund),bankChecks:Row[]=[]
  for(const m of accounts){if(!permitted.has(m.bank_id)){bankChecks.push({status:'unavailable in staff scope'});continue}const s=statements.find(s=>s.bank_id===m.bank_id),d=s?await reconciliation(c,s):null;bankChecks.push({bankId:m.bank_id,statementId:s?.id??null,status:d?.currentSignoff?'reconciled':'review required'})}
  if(!accounts.length)bankChecks.push({status:'no designated bank account'})
  rows.push({...g,availableBeforeDistributionCents:g.fund==='operating'?Math.max(0,g.closingCents-g.reserveCents-Math.max(0,g.liabilitiesCents)):0,bankChecks})
 }
 return{status:'draft',published:false,currency:'USD',rows,boundary:'Staff cash draft only. No scheduled delivery, portal publication, distribution approval or receipt attachment bundle. Deposits remain separate; cash movement follows posted journal sources, and reserve requirements are not expenses.'}
}
export function statementCashTable(d:Awaited<ReturnType<typeof statementCash>>):(string|number)[][]{
 const usd=(n:number)=>(n/100).toFixed(2)
 return[['Owner cash draft',d.boundary],['Property','Fund','Opening cash USD','Cash in USD','Cash out USD','Closing cash USD','Liabilities USD','Reserve requirement USD','Available before distribution USD','Bank review'],...d.rows.map(r=>[r.property,r.fund,usd(r.openingCents),usd(r.inflowCents),usd(r.outflowCents),usd(r.closingCents),usd(r.liabilitiesCents),usd(r.reserveCents),usd(r.availableBeforeDistributionCents),r.bankChecks.map((b:Row)=>b.status).join('; ')]),['Date','Property','Fund','Source kind','Source id','Reference','Cash movement USD'],...d.rows.flatMap(r=>r.lines.map((l:Row)=>[l.day,r.property,r.fund,l.sourceKind,l.sourceId,l.reference,usd(l.cashCents)]))]
}
