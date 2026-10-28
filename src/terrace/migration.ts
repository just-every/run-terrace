import { canonicalJson, sha256 } from '../modules/import-kit/src/d1/index.ts'
import { all, commit, Fault, guard, insist, one, sql, text, type Context, type Row } from './core'
import { migrationId, migrationSource, type MigrationSource } from './migration-source'
import { nativeMigration } from './migration-native'

const bucket = (p: Row) => canonicalJson([p.propertyRef,p.ownerRef,p.fund])
const accountKey = (p: Row) => bucket(p) + ':' + p.account
const issue = (m: MigrationSource, key: string, message: string) => m.issues.push({key,kind:'reconciliation',ref:'manifest',message,resolved:false,reason:'',action:''})

async function plan(c: Context, input: unknown) {
 const m=await migrationSource(input), chart=await all(c,'SELECT code,fund FROM tt_gl_chart ORDER BY code'),active=m.records.filter(r=>!r.excluded)
 if(m.cutover>c.now.slice(0,10))issue(m,'future-cutover','Opening balances describe recorded facts. Cutover cannot be in the future.')
 const openings=active.filter(r=>r.kind==='opening'),buckets=new Set<string>(),target=new Map<string,number>()
 for(const r of openings) {
  const p=r.value,key=bucket(p)
  if(buckets.has(key))issue(m,'opening-duplicate:'+r.ref,'Combine each property, owner and fund into one opening bucket.')
  buckets.add(key)
  const property=active.find(r=>r.kind==='property'&&r.ref===p.propertyRef)
  if(!Array.isArray(property?.value.owners)||!property!.value.owners.some((s:Row)=>s.ownerRef===p.ownerRef))issue(m,'opening-owner:'+r.ref,'The opening beneficiary must belong to its property.')
  for(const l of Array.isArray(p.lines)?p.lines:[]) {
   if(!chart.some(a=>a.code===l.account&&(a.fund==='both'||a.fund===p.fund)))issue(m,'chart:'+r.ref+':'+l.account,'An opening account is absent or belongs to the other fund.')
   const key=accountKey({...p,account:l.account});target.set(key,(target.get(key)??0)+l.debit-l.credit)
  }
 }
 const tieOut: Row[] = [], seen=new Set<string>()
 for(const raw of m.trial) {
  const p=raw as Row,key=accountKey(p)
  insist(typeof p.account==='string'&&['operating','deposit'].includes(p.fund)&&Number.isSafeInteger(p.balanceCents)&&Math.abs(p.balanceCents)<=100_000_000,'migration_trial','Trial balances require a fund, account and signed integer cents.')
  if(seen.has(key))issue(m,'trial-duplicate:'+key,'Each source trial account must appear exactly once per beneficiary and fund.')
  seen.add(key)
  if(!buckets.has(bucket(p))||!chart.some(a=>a.code===p.account&&(a.fund==='both'||a.fund===p.fund)))issue(m,'trial-bucket:'+key,'A source trial account has no valid opening bucket or account.')
  const terraceCents=target.get(key)??0,differenceCents=terraceCents-p.balanceCents,exception=typeof p.exception==='string'?p.exception.trim():''
  tieOut.push({propertyRef:p.propertyRef,ownerRef:p.ownerRef,fund:p.fund,account:p.account,sourceCents:p.balanceCents,terraceCents,differenceCents,exception})
  if(differenceCents&&!exception)issue(m,'trial:'+key,'An opening account differs from the source trial balance without a named exception.')
 }
 for(const [key]of target)if(!seen.has(key))issue(m,'trial-missing:'+key,'An opening account is missing from the independent source trial balance.')
 if(!m.trial.length)issue(m,'trial-empty','Supply the independent incumbent trial balance, including zero accounts that need review.')
 // Source subledgers must independently explain the receivables, payables and deposit liabilities in the openings.
 const subledgers = new Map<string,number>()
 const add=(p:Row,delta:number)=>{const k=accountKey(p);subledgers.set(k,(subledgers.get(k)??0)+delta)}
 for(const r of active.filter(r=>['charge','deposit','bill'].includes(r.kind))) {
  const p=r.value,lease=active.find(l=>l.kind==='lease'&&l.ref===p.leaseRef),propertyRef=p.propertyRef??lease?.value.propertyRef,property=active.find(l=>l.kind==='property'&&l.ref===propertyRef)
  if(!property||!Array.isArray(property.value.owners)||!Number.isSafeInteger(p.amountCents))continue
  if(r.kind==='deposit')add({propertyRef,ownerRef:lease?.value.ownerRef,fund:'deposit',account:'deposit_liability'},-p.amountCents)
  else {
   const shares=[...property.value.owners].sort((a:Row,b:Row)=>b.shareBp-a.shareBp||migrationId(m.namespace,'owner',a.ownerRef).localeCompare(migrationId(m.namespace,'owner',b.ownerRef)))
   const remainder=p.amountCents-shares.reduce((n:number,s:Row)=>n+Math.floor(p.amountCents*s.shareBp/10000),0)
   shares.forEach((s:Row,i:number)=>add({propertyRef,ownerRef:s.ownerRef,fund:'operating',account:r.kind==='charge'?'receivable':'payable'},(Math.floor(p.amountCents*s.shareBp/10000)+(i===0?remainder:0))*(r.kind==='charge'?1:-1)))
  }
 }
 for(const key of new Set([...subledgers.keys(),...target.keys()].filter(k=>/:(receivable|payable|deposit_liability)$/.test(k))))if((subledgers.get(key)??0)!==(target.get(key)??0))issue(m,'subledger:'+key,'Unpaid charges, unpaid bills or resident deposits do not explain this opening subledger balance.')
 for(const r of active.filter(r=>r.kind==='lease')) {
  const household=active.find(h=>h.kind==='household'&&h.ref===r.value.householdRef)
  if(household)for(const address of [household.value.email,...(Array.isArray(household.value.members)?household.value.members.map((p:Row)=>p.email).filter(Boolean):[])])if(await one(c,'SELECT 1 FROM tt_erasures WHERE subject=?',sha256(address)))issue(m,'erased:'+r.ref,'An erased person cannot be restored through migration.')
  const prop=active.find(h=>h.kind==='property'&&h.ref===r.value.propertyRef)
  if(household&&prop&&await one(c,'SELECT 1 FROM tt_tenancies WHERE lower(tenant_email)=? AND address=? AND start_date=? AND erased_at IS NULL',household.value.email,prop.value.address,r.value.starts))issue(m,'existing:'+r.ref,'This resident lease already exists. Migration never replaces native records.')
 }
 for(const a of m.artifacts)if(await one(c,'SELECT 1 FROM tt_erased_document_files WHERE sha256=? UNION SELECT 1 FROM tt_erased_bill_files WHERE sha256=?',a.sha256,a.sha256))issue(m,'erased-file:'+a.ref,'An erased original cannot be restored through migration.')
 const prior=await one(c,'SELECT fingerprint,retired_at FROM tt_migrations WHERE namespace=?',m.namespace)
 const summary={format:m.source.format,namespace:m.namespace,cutoverDate:m.cutover,counts:m.counts,sourceCount:m.records.length,importedCount:active.length,excludedCount:m.records.length-active.length,issues:m.issues,tieOut,artifacts:m.artifacts.map(({ref,name,type,size,sha256})=>({ref,name,type,size,sha256})),records:m.records.map(r=>({kind:r.kind,ref:r.ref,targetId:r.excluded?null:r.targetId,disposition:r.excluded?'excluded':'imported',value:r.value})),approvalRequired:true,boundary:'Historical source facts only. Work and bills require their native approvals. No money, signature, consent, portal grant or outbound authority is imported.'}
 const fingerprint=sha256(canonicalJson({original:m.original,summary,chart}))
 const errors=m.issues.filter(i=>!i.resolved),canApply=errors.length===0&&!prior
 return {m,report:{...summary,fingerprint,canApply,completeSwitch:canApply&&summary.excludedCount===0&&tieOut.every(x=>x.differenceCents===0)&&!m.issues.length,namespaceUsed:!!prior},prior}
}

export async function migrationCommand(c: Context, command: string, p: Row): Promise<Row> {
 if(command==='migration.journal') {
  const job=await one(c,'SELECT * FROM tt_migrations WHERE id=?',text(p.migrationId,'Migration',100))
  insist(job,'not_found','Migration not found.',404)
  insist(!job.retired_at,'migration_retired','Migration custody was retired by erasure. Its approval cannot be replayed.',410)
  const balanceForwards=await all(c,'SELECT * FROM tt_migration_forwards WHERE migration_id=? ORDER BY id',job.id),vendorDetails=await all(c,'SELECT v.name,d.* FROM tt_migration_vendor_details d JOIN tt_vendors v ON v.id=d.vendor_id WHERE d.migration_id=? ORDER BY vendor_id',job.id)
  return {migration:{id:job.id,namespace:job.namespace,approvedBy:job.approved_by,approvedAt:job.approved_at,original:job.original,report:JSON.parse(job.report),balanceForwards,vendorDetails},notice:'Retained migration manifest and account tie-out.'}
 }
 let input=p.manifest
 if(input===undefined&&typeof p.manifestBase64==='string')try{input=new TextDecoder('utf-8',{fatal:true}).decode(Uint8Array.from(atob(p.manifestBase64),ch=>ch.charCodeAt(0)))}catch{throw new Fault('migration_shape','The preserved manifest is invalid.')}
 if(command==='migration.apply') {
  // Resolve an exact repeat from its retained custody before looking at targets now created by the first apply.
  const m=await migrationSource(input),prior=await one(c,'SELECT * FROM tt_migrations WHERE namespace=?',m.namespace)
  if(prior) {
   insist(!prior.retired_at,'migration_retired','Migration custody was retired by erasure. Its approval cannot be replayed.',410)
   insist(prior.fingerprint===p.fingerprint&&prior.original===input,'review_changed','This namespace already holds a different reviewed migration.',409)
   return {migration:{id:prior.id,report:JSON.parse(prior.report)},replayed:true,notice:'Migration already applied. Nothing was written.'}
  }
 }
 const {m,report}=await plan(c,input)
 if(command==='migration.preview')return {migrationPreview:report,manifest:m.original,manifestBase64:base64(m.original),notice:'Read-only migration preview. No records were written.'}
 insist(typeof p.fingerprint==='string'&&p.fingerprint===report.fingerprint,'review_changed','The source, field mapping, resolutions or account review changed. Preview and approve again.',409)
 insist(report.canApply,'migration_exceptions','Resolve every missing record, duplicate, original, count and money exception before approval.',409)
 const key=migrationId(m.namespace,'manifest','approved')
 const writes=[guard(c,'NOT EXISTS(SELECT 1 FROM tt_migrations WHERE namespace=?)',m.namespace),sql(c,'INSERT INTO tt_migrations(id,namespace,fingerprint,cutover_day,original,report,approved_by,approved_at) VALUES(?,?,?,?,?,?,?,?)',key,m.namespace,report.fingerprint,m.cutover,m.original,canonicalJson(report),c.actor.id,c.now),...nativeMigration(c,m,key)]
 await commit(c,writes,'migration.apply',key)
 return {migration:{id:key,report},replayed:false,notice:'Reviewed migration applied atomically. Original, counts, exceptions and account tie-out are retained. No money moved.'}
}
function base64(value: string) {const bytes=new TextEncoder().encode(value);let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(binary)}
export const migrationData = (c: Context) => all(c,'SELECT id,namespace,approved_at,retired_at FROM tt_migrations ORDER BY approved_at DESC,id')

const sharedHold = `SELECT 1 FROM tt_migration_records own JOIN tt_migrations m ON m.id=own.migration_id JOIN tt_migration_records peer ON peer.migration_id=own.migration_id JOIN tt_legal_holds h ON h.tenancy_id=peer.tenancy_id WHERE own.tenancy_id=? AND peer.tenancy_id<>? AND m.original IS NOT NULL AND h.released_at IS NULL`
export async function migrationSharedHolds(c: Context, tenancyId: string) {
 return await one(c,sharedHold,tenancyId,tenancyId)?[{class:'all',reason:'Shared migration originals are under another resident’s legal hold'}]:[]
}
/** Withdraw shared originals under the existing custody rule, preserving unrelated source facts and numeric tie-out. */
export async function migrationErasure(c: Context, tenancyId: string, accounting: boolean) {
 const jobs=await all(c,'SELECT DISTINCT m.* FROM tt_migrations m JOIN tt_migration_records r ON r.migration_id=m.id WHERE r.tenancy_id=?',tenancyId)
 const resident=await one(c,'SELECT tenant_email FROM tt_tenancies WHERE id=?',tenancyId)
 const bills=await all(c,"SELECT entity_id FROM tt_bill_subjects WHERE tenancy_id=? AND kind='bill'",tenancyId)
 const writes=[guard(c,'NOT EXISTS('+sharedHold+')',tenancyId,tenancyId)]
 for(const job of jobs) {
  const records=await all(c,'SELECT * FROM tt_migration_records WHERE migration_id=?',job.id)
  const values: Row[]=records.map(r=>({...r,value:r.record?JSON.parse(r.record):{}}))
  const householdRefs=new Set(values.filter(r=>r.kind==='lease'&&r.tenancy_id===tenancyId).map(r=>r.value.householdRef))
  for(const r of values)if(r.kind==='household'&&r.value.email===resident?.tenant_email)householdRefs.add(r.ref)
  const leaseRefs=new Set(values.filter(r=>r.kind==='lease'&&r.tenancy_id===tenancyId).map(r=>r.ref))
  const sharedHouseholds=new Set(values.filter(r=>r.kind==='lease'&&r.tenancy_id&&r.tenancy_id!==tenancyId).map(r=>r.value.householdRef))
  const old=JSON.parse(job.report),retained={retired:true,notice:'Original and personal review retired by erasure.',counts:old.counts,tieOut:(old.tieOut??[]).map((r:Row)=>({...r,exception:r.exception?'Named exception retained after erasure':''}))}
  writes.push(guard(c,'EXISTS(SELECT 1 FROM tt_migrations WHERE id=? AND report IS ? AND retired_at IS ?)',job.id,job.report,job.retired_at),sql(c,'UPDATE tt_migrations SET original=NULL,report=?,retired_at=COALESCE(retired_at,?) WHERE id=?',JSON.stringify(retained),c.now,job.id))
  for(const r of values)if(r.tenancy_id===tenancyId||r.kind==='household'&&householdRefs.has(r.ref)&&!sharedHouseholds.has(r.ref)||r.kind==='lease'&&leaseRefs.has(r.ref)||leaseRefs.has(r.value.leaseRef)||r.kind==='bill'&&bills.some(b=>b.entity_id===r.target_id))writes.push(sql(c,'UPDATE tt_migration_records SET record=NULL WHERE migration_id=? AND kind=? AND ref=?',job.id,r.kind,r.ref))
 }
 if(accounting)writes.push(sql(c,"UPDATE tt_migration_history SET reference=id,source_ref=id WHERE tenancy_id=?",tenancyId))
 return writes
}
