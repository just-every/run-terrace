// On-demand documentary analysis. Reads grant no workload, proposal or execution authority.
import {all,allow,cents,date,insist,text,type Context,type Row} from './core'
import {noCredential} from './credentials'
import {serviceReport} from './service-report'
import {leasingReport} from './leasing-report'
import {percent} from './leasing-metrics'
import {localDate} from './zones'

export function riskOwner(c:Context){
 noCredential(c,'analyze operating risks')
 insist(c.actor.role==='owner','forbidden','Only the installation owner can analyze operating risks.',403)
 for(const action of ['reports.read','maintenance.report','work.read','prospect.read'])allow(c,action)
}
export async function riskChoices(c:Context,propertyId?:string){
 riskOwner(c)
 const properties=await all(c,'SELECT id,name,time_zone FROM tt_properties ORDER BY name,id')
 insist(!propertyId||properties.some(p=>p.id===propertyId),'not_found','Property not found.',404)
 const assets=propertyId?await all(c,`SELECT a.id,a.kind,a.location,a.serial,a.state FROM tt_assets a
 JOIN tt_tenancies t ON t.id=a.tenancy_id JOIN tt_units u ON u.id=COALESCE(a.unit_id,t.unit_id)
 WHERE u.property_id=? AND t.erased_at IS NULL ORDER BY a.kind,a.location,a.id`,propertyId):[]
 return {properties,assets}
}
export async function operatingRisks(c:Context,q:Row){
 riskOwner(c)
 const propertyId=text(q.propertyId,'Property',100),from=date(q.from,'From'),to=date(q.to,'To')
 const choices=await riskChoices(c,propertyId),property=choices.properties.find(p=>p.id===propertyId)!
 const selected=String(q.assetIds??'').split(',').map(s=>s.trim()).filter(Boolean)
 insist(selected.length>0&&selected.length<=30&&new Set(selected).size===selected.length,'invalid_input','Select 1 to 30 distinct recorded HVAC assets.')
 // Resolve all IDs before reading source details; a wrong property or erased source stays absent.
 insist(selected.every(id=>choices.assets.some(a=>a.id===id)),'not_found','Selected asset not found for this property.',404)
 const assets=selected.map(id=>choices.assets.find(a=>a.id===id)!)
 insist(assets.every(a=>/\b(hvac|heating|cooling|air condition(?:er|ing))\b/i.test(a.kind)),'invalid_input','Select equipment recorded as HVAC, heating, cooling or air conditioning.')
 const [service,leasing]=await Promise.all([serviceReport(c,{propertyId,from,to}),leasingReport(c,{propertyId,from,to})])
 const jobs=service.rows.filter(j=>selected.includes(j.assetId??''))
 const cases=await Promise.all(jobs.map(async j=>{
  const [attempts,checks]=await Promise.all([
   all(c,'SELECT id,attempt,completed_date,summary,reference,callback,recorded_by,recorded_at FROM tt_completion_attempts WHERE job_id=? ORDER BY attempt',j.jobId),
   all(c,'SELECT id,attempt_id,outcome,note,label,recorded_by,recorded_at FROM tt_resident_checks WHERE job_id=? ORDER BY recorded_at,rowid',j.jobId),
  ])
  const knownAttempts=attempts.filter(a=>a.completed_date<=to&&localDate(a.recorded_at,property.time_zone)<=to)
  const ids=new Set(knownAttempts.map(a=>a.id))
  const knownChecks=checks.filter(r=>ids.has(r.attempt_id)&&localDate(r.recorded_at,property.time_zone)<=to)
  return {jobId:j.jobId,tenancyId:j.tenancyId,assetId:j.assetId,title:j.title,preparedOn:j.preparedOn,
   currentStatus:j.label,attempts:knownAttempts,checks:knownChecks,
   estimateCents:j.estimateCents,currency:j.currency,approvedTerms:j.approvedTerms,costBasis:j.costBasis,
   gaps:[...(!knownAttempts.length?['No completion evidence known by window end.']:[]),...(!knownChecks.length?['No resident-check evidence known by window end.']:[])]}
 }))
 const hvac=assets.map(a=>{
  const mine=cases.filter(j=>j.assetId===a.id),attempts=mine.flatMap(j=>j.attempts),checks=mine.flatMap(j=>j.checks)
  const callbacks=attempts.filter(r=>r.callback)
  const approved=mine.filter(j=>j.approvedTerms)
  const estimates=[...new Set(approved.map(j=>j.currency))].map(currency=>({currency,cents:approved.filter(j=>j.currency===currency).reduce((n,j)=>n+j.estimateCents,0),basis:'Current approved estimates, not settled costs or callback charges.'}))
  return {assetId:a.id,kind:a.kind,location:a.location,serial:a.serial,state:a.state,jobs:mine,
   measured:{jobs:mine.length,attempts:attempts.length,callbacks:callbacks.length,warrantyCallbacks:callbacks.filter(r=>r.callback==='warranty').length,billableCallbacks:callbacks.filter(r=>r.callback==='billable').length,residentConfirmedChecks:checks.filter(r=>r.outcome==='confirmed').length,unresolvedChecks:checks.filter(r=>r.outcome==='unresolved').length,noResponseChecks:checks.filter(r=>r.outcome==='no_response').length},
   finding:callbacks.length>=2?'Repeated callbacks recorded':callbacks.length?'One callback recorded; insufficient evidence of repeated callbacks':'Insufficient callback evidence',
   hypothesis:callbacks.length?'Possible recurring equipment or repair issue; these records establish no cause. A person must inspect the source cases.':null,
   estimates,settledCostCents:null,realizedSavingsCents:null}
 })
 const prospects=leasing.funnel.flatMap(f=>f.prospects.map(p=>({...p,source:f.source})))
 const shown=prospects.filter(p=>p.showing),applied=prospects.filter(p=>p.applied)
 const showingGaps=shown.filter(p=>!p.applied),applicationGaps=applied.filter(p=>!p.leased)
 const transition=(denominator:number,rows:Row[])=>({denominator,dropoff:rows.length,dropoffPercent:percent(rows.length,denominator),prospectIds:rows.map(p=>p.prospectId),evidence:denominator?'Observed cohort drop-off; later outcomes remain unknown.':'Insufficient evidence: zero denominator.'})
 let assumptions:Row|null=null
 const assumptionKeys=['assumptionDate','assumptionReference','preventiveCost','callbackCost','avoidedCallbacks']
 if(assumptionKeys.some(k=>q[k]!==undefined&&q[k]!=='')){
  const asOf=date(q.assumptionDate,'Assumption date')
  insist(asOf<=localDate(c.now,property.time_zone),'invalid_date','Assumptions cannot be future dated.')
  const count=Number(q.avoidedCallbacks)
  insist(/^\d+$/.test(String(q.avoidedCallbacks))&&Number.isSafeInteger(count)&&count>=0&&count<=1000,'invalid_input','Assumed avoided callbacks must be a whole count from 0 to 1000.')
  const cost=cents(q.preventiveCost),callbackCost=cents(q.callbackCost)
  assumptions={asOf,reference:text(q.assumptionReference,'Assumption source',500),currency:'USD',preventiveCostCents:cost,callbackCostCents:callbackCost,avoidedCallbacks:count,
   grossBenefitCents:count*callbackCost,netBenefitCents:count*callbackCost-cost,
   basis:'Owner-supplied scenario only: assumed avoided callbacks multiplied by assumed cost per callback, less assumed preventive cost. No measured probability, approved plan, settled cost or realized saving.'}
 }
 return {asOf:c.now,property:{id:propertyId,name:property.name,timeZone:property.time_zone},from,to,hvac,
  leasing:{funnel:leasing.funnel,prospects,excludedProspects:leasing.excludedProspects,reviewedSeparate:leasing.reviewedSeparate,
   showingToApplication:transition(shown.length,showingGaps),applicationToLease:transition(applied.length,applicationGaps),
   hypothesis:showingGaps.length||applicationGaps.length?'Possible leasing bottleneck; recorded drop-off does not establish its cause or a lost lease.':null,
   formulas:{cohort:leasing.formulas.leadConversion,dropoff:leasing.formulas.dropoff}},assumptions,
  gaps:['HVAC cases are jobs prepared in the inclusive property-local window; attempt effective dates and recording dates, and check recording dates, must be on or before To. Earlier jobs are outside this preparation cohort.',
   'Completion and resident outcomes are staff records, not independent confirmation. Current job status and approval terms are snapshots; neither is a historical status at To.',
   'Missing or skipped prospect stages remain unknown. Cohort drop-off is observation, not causation or a forecast of final conversion.',
   'Invoices, settled costs and realized savings are unknown. Approved estimates are grouped by currency and never used as callback costs.',
   ...(assumptions?[]:['No dated cost and benefit scenario supplied; forecast is unknown.']),
   'Read-only analysis creates no workload, proposal, approval or provider request. Preventive plans, activation and later actual-versus-forecast stewardship remain unavailable.']}
}
