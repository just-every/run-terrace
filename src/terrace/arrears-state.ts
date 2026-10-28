import {all,allow,date,guard,insist,one,sha256,tenancy,text,type Context,type Row} from './core'
import {ageReceivables} from './delinquency-math'
import {effectiveCharges,hapEffects} from './hap-balances'
import {localDate} from './zones'
import {rulePreview} from './rule-packs'

export const addDays=(day:string,n:number)=>new Date(Date.parse(day+'T00:00:00Z')+n*86400000).toISOString().slice(0,10)
export const installationKey=(c:Context)=>sha256(new TextEncoder().encode(c.secret??''))
export const canRecordService=(a:Row)=>a.kind.includes('notice')&&!!a.approved_at&&!['draft','stopped','served'].includes(a.state)
export const native=(c:Context)=>insist(!c.actor.credential&&!c.agentWorkload,'forbidden','A signed-in person must perform this action.',403)
export async function receivable(c:Context,t:Row,asOf=localDate(c.now,t.time_zone)){
 const [charges,receipts,adjustments,effects]=await Promise.all([all(c,'SELECT * FROM tt_charges WHERE tenancy_id=?',t.id),all(c,'SELECT r.* FROM tt_net_receipts r JOIN tt_charges q ON q.id=r.charge_id WHERE q.tenancy_id=?',t.id),all(c,'SELECT a.* FROM tt_adjustments a JOIN tt_charges q ON q.id=a.charge_id WHERE q.tenancy_id=?',t.id),hapEffects(c,t.id)])
 const aging=ageReceivables(t,effectiveCharges(charges,effects,asOf,'resident'),receipts,adjustments,asOf)
 return{...aging,receiptRows:receipts.filter(r=>r.received_date<=asOf)}
}
export async function collectionCase(c:Context,value:unknown,asOf?:string){
 const t=await tenancy(c,value)
 const day=asOf?date(asOf):localDate(c.now,t.time_zone),balance=await receivable(c,t,day)
 const config=await one(c,'SELECT * FROM tt_arrears_cases WHERE tenancy_id=?',t.id)
 const plans=await all(c,'SELECT * FROM tt_arrears_plans WHERE tenancy_id=? AND created_at<=? ORDER BY created_at,rowid',t.id,c.now)
 const events=await all(c,'SELECT * FROM tt_arrears_events WHERE tenancy_id=? AND on_day<=? ORDER BY at,rowid',t.id,day)
 const approved=plans.filter(p=>p.approved_at&&localDate(p.approved_at,t.time_zone)<=day).at(-1)
 const latest=approved?{...approved,installments:JSON.parse(approved.installments),baseline:JSON.parse(approved.baseline)}:null
 const paidSince=(base:Row,on:string)=>balance.receiptRows.filter(r=>!base.receiptIds.includes(r.id)&&(!base.chargeIds||base.chargeIds.includes(r.charge_id))&&r.received_date<=on).reduce((n,r)=>n+r.amount_cents,0)
 let plan:Row|null=null
 if(latest){const due=latest.installments.filter((p:Row)=>p.on<day).reduce((n:number,p:Row)=>n+p.cents,0),paid=paidSince(latest.baseline,day),total=latest.installments.reduce((n:number,p:Row)=>n+p.cents,0)
  plan={...latest,paidCents:paid,totalCents:total,state:paid>=total?'met':paid<due?'broken':'active'}
 }
 const actions:Row[]=(await all(c,'SELECT * FROM tt_arrears_actions WHERE tenancy_id=? AND created_at<=? ORDER BY created_at,rowid',t.id,c.now)).filter(a=>localDate(a.created_at,t.time_zone)<=day).map(a=>({...a,snapshot:JSON.parse(a.snapshot)}))
 const reasons:string[]=[]
 if(t.custody_retired_at)reasons.push('Retired tenancy: no operational collection action')
 if(balance.overdueCents===0)reasons.push('No overdue balance; stop collection messages')
 if(config?.hold&&config.hold!=='none')reasons.push(config.hold+' hold: human review required')
 if(!config?.email_consent||!config.contact_limit)reasons.push('No current email consent or contact allowance')
 const nextAction=reasons.length?reasons.join('; '):plan?.state==='broken'?'Broken promise: human review of plan or notice':plan?.state==='active'?'Monitor agreed installments; no automatic contact':actions.some(a=>a.kind.includes('notice')&&a.state==='served')?'Review served notice expiry and refer to authorized counsel':'Review and approve the next collection action'
 return{tenancy:t,asOf:day,config,balance,plan,plans:plans.map((p):Row=>({...p,installments:JSON.parse(p.installments)})),actions,events:events.map((e):Row=>({...e,detail:JSON.parse(e.detail)})),reasons,nextAction,collectionOutcome:balance.balanceCents===0?'Recorded receivable cleared; bank settlement not established':plan?.state==='met'?'Plan met by recorded receipts; remaining charges stay open':'Open',paidSince}
}
export function noticeExpiry(day:string,rule:Row,method:string){
 const advance=(from:string,count:number,basis:string)=>{
  let value=from,left=count
  while(left>0){value=addDays(value,1);if(basis==='calendar'||(![0,6].includes(new Date(value+'T00:00:00Z').getUTCDay())&&!rule.excludedDates.includes(value)))left--}
  return value
 }
 const period=advance(day,rule.days,rule.dayBasis)
 return method.includes('mail')?advance(period,rule.mailingExtensionDays,rule.mailingExtensionBasis):period
}
export async function noticeRules(c:Context,t:Row,kind:string,on:string){
 const unit=await one(c,'SELECT property_id FROM tt_units WHERE id=?',t.unit_id)
 insist(unit,'rule_gap','A property and reviewed rule pack are required for a notice.',409)
 const preview=await rulePreview(c,{propertyId:unit.property_id,on,action:'notice'})
 insist(preview.state==='reviewed_preview','rule_gap',preview.gaps.join('; '),409)
 const field=kind==='violation_notice'?'leaseViolation':'payOrQuit'
 const rules=preview.packs.map((p:Row)=>{
  const value=p.fields[field].value
  insist(Number.isInteger(value.days)&&value.days>=0&&value.days<=366&&Array.isArray(value.methods)&&value.methods.length&&Number.isInteger(value.mailingExtensionDays)&&value.mailingExtensionDays>=0,'rule_gap','The reviewed pack must explicitly provide notice days, methods and mailing extension.',409)
  insist(['calendar','business'].includes(value.dayBasis)&&['calendar','business'].includes(value.mailingExtensionBasis)&&Array.isArray(value.excludedDates)&&value.excludedDates.every((d:unknown)=>date(d)),'rule_gap','The pack must explicitly state the counting basis and excluded dates for notice and mailing periods.',409)
  return{packId:p.id,code:p.code,version:p.version,citation:p.fields[field].citation,...value}
 })
 return rules
}
export async function actionCurrent(c:Context,a:Row){
 const state=await collectionCase(c,a.tenancy_id),s=JSON.parse(a.snapshot)
 insist(!state.reasons.length,'collection_held',state.reasons.join('; '),409)
 insist(state.config!.version===s.caseVersion&&state.balance.overdueCents===s.balanceCents&&state.balance.balanceCents===s.totalCents&&state.tenancy.version===s.tenancyVersion,'collection_changed','Balance, terms, consent or holds changed. Prepare a new action.',409)
 insist(s.planId===(state.plan?.id??null)&&s.planState===(state.plan?.state??null),'collection_changed','The payment plan changed. Review and prepare a new action.',409)
 if(a.kind==='reminder')insist(!state.plan||state.plan.state!=='active','collection_held','An active plan pauses ordinary reminders.',409)
 return{state,s,fence:guard(c,'EXISTS(SELECT 1 FROM tt_arrears_cases WHERE tenancy_id=? AND version=?)',a.tenancy_id,s.caseVersion)}
}
export async function collectionData(c:Context,value:unknown){
 allow(c,'reports.read');const s=await collectionCase(c,value)
 const forecasts=await all(c,'SELECT * FROM tt_arrears_forecasts WHERE tenancy_id=? ORDER BY at,rowid',s.tenancy.id)
 const actions=await Promise.all(s.actions.map(async (a):Promise<Row>=>({...a,service:await one(c,'SELECT action_id,served_at,method,server,reference,sha256,expires_on FROM tt_arrears_service WHERE action_id=?',a.id)})))
 return{...s,paidSince:undefined,actions,forecasts:forecasts.map(f=>({...f,assumptions:JSON.parse(f.assumptions),comparison:JSON.parse(f.comparison),actual:{chosenActions:actions.filter(a=>a.forecast_id===f.id&&(a.claimed_at||a.service)).map(a=>({id:a.id,kind:a.kind,approvedBy:a.approved_by,approvedAt:a.approved_at,claimedAt:a.claimed_at})),cashCents:s.paidSince(JSON.parse(f.baseline),s.asOf),vacancy:s.events.filter(e=>e.kind==='outcome'&&e.detail.forecastId===f.id).at(-1)?.detail??null}}))}
}
