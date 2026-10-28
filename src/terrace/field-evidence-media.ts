// PORT-009: all record reach and role checks run again at each upload/read door.
import {all,allow,can,reaches,commit,date,guard,id,insist,one,recordRead,sha256,sql,tenancy,text,type Context,type Row} from './core'
import {bill,billGuard} from './bills-input'
import {scan} from './document-scan'
export const MEDIA_COMMANDS=['media.begin','media.chunk','media.finish','media.abort']
export const CHUNK=262144, MEDIA_LIMIT=25*1024*1024
const columns:Record<string,string>={inspection:'inspection_id',work:'job_id',invoice:'bill_id'}
export function mediaTarget(r:Row) {return r.inspection_id?{kind:'inspection',recordId:r.inspection_id}:r.job_id?{kind:'work',recordId:r.job_id}:{kind:'invoice',recordId:r.bill_id}}
export async function mediaRecord(c:Context,kind:string,value:unknown,write=false) {
 const column=Object.hasOwn(columns,kind)?columns[kind]:undefined;insist(column,'media_kind','Choose inspection, work or invoice.')
 const key=text(value,'Record',100)
 if(kind==='invoice') {allow(c,write?'bill.attach':'bills.read');const b=await bill(c,key);return {column,row:b,guards:[billGuard(c,b)]}}
 allow(c,write?(kind==='inspection'?'inspection.photo':'maintenance.prepare'):'work.read')
 const r=await one(c,`SELECT * FROM ${kind==='inspection'?'tt_inspections':'tt_maintenance_jobs'} WHERE id=?`,key)
 insist(r,'not_found','Record not found.',404);await tenancy(c,r.tenancy_id)
 return {column,row:r,guards:[guard(c,`EXISTS(SELECT 1 FROM ${kind==='inspection'?'tt_inspections':'tt_maintenance_jobs'} WHERE id=? AND version=?)`,r.id,r.version)]}
}
export async function mediaRows(c:Context,kind:string,key:unknown) {
 const {column,row}=await mediaRecord(c,kind,key)
 return all(c,`SELECT id,attachment_id,version,name,media_type,size,sha256,source,captured_at,uploaded_by,uploaded_at FROM tt_record_media WHERE ${column}=? AND state='ready' ORDER BY attachment_id,version DESC`,row.id)
}
export async function mediaBytes(c:Context,r:Row) {
 const chunks=await all(c,'SELECT position,bytes,sha256 FROM tt_record_media_chunks WHERE media_id=? ORDER BY position',r.id),out=new Uint8Array(r.size)
 let at=0
 for(const [i,p] of chunks.entries()) {const b=new Uint8Array(p.bytes);insist(p.position===i&&at+b.length<=out.length&&await sha256(b)===p.sha256,'media_integrity','Original chunks do not verify.',409);out.set(b,at);at+=b.length}
 insist(at===r.size&&await sha256(out)===r.sha256,'media_integrity','Original bytes do not verify.',409)
 return out
}
async function checkedType(bytes:Uint8Array,type:string,kind:string) {
 const video=type==='video/mp4'||type==='video/quicktime'||type==='video/webm'
 insist(kind!=='inspection'||video||type.startsWith('image/'),'media_type','Inspection evidence must be JPEG, PNG, MP4, QuickTime or WebM.')
 if(video) {
  const s=new TextDecoder('latin1').decode(bytes.subarray(0,32))
  insist(type==='video/webm'?[0x1a,0x45,0xdf,0xa3].every((b,i)=>bytes[i]===b):s.slice(4,8)==='ftyp','media_type','Video contents do not match the declared container.')
  // No external scanner or transcoding: retain originals and serve as a sandboxed download.
 } else {
  // Existing static screen is bounded to 5 MB; screen large raster signatures without sending bytes elsewhere.
  if(bytes.length>5*1024*1024) {
   insist(type==='image/png'?[137,80,78,71,13,10,26,10].every((b,i)=>bytes[i]===b):type==='image/jpeg'&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255,'media_type','Large files must be JPEG, PNG or video.')
  } else {const check=await scan(bytes,type);insist(check.ok,'media_refused',check.ok?'':check.reason,422)}
 }
}
export async function mediaCommand(c:Context,command:string,p:Row):Promise<Row|undefined> {
 if(!MEDIA_COMMANDS.includes(command))return
 allow(c,command)
 if(command==='media.begin') {
  const kind=String(p.kind),target=await mediaRecord(c,kind,p.recordId,true),size=Number(p.size),digest=text(p.sha256,'SHA-256',64)
  insist(Number.isSafeInteger(size)&&size>0&&size<=MEDIA_LIMIT,'media_size','Each original is at most 25 MB. Upload in 256 KB chunks.')
  insist(/^[a-f0-9]{64}$/.test(digest),'media_hash','Use the original file’s SHA-256.')
  insist(!await one(c,'SELECT 1 FROM tt_erased_media_files WHERE sha256=?',digest),'erased_media','This original was erased and cannot be re-uploaded.',409)
  const previous=p.attachmentId?await one(c,`SELECT * FROM tt_record_media WHERE attachment_id=? AND state='ready' ORDER BY version DESC LIMIT 1`,text(p.attachmentId,'Attachment',100)):null
  if(p.attachmentId)insist(previous&&previous[target.column]===target.row.id&&previous.version===Number(p.version),'media_version','Review the latest attachment version on this record.',409)
  const key=id(),version=previous?previous.version+1:1,attachment=previous?.attachment_id??key
  const type=text(p.mediaType,'Media type',100)
  insist(type.startsWith('image/')||type.startsWith('video/')||size<=5*1024*1024,'media_size','Document originals are at most 5 MB; photos and video are at most 25 MB.')
  insist(['image/png','image/jpeg','video/mp4','video/quicktime','video/webm','application/pdf','text/plain','text/csv','message/rfc822'].includes(type),'media_type','This media type is not supported.')
  await commit(c,[...target.guards,sql(c,`INSERT INTO tt_record_media(id,attachment_id,version,${target.column},name,media_type,size,sha256,source,captured_at,uploaded_by,uploaded_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`,key,attachment,version,target.row.id,text(p.name,'Filename',255),type,size,digest,text(p.source,'Original source',500),date(p.capturedAt,'Capture date'),c.actor.id,c.now)],command,target.row.id)
  return {id:key,attachmentId:attachment,version,chunkSize:CHUNK,notice:'Upload started. No attachment is published until every chunk and the original hash verify.'}
 }
 const r=await one(c,'SELECT * FROM tt_record_media WHERE id=?',text(p.uploadId,'Upload',100));insist(r,'not_found','Upload not found.',404)
 const target=await mediaRecord(c,mediaTarget(r).kind,mediaTarget(r).recordId,true)
 insist(r.uploaded_by===c.actor.id,'not_found','Upload not found.',404)
 if(command==='media.finish'&&r.state==='ready')return {id:r.id,attachmentId:r.attachment_id,version:r.version,sha256:r.sha256,replayed:true}
 insist(r.state==='uploading','upload_finished','This original is already published.',409)
 const pending=guard(c,"EXISTS(SELECT 1 FROM tt_record_media WHERE id=? AND state='uploading' AND uploaded_by=?)",r.id,c.actor.id)
 if(command==='media.abort') {await commit(c,[pending,sql(c,'DELETE FROM tt_record_media WHERE id=?',r.id)],command,target.row.id);return {notice:'Unfinished upload removed.'}}
 if(command==='media.chunk') {
  const pos=Number(p.position),f=p.file
  insist(Number.isInteger(pos)&&pos>=0&&pos<Math.ceil(r.size/CHUNK),'chunk_position','Choose a chunk within the original file.')
  const expected=Math.min(CHUNK,r.size-pos*CHUNK)
  insist(f instanceof File&&f.size===expected,'chunk_size','Chunk size does not match the original file.')
  const bytes=new Uint8Array(await f.arrayBuffer()),digest=await sha256(bytes),old=await one(c,'SELECT sha256 FROM tt_record_media_chunks WHERE media_id=? AND position=?',r.id,pos)
  if(old){insist(old.sha256===digest,'chunk_conflict','This position already holds different original bytes.',409);return {position:pos,replayed:true}}
  await commit(c,[...target.guards,pending,sql(c,'INSERT INTO tt_record_media_chunks(id,media_id,position,sha256,bytes) VALUES(?,?,?,?,?)',id(),r.id,pos,digest,bytes)],command,target.row.id)
  return {position:pos,sha256:digest}
 }
 const bytes=await mediaBytes(c,r);await checkedType(bytes,r.media_type,mediaTarget(r).kind)
 await commit(c,[...target.guards,pending,guard(c,"COALESCE((SELECT MAX(version) FROM tt_record_media WHERE attachment_id=? AND state='ready'),0)=?",r.attachment_id,r.version-1),guard(c,'NOT EXISTS(SELECT 1 FROM tt_erased_media_files WHERE sha256=?)',r.sha256),sql(c,"UPDATE tt_record_media SET state='ready' WHERE id=?",r.id)],command,target.row.id)
 return {id:r.id,attachmentId:r.attachment_id,version:r.version,sha256:r.sha256,notice:'Original attached. Previous versions remain readable. This is not a malware verdict or a change to a payable’s approved terms.'}
}
export async function mediaStatus(c:Context,key:unknown) {
 const r=await one(c,'SELECT * FROM tt_record_media WHERE id=?',text(key,'Upload',100));insist(r,'not_found','Upload not found.',404)
 await mediaRecord(c,mediaTarget(r).kind,mediaTarget(r).recordId,true);insist(r.uploaded_by===c.actor.id,'not_found','Upload not found.',404)
 return {id:r.id,state:r.state,sha256:r.sha256,positions:(await all(c,'SELECT position FROM tt_record_media_chunks WHERE media_id=? ORDER BY position',r.id)).map(x=>x.position)}
}
export async function mediaDownload(c:Context,key:unknown) {
 const r=await one(c,"SELECT * FROM tt_record_media WHERE id=? AND state='ready'",text(key,'Original',100));insist(r,'not_found','Original not found.',404)
 await mediaRecord(c,mediaTarget(r).kind,mediaTarget(r).recordId)
 const bytes=await mediaBytes(c,r);await recordRead(c,'read:record-media',r.id)
 return new Response(bytes,{headers:{'content-type':r.media_type,'content-disposition':`attachment; filename*=UTF-8''${encodeURIComponent(r.name)}`,'cache-control':'private, no-store','x-content-type-options':'nosniff','x-content-sha256':r.sha256,'content-security-policy':"default-src 'none'; sandbox"}})
}

/** OPS-001's existing document catalogue inherits record-media scope and version provenance. */
export async function recordMediaCatalog(c:Context) {
 const {billData}=await import('./bills')
 const invoices=can(c,'bills.read')?new Set(((await billData(c)).bills as Row[]).map(b=>b.id)):new Set()
 const rows=await all(c,"SELECT m.id,m.attachment_id,m.version,m.name,m.media_type,m.size,m.sha256,m.captured_at,m.inspection_id,m.job_id,m.bill_id,t.id AS tenancy_id,t.unit_id,t.erased_at FROM tt_record_media m LEFT JOIN tt_inspections i ON i.id=m.inspection_id LEFT JOIN tt_maintenance_jobs j ON j.id=m.job_id LEFT JOIN tt_tenancies t ON t.id=COALESCE(i.tenancy_id,j.tenancy_id) WHERE m.state='ready' ORDER BY m.id")
 return rows.filter(r=>r.bill_id?invoices.has(r.bill_id):can(c,'work.read')&&!r.erased_at&&reaches(c,r.unit_id)).map(r=>({id:'record-media:'+r.id,kind:mediaTarget(r).kind,recordId:mediaTarget(r).recordId,attachmentId:r.attachment_id,version:r.version,name:r.name,media_type:r.media_type,size:r.size,sha256:r.sha256,effective:r.captured_at,tenancy_id:r.tenancy_id,href:'/api/record-media/file?id='+r.id}))
}
