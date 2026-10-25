import {all,allow,cents,commit,guard,id,insist,one,sql,tenancy,tenancyGuard,text,type Context,type Row} from './core'
import {serviceableAsset} from './assets'

export function costClass(value:unknown) {
 const kind=String(value||'operating')
 insist(['operating','capital'].includes(kind),'invalid_input','Choose operating or capital costs.')
 return kind
}
export async function budgetScope(c:Context,t:Row) {
 const unit=t.unit_id?await one(c,'SELECT property_id FROM tt_units WHERE id=?',t.unit_id):null
 return unit?'property:'+unit.property_id:'tenancy:'+t.id
}
export async function budgetCommand(c:Context,command:string,p:Row):Promise<Row|undefined> {
 if(command!=='work.budget')return
 allow(c,command)
 const t=await tenancy(c,p.tenancyId),scope=await budgetScope(c,t),kind=costClass(p.kind),year=text(p.year,'Budget year',4)
 insist(/^\d{4}$/.test(year)&&Number(year)>=1900&&Number(year)<=9999,'invalid_input','Enter a budget year from 1900 to 9999.')
 insist(t.currency==='USD'&&t.currency_confirmed!==0,'currency','Confirm USD before setting a category budget.',409)
 const asset=p.assetId?await serviceableAsset(c,t.id,p.assetId):null,assetId=asset?.id??''
 const previous=await one(c,'SELECT * FROM tt_work_budgets WHERE scope=? AND year=? AND kind=? AND asset_id=?',scope,year,kind,assetId)
 insist(Number(p.version??0)===(previous?.version??0),'conflict','Reload the current budget before changing it.',409)
 const amount=cents(p.amount),reference=text(p.reference,'Approved budget source',1000),version=(previous?.version??0)+1
 await commit(c,[tenancyGuard(c,t),...(asset?[guard(c,"EXISTS(SELECT 1 FROM tt_assets WHERE id=? AND version=? AND state='in_service')",asset.id,asset.version)]:[]),guard(c,'COALESCE((SELECT version FROM tt_work_budgets WHERE scope=? AND year=? AND kind=? AND asset_id=?),0)=?',scope,year,kind,assetId,version-1),
  sql(c,'INSERT INTO tt_work_budgets(scope,year,kind,asset_id,amount_cents,reference,version,set_by,set_at) VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(scope,year,kind,asset_id) DO UPDATE SET amount_cents=excluded.amount_cents,reference=excluded.reference,version=excluded.version,set_by=excluded.set_by,set_at=excluded.set_at',scope,year,kind,assetId,amount,reference,version,c.actor.id,c.now),
  sql(c,'INSERT INTO tt_budget_changes(id,scope,year,kind,asset_id,amount_cents,reference,version,set_by,set_at) VALUES(?,?,?,?,?,?,?,?,?,?)',id(),scope,year,kind,assetId,amount,reference,version,c.actor.id,c.now)
 ],command,scope)
 return {tenancyId:t.id,version,notice:'Approved budget source recorded. Earlier revisions remain in budget history.'}
}
/** One clock protects the read basis inside approval batches, including two simultaneous approvals. */
export async function budgetBasis(c:Context,scope:string) {
 const clock=(await one(c,'SELECT version FROM tt_budget_clock WHERE id=1'))!.version
 const property=scope.startsWith('property:'),key=scope.slice(property?9:8)
 const jobs=await all(c,`SELECT j.* FROM tt_maintenance_jobs j JOIN tt_tenancies t ON t.id=j.tenancy_id LEFT JOIN tt_units u ON u.id=t.unit_id WHERE ${property?'u.property_id':'t.id'}=?`,key)
 const budgets=await all(c,'SELECT b.*,a.kind AS asset_name,a.serial AS asset_serial FROM tt_work_budgets b LEFT JOIN tt_assets a ON a.id=b.asset_id WHERE b.scope=? ORDER BY year,kind,asset_id',scope)
 const bills=property?await all(c,"SELECT b.id,r.terms FROM tt_bills b JOIN tt_bill_revisions r ON r.bill_id=b.id AND r.version=b.version WHERE b.state='payable'"):[]
 const allocations=bills.flatMap(b=>JSON.parse(b.terms).allocations.filter((a:Row)=>a.propertyId===key).map((a:Row)=>({...a,billId:b.id,day:JSON.parse(b.terms).day})))
 return {clock,jobs,budgets,allocations}
}
/** A work estimate reserves its due year. Linked invoices retain that category and year; unlinked bills use invoice year. */
export function budgetSpend(b:Row,basis:Row,jobOverride?:Row,billOverride?:Row) {
 const jobs:Row[]=basis.jobs.map((j:Row)=>j.id===jobOverride?.id?jobOverride:j)
 const allocations:Row[]=[...basis.allocations.filter((a:Row)=>a.billId!==billOverride?.id),...(billOverride?.parsed.allocations??[]).filter((a:Row)=>'property:'+a.propertyId===b.scope).map((a:Row)=>({...a,day:billOverride!.parsed.day}))]
 const matches=(kind:string,asset:string,year:string)=>kind===b.kind&&(!b.asset_id||asset===b.asset_id)&&year===b.year
 let spent=0
 for(const j of jobs) {
  if(!matches(j.cost_class,j.asset_id??'',j.due_date.slice(0,4)))continue
  const actual=allocations.filter(a=>a.jobId===j.id).reduce((n,a)=>n+a.amountCents,0)
  spent+=Math.max(['approved','sent'].includes(j.state)?j.estimate_cents:0,actual)
 }
 for(const a of allocations.filter(a=>!a.jobId))if(matches(a.costClass??'operating',a.assetId??'',a.day.slice(0,4)))spent+=a.amountCents
 return spent
}
export async function budgetAuthority(c:Context,scope:string,jobOverride?:Row,billOverride?:Row) {
 const basis=await budgetBasis(c,scope)
 const rows=basis.budgets.map((b:Row)=>({...b,spentCents:budgetSpend(b,basis),projectedCents:budgetSpend(b,basis,jobOverride,billOverride)}))
 const affected=(b:Row)=>{
  const relevant=(kind:string,asset:string,year:string)=>b.kind===kind&&(!b.asset_id||b.asset_id===asset)&&b.year===year
  if(jobOverride)return relevant(jobOverride.cost_class,jobOverride.asset_id??'',jobOverride.due_date.slice(0,4))
  if(billOverride)return billOverride.parsed.allocations.some((a:Row)=>{
   if('property:'+a.propertyId!==scope)return false
   const j=basis.jobs.find((j:Row)=>j.id===a.jobId)
   return relevant(j?.cost_class??a.costClass??'operating',j?.asset_id??a.assetId??'',(j?.due_date??billOverride.parsed.day).slice(0,4))
  })
  return true
 }
 return {rows,clock:basis.clock,reasons:rows.filter((b:Row)=>affected(b)&&b.projectedCents>b.amount_cents).map((b:Row)=>`over ${b.year} ${b.kind}${b.asset_id?' asset '+b.asset_name+' '+b.asset_serial:''} budget`)}
}
export const budgetGuard=(c:Context,clock:number)=>guard(c,'(SELECT version FROM tt_budget_clock WHERE id=1)=?',clock)
