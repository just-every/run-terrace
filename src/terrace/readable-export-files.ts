import {fileSize} from './format'
import { sha256 } from './core'
import type { ExportRow } from './readable-export-labels'
export type ExportFile = [string,string|Uint8Array]
export const decode = (value:unknown) => Uint8Array.from(atob(typeof value==='string'?value:(value as {blob:string}).blob), ch=>ch.charCodeAt(0))
export const isBlob = (value:unknown):value is {blob:string} => !!value&&typeof value==='object'&&'blob' in value
const ext:Record<string,string>={'image/png':'png','image/jpeg':'jpg','application/pdf':'pdf','video/mp4':'mp4','video/quicktime':'mov','video/webm':'webm','text/plain':'txt','text/csv':'csv','message/rfc822':'eml'}
export async function originals(rows:Map<string,ExportRow[]>,reference:(id:string)=>string) {
 const files:ExportFile[]=[], inventory:(string|number)[][]=[],cells=new Map<ExportRow,Map<string,string>>()
 async function add(row:ExportRow,column:string,data:Uint8Array,type:unknown,title:string){
  const path=`Original files/${title} ${String(files.length+1).padStart(4,'0')}.${ext[String(type)]??'bin'}`,digest=await sha256(data)
  files.push([path,data]);inventory.push([path,reference(String(row.id??row.job_id??path)),fileSize(data.length),digest])
  if(!cells.has(row))cells.set(row,new Map());cells.get(row)!.set(column,`${path} (SHA-256: ${digest})`)
 }
 for(const [table,list]of rows)for(const row of list)for(const [column,value]of Object.entries(row)){
  if(!isBlob(value)||table==='tt_record_media_chunks'||table==='ik_d1_original_chunks')continue
  const type=column==='pdf_bytes'?'application/pdf':column==='photo_bytes'?row.photo_type:row.media_type??row.type??(table==='ik_originals'?'text/csv':undefined)
  const title=table==='tt_document_versions'?'Document':table==='tt_inspection_photos'?'Inspection photograph':table==='ik_originals'?'Import source':column==='pdf_bytes'?'Printed document':'Stored original'
  await add(row,column,decode(value),type,title)
 }
 for(const row of rows.get('tt_record_media')??[])if(row.state==='ready'){
  const chunks=(rows.get('tt_record_media_chunks')??[]).filter(p=>p.media_id===row.id).sort((a,b)=>Number(a.position)-Number(b.position))
  const data=new Uint8Array(Number(row.size));let at=0
  for(const chunk of chunks){const bytes=decode(chunk.bytes);data.set(bytes,at);at+=bytes.length}
  if(at!==data.length||await sha256(data)!==row.sha256)throw Error('An original attachment could not be exported because its checksum did not match.')
  await add(row,'original_file',data,row.media_type,'Record attachment')
 }
 for(const row of rows.get('ik_originals')??[])if(!isBlob(row.bytes)){
  const chunks=(rows.get('ik_d1_original_chunks')??[]).filter(p=>p.job_id===row.job_id&&p.kind===row.kind&&p.original_key===row.original_key).sort((a,b)=>Number(a.ordinal)-Number(b.ordinal))
  if(!chunks.length)continue // Withdrawn source metadata may remain after reviewed erasure.
  const data=new Uint8Array(Number(row.size));let at=0
  for(const chunk of chunks){const bytes=decode(chunk.bytes);data.set(bytes,at);at+=bytes.length}
  if(at!==data.length||await sha256(data)!==row.sha256)throw Error('An original import source could not be exported because its checksum did not match.')
  await add(row,'bytes',data,'text/csv','Import source')
 }
 return {files,inventory,cells}
}
