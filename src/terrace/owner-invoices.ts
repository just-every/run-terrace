// Owner originals stay closed when any revision includes another beneficiary's property or period.
import {all,one,type Context,type Row} from './core'

async function eligible(c:Context,ownerId:string,billId:string){
 const bill=await one(c,"SELECT b.id,b.version,r.terms FROM tt_bills b JOIN tt_bill_revisions r ON r.bill_id=b.id AND r.version=b.version JOIN tt_bill_approvals a ON a.bill_id=b.id AND a.version=b.version AND a.sha256=r.sha256 WHERE b.id=? AND b.state='payable'",billId)
 if(!bill)return null
 const shares=await all(c,'SELECT s.property_id,s.effective_from,h.share_bp,(SELECT MIN(n.effective_from) FROM tt_ownership_sets n WHERE n.property_id=s.property_id AND n.effective_from>s.effective_from) AS until FROM tt_ownership_sets s JOIN tt_ownership_shares h ON h.set_id=s.id WHERE h.owner_id=?',ownerId),revisions=await all(c,'SELECT terms FROM tt_bill_revisions WHERE bill_id=?',billId)
 // Original bytes cannot be selectively redacted. Every historical allocation must be solely this owner's.
 if(!revisions.length||!revisions.every(r=>{const t=JSON.parse(r.terms);return t.allocations.length&&t.allocations.every((a:Row)=>shares.some(s=>s.property_id===a.propertyId&&s.share_bp===10000&&s.effective_from<=t.day&&(!s.until||s.until>t.day)))}))return null
 return bill
}
export async function ownerInvoices(c:Context,ownerId:string,expenses:Row[]){
 const result:Row[]=[]
 for(const billId of new Set(expenses.map(x=>x.bill_id))){
  const b=await eligible(c,ownerId,billId);if(!b)continue
  const terms=JSON.parse(b.terms),files=await all(c,'SELECT id,name,type,sha256 FROM tt_bill_attachments WHERE bill_id=? ORDER BY recorded_at,id',b.id)
  result.push({billId:b.id,invoiceNumber:terms.invoiceNumber,day:terms.day,files:files.filter(f=>terms.attachments?.some((a:Row)=>a.id===f.id&&a.sha256===f.sha256)).map(f=>({...f,url:'/portal/owner-invoice?id='+encodeURIComponent(f.id)}))})
 }
 return result
}
export async function ownerInvoiceFile(c:Context,ownerId:string,fileId:string){
 const f=await one(c,'SELECT id,bill_id,name,type,bytes,sha256 FROM tt_bill_attachments WHERE id=?',fileId)
 if(!f)return null
 const b=await eligible(c,ownerId,f.bill_id)
 return b&&JSON.parse(b.terms).attachments?.some((a:Row)=>a.id===f.id&&a.sha256===f.sha256)?f:null
}
