import {all,date,insist,recordRead,type Context,type Row} from './core'
import {journalData} from './journal'
import {DEFAULT_ZONE,localDate} from './zones'

/** Read-only basis projection. Timing lines retain the exact source posting that creates or settles them. */
export async function financialReport(c:Context,q:Row){
 const from=date(q.from,'From'),to=date(q.to,'Through'),basis=String(q.basis||'accrual')
 insist(from<=to,'invalid_period','From must precede through.')
 insist(['cash','accrual'].includes(basis),'invalid_basis','Choose cash or accrual.')
 const data=await journalData(c,{propertyId:q.propertyId,ownerId:q.ownerId,to})
 insist(!q.ownerId||data.owners.some(o=>o.id===q.ownerId),'not_found','Owner not found.',404)
 const mappings=await all(c,'SELECT DISTINCT m.property_id,a.entity_id,e.legal_name FROM tt_trust_mappings m JOIN tt_operating_accounts a ON a.id=m.bank_id JOIN tt_entities e ON e.id=a.entity_id')
 const visible=new Set(data.properties.map(p=>p.id)),entities=mappings.filter(m=>visible.has(m.property_id))
 insist(!q.entityId||q.entityId==='unassigned'||entities.some(e=>e.entity_id===q.entityId),'not_found','Entity not found.',404)
 const entries=data.entries.filter(j=>!q.entityId||(q.entityId==='unassigned'?!mappings.some(m=>m.property_id===j.property_id):mappings.some(m=>m.property_id===j.property_id&&m.entity_id===q.entityId)))
 const properties=await all(c,'SELECT id,time_zone FROM tt_properties')
 for(const p of data.properties.filter(p=>!q.propertyId||p.id===q.propertyId))insist(to<=localDate(c.now,properties.find(x=>x.id===p.id)!.time_zone),'future_report','Through cannot be after property-local today.')
 insist(!entries.some(j=>!j.property_id)||to<=localDate(c.now,c.zone||DEFAULT_ZONE),'future_report','Through cannot be after today.')
 const chart=[...data.accounts,{code:'basis:receivable',name:'Uncollected income timing',kind:'income',cash:0},{code:'basis:payable',name:'Unpaid expense timing',kind:'expense',cash:0}]
 const byCode=new Map(chart.map(a=>[a.code,a]))
 // A tax charge's receivable belongs to the tax liability rather than income, including its receipts and reversals.
 const taxes=await all(c,`SELECT q.id FROM tt_charges q WHERE q.tax_rule_id IS NOT NULL`)
 const taxIds=new Set(taxes.map(t=>t.id))
 const [receipts,reversals,refunds,reductions]=await Promise.all([all(c,'SELECT id,charge_id FROM tt_receipts'),all(c,'SELECT id,receipt_id FROM tt_receipt_reversals'),all(c,'SELECT id,receipt_id FROM tt_financial_recordings WHERE receipt_id IS NOT NULL'),all(c,'SELECT id,charge_id FROM tt_adjustments')])
 const receiptCharge=new Map(receipts.map(r=>[r.id,r.charge_id])),reverseReceipt=new Map(reversals.map(r=>[r.id,r.receipt_id])),refundReceipt=new Map(refunds.map(r=>[r.id,r.receipt_id])),reductionCharge=new Map(reductions.map(r=>[r.id,r.charge_id]))
 const taxEntry=(j:Row)=>taxIds.has(j.source_kind==='charge'?j.source_id:j.source_kind==='reduction'?reductionCharge.get(j.source_id):receiptCharge.get(j.source_kind==='refund'?refundReceipt.get(j.source_id):j.source_kind==='receipt_reversal'?reverseReceipt.get(j.source_id):j.source_id))
 const opening=(j:Row)=>j.source_kind==='opening'||j.reversal_of&&entries.some(e=>e.id===j.reversal_of&&e.source_kind==='opening')
 const project=(j:Row)=>j.lines.map((l:Row)=>({...l,account:basis==='cash'&&l.account==='receivable'?(opening(j)?'opening_equity':taxEntry(j)?'tax_payable':'basis:receivable'):basis==='cash'&&['payable','fee_payable'].includes(l.account)?(opening(j)?'opening_equity':'basis:payable'):l.account}))
 const line=(j:Row,l:Row)=>({entryId:j.id,sourceKind:j.source_kind,sourceId:j.source_id,reference:j.reference,day:j.day,propertyId:j.property_id,ownerId:j.owner_key,tenancyId:j.tenancy_id,vendorId:j.vendor_id,...l})
 const projected=entries.flatMap(j=>project(j).map((l:Row)=>line(j,l))),period=projected.filter(l=>l.day>=from)
 const rows=(kinds:string[],list:Row[])=>chart.filter(a=>kinds.includes(a.kind)).map(a=>{const sources=list.filter(l=>l.account===a.code);return{code:a.code,name:a.name,kind:a.kind,amountCents:sources.reduce((n,l)=>n+(['asset','expense'].includes(a.kind)?l.debit-l.credit:l.credit-l.debit),0),sources}}).filter(a=>a.sources.length)
 const income=rows(['income'],period),expenses=rows(['expense'],period),assets=rows(['asset'],projected),liabilities=rows(['liability'],projected),equity=rows(['equity'],projected)
 const sum=(xs:Row[])=>xs.reduce((n,r)=>n+r.amountCents,0),allIncome=rows(['income'],projected),allExpenses=rows(['expense'],projected)
 const incomeStatement={income,expenses,incomeCents:sum(income),expenseCents:sum(expenses),netCents:sum(income)-sum(expenses)}
 const balanceSheet={assets,liabilities,equity,assetsCents:sum(assets),liabilitiesCents:sum(liabilities),equityCents:sum(equity),retainedEarningsCents:sum(allIncome)-sum(allExpenses),retainedEarnings:{name:'Retained earnings',amountCents:sum(allIncome)-sum(allExpenses),sources:[...allIncome,...allExpenses].flatMap(r=>r.sources)}}
 const raw=entries.flatMap(j=>j.lines.map((l:Row)=>line(j,l))),rawPeriod=raw.filter(l=>l.day>=from)
 const trialBalance=data.accounts.map(a=>{const sources=rawPeriod.filter(l=>l.account===a.code);return{...a,debitCents:sources.reduce((n,l)=>n+l.debit,0),creditCents:sources.reduce((n,l)=>n+l.credit,0),sources}})
 const aging=(accounts:string[])=>{
  const groups=new Map<string,Row[]>()
  for(const l of raw.filter(l=>accounts.includes(l.account))){const key=JSON.stringify([l.account,l.propertyId,l.ownerId,l.tenancyId,l.vendorId]);groups.set(key,[...(groups.get(key)||[]),l])}
  return [...groups.values()].flatMap(sources=>{
   const debitNormal=byCode.get(sources[0].account)!.kind==='asset',value=(l:Row)=>debitNormal?l.debit-l.credit:l.credit-l.debit
   let credits=-sources.filter(l=>value(l)<0).reduce((n,l)=>n+value(l),0)
   const items=sources.filter(l=>value(l)>0).map(l=>{const paid=Math.min(credits,value(l));credits-=paid;const amountCents=value(l)-paid,days=Math.floor((Date.parse(to)-Date.parse(l.day))/86400000);return{...l,amountCents,days,bucket:days<=30?'0–30':days<=60?'31–60':days<=90?'61–90':'91+',sources}}).filter(l=>l.amountCents)
   if(credits)items.push({...sources[0],amountCents:-credits,days:0,bucket:'credit',sources})
   return items
  })
 }
 const cashSources=raw.filter(l=>byCode.get(l.account)?.cash),openingCents=cashSources.filter(l=>l.day<from).reduce((n,l)=>n+l.debit-l.credit,0),movements=cashSources.filter(l=>l.day>=from)
 await recordRead(c,'read:financial-report',from+' through '+to+' '+basis)
 return{version:1,currency:'USD',basis,from,to,filters:{propertyId:q.propertyId||'',ownerId:q.ownerId||'',entityId:q.entityId||''},properties:data.properties,owners:data.owners,entities:[...new Map(entities.map(e=>[e.entity_id,{id:e.entity_id,name:e.legal_name}])).values()],incomeStatement,balanceSheet,trialBalance,generalLedger:entries,receivables:aging(['receivable']),payables:aging(['payable','fee_payable']),cashFlow:{openingCents,openingSources:cashSources.filter(l=>l.day<from),movements,netCents:movements.reduce((n,l)=>n+l.debit-l.credit,0),closingCents:cashSources.reduce((n,l)=>n+l.debit-l.credit,0)},semantics:'Inclusive recorded posting dates; balances through the end day, income and cash movement inside the window. Cash basis reclassifies trade receivables to income timing and vendor or management payables to expense timing; opening balances reclassify to opening equity. Tax receivables reclassify to tax liability. Aging uses posting date and oldest-first credits within each account, property, beneficiary, resident and vendor. Entity attribution uses authorized property bank mappings; unmapped entries remain unassigned. Trial balance, general ledger and aging always show the original accrual postings. No bank verification, money movement or tax certification.'}
}
