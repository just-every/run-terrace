import {all,allow,commit,date,guard,id,insist,one,sha256,sql,tenancy,tenancyGuard,text,type Context,type Row} from './core'
import {localDate} from './zones'
import {independence} from './dual-control'
import {scan,LIMIT} from './document-scan'
import {actionCurrent,addDays,collectionCase,installationKey,native,noticeRules,noticeExpiry} from './arrears-state'
import {compareArrears} from './arrears-forecast'
export const ARREARS_COMMANDS=['arrears.contact','arrears.reply','arrears.plan','arrears.plan-approve','arrears.draft','arrears.approve','arrears.send','arrears.service','arrears.outcome','arrears.compare']
export const event=(c:Context,t:string,kind:string,detail:Row,reference:string,on:string)=>sql(c,'INSERT INTO tt_arrears_events(id,tenancy_id,kind,detail,reference,on_day,actor,at) VALUES(?,?,?,?,?,?,?,?)',id(),t,kind,JSON.stringify(detail),reference,on,c.actor.id,c.now)
const stop=(c:Context,t:string)=>sql(c,"UPDATE tt_arrears_actions SET state='stopped',version=version+1 WHERE tenancy_id=? AND state IN ('draft','approved')",t)
export async function arrearsCommand(c:Context,name:string,p:Row):Promise<Row|undefined>{
 if(!ARREARS_COMMANDS.includes(name))return
 allow(c,name)
 if(!['arrears.compare','arrears.draft'].includes(name))native(c)
 if(['arrears.compare','arrears.draft'].includes(name))allow(c,'reports.read')
 if(name==='arrears.compare')return compareArrears(c,p)
 const s=await collectionCase(c,p.tenancyId),t=s.tenancy,on=s.asOf
 insist(!t.custody_retired_at,'retired','This tenancy is retired from operational use.',409)
 const ref=()=>text(p.reference,'Source reference',2000)
 const base=[tenancyGuard(c,t)]
 let writes:D1PreparedStatement[]=[],key=id()
 if(name==='arrears.contact'){
  insist(c.actor.role==='owner','forbidden','Only the owner configures collection consent and holds.',403)
  insist(Number(p.version)===(s.config?.version??0),'conflict','Reload current collection consent.',409)
  insist(['none','dispute','accommodation','contact_limit','counsel','manual'].includes(p.hold),'hold','Choose the explicit collection hold.')
  const limit=Number(p.contactLimit);insist(Number.isInteger(limit)&&limit>=0&&limit<=7,'contact_limit','Set a weekly contact limit from zero to seven.')
  writes=[guard(c,'COALESCE((SELECT version FROM tt_arrears_cases WHERE tenancy_id=?),0)=?',t.id,s.config?.version??0),stop(c,t.id),sql(c,'INSERT INTO tt_arrears_cases(tenancy_id,version,email_consent,contact_limit,hold,reference,installation,actor,at) VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(tenancy_id) DO UPDATE SET version=excluded.version,email_consent=excluded.email_consent,contact_limit=excluded.contact_limit,hold=excluded.hold,reference=excluded.reference,installation=excluded.installation,actor=excluded.actor,at=excluded.at',t.id,(s.config?.version??0)+1,p.emailConsent==='granted'?1:0,limit,p.hold,ref(),await installationKey(c),c.actor.id,c.now),event(c,t.id,'contact',{consent:p.emailConsent==='granted',limit,hold:p.hold},ref(),on)]
 }else if(name==='arrears.reply'){
  const day=date(p.on);insist(day<=on,'future_reply','Future replies cannot be recorded.')
  writes=[event(c,t.id,'reply',{body:text(p.body,'Sourced resident reply',5000),label:'Staff-recorded reply; not authenticated resident origin'},ref(),day)]
 }else if(name==='arrears.plan'){
  insist(s.balance.overdueCents>0,'no_arrears','There is no overdue balance.',409)
  const values=typeof p.installments==='string'?JSON.parse(p.installments):p.installments
  insist(Array.isArray(values)&&values.length&&values.length<=24,'plan','Supply one promise or up to 24 installments.')
  const installments=values.map((v:Row)=>({on:date(v.on),cents:Number(v.cents)}))
  insist(installments.every((v:Row,i:number)=>v.on>=on&&Number.isSafeInteger(v.cents)&&v.cents>0&&(!i||v.on>installments[i-1].on))&&installments.reduce((n:number,v:Row)=>n+v.cents,0)===s.balance.overdueCents,'plan','Dated installments must increase in date and cover the exact overdue balance in cents.')
  writes=[sql(c,'INSERT INTO tt_arrears_plans(id,tenancy_id,installments,baseline,reference,created_by,created_at) VALUES(?,?,?,?,?,?,?)',key,t.id,JSON.stringify(installments),JSON.stringify({receiptIds:s.balance.receiptRows.map(r=>r.id),chargeIds:s.balance.charges.filter(q=>q.ageDays>0&&q.outstandingCents>0).map(q=>q.chargeId),balanceCents:s.balance.overdueCents,caseVersion:s.config?.version??0}),ref(),c.actor.id,c.now),event(c,t.id,'plan_prepared',{planId:key,installments},ref(),on)]
 }else if(name==='arrears.plan-approve'){
  const plan=await one(c,'SELECT * FROM tt_arrears_plans WHERE id=? AND tenancy_id=?',text(p.planId,'Plan',100),t.id)
  insist(plan&&!plan.approved_at,'plan','Choose an undecided plan.',409)
  const b=JSON.parse(plan.baseline);insist(b.caseVersion===(s.config?.version??0)&&b.balanceCents===s.balance.overdueCents,'collection_changed','Balance or consent changed. Prepare a new plan.',409)
  insist(p.consent==='APPROVE EXACT PLAN','confirmation','Approve the exact dated installments.')
  const independent=await independence(c,'proposal.approve',[plan.created_by]);key=plan.id
  writes=[...independent.guards,guard(c,'EXISTS(SELECT 1 FROM tt_arrears_plans WHERE id=? AND approved_at IS NULL)',key),sql(c,'UPDATE tt_arrears_plans SET approved_by=?,approved_at=? WHERE id=?',c.actor.id,c.now,key),sql(c,'UPDATE tt_arrears_cases SET version=version+1 WHERE tenancy_id=?',t.id),stop(c,t.id),event(c,t.id,'plan_approved',{planId:key,label:independent.label},ref(),on)]
 }else if(name==='arrears.draft'){
  insist(!s.reasons.length,'collection_held',s.reasons.join('; '),409)
  const kind=String(p.kind);insist(['reminder','plan','pay_or_quit_notice','violation_notice'].includes(kind),'kind','Choose reminder, plan or a reviewed notice.')
  if(kind==='plan')insist(s.plan&&s.plan.state==='active','plan','Approve an active payment plan before drafting its delivery.',409)
  if(kind==='reminder')insist(s.plan?.state!=='active','collection_held','An active payment plan pauses ordinary reminders.',409)
  const due=date(p.dueOn);insist(due>=on,'due','A draft sequence step cannot be backdated.')
  if(kind.includes('notice'))insist(on>=t.start_date&&on<=(t.ended_on??t.end_date),'notice_term','Review former-resident authority with counsel; this notice door requires a current tenancy.',409)
  const rules=kind.includes('notice')?await noticeRules(c,t,kind,on):null
  let forecast:Row|null=null
  if(p.forecastId){forecast=await one(c,'SELECT * FROM tt_arrears_forecasts WHERE id=? AND tenancy_id=?',p.forecastId,t.id);insist(forecast,'not_found','Forecast not found.',404);const x=JSON.parse(forecast.comparison);insist(!x.paused.length,'collection_held','The forecast was paused. Recalculate after human review.',409);insist(x.rentAtRiskCents===s.balance.overdueCents,'collection_changed','Recalculate after a balance change.',409);if(x.recommended!==kind)text(p.overrideReason,'Reason for human choice',1000)}
  const snapshot={caseVersion:s.config!.version,balanceCents:s.balance.overdueCents,totalCents:s.balance.balanceCents,tenancyVersion:t.version,planId:s.plan?.id??null,planState:s.plan?.state??null,installments:kind==='plan'?s.plan!.installments:null,rules,recipient:t.tenant_email,overrideReason:p.overrideReason??null}
  writes=[guard(c,'EXISTS(SELECT 1 FROM tt_arrears_cases WHERE tenancy_id=? AND version=?)',t.id,s.config!.version),sql(c,'INSERT INTO tt_arrears_actions(id,tenancy_id,kind,body,snapshot,due_on,forecast_id,created_by,created_at,installation) VALUES(?,?,?,?,?,?,?,?,?,?)',key,t.id,kind,text(p.body,'Exact message',5000),JSON.stringify(snapshot),due,forecast?.id??null,c.actor.id,c.now,await installationKey(c)),event(c,t.id,'draft',{actionId:key,kind},'Exact recipient and terms prepared for human approval',on)]
 }else if(name==='arrears.outcome'){
  const f=await one(c,'SELECT id FROM tt_arrears_forecasts WHERE id=? AND tenancy_id=?',text(p.forecastId,'Forecast',100),t.id)
  insist(f,'not_found','Forecast not found.',404)
  const vacantDays=Number(p.vacantDays);insist(Number.isInteger(vacantDays)&&vacantDays>=0&&vacantDays<=730,'vacancy','Record actual vacant days.')
  const day=date(p.on);insist(day<=on,'future_outcome','Future actual outcomes cannot be recorded.')
  writes=[event(c,t.id,'outcome',{forecastId:f.id,vacantDays,label:'Staff-recorded vacancy; cash reads recorded ledger receipts'},ref(),day)]
 }else{
  const a=await one(c,'SELECT * FROM tt_arrears_actions WHERE id=? AND tenancy_id=?',text(p.actionId,'Collection action',100),t.id)
  insist(a,'not_found','Collection action not found.',404);key=a.id
  insist(Number(p.version)===a.version,'conflict','Reload the current collection action.',409)
  insist(a.installation===await installationKey(c)&&s.config?.installation===a.installation,'restored_authority','Restored evidence cannot authorize execution. Record new consent and prepare a new action.',409)
  if(name==='arrears.service'){
   insist(a.kind.includes('notice')&&a.approved_at&&['approved','accepted','delivered'].includes(a.state),'approval','An approved notice is required before recording physical service.',409)
   const current=await actionCurrent(c,a);base.push(current.fence)
   insist(p.consent==='RECORD SERVICE','confirmation','Confirm the exact notice and sourced service evidence.')
   const served=text(p.servedAt,'Service instant',35);insist(/(?:Z|[+-]\d\d:\d\d)$/.test(served)&&Number.isFinite(Date.parse(served))&&Date.parse(served)<=Date.parse(c.now),'service_date','Use an actual service instant with a timezone, no later than now.')
   const day=localDate(served,t.time_zone);insist(Date.parse(served)>=Date.parse(a.approved_at),'service_date','Service must follow approval.')
   const method=text(p.method,'Service method',100),rules=JSON.parse(a.snapshot).rules as Row[]
   insist(rules.every(r=>r.methods.includes(method)),'service_method','Every applicable reviewed pack must permit the service method.',409)
   const photo=p.photo;insist(photo instanceof File&&photo.size>0&&photo.size<=LIMIT,'photo','Upload the original service photo (up to 5 MB).')
   const bytes=new Uint8Array(await photo.arrayBuffer()),checked=await scan(bytes,photo.type);insist(checked.ok&&['image/jpeg','image/png'].includes(photo.type),'photo','Use a valid JPEG or PNG service photo.')
   const fingerprint=await sha256(bytes);insist(!await one(c,'SELECT 1 FROM tt_erased_document_files WHERE sha256=?',fingerprint),'erased_artifact','This service original was erased.',409)
   const expires=rules.map(r=>noticeExpiry(day,r,method)).sort().at(-1)!
   writes=[sql(c,'INSERT INTO tt_arrears_service(action_id,served_at,method,server,reference,photo,media_type,sha256,expires_on,actor,at) VALUES(?,?,?,?,?,?,?,?,?,?,?)',a.id,served,method,text(p.server,'Person who served',200),ref(),bytes,photo.type,fingerprint,expires,c.actor.id,c.now),sql(c,"UPDATE tt_arrears_actions SET state='served',version=version+1 WHERE id=?",a.id),event(c,t.id,'served',{actionId:a.id,expiresOn:expires,method,servedAt:served},ref(),day)]
  }else{
   const current=await actionCurrent(c,a);base.push(current.fence)
   if(name==='arrears.approve'){
    insist(a.state==='draft'&&p.consent==='APPROVE EXACT ACTION','approval','Review the exact draft before approval.',409)
    const independent=await independence(c,'proposal.approve',[a.created_by])
    writes=[...independent.guards,sql(c,"UPDATE tt_arrears_actions SET state='approved',approved_by=?,approved_at=?,version=version+1 WHERE id=?",c.actor.id,c.now,a.id),event(c,t.id,'approved',{actionId:a.id,label:independent.label},ref(),on)]
   }else{
    insist(a.state==='approved','approval','Approve the exact action before sending it once.',409)
    insist(a.due_on<=on,'not_due','This sequence step is not due yet.',409)
    insist(p.consent==='SEND EXACT ACTION','confirmation','Confirm this exact one-time outbound action.')
    return{id:a.id,tenancyId:t.id,tab:'delinquency',arrearsSend:{id:a.id,version:a.version}}
   }
  }
  base.push(guard(c,'EXISTS(SELECT 1 FROM tt_arrears_actions WHERE id=? AND version=?)',a.id,a.version))
 }
 c.source=p.reference?ref():null
 await commit(c,[...base,...writes],name,key)
 return{id:key,tenancyId:t.id,tab:name==='arrears.contact'?'settings':'delinquency',notice:'Collection evidence recorded. No automatic outbound or ledger action performed.'}
}
