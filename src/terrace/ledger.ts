// Adapted from Nectar c76a60ccffa39cc1a207b52c152bda16d6d7b1df
// src/nectar/receivables.ts: integer cents, immutable charges and receipts,
// with a balance guard in the same batch as every allocation or adjustment.
import { all, cents, commit, date, guard, id, insist, manager, one, sql, tenancy, text, type Context, type Row } from './core'
export const BALANCE = `(q.amount_cents - COALESCE((SELECT SUM(amount_cents) FROM tt_receipts WHERE charge_id=q.id),0) - COALESCE((SELECT SUM(amount_cents) FROM tt_adjustments WHERE charge_id=q.id),0))`
export async function ledgerCommand(c:Context,command:string,p:Row):Promise<Row|undefined> {
 if(!['rent.charge','rent.receipt','rent.adjust'].includes(command)) return
 manager(c)
 const key=id()
 if(command==='rent.charge') {
  const t=await tenancy(c,p.tenancyId)
  await commit(c,[sql(c,'INSERT INTO tt_charges(id,tenancy_id,due_date,amount_cents,description,reference,created_at) VALUES(?,?,?,?,?,?,?)',key,t.id,date(p.dueDate,'Due date'),cents(p.amount),text(p.description,'Description',300),text(p.reference,'Unique charge reference',150),c.now)],command,key)
 } else {
  const charge=await one(c,`SELECT q.*,${BALANCE} AS balance_cents FROM tt_charges q WHERE id=?`,text(p.chargeId,'Charge',100))
  insist(charge,'not_found','Charge not found.',404)
  const amount=cents(p.amount)
  insist(amount<=charge.balance_cents,'exceeds_balance','Amount exceeds the unpaid charge balance.',409)
  const writes=[guard(c,`(SELECT ${BALANCE} FROM tt_charges q WHERE id=?)>=?`,charge.id,amount)]
  if(command==='rent.receipt') {
   const received=date(p.receivedDate,'Received date')
   insist(received<=c.now.slice(0,10),'future_receipt','A receipt records money already received; its date cannot be in the future.')
   writes.push(sql(c,'INSERT INTO tt_receipts(id,charge_id,amount_cents,received_date,reference,created_at) VALUES(?,?,?,?,?,?)',key,charge.id,amount,received,text(p.reference,'External receipt reference',150),c.now))
  } else writes.push(sql(c,'INSERT INTO tt_adjustments(id,charge_id,amount_cents,reason,at) VALUES(?,?,?,?,?)',key,charge.id,amount,text(p.reason,'Adjustment reason',1000),c.now))
  await commit(c,writes,command,key)
 }
 return {id:key}
}
export async function ledgerData(c:Context,tenancyId:string) {
 const charges=await all(c,`SELECT q.*,${BALANCE} AS balance_cents FROM tt_charges q WHERE tenancy_id=? ORDER BY due_date,created_at`,tenancyId)
 const receipts=await all(c,'SELECT r.* FROM tt_receipts r JOIN tt_charges q ON q.id=r.charge_id WHERE q.tenancy_id=? ORDER BY received_date,created_at',tenancyId)
 const adjustments=await all(c,'SELECT a.* FROM tt_adjustments a JOIN tt_charges q ON q.id=a.charge_id WHERE q.tenancy_id=? ORDER BY at',tenancyId)
 return {charges,receipts,adjustments,balanceCents:charges.reduce((s,r)=>s+r.balance_cents,0),arrearsCents:charges.filter(q=>q.due_date<c.now.slice(0,10)).reduce((s,r)=>s+r.balance_cents,0)}
}
// Every amount is period-based, with no pagination cap in a statement.
export async function statement(c:Context,tenancyId:string,from:string,to:string) {
 manager(c)
 const t=await tenancy(c,tenancyId); from=date(from,'Period start');to=date(to,'Period end');insist(to>=from,'period','Period end must follow its start.')
 const ledger=await ledgerData(c,t.id)
 const events=[...ledger.charges.map(x=>({date:x.due_date,kind:'Charge',reference:x.reference,chargeCents:x.amount_cents,receiptCents:0,adjustmentCents:0})),...ledger.receipts.map(x=>({date:x.received_date,kind:'Recorded external receipt',reference:x.reference,chargeCents:0,receiptCents:x.amount_cents,adjustmentCents:0})),...ledger.adjustments.map(x=>({date:x.at.slice(0,10),kind:'Charge reduction',reference:x.reason,chargeCents:0,receiptCents:0,adjustmentCents:x.amount_cents}))].sort((a,b)=>a.date.localeCompare(b.date))
 const delta=(x:typeof events[number])=>x.chargeCents-x.receiptCents-x.adjustmentCents
 const opening=events.filter(x=>x.date<from).reduce((s,x)=>s+delta(x),0),period=events.filter(x=>x.date>=from&&x.date<=to),closing=opening+period.reduce((s,x)=>s+delta(x),0)
 return {tenancy:t,from,to,openingCents:opening,closingCents:closing,events:period,generatedAt:c.now,boundary:'Recorded rent only. Not a statutory trust account, bank reconciliation, owner disbursement or tax statement.'}
}
export function statementCsv(s:Awaited<ReturnType<typeof statement>>) {
 const cell=(v:unknown)=>'"'+String(v??'').replaceAll('"','""').replace(/^[=+@-]/,"'$&")+'"'
 const rows:unknown[][]=[['Terrace owner statement',s.tenancy.owner_name],['Property',s.tenancy.address],['Period',s.from,s.to],['Opening receivable AUD',(s.openingCents/100).toFixed(2)],['Date','Kind','Reference','Charges AUD','Receipts AUD','Adjustments AUD'],...s.events.map(e=>[e.date,e.kind,e.reference,(e.chargeCents/100).toFixed(2),(e.receiptCents/100).toFixed(2),(e.adjustmentCents/100).toFixed(2)]),['Closing receivable AUD',(s.closingCents/100).toFixed(2)],[s.boundary]]
 return rows.map(r=>r.map(cell).join(',')).join('\r\n')+'\r\n'
}
