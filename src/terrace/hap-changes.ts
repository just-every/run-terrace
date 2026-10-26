import { all, allow, commit, date, guard, id, insist, one, recordRead, sha256, sql, tenancy, tenancyGuard, text, type Context, type Row } from './core'
import { independence } from './dual-control'
import { localDate } from './zones'
import { hapEffects, PHA_EFFECT, RESIDENT_EFFECT } from './hap-balances'

export const HAP_CHANGE_COMMANDS=['hap.change.prepare','hap.change.preview','hap.change.approve']
function portion(v:unknown){const s=text(String(v??''),'Payer portion',16);insist(/^\d+(\.\d{1,2})?$/.test(s),'invalid_money','Enter an explicit payer portion in exact cents, including zero.');const n=Math.round(Number(s)*100);insist(Number.isSafeInteger(n)&&n<=100000000,'invalid_money','Payer portion is too large.');return n}
const digest=(v:unknown)=>sha256(new TextEncoder().encode(JSON.stringify(v)))
export async function hapChanges(c:Context,tenancyId:string){await tenancy(c,tenancyId);return all(c,'SELECT * FROM tt_hap_changes WHERE tenancy_id=? ORDER BY prepared_at,id',tenancyId)}
async function notice(c:Context,versionId:unknown,tenancyId:string){
 const v=await one(c,"SELECT v.id,v.sha256,d.id AS document_id FROM tt_document_versions v JOIN tt_documents d ON d.id=v.document_id WHERE v.id=? AND d.tenancy_id=? AND d.kind='hap' AND d.retention_class='accounting'",text(versionId,'PHA notice version',100),tenancyId)
 insist(v,'notice_required','Attach the stored PHA accounting notice for this tenancy.',409);return v
}
async function reviewed(c:Context,v:Row,t:Row){
 insist(!v.approved_at,'already_approved','This PHA change was already applied.',409)
 insist(v.base_version===t.version,'review_changed','The tenancy changed. Prepare a new PHA change.',409)
 const source=await notice(c,v.notice_version_id,t.id),effects=await hapEffects(c,t.id)
 const haps=await all(c,'SELECT * FROM tt_hap_charges WHERE tenancy_id=? AND period_end>=? AND period_start<=? ORDER BY period_start,id',t.id,v.effective_from,v.effective_to)
 const lines:Row[]=[]
 for(const q of haps){
  insist(q.payer===v.payer&&q.period_start>=v.effective_from&&q.period_end<=v.effective_to,'hap_coverage','The notice must cover complete posted rent segments for the same PHA.',409)
  const resident=await one(c,'SELECT q.*,('+RESIDENT_EFFECT+') AS delta FROM tt_charges q WHERE tenancy_id=? AND term_id=? AND period_start=? AND period_end=?',t.id,q.term_id,q.period_start,q.period_end)
  const oldPha=q.amount_cents+effects.filter(e=>e.hap_charge_id===q.id).reduce((n,e)=>n+e.pha_delta,0),oldResident=resident?resident.amount_cents+resident.delta:0
  const payload=JSON.parse((await one(c,'SELECT payload FROM tt_lease_versions WHERE id=?',q.lease_version_id))!.payload),term=payload.terms.find((x:Row)=>x.id===q.term_id)
  const days=(Date.parse(q.period_end)-Date.parse(q.period_start))/86400000+1,periodDays=new Date(Number(q.period_start.slice(0,4)),Number(q.period_start.slice(5,7)),0).getDate()
  // A notice changes entitlement, never the signed gross rent or the other payer's arrears.
  insist(term&&v.kind==='abatement'||term&&v.resident_cents+v.pha_cents===term.amountCents,'hap_split','The revised portions must equal the signed gross monthly rent.',409)
  let residentDelta=0,phaDelta=-oldPha
  if(v.kind==='split'){
   insist(!effects.some(e=>e.hap_charge_id===q.id&&e.kind==='abatement'),'abatement_review','An abated period needs a new explicit accounting review rather than recreating subsidy.',409)
   const nextResident=Math.floor((2*v.resident_cents*days+periodDays)/(2*periodDays)),gross=q.amount_cents+(resident?.amount_cents??0)
   residentDelta=nextResident-oldResident;phaDelta=gross-nextResident-oldPha
  }
  insist(oldResident+residentDelta>=0&&oldPha+phaDelta>=0,'hap_split','A payer entitlement cannot be negative.',409)
  lines.push({hap:q,resident,residentDelta,phaDelta,oldPha,oldResident,days,periodDays})
 }
 insist(lines.length,'hap_period','Post the affected rent periods before reviewing this correction.',409)
 const body={changeId:v.id,tenancyId:t.id,tenancyVersion:t.version,notice:source,kind:v.kind,effectiveFrom:v.effective_from,effectiveTo:v.effective_to,reason:v.reason,reference:v.reference,lines,effects}
 return {...body,fingerprint:await digest(body)}
}

/** Allocate signed corrections using the original charge beneficiaries, including exact-cent remainder. */
async function correctionJournal(c:Context,q:Row,delta:number,sourceId:string,payer:string,day:string){
 if(!delta)return []
 const source=await all(c,"SELECT * FROM tt_journal WHERE source_kind=? AND source_id=? ORDER BY owner_key",payer==='pha'?'hap_charge':'charge',q.id)
 insist(source.length,'hap_journal','The original charge has no beneficiary journal.',409)
 const weights=source.map(j=>JSON.parse(j.lines).reduce((n:number,l:Row)=>n+(l.account==='receivable'?l.debit-l.credit:0),0)),total=weights.reduce((n,x)=>n+x,0),amount=Math.abs(delta)
 insist(total>0,'hap_journal','The original beneficiary proportions must be positive.',409)
 const shares=weights.map(n=>Math.floor(amount*n/total));shares[weights.indexOf(Math.max(...weights))]+=amount-shares.reduce((n,x)=>n+x,0)
 return source.flatMap((j,i)=>shares[i]?[sql(c,'INSERT INTO tt_journal(id,day,property_id,owner_key,tenancy_id,fund,source_kind,source_id,reference,lines,recorded_by,recorded_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)',id(),day,j.property_id,j.owner_key,q.tenancy_id,'operating',payer==='pha'?'hap_pha_effect':'hap_resident_effect',sourceId,sourceId,JSON.stringify([{account:'receivable',debit:delta>0?shares[i]:0,credit:delta<0?shares[i]:0},{account:'lease_income',debit:delta<0?shares[i]:0,credit:delta>0?shares[i]:0}]),c.actor.id,c.now)]:[])
}
export async function hapChangeCommand(c:Context,name:string,p:Row):Promise<Row|undefined>{
 if(!HAP_CHANGE_COMMANDS.includes(name))return
 allow(c,name)
 if(name==='hap.change.prepare'){
  const t=await tenancy(c,p.tenancyId),kind=text(p.kind,'Change kind',20),from=date(p.effectiveFrom),to=date(p.effectiveTo),payer=text(p.payer,'Housing authority',200)
  insist(['split','abatement'].includes(kind),'hap_kind','Choose split or abatement.')
  insist(from<=to&&from>=t.start_date&&to<=(t.ended_on??t.end_date)&&to<=localDate(c.now,t.time_zone),'hap_period','Use a completed entitlement interval within the lease and no later than today.')
  insist(kind!=='abatement'||from.slice(0,7)===to.slice(0,7),'hap_period','Record each inspection abatement as one explicitly reviewed month.')
  const source=await notice(c,p.noticeVersionId,t.id),key=id(),resident=kind==='split'?portion(p.residentPortion):null,pha=kind==='split'?portion(p.phaPortion):null
  await commit(c,[tenancyGuard(c,t),sql(c,'INSERT INTO tt_hap_changes(id,tenancy_id,kind,effective_from,effective_to,resident_cents,pha_cents,payer,notice_version_id,reason,reference,base_version,prepared_by,prepared_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)',key,t.id,kind,from,to,resident,pha,payer,source.id,text(p.reason,'PHA reason',1000),text(p.reference,'Unique PHA change reference',150),t.version,c.actor.id,c.now)],name,key)
  return {changeId:key,tenancyId:t.id,tab:'ledger',notice:'PHA notice recorded. Review the exact payer changes before independent approval.'}
 }
 const v=await one(c,'SELECT * FROM tt_hap_changes WHERE id=?',text(p.changeId,'PHA change',100));insist(v,'not_found','PHA change not found.',404)
 const t=await tenancy(c,v.tenancy_id),r=await reviewed(c,v,t)
 if(name==='hap.change.preview'){await recordRead(c,name,v.id);return {...r,hapChangePreview:r}}
 insist(p.fingerprint===r.fingerprint,'review_changed','Payer balances or the PHA notice changed. Review again.',409)
 insist((await one(c,'SELECT COUNT(*) AS n FROM tt_hap_charges WHERE tenancy_id=? AND period_end>=? AND period_start<=?',t.id,v.effective_from,v.effective_to))!.n===r.lines.length,'review_changed','Affected charges changed. Review again.',409)
 const independent=await independence(c,name,[v.prepared_by]),day=localDate(c.now,t.time_zone),writes=[tenancyGuard(c,t),...independent.guards,guard(c,'EXISTS(SELECT 1 FROM tt_hap_changes WHERE id=? AND approved_at IS NULL)',v.id),guard(c,'(SELECT COUNT(*) FROM tt_hap_charges WHERE tenancy_id=? AND period_end>=? AND period_start<=?)=?',t.id,v.effective_from,v.effective_to,r.lines.length),guard(c,'(SELECT COUNT(*) FROM tt_hap_effects WHERE tenancy_id=?)=?',t.id,r.effects.length),guard(c,'EXISTS(SELECT 1 FROM tt_document_versions WHERE id=? AND sha256=?)',r.notice.id,r.notice.sha256)]
 for(const l of r.lines){
  let residentId=l.resident?.id??null,residentDelta=l.residentDelta
  if(!residentId&&residentDelta>0){
   residentId=id();writes.push(sql(c,'INSERT INTO tt_charges(id,tenancy_id,due_date,amount_cents,description,reference,created_at,currency,term_id,period_start,period_end) VALUES(?,?,?,?,?,?,?,?,?,?,?)',residentId,t.id,l.hap.due_date,residentDelta,'Resident HAP portion',l.hap.reference.replace(/-HAP$/,''),c.now,'USD',l.hap.term_id,l.hap.period_start,l.hap.period_end));residentDelta=0
  }
  const effectId=id()
  writes.push(guard(c,`NOT EXISTS(SELECT 1 FROM tt_hap_allocations a JOIN tt_hap_remittances r ON r.id=a.remittance_id WHERE a.charge_id=? AND r.state='pending') OR (SELECT q.amount_cents+${PHA_EFFECT} FROM tt_hap_charges q WHERE q.id=?)+?>=(SELECT COALESCE(SUM(a.amount_cents),0) FROM tt_hap_allocations a JOIN tt_hap_remittances r ON r.id=a.remittance_id WHERE a.charge_id=? AND r.state<>'failed')`,l.hap.id,l.hap.id,l.phaDelta,l.hap.id))
  writes.push(sql(c,'INSERT INTO tt_hap_effects(id,change_id,tenancy_id,resident_charge_id,hap_charge_id,resident_delta,pha_delta,posting_day,effective_from,effective_to,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)',effectId,v.id,t.id,residentId,l.hap.id,residentDelta,l.phaDelta,day,l.hap.period_start,l.hap.period_end,c.now),...await correctionJournal(c,l.hap,l.phaDelta,effectId,'pha',day),...(l.resident?await correctionJournal(c,l.resident,l.residentDelta,effectId,'resident',day):[]))
 }
 writes.push(sql(c,'UPDATE tt_hap_changes SET approved_by=?,approved_at=?,approval_label=? WHERE id=?',c.actor.id,c.now,independent.label,v.id),sql(c,'UPDATE tt_tenancies SET version=version+1 WHERE id=?',t.id))
 await commit(c,writes,name,v.id)
 return {changeId:v.id,tenancyId:t.id,tab:'ledger',notice:'Reviewed PHA correction applied once. Prior signed terms and payer history remain; no payment or resident debt transfer occurred.'}
}
