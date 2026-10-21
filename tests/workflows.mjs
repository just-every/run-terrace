// OPS-003: persistent workflow templates through the public command and read doors. Renewal and unit-turn workflows run
// across worker restarts: an uncertain contact result pauses, a spent contact limit and a reply that needs judgment
// escalate to a named person, a changed authority pauses, and a run completes only on recorded evidence.
import assert from 'node:assert/strict'
import {installation,tenancyInput} from './api/harness.mjs'

const zone='America/Los_Angeles',day=()=>new Intl.DateTimeFormat('en-CA',{timeZone:zone}).format(new Date())
const add=(d,n)=>new Date(Date.parse(d+'T00:00:00Z')+n*86400000).toISOString().slice(0,10)

/** inspect({h,enquiryId,pausedId}) lets the native browser journey drive the same installation once its runs are in every state. */
export async function journey({assets=false,inspect}={}) {
 const h=await installation({assets})
 try {
  const today=day()
  const north=await h.command('portfolio.add',{name:'North homes'}),west=await h.command('portfolio.add',{name:'West homes'})
  const elm=await h.command('property.add',{portfolioId:north.id,name:'Elm Court',address:'5 Elm Court, Oakland, CA',kind:'multifamily',timeZone:zone})
  const bay=await h.command('property.add',{portfolioId:west.id,name:'Bay Court',address:'9 Bay Court, Oakland, CA',kind:'multifamily',timeZone:zone})
  const unit=(property,identifier)=>h.command('unit.add',{propertyId:property.id,identifier,bedrooms:2,bathrooms:1})
  const lease=async(property,identifier,tenantName,end)=>{const u=await unit(property,identifier);return h.command('tenancy.create',{...tenancyInput,unitId:u.id,tenantName,tenantEmail:identifier.toLowerCase()+'@example.test',startDate:add(end,-364),endDate:end,rent:'1500',cadence:'monthly'})}
  const ends=add(today,20),far=add(today,200)
  const a=await lease(elm,'A1','Ana Ruiz',ends),b=await lease(elm,'B1','Ben Ode',ends),c=await lease(elm,'C1','Cy Park',ends),d=await lease(elm,'D1','Dee Long',far),e=await lease(elm,'E1','Eli Roe',far)
  await h.command('renewal.schedule',{from:today,to:add(today,40)})
  const renewal=async t=>(await h.state(t.id)).renewals[0].id
  const [ra,rb,rc]=[await renewal(a),await renewal(b),await renewal(c)]
  const owed=await h.command('rent.charge',{tenancyId:d.id,dueDate:add(today,-35),amount:'600.00',description:'Unpaid rent D',reference:'WF-D-35'})
  await h.command('rent.charge',{tenancyId:e.id,dueDate:add(today,-5),amount:'100.00',description:'Unpaid rent E',reference:'WF-E-5'})
  const vacant=await unit(elm,'V1'),westVacant=await unit(bay,'W1')
  await h.command('turnover.open',{unitId:vacant.id,moveOut:add(today,-2)});await h.command('turnover.open',{unitId:westVacant.id,moveOut:add(today,-2)})
  const boards=(await h.state()).turnovers,board=boards.find(x=>x.unit_id===vacant.id),westBoard=boards.find(x=>x.unit_id===westVacant.id)

  // People: a manager, a leasing person over every portfolio, an accountant, a leasing person over North only and a plain member.
  const manager=await h.invite('admin','wf-manager@example.test'),lead=await h.invite('member','wf-leasing@example.test'),books=await h.invite('member','wf-accountant@example.test'),scoped=await h.invite('member','wf-north@example.test'),plain=await h.invite('member','wf-plain@example.test')
  for(const as of [manager,plain])assert.equal((await h.request('/api/state',{as})).status,200,'a first sign-in gives the default role its row')
  const people=await(await h.request('/auth/operators')).json(),who=email=>people.find(x=>x.email===email).id
  await h.stepUp()
  await h.command('operator.role',{operatorId:who('wf-leasing@example.test'),role:'leasing',allPortfolios:'1'})
  await h.command('operator.role',{operatorId:who('wf-accountant@example.test'),role:'accountant',allPortfolios:'1'})
  await h.command('operator.role',{operatorId:who('wf-north@example.test'),role:'leasing',['portfolio:'+north.id]:'1'})
  const [leadId,mgrId,booksId]=[who('wf-leasing@example.test'),who('wf-manager@example.test'),who('wf-accountant@example.test')]

  // Configuring templates: owner and all-portfolio managers only; kinds, triggers, steps, assignees, due days and escalation are validated.
  const renewalSteps=`contact | Offer the renewal and get a reply | 3 | ${leadId}\ngate | Signed renewal recorded and activated | 30 | ${leadId}`
  const base={name:'Renewal outreach',kind:'renewal',daysBeforeLeaseEnd:30,contactLimit:2,escalateTo:mgrId,reference:'Renewal playbook',steps:renewalSteps}
  for(const as of [lead,plain,scoped])await h.command('workflow.template',base,{as,status:403})
  assert.equal((await h.command('workflow.template',{...base,kind:'eviction'},{status:400})).error,'workflow_kind')
  assert.equal((await h.command('workflow.template',{...base,contactLimit:''},{status:400})).error,'workflow_limit')
  assert.equal((await h.command('workflow.template',{...base,contactLimit:11},{status:400})).error,'invalid_input')
  assert.equal((await h.command('workflow.template',{...base,steps:`task | Do it | 1 | ${booksId}`},{status:409})).error,'not_eligible','an accountant works no renewal')
  assert.equal((await h.command('workflow.template',{...base,escalateTo:leadId},{status:409})).error,'not_eligible','only an owner or manager takes an escalation')
  assert.equal((await h.command('workflow.template',{...base,steps:'task | Late | 500'},{status:400})).error,'invalid_input')
  const renewalTpl=await h.command('workflow.template',base),stepAssignee=leadId
  const turnTpl=await h.command('workflow.template',{name:'Unit turn follow-through',kind:'unit_turn',escalateTo:mgrId,reference:'Turn playbook',steps:[{kind:'task',title:'Inspect and photograph the unit',dueDays:1,assignee:leadId},{kind:'gate',title:'Make-ready board published as ready',dueDays:14}]},{as:manager})
  await h.command('workflow.template',{name:'Rent reminder',kind:'rent',minDaysPastDue:3,escalateTo:mgrId,reference:'Rent playbook',steps:'task | Send a reminder and record it | 2'})
  const delinquencyTpl=await h.command('workflow.template',{name:'Delinquency follow-up',kind:'delinquency',minDaysPastDue:31,minOverdue:'100',escalateTo:mgrId,contactLimit:3,reference:'Collections playbook',steps:'contact | Call about the unpaid rent | 2\ntask | Agree and record a plan | 7'})
  const leasingTpl=await h.command('workflow.template',{name:'Stale enquiries',kind:'leasing',staleDays:7,escalateTo:mgrId,contactLimit:2,propertyId:elm.id,reference:'Leasing playbook',steps:'contact | Follow up the enquiry | 1'})
  assert.equal((await h.command('workflow.template',{templateKey:leasingTpl.templateKey,version:7,...base,kind:'leasing',staleDays:7,steps:'contact | Follow up | 1'},{status:409})).error,'conflict')
  const edited=await h.command('workflow.template',{templateKey:leasingTpl.templateKey,version:1,name:'Stale enquiries',kind:'leasing',staleDays:14,escalateTo:mgrId,contactLimit:2,reference:'Slower cadence',steps:'contact | Follow up the enquiry | 2'})
  assert.equal(edited.version,2)
  const catalog=async as=>(await(await h.request('/api/workflows',as?{as}:{})).json())
  assert.deepEqual((await catalog()).templates.find(t=>t.template_key===leasingTpl.templateKey).trigger,{staleDays:14},'the latest version is the active one')

  // Starting: a trigger must match, authority is checked for the kind, and one live run per record.
  assert.equal((await h.command('workflow.start',{templateKey:renewalTpl.templateKey,subjectId:ra,reference:'x'},{as:plain,status:403})).error,'forbidden')
  assert.equal((await h.command('workflow.start',{templateKey:leasingTpl.templateKey,subjectId:ra,reference:'x'},{as:lead,status:409})).error,'trigger_not_met')
  assert.equal((await h.command('workflow.start',{templateKey:renewalTpl.templateKey,subjectId:ra,reference:'x'},{as:books,status:403})).error,'forbidden')
  const startedA=await h.command('workflow.start',{templateKey:renewalTpl.templateKey,subjectId:ra,reference:'Lease ends in 20 days'},{as:lead})
  assert.match(startedA.nextAction,/attempt 1 of 2/)
  assert.equal((await h.command('workflow.start',{templateKey:renewalTpl.templateKey,subjectId:ra,reference:'again'},{as:lead,status:409})).error,'workflow_running')
  const swept=await h.command('workflow.sweep',{})
  assert.equal(swept.started.length,6,'renewals B and C, both unit turns, the rent reminder and the delinquency run')
  assert.equal((await h.command('workflow.sweep',{})).started.length,0,'a second sweep starts nothing twice')
  const runs=async as=>(await catalog(as)).runs,runFor=async(subject,as)=>(await runs(as)).find(r=>r.subject_id===subject)
  const [A,B,C]=[await runFor(ra),await runFor(rb),await runFor(rc)]
  assert.deepEqual([A.template_version,A.state,A.contacts,A.step_index],[1,'running',0,0])

  // B: an uncertain result pauses across a restart; reconciliation and a second silent attempt exhaust the limit and escalate.
  const attempt=(run,fields,as,status)=>h.command('workflow.attempt',{runId:run.id,version:run.version,channel:'email',reference:'msg-synthetic-terrace-1',...fields},{as,status})
  const first=await attempt(B,{outcome:'uncertain'},lead)
  assert.equal(first.state,'paused');assert.match(first.nextAction,/reconcile contact attempt 1/)
  await h.restart()
  let nowB=await runFor(rb);assert.deepEqual([nowB.state,nowB.pause_reason,nowB.contacts],['paused','uncertain_result',1],'the pause survives a restart')
  assert.equal((await attempt(nowB,{outcome:'reached'},lead,409)).error,'workflow_paused')
  await h.command('workflow.resume',{runId:nowB.id,version:nowB.version,reference:'Provider log shows no delivery'},{as:manager,status:400})
  await h.command('workflow.resume',{runId:nowB.id,version:nowB.version,resolution:'not_delivered',reference:'Provider log shows no delivery'},{as:lead,status:403})
  await h.command('workflow.resume',{runId:nowB.id,version:nowB.version,resolution:'not_delivered',reference:'Provider log shows no delivery'},{as:manager})
  nowB=await runFor(rb);assert.deepEqual([nowB.state,nowB.contacts],['running',1]);assert.match(nowB.next_action,/attempt 2 of 2/)
  const spent=await attempt(nowB,{outcome:'no_answer',channel:'phone',reference:'call-note-synthetic-terrace-2'},lead)
  assert.equal(spent.state,'escalated')
  await h.restart()
  nowB=await runFor(rb)
  assert.deepEqual([nowB.state,nowB.escalation_reason,nowB.escalated_to,nowB.ended_at],['escalated','contact_limit',mgrId,null],'a spent limit is a human escalation, not a completed run')
  assert.match(nowB.next_action,/Escalated because the contact limit is used up/)
  assert.deepEqual(nowB.events.map(x=>x.kind),['started','attempt','paused','reconciled','resumed','attempt','escalated'])
  assert.deepEqual(nowB.events.map(x=>x.sequence),[1,2,3,4,5,6,7])
  assert.equal((await attempt(nowB,{outcome:'reached'},lead,409)).error,'workflow_escalated','no further contact is recorded or allowed')
  assert.equal((await h.command('workflow.step',{runId:nowB.id,version:nowB.version,reference:'x'},{as:lead,status:409})).error,'workflow_escalated')
  const page=await(await h.request('/app?tab=workflows',{as:manager})).text()
  for(const shown of ['Needs a person','Escalated to wf-manager','the contact limit is used up','Close this escalation'])assert.ok(page.includes(shown)||page.includes(shown.replace('wf-manager','admin person')),'shown: '+shown)
  assert.equal((await h.command('workflow.resolve',{runId:nowB.id,version:nowB.version,reference:'Called the household in person'},{as:lead,status:403})).error,'forbidden')
  await h.command('workflow.resolve',{runId:nowB.id,version:nowB.version,reference:'Visited the household and agreed to talk next week'},{as:manager})
  nowB=await runFor(rb);assert.deepEqual([nowB.state,nowB.next_action===null,nowB.events.some(x=>x.kind==='completed')],['closed',true,false],'a person closed it; it never completed')

  // C: a reply that needs judgment escalates; a person's cancellation is not completion either.
  let nowC=await runFor(rc)
  await attempt(nowC,{outcome:'reached'},lead);await h.restart()
  nowC=await runFor(rc);assert.deepEqual([nowC.state,nowC.awaiting],['running',1]);assert.match(nowC.next_action,/Awaiting a reply/)
  const reply=(run,fields,as,status)=>h.command('workflow.reply',{runId:run.id,version:run.version,on:today,reference:'Email thread synthetic-terrace-3',...fields},{as,status})
  assert.equal((await reply(nowC,{outcome:'maybe'},lead,400)).error,'invalid_input')
  assert.equal((await reply(nowC,{outcome:'agreed',on:add(today,1)},lead,400)).error,'invalid_date')
  await reply(nowC,{outcome:'unclear',note:'Asked to talk to the owner first'},lead)
  nowC=await runFor(rc);assert.deepEqual([nowC.state,nowC.escalation_reason],['escalated','reply_needs_review'])
  await h.command('workflow.cancel',{runId:nowC.id,version:nowC.version,reason:'Owner took over'},{as:manager})
  assert.equal((await runFor(rc)).state,'cancelled')

  // Unit turn: the task needs evidence, the gate stays shut until the board is published, and only then does the run complete.
  let T=await runFor(board.id)
  assert.equal((await h.command('workflow.step',{runId:T.id,version:T.version},{as:lead,status:400})).error,'invalid_input','completion evidence is required')
  await h.command('workflow.step',{runId:T.id,version:T.version,reference:'Inspection IMG-synthetic-terrace-4'},{as:plain,status:403})
  await h.command('workflow.step',{runId:T.id,version:T.version,reference:'Inspection IMG-synthetic-terrace-4'},{as:lead})
  await h.restart()
  T=await runFor(board.id);assert.deepEqual([T.state,T.step_index],['running',1]);assert.match(T.next_action,/Waiting until the make-ready board is published as ready/)
  assert.equal((await h.command('workflow.step',{runId:T.id,version:T.version,reference:'Board looks done'},{as:lead,status:409})).error,'gate_open','the gate cannot be satisfied by assertion')
  const ready=(await h.state()).turnovers.find(x=>x.id===board.id)
  for(const task of ready.tasks){await h.command('turnover.task.submit',{taskId:task.id});await h.command('turnover.task.check',{taskId:task.id})}
  await h.command('turnover.publish',{turnoverId:board.id})
  T=await runFor(board.id)
  const done=await h.command('workflow.step',{runId:T.id,version:T.version,reference:'Board published'},{as:lead})
  assert.equal(done.state,'completed')
  T=await runFor(board.id);assert.ok(T.ended_at&&T.next_action===null)
  assert.deepEqual(T.events.find(x=>x.kind==='completed').detail.evidence.map(x=>[x.title,x.reference]),[['Inspect and photograph the unit','Inspection IMG-synthetic-terrace-4'],['Make-ready board published as ready','Board published']])
  assert.equal((await h.command('workflow.step',{runId:T.id,version:T.version,reference:'again'},{as:lead,status:409})).error,'workflow_closed')

  // Rent and delinquency on the same records: an overdue step escalates on a sweep; a record that resolved itself pauses the run.
  const db=await h.mf.getD1Database('DB'),rent=await runFor(e.id),late=await runFor(d.id)
  assert.equal(rent.template_name,'Rent reminder');assert.equal(late.template_name,'Delinquency follow-up')
  await db.prepare('UPDATE tt_workflow_runs SET step_due_on=? WHERE id=?').bind(add(today,-1),rent.id).run()
  const lead7=await h.command('prospect.add',{propertyId:elm.id,name:'Pat Quill',email:'pat@example.test',source:'own_site',reference:'Listing enquiry synthetic-terrace-7',consent_email:'refused',consent_phone:'granted',consent_text:'unknown'})
  await db.prepare('UPDATE tt_prospects SET last_activity_at=? WHERE id=?').bind(new Date(Date.now()-20*86400000).toISOString(),lead7.id).run()
  const overdue=await h.command('workflow.sweep',{});assert.deepEqual(overdue.escalated,[rent.id]);assert.equal(overdue.started.length,1,'a 20-day-old enquiry meets the 14-day trigger')
  const enquiry=await runFor(lead7.id);assert.equal(enquiry.template_version,2,'a run starts under the latest template version')
  assert.equal((await attempt(enquiry,{outcome:'reached'},lead,409)).error,'consent_refused','a refused channel is never recorded as contacted')
  assert.equal((await attempt(enquiry,{outcome:'reached',channel:'phone'},lead)).state,'running')
  assert.deepEqual([(await runFor(e.id)).state,(await runFor(e.id)).escalation_reason],['escalated','overdue'])
  await h.command('rent.receipt',{chargeId:owed.id,amount:'600.00',receivedDate:today,reference:'ACH-synthetic-terrace-5'})
  assert.equal((await attempt(late,{outcome:'reached',channel:'phone',reference:'call-note-synthetic-terrace-6'},manager,409)).error,'workflow_paused')
  const paused=await runFor(d.id);assert.deepEqual([paused.state,paused.pause_reason,paused.contacts],['paused','subject_resolved',0],'nothing was recorded against a settled balance')
  await h.command('workflow.resume',{runId:paused.id,version:paused.version,reference:'Still settled'},{as:manager,status:409})

  // Stale authority: the person who started a run loses their role. The next action on it pauses it instead of proceeding.
  let A2=await runFor(ra)
  await attempt(A2,{outcome:'reached'},lead);await h.restart()
  A2=await runFor(ra);await reply(A2,{outcome:'agreed'},lead)
  A2=await runFor(ra);assert.deepEqual([A2.state,A2.step_index],['running',1],'an agreed reply moves to the gate, not to completion')
  assert.equal((await h.command('workflow.step',{runId:A2.id,version:A2.version,reference:'Renewal signed'},{as:lead,status:409})).error,'gate_open')
  await h.command('operator.role',{operatorId:leadId,role:'member'})
  assert.equal((await h.command('workflow.step',{runId:A2.id,version:A2.version,reference:'Renewal signed'},{as:manager,status:409})).error,'workflow_paused')
  await h.restart()
  A2=await runFor(ra);assert.deepEqual([A2.state,A2.pause_reason],['paused','authority_changed'])
  assert.match(A2.next_action,/^Paused because .*no longer holds the authority/)
  assert.equal((await h.command('workflow.resume',{runId:A2.id,version:A2.version,reference:'Reviewed the renewal'},{as:manager,status:409})).error,'still_stale','its assignee can no longer work it either')
  await h.command('workflow.resume',{runId:A2.id,version:A2.version,assignee:mgrId,reference:'Reviewed; the manager takes it'},{as:manager})
  A2=await runFor(ra);assert.deepEqual([A2.state,A2.assignee,A2.authority_operator],['running',mgrId,mgrId])

  // Scope: a leasing person over North sees North runs only; the West unit turn is a 404 to them and listed to the owner.
  const westRun=await runFor(westBoard.id)
  assert.ok(westRun)
  assert.equal((await runs(scoped)).some(r=>r.id===westRun.id),false);assert.ok((await runs(scoped)).some(r=>r.id===A2.id))
  assert.equal((await h.command('workflow.step',{runId:westRun.id,version:westRun.version,reference:'x'},{as:scoped,status:404})).error,'not_found')

  await inspect?.({h,enquiryId:enquiry.id,pausedId:paused.id})

  // Retiring a template stops new starts and keeps its runs.
  await h.command('workflow.retire',{templateKey:turnTpl.templateKey,version:1,reason:'Replaced'},{as:manager})
  assert.equal((await h.command('workflow.start',{templateKey:turnTpl.templateKey,subjectId:westBoard.id,reference:'x'},{status:409})).error,'template_retired')
  assert.ok(await runFor(westBoard.id))

  // Export and restore: runs, durable next actions and sequenced events survive a fresh restore.
  const finalRuns=await runs(),backup=await(await h.request('/api/backup')).text(),fresh=await installation()
  try {
   await fresh.formCommand('data.restore',{confirm:'RESTORE',backup:new File([backup],'workflows.rer')})
   const restored=(await(await fresh.request('/api/workflows')).json()).runs
   const shape=r=>[r.id,r.state,r.next_action,r.contacts,r.pause_reason,r.escalation_reason,r.events.map(x=>[x.sequence,x.kind,x.reference])]
   assert.deepEqual(restored.map(shape),finalRuns.map(shape))
  } finally {await fresh.close()}
  void delinquencyTpl;void stepAssignee
 } finally {await h.close()}
}
