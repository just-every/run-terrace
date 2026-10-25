import {audit,cents,date,Fault,guard,insist,one,sha256,sql,tenancy,tenancyGuard,text,type Context,type Row} from './core'
import {prepareBill} from './bills'
import {digest,zero} from './bills-input'
import {hash,type Portal} from './portal-session'
import {hold,vendorGuard} from './vendors'

export const VENDOR_INVOICE_DECLARATION='I submit this invoice and original for staff review only. It does not approve a payable, authorize payment or change approved work.'
const decimal=(value:number)=>`${Math.floor(value/100)}.${String(value%100).padStart(2,'0')}`

/** Retain a supplier's original in ACCT-007's pending review flow, with no payable or posting authority. */
export async function vendorInvoice(c:Context,p:Portal,f:FormData):Promise<Row>{
 const j=await one(c,"SELECT * FROM tt_maintenance_jobs WHERE id=? AND state IN ('approved','sent')",text(f.get('jobId'),'Work order',100))
 const grant=p.grants.find(g=>g.access==='vendor'&&g.vendor_id===j?.vendor_id)
 insist(j&&grant,'not_found','Work not found.',404)
 const t=await tenancy(c,j.tenancy_id),version=Number(f.get('version'))
 insist(Number.isInteger(version)&&version===j.version,'conflict','Review the current approved work before submitting an invoice.',409)
 insist(f.get('consent')==='yes','consent_required','Confirm this invoice is submitted for staff review only.')
 const unit=t.unit_id?await one(c,'SELECT u.id,u.property_id FROM tt_units u JOIN tt_properties p ON p.id=u.property_id WHERE u.id=?',t.unit_id):null
 insist(unit,'not_found','A property is required for this work invoice.',404)
 insist(j.currency==='USD'&&t.currency==='USD'&&t.currency_confirmed!==0,'currency','Invoice review requires confirmed USD work.',409)
 const h=await hold(c,j,t)
 insist(!h.held,'qualification_hold','Your qualification needs staff review before submitting an invoice.',409)
 const approval=await one(c,'SELECT id,sha256 FROM tt_maintenance_approvals WHERE job_id=? ORDER BY job_version DESC LIMIT 1',j.id)
 insist(approval,'not_found','Approved work not found.',404)
 const invoiceNumber=text(f.get('invoiceNumber'),'Invoice number',100),day=date(f.get('date'),'Invoice date'),description=text(f.get('description'),'Line description',500)
 const amount=cents(f.get('amount')),tax=zero(f.get('tax')),total=amount+tax
 insist(Number.isSafeInteger(total)&&total<=100000000,'invalid_money','Bill total must be at most 1,000,000.00.')
 const original=f.get('original')
 insist(original instanceof File,'invoice_required','Upload an original PDF, JPEG, PNG or email invoice.')
 insist(original.size>0&&original.size<=5*1024*1024,'attachment_limit','Each attachment must be at most 5 MB.',413)
 const originalSha=await sha256(new Uint8Array(await original.arrayBuffer())),mailbox=await hash(p.identity.email)
 const fingerprint=await digest({jobId:j.id,vendorId:j.vendor_id,jobVersion:version,approval:approval.sha256,propertyId:unit.property_id,mailbox,invoiceNumber:invoiceNumber.toLowerCase(),day,description,amount,tax,originalSha,consentVersion:1})
 const key='portal-invoice:'+fingerprint
 const saved=()=>one(c,'SELECT s.id AS submissionId,s.bill_id AS id,s.bill_id AS billId,b.version,b.state FROM tt_vendor_invoices s JOIN tt_bills b ON b.id=s.bill_id WHERE s.id=? AND s.job_id=? AND s.vendor_id=? AND s.mailbox_hash=?',key,j.id,j.vendor_id,mailbox)
 const guards=()=>[
  tenancyGuard(c,t),
  guard(c,"EXISTS(SELECT 1 FROM tt_portal_sessions s JOIN tt_portal_identities i ON i.id=s.identity_id JOIN tt_portal_grants g ON g.identity_id=i.id WHERE s.hash=? AND s.revoked_at IS NULL AND s.expires_at>? AND i.id=? AND i.email=? AND i.status='active' AND g.id=? AND g.access='vendor' AND g.revoked_at IS NULL AND g.vendor_id=?)",p.sessionHash,c.now,p.identity.id,p.identity.email,grant.id,j.vendor_id),
  guard(c,'EXISTS(SELECT 1 FROM tt_maintenance_jobs WHERE id=? AND tenancy_id=? AND vendor_id=? AND version=? AND state=?)',j.id,t.id,j.vendor_id,version,j.state),
  guard(c,'EXISTS(SELECT 1 FROM tt_units u JOIN tt_properties p ON p.id=u.property_id WHERE u.id=? AND u.property_id=?)',unit.id,unit.property_id),
  guard(c,'(SELECT id FROM tt_maintenance_approvals WHERE job_id=? ORDER BY job_version DESC LIMIT 1)=?',j.id,approval.id),
  vendorGuard(c,j,h.vendorVersion),
  ...(h.exception?[guard(c,'EXISTS(SELECT 1 FROM tt_vendor_exceptions WHERE id=? AND job_id=? AND vendor_id=? AND issues=?)',h.exception.id,j.id,j.vendor_id,JSON.stringify(h.issues))]:[]),
 ]
 const result=(row:Row)=>({...row,notice:'Original invoice retained privately for staff review. No payable was approved and no money has moved.'})
 try{
  const prior=await saved()
  if(prior){await c.db.batch(guards());return result(prior)}
  const bill=await prepareBill(c,{vendorId:j.vendor_id,invoiceNumber,date:day,original,lines:[{description,code:'repairs',amount:decimal(amount),tax:decimal(tax)}],allocations:[{propertyId:unit.property_id,jobId:j.id,amount:decimal(total),costClass:'operating'}]})
  await c.db.batch([...guards(),...bill.statements,
   sql(c,'INSERT INTO tt_vendor_invoices(id,fingerprint,bill_id,job_id,vendor_id,job_version,approval_sha256,original_sha256,mailbox_hash,consent_version,declaration,recorded_by,recorded_at) VALUES(?,?,?,?,?,?,?,?,?,1,?,?,?)',key,fingerprint,bill.key,j.id,j.vendor_id,version,approval.sha256,originalSha,mailbox,VENDOR_INVOICE_DECLARATION,c.actor.id,c.now),
   audit(c,'portal.invoice.submit',bill.key,JSON.stringify({submissionId:key,jobId:j.id,jobVersion:version,approvalSha256:approval.sha256,originalSha256:originalSha,submittedBy:mailbox,consentVersion:1,declaration:VENDOR_INVOICE_DECLARATION})),
  ])
 }catch(error){
  // The competing transaction may have completed during preparation or the atomic write.
  if((error instanceof Fault&&['duplicate_invoice','duplicate_bytes'].includes(error.code))||/CHECK constraint|UNIQUE constraint/.test(String(error))){
   const prior=await saved()
   if(prior){
    try{await c.db.batch(guards())}catch{throw new Fault('conflict','Your work or access changed. Review it again.',409)}
    return result(prior)
   }
   throw new Fault('conflict','This invoice is already recorded or your work or access changed. Review it again.',409)
  }
  if(String(error).includes('period_closed'))throw new Fault('period_closed','That invoice date is in a closed month. Ask staff to review it.',409)
  throw error
 }
 const stored=await saved();insist(stored,'conflict','Invoice could not be read. Review the work again.',409)
 return result(stored)
}
