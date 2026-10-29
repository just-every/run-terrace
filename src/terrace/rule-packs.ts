import {all,allow,cents,commit,date,guard,id,insist,one,reachesPortfolio,sql,text,type Context,type Row} from './core'
import {journalProperty} from './journal'
import {ruleSource} from './rule-sources'
import {STATES,OVERLAYS,RULE_FIELDS,ACTION_FIELDS} from './rule-registry'
import {localDate,nextDay} from './zones'
import {jurisdictionCommand} from './rule-jurisdictions'
export const RULE_COMMANDS=['rules.pack','rules.activate','property.rules','property.rules.propose','property.rules.confirm','rules.preview']
const known=(code:string)=>STATES.some(s=>s[0]===code)||OVERLAYS.some(s=>s[0]===code)
const integer=(v:unknown,name:string,min=0,max=100000000)=>{insist(Number.isSafeInteger(v)&&Number(v)>=min&&Number(v)<=max,'invalid_rule',name+' must be an explicit bounded whole number.');return Number(v)}
const add=(d:string,n:number)=>{let out=d;for(let i=0;i<n;i++)out=nextDay(out);return out}
export async function ruleData(c:Context,propertyId?:string|null){
 allow(c,'rules.read')
 if(propertyId)await journalProperty(c,propertyId)
 const owner=c.actor.role==='owner'
 const [versions,properties,assignments,decisions,proposals]=await Promise.all([all(c,'SELECT p.*,a.activated_at,a.activated_by FROM tt_rule_packs p LEFT JOIN tt_rule_activations a ON a.pack_id=p.id ORDER BY code,version'),all(c,'SELECT id,name,portfolio_id,time_zone FROM tt_properties ORDER BY name'),all(c,'SELECT * FROM tt_property_rules ORDER BY property_id'),all(c,'SELECT * FROM tt_rule_decisions ORDER BY recorded_at,id'),all(c,'SELECT p.*,r.version AS confirmed_version,r.confirmed_at FROM tt_property_rule_proposals p LEFT JOIN tt_property_rule_confirmations r ON r.proposal_id=p.id ORDER BY p.proposed_at,p.id')])
 const mine=properties.filter(p=>reachesPortfolio(c,p.portfolio_id)&&(!propertyId||p.id===propertyId)),ids=new Set(mine.map(p=>p.id))
 const scopedAssignments:Row[]=assignments.filter(a=>ids.has(a.property_id)).map(a=>({...a,overlays:JSON.parse(a.overlays)})),codes=new Set(scopedAssignments.flatMap(a=>[a.state_code,...a.overlays]))
 const packs=[...STATES.map(([code,name])=>({code,name,state:code})),...OVERLAYS.map(([code,name,state])=>({code,name,state}))].filter(r=>owner||codes.has(r.code)).map(r=>{
  const history=versions.filter(v=>v.code===r.code).map(v=>({code:v.code,id:v.id,version:v.version,effective_from:v.effective_from,activated_at:v.activated_at,reviewer:owner||v.activated_at?v.reviewer:'Not activated',review_reference:owner||v.activated_at?v.review_reference:'Not activated',fields:owner||v.activated_at?JSON.parse(v.fields):{},reviewState:v.activated_at?'owner-recorded counsel review':'draft — not active'}))
  return{...r,versions:history,latest:history.at(-1)??null}
 })
 const propertyStates=mine.map(p=>{
  const assignment=scopedAssignments.find(a=>a.property_id===p.id),heldReasons:string[]=[],on=localDate(c.now,p.time_zone)
  if(!assignment)heldReasons.push('State and local overlays have not been explicitly assigned by the owner.')
  else for(const code of [assignment.state_code,...assignment.overlays]){
   const pack=versions.filter(v=>v.code===code&&v.effective_from<=on).sort((a,b)=>b.effective_from.localeCompare(a.effective_from)||b.version-a.version)[0]
   if(!pack){heldReasons.push(code+': no dated pack');continue}
   if(!pack.activated_at)heldReasons.push(code+': counsel review not recorded and activated')
   const fields=JSON.parse(pack.fields)
   for(const [key,label]of Object.entries(RULE_FIELDS))if(!fields[key])heldReasons.push(code+': missing '+label);else if(fields[key].effectiveDate>on)heldReasons.push(code+': '+label+' is not effective on the action day')
  }
  return{...p,heldReasons}
 })
 const saved=decisions.filter(d=>ids.has(d.property_id)).map(d=>{
  const result=JSON.parse(d.result)
  return owner?{...d,input:JSON.parse(d.input),result}:{id:d.id,property_id:d.property_id,action:d.action,on_day:d.on_day,result:{state:result.state,gaps:result.gaps,notice:result.notice,packs:[],calculations:[]}}
 })
 return{packs,properties:propertyStates,assignments:scopedAssignments,decisions:saved,proposals:proposals.filter(p=>ids.has(p.property_id)&&(owner||p.proposed_by===c.actor.id)),mayConfigure:owner,mayPropose:!owner&&c.actor.staff?.role==='portfolio_manager',fields:RULE_FIELDS,actions:Object.keys(ACTION_FIELDS)}
}
export async function rulePreview(c:Context,p:Row){
 const property=await journalProperty(c,p.propertyId),on=date(p.on,'Action day'),action=text(p.action,'Action',40)
 insist(Object.hasOwn(ACTION_FIELDS,action),'invalid_action','Choose a supported rule-dependent action.')
 const assignment=await one(c,'SELECT * FROM tt_property_rules WHERE property_id=?',property.id),packs:Row[]=[],gaps:string[]=[]
 if(!assignment)gaps.push('State and local overlays have not been explicitly assigned by the owner.')
 else for(const code of [assignment.state_code,...JSON.parse(assignment.overlays)]){
  const pack=await one(c,'SELECT p.*,a.activated_at FROM tt_rule_packs p LEFT JOIN tt_rule_activations a ON a.pack_id=p.id WHERE code=? AND effective_from<=? ORDER BY effective_from DESC,version DESC LIMIT 1',code,on)
  if(!pack){gaps.push(code+': no dated pack');continue}
  const fields=JSON.parse(pack.fields);packs.push({id:pack.id,code,version:pack.version,effectiveFrom:pack.effective_from,reviewer:pack.reviewer,reviewReference:pack.review_reference,fields})
  if(!pack.activated_at)gaps.push(code+': counsel review not recorded and activated')
  for(const field of ACTION_FIELDS[action])if(!fields[field])gaps.push(code+': missing '+RULE_FIELDS[field]);else if(fields[field].effectiveDate>on)gaps.push(code+': '+RULE_FIELDS[field]+' is not effective on the action day')
 }
 const result:Row={action,on,propertyId:property.id,state:gaps.length?'held':'reviewed_preview',gaps,packs,calculations:[],notice:'A source-based preview only. No notice was sent, lease changed, charge posted or money moved.'}
 if(gaps.length)return result
 // An overlay is evaluated separately; every applicable pack must permit the action. No field fallback.
 for(const pack of packs){
  const field=(k:string)=>pack.fields[k].value,calc:Row={code:pack.code,version:pack.version}
  if(action==='disposition'){
   const surrender=date(p.surrenderDate,'Surrender date'),deposit=integer(p.depositCents,'Deposit cents',1),claimed=p.claim===true||p.claim==='yes'
   const refund=field('depositRefund'),itemization=field('depositItemization'),delivery=field('dispositionDelivery')
   const days=integer(claimed?itemization.days:refund.noClaimDays??refund.days,'Disposition days',0,366)
   const methods=claimed?delivery.claim:delivery.refund
   insist(Array.isArray(methods)&&methods.length&&methods.every((m:unknown)=>['personal_delivery','first_class_mail','certified_mail','electronic_with_consent'].includes(String(m))),'invalid_rule','The pack must explicitly name disposition delivery methods.')
   insist(typeof delivery.address==='string'&&delivery.address.trim(),'invalid_rule','The pack must explicitly state its address rule.')
   Object.assign(calc,{depositCents:deposit,surrenderDate:surrender,claim:claimed,dueOn:add(surrender,days),days,methods,addressRule:delivery.address,citations:[pack.fields.depositRefund.citation,pack.fields.depositItemization.citation,pack.fields.dispositionDelivery.citation]})
  }else if(action==='late_fee'){
   const rule=field('lateFee'),rent=integer(p.rentCents,'Rent cents',1),unpaid=integer(p.unpaidCents,'Unpaid cents',0,rent),due=date(p.dueDate,'Rent due date'),units=integer(p.units,'Structure units',1,100000),fullDays=integer(rule.fullUnpaidDays,'Full unpaid grace days',0,366)
   const capBp=integer(units<=integer(rule.smallStructureMaxUnits,'Small structure maximum units',1)?rule.smallStructureCapBp:rule.largeStructureCapBp,'Fee cap basis points',0,10000)
   insist(rule.basis==='monthly_rent','invalid_rule','This calculator requires an explicitly reviewed monthly-rent basis.')
   const firstChargeDay=add(due,fullDays+1),feeCents=on>=firstChargeDay&&unpaid>0?Math.floor(rent*capBp/10000):0
   Object.assign(calc,{rentCents:rent,unpaidCents:unpaid,fullUnpaidDays:fullDays,firstChargeDay,capBp,feeCents,citation:pack.fields.lateFee.citation})
  }else if(action==='renewal'){
   const rule=field('rentCap'),current=integer(p.currentRentCents,'Current rent cents',1),proposed=integer(p.proposedRentCents,'Proposed rent cents',1)
   insist(rule.applies===true||rule.applies===false,'invalid_rule','Rent-cap applicability must be explicitly reviewed in the pack.')
   if(rule.applies)text(p.cpiSource,'Dated CPI review source',500)
   const capBp=rule.applies?Math.min(integer(rule.baseBp,'Base cap',0,10000)+integer(p.reviewedCpiBp,'Reviewed CPI basis points',0,10000),integer(rule.absoluteBp,'Absolute cap',0,10000)):null
   const maxRentCents=capBp===null?null:Math.floor(current*(10000+capBp)/10000)
   Object.assign(calc,{currentRentCents:current,proposedRentCents:proposed,reviewedCpiBp:p.reviewedCpiBp,capBp,maxRentCents,citation:pack.fields.rentCap.citation})
   if(maxRentCents!==null&&proposed>maxRentCents){result.state='held';result.gaps.push(pack.code+': proposed increase exceeds the reviewed cap')}
  }else if(action==='nonrenewal'){
   const rule=field('justCause'),months=integer(p.occupancyMonths,'Occupancy months',0,12000),threshold=integer(rule.occupancyMonths,'Just-cause occupancy threshold',0,12000)
   Object.assign(calc,{occupancyMonths:months,threshold,cause:p.justCause?text(p.justCause,'Recorded just cause',1000):null,citation:pack.fields.justCause.citation})
   if(months>=threshold&&!calc.cause){result.state='held';result.gaps.push(pack.code+': record a counsel-reviewed just cause before proceeding')}
  }else Object.assign(calc,{fields:Object.fromEntries(ACTION_FIELDS[action].map(k=>[k,pack.fields[k]]))})
  result.calculations.push(calc)
 }
 return result
}
export async function ruleCommand(c:Context,command:string,p:Row):Promise<Row|undefined>{
 if(!RULE_COMMANDS.includes(command))return
 allow(c,command)
 const jurisdiction=await jurisdictionCommand(c,command,p);if(jurisdiction)return jurisdiction
 if(command==='rules.pack'){
  if(p.file instanceof File){insist(p.file.size>0&&p.file.size<=100000,'pack_file','Choose a reviewed rule-pack JSON file up to 100 KB.');let data;try{data=JSON.parse(await p.file.text())}catch{throw Error('The pack file must contain valid JSON.')}p={...data,reference:p.reference}}
  const code=text(p.code,'Pack code',80),version=Number(p.version),effective=date(p.effectiveFrom),reviewer=text(p.reviewer,'Counsel reviewer',200),reference=text(p.reviewReference,'Counsel review source',1000)
  insist(known(code),'invalid_pack','Choose a named state or local overlay.')
  const prior=await one(c,'SELECT MAX(version) AS version,MAX(effective_from) AS effective FROM tt_rule_packs WHERE code=?',code),next=(prior?.version??0)+1
  insist(version===next&&(!prior?.effective||effective>=prior.effective),'pack_version','Publish the next version with no earlier effective day.',409)
  insist(p.fields&&typeof p.fields==='object'&&!Array.isArray(p.fields)&&Object.keys(p.fields).every(k=>Object.hasOwn(RULE_FIELDS,k)),'invalid_rule','Use only the declared rule fields.')
  for(const [key,v]of Object.entries(p.fields) as [string,Row][]){text(v.citation,RULE_FIELDS[key]+' citation',1000);date(v.effectiveDate,RULE_FIELDS[key]+' effective day');insist(v.value!==undefined&&v.value!==null,'invalid_rule','Each supplied field needs an explicit reviewed value.')}
  const key=id();await commit(c,[guard(c,'COALESCE((SELECT MAX(version) FROM tt_rule_packs WHERE code=?),0)=?',code,next-1),sql(c,'INSERT INTO tt_rule_packs(id,code,version,effective_from,fields,reviewer,review_reference,created_by,created_at) VALUES(?,?,?,?,?,?,?,?,?)',key,code,version,effective,JSON.stringify(p.fields),reviewer,reference,c.actor.id,c.now)],command,key)
  return{id:key,version,notice:'New dated draft retained. It is inactive until explicit owner-recorded counsel review activation.'}
 }
 if(command==='rules.activate'){
  const pack=await one(c,'SELECT * FROM tt_rule_packs WHERE id=?',text(p.packId,'Pack',100));insist(pack,'not_found','Pack not found.',404)
  insist(p.consent==='REVIEWED','review_consent','Type REVIEWED to confirm this exact counsel source and version.')
  const fields=JSON.parse(pack.fields);insist(Object.keys(RULE_FIELDS).every(k=>fields[k]),'incomplete_pack','Every declared field needs a sourced reviewed value; no defaults are substituted.',409)
  const state=pack.code.split(':')[0],rank=STATES.findIndex(s=>s[0]===state),prereqs=pack.code.includes(':')?[state]:STATES.slice(0,Math.min(rank,10)).map(s=>s[0])
  for(const code of prereqs)insist(await one(c,'SELECT 1 FROM tt_rule_packs p JOIN tt_rule_activations a ON a.pack_id=p.id WHERE code=?',code),'activation_order','Activate '+code+' before this pack.',409)
  await commit(c,[sql(c,'INSERT INTO tt_rule_activations(pack_id,activated_by,activated_at,consent) VALUES(?,?,?,?)',pack.id,c.actor.id,c.now,p.consent)],command,pack.id)
  return{id:pack.id,notice:'Owner-recorded counsel review activated for this exact version. Terrace has not verified the reviewer or given legal advice.'}
 }
 for(const [amount,cent]of [['deposit','depositCents'],['rent','rentCents'],['unpaid','unpaidCents'],['currentRent','currentRentCents'],['proposedRent','proposedRentCents']])if(p[amount]!==undefined&&p[amount]!=='')p[cent]=String(p[amount])==='0'?0:cents(p[amount])
 for(const k of ['units','occupancyMonths','reviewedCpiBp'])if(p[k]!==undefined&&p[k]!=='')p[k]=Number(p[k])
 const result=await rulePreview(c,p),key=id(),source=await ruleSource(c,result.propertyId,result.on)
 await commit(c,[sql(c,'INSERT INTO tt_rule_decisions(id,property_id,action,on_day,input,result,recorded_by,recorded_at) VALUES(?,?,?,?,?,?,?,?)',key,result.propertyId,result.action,result.on,JSON.stringify(p),JSON.stringify(result),c.actor.id,c.now),sql(c,'INSERT INTO tt_rule_decision_sources(decision_id,revision,snapshot) VALUES(?,?,?)',key,source.revision,source.snapshot)],command,key)
 return{id:key,...result,sourceRevision:source.revision,notice:result.state==='held'?'Held: '+result.gaps.join('; '):result.notice}
}
