import {all,allow,can,commit,date,guard,id,insist,one,sql,tenancy,tenancyGuard,text,type Context,type Row} from './core'
import {billData} from './bills'
import {bill,billGuard} from './bills-input'
import {budgetAuthority,budgetGuard,budgetScope,budgetSpend,budgetBasis} from './work-budgets'
import {localDate} from './zones'
export const STOCK_COMMANDS=['stock.receive','stock.consume']
const quantity=(v:unknown)=>{const n=Number(v);insist(Number.isSafeInteger(n)&&n>0&&n<=1000000,'invalid_quantity','Enter a positive whole number of parts, at most one million.');return n}
function posting(c:Context,key:string,source:string,day:string,property:string,owner:string,job:Row|null,amount:number,receive:boolean,reference:string){
 const debit=receive?'inventory':'expense',credit=receive?'expense':'inventory'
 return sql(c,`INSERT INTO tt_journal(id,day,property_id,owner_key,tenancy_id,fund,source_kind,source_id,reference,lines,recorded_by,recorded_at) VALUES(?,?,?,?,?,'operating',?,?,?,?,?,?)`,id(),day,property,owner,job?.tenancy_id??null,source,key,key,JSON.stringify([{account:debit,debit:amount,credit:0},{account:credit,debit:0,credit:amount}]),c.actor.id,c.now)
}
export async function stockCommand(c:Context,command:string,p:Row):Promise<Row|undefined>{
 if(!STOCK_COMMANDS.includes(command))return
 allow(c,command)
 const t=await tenancy(c,p.tenancyId),scope=await budgetScope(c,t),property=scope.startsWith('property:')?scope.slice(9):''
 insist(property&&t.currency==='USD'&&t.currency_confirmed!==0,'stock_scope','Stock requires a property and confirmed USD.',409)
 const day=date(p.day),reference=text(p.reference,'Stock source',500),count=quantity(p.quantity),key=id()
 insist(day<=localDate(c.now,t.time_zone),'future_posting','Record stock only after it occurred.')
 if(command==='stock.receive'){
  const b=await bill(c,p.billId),a=b.parsed.allocations.find((a:Row)=>a.propertyId===property)
  insist(b.state==='payable'&&b.version===Number(p.billVersion)&&a&&!a.jobId&&!a.assetId,'stock_payable','Select a current approved unlinked property payable without an asset allocation.',409)
  insist(day>=b.day,'invalid_date','Receipt cannot predate the purchase invoice.')
  insist(!await one(c,'SELECT id FROM tt_stock_lots WHERE bill_id=? AND property_id=?',b.id,property),'stock_received','This payable allocation is already received.',409)
  insist(count<=a.amountCents,'invalid_quantity','Each part must retain at least one cent of cost.')
  const expenses=await all(c,'SELECT owner_id,amount_cents FROM tt_bill_expenses WHERE bill_id=? AND version=? AND property_id=?',b.id,b.version,property)
  insist(expenses.length&&expenses.every(x=>x.amount_cents>=count),'invalid_quantity','Each beneficiary must retain at least one cent per part.')
  await commit(c,[tenancyGuard(c,t),billGuard(c,b),sql(c,"INSERT INTO tt_bill_subjects(kind,entity_id,tenancy_id) VALUES('bill',?,?) ON CONFLICT DO NOTHING",b.id,t.id),guard(c,'NOT EXISTS(SELECT 1 FROM tt_stock_lots WHERE bill_id=? AND property_id=?)',b.id,property),sql(c,'INSERT INTO tt_stock_lots VALUES(?,?,?,?,?,?,?,?,?,?,?)',key,property,b.id,b.version,text(p.name,'Part name',150),count,a.amountCents,day,reference,c.actor.id,c.now),...expenses.filter(x=>x.amount_cents>0).map(x=>posting(c,key,'stock_receipt',day,property,x.owner_id,null,x.amount_cents,true,reference))],command,key)
  return{id:key,tenancyId:t.id,notice:'Stock received from the approved payable. Recorded purchase tax stays in its cost. No money moved.'}
 }
 const lot=await one(c,'SELECT * FROM tt_stock_lots WHERE id=? AND property_id=?',text(p.lotId,'Stock lot',100),property)
 insist(lot,'not_found','Stock lot not found.',404)
 const [pickedJob,pickedVersion]=String(p.jobKey??'').split(':')
 const job=await one(c,'SELECT * FROM tt_maintenance_jobs WHERE id=? AND tenancy_id=?',text(p.jobId??pickedJob,'Work order',100),t.id)
 insist(job&&['approved','sent'].includes(job.state)&&job.version===Number(p.jobVersion??pickedVersion),'stock_work','Choose the current approved repair.',409)
 insist(day>=lot.day,'invalid_date','Use cannot predate receipt.')
 const used=await all(c,'SELECT * FROM tt_stock_uses WHERE lot_id=?',lot.id),prior=used.reduce((n,x)=>n+x.quantity,0)
 insist(prior+count<=lot.quantity,'insufficient_stock','Not enough stock remains.',409)
 // Cumulative integer apportionment consumes every recorded cent exactly, even with indivisible unit costs.
 const owners=await all(c,'SELECT owner_id,amount_cents FROM tt_bill_expenses WHERE bill_id=? AND version=? AND property_id=? ORDER BY owner_id',lot.bill_id,lot.bill_version,property)
 const ownership=await one(c,'SELECT id FROM tt_ownership_sets WHERE property_id=? AND effective_from<=? ORDER BY effective_from DESC LIMIT 1',property,day)
 const sourceOwners=await all(c,'SELECT share_set_id FROM tt_bill_expenses WHERE bill_id=? AND version=? AND property_id=?',lot.bill_id,lot.bill_version,property)
 insist(ownership&&sourceOwners.every(o=>o.share_set_id===ownership.id),'owner_scope','Stock belongs to the purchase beneficiaries. Changed ownership requires a separately reviewed transfer.',409)
 const portions:Row[]=owners.map(o=>({...o,used:Math.floor(o.amount_cents*(prior+count)/lot.quantity)-Math.floor(o.amount_cents*prior/lot.quantity)}))
 const amount=portions.reduce((n,o)=>n+o.used,0)
 const basis=await budgetBasis(c,scope),authority=await budgetAuthority(c,scope)
 const repairCost=basis.allocations.filter((a:Row)=>a.jobId===job.id).reduce((n:number,a:Row)=>n+a.amountCents,0)+basis.stockUses.filter((u:Row)=>u.jobId===job.id).reduce((n:number,u:Row)=>n+u.amountCents,0)+amount
 insist(repairCost<=job.estimate_cents,'owner_approval_required','Part use and linked invoices exceed the approved repair. Revise and approve sufficient work authority first.',409)
 const next={...basis,stockUses:[...basis.stockUses,{jobId:job.id,amountCents:amount}]}
 insist(authority.rows.every((b:Row)=>budgetSpend(b,next)<=b.amount_cents||budgetSpend(b,next)<=b.spentCents),'owner_approval_required','Stock use exceeds approved budget authority. Record and approve sufficient work authority first.',409)
 const writes=portions.filter(o=>o.used>0).map(o=>posting(c,key,'stock_use',day,property,o.owner_id,job,o.used,false,reference))
 await commit(c,[tenancyGuard(c,t),budgetGuard(c,basis.clock),guard(c,'(SELECT id FROM tt_ownership_sets WHERE property_id=? AND effective_from<=? ORDER BY effective_from DESC LIMIT 1)=?',property,day,ownership.id),sql(c,"INSERT INTO tt_bill_subjects(kind,entity_id,tenancy_id) VALUES('bill',?,?) ON CONFLICT DO NOTHING",lot.bill_id,t.id),guard(c,'EXISTS(SELECT 1 FROM tt_maintenance_jobs WHERE id=? AND version=? AND state=?)',job.id,job.version,job.state),guard(c,'(SELECT COALESCE(SUM(quantity),0) FROM tt_stock_uses WHERE lot_id=?)=?',lot.id,prior),sql(c,'INSERT INTO tt_stock_uses VALUES(?,?,?,?,?,?,?,?,?,?,?)',key,lot.id,job.id,t.id,job.version,count,amount,day,reference,c.actor.id,c.now),...writes],command,key)
 return{id:key,tenancyId:t.id,notice:'Part consumption recorded against this repair. Purchase payable and remaining stock reconcile without another expense.'}
}
export async function stockData(c:Context,tenancyId:string){
 const t=await tenancy(c,tenancyId);allow(c,'work.read');if(!can(c,'bills.read'))return{lots:[],uses:[],mayReceive:false,mayConsume:false,visible:false};const scope=await budgetScope(c,t)
 const lots=await all(c,'SELECT l.*,COALESCE(SUM(u.quantity),0) AS used_quantity,COALESCE(SUM(u.amount_cents),0) AS used_cents FROM tt_stock_lots l LEFT JOIN tt_stock_uses u ON u.lot_id=l.id WHERE l.property_id=? GROUP BY l.id ORDER BY l.day,l.id',scope.startsWith('property:')?scope.slice(9):'')
 const uses=await all(c,'SELECT u.*,l.name FROM tt_stock_uses u JOIN tt_stock_lots l ON l.id=u.lot_id WHERE u.tenancy_id=? ORDER BY u.recorded_at',t.id)
 const purchases=can(c,'stock.receive')?(await billData(c)).bills.filter((b:Row)=>b.state==='payable'&&b.parsed.allocations.some((a:Row)=>'property:'+a.propertyId===scope&&!a.jobId&&!a.assetId)&&!lots.some(l=>l.bill_id===b.id)).map((b:Row)=>({id:b.id,version:b.version,label:b.parsed.supplier+' · '+b.invoice_number})):[]
 return{visible:true,purchases,lots,uses,mayReceive:can(c,'stock.receive'),mayConsume:can(c,'stock.consume')}
}
