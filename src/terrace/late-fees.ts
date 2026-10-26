import {RESIDENT_EFFECT} from './hap-balances'
import {tenancyGuard,all,allow,can,cents,commit,date,guard,id,insist,one,sha256,shown,sql,tenancy,text,type Context,type Row} from './core'
import {rulePreview} from './rule-packs'
import {BALANCE} from './ledger'
import {RESERVED} from './payments'
import {localDate,nextDay} from './zones'
export const LATE_FEE_COMMANDS=['latefee.policy','latefee.preview','latefee.post','latefee.waive']
const whole=(v:unknown,label:string,max=100000000)=>{insist(Number.isSafeInteger(v)&&Number(v)>=0&&Number(v)<=max,'late_fee_policy',label+' must be an explicit nonnegative whole number.');return Number(v)}
const read=(v:unknown)=>{if(typeof v==='string'){try{return JSON.parse(v)}catch{throw Error('Late-fee terms must be JSON.')}}return v as Row}
const add=(d:string,n:number)=>{for(let i=0;i<n;i++)d=nextDay(d);return d}
function calendar(rule:Row,first:string){
 insist(['calendar','next_business_day'].includes(rule.weekendRule)&&Array.isArray(rule.holidays)&&rule.holidays.length<=366,'late_fee_policy','The reviewed pack must state weekendRule and explicit holiday dates.')
 rule.holidays.forEach((d:unknown)=>date(d,'Reviewed holiday'))
 let day=first
 for(let n=0;n<740;n++){
  const weekday=new Date(day+'T00:00:00Z').getUTCDay()
  if(rule.weekendRule==='calendar'||(weekday!==0&&weekday!==6&&!rule.holidays.includes(day)))return day
  day=nextDay(day)
 }
 throw Error('The reviewed business-day calendar has no reachable fee day.')
}
export async function lateFeeData(c:Context,tenancyId:string){
 allow(c,'ledger.read');await tenancy(c,tenancyId)
 if(c.actor.credential||!(c.actor.role==='owner'||c.actor.staff?.role==='portfolio_manager'))return{restricted:true,policies:[],fees:[],waivers:[]}
 return{restricted:false,policies:(await all(c,'SELECT * FROM tt_late_fee_policies WHERE tenancy_id=? ORDER BY version,id',tenancyId)).map(p=>({...p,terms:JSON.parse(p.terms)})),fees:(await all(c,'SELECT f.*,q.description,q.amount_cents,'+BALANCE+' AS balance_cents FROM tt_late_fees f JOIN tt_charges q ON q.id=f.fee_charge_id WHERE q.tenancy_id=? ORDER BY f.created_at,f.id',tenancyId)).map(f=>({...f,snapshot:JSON.parse(f.snapshot)})),waivers:await all(c,'SELECT w.* FROM tt_late_fee_waivers w JOIN tt_late_fees f ON f.id=w.fee_id JOIN tt_charges q ON q.id=f.fee_charge_id WHERE q.tenancy_id=? ORDER BY w.recorded_at,w.id',tenancyId)}
}
export async function lateFeePreview(c:Context,tenancyId:unknown,onValue:unknown){
 allow(c,'latefee.preview');const t=await tenancy(c,tenancyId),on=date(onValue),today=localDate(c.now,t.time_zone)
 insist(on<=today,'future_schedule','Preview an elapsed schedule day, not a future outcome.')
 const configs=await all(c,'SELECT p.* FROM tt_late_fee_policies p WHERE tenancy_id=? AND version=(SELECT MAX(x.version) FROM tt_late_fee_policies x WHERE x.charge_id=p.charge_id) ORDER BY charge_id',t.id),lines:Row[]=[]
 for(const config of configs){
  const q=await one(c,`SELECT q.*,q.amount_cents+${RESIDENT_EFFECT} AS effective_rent,${BALANCE} AS current_balance,${RESERVED} AS reserved FROM tt_charges q WHERE id=?`,config.charge_id),existing=await one(c,'SELECT * FROM tt_late_fees WHERE source_charge_id=?',config.charge_id),old=existing?JSON.parse(existing.snapshot):null,terms=old?.leaseTerms??JSON.parse(config.terms),property=await one(c,'SELECT p.*,r.version AS jurisdiction_version FROM tt_units u JOIN tt_properties p ON p.id=u.property_id LEFT JOIN tt_property_rules r ON r.property_id=p.id WHERE u.id=?',t.unit_id)
  q!.amount_cents=q!.effective_rent
  const line:Row={sourceChargeId:q!.id,description:q!.description,rentCents:q!.amount_cents,dueDate:q!.due_date,on,leaseTerms:terms,policyId:old?.policyId??config.id,policyVersion:old?.policyVersion??config.version,packs:[],state:'held',gaps:[],currentBalance:q!.current_balance,reserved:q!.reserved,feeId:existing?.id??null}
  lines.push(line)
  if(!property){line.gaps.push('Link the lease to a property with reviewed rules.');continue}
  line.propertyId=property.id;line.jurisdictionVersion=property.jurisdiction_version
  line.structureUnits=old?.structureUnits??(await one(c,'SELECT COUNT(*) AS n FROM tt_units WHERE property_id=?',property.id))!.n
  const preview=old??await rulePreview(c,{propertyId:property.id,action:'late_fee',on,dueDate:q!.due_date,rentCents:q!.amount_cents,unpaidCents:Math.min(q!.amount_cents,Math.max(0,q!.current_balance)),units:line.structureUnits})
  if(!old&&preview.state==='held'){line.gaps=preview.gaps;continue}
  line.packs=preview.packs
  const receipts=await all(c,'SELECT r.* FROM tt_net_receipts r WHERE charge_id=? AND received_date<=? ORDER BY id',q!.id,on),adjustments=await all(c,'SELECT * FROM tt_adjustments WHERE charge_id=? AND COALESCE(posting_day,substr(at,1,10))<=? ORDER BY id',q!.id,on)
  const payerEffects=await all(c,'SELECT resident_delta,posting_day FROM tt_hap_effects WHERE resident_charge_id=? ORDER BY posting_day',q!.id)
  const datedRent=(day:string)=>q!.amount_cents-payerEffects.filter(e=>e.posting_day>day).reduce((n,e)=>n+e.resident_delta,0)
  const unpaid=Math.max(0,datedRent(on)-receipts.reduce((n,r)=>n+r.amount_cents,0)-adjustments.reduce((n,r)=>n+r.amount_cents,0))
  line.unpaidCents=unpaid;line.receipts=receipts.map(r=>r.id);line.adjustments=adjustments.map(r=>r.id)
  const allocations=await all(c,'SELECT p.*,a.amount_cents AS allocated FROM tt_payment_allocations a JOIN tt_payments p ON p.id=a.payment_id WHERE a.charge_id=? AND p.received_date<=? ORDER BY p.id',q!.id,on),outcomes:Row[]=[]
  for(const p of allocations){const event=await one(c,"SELECT state,on_day FROM tt_payment_events WHERE payment_id=? AND on_day<=? ORDER BY on_day DESC,recorded_at DESC,CASE state WHEN 'pending' THEN 0 ELSE 1 END DESC LIMIT 1",p.id,on);outcomes.push({...p,outcome:event})}
  const calculations:Row[]=[]
  for(const pack of line.packs){
   const rule=pack.fields.lateFee.value
   insist(['exclude_timely','count_pending'].includes(rule.pendingPolicy)&&['hold','recalculate_once'].includes(rule.reversalPolicy),'late_fee_policy','Reviewed packs must explicitly state pendingPolicy and reversalPolicy.')
   const grace=Math.max(whole(rule.fullUnpaidDays,'Pack grace',366),terms.fullUnpaidDays),first=calendar(rule,add(q!.due_date,grace+1)),leaseFirst=calendar({weekendRule:terms.weekendRule,holidays:rule.holidays},first),firstFeeDay=first>leaseFirst?first:leaseFirst
   const basisAsOfDay=on<firstFeeDay?on:firstFeeDay
   const unpaidAtEligibility=Math.max(0,datedRent(basisAsOfDay)-receipts.filter(r=>r.received_date<=basisAsOfDay).reduce((n,r)=>n+r.amount_cents,0)-adjustments.filter(r=>(r.posting_day??r.at.slice(0,10))<=basisAsOfDay).reduce((n,r)=>n+r.amount_cents,0))
   const timely=outcomes.filter(p=>p.received_date<firstFeeDay)
   const protectedPending=(rule.pendingPolicy==='exclude_timely'||terms.excludeTimely)?timely.filter(p=>p.outcome?.state==='pending'||(p.outcome?.state==='settled'&&p.outcome.on_day>basisAsOfDay)).reduce((n,p)=>n+p.allocated,0):0
   const eligible=Math.max(0,unpaidAtEligibility-protectedPending),count=line.structureUnits
   if(rule.reversalPolicy==='hold'&&timely.some(p=>p.outcome?.state==='failed'))line.gaps.push(pack.code+': failed timely pending payment requires reviewed manual resolution.')
   const capBp=whole(count<=whole(rule.smallStructureMaxUnits,'Small structure limit')?rule.smallStructureCapBp:rule.largeStructureCapBp,'Pack cap basis points',10000)
   insist(rule.basis==='monthly_rent','late_fee_policy','A reviewed monthly_rent basis is required; other bases are held.')
   const cap=Math.floor(q!.amount_cents*capBp/10000),fee=on>=firstFeeDay&&eligible>0?Math.min(terms.feeCents,terms.capCents,cap):0
   calculations.push({code:pack.code,version:pack.version,citation:pack.fields.lateFee.citation,basis:rule.basis,basisCents:q!.amount_cents,basisAsOfDay,structureUnits:count,capBp,capCents:cap,fullUnpaidDays:grace,weekendRule:rule.weekendRule,holidays:rule.holidays,firstFeeDay,pendingPolicy:rule.pendingPolicy,reversalPolicy:rule.reversalPolicy,protectedPendingCents:protectedPending,eligibleUnpaidCents:eligible,feeCents:fee})
   if(rule.reversalPolicy==='hold'&&receipts.some(r=>r.reversal_of))line.gaps.push(pack.code+': receipt reversal requires reviewed manual resolution; no new fee inferred.')
  }
  line.calculations=calculations;line.feeCents=Math.min(...calculations.map(r=>r.feeCents));line.state=line.gaps.length?'held':line.feeCents?'ready':'not_due'
  if(existing){
   const fee=await one(c,`SELECT q.*,${BALANCE} AS unpaid,${RESERVED} AS reserved FROM tt_charges q WHERE id=?`,existing.fee_charge_id),reduced=await one(c,'SELECT COALESCE(SUM(amount_cents),0) AS n FROM tt_adjustments WHERE charge_id=?',fee!.id)
   line.postedChargeId=fee!.id;line.postedCents=fee!.amount_cents;line.feeUnpaid=fee!.unpaid;line.feeReserved=fee!.reserved
   const desired=Math.max(0,fee!.amount_cents-line.feeCents-reduced!.n)
   line.reductionCents=Math.min(desired,fee!.unpaid-fee!.reserved)
   if(desired>line.reductionCents){line.state='held';line.gaps.push('A paid or reserved fee needs reviewed refund/reallocation; no automatic reversal.')}
   else if(!line.gaps.length)line.state=line.reductionCents?'reduction':'posted'
  }
 }
 const body={tenancyId:t.id,tenancyVersion:t.version,on,currency:shown(t),lines};return{...body,fingerprint:await sha256(new TextEncoder().encode(JSON.stringify(body)))}
}
export async function lateFeeCommand(c:Context,command:string,p:Row):Promise<Row|undefined>{
 if(!LATE_FEE_COMMANDS.includes(command))return
 allow(c,command);insist(c.actor.role==='owner'&&!c.actor.credential,'forbidden','Only the owner manages reviewed late fees.',403)
 if(command==='latefee.policy'){
  const t=await tenancy(c,p.tenancyId),q=await one(c,'SELECT q.*,l.kind FROM tt_charges q LEFT JOIN tt_lease_terms l ON l.id=q.term_id WHERE q.id=? AND q.tenancy_id=?',text(p.chargeId,'Rent charge'),t.id),terms=p.terms?read(p.terms):{fullUnpaidDays:Number(p.fullUnpaidDays),feeCents:String(p.fee)==='0'?0:cents(p.fee),capCents:String(p.cap)==='0'?0:cents(p.cap),weekendRule:p.weekendRule,excludeTimely:p.excludeTimely==='true'}
  insist(q,'not_found','Rent charge not found.',404);insist(shown(t)==='USD'&&t.cadence==='monthly'&&!q.tax_rule_id&&(!q.kind||q.kind==='rent')&&!await one(c,'SELECT 1 FROM tt_late_fees WHERE fee_charge_id=?',q.id),'late_fee_basis','Only a confirmed USD monthly rent charge can be a basis; fees never compound.',409)
  const fixed={fullUnpaidDays:whole(terms.fullUnpaidDays,'Lease grace',366),feeCents:whole(terms.feeCents,'Lease fee cents'),capCents:whole(terms.capCents,'Lease cap cents'),weekendRule:terms.weekendRule,excludeTimely:terms.excludeTimely}
  insist(['calendar','next_business_day'].includes(fixed.weekendRule)&&typeof fixed.excludeTimely==='boolean','late_fee_policy','State the lease weekend rule and excludeTimely explicitly.')
  const current=(await one(c,'SELECT MAX(version) AS n FROM tt_late_fee_policies WHERE charge_id=?',q.id))!.n??0,key=id();insist(Number(p.version)===current,'conflict','Review the latest lease fee policy.',409)
  await commit(c,[tenancyGuard(c,t),guard(c,'COALESCE((SELECT MAX(version) FROM tt_late_fee_policies WHERE charge_id=?),0)=?',q.id,current),sql(c,'INSERT INTO tt_late_fee_policies(id,tenancy_id,charge_id,version,terms,reference,created_by,created_at) VALUES(?,?,?,?,?,?,?,?)',key,t.id,q.id,current+1,JSON.stringify(fixed),text(p.reference,'Approved lease late-fee reference',500),c.actor.id,c.now)],command,key)
  return{id:key,tenancyId:t.id,notice:'Lease late-fee terms recorded. Active pack limits still apply; no fee posted.'}
 }
 if(command==='latefee.waive'){
  const f=await one(c,'SELECT * FROM tt_late_fees WHERE id=?',text(p.feeId,'Late fee')),q=f&&await one(c,`SELECT q.*,${BALANCE} AS unpaid,${RESERVED} AS reserved FROM tt_charges q WHERE id=?`,f.fee_charge_id);insist(q,'not_found','Late fee not found.',404)
  const t=await tenancy(c,q.tenancy_id),amount=cents(p.amount),on=date(p.on),reason=text(p.reason,'Waiver reason',1000),key=id()
  insist(on>=q.due_date&&on<=localDate(c.now,t.time_zone),'invalid_date','Waive on or after the fee date and no later than today.')
  insist(amount<=q.unpaid-q.reserved,'exceeds_balance','Waiver exceeds the unreserved unpaid fee.',409)
  await commit(c,[tenancyGuard(c,t),guard(c,`(SELECT ${BALANCE}-${RESERVED} FROM tt_charges q WHERE id=?)>=?`,q.id,amount),sql(c,'INSERT INTO tt_adjustments(id,charge_id,amount_cents,reason,at,currency,reference,posting_day) VALUES(?,?,?,?,?,?,?,?)',key,q.id,amount,reason,c.now,q.currency,'late-waiver:'+text(p.reference,'Unique waiver reference',150),on),sql(c,'INSERT INTO tt_late_fee_waivers(id,fee_id,amount_cents,reason,on_day,recorded_by,recorded_at) VALUES(?,?,?,?,?,?,?)',key,f!.id,amount,reason,on,c.actor.id,c.now)],command,key)
  return{id:key,tenancyId:t.id,notice:'Reasoned late-fee waiver recorded; original fee and policy retained.'}
 }
 const report=await lateFeePreview(c,p.tenancyId,p.on)
 if(command==='latefee.preview')return{...report,lateFeePreview:report}
 insist(p.fingerprint===report.fingerprint,'review_changed','The fee calculation changed. Preview and review again.',409)
 insist(report.lines.length&&!report.lines.some(l=>l.state==='held'),'rule_hold','Resolve held calculations before posting.',409)
 const writes:D1PreparedStatement[]=[tenancyGuard(c,{id:report.tenancyId,version:report.tenancyVersion})]
 for(const l of report.lines){
  writes.push(guard(c,`(SELECT ${BALANCE} FROM tt_charges q WHERE id=?)=?`,l.sourceChargeId,l.currentBalance),guard(c,`(SELECT ${RESERVED} FROM tt_charges q WHERE id=?)=?`,l.sourceChargeId,l.reserved))
  if(!l.feeId){
   writes.push(guard(c,'(SELECT COUNT(*) FROM tt_units WHERE property_id=?)=?',l.propertyId,l.structureUnits),guard(c,'(SELECT id FROM tt_late_fee_policies WHERE charge_id=? ORDER BY version DESC LIMIT 1)=?',l.sourceChargeId,l.policyId),guard(c,'(SELECT version FROM tt_property_rules WHERE property_id=?)=?',l.propertyId,l.jurisdictionVersion))
   for(const pack of l.packs)writes.push(guard(c,'(SELECT id FROM tt_rule_packs WHERE code=? AND effective_from<=? ORDER BY effective_from DESC,version DESC LIMIT 1)=?',pack.code,report.on,pack.id))
  }
  if(l.state==='ready'){
   const feeId=id(),chargeId=id();writes.push(sql(c,'INSERT INTO tt_charges(id,tenancy_id,due_date,amount_cents,description,reference,created_at,currency) VALUES(?,?,?,?,?,?,?,?)',chargeId,report.tenancyId,report.on,l.feeCents,'Late fee on '+l.description,'LATE-'+l.sourceChargeId,c.now,'USD'),sql(c,'INSERT INTO tt_late_fees(id,source_charge_id,fee_charge_id,policy_id,snapshot,created_by,created_at) VALUES(?,?,?,?,?,?,?)',feeId,l.sourceChargeId,chargeId,l.policyId,JSON.stringify(l),c.actor.id,c.now))
  }else if(l.state==='reduction'){
   writes.push(guard(c,`(SELECT ${BALANCE}-${RESERVED} FROM tt_charges q WHERE id=?)=?`,l.postedChargeId,l.feeUnpaid-l.feeReserved),sql(c,'INSERT INTO tt_adjustments(id,charge_id,amount_cents,reason,at,currency,reference,posting_day) VALUES(?,?,?,?,?,?,?,?)',id(),l.postedChargeId,l.reductionCents,'Reviewed late-fee recalculation under frozen policy',c.now,'USD','late-recalculation:'+id(),report.on))
  }
 }
 const key=id();writes.push(sql(c,'INSERT INTO tt_late_fee_runs(id,tenancy_id,on_day,snapshot,recorded_by,recorded_at) VALUES(?,?,?,?,?,?)',key,report.tenancyId,report.on,JSON.stringify(report),c.actor.id,c.now))
 await commit(c,writes,command,key)
 return{id:key,tenancyId:report.tenancyId,notice:'Reviewed late-fee schedule recorded once. Original policies retained; no compounding or message sent.'}
}
