import {all,allow,date,id,insist,sql,text,commit,tenancyGuard,type Context,type Row} from './core'
import {collectionCase,noticeRules,noticeExpiry} from './arrears-state'
const integer=(v:unknown,label:string,max=100000000)=>{const n=Number(v);insist(v!==''&&v!==undefined&&Number.isSafeInteger(n)&&n>=0&&n<=max,'assumption',label+' requires an explicit whole number.');return n}
const round=(n:bigint,d:bigint)=>Number((n*2n+d)/(d*2n))
export async function compareArrears(c:Context,p:Row){
 allow(c,'reports.read')
 const s=await collectionCase(c,p.tenancyId),t=s.tenancy,on=date(p.on,'Assumptions date')
 insist(on===s.asOf,'assumption_date','Use the current property-local day for a new forecast.',409)
 insist(s.balance.overdueCents>0,'no_arrears','There is no overdue receivable to compare.',409)
 const rules=await noticeRules(c,t,'pay_or_quit_notice',on)
 const methods:string[]=rules[0].methods.filter((method:string)=>rules.every((r:Row)=>r.methods.includes(method)))
 insist(methods.length,'rule_gap','The reviewed packs must share a permitted notice service method.',409)
 const timeline=methods.map(method=>({method,days:Math.max(...rules.map((r:Row)=>{insist(Number.isInteger(r.turnoverDays)&&r.turnoverDays>=0&&r.turnoverDays<=730,'rule_gap','The pack must explicitly provide the eventual turnover timeline.',409);return (Date.parse(noticeExpiry(on,r,method))-Date.parse(on))/86400000+r.turnoverDays}))})).sort((a,b)=>b.days-a.days||a.method.localeCompare(b.method))[0]
 const assumption={on,vacantDays:integer(p.vacantDays,'Vacant days',366),makeReadyCents:integer(p.makeReadyCents,'Make-ready cents'),leasingCents:integer(p.leasingCents,'Leasing cents'),waitingDays:integer(p.waitingDays,'Waiting days',366),noticeRecoveryBp:integer(p.noticeRecoveryBp,'Notice recovery basis points',10000),source:text(p.source,'Dated assumptions source',2000),rules,noticeMethod:timeline.method}
 const due=s.balance.charges.filter(q=>q.ageDays>0),paid=due.filter(q=>q.outstandingCents===0).length
 const missedPlans=(await all(c,"SELECT detail FROM tt_arrears_events WHERE tenancy_id=? AND kind='broken_promise'",t.id)).length+(s.plan?.state==='broken'?1:0)
 // Laplace smoothing expresses the uncertainty of a small payment-history sample.
 const probabilityBp=Math.floor((paid+1)*10000/(due.length+2+missedPlans*2))
 const candidate=typeof p.installments==='string'?JSON.parse(p.installments):p.installments
 insist(Array.isArray(candidate)&&candidate.length>0&&candidate.length<=24,'installments','Supply dated plan installments.')
 const installments=candidate.map((x:Row)=>({on:date(x.on),cents:integer(x.cents,'Installment cents')}))
 insist(installments.every((x:Row)=>x.on>=on&&x.cents>0)&&installments.reduce((n:number,x:Row)=>n+x.cents,0)===s.balance.overdueCents,'installments','Plan installments must cover the exact overdue balance on future or current dates.')
 const rentPerYear=BigInt(t.rent_cents)*BigInt(({weekly:52,fortnightly:26,monthly:12} as Record<string,number>)[t.cadence])
 const rentFor=(days:number)=>round(rentPerYear*BigInt(days),365n)
 const planCash=installments.map((x:Row)=>({...x,expectedCents:round(BigInt(x.cents)*BigInt(probabilityBp),10000n)}))
 const expectedPlan=planCash.reduce((n:number,x:Row)=>n+x.expectedCents,0),noticeCash=round(BigInt(s.balance.overdueCents)*BigInt(assumption.noticeRecoveryBp),10000n)
 const options=[{kind:'plan',cashByDate:planCash,cashCents:expectedPlan,vacantDays:0,lossCents:s.balance.overdueCents-expectedPlan},
  {kind:'pay_or_quit_notice',cashCents:noticeCash,vacantDays:assumption.vacantDays,turnoverDays:timeline.days,vacancyRentCents:rentFor(assumption.vacantDays),lossCents:s.balance.overdueCents-noticeCash+rentFor(assumption.vacantDays)+assumption.makeReadyCents+assumption.leasingCents},
  {kind:'wait',cashCents:expectedPlan,vacantDays:0,waitingDays:assumption.waitingDays,lossCents:s.balance.overdueCents-expectedPlan+rentFor(assumption.waitingDays)}]
 const comparison={rentAtRiskCents:s.balance.overdueCents,currency:s.balance.currency,probabilityBp,paymentHistory:due.map(q=>({chargeId:q.chargeId,dueDate:q.dueDate,receipts:q.receipts,outstandingCents:q.outstandingCents})),missedPlans,confidence:due.length>=6?'moderate':'low: small recorded history',options,recommended:[...options].sort((a,b)=>a.lossCents-b.lossCents)[0].kind,paused:s.reasons,formula:'History weight = (fully paid overdue charges + 1) divided by (overdue charges + 2 + twice missed plans). Plan cash is each dated installment times that weight. Notice loss = arrears less assumed recovered cash plus vacant rent, make-ready and leasing. Waiting adds rent at risk during the waiting period. These are estimates, never legal advice or settlement.'}
 const recommended=comparison.recommended
 Object.assign(comparison,{draft:{kind:recommended,state:comparison.paused.length?'paused':'unsent_suggestion',installments:recommended==='plan'?installments:null,body:comparison.paused.length?null:recommended==='plan'?`Proposed payment plan for ${t.tenant_name}: ${installments.map((x:Row)=>x.on+' '+(x.cents/100).toFixed(2)+' '+t.currency).join('; ')}. Please reply to confirm these exact terms.`:recommended==='pay_or_quit_notice'?`Draft pay-or-quit notice for ${t.tenant_name}: ${(s.balance.overdueCents/100).toFixed(2)} ${t.currency} overdue. Reviewed periods: ${rules.map((r:Row)=>r.code+' version '+r.version+', '+r.days+' days from service, '+r.citation).join('; ')}. Human legal review and separately evidenced permitted service are required.`:'Wait for the dated review; no outbound action is proposed.'}})
 const key=id(),baseline={receiptIds:s.balance.receiptRows.map(r=>r.id),chargeIds:s.balance.charges.filter(q=>q.ageDays>0&&q.outstandingCents>0).map(q=>q.chargeId)}
 await commit(c,[tenancyGuard(c,t),sql(c,'INSERT INTO tt_arrears_forecasts(id,tenancy_id,assumptions,comparison,baseline,actor,at) VALUES(?,?,?,?,?,?,?)',key,t.id,JSON.stringify(assumption),JSON.stringify(comparison),JSON.stringify(baseline),c.actor.id,c.now)],'arrears.compare',key)
 return{id:key,assumptions:assumption,comparison,tenancyId:t.id,tab:'delinquency',notice:'Comparison prepared. A person must review, approve and send any action.'}
}
