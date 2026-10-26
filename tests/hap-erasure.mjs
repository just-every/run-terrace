import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {readArchive} from '../src/modules/portability/index.mjs'
import {installation} from './api/harness.mjs'

const now='2040-10-26T12:00:00.000Z'
const pick=(row,keys)=>Object.fromEntries(keys.map(key=>[key,row[key]]))
const sorted=rows=>rows.sort((a,b)=>a.id.localeCompare(b.id))
async function archiveRows(archive){
 const tables=new Map()
 for await(const record of readArchive(new Blob([archive]).stream()))if(record.kind==='part')for(const item of record.items)if(item.kind==='row')tables.set(item.table,[...(tables.get(item.table)??[]),item.row])
 return table=>tables.get(table)??[]
}
const decoded=rows=>JSON.stringify(rows)+rows.flatMap(row=>Object.values(row).filter(value=>value&&typeof value==='object'&&typeof value.blob==='string').map(value=>Buffer.from(value.blob,'base64').toString())).join('\n')
function absent(text,privateText,surface){for(const value of privateText)assert.ok(!text.includes(value),`${surface} retains erased subject text: ${value}`)}
async function read(h,path){const response=await h.request(path);assert.equal(response.status,200,path);return response}
const snapshot=async h=>(await read(h,'/api/backup')).text()
const restore=(h,archive)=>h.formCommand('data.restore',{confirm:'RESTORE',backup:new File([archive],'synthetic-terrace-801.rer')})

function csvRows(bytes){
 assert.ok(bytes,'readable export includes the requested table')
 const text=bytes.toString(),lines=[]
 let row=[],cell='',quoted=false
 for(let i=0;i<text.length;i++){
  const ch=text[i]
  if(ch==='"'){
   if(quoted&&text[i+1]==='"'){cell+='"';i++}else quoted=!quoted
  }else if(ch===','&&!quoted){row.push(cell);cell=''}
  else if((ch==='\r'||ch==='\n')&&!quoted){
   row.push(cell);lines.push(row);row=[];cell=''
   if(ch==='\r'&&text[i+1]==='\n')i++
  }else cell+=ch
 }
 assert.equal(quoted,false,'readable CSV has complete quoted cells')
 if(cell||row.length){row.push(cell);lines.push(row)}
 const header=lines.shift()
 return lines.map(values=>{assert.equal(values.length,header.length);return Object.fromEntries(header.map((key,i)=>[key,values[i]]))})
}
// Readable CSV protects formula-like values, including negative financial cents.
const csvValues=row=>Object.fromEntries(Object.entries(row).map(([key,value])=>[key,value===null?'':String(value).replace(/^[=+@-]/,"'$&").replace(/^[=+@-]/,"'$&")]))

/** PAY-013 and SAFE-004 share the posted, corrected and externally receipted leases. */
export async function hapErasureFlow(backup,leases){
 const subjects=new Set(leases.map(x=>x.t.id)),rows=await archiveRows(backup)
 const tenancies=rows('tt_tenancies').filter(row=>subjects.has(row.id))
 const charges=rows('tt_charges').filter(row=>subjects.has(row.tenancy_id)),chargeIds=new Set(charges.map(row=>row.id))
 const haps=rows('tt_hap_charges').filter(row=>subjects.has(row.tenancy_id)),hapIds=new Set(haps.map(row=>row.id))
 const allocations=rows('tt_hap_allocations').filter(row=>hapIds.has(row.charge_id))
 const remittanceIds=new Set(allocations.map(row=>row.remittance_id))
 const remittances=rows('tt_hap_remittances').filter(row=>subjects.has(row.source_tenancy_id)||remittanceIds.has(row.id))
 const allRemittanceIds=new Set(remittances.map(row=>row.id))
 const batches=rows('tt_hap_allocation_batches').filter(row=>allRemittanceIds.has(row.remittance_id))
 const changes=rows('tt_hap_changes').filter(row=>subjects.has(row.tenancy_id))
 const documents=rows('tt_documents').filter(row=>subjects.has(row.tenancy_id)&&row.kind==='hap'),documentIds=new Set(documents.map(row=>row.id))
 const versions=rows('tt_document_versions').filter(row=>documentIds.has(row.document_id))
 const shared=remittances.filter(row=>[...subjects].every(id=>id===row.source_tenancy_id||allocations.some(a=>a.remittance_id===row.id&&haps.some(q=>q.id===a.charge_id&&q.tenancy_id===id))))
 assert.equal(tenancies.length,2)
 assert.ok(shared.length,'the erasure journey must include a remittance linking both subjects')
 assert.ok(['split','abatement'].every(kind=>changes.some(row=>row.kind===kind&&row.approved_at)),'approved payer changes must reach erasure')
 assert.ok(versions.length&&changes.every(row=>versions.some(v=>v.id===row.notice_version_id)))
 assert.ok(remittances.every(row=>versions.some(v=>v.id===row.source_document_version_id)),'every PHA remittance original reaches readable export')
 for(const id of subjects)assert.ok(new Set(haps.filter(row=>row.tenancy_id===id).map(row=>row.period_start.slice(0,7))).size>=3,'three posted months reach retention review')

 // Compare preserved financial identities, amounts and dates after a real archive restore.
 const financial=[
  ['tt_charges',charges,['id','tenancy_id','due_date','amount_cents','currency','term_id','period_start','period_end']],
  ['tt_hap_charges',haps,['id','tenancy_id','lease_version_id','term_id','period_start','period_end','due_date','amount_cents','currency']],
  ['tt_receipts',rows('tt_receipts').filter(row=>chargeIds.has(row.charge_id)),['id','charge_id','amount_cents','received_date','currency']],
  ['tt_hap_changes',changes.filter(c=>c.approved_at),['id','tenancy_id','kind','effective_from','effective_to','resident_cents','pha_cents','approved_at']],
  ['tt_hap_effects',rows('tt_hap_effects').filter(row=>subjects.has(row.tenancy_id)),['id','change_id','tenancy_id','resident_charge_id','hap_charge_id','resident_delta','pha_delta','posting_day','effective_from','effective_to']],
  ['tt_hap_remittances',remittances,['id','source_tenancy_id','source_document_version_id','method','currency','amount_cents','received_date','state','outcome_date','version']],
  ['tt_hap_allocations',rows('tt_hap_allocations').filter(row=>allRemittanceIds.has(row.remittance_id)),['id','batch_id','remittance_id','charge_id','amount_cents','recorded_at']],
  ['tt_hap_allocation_batches',batches,['id','remittance_id','recorded_at']],
  ['tt_journal',rows('tt_journal').filter(row=>subjects.has(row.tenancy_id)),['id','day','property_id','owner_key','tenancy_id','fund','source_kind','source_id','currency','lines','reversal_of']],
 ]
 const privateText=[...new Set([
  ...tenancies.flatMap(row=>[row.tenant_name,row.tenant_email]),
  ...haps.map(row=>row.contract_reference),...changes.flatMap(row=>[row.reason,row.reference]),
  ...remittances.flatMap(row=>[row.reference,row.outcome_reference]),...batches.map(row=>row.reference),
  ...documents.map(row=>row.title),...versions.flatMap(row=>[row.name,row.note,row.content_text]),
 ].filter(value=>typeof value==='string'&&value.length>0))]
 const originals=new Map(),h=await installation({now,bufferedTransport:true})
 let latest
 try{
  await restore(h,backup)
  for(const version of versions)originals.set(version.id,Buffer.from(await(await read(h,'/api/document?id='+version.id)).arrayBuffer()))
  const exported=Buffer.from(await(await read(h,'/api/readable-export')).arrayBuffer()),entries=new Map()
  for(let o=0;exported.readUInt32LE(o)===0x04034b50;){const n=exported.readUInt16LE(o+26),x=exported.readUInt16LE(o+28),size=exported.readUInt32LE(o+18);entries.set(exported.subarray(o+30,o+30+n).toString(),exported.subarray(o+30+n+x,o+30+n+x+size));o+=30+n+x+size}
  const manifest=JSON.parse(entries.get('manifest.json')),exportedVersions=csvRows(entries.get('tables/tt_document_versions.csv'))
  for(const version of versions){
   const record=exportedVersions.find(row=>row.id===version.id)
   assert.ok(record,'readable export includes each PHA notice and remittance version before erasure')
   const reference=/^file:(.+) sha256:([a-f0-9]{64})$/.exec(record.bytes)
   assert.ok(reference,'PHA original CSV names its file and checksum')
   const file=manifest.files.find(row=>row.path===reference[1]),original=originals.get(version.id)
   assert.ok(file,'readable manifest includes each PHA original')
   assert.deepEqual(pick(file,['table','column','size','sha256']),{table:'tt_document_versions',column:'bytes',size:original.length,sha256:version.sha256})
   assert.equal(reference[2],version.sha256,'PHA original CSV retains its recorded checksum')
   assert.deepEqual(entries.get(file.path),original,'readable export retains exact PHA notice and remittance original bytes before erasure')
   assert.equal(createHash('sha256').update(entries.get(file.path)).digest('hex'),version.sha256,'exported PHA original matches its recorded checksum')
   assert.deepEqual(record,csvValues({...version,bytes:record.bytes}),'readable export retains the PHA original version and source identity')
  }
  for(const [table,before] of financial){
   const ids=new Set(before.map(row=>row.id)),exportedRows=csvRows(entries.get('tables/'+table+'.csv')).filter(row=>ids.has(row.id))
   assert.deepEqual(sorted(exportedRows),sorted(before.map(csvValues)),table+' readable export retains exact financial rows before erasure')
  }
  const requests=[]
  for(const [index,t] of tenancies.entries())requests.push(await h.command('privacy.request',{tenancyId:t.id,kind:'erase',source:'synthetic-terrace-'+(802+index)}))
  const hold=await h.command('privacy.hold',{tenancyId:tenancies[1].id,class:'accounting',reason:'synthetic-terrace-804'})
  for(const [index,t] of tenancies.entries()){
   const {review}=await h.command('privacy.review',{tenancyId:t.id,requestId:requests[index].id})
   assert.equal(review.eligible,true,'lease evidence is old enough to erase')
   assert.equal(review.personalRetained,true,'a shared accounting hold keeps accounting identity')
   assert.ok(review.classes.find(row=>row.class==='accounting').holds.length>0)
   if(index===0){
    const partial=await h.command('tenancy.erase',{tenancyId:t.id,requestId:requests[index].id,fingerprint:review.fingerprint,confirm:t.tenant_email})
    assert.ok(partial.kept.some(row=>row.class==='accounting'))
    assert.equal(partial.alias,null)
   }
  }
  for(const version of versions)assert.deepEqual(Buffer.from(await(await read(h,'/api/document?id='+version.id)).arrayBuffer()),originals.get(version.id),'held PHA notice and remittance originals stay readable')
  const held=await archiveRows(await snapshot(h))
  assert.deepEqual(held('tt_hap_changes').filter(row=>subjects.has(row.tenancy_id)),changes,'accounting hold leaves approved PHA evidence intact')
  await h.command('privacy.release',{tenancyId:tenancies[1].id,holdId:hold.id,reason:'synthetic-terrace-805'})
  for(const [index,t] of tenancies.entries()){
   const {review}=await h.command('privacy.review',{tenancyId:t.id,requestId:requests[index].id})
   assert.equal(review.eligible,true)
   assert.equal(review.personalRetained,false)
   const result=await h.command('tenancy.erase',{tenancyId:t.id,requestId:requests[index].id,fingerprint:review.fingerprint,confirm:t.tenant_email})
   assert.match(result.alias,/^resident-/)
   assert.equal((await h.request('/api/state?tenancy='+t.id)).status,404)
   assert.equal((await h.request('/api/resident-access?tenancyId='+t.id)).status,404)
   if(index===0){
    const first=await archiveRows(await snapshot(h))
    for(const remittance of shared){
     const kept=first('tt_hap_remittances').find(row=>row.id===remittance.id)
     assert.deepEqual(pick(kept,['payer_name','reference','outcome_reference']),pick(remittance,['payer_name','reference','outcome_reference']),'shared remittance identity stays until its final linked subject is erased')
     for(const batch of batches.filter(row=>row.remittance_id===remittance.id))assert.equal(first('tt_hap_allocation_batches').find(row=>row.id===batch.id).reference,batch.reference)
    }
   }
  }
  for(const version of versions)assert.equal((await h.request('/api/document?id='+version.id)).status,404,'eligible PHA original is withdrawn')
  latest=await snapshot(h)
  const finalRows=await archiveRows(latest)
  for(const version of versions)assert.ok(!finalRows('tt_document_versions').some(row=>row.id===version.id),'erasure removes original bytes from the backup')
  for(const table of ['tt_documents','tt_document_versions'])absent(decoded(finalRows(table)),privateText,table)
  absent(latest,privateText,'backup')
  for(const path of ['/api/state','/api/documents?history=1','/api/hap-remittances','/api/history','/api/journal'])absent(await(await read(h,path)).text(),privateText,path)
  for(const t of tenancies){
   const found=await(await read(h,'/api/documents?q='+encodeURIComponent(t.tenant_name)+'&history=1')).json()
   assert.equal(found.documents.length,0,'document search no longer finds the erased resident')
  }
  const readable=Buffer.from(await(await read(h,'/api/readable-export')).arrayBuffer())
  absent(readable.toString(),privateText,'readable export')
  for(const bytes of originals.values())assert.ok(!readable.includes(bytes),'readable export has no erased PHA original bytes')
 }finally{await h.close()}

 const blocked=await installation({now,bufferedTransport:true})
 try{
  const result=await blocked.formCommand('data.restore',{confirm:'RESTORE',backup:new File([backup],'synthetic-terrace-806.rer'),journal:new File([latest],'synthetic-terrace-807.rer')},{status:409})
  assert.equal(result.error,'erasure_fence')
  assert.equal((await blocked.state()).tenancies.length,0,'older archive rejection leaves the destination empty')
 }finally{await blocked.close()}

 const restored=await installation({now,bufferedTransport:true})
 try{
  await restore(restored,latest)
  for(const t of tenancies){
   assert.equal((await restored.request('/api/state?tenancy='+t.id)).status,404)
   assert.equal((await restored.request('/api/resident-access?tenancyId='+t.id)).status,404)
  }
  // Only the deliberately hidden, permanently retained financial rows need SQL inspection.
  for(const [table,before,keys] of financial){
   const ids=new Set(before.map(row=>row.id)),after=(await restored.db.prepare('SELECT * FROM '+table).all()).results.filter(row=>ids.has(row.id))
   assert.deepEqual(sorted(after.map(row=>pick(row,keys))),sorted(before.map(row=>pick(row,keys))),table+' preserves exact financial evidence after erasure and restore')
   absent(JSON.stringify(after),privateText,table)
   if(['tt_hap_changes','tt_hap_remittances','tt_hap_allocation_batches'].includes(table))for(const row of after)assert.equal(row.reference,row.id,'retained financial source uses its opaque identity')
   for(const row of after){
    const original=before.find(value=>value.id===row.id)
    if(table==='tt_hap_charges'){
     assert.equal(row.contract_reference,row.id)
     assert.notEqual(row.payer,original.payer)
     assert.notEqual(row.source_clause,original.source_clause)
    }
    if(table==='tt_hap_changes'){
     assert.equal(row.notice_version_id,null)
     assert.notEqual(row.payer,original.payer)
     assert.notEqual(row.reason,original.reason)
    }
    if(table==='tt_hap_remittances'){
     assert.notEqual(row.payer_name,original.payer_name)
     assert.equal(row.outcome_reference,original.outcome_reference===null?null:row.id)
    }
   }
  }
  const active=(await restored.state()).tenancies.find(row=>!subjects.has(row.id))
  assert.ok(active,'exact-byte reupload is tested on a live, unrelated tenancy')
  for(const version of versions){
   const result=await restored.formCommand('document.upload',{tenancyId:active.id,kind:'hap',title:'synthetic-terrace-808',source:'synthetic-terrace-809',file:new File([originals.get(version.id)],version.name,{type:version.media_type})},{status:409})
   assert.equal(result.error,'erased_artifact','the portable artifact fence rejects identical bytes on another tenancy')
  }
 }finally{await restored.close()}
}
