import assert from 'node:assert/strict'
import {generateKeyPairSync,sign} from 'node:crypto'
import {installation,tenancyInput} from './api/harness.mjs'
import {syntheticPack} from './rule-packs.mjs'
const address=n=>['synthetic-terrace-'+n,'example.test'].join('@')
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a7xkAAAAASUVORK5CYII=','base64')
export async function journey({assets=false,inspect}={}){
 const signing=generateKeyPairSync('ec',{namedCurve:'prime256v1'}),mailWebhookKey=signing.publicKey.export({type:'spki',format:'der'}).toString('base64')
 const h=await installation({assets,mailProvider:'sendgrid',mailWebhookKey,now:'2026-10-20T12:00:00.000Z'})
 try{
  const portfolio=await h.command('portfolio.add',{name:'Collection portfolio'}),p=await h.command('property.add',{portfolioId:portfolio.id,name:'Synthetic collection house',address:'1 Synthetic Terrace Road',kind:'multifamily',timeZone:'America/New_York'})
  await h.command('property.rules',{propertyId:p.id,stateCode:'CA',version:0,reference:'synthetic-terrace-200'})
  const pack=syntheticPack('CA');for(const field of ['payOrQuit','leaseViolation'])pack.fields[field].value={days:3,methods:['posted','first_class_mail'],mailingExtensionDays:5,turnoverDays:20}
  const rules=await h.command('rules.pack',pack);await h.command('rules.activate',{packId:rules.id,consent:'REVIEWED'})
  const cases=[]
  const read=async t=>{const r=await h.request('/api/arrears?tenancyId='+t.id);assert.equal(r.status,200,await r.clone().text());return r.json()}
  const config=async(t,hold='none',consent='granted',limit=7)=>{const s=await read(t);return h.command('arrears.contact',{tenancyId:t.id,version:s.config?.version??0,hold,emailConsent:consent,contactLimit:limit,reference:'synthetic-terrace-201 resident requested collection contact'})}
  const draft=async(t,kind='reminder',extra={})=>h.command('arrears.draft',{tenancyId:t.id,kind,dueOn:'2026-10-20',body:'Please review the recorded rent and reply with your proposed next step.',...extra})
  const approve=async(t,a,opts={})=>h.command('arrears.approve',{tenancyId:t.id,actionId:a.id,version:(await read(t)).actions.find(x=>x.id===a.id).version,consent:'APPROVE EXACT ACTION',reference:'synthetic-terrace-202 exact human review'},opts)
  const send=async(t,a,opts={})=>h.command('arrears.send',{tenancyId:t.id,actionId:a.id,version:(await read(t)).actions.find(x=>x.id===a.id).version,consent:'SEND EXACT ACTION'},opts)
  const plan=async(t,installments)=>{const r=await h.command('arrears.plan',{tenancyId:t.id,installments,reference:'synthetic-terrace-203 sourced resident agreement'});await h.command('arrears.plan-approve',{tenancyId:t.id,planId:r.id,consent:'APPROVE EXACT PLAN',reference:'synthetic-terrace-204 exact terms reviewed'});return r}
  const notify=async(t,a,{recipient,type='delivered',valid=true,key='synthetic-terrace-'+Math.random()}={})=>{
   const action=(await read(t)).actions.find(x=>x.id===a.id),timestamp=String(Math.floor(Date.now()/1000))
   const raw=JSON.stringify([{email:recipient??action.snapshot.recipient,event:type,sg_message_id:action.provider_id,sg_event_id:key,timestamp:Date.parse('2026-10-20T12:00:00Z')/1000}])
   const signature=sign('sha256',Buffer.from(timestamp+raw),signing.privateKey).toString('base64')
   const r=await h.request('/api/arrears-mail/events',{method:'POST',as:'',body:JSON.parse(raw),headers:{'x-twilio-email-event-webhook-timestamp':timestamp,'x-twilio-email-event-webhook-signature':valid?signature:'invalid'}})
   return r
  }
  for(let i=0;i<3;i++){
   const u=await h.command('unit.add',{propertyId:p.id,identifier:String(i+1),bedrooms:2,bathrooms:1}),t=await h.command('tenancy.create',{...tenancyInput,unitId:u.id,tenantName:'Synthetic household '+i,tenantEmail:address(210+i),cadence:'monthly',rent:'1000',endDate:'2027-12-31'})
   const q=await h.command('rent.charge',{tenancyId:t.id,dueDate:'2026-10-01',amount:'1000',description:'October rent',reference:'synthetic-terrace-'+(220+i)})
   await draft(t,'reminder',{dueOn:'2026-10-20'}).then(()=>assert.fail('consent must be required'),e=>assert.match(e.message,/current email consent/))
   await config(t)
   const reminder=await draft(t)
   const before=h.messages.length;await send(t,reminder,{status:409});assert.equal(h.messages.length,before,'no message before exact human approval')
   await approve(t,reminder);await send(t,reminder);assert.equal(h.messages.length,before+1,'human send reaches the configured provider once')
   await send(t,reminder,{status:409});assert.equal(h.messages.length,before+1,'replay never sends twice')
   assert.equal((await notify(t,reminder,{valid:false})).status,400)
   assert.equal((await notify(t,reminder,{recipient:address(299)})).status,400)
   const key='synthetic-terrace-'+(230+i);assert.equal((await notify(t,reminder,{key})).status,200)
   assert.equal((await notify(t,reminder,{key})).status,200,'provider replay is harmless')
   assert.equal((await read(t)).actions.find(a=>a.id===reminder.id).state,'delivered','verified delivery remains distinct from provider acceptance')
   cases.push({t,q,reminder})
  }
  const [plausible,missed,settled]=cases
  await h.command('arrears.reply',{tenancyId:plausible.t.id,on:'2026-10-20',body:'I can pay in two installments. Please send me the proposed plan.',reference:'synthetic-terrace-240 sourced telephone reply'})
  await plan(missed.t,[{on:'2026-10-21',cents:100000}])
  const obsolete=await draft(settled.t);await approve(settled.t,obsolete)
  const beforePayment=h.messages.length;await h.command('rent.receipt',{chargeId:settled.q.id,amount:'1000',receivedDate:'2026-10-20',method:'ach',reference:'synthetic-terrace-241 externally received'})
  assert.equal((await read(settled.t)).balance.balanceCents,0);assert.equal((await read(settled.t)).actions.find(a=>a.id===obsolete.id).state,'stopped')
  await send(settled.t,obsolete,{status:409});assert.equal(h.messages.length,beforePayment,'payment stops obsolete contact')
  await h.setTime('2026-10-23T12:00:00.000Z')
  assert.equal((await read(missed.t)).plan.state,'broken');assert.match((await read(missed.t)).nextAction,/Broken promise/)
  const assumptions={on:'2026-10-23',vacantDays:30,makeReadyCents:0,leasingCents:0,waitingDays:7,noticeRecoveryBp:9500,source:'synthetic-terrace-242 dated vacancy, costs and collection recovery assumptions',installments:[{on:'2026-10-24',cents:50000},{on:'2026-10-26',cents:50000}]}
  const good=await h.command('arrears.compare',{tenancyId:plausible.t.id,...assumptions})
  assert.equal(good.comparison.recommended,'plan');assert.equal(good.comparison.rentAtRiskCents,100000)
  assert.equal(good.comparison.options.find(o=>o.kind==='plan').cashByDate.length,2)
  assert.equal(good.comparison.options.find(o=>o.kind==='pay_or_quit_notice').turnoverDays,23)
  assert.equal(good.assumptions.rules[0].packId,rules.id);assert.equal(good.assumptions.on,'2026-10-23');assert.match(good.comparison.confidence,/low/)
  const before=await h.command('arrears.compare',{tenancyId:missed.t.id,...assumptions})
  const bad=await h.command('arrears.compare',{tenancyId:missed.t.id,...assumptions,vacantDays:0})
  assert.equal(before.comparison.recommended,'plan');assert.equal(bad.comparison.recommended,'pay_or_quit_notice','changing vacancy recalculates the preferred action')
  assert.ok(bad.comparison.probabilityBp<good.comparison.probabilityBp,'missed plan changes the history weight')
  assert.equal(bad.comparison.options.find(o=>o.kind==='pay_or_quit_notice').lossCents,5000)
  await plan(plausible.t,assumptions.installments)
  const goodDraft=await draft(plausible.t,'plan',{dueOn:'2026-10-23',forecastId:good.id}),badDraft=await draft(missed.t,'pay_or_quit_notice',{dueOn:'2026-10-23',forecastId:bad.id})
  const beforeDrafts=h.messages.length
  await send(plausible.t,goodDraft,{status:409});await send(missed.t,badDraft,{status:409});assert.equal(h.messages.length,beforeDrafts)
  await approve(plausible.t,goodDraft);await approve(missed.t,badDraft)
  await send(plausible.t,goodDraft);await send(missed.t,badDraft);assert.equal(h.messages.length,beforeDrafts+2)
  assert.match(h.messages.at(-2).text,/2026-10-24: 50000 USD cents/,'delivery includes the exact approved installment terms')
  const notice=(await read(missed.t)).actions.find(a=>a.id===badDraft.id)
  const service={tenancyId:missed.t.id,actionId:badDraft.id,version:notice.version,servedAt:'2026-10-23T12:00:00Z',method:'posted',server:'Synthetic service person',reference:'synthetic-terrace-243 posting evidence',photo:new File([png],'service.png',{type:'image/png'}),consent:'RECORD SERVICE'}
  await h.formCommand('arrears.service',{...service,method:'unsupported'},{status:409})
  await h.formCommand('arrears.service',service)
  const served=(await read(missed.t)).actions.find(a=>a.id===badDraft.id).service
  assert.equal(served.expires_on,'2026-10-26','notice expiry starts at physical service, never draft or print time')
  assert.equal(served.server,'Synthetic service person');assert.equal(served.served_at,'2026-10-23T12:00:00Z')
  assert.deepEqual(Buffer.from(await(await h.request('/api/arrears-photo?tenancyId='+missed.t.id+'&actionId='+badDraft.id)).arrayBuffer()),png)
  assert.equal((await read(missed.t)).actions.find(a=>a.id===badDraft.id).state,'served')
  await h.command('rent.receipt',{chargeId:plausible.q.id,amount:'500',receivedDate:'2026-10-23',reference:'synthetic-terrace-244 first plan receipt'})
  const report=await(await h.request('/api/delinquency?asOf=2026-10-23')).json()
  assert.equal(report.rows.find(r=>r.tenancyId===plausible.t.id).paymentPlan,'active')
  assert.equal(report.rows.find(r=>r.tenancyId===missed.t.id).paymentPlan,'broken')
  assert.equal(report.rows.find(r=>r.tenancyId===missed.t.id).notices[0].service.expires_on,'2026-10-26')
  assert.match(report.rows.find(r=>r.tenancyId===settled.t.id).collectionOutcome,/cleared/)
  const csv=await(await h.request('/api/delinquency?asOf=2026-10-23&format=csv')).text();assert.ok(csv.includes('synthetic-terrace-243 posting evidence'));assert.ok(csv.includes('2026-10-26'))
  const past=await(await h.request('/api/delinquency?asOf=2026-10-20')).json();assert.equal(past.rows.find(r=>r.tenancyId===missed.t.id).notices.length,0,'later notices do not rewrite the earlier report')
  await h.command('arrears.outcome',{tenancyId:plausible.t.id,forecastId:good.id,on:'2026-10-23',vacantDays:0,reference:'synthetic-terrace-245 unit remained occupied'})
  const actual=(await read(plausible.t)).forecasts.find(f=>f.id===good.id).actual;assert.equal(actual.cashCents,50000);assert.equal(actual.vacancy.vacantDays,0)
  // Holds and current authority are checked again at execution, rather than trusting an old approval.
  await config(missed.t,'dispute');const heldMessages=h.messages.length;await draft(missed.t,'reminder',{dueOn:'2026-10-23'}).then(()=>assert.fail('dispute must pause'),e=>assert.match(e.message,/dispute/));assert.equal(h.messages.length,heldMessages)
  const paused=await h.command('arrears.compare',{tenancyId:missed.t.id,...assumptions,vacantDays:0});assert.match(paused.comparison.paused.join(' '),/dispute/)
  await config(missed.t,'accommodation');assert.match((await read(missed.t)).nextAction,/accommodation/)
  await config(missed.t,'none','granted',0);assert.match((await read(missed.t)).nextAction,/contact allowance/)
  await config(missed.t)
  const stale=await draft(missed.t,'pay_or_quit_notice',{dueOn:'2026-10-23'});await approve(missed.t,stale);await config(missed.t,'manual')
  await send(missed.t,stale,{status:409});assert.equal(h.messages.length,heldMessages)
  await h.stepUp()
  const staff=[]
  for(const [n,role]of [[260,'portfolio_manager'],[261,'leasing']]){await h.command('operator.invite',{email:address(n),displayName:role,role,['portfolio:'+portfolio.id]:'1'});staff.push(await h.accept(address(n)))}
  const outsider=await h.command('portfolio.add',{name:'Outside collection scope'}),p2=await h.command('property.add',{portfolioId:outsider.id,name:'Outside house',address:'2 Synthetic Road',kind:'duplex',timeZone:'America/New_York'}),u2=await h.command('unit.add',{propertyId:p2.id,identifier:'A',bedrooms:1,bathrooms:1}),outside=await h.command('tenancy.create',{...tenancyInput,unitId:u2.id,tenantEmail:address(262)})
  assert.equal((await h.request('/api/arrears?tenancyId='+outside.id,{as:staff[0]})).status,404)
  await h.command('arrears.draft',{tenancyId:outside.id,kind:'reminder',dueOn:'2026-10-23',body:'No exposure'},{as:staff[0],status:404})
  await h.command('arrears.approve',{tenancyId:plausible.t.id,actionId:goodDraft.id,version:1},{as:staff[1],status:403})
  assert.equal((await h.request('/api/arrears?tenancyId='+missed.t.id,{as:''})).status,401)
  if(inspect)await inspect({h,cases,good,bad,goodDraft,badDraft,config,plan,assumptions})
  const archive=await(await h.request('/api/backup')).text(),fresh=await installation({now:'2026-10-23T12:00:00Z'})
  try{await fresh.formCommand('data.restore',{backup:new File([archive],'collection.rer'),confirm:'RESTORE'});const restored=await(await fresh.request('/api/arrears?tenancyId='+missed.t.id)).json();assert.equal(restored.actions.find(a=>a.id===badDraft.id).service.expires_on,'2026-10-26');await fresh.command('arrears.send',{tenancyId:missed.t.id,actionId:stale.id,version:restored.actions.find(a=>a.id===stale.id).version,consent:'SEND EXACT ACTION'},{status:409});assert.equal(fresh.messages.length,0,'portable evidence cannot restore execution authority')}finally{await fresh.close()}
  await h.restart();assert.equal((await read(plausible.t)).forecasts.find(f=>f.id===good.id).actual.cashCents,50000)
 }finally{await h.close()}
}
