import { canonicalJson, sha256 } from '../modules/import-kit/src/d1/index.ts'
import { guard, sql, type Context, type Row } from './core'
import { migrationId, type MigrationSource } from './migration-source'

/** Build statements only. Preview never calls run or batch. All rows publish in the owner's transaction. */
export function nativeMigration(c: Context, m: MigrationSource, jobId: string) {
 const writes: D1PreparedStatement[] = [], active = m.records.filter(r=>!r.excluded)
 const rows = (kind: string) => active.filter(r=>r.kind===kind)
 const find = (kind: string, ref: string) => active.find(r=>r.kind===kind&&r.ref===ref)!
 const target = (kind: string, ref: string) => find(kind,ref).targetId
 const add = (table: string, values: Row) => writes.push(sql(c,`INSERT INTO ${table}(${Object.keys(values).join(',')}) VALUES(${Object.keys(values).map(()=>'?').join(',')})`,...Object.values(values)))
 const created = {created_by:c.actor.id,created_at:c.now}, portfolioId = migrationId(m.namespace,'portfolio','portfolio')
 add('tt_portfolios',{id:portfolioId,name:'Migration ' + m.namespace,...created})
 for(const r of rows('owner')) {const p=r.value;add('tt_owners',{id:r.targetId,kind:p.kind,legal_name:p.name,email:p.email,mailing_address:p.mailingAddress,w9_status:p.w9,...created})}
 for(const r of rows('property')) {
  const p=r.value,setId=migrationId(m.namespace,'ownership',r.ref)
  add('tt_properties',{id:r.targetId,portfolio_id:portfolioId,name:p.name,address:p.address,kind:p.kind,time_zone:p.timeZone,...created})
  add('tt_ownership_sets',{id:setId,property_id:r.targetId,effective_from:p.ownershipFrom,reason:'Source ownership retained in migration ' + jobId,...created})
  p.owners.forEach((s:Row,position:number)=>add('tt_ownership_shares',{set_id:setId,owner_id:target('owner',s.ownerRef),share_bp:s.shareBp,position}))
 }
 for(const r of rows('vendor')) {
  const p=r.value
  add('tt_vendors',{id:r.targetId,name:p.name,email:p.email,phone:p.phone,specialties:JSON.stringify(p.specialties.split(',').map((s:string)=>s.trim().toLowerCase())),service_areas:JSON.stringify(p.serviceAreas.split(',').map((s:string)=>s.trim())),w9:p.w9,insurance_expires:p.insuranceExpires,license_number:p.licenseNumber,license_expires:p.licenseExpires,availability:p.availability,standing:'approved',currency:'USD',updated_by:c.actor.id,updated_at:c.now})
  add('tt_migration_vendor_details',{vendor_id:r.targetId,migration_id:jobId,dba:p.dba,tin_status:p.tinStatus,eligible_1099:p.eligible1099?1:0,box:p.box,payment_method:p.paymentMethod,remit_address:p.remitAddress})
 }
 const units = new Set<string>()
 for(const r of rows('lease')) {
  const p=r.value,property=find('property',p.propertyRef),household=find('household',p.householdRef),owner=find('owner',p.ownerRef),unitId=migrationId(m.namespace,'unit',p.propertyRef + '.' + p.unit)
  if(!units.has(unitId)){add('tt_units',{id:unitId,property_id:property.targetId,identifier:p.unit,bedrooms:0,bathrooms:0,amenities:'[]',rentable:1,...created});units.add(unitId)}
  for(const address of [household.value.email,...household.value.members.map((s:Row)=>s.email).filter(Boolean)])writes.push(guard(c,'NOT EXISTS(SELECT 1 FROM tt_erasures WHERE subject=?)',sha256(address)))
  add('tt_tenancies',{id:r.targetId,unit_id:unitId,address:property.value.address,owner_name:owner.value.name,owner_email:owner.value.email,tenant_name:household.value.name,tenant_email:household.value.email,start_date:p.starts,end_date:p.ends,rent_cents:p.rentCents,cadence:p.cadence,currency:'USD',time_zone:property.value.timeZone,created_at:c.now})
  add('tt_migration_lease_openings',{tenancy_id:r.targetId,migration_id:jobId,history_from:p.historyFrom,opening_cents:p.historyOpeningCents,cutover_day:m.cutover})
  household.value.members.forEach((member:Row,index:number)=>add('tt_household_members',{id:migrationId(m.namespace,'member',r.ref+'.'+index),tenancy_id:r.targetId,role:member.role,name:member.name,email:member.email,phone:member.phone,contact_by:'none',joined:p.starts,...created}))
 }
 for(const r of rows('document')) {
  const p=r.value,a=m.artifacts.find(a=>a.ref===p.artifactRef)!,restricted=['application','screening'].includes(p.documentKind)?'screening':p.documentKind==='tax'?'tax':null
  writes.push(guard(c,'NOT EXISTS(SELECT 1 FROM tt_erased_document_files WHERE sha256=?)',a.sha256))
  add('tt_documents',{id:r.targetId,tenancy_id:target('lease',p.leaseRef),kind:p.documentKind,title:p.title,retention_class:restricted==='screening'?'screening':restricted==='tax'?'accounting':p.documentKind==='notice'?'communications':'lease',restriction:restricted,version:1,...created})
  add('tt_document_versions',{id:migrationId(m.namespace,'document-version',r.ref),document_id:r.targetId,version:1,name:a.name,media_type:a.type,size:a.size,sha256:a.sha256,bytes:a.bytes,content_text:a.contentText,note:'Migration source ' + r.ref,scan:JSON.stringify({check:a.scan,text:a.contentText?'indexed':'metadata only'}),uploaded_by:c.actor.id,uploaded_at:c.now})
 }
 for(const r of rows('charge')) {const p=r.value;add('tt_charges',{id:r.targetId,tenancy_id:target('lease',p.leaseRef),due_date:p.day,amount_cents:p.amountCents,description:p.description,reference:p.reference,created_at:c.now,currency:'USD'})}
 for(const r of rows('deposit')) {
  const p=r.value,lease=find('lease',p.leaseRef),property=find('property',lease.value.propertyRef)
  add('tt_journal',{id:r.targetId,day:p.day,property_id:property.targetId,owner_key:target('owner',lease.value.ownerRef),tenancy_id:lease.targetId,fund:'deposit',source_kind:'deposit',source_id:r.targetId,reference:p.reference,lines:JSON.stringify([{account:'cash',debit:p.amountCents,credit:0},{account:'deposit_liability',debit:0,credit:p.amountCents}]),recorded_by:c.actor.id,recorded_at:c.now})
 }
 for(const r of rows('bill')) {
  const p=r.value,v=find('vendor',p.vendorRef),a=m.artifacts.find(a=>a.ref===p.artifactRef)!,attachmentId=migrationId(m.namespace,'invoice-original',r.ref)
  const terms={vendorId:v.targetId,supplier:v.value.name,invoiceNumber:p.invoiceNumber,day:p.day,lines:[{description:p.description,code:'expense',amountCents:p.amountCents,taxCents:0}],allocations:[{propertyId:target('property',p.propertyRef),amountCents:p.amountCents,jobId:null,costClass:'operating',assetId:null}],totalCents:p.amountCents,currency:'USD',attachments:[{id:attachmentId,sha256:a.sha256}]}
  writes.push(guard(c,'NOT EXISTS(SELECT 1 FROM tt_erased_bill_files WHERE sha256=?)',a.sha256))
  add('tt_bills',{id:r.targetId,vendor_id:v.targetId,invoice_number:p.invoiceNumber,invoice_key:p.invoiceNumber.toLowerCase(),day:p.day,prepared_by:c.actor.id,revised_by:c.actor.id,created_at:c.now})
  add('tt_bill_revisions',{bill_id:r.targetId,version:1,terms:JSON.stringify(terms),sha256:sha256(JSON.stringify(terms)),prepared_by:c.actor.id,prepared_at:c.now})
  add('tt_bill_attachments',{id:attachmentId,bill_id:r.targetId,version:1,name:a.name,type:a.type,bytes:a.bytes,sha256:a.sha256,original:1,recorded_by:c.actor.id,recorded_at:c.now})
  for(const lease of rows('lease').filter(l=>l.value.propertyRef===p.propertyRef)) add('tt_bill_subjects',{kind:'bill',entity_id:r.targetId,tenancy_id:lease.targetId})
  // Legacy payables remain in the opening book. A later native approval clears this opening exactly once.
  const property=find('property',p.propertyRef),shares=[...property.value.owners].sort((a:Row,b:Row)=>b.shareBp-a.shareBp||target('owner',a.ownerRef).localeCompare(target('owner',b.ownerRef)))
  const remainder=p.amountCents-shares.reduce((n:number,s:Row)=>n+Math.floor(p.amountCents*s.shareBp/10000),0)
  shares.forEach((s:Row,i:number)=>add('tt_migration_bill_openings',{bill_id:r.targetId,property_id:property.targetId,owner_id:target('owner',s.ownerRef),amount_cents:Math.floor(p.amountCents*s.shareBp/10000)+(i===0?remainder:0),migration_id:jobId}))
 }
 for(const r of rows('work')) {
  const p=r.value,v=find('vendor',p.vendorRef),lease=find('lease',p.leaseRef),proposalId=migrationId(m.namespace,'proposal',r.ref),details={jobId:r.targetId,title:p.description,tradeName:v.value.name,tradeEmail:v.value.email,dueDate:p.dueDate,estimateCents:p.amountCents}
  add('tt_proposals',{id:proposalId,tenancy_id:lease.targetId,kind:'maintenance',payload:JSON.stringify(details),tenancy_version:1,prepared_by:c.actor.id,prepared_at:c.now})
  add('tt_maintenance_jobs',{id:r.targetId,tenancy_id:lease.targetId,proposal_id:proposalId,title:p.description,trade_name:v.value.name,trade_email:v.value.email,due_date:p.dueDate,estimate_cents:p.amountCents,prepared_by:c.actor.id,prepared_at:c.now,currency:'USD',vendor_id:v.targetId,trade:p.trade,qualification:'[]'})
 }
 for(const r of rows('schedule')) {const p=r.value;add('tt_schedules',{id:r.targetId,tenancy_id:target('lease',p.leaseRef),title:p.description,source:'seasonal',trade:p.trade,vendor_id:target('vendor',p.vendorRef),interval_months:p.intervalMonths,first_due:p.dueDate,lead_days:0,budget_cents:p.amountCents,currency:'USD',...created})}
 for(const r of rows('history')) {const p=r.value;add('tt_migration_history',{id:r.targetId,migration_id:jobId,tenancy_id:target('lease',p.leaseRef),day:p.day,kind:p.type,amount_cents:p.amountCents,delta_cents:p.deltaCents,reference:p.reference,source_ref:r.ref})}
 for(const r of [...rows('vendor_ytd'),...rows('owner_ytd')]) {
  const p=r.value;add('tt_migration_forwards',{id:r.targetId,migration_id:jobId,kind:r.kind,property_id:p.propertyRef?target('property',p.propertyRef):null,owner_id:p.ownerRef?target('owner',p.ownerRef):null,vendor_id:p.vendorRef?target('vendor',p.vendorRef):null,year:p.year,income_cents:p.incomeCents??0,expense_cents:p.expenseCents??0,reportable_cents:p.reportableCents??0,reference:p.reference})
 }
 for(const r of rows('opening')) {
  const p=r.value,propertyId=target('property',p.propertyRef),ownerId=target('owner',p.ownerRef)
  // Remove the native charge and deposit projections from the opening adjustment, never from their source records.
  const difference=`SELECT a.code AS account, COALESCE((SELECT SUM(json_extract(value,'$.debit')-json_extract(value,'$.credit')) FROM json_each(?) WHERE json_extract(value,'$.account')=a.code),0)-COALESCE((SELECT SUM(debit_cents-credit_cents) FROM tt_journal_lines WHERE property_id=? AND owner_key=? AND fund=? AND account=a.code),0) AS delta FROM tt_gl_chart a`
  const lines=`SELECT json_group_array(json_object('account',account,'debit',MAX(delta,0),'credit',MAX(-delta,0))) FROM (${difference}) WHERE delta<>0`
  writes.push(sql(c,`INSERT INTO tt_journal(id,day,property_id,owner_key,fund,source_kind,source_id,reference,lines,recorded_by,recorded_at) SELECT ?,?,?,?,?,'opening',?,?,computed,?,? FROM (SELECT (${lines}) AS computed) WHERE json_array_length(computed)>0`,r.targetId,m.cutover,propertyId,ownerId,p.fund,r.targetId,'Migration ' + jobId,c.actor.id,c.now,JSON.stringify(p.lines),propertyId,ownerId,p.fund))
  for(const l of p.lines)writes.push(guard(c,'(SELECT COALESCE(SUM(debit_cents-credit_cents),0) FROM tt_journal_lines WHERE property_id=? AND owner_key=? AND fund=? AND account=?)=?',propertyId,ownerId,p.fund,l.account,l.debit-l.credit))
 }
 for(const r of m.records) {
  const p=r.value,tenancyId=r.kind==='lease'&&!r.excluded?r.targetId:p.leaseRef&&!r.excluded?target('lease',p.leaseRef):null
  add('tt_migration_records',{migration_id:jobId,kind:r.kind,ref:r.ref,target_id:r.excluded?null:r.targetId,tenancy_id:tenancyId,disposition:r.excluded?'excluded':'imported',record:canonicalJson(p)})
 }
 return writes
}
