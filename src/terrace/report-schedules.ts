import {all,allow,commit,guard,id,insist,one,recordRead,sha256,sql,text,type Context,type Row} from './core'
import {journalData,journalProperty} from './journal'
import {financialReport} from './financial-reports'
import {rentRoll} from './rent-roll'
import {delinquencyReport} from './delinquency-report'
import {leasingReport} from './leasing-report'
import {serviceReport} from './service-report'
import {DEFAULT_ZONE,anyZone,localDate} from './zones'
import {month} from './periods'
export const REPORT_SCHEDULE_COMMANDS=['report.schedule','report.retire','report.generate']
const owner=(c:Context)=>{allow(c,'reports.read');insist(c.actor.role==='owner'&&!c.actor.credential,'forbidden','Only the installation owner manages scheduled report generation.',403)}
const digest=(v:unknown)=>sha256(new TextEncoder().encode(JSON.stringify(v)))
const report=async(c:Context,s:Row,from:string,to:string)=>{
 const q={from,to,propertyId:s.property_id,ownerId:s.owner_id||undefined,basis:s.basis,asOf:to}
 if(s.kind==='financial')return financialReport(c,q)
 if(s.kind==='rent_roll')return rentRoll(c,q)
 if(s.kind==='delinquency')return delinquencyReport(c,q)
 if(s.kind==='vacancy')return leasingReport(c,q)
 return serviceReport(c,q)
}
export async function reportScheduleCommand(c:Context,name:string,p:Row):Promise<Row|undefined>{
 if(!REPORT_SCHEDULE_COMMANDS.includes(name))return
 owner(c)
 if(name==='report.schedule'){
  const property=await journalProperty(c,p.propertyId),kind=String(p.kind),basis=String(p.basis||'accrual'),zone=anyZone(p.zone),starts=month(p.starts),day=Number(p.dayOfMonth),hour=Number(p.hour)
  insist(['financial','rent_roll','delinquency','vacancy','maintenance'].includes(kind),'invalid_kind','Choose a supported report.')
  insist(['cash','accrual'].includes(basis),'invalid_basis','Choose cash or accrual.')
  insist(Number.isInteger(day)&&day>=1&&day<=31&&Number.isInteger(hour)&&hour>=0&&hour<=23,'invalid_schedule','Choose a day from 1 to 31 and an hour from 0 to 23.')
  insist(starts>=localDate(c.now,zone).slice(0,7),'past_schedule','Start in this month or later.')
  const ownerId=p.ownerId?text(p.ownerId,'Owner',100):null
  insist(!ownerId||kind==='financial','invalid_owner_filter','Owner filters are supported on financial schedules.')
  if(ownerId){const d=await journalData(c,{propertyId:property.id});insist(d.owners.some(o=>o.id===ownerId),'not_found','Owner not found.',404)}
  insist(p.consent==='GENERATE ONLY','consent_required','Confirm GENERATE ONLY. This schedule sends nothing.')
  const key=id();await commit(c,[sql(c,'INSERT INTO tt_report_schedules(id,name,kind,property_id,owner_id,basis,zone,starts,day_of_month,hour,require_close,created_by,created_at,reference) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)',key,text(p.name,'Schedule name',150),kind,property.id,ownerId,basis,zone,starts,day,hour,p.requireClose===true||p.requireClose==='1'?1:0,c.actor.id,c.now,text(p.reference,'Schedule source',500))],name,key)
  return{id:key,tab:'report-schedules',notice:'Monthly report generation scheduled. No recipient or outbound delivery has been authorized.'}
 }
 if(name==='report.retire'){
  const s=await one(c,'SELECT * FROM tt_report_schedules WHERE id=?',text(p.scheduleId,'Schedule',100));insist(s,'not_found','Schedule not found.',404)
  await commit(c,[sql(c,'UPDATE tt_report_schedules SET retired_at=? WHERE id=? AND retired_at IS NULL',c.now,s.id)],name,s.id)
  return{tab:'report-schedules',notice:'Schedule retired. Historical generation receipts remain.'}
 }
 return{...await reportScheduleTick(c),tab:'report-schedules',notice:'Due generation checked. No email was sent.'}
}
/** Hourly Cron can generate only; authority, close state and the local month are rechecked at the durable write. */
export async function reportScheduleTick(c:Context){
 owner(c)
 const schedules=await all(c,'SELECT * FROM tt_report_schedules WHERE retired_at IS NULL ORDER BY id'),generated:string[]=[],held:string[]=[]
 for(const s of schedules){
  if(s.created_by!==c.actor.id||s.created_at>c.now)continue
  const day=localDate(c.now,s.zone),localMonth=day.slice(0,7),hour=Number(new Intl.DateTimeFormat('en-US',{timeZone:s.zone,hour:'2-digit',hourCycle:'h23'}).format(new Date(c.now)))
  const runDay=Math.min(s.day_of_month,new Date(Date.UTC(Number(localMonth.slice(0,4)),Number(localMonth.slice(5)),0)).getUTCDate())
  if(localMonth<s.starts||Number(day.slice(8))<runDay||(Number(day.slice(8))===runDay&&hour<s.hour))continue
  if(await one(c,'SELECT id FROM tt_report_generations WHERE schedule_id=? AND local_month=?',s.id,localMonth))continue
  await journalProperty(c,s.property_id)
  const end=new Date(localMonth+'-01T00:00:00Z');end.setUTCDate(0);const to=end.toISOString().slice(0,10),from=to.slice(0,8)+'01'
  const closed=await one(c,'SELECT id FROM tt_period_closes WHERE month=? AND reopened_at IS NULL',from.slice(0,7))
  // A close hold remains eligible on the next tick, rather than consuming this month's generation identity.
  if(s.require_close&&!closed){held.push(s.id);continue}
  const data=await report(c,s,from,to),fingerprint=await digest(data),key=id()
  try{await commit(c,[guard(c,'EXISTS(SELECT 1 FROM tt_report_schedules WHERE id=? AND retired_at IS NULL AND created_by=?)',s.id,c.actor.id),...(s.require_close?[guard(c,'EXISTS(SELECT 1 FROM tt_period_closes WHERE id=? AND reopened_at IS NULL)',closed!.id)]:[]),sql(c,"INSERT INTO tt_report_generations(id,schedule_id,local_month,report_from,report_to,state,fingerprint,next_action,generated_at) VALUES(?,?,?,?,?,'generated',?,'Review private report; owner statements require separate explicit delivery approval',?)",key,s.id,localMonth,from,to,fingerprint,c.now)],'report.generate',key);generated.push(key)}catch(e){if(!await one(c,'SELECT id FROM tt_report_generations WHERE schedule_id=? AND local_month=?',s.id,localMonth))throw e}
 }
 return{generated,held}
}
export async function reportScheduleData(c:Context){
 owner(c)
 const [schedules,generations,d]=await Promise.all([all(c,'SELECT * FROM tt_report_schedules ORDER BY created_at,id'),all(c,'SELECT * FROM tt_report_generations ORDER BY generated_at,id'),journalData(c)])
 const closeStates=await all(c,'SELECT month FROM tt_period_closes WHERE reopened_at IS NULL')
 await recordRead(c,'read:report-schedules','report-schedules')
 return{schedules:schedules.map(s=>({...s,authorized:s.created_by===c.actor.id})),generations,properties:d.properties,owners:d.owners,closeStates,zone:c.zone||DEFAULT_ZONE,currentMonth:localDate(c.now,c.zone||DEFAULT_ZONE).slice(0,7)}
}
export async function generatedReport(c:Context,value:unknown){
 owner(c)
 const g=await one(c,'SELECT * FROM tt_report_generations WHERE id=?',text(value,'Generation',100));insist(g,'not_found','Generation not found.',404)
 const s=await one(c,'SELECT * FROM tt_report_schedules WHERE id=?',g.schedule_id)
 insist(s&&s.created_by===c.actor.id&&!s.retired_at,'generation_unavailable','Schedule authority changed or was retired. Review a new schedule.',409)
 await journalProperty(c,s.property_id)
 if(s.require_close)insist(await one(c,'SELECT id FROM tt_period_closes WHERE month=? AND reopened_at IS NULL',g.report_from.slice(0,7)),'period_reopened','The report period was reopened. Review the current report.',409)
 const data=await report(c,s,g.report_from,g.report_to)
 insist(await digest(data)===g.fingerprint,'report_changed','Report sources or visibility changed since generation. Open the current report and review it again.',409)
 await recordRead(c,'read:scheduled-report',g.id)
 return{generation:g,data}
}
