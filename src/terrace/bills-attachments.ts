import { allow, guard, id, insist, one, recordRead, sha256, sql, text, type Context, type Row } from './core'
import { bill } from './bills-input'
/** Original bytes are private, never remotely fetched, parsed or represented as extracted fields. */
export async function attachment(c: Context, key: string, version: number, value: unknown, original: boolean) {
 let name: string, type: string, bytes: Uint8Array
 if (value instanceof File) { name=value.name;type=value.type;bytes=new Uint8Array(await value.arrayBuffer()) }
 else {
  const v=value as Row; insist(v && typeof v==='object','invoice_required','Upload an original PDF, JPEG, PNG or email invoice.')
  name=text(v.name,'Attachment name',200);type=text(v.type,'Attachment type',100)
  const encoded=text(v.base64,'Original bytes',7*1024*1024)
  try { bytes=Uint8Array.from(atob(encoded),ch=>ch.charCodeAt(0)) } catch { insist(false,'invalid_attachment','Attachment must contain valid base64 bytes.') }
 }
 name=text(name,'Attachment name',200)
 if ((!type || type==='application/octet-stream') && /\.eml$/i.test(name)) type='message/rfc822'
 insist(bytes.length>0 && bytes.length<=5*1024*1024,'attachment_limit','Each attachment must be at most 5 MB.',413)
 const head=new TextDecoder().decode(bytes.slice(0,1024)),same=(v:number[])=>v.every((b,i)=>bytes[i]===b)
 insist((type==='application/pdf' && head.startsWith('%PDF-')) || (type==='image/png' && same([137,80,78,71,13,10,26,10])) || (type==='image/jpeg' && same([255,216,255])) || (type==='message/rfc822' && /^(from|to|date|subject|mime-version|received):/im.test(head)),'invalid_attachment','Upload PDF, JPEG, PNG or an original .eml email with its headers.')
 const sha=await sha256(bytes),keyId=id()
 insist(!(await one(c,'SELECT 1 FROM tt_erased_bill_files WHERE sha256=?',sha)),'erased_artifact','This invoice artifact was erased and cannot be reimported.',409)
 if(original) insist(!(await one(c,'SELECT 1 FROM tt_bill_attachments WHERE sha256=? AND original=1',sha)),'duplicate_bytes','These exact invoice bytes are already recorded.',409)
 return { id:keyId,sha,statements:[guard(c,'NOT EXISTS(SELECT 1 FROM tt_erased_bill_files WHERE sha256=?)',sha),...(original?[guard(c,'NOT EXISTS(SELECT 1 FROM tt_bill_attachments WHERE sha256=? AND original=1)',sha)]:[]),sql(c,'INSERT INTO tt_bill_attachments(id,bill_id,version,name,type,bytes,sha256,original,recorded_by,recorded_at) VALUES(?,?,?,?,?,?,?,?,?,?)',keyId,key,version,name,type,bytes,sha,original?1:0,c.actor.id,c.now)] }
}
export async function billAttachment(c: Context, value: unknown) {
 allow(c,'bills.read')
 const a=await one(c,'SELECT * FROM tt_bill_attachments WHERE id=?',text(value,'Attachment',100))
 insist(a,'not_found','Attachment not found.',404);await bill(c,a.bill_id)
 await recordRead(c,'bills.read',a.id)
 return new Response(new Uint8Array(a.bytes),{headers:{'content-type':a.type,'content-disposition':`attachment; filename="${a.name.replace(/[^a-zA-Z0-9._-]/g,'_')}"`,'cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer','content-security-policy':"default-src 'none'; sandbox"}})
}
