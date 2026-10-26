// PORT-005: signed lease custody and complete effective obligations through the public command and read doors.
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {installation,tenancyInput} from './api/harness.mjs'
export const signedPdf=label=>({name:'signed-lease.pdf',type:'application/pdf',base64:Buffer.from(`%PDF-1.4\n1 0 obj <</Type /Catalog /Pages 2 0 R>> endobj\n2 0 obj <</Type /Pages /Kids [3 0 R] /Count 1>> endobj\n3 0 obj <</Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R>> endobj\n4 0 obj <</Length ${label.length+7}>> stream\n(${label})\nendstream endobj\ntrailer <</Root 1 0 R>>\n%%EOF`).toString('base64')})
export function leaseFields(tenancyId,effective,rent='1800',concession='150',pet='25',label='Signed original'){
 return {tenancyId,effective,signedDate:'2026-07-20',signers:['Maya Chen','Rowan Ellis'],reference:label,source:signedPdf(label),terms:[
  {kind:'rent',description:'Monthly rent',amount:rent,starts:effective,sourceClause:label+' section 2'},
  {kind:'concession',description:'Monthly concession',amount:concession,starts:effective,sourceClause:label+' addendum A'},
  {kind:'pet',description:'Cat fee',amount:pet,starts:effective,sourceClause:label+' section 8'},
  {kind:'utility',description:'Trash',amount:'40',starts:effective,sourceClause:label+' section 9'},
  {kind:'parking',description:'Parking P4',amount:'75',starts:effective,sourceClause:label+' section 10'},
 ],obligations:[
  {kind:'deposit',details:'Refundable deposit; no collection claimed',amount:'1800'},
  {kind:'pet',details:'One indoor cat; no additional animals'},
  {kind:'utility',details:'Resident pays electric; fixed trash charge'},
  {kind:'parking',details:'Space P4'},
  {kind:'insurance',details:'Resident maintains $100,000 liability coverage'},
  {kind:'addendum',details:'Concession addendum A retained in signed original'},
  {kind:'hap',details:'none'},
 ].map(x=>({...x,starts:effective,sourceClause:label+' '+x.kind}))}
}
export async function journey({inspect,assets=false}={}) {
 const h=await installation({assets})
 try {
  const portfolio=await h.command('portfolio.add',{name:'East Bay Homes'})
  const property=await h.command('property.add',{portfolioId:portfolio.id,name:'Alder Court',address:'1840 Alder Street, Oakland, CA',kind:'duplex',timeZone:'America/Los_Angeles'})
  const unit=await h.command('unit.add',{propertyId:property.id,identifier:'2B',bedrooms:2,bathrooms:1})
  const t=await h.command('tenancy.create',{...tenancyInput,unitId:unit.id,tenantName:'Maya Chen',tenantEmail:'maya@example.test',startDate:'2026-08-01',endDate:'2027-07-31',rent:'1800',cadence:'monthly'})
  const input=leaseFields(t.id,'2026-08-01'),first=await h.command('lease.prepare',input)
  assert.equal((await h.state(t.id)).ledger.charges.length,0,'recording signed terms does not post money')
  const august=await h.command('lease.preview',{leaseId:first.leaseId,month:'2026-08'})
  assert.deepEqual(august.lines.map(x=>[x.kind,x.amountCents]),[['rent',180000],['utility',4000],['pet',2500],['parking',7500],['concession',15000]])
  await h.command('lease.approve',{leaseId:first.leaseId,month:'2026-08',fingerprint:'outdated'},{status:409})
  const initialApproval=await h.command('lease.approve',{leaseId:first.leaseId,month:'2026-08',fingerprint:august.fingerprint})
  assert.ok(initialApproval.approvalLabel,'sole-operator approval is honestly labelled')
  let run=await h.command('charges.preview',{month:'2026-08'})
  assert.deepEqual(run.lines,august.lines,'approved terms produce exactly the previewed charge references, cents, dates and clauses')
  await h.command('charges.post',{month:run.month,fingerprint:run.fingerprint})
  const augustState=await h.state(t.id),originalBytes=Buffer.from(input.source.base64,'base64')
  const source=await h.request('/api/lease-source?id='+first.leaseId)
  assert.deepEqual(Buffer.from(await source.arrayBuffer()),originalBytes)
  assert.equal(source.headers.get('cache-control'),'private, no-store');assert.ok(source.headers.get('content-security-policy').includes('sandbox'))
  let versions=augustState.leaseVersions
  assert.equal(versions[0].source_sha256,createHash('sha256').update(originalBytes).digest('hex'))
  assert.equal(versions[0].payload.obligations.length,7)
  assert.equal((await h.request('/api/lease-source?id='+first.leaseId,{as:''})).status,401)
  await h.command('term.add',{tenancyId:t.id,kind:'rent',description:'Unreviewed bypass',amount:'3000',starts:'2026-10-01'},{status:409})
  await h.command('term.amend',{termId:run.lines.find(x=>x.kind==='rent').termId,amount:'3000',effective:'2026-09-01'},{status:409})
  const manager=await h.invite('admin','leases-manager@example.test'),member=await h.invite('member','leases-member@example.test')
  const amendedInput=leaseFields(t.id,'2026-09-16','2100','100','35','Signed amendment September 16')
  amendedInput.obligations.find(x=>x.kind==='hap').details='Housing assistance agreement, effective September 16'
  Object.assign(amendedInput.obligations.find(x=>x.kind==='hap'),{housingAuthority:'Oakland Housing Authority',reference:'OHA-HAP-2026-2B',tenantPortion:'600',hapPortion:'1500'})
  await h.command('lease.prepare',amendedInput,{as:member,status:403})
  await h.command('lease.prepare',{...amendedInput,source:{...input.source,type:'image/png'}},{status:400})
  await h.command('lease.prepare',{...amendedInput,obligations:amendedInput.obligations.filter(x=>x.kind!=='insurance')},{status:400})
  const amendment=await h.command('lease.prepare',amendedInput),stale=await h.command('lease.prepare',{...amendedInput,reference:'Competing signed amendment'})
  const preview=await h.command('lease.preview',{leaseId:amendment.leaseId,month:'2026-09'})
  assert.deepEqual(preview.lines.filter(x=>x.kind==='rent').map(x=>[x.amountCents,x.coveredDays,x.periodDays]),[[90000,15,30],[30000,15,30]])
  assert.deepEqual(preview.lines.filter(x=>x.kind==='hap').map(x=>[x.amountCents,x.coveredDays,x.periodDays]),[[75000,15,30]],'the full amendment rent is preserved across resident and PHA receivables')
  assert.deepEqual(preview.lines.filter(x=>x.kind==='concession').map(x=>x.amountCents),[7500,5000],'each concession reduces rent for its own effective interval')
  assert.ok(preview.lines.every(x=>x.sourceClause&&x.leaseVersionId))
  await h.command('lease.approve',{leaseId:amendment.leaseId,month:'2026-09',fingerprint:preview.fingerprint},{status:403})
  await h.command('lease.approve',{leaseId:amendment.leaseId,month:'2026-09',fingerprint:preview.fingerprint},{as:member,status:403})
  await h.command('lease.approve',{leaseId:amendment.leaseId,month:'2026-09',fingerprint:preview.fingerprint},{as:manager})
  await h.command('lease.preview',{leaseId:stale.leaseId,month:'2026-09'},{status:409})
  run=await h.command('charges.preview',{month:'2026-09'})
  assert.deepEqual(run.lines,preview.lines)
  await h.command('charges.post',{month:run.month,fingerprint:run.fingerprint})
  const replay=await h.command('charges.preview',{month:'2026-09'});assert.equal(replay.newLines,0)
  const state=await h.state(t.id)
  const september=state.ledger.charges.filter(q=>q.period_start==='2026-09-01')
  assert.equal([...september,...state.ledger.hapCharges.filter(q=>q.period_start==='2026-09-01')].reduce((n,q)=>n+q.amount_cents,0),209500)
  assert.equal(state.ledger.adjustments.filter(a=>september.some(q=>q.id===a.charge_id)).reduce((n,a)=>n+a.amount_cents,0),12500)
  for(const l of run.lines.filter(x=>x.kind!=='concession')) {
   const row=[...september,...state.ledger.hapCharges].find(q=>q.reference===l.reference)
   assert.deepEqual([row.amount_cents,row.source_clause,row.lease_version_id],[l.amountCents,l.kind==='hap'?l.hapClause:l.sourceClause,l.leaseVersionId])
  }
  assert.deepEqual(state.ledger.charges.filter(q=>q.period_start==='2026-08-01'),augustState.ledger.charges,'prior posted amounts and references stay unchanged')
  versions=state.leaseVersions;assert.equal(versions.filter(v=>v.approved_at).length,2)
  const hap=versions.find(v=>v.id===amendment.leaseId).payload.obligations.find(x=>x.kind==='hap')
  assert.deepEqual([hap.housingAuthority,hap.reference,hap.tenantPortionCents,hap.hapPortionCents],['Oakland Housing Authority','OHA-HAP-2026-2B',60000,150000])
  assert.deepEqual(versions.find(v=>v.id===first.leaseId).payload,augustState.leaseVersions[0].payload,'signed prior version retained exactly')
  assert.deepEqual(Buffer.from(await(await h.request('/api/lease-source?id='+first.leaseId)).arrayBuffer()),originalBytes)
  const late=await h.command('lease.prepare',leaseFields(t.id,'2026-09-20','2200','100','35','Backdated into posted September'))
  await h.command('lease.preview',{leaseId:late.leaseId,month:'2026-09'},{status:409})
  const staff=await(await h.request('/auth/operators')).json();await h.stepUp()
  const memberId=staff.find(x=>x.email==='leases-member@example.test').id
  await h.command('operator.role',{operatorId:memberId,role:'accountant',portfolioIds:[portfolio.id]})
  assert.equal((await h.request('/api/lease-source?id='+first.leaseId,{as:member})).status,200)
  await h.command('lease.prepare',amendedInput,{as:member,status:403})
  const outsider=await h.command('portfolio.add',{name:'Other portfolio'})
  await h.command('operator.role',{operatorId:memberId,role:'accountant',portfolioIds:[outsider.id]})
  assert.equal((await h.request('/api/lease-source?id='+first.leaseId,{as:member})).status,404)
  assert.equal((await h.request('/api/state?tenancy='+t.id,{as:member})).status,404)
  await h.command('operator.role',{operatorId:memberId,role:'leasing',portfolioIds:[portfolio.id]})
  assert.equal((await h.request('/api/lease-source?id='+first.leaseId,{as:member})).status,403)
  const leasing=await(await h.request('/api/state?tenancy='+t.id,{as:member})).json()
  assert.ok(leasing.leaseVersions.length);assert.ok(leasing.leaseVersions.every(v=>v.payload.terms.length===0))
  assert.ok(!JSON.stringify(leasing.leaseVersions).includes('amountCents'))
  assert.ok(!JSON.stringify(leasing.leaseVersions).includes('tenantPortionCents'))
  const history=await(await h.request('/api/history?tenancyId='+t.id)).json()
  assert.ok(history.rows.some(x=>x.action==='lease.approve'&&x.actor!==versions.find(v=>v.id===amendment.leaseId).prepared_by))
  assert.ok(history.rows.some(x=>x.action==='lease.source'&&x.outcome==='read'))
  const bytes=Buffer.from(await(await h.request('/api/readable-export')).arrayBuffer()),entries=new Map()
  for(let o=0;bytes.readUInt32LE(o)===0x04034b50;){const n=bytes.readUInt16LE(o+26),x=bytes.readUInt16LE(o+28),size=bytes.readUInt32LE(o+18);entries.set(bytes.subarray(o+30,o+30+n).toString(),bytes.subarray(o+30+n+x,o+30+n+x+size));o+=30+n+x+size}
  const manifest=JSON.parse(entries.get('manifest.json'))
  const pdfFile=manifest.files.find(f=>f.table==='tt_lease_sources'&&f.sha256===versions.find(v=>v.id===first.leaseId).source_sha256)
  assert.ok(pdfFile.path.endsWith('.pdf'));assert.deepEqual(entries.get(pdfFile.path),originalBytes)
  const backup=await(await h.request('/api/backup')).text(),fresh=await installation()
  try {
   await fresh.formCommand('data.restore',{confirm:'RESTORE',backup:new File([backup],'lease.rer')})
   assert.deepEqual((await fresh.state(t.id)).leaseVersions,(await h.state(t.id)).leaseVersions)
   assert.deepEqual(Buffer.from(await(await fresh.request('/api/lease-source?id='+first.leaseId)).arrayBuffer()),originalBytes)
  }finally{await fresh.close()}
  await legacyConcession(h)
  await preserveImportedSource(h)
  await erasure(h)
  if(inspect)await inspect({h,t,manager,input,amendedInput,first,amendment})
 }finally{await h.close()}
}
async function erasure(h){
 const old=await h.command('tenancy.create',{...tenancyInput,startDate:'2010-01-01',endDate:'2011-12-31',tenantEmail:'historic-lease@example.test',cadence:'monthly'})
 const fields=leaseFields(old.id,'2010-01-01');fields.signedDate='2009-12-20';fields.source=signedPdf('Historic signed original')
 const v=await h.command('lease.prepare',fields),preview=await h.command('lease.preview',{leaseId:v.leaseId,month:'2010-01'})
 const hold=await h.command('privacy.hold',{tenancyId:old.id,class:'lease',reason:'Retain signed original for case'})
 const erase=async(status)=>{const r=await h.command('privacy.request',{tenancyId:old.id,kind:'erase',source:'Former resident request'}),review=await h.command('privacy.review',{tenancyId:old.id,requestId:r.id});return h.command('tenancy.erase',{tenancyId:old.id,requestId:r.id,fingerprint:review.review.fingerprint,confirm:'historic-lease@example.test'},status?{status}:{})}
 await erase(409);assert.equal((await h.request('/api/lease-source?id='+v.leaseId)).status,200)
 const older=await(await h.request('/api/backup')).text()
 await h.command('privacy.release',{tenancyId:old.id,holdId:hold.id,reason:'Case ended'})
 await erase();assert.equal((await h.request('/api/lease-source?id='+v.leaseId)).status,404)
 const later=await(await h.request('/api/backup')).text()
 const other=await h.command('tenancy.create',{...tenancyInput,startDate:'2010-01-01',endDate:'2011-12-31',tenantEmail:'other-lease@example.test',cadence:'monthly'})
 assert.equal((await h.command('lease.prepare',{...fields,tenancyId:other.id},{status:409})).error,'erased_artifact')
 const fresh=await installation()
 try{await fresh.formCommand('data.restore',{confirm:'RESTORE',backup:new File([older],'older.rer'),journal:new File([later],'later.rer')},{status:409})}finally{await fresh.close()}
}

/** A prepared signed version is later operating work even before its charges are approved. */
async function preserveImportedSource(h){
 const csv=['ref,address,owner_name,owner_email,tenant_name,tenant_email,start_date,end_date,rent,cadence,created_at,currency,time_zone','IMPORTED-LEASE,1840 Alder Street Oakland,Rowan Ellis,rowan@example.test,Maya Chen,maya-import@example.test,2026-08-01,2027-07-31,1800.00,monthly,2026-08-01T00:00:00.000Z,USD,America/Los_Angeles'].join('\n')
 const preview=await h.command('import.preview',{csv,namespace:'signed-import'})
 const applied=await h.command('import.apply',{csv,namespace:'signed-import',fingerprint:preview.fingerprint})
 const t=(await h.state()).tenancies.find(t=>t.tenant_email==='maya-import@example.test')
 const v=await h.command('lease.prepare',leaseFields(t.id,'2026-08-01'))
 await h.command('import.undo',{jobId:applied.job.id},{status:409})
 assert.equal((await h.request('/api/lease-source?id='+v.leaseId)).status,200,'PORT-005 signed source survives refused import undo')
 assert.ok((await h.state(t.id)).leaseVersions.some(x=>x.id===v.leaseId))
}

/** Existing unsigned terms still keep a full concession when rent changes within a period. */
async function legacyConcession(h){
 const t=await h.command('tenancy.create',{...tenancyInput,tenantEmail:'legacy-concession@example.test',startDate:'2026-08-01',endDate:'2027-07-31',cadence:'monthly'})
 const rent=await h.command('term.add',{tenancyId:t.id,kind:'rent',description:'Original rent',amount:'1800',starts:'2026-08-01'})
 await h.command('term.add',{tenancyId:t.id,kind:'concession',description:'Existing concession',amount:'150.01',starts:'2026-08-01'})
 await h.command('term.amend',{termId:rent.id,effective:'2026-09-16',amount:'2100'})
 const run=await h.command('charges.preview',{month:'2026-09'})
 assert.equal(run.missing.length,0)
 assert.deepEqual(run.lines.filter(x=>x.tenancyId===t.id&&x.kind==='concession').map(x=>x.amountCents),[7501,7500],'PAY-001 keeps the once-rounded concession total, with the remainder on the earlier equal segment')
 await h.command('charges.post',{month:run.month,fingerprint:run.fingerprint})
 assert.equal((await h.state(t.id)).ledger.balanceCents,195000-15001)
 assert.equal((await h.command('charges.preview',{month:'2026-09'})).newLines,0)
 await h.command('term.add',{tenancyId:t.id,kind:'concession',description:'Excessive concession held',amount:'5000',starts:'2026-09-01',ends:'2026-09-30'})
 const held=await h.command('charges.preview',{month:'2026-09'})
 assert.ok(held.missing.some(x=>x.tenancyId===t.id&&x.reason.startsWith('Concession')))
 assert.equal((await h.command('charges.post',{month:held.month,fingerprint:held.fingerprint},{status:409})).error,'concession_hold')
 assert.equal((await h.state(t.id)).ledger.balanceCents,195000-15001)
}
