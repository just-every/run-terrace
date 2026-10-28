import {audit,insist,one,sha256,sql,text,type Context,type Row} from './core'
import {instant} from './appointments'
import {localDate} from './zones'
import {LIMIT,scan} from './document-scan'
import {validatePrint} from './office-print'
import {staffThread} from './portal-threads'

export async function serviceStatement(c:Context,r:Row,t:Row,p:Row){
 const server=text(p.serverName,'Actual server name',200),identity=text(p.serverReference,'Server identity or organization reference',500)
 const occurred=instant(p.occurredAt,'Actual service or attempt time',t.time_zone)
 insist(occurred<=c.now,'future_service','Future service cannot be recorded.')
 const day=localDate(occurred,t.time_zone)
 insist(!p.servedAt||p.servedAt===day,'service_date','The service date must match the actual property-local time.')
 const tracking=p.tracking?text(p.tracking,'Certified tracking number',200):null
 const method=text(p.method,'Staff-recorded service method',200)
 if(/certified/i.test(method))insist(tracking,'tracking_required','Office certified mail requires its tracking number.')
 const photo=p.photo
 insist(photo instanceof File&&photo.size>0&&photo.size<=LIMIT,'photo_required','Attach the original service photograph, up to 5 MB.')
 insist(['image/png','image/jpeg'].includes(photo.type),'photo_type','Service evidence must be a PNG or JPEG photograph.')
 const bytes=new Uint8Array(await photo.arrayBuffer()),checked=await scan(bytes,photo.type)
 insist(checked.ok,'file_refused',checked.ok?'':checked.reason,422)
 const hash=await sha256(bytes)
 insist(!await one(c,'SELECT 1 FROM tt_erased_document_files WHERE sha256=?',hash),'erased_artifact','This original was erased.',409)
 if(p.printBatchId)await validatePrint(c,p.printBatchId,r.id)
 return sql(c,'INSERT INTO tt_thread_service(thread_id,outcome,method,reference,served_at,actor,recorded_at,fingerprint,server_name,server_reference,occurred_at,tracking,photo_name,photo_type,photo_sha256,photo_bytes,print_batch_id) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',r.id,p.outcome,method,text(p.reference,'Named service evidence',1000),day,c.actor.id,c.now,r.fingerprint,server,identity,occurred,tracking,text(photo.name,'Photo filename',200),photo.type,hash,bytes,p.printBatchId||null)
}
export async function servicePhoto(c:Context,threadId:string){
 const {r}=await staffThread(c,threadId),s=await one(c,'SELECT * FROM tt_thread_service WHERE thread_id=?',r.id)
 insist(s?.photo_bytes,'not_found','Service photograph not found.',404)
 c.source=s.photo_sha256
 await audit(c,'read:service-photo',r.id).run()
 return new Response(new Uint8Array(s.photo_bytes),{headers:{'content-type':s.photo_type,'content-disposition':'attachment; filename="'+String(s.photo_name).replace(/[^a-zA-Z0-9._-]/g,'_')+'"','cache-control':'private, no-store','x-content-type-options':'nosniff','content-security-policy':"default-src 'none'; sandbox"}})
}
