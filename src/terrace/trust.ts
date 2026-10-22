// ACCT-002: designated bank custody and approved, externally recorded same-beneficiary transfers.
import {all,allow,audit,can,cents,commit,date,Fault,guard,id,insist,one,sql,text,type Context,type Row} from './core'
import {journalData,journalProperty} from './journal'
import {split} from './owners'
import {independence} from './dual-control'
import {localDate} from './zones'
export const TRUST_COMMANDS=['trust.account.add','trust.map','trust.assign','trust.prepare','trust.approve','trust.record']
const balance=(c:Context,bank:string,property:string,owner:string,fund:string,day:string)=>one(c,'SELECT COALESCE(SUM(amount_cents),0) AS cents FROM tt_trust_cash WHERE bank_id=? AND property_id=? AND owner_key=? AND fund=? AND day<=?',bank,property,owner,fund,day)
async function ownerReserve(c:Context,t:Row){
 const set=await one(c,'SELECT id FROM tt_ownership_sets WHERE property_id=? AND effective_from<=? ORDER BY effective_from DESC LIMIT 1',t.property_id,t.day)
 const shares=set?await all(c,'SELECT * FROM tt_ownership_shares WHERE set_id=? ORDER BY position',set.id):[]
 insist(shares.some(s=>s.owner_id===t.owner_id),'owner_scope','The beneficiary must own this property on the transfer day.',409)
 const agreement=await one(c,'SELECT id,reserve_cents FROM tt_management_agreements WHERE property_id=? AND starts<=? ORDER BY starts DESC LIMIT 1',t.property_id,t.day)
 insist(agreement,'agreement_required','Record the management agreement and its reserve before a transfer.',409)
 return{setId:set!.id,agreementId:agreement.id,cents:t.fund==='operating'?split(agreement.reserve_cents,shares).find(s=>s.ownerId===t.owner_id)!.cents:0}
}
async function checks(c:Context,t:Row){
 const property=await journalProperty(c,t.property_id)
 insist(t.day<=localDate(c.now,property.time_zone),'future_transfer','Record only an external transfer that has already occurred.')
 for(const bank of [t.from_bank,t.to_bank])insist(await one(c,'SELECT 1 FROM tt_trust_mappings WHERE property_id=? AND bank_id=? AND fund=?',property.id,bank,t.fund),'bank_scope','Both accounts must be authorized for this property and the same designated fund.',409)
 const purposes=await all(c,'SELECT id,purpose FROM tt_operating_accounts WHERE id IN (?,?)',t.from_bank,t.to_bank)
 insist(purposes.length===2&&purposes[0].purpose===purposes[1].purpose,'bank_purpose','A custody transfer cannot cross operating, rent-trust or deposit designations.',409)
 insist(!await one(c,"SELECT 1 FROM tt_journal j WHERE j.property_id=? AND j.fund=? AND EXISTS(SELECT 1 FROM json_each(j.lines) l JOIN tt_gl_chart a ON a.code=json_extract(l.value,'$.account') WHERE a.cash=1) AND NOT EXISTS(SELECT 1 FROM tt_trust_allocations a WHERE a.journal_id=j.id)",property.id,t.fund),'unassigned_cash','Assign every historical cash source in this property and fund before a transfer.',409)
 const reserve=await ownerReserve(c,t),cash=(await balance(c,t.from_bank,t.property_id,t.owner_id,t.fund,t.day))!.cents
 insist(cash-t.amount_cents>=reserve.cents,'reserve_or_balance','This bank’s beneficiary balance cannot fund the transfer while retaining the dated reserve. Other owners, properties and deposits cannot cover it.',409)
 insist(!await one(c,'SELECT 1 FROM tt_period_closes WHERE month=? AND reopened_at IS NULL',t.day.slice(0,7)),'period_closed','The transfer day is in a closed month.',409)
 return[
  guard(c,'(SELECT COALESCE(SUM(amount_cents),0) FROM tt_trust_cash WHERE bank_id=? AND property_id=? AND owner_key=? AND fund=? AND day<=?)>=?',t.from_bank,t.property_id,t.owner_id,t.fund,t.day,t.amount_cents+reserve.cents),
  guard(c,'(SELECT id FROM tt_ownership_sets WHERE property_id=? AND effective_from<=? ORDER BY effective_from DESC LIMIT 1)=?',t.property_id,t.day,reserve.setId),
  guard(c,'(SELECT id FROM tt_management_agreements WHERE property_id=? AND starts<=? ORDER BY starts DESC LIMIT 1)=?',t.property_id,t.day,reserve.agreementId),
 ]
}
export async function trustCommand(c:Context,command:string,p:Row):Promise<Row|undefined>{
 if(!TRUST_COMMANDS.includes(command))return
 allow(c,command)
 if(command==='trust.account.add'){
  insist(c.actor.role==='owner','forbidden','Only the owner configures bank custody.',403)
  const entity=await one(c,'SELECT id FROM tt_entities WHERE id=?',text(p.entityId,'Legal entity',100)),last4=text(p.last4,'Last four digits',4),purpose=String(p.purpose)
  insist(entity,'not_found','Legal entity not found.',404);insist(/^\d{4}$/.test(last4)&&['operating','rent_trust','deposit'].includes(purpose),'bank_account','Choose an account purpose and four digits.')
  const key=id()
  await commit(c,[sql(c,"INSERT INTO tt_operating_accounts(id,entity_id,name,bank_name,last4,currency,purpose,created_by,created_at) VALUES(?,?,?,?,?,'USD',?,?,?)",key,entity.id,text(p.name,'Account name',150),text(p.bankName,'Bank name',150),last4,purpose,c.actor.id,c.now)],command,key)
  return{id:key,notice:'Designated USD bank reference recorded. No bank verification or money movement.'}
 }
 if(command==='trust.map'){
  const prop=await journalProperty(c,p.propertyId),bank=await one(c,'SELECT * FROM tt_operating_accounts WHERE id=?',text(p.bankId,'Bank account',100)),fund=String(p.fund),primary=p.primary===true||p.primary==='1'||p.primary==='on'
  insist(c.actor.role==='owner','forbidden','Only the owner authorizes bank custody.',403)
  insist(bank,'not_found','Bank account not found.',404)
  insist((fund==='deposit'&&bank.purpose==='deposit')||(fund==='operating'&&['operating','rent_trust'].includes(bank.purpose)),'bank_fund','Deposit accounts cannot receive operating money, or vice versa.',409)
  const mapped=await one(c,'SELECT a.entity_id FROM tt_trust_mappings m JOIN tt_operating_accounts a ON a.id=m.bank_id WHERE m.property_id=? LIMIT 1',prop.id)
  insist(!mapped||mapped.entity_id===bank.entity_id,'legal_entity','A property’s authorized accounts must belong to the same legal entity.',409)
  await commit(c,[sql(c,'INSERT INTO tt_trust_mappings(property_id,bank_id,fund,is_primary,reference,created_by,created_at) VALUES(?,?,?,?,?,?,?)',prop.id,bank.id,fund,primary?1:0,text(p.reference,'Authorization reference',500),c.actor.id,c.now)],command,prop.id)
  return{notice:'Property bank authorization recorded. Historical cash remains unassigned until reviewed.'}
 }
 if(command==='trust.assign'){
  const j=await one(c,'SELECT * FROM tt_journal WHERE id=?',text(p.entryId,'Journal entry',250));insist(j,'not_found','Journal entry not found.',404);await journalProperty(c,j.property_id)
  insist(c.actor.role==='owner','forbidden','Only the owner assigns historical cash.',403)
  const bank=text(p.bankId,'Bank account',100)
  insist(await one(c,'SELECT 1 FROM tt_trust_mappings WHERE property_id=? AND bank_id=? AND fund=?',j.property_id,bank,j.fund),'bank_scope','Account is not authorized for this property and fund.',409)
  insist(await one(c,'SELECT 1 FROM tt_journal_lines l JOIN tt_gl_chart a ON a.code=l.account WHERE l.id=? AND a.cash=1',j.id),'cash_source','Choose a cash source.')
  await commit(c,[sql(c,'INSERT INTO tt_trust_allocations(journal_id,bank_id,recorded_by,recorded_at) VALUES(?,?,?,?)',j.id,bank,c.actor.id,c.now)],command,j.id)
  return{notice:'Historical cash assigned without changing its source entry.'}
 }
 let propertyId:string|undefined
 try{
  let t:Row
  if(command==='trust.prepare'){
   const property=await journalProperty(c,p.propertyId);propertyId=property.id
   insist(!p.toOwnerId||p.toOwnerId===p.ownerId,'inter_owner','Inter-owner transfers are refused.',409)
   insist(!p.toPropertyId||p.toPropertyId===property.id,'inter_property','Inter-property transfers are refused.',409)
   insist(!p.purpose||p.purpose==='transfer','payout_door','Owner payouts cannot use the custody-transfer door; deposit money never pays owners. ACCT-010 owns payouts.',409)
   t={id:id(),property_id:property.id,owner_id:text(p.ownerId,'Beneficiary owner',100),fund:String(p.fund),from_bank:text(p.fromBank,'From bank',100),to_bank:text(p.toBank,'To bank',100),amount_cents:cents(p.amount),day:date(p.day),reason:text(p.reason,'Transfer reason',500)}
   insist(t.from_bank!==t.to_bank,'same_bank','Choose two distinct bank accounts.')
   const guards=await checks(c,t)
   await commit(c,[...guards,sql(c,'INSERT INTO tt_trust_transfers(id,property_id,owner_id,fund,from_bank,to_bank,amount_cents,day,reason,prepared_by,prepared_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)',t.id,t.property_id,t.owner_id,t.fund,t.from_bank,t.to_bank,t.amount_cents,t.day,t.reason,c.actor.id,c.now)],command,t.id)
   return{id:t.id,notice:'Exact transfer prepared for human approval. Nothing sent or posted.'}
  }
  const found=await one(c,'SELECT * FROM tt_trust_transfers WHERE id=?',text(p.transferId,'Transfer',100));insist(found,'not_found','Transfer not found.',404);t=found
  await journalProperty(c,t.property_id);propertyId=t.property_id
  const guards=await checks(c,t)
  if(command==='trust.approve'){
   const independent=await independence(c,command,[t.prepared_by])
   await commit(c,[...guards,...independent.guards,sql(c,'INSERT INTO tt_trust_approvals(transfer_id,approved_by,approved_at,label) VALUES(?,?,?,?)',t.id,c.actor.id,c.now,independent.label)],command,t.id)
   return{notice:'Exact transfer approved. No bank instruction sent.'}
  }
  const approvalSQL='SELECT 1 FROM tt_trust_approvals a JOIN oa_operators o ON o.id=a.approved_by AND o.status=\'active\' WHERE a.transfer_id=? AND (o.role=\'owner\' OR EXISTS(SELECT 1 FROM tt_staff_roles r JOIN tt_role_actions k ON k.role=r.role WHERE r.operator_id=o.id AND k.action=\'trust.approve\' AND (r.all_portfolios=1 OR EXISTS(SELECT 1 FROM tt_role_portfolios p JOIN tt_properties x ON x.portfolio_id=p.portfolio_id WHERE p.operator_id=o.id AND x.id=?))))'
  insist(await one(c,approvalSQL,t.id,t.property_id),'approval_required','A currently authorized human must approve the exact transfer before external recording.',409)
  await commit(c,[...guards,guard(c,'EXISTS('+approvalSQL+')',t.id,t.property_id),sql(c,'INSERT INTO tt_trust_recordings(transfer_id,bank_reference,recorded_by,recorded_at) VALUES(?,?,?,?)',t.id,text(p.bankReference,'External bank reference',500),c.actor.id,c.now)],command,t.id)
  return{notice:'External bank transfer recorded once. Beneficiary and fund unchanged; Terrace sent no instruction.'}
 }catch(error){if(propertyId)await audit(c,'trust.exception',propertyId,(error as Fault).code??'conflict').run();throw error}
}
export async function trustData(c:Context,p:Row={}){
 const ledger=await journalData(c,p.propertyId?{propertyId:p.propertyId}:{}),ids=ledger.properties.map((x:Row)=>x.id),visible=(x:Row)=>ids.includes(x.property_id)&&(!p.propertyId||x.property_id===p.propertyId)
 const [mappings,cash,transfers,allocations,accounts,entities,exceptions]=await Promise.all([
  all(c,'SELECT * FROM tt_trust_mappings ORDER BY property_id,bank_id'),all(c,'SELECT bank_id,property_id,owner_key,fund,SUM(amount_cents) AS balance_cents FROM tt_trust_cash GROUP BY bank_id,property_id,owner_key,fund'),all(c,'SELECT t.*,a.approved_by,a.label,r.bank_reference FROM tt_trust_transfers t LEFT JOIN tt_trust_approvals a ON a.transfer_id=t.id LEFT JOIN tt_trust_recordings r ON r.transfer_id=t.id ORDER BY t.prepared_at,t.id'),all(c,'SELECT * FROM tt_trust_allocations'),all(c,'SELECT a.id,a.name,a.bank_name,a.last4,a.purpose,a.entity_id,e.legal_name FROM tt_operating_accounts a JOIN tt_entities e ON e.id=a.entity_id ORDER BY e.legal_name,a.name,a.id'),c.actor.role==='owner'?all(c,'SELECT id,legal_name FROM tt_entities'):Promise.resolve([]),all(c,"SELECT subject,outcome,at FROM tt_audit WHERE action='trust.exception' ORDER BY at DESC LIMIT 100")])
 const maps=mappings.filter(visible),bankIds=new Set(maps.map(m=>m.bank_id)),unassigned=ledger.entries.filter((j:Row)=>j.lines.some((l:Row)=>l.account==='cash')&&!allocations.some(a=>a.journal_id===j.id))
 const balances=cash.filter(visible).filter(x=>!p.propertyId||x.property_id===p.propertyId)
 const reconciliation=ledger.properties.filter((x:Row)=>!p.propertyId||x.id===p.propertyId).flatMap((property:Row)=>{
  const owners=new Set([...ledger.entries.filter((j:Row)=>j.property_id===property.id).map((j:Row)=>j.owner_key),...balances.filter(x=>x.property_id===property.id).map(x=>x.owner_key)])
  return [...owners].flatMap(ownerId=>['operating','deposit'].map(fund=>{
   const gl=ledger.entries.filter((j:Row)=>j.property_id===property.id&&j.owner_key===ownerId&&j.fund===fund).flatMap((j:Row)=>j.lines).filter((l:Row)=>l.account==='cash').reduce((n:number,l:Row)=>n+l.debit-l.credit,0)
   const assigned=balances.filter(x=>x.property_id===property.id&&x.owner_key===ownerId&&x.fund===fund).reduce((n,x)=>n+x.balance_cents,0)
   return{propertyId:property.id,ownerId,fund,ledgerCents:gl,assignedCents:assigned,unassignedCents:gl-assigned,complete:!unassigned.some((j:Row)=>j.property_id===property.id&&j.owner_key===ownerId&&j.fund===fund)}
  }))
 })
 return{properties:ledger.properties,owners:ledger.owners,accounts:accounts.filter(a=>c.actor.role==='owner'||bankIds.has(a.id)),entities,mappings:maps,balances,transfers:transfers.filter(visible),unassigned,reconciliation,exceptions:exceptions.filter(x=>ids.includes(x.subject)),mayConfigure:c.actor.role==='owner',mayPrepare:can(c,'trust.prepare'),mayApprove:can(c,'trust.approve'),mayRecord:can(c,'trust.record')}
}
