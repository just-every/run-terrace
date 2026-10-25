import {all,allow,can,cents,commit,date,guard,id,insist,one,sha256,sql,tenancy,tenancyGuard,text,type Context,type Row} from './core'
import {independence} from './dual-control'
import {localDate} from './zones'
export const CHARGEBACK_COMMANDS=['chargeback.prepare','chargeback.approve']
/** Only actual, unreversed costs of this repair are recoverable; estimates and unconsumed stock are not. */
async function sources(c:Context,t:Row){
 const rows=await all(c,`SELECT j.*,o.legal_name AS owner_name FROM tt_journal j JOIN tt_owners o ON o.id=j.owner_key WHERE j.fund='operating' AND NOT EXISTS(SELECT 1 FROM tt_journal r WHERE r.reversal_of=j.id) AND ((j.source_kind='stock_use' AND EXISTS(SELECT 1 FROM tt_stock_uses u WHERE u.id=j.source_id AND u.tenancy_id=?)) OR (j.source_kind='bill' AND EXISTS(SELECT 1 FROM tt_bill_expenses x JOIN tt_bills b ON b.id=x.bill_id AND b.version=x.version AND b.state='payable' JOIN tt_bill_revisions v ON v.bill_id=b.id AND v.version=b.version,json_each(v.terms,'$.allocations') a JOIN tt_maintenance_jobs m ON m.id=json_extract(a.value,'$.jobId') WHERE x.id=j.source_id AND m.tenancy_id=? AND json_extract(a.value,'$.propertyId')=x.property_id))) ORDER BY j.day,j.id`,t.id,t.id)
 for(const r of rows){r.costCents=JSON.parse(r.lines).filter((l:Row)=>l.account==='expense').reduce((n:number,l:Row)=>n+l.debit,0);r.recoveredCents=(await one(c,'SELECT COALESCE(SUM(c.amount_cents),0) AS n FROM tt_work_chargebacks c JOIN tt_work_chargeback_approvals a ON a.chargeback_id=c.id WHERE c.source_id=?',r.id))!.n;r.netOwnerCostCents=r.costCents-r.recoveredCents}
 return rows
}
async function current(c:Context,t:Row,s:Row,terms:Row){
 const today=localDate(c.now,t.time_zone)
 const set=await one(c,'SELECT id FROM tt_ownership_sets WHERE property_id=? AND effective_from<=? ORDER BY effective_from DESC LIMIT 1',s.property_id,today)
 const share=await one(c,'SELECT 1 FROM tt_ownership_shares WHERE set_id=? AND owner_id=?',set?.id??'',s.owner_key)
 insist(share&&terms.ownerId===s.owner_key,'wrong_beneficiary','The cost beneficiary must still own this property. No allocation across owners.',409)
 const guards=[guard(c,'NOT EXISTS(SELECT 1 FROM tt_journal WHERE reversal_of=?)',s.id),guard(c,'(SELECT id FROM tt_ownership_sets WHERE property_id=? AND effective_from<=? ORDER BY effective_from DESC LIMIT 1)=?',s.property_id,today,set!.id)]
 if(terms.kind==='resident'){
  insist(t.start_date<=s.day&&t.start_date<=today&&today<=(t.ended_on??t.end_date),'resident_authority','The resident must have current lease rights.',409)
  if(terms.recipientId==='resident:'+t.id)return guards
  const m=await one(c,"SELECT * FROM tt_household_members WHERE id=? AND tenancy_id=? AND role IN ('resident','co_tenant','guarantor') AND joined<=? AND (left_on IS NULL OR left_on>=?)",terms.recipientId,t.id,today,today)
  insist(m&&m.joined<=s.day&&(!m.left_on||m.left_on>=s.day),'wrong_beneficiary','Choose a currently liable member of this repair household.',409)
  guards.push(guard(c,'EXISTS(SELECT 1 FROM tt_household_members WHERE id=? AND version=? AND joined<=? AND (left_on IS NULL OR left_on>=?))',m.id,m.version,today,today))
 }else if(terms.kind==='owner')insist(terms.recipientId===s.owner_key,'wrong_beneficiary','Owner allocation must name the original cost beneficiary.',409)
 return guards
}
export async function chargebackCommand(c:Context,command:string,p:Row):Promise<Row|undefined>{
 if(!CHARGEBACK_COMMANDS.includes(command))return
 allow(c,command);insist(!c.actor.credential,'forbidden','A signed-in person must review chargeback authority.',403)
 let proposal:Row|null|undefined
 if(command==='chargeback.approve'){proposal=await one(c,'SELECT * FROM tt_work_chargebacks WHERE id=?',text(p.chargebackId,'Chargeback',100));insist(proposal,'not_found','Chargeback not found.',404)}
 const t=await tenancy(c,proposal?.tenancy_id??p.tenancyId)
 insist(t.currency==='USD'&&t.currency_confirmed!==0,'currency','Chargebacks require confirmed USD.',409)
 const rows=await sources(c,t),s=rows.find(s=>s.id===(proposal?.source_id??p.sourceId))
 insist(s,'not_found','Repair cost not found.',404)
 const day=proposal?.day??date(p.day),amount=proposal?.amount_cents??cents(p.amount)
 insist(day>=s.day&&day<=localDate(c.now,t.time_zone),'invalid_date','Allocation must follow its cost and be no later than today at the property.')
 insist(amount<=s.netOwnerCostCents,'duplicate_recovery','This allocation exceeds the remaining source cost.',409)
 const terms:Row=proposal?JSON.parse(proposal.terms):{kind:text(p.kind,'Recipient kind',20),ownerId:text(p.ownerId,'Cost beneficiary',100),recipientId:text(p.kind==='insurance'?(p.insuranceReference||p.recipientId):p.recipientId,'Named recipient or insurance reference',200),authority:text(p.authority,'Exact-content authorization evidence',1500),taxTreatment:'Source tax included in cost; no new tax assessed',amountCents:amount,sourceId:s.id,day}
 insist(['resident','owner','insurance'].includes(terms.kind),'invalid_recipient','Choose resident, owner or insurance.')
 const guards=await current(c,t,s,terms)
 if(!proposal){
  terms.recipientName=terms.kind==='owner'?s.owner_name:terms.kind==='insurance'?terms.recipientId:terms.recipientId==='resident:'+t.id?t.tenant_name:(await one(c,'SELECT name FROM tt_household_members WHERE id=?',terms.recipientId))!.name
  insist(p.consent==='yes','consent_required','Confirm the recorded authorization covers this exact recipient, source, amount and tax treatment.')
  const key=id(),hash=await sha256(new TextEncoder().encode(JSON.stringify(terms)))
  await commit(c,[tenancyGuard(c,t),...guards,sql(c,'INSERT INTO tt_work_chargebacks VALUES(?,?,?,?,?,?,?,?,?)',key,t.id,s.id,amount,day,JSON.stringify(terms),hash,c.actor.id,c.now)],command,key)
  return{id:key,tenancyId:t.id,notice:'Chargeback proposed for human review. No receivable, notice or money movement yet.'}
 }
 insist(p.sha256===proposal.sha256,'stale_terms','Review the exact frozen proposal before approval.',409)
 insist(!await one(c,'SELECT 1 FROM tt_work_chargeback_approvals WHERE chargeback_id=?',proposal.id),'already_approved','This allocation is already approved.',409)
 const independent=await independence(c,command,[proposal.prepared_by])
 const lines=[{account:'receivable',debit:amount,credit:0},{account:'expense',debit:0,credit:amount}]
 await commit(c,[tenancyGuard(c,t),...guards,...independent.guards,guard(c,'(SELECT COALESCE(SUM(c.amount_cents),0) FROM tt_work_chargebacks c JOIN tt_work_chargeback_approvals a ON a.chargeback_id=c.id WHERE c.source_id=?)=?',s.id,s.recoveredCents),sql(c,'INSERT INTO tt_work_chargeback_approvals VALUES(?,?,?,?)',proposal.id,c.actor.id,c.now,independent.label),sql(c,"INSERT INTO tt_journal(id,day,property_id,owner_key,tenancy_id,fund,source_kind,source_id,reference,lines,recorded_by,recorded_at) VALUES(?,?,?,?,?,'operating','chargeback',?,?,?,?,?)",id(),day,s.property_id,s.owner_key,t.id,proposal.id,proposal.id,JSON.stringify(lines),c.actor.id,c.now)],command,proposal.id)
 return{id:proposal.id,tenancyId:t.id,notice:'Approved allocation recorded as a receivable against the named recipient. Owner cost is reduced once; payable is unchanged. No payment or notice sent.'}
}
export async function chargebackData(c:Context,tenancyId:string){
 const t=await tenancy(c,tenancyId)
 if(!can(c,'bills.read'))return{visible:false}
 const costs=await sources(c,t),proposals=await all(c,'SELECT c.*,a.approved_by,a.approved_at,a.label FROM tt_work_chargebacks c LEFT JOIN tt_work_chargeback_approvals a ON a.chargeback_id=c.id WHERE c.tenancy_id=? ORDER BY c.prepared_at,c.id',t.id)
 const members=await all(c,"SELECT id,name FROM tt_household_members WHERE tenancy_id=? AND role IN ('resident','co_tenant','guarantor')",t.id)
 members.unshift({id:'resident:'+t.id,name:t.tenant_name})
 return{visible:true,costs,proposals:proposals.map(p=>({...p,terms:JSON.parse(p.terms)})),members,mayPrepare:can(c,'chargeback.prepare'),mayApprove:can(c,'chargeback.approve')}
}
