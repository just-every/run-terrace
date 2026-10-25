import {all,allow,commit,guard,id,insist,one,reachesPortfolio,sql,text,type Context,type Row} from './core'

export const VENDOR_BANK_COMMANDS=['vendor.bank.prepare','vendor.bank.verify'] as const

// Include historical allocations: moving a bill or reassigning work must not reveal
// shared vendor evidence to someone who reaches only part of its history.
const related=`WITH target(id) AS (SELECT ?), related AS (
 SELECT p.portfolio_id FROM tt_maintenance_jobs j
 LEFT JOIN tt_tenancies t ON t.id=j.tenancy_id LEFT JOIN tt_units u ON u.id=t.unit_id LEFT JOIN tt_properties p ON p.id=u.property_id
 WHERE j.vendor_id=(SELECT id FROM target) OR EXISTS(SELECT 1 FROM tt_vendor_assignments a WHERE a.job_id=j.id AND a.vendor_id=(SELECT id FROM target))
 UNION SELECT p.portfolio_id FROM tt_bills b JOIN tt_bill_revisions r ON r.bill_id=b.id
 JOIN json_each(r.terms,'$.allocations') a LEFT JOIN tt_properties p ON p.id=json_extract(a.value,'$.propertyId') WHERE b.vendor_id=(SELECT id FROM target)
 UNION SELECT p.portfolio_id FROM tt_bills b JOIN tt_bill_expenses e ON e.bill_id=b.id LEFT JOIN tt_properties p ON p.id=e.property_id WHERE b.vendor_id=(SELECT id FROM target)
 UNION SELECT p.portfolio_id FROM tt_bill_template_revisions r JOIN json_each(r.terms,'$.allocations') a
 LEFT JOIN tt_properties p ON p.id=json_extract(a.value,'$.propertyId') WHERE json_extract(r.terms,'$.vendorId')=(SELECT id FROM target)
)`

function human(c:Context,action:string){
 insist(!c.actor.credential&&!c.scheduler,'forbidden','A signed-in staff member is required.',403)
 allow(c,action)
 insist(c.actor.role==='owner'||c.actor.staff?.role==='portfolio_manager','forbidden','Only the owner or an authorized portfolio manager can review bank references.',403)
}

/** This runs before reading vendor or bank fields. Unallocated work requires all portfolios. */
async function scoped(c:Context,value:unknown){
 const key=text(value,'Vendor',100),rows=await all(c,related+' SELECT portfolio_id FROM related',key)
 insist(c.actor.role==='owner'||c.actor.staff?.all||(rows.length>0&&rows.every(r=>r.portfolio_id&&reachesPortfolio(c,r.portfolio_id))),'not_found','Vendor not found.',404)
 const vendor=await one(c,'SELECT id,version FROM tt_vendors WHERE id=?',key)
 insist(vendor,'not_found','Vendor not found.',404)
 return vendor
}

// Re-evaluate relationships and portfolio grants inside the commit, including any
// newly assigned job/property; cached staff scope alone cannot authorize a write.
const scopeGuard=(c:Context,key:string)=>guard(c,`EXISTS(${related}
 SELECT 1 WHERE EXISTS(SELECT 1 FROM oa_operators WHERE id=? AND status='active' AND role='owner')
 OR EXISTS(SELECT 1 FROM tt_staff_roles s WHERE s.operator_id=? AND s.role='portfolio_manager' AND
 (s.all_portfolios=1 OR (EXISTS(SELECT 1 FROM related) AND NOT EXISTS(
 SELECT 1 FROM related r WHERE r.portfolio_id IS NULL OR NOT EXISTS(SELECT 1 FROM tt_role_portfolios rp WHERE rp.operator_id=s.operator_id AND rp.portfolio_id=r.portfolio_id))))))`,key,c.actor.id,c.actor.id)
const versionGuard=(c:Context,v:Row,version:number)=>[
 scopeGuard(c,v.id),guard(c,'EXISTS(SELECT 1 FROM tt_vendors WHERE id=? AND version=?)',v.id,v.version),
 guard(c,'COALESCE((SELECT MAX(version) FROM tt_vendor_bank_references WHERE vendor_id=?),0)=?',v.id,version),
]
const expected=(value:unknown)=>{const n=Number(value);insist(value!==undefined&&value!==null&&value!==''&&Number.isSafeInteger(n)&&n>=0,'invalid_input','The current bank reference version is required.');return n}
const reference=(value:unknown,label:string)=>{
 const s=text(value,label,300)
 insist(!/^\d[\d\s-]*$/.test(s),'invalid_input',`${label} must be an external evidence reference, not an account or routing number.`)
 return s
}

/** Both HTTP command doors must require fresh email-link proof before calling this service. */
export async function vendorBankCommand(c:Context,name:string,p:Row):Promise<Row|undefined>{
 if(!VENDOR_BANK_COMMANDS.includes(name as typeof VENDOR_BANK_COMMANDS[number]))return
 human(c,name)
 if(name==='vendor.bank.prepare')insist(c.actor.role==='owner','forbidden','Only the owner can prepare a bank reference.',403)
 const v=await scoped(c,p.vendorId),version=expected(p.version)
 const candidate=await one(c,'SELECT * FROM tt_vendor_bank_references WHERE vendor_id=? ORDER BY version DESC LIMIT 1',v.id)
 insist((candidate?.version??0)===version,'conflict','Review the latest bank reference before continuing.',409)
 const rawFields=['accountNumber','routingNumber','routing','bsb','iban','swift','bankPassword','bankUsername','credentials']
 insist(!rawFields.some(k=>p[k]!==undefined),'invalid_input','Store only a bank name, last four digits and external evidence references.')
 if(name==='vendor.bank.prepare'){
  const key=id(),bankName=text(p.bankName,'Bank name',120),last4=text(p.last4,'Last four digits',4)
  insist(/^\d{4}$/.test(last4),'invalid_input','Enter exactly the last four digits.')
  const accountReference=reference(p.accountReference,'Account reference'),source=text(p.source,'Source',300),reason=text(p.reason,'Reason',1000)
  await commit(c,[...versionGuard(c,v,version),sql(c,'INSERT INTO tt_vendor_bank_references(id,vendor_id,version,vendor_version,bank_name,last4,account_reference,source,reason,prepared_by,prepared_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)',key,v.id,version+1,v.version,bankName,last4,accountReference,source,reason,c.actor.id,c.now)],name,v.id)
  return {id:v.id,candidateId:key,bankVendorId:v.id,version:version+1,notice:'Bank reference prepared and held for independent verification. Any previous verification is superseded.'}
 }
 insist(candidate,'not_found','Bank reference not found.',404)
 insist(candidate.vendor_version===v.version,'conflict','Vendor details changed. Prepare and verify a new bank reference.',409)
 insist(candidate.prepared_by!==c.actor.id,'independent_verification','Another authorized person must independently verify this exact bank reference.',403)
 insist(p.consent==='VERIFIED','consent_required','Confirm independent external verification of this exact bank reference.')
 const verificationReference=reference(p.verificationReference,'Verification reference')
 insist(!await one(c,'SELECT candidate_id FROM tt_vendor_bank_verifications WHERE candidate_id=?',candidate.id),'conflict','This bank reference is already verified.',409)
 await commit(c,[...versionGuard(c,v,version),guard(c,'NOT EXISTS(SELECT 1 FROM tt_vendor_bank_verifications WHERE candidate_id=?)',candidate.id),sql(c,'INSERT INTO tt_vendor_bank_verifications(candidate_id,verified_by,verified_at,verification_reference,consent) VALUES(?,?,?,?,?)',candidate.id,c.actor.id,c.now,verificationReference,'VERIFIED')],name,v.id)
 return {id:v.id,candidateId:candidate.id,bankVendorId:v.id,version,notice:'Independent external verification recorded. This is an accounting reference only; no funds were moved.'}
}

/** Staff-only; current is deliberately null whenever the latest candidate is held. */
export async function vendorBankData(c:Context,vendorId:unknown):Promise<Row>{
 human(c,'vendor.bank.read')
 const v=await scoped(c,vendorId),history=await all(c,`SELECT r.*,x.verified_by,x.verified_at,x.verification_reference FROM tt_vendor_bank_references r
 LEFT JOIN tt_vendor_bank_verifications x ON x.candidate_id=r.id WHERE r.vendor_id=? ORDER BY r.version DESC`,v.id)
 const candidate=history[0]??null,version=candidate?.version??0,current=candidate?.verified_by&&candidate.vendor_version===v.version?candidate:null
 await commit(c,versionGuard(c,v,version),'vendor.bank.read',v.id)
 return {vendorId:v.id,vendorVersion:v.version,version,state:current?'verified':candidate?'held':'missing',current,candidate,history}
}
