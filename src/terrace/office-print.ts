import {all,allow,audit,commit,guard,id,insist,one,sha256,sql,tenancyGuard,text,type Context,type Row} from './core'
import {staffThread,threadAccess,liveThreadGrant,recipientFence} from './portal-threads'
import {threadEvent} from './thread-events'
import {textPdf,type PdfParagraph} from './resident-pdf'

export const PRINT_COMMANDS=['thread.print.prepare','thread.print.approve']
const digest=(value:string)=>sha256(new TextEncoder().encode(value))
const missing=(value:unknown)=>insist(value,'not_found','Print preparation not found.',404)
const blob=(value:any)=>new Uint8Array(value)

async function source(c:Context,threadId:string){
 const {r,t}=await staffThread(c,threadId),g=await liveThreadGrant(c,r,t)
 missing(g)
 insist(r.kind!=='conversation'&&r.approved_at,'print_approval','Approve the exact notice before preparing office print.',409)
 let address=t.address
 if(g!.access==='owner')address=(await one(c,'SELECT mailing_address FROM tt_owners WHERE id=?',g!.owner_id))?.mailing_address
 insist(['resident','delegate','owner'].includes(g!.access)&&address,'postal_address','A recorded postal address for this recipient is required. No document was prepared.',409)
 const originals=await all(c,'SELECT id,sequence,body,filename,media_type,sha256,bytes FROM tt_thread_entries WHERE thread_id=? AND private=0 ORDER BY sequence',r.id)
 const entries=[]
 for(const e of originals){
  const actual=e.bytes==null?null:await sha256(blob(e.bytes))
  insist(actual===e.sha256,'original_changed','The approved original failed its checksum. Prepare and review a new notice.',409)
  if(actual)insist(!await one(c,'SELECT 1 FROM tt_erased_document_files WHERE sha256=?',actual),'erased_artifact','This original was erased.',409)
  entries.push({id:e.id,sequence:e.sequence,body:e.body,filename:e.filename,mediaType:e.media_type,sha256:actual})
 }
 const approval=await one(c,"SELECT after_revision FROM tt_thread_events WHERE thread_id=? AND action='thread.approve' ORDER BY at,id LIMIT 1",r.id)
 const snapshot=JSON.stringify({threadId:r.id,tenancyId:t.id,noticeRevision:approval?.after_revision??null,fingerprint:r.fingerprint,subject:r.subject,kind:r.kind,deadline:r.deadline,consentReference:r.consent_reference,approvedBy:r.approved_by,approvedAt:r.approved_at,grantId:r.grant_id,identityId:r.identity_id,recipientKey:r.recipient_key,memberId:r.recipient_member_id,recipient:r.recipient_name,currentName:g!.display_name,currentDestination:await digest(g!.email),address,propertyAddress:t.address,unitId:t.unit_id,timeZone:t.time_zone,entries})
 return {r,t,g:g!,snapshot}
}
function paragraphs(snapshot:string):PdfParagraph[]{
 const s=JSON.parse(snapshot)
 return [{role:'H1',text:s.subject,pageBreak:true},{role:'P',text:s.recipient},{role:'P',text:s.address},...s.entries.flatMap((e:Row)=>[{role:'P',text:e.body},...(e.sha256?[{role:'P',text:`Retained original: ${e.filename}. SHA-256 ${e.sha256}.`}]:[])]),{role:'P',text:'Office print preparation. A printed page is not evidence of service.'},{role:'P',text:`Notice source ${s.threadId}. Exact approved content ${s.fingerprint}.`}]
}
const sourceGuards=(c:Context,s:Awaited<ReturnType<typeof source>>)=>[tenancyGuard(c,s.t),recipientFence(c,s.g,s.t),guard(c,'EXISTS(SELECT 1 FROM tt_threads WHERE id=? AND version=? AND fingerprint=? AND approved_at=?)',s.r.id,s.r.version,s.r.fingerprint,s.r.approved_at)]

async function batch(c:Context,value:unknown,live=false){
 threadAccess(c)
 const b=await one(c,'SELECT * FROM tt_print_batches WHERE id=?',text(value,'Print batch',100));missing(b)
 const items=await all(c,'SELECT * FROM tt_print_items WHERE batch_id=? ORDER BY position',b!.id);missing(items.length)
 const sources=[]
 for(const item of items){
  await staffThread(c,item.thread_id)
  if(live){const s=await source(c,item.thread_id);insist(s.snapshot===item.snapshot,'print_changed','Recipient, approved notice or original changed. Prepare and approve a new print batch.',409);sources.push(s)}
 }
 if(live){
  insist(b!.installation===await digest(c.secret??''),'restored_print','Restored print evidence has no print authority. Invite recipients and prepare a new batch.',409)
  if(!b!.retired_at){
   insist(await digest(b!.manifest)===b!.manifest_sha256&&await sha256(blob(b!.pdf_bytes))===b!.pdf_sha256,'print_changed','The frozen print batch failed its checksum.',409)
   const manifest=JSON.parse(b!.manifest)
   insist(manifest.pdfSha256===b!.pdf_sha256&&manifest.items.length===items.length,'print_changed','The frozen print manifest does not match the batch.',409)
   for(const [index,item]of items.entries())insist(manifest.items[index].id===item.id&&manifest.items[index].pdfSha256===item.pdf_sha256,'print_changed','The frozen print manifest does not match its recipient.',409)
  }
  for(const item of items){
   insist(await sha256(blob(item.pdf_bytes))===item.pdf_sha256,'print_changed','A frozen recipient PDF failed its checksum.',409)
   insist(!await one(c,'SELECT 1 FROM tt_erased_document_files WHERE sha256=?',item.pdf_sha256),'erased_artifact','This recipient original was erased.',409)
  }
 }
 return {b:b!,items,sources}
}

export async function printCommand(c:Context,command:string,p:Row):Promise<Row|undefined>{
 if(!PRINT_COMMANDS.includes(command))return
 threadAccess(c);allow(c,command)
 if(command==='thread.print.prepare'){
  const primary=await source(c,text(p.threadId,'Notice',100))
  insist(Number(p.version)===primary.r.version&&p.fingerprint===primary.r.fingerprint,'conflict','Reload the exact approved notice before preparing print.',409)
  const reference=text(p.reference,'Print preparation reference',500)
  const ids=p.allRecipients==='1'?(await all(c,'SELECT id FROM tt_threads WHERE batch_id=? ORDER BY id',primary.r.batch_id)).map(r=>r.id):[primary.r.id]
  const sources=[]
  for(const threadId of ids)sources.push(threadId===primary.r.id?primary:await source(c,threadId))
  const key=id(),items=[]
  for(const [position,s]of sources.entries()){
   const bytes=textPdf(s.r.subject,paragraphs(s.snapshot)),hash=await sha256(bytes)
   insist(!await one(c,'SELECT 1 FROM tt_erased_document_files WHERE sha256=?',hash),'erased_artifact','An identical print original was erased.',409)
   items.push({id:id(),position,threadId:s.r.id,snapshot:s.snapshot,bytes,hash})
  }
  const bytes=textPdf('Office print batch',sources.flatMap(s=>paragraphs(s.snapshot))),pdfHash=await sha256(bytes)
  insist(!await one(c,'SELECT 1 FROM tt_erased_document_files WHERE sha256=?',pdfHash),'erased_artifact','An identical print batch was erased.',409)
  const manifestItems=await Promise.all(items.map(async item=>({id:item.id,position:item.position,threadId:item.threadId,recipient:JSON.parse(item.snapshot).recipient,address:JSON.parse(item.snapshot).address,noticeFingerprint:JSON.parse(item.snapshot).fingerprint,sourceSha256:await digest(item.snapshot),pdfSha256:item.hash})))
  const exactManifest=JSON.stringify({format:'terrace-office-print',version:1,id:key,preparedAt:c.now,preparedBy:c.actor.id,reference,pdfSha256:pdfHash,items:manifestItems}),manifestHash=await digest(exactManifest)
  c.source=manifestHash
  await commit(c,[...sources.flatMap(s=>sourceGuards(c,s)),sql(c,'INSERT INTO tt_print_batches(id,manifest,manifest_sha256,pdf_sha256,pdf_bytes,installation,prepared_by,prepared_at) VALUES(?,?,?,?,?,?,?,?)',key,exactManifest,manifestHash,pdfHash,bytes,await digest(c.secret??''),c.actor.id,c.now),...items.map(item=>sql(c,'INSERT INTO tt_print_items(id,batch_id,thread_id,position,snapshot,pdf_sha256,pdf_bytes) VALUES(?,?,?,?,?,?,?)',item.id,key,item.threadId,item.position,item.snapshot,item.hash,item.bytes)),...sources.map(s=>audit({...c,tenancyId:s.t.id},command,s.r.id)),...sources.map(s=>threadEvent(c,s.r,command,s.r.version,s.r.version,'Froze recipient PDF and manifest for exact human print approval.',manifestHash))],command,key)
  return {id:key,printBatchId:key,manifestSha256:manifestHash,pdfSha256:pdfHash,tenancyId:primary.t.id,tab:'messages',notice:'Print originals frozen for review. Nothing mailed or recorded as served.'}
 }
 const {b,sources}=await batch(c,p.printBatchId,true)
 insist(!b.retired_at,'print_retired','The combined print batch was retired by erasure. Prepare and review a new batch.',409)
 insist(p.manifestSha256===b.manifest_sha256&&p.pdfSha256===b.pdf_sha256&&p.consent==='APPROVE EXACT PRINT','print_approval','Approve the exact manifest and PDF hashes.',409)
 const reference=text(p.reference,'Exact print approval reference',500)
 insist(!await one(c,'SELECT 1 FROM tt_print_approvals WHERE batch_id=?',b.id),'print_approved','This exact print batch is already approved.',409)
 c.source=b.manifest_sha256
 await commit(c,[...sources.flatMap(s=>sourceGuards(c,s)),sql(c,'INSERT INTO tt_print_approvals(batch_id,manifest_sha256,pdf_sha256,actor,at,reference) VALUES(?,?,?,?,?,?)',b.id,b.manifest_sha256,b.pdf_sha256,c.actor.id,c.now,reference),...sources.map(s=>audit({...c,tenancyId:s.t.id},command,s.r.id)),...sources.map(s=>threadEvent(c,s.r,command,s.r.version,s.r.version,'Approved the exact recipient PDFs and office-print manifest hashes.',b.manifest_sha256))],command,b.id)
 return {id:b.id,printBatchId:b.id,tenancyId:sources[0].t.id,tab:'messages',notice:'Exact print hashes approved. Downloading records no mailing or service.'}
}

export async function printData(c:Context,threadId:string){
 await staffThread(c,threadId)
 const ids=await all(c,'SELECT DISTINCT batch_id FROM tt_print_items WHERE thread_id=? ORDER BY batch_id',threadId),result=[]
 for(const row of ids){
  const {b,items}=await batch(c,row.batch_id)
  const approval=await one(c,'SELECT actor,at,reference,manifest_sha256,pdf_sha256 FROM tt_print_approvals WHERE batch_id=?',b.id)
  result.push({id:b.id,manifest:b.retired_at?null:JSON.parse(b.manifest),retired:!!b.retired_at,manifest_sha256:b.manifest_sha256,pdf_sha256:b.pdf_sha256,prepared_by:b.prepared_by,prepared_at:b.prepared_at,approved:!!approval,approval,inert:b.installation!==await digest(c.secret??''),items:items.map(item=>({id:item.id,thread_id:item.thread_id,position:item.position,pdf_sha256:item.pdf_sha256,recipient:JSON.parse(item.snapshot).recipient,address:JSON.parse(item.snapshot).address}))})
 }
 return result
}

export async function printFile(c:Context,q:URLSearchParams|Row){
 const get=(key:string)=>q instanceof URLSearchParams?q.get(key):q[key]
 const {b,items}=await batch(c,get('id'),true),review=get('review')==='1'
 if(get('item'))missing(items.some(item=>item.id===get('item')))
 insist(!b.retired_at||get('item')&&get('manifest')!=='1','print_retired','The combined PDF and manifest were erased. Only retained recipient originals remain available.',409)
 if(!review){const approval=await one(c,'SELECT * FROM tt_print_approvals WHERE batch_id=?',b.id);insist(approval&&approval.manifest_sha256===b.manifest_sha256&&approval.pdf_sha256===b.pdf_sha256,'print_approval','Exact human print approval is required before downloading for office printing.',409)}
 let bytes=blob(b.pdf_bytes),hash=b.pdf_sha256,type='application/pdf',filename='terrace-office-print.pdf'
 if(get('manifest')==='1'){bytes=new TextEncoder().encode(b.manifest);hash=b.manifest_sha256;type='application/json';filename='terrace-print-manifest.json'}
 else if(get('item')){const item=items.find(i=>i.id===get('item'));missing(item);bytes=blob(item!.pdf_bytes);hash=item!.pdf_sha256;filename='terrace-recipient-notice.pdf'}
 c.source=hash
 await audit(c,review?'read:thread-print-review':'read:thread-print',b.id).run()
 return new Response(bytes,{headers:{'content-type':type,'content-disposition':(review?'inline':'attachment')+'; filename="'+filename+'"','cache-control':'private, no-store','x-content-type-options':'nosniff','content-security-policy':"default-src 'none'; sandbox"}})
}

/** Service recording may cite a current approved batch without recording a print as service. */
export async function validatePrint(c:Context,batchId:string,threadId:string){
 const {b,items}=await batch(c,batchId,true)
 insist(!b.retired_at,'print_retired','A retired batch cannot authorize new service. Prepare and approve a new batch.',409)
 missing(items.some(item=>item.thread_id===threadId))
 const approval=await one(c,'SELECT * FROM tt_print_approvals WHERE batch_id=?',b.id)
 insist(approval&&approval.manifest_sha256===b.manifest_sha256&&approval.pdf_sha256===b.pdf_sha256,'print_approval','Exact human print approval is required.',409)
 return b
}
