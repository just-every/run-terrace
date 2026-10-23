import {financialView} from './financial-view'
import {FINANCIAL_COMMANDS,financialCommand,financialData} from './financial-actions'
import {LATE_FEE_COMMANDS,lateFeeCommand,lateFeeData} from './late-fees'
import {lateFeeView} from './late-fee-view'
import {paymentView} from './payment-view'
import {PAYMENT_COMMANDS,paymentCommand,paymentData} from './payments'
import {PORTAL_COMMANDS,portalCommand,portalData,sendPortalEmail} from './portal'
import {portalResponse} from './portal-http'
import {portalSection} from './portal-view-staff'
import {DOCUMENT_COMMANDS,documentCommand,documentDownload,documentSearch,documentVersions,enterDocuments} from './documents'
import {documentView} from './document-view'
import {TRUST_COMMANDS,trustCommand,trustData} from './trust'
import {trustView} from './trust-view'
import {RULE_COMMANDS,ruleCommand,ruleData} from './rule-packs'
import {ruleView} from './rule-view'
import {JOURNAL_COMMANDS,journalCommand,journalData} from './journal'
import {journalView} from './journal-view'
import { moveChecklistCommand, moveChecklistData } from './move-checklists'
import { moveChecklistSection } from './move-checklist-view'
import { DISPATCH_COMMANDS, dispatchCommand } from './dispatch'
import { sendDispatch } from './dispatch-mail'
import { operatorAuth,type Bindings } from '../auth.server'
import { all, allow, audit, can, Fault, insist, recordRead, sha256, tenancy, text, type Context, type Row } from './core'
import { loadStaff } from './roles'
import { FACTOR_COMMANDS,factorCommand,factorState } from './second-factor'
import { securityView } from './security-view'
import { serviceReport,serviceTable } from './service-report'
import { serviceSection } from './service-view'
import { readableExport } from './readable-export'
import { history,historyCsv,historyView } from './history'
import { localDate as today } from './zones'
import { tenancyCommand,tenancyData,proposals } from './tenancies'
import { ledgerCommand,ledgerData,statement,statementCsv } from './ledger'
import { workCommand,workData,operatorNames,photoResponse,workPacket } from './work'
import { importCommand,importData,importView } from './imports'
import { backup,dataCommand } from './data'
import { page } from './view'
import { chooser,tenancyView,emptyView,createTenancy,backToTenancies } from './tenancy-view'
import { homeView,addTenancyAction } from './home-view'
import { monthData } from './month'
import { ledgerView } from './ledger-view'
import { workView } from './work-view'
import { settingsView } from './settings-view'
import { peopleView,peopleCommand } from './people'
import { companyCommand,companyData,officeZone } from './company'
import { assetCommand } from './assets'
import { vendorCommand } from './vendors'
import { scheduleCommand } from './schedules'
import { chargeRunCommand,preview,terms } from './charge-run'
import { runSection,termSection } from './charge-run-view'
import { propertyCommand,propertyData,unitChoices } from './properties'
import { propertiesView } from './property-view'
import { turnoverCommand,turnoverData } from './turnovers'
import { householdCommand,householdData } from './households'
import { quoteCommand } from './quotes'
import { completionCommand } from './completions'
import { householdSection } from './household-view'
import { collections,rentRoll,rentRollTable } from './rent-roll'
import { rentRollSection } from './rent-roll-view'
import { csv,pdf,xlsx } from './exports'
import { companyView } from './company-view'
import { ownerCommand,ownershipData,ownerStatement,ownerStatementTable } from './owners'
import { ownerDirectory,propertyOwners } from './owner-view'
import { closeTable,PERIOD_COMMANDS,periodCommand,periodData } from './periods'
import { feeCommand } from './fees'
import { RECOVERY_COMMANDS,recoveryCommand,recoveryData } from './recoveries'
import { recoverySection } from './recovery-view'
import { taxCommand } from './tax'
import { periodView } from './periods-view'
import { BILL_COMMANDS,billCommand,billData,billAttachment } from './bills'
import { billSection } from './bills-view'
import { LEASE_COMMANDS,leaseCommand,leaseData,leaseSource } from './lease-versions'
import { leaseSection } from './lease-view'
import { scenarioReport } from './scenarios'
import { scenarioSection } from './scenario-view'
import { APPOINTMENT_COMMANDS,appointmentCommand } from './appointments'
import { RETENTION_COMMANDS,retentionCommand,retentionData,residentAccess } from './retention'
import { EMERGENCY_COMMANDS,emergencyCommand,emergencyData } from './emergencies'
import { emergencyView } from './emergency-view'
import { deliverAlert } from './emergency-alert'
import { PROSPECT_COMMANDS,prospectCommand,prospectData } from './prospects'
import { prospectView } from './prospect-view'
import { sendProspectEmail } from './prospect-mail'
import { RENEWAL_COMMANDS,renewalCommand,renewalData } from './renewals'
import { sendRenewalEmails } from './renewal-mail'
import { renewalsView } from './renewal-view'
import { SIBLING_COMMANDS,siblingCommand,siblingData } from './siblings'
import { siblingLinks,siblingOrigins } from './sibling-view'
import { leasingReport } from './leasing-report'
import { leasingSection } from './leasing-view'
import { DELINQUENCY_COMMANDS,delinquencyCommand,delinquencyReport,delinquencyTable } from './delinquency-report'
import { delinquencySection } from './delinquency-view'
import { CUSTOM_COMMANDS,customCommand } from './custom-commands'
import { customCatalog } from './custom-catalog'
import { customReport,customReportTable } from './custom-reports'
import { customDocument } from './custom-documents'
import { customView } from './custom-view'
import { CREDENTIAL_COMMANDS,PREPARE_COMMANDS,abandonIdempotent,beginIdempotent,credentialActor,credentialCommand,credentialData,credentialGate,finishIdempotent,noCredential } from './credentials'
import { credentialSection } from './credentials-view'
import { V1_PATH,apiV1 } from './api-v1'
import { WORKFLOW_COMMANDS,workflowCommand,workflowData } from './workflows'
import { workflowView } from './workflow-view'
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{'cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer'}})
async function render(c:Context,url:URL,notice='',result:Row={},status=200,request?:Request,env?:Bindings) {
 // SAFE-001: a sign-in that still owes its second factor sees only the security page, whatever it asked for.
 const tab=c.gated?'security':url.searchParams.get('tab')??'tenancy',rows=await tenancyData(c),asked=url.searchParams.get('tenancy'),selected=rows.find(t=>t.id===asked)??rows[0],manage=can(c,'tenancy.create'),ledgers=can(c,'ledger.read')
 // ROLE-001: a named tenancy outside the viewer's portfolios (or erased) answers 404, never another tenancy.
 insist(!asked||rows.some(t=>t.id===asked),'not_found','Tenancy not found.',404)
 let body='',title='Tenancies',head={}
 if(tab==='security'){title='Two-step sign-in';body=securityView(await factorState(c),result,c.actor.role==='owner',c.actor.role==='owner'?await all(c,'SELECT o.id,o.display_name FROM tt_totp t JOIN oa_operators o ON o.id=t.operator_id WHERE t.confirmed_at IS NOT NULL AND o.id<>? ORDER BY o.display_name',c.actor.id):[])}
 else if(tab==='rules'){title='State & local rules';body=ruleView(await ruleData(c,url.searchParams.get('propertyId')))}
 else if(tab==='documents'){enterDocuments(c);title='Documents';body=documentView({documents:(await documentSearch(c,Object.fromEntries(url.searchParams))).documents,tenancies:rows},Object.fromEntries(url.searchParams),a=>can(c,a))}
 else if(tab==='trust'){title='Trust accounts';body=trustView(await trustData(c,Object.fromEntries(url.searchParams)));await recordRead(c,'read:trust','custody')}
 else if(tab==='journal'){title='Property ledger';body=journalView(await journalData(c,Object.fromEntries(url.searchParams)))}
 else if(tab==='close'){allow(c,'reports.read');title='Month close';body=periodView(await periodData(c,url.searchParams.get('month')),{signoff:can(c,'period.signoff'),close:can(c,'period.close'),reopen:can(c,'period.reopen'),prepare:can(c,'correction.prepare'),approve:can(c,'correction.approve')},await operatorNames(c),rows)}
 else if(tab==='emergencies'){title='Safety & emergencies';const names=await operatorNames(c);body=emergencyView(await emergencyData(c),c.actor.id,a=>can(c,a)&&(a!=='emergency.guidance'||c.actor.role==='owner'||!!c.actor.staff?.all),id=>names[id]??id)}
 else if(tab==='custom'){title='Custom reports & documents';body=customView(await customCatalog(c),url.searchParams.has('reportId')?await customReport(c,url.searchParams.get('reportId')):undefined)}
 else if(tab==='delinquency'){allow(c,'reports.read');title='Delinquency';const data=await delinquencyReport(c,{...Object.fromEntries(url.searchParams),asOf:url.searchParams.get('asOf')||today(c.now,c.zone!)});body=delinquencySection(data.properties,data.owners,{...Object.fromEntries(url.searchParams),asOf:data.asOf},data,can(c,'delinquency.assign'))}
 else if(tab==='leasing-report'){allow(c,'reports.read');title='Leasing performance';const data=await propertyData(c),day=today(c.now,c.zone!),q={...Object.fromEntries(url.searchParams),from:url.searchParams.get('from')||day.slice(0,8)+'01',to:url.searchParams.get('to')||day};body=leasingSection(data.portfolios.flatMap((f:Row)=>f.properties),q,url.searchParams.has('from')?await leasingReport(c,q):undefined)}
 else if(tab==='renewals'){allow(c,'renewal.prepare');title='Renewals';const data=await propertyData(c);body=renewalsView(await renewalData(c),data.portfolios.flatMap((f:Row)=>f.properties),a=>can(c,a))}
 else if(tab==='workflows'){allow(c,'workflow.read');title='Workflows';const names=await operatorNames(c),data=await propertyData(c);body=workflowView(await workflowData(c),data.portfolios.flatMap((f:Row)=>f.properties),a=>can(c,a),id=>names[id]??id)}
 else if(tab==='prospects'){title='Prospects';const names=await operatorNames(c);body=prospectView(await prospectData(c),a=>can(c,a),id=>names[id]??id)}
 else if(tab==='bills'){title='Vendor bills';body=billSection(await billData(c),a=>can(c,a));await recordRead(c,'bills.read','bills')}
 else if(tab==='history'){title='History';const q=Object.fromEntries(url.searchParams);body=historyView(c,await history(c,q),q)}
 else if(tab==='import'){allow(c,'import.preview');title='Move in';body=importView({...await importData(c),...result})}
 else if(tab==='properties'){title='Properties';const data=await propertyData(c),siblings=await siblingData(c);const owners=await ownershipData(c),recovery:Record<string,Row>=can(c,'ledger.read')?Object.fromEntries(await Promise.all(data.portfolios.flatMap((f:Row)=>f.properties).map(async(p:Row)=>[p.id,await recoveryData(c,p.id)]))):{},keep=can(c,'ownership.set')&&!!owners.directory;body=(can(c,'rules.read')?'<section><h2>State &amp; local rules</h2><p>Versioned counsel review and held rule-dependent previews.</p><a href="/app?tab=rules">Open state &amp; local rules</a></section>':'')+(can(c,'work.read')?'<section><h2>Custom reports &amp; documents</h2><p>Typed fields, saved reports and versioned document templates.</p><a href="/app?tab=custom">Open custom reports &amp; documents</a></section>':'')+(can(c,'reports.read')?'<section><h2>Delinquency</h2><p>Aged household receivables, dated owners and assigned follow-up.</p><a href="/app?tab=delinquency">Open delinquency report</a></section>':'')+(can(c,'reports.read')?'<section><h2>Leasing performance</h2><p>Occupancy, vacancy, lead sources and recorded renewal retention with dated sources.</p><a href="/app?tab=leasing-report">Open leasing report</a></section>':'')+(can(c,'renewal.prepare')?'<section><h2>Renewals</h2><p>Renewal campaigns from lease-end dates: offers with their comparison, sends, replies and the follow-up queue.</p><a href="/app?tab=renewals">Open renewals</a></section>':'')+(can(c,'workflow.read')?'<section><h2>Workflows</h2><p>Persistent leasing, renewal, rent, delinquency and unit-turn workflows: next actions, contact limits and escalations to a person.</p><a href="/app?tab=workflows">Open workflows</a></section>':'')+(can(c,'prospect.read')?'<section><h2>Prospects</h2><p>Leads, duplicate review, assigned leasing staff and stages from enquiry to lease.</p><a href="/app?tab=prospects">Open prospects</a></section>':'')+(can(c,'bills.read')?'<section><h2>Vendor bills</h2><p>Capture invoices, approve payables and run recurring owner expenses.</p><a href="/app?tab=bills">Open vendor bills</a></section>':'')+ownerDirectory(owners.directory,can(c,'owner.add'),can(c,'reports.read'))+propertiesView(data,await unitChoices(c),can(c,'unit.add'),await turnoverData(c),p=>siblingLinks(p,siblings,a=>can(c,a))+propertyOwners(p,owners.byProperty[p.id],owners.directory,keep,can(c,'fees.run'))+(recovery[p.id]?recoverySection(p,recovery[p.id],{authorize:can(c,'recovery.authorize'),prepare:can(c,'utility.prepare'),approve:can(c,'utility.approve'),ancillary:can(c,'ancillary.charge'),taxPrepare:can(c,'tax.prepare'),taxReview:can(c,'tax.review')}):''));if(can(c,'maintenance.report'))body+=serviceSection(data.portfolios.flatMap((f:Row)=>f.properties));if(can(c,'reports.read')){const day=today(c.now,c.zone!);body+=rentRollSection(await rentRoll(c,{asOf:url.searchParams.get('asOf')||day,propertyId:url.searchParams.get('propertyId'),occupancy:url.searchParams.get('occupancy')}),await collections(c,url.searchParams.get('month')||day.slice(0,7)),data.portfolios.flatMap((f:Row)=>f.properties))}}
 else if(tab==='settings'){title='Data & access';body=companyView(await companyData(c),can(c,'company.save')&&(c.actor.role==='owner'||!!c.actor.staff?.all),c.actor.role==='owner')+settingsView(rows,c.actor.role==='owner',await retentionData(c,rows))+siblingOrigins(await siblingData(c),c.actor.role==='owner')+(can(c,'portal.invite')?portalSection(await portalData(c),rows,a=>can(c,a)):'')+credentialSection(await credentialData(c),c.actor.role==='owner',result)+'<section><h2>Two-step sign-in</h2><p>Authenticator codes and recovery codes for each sign-in.</p><p><a href="/app?tab=security">Set up or manage two-step sign-in</a></p></section>'+(can(c,'reports.read')?'<section><h2>Month close</h2><p>Month-end checklist, exceptions, closed months and close corrections.</p><p><a href="/app?tab=close">Open month close</a></p></section>':'')+(can(c,'history.read')?'<section><h2>History</h2><p>Who changed, read or exported what, with their role and source.</p><p><a href="/app?tab=history">Open history</a></p></section>':'');if(can(c,'operator.role')&&request&&env)body+=await peopleView(request,env,c);body=`<div class="settings-layout">${body}</div>`}
 else {
  if(tab==='tenancy') {
   if(url.searchParams.get('tenancy')&&selected){title=selected.address;const ledger=ledgers?await ledgerData(c,selected.id):null;body=tenancyView(selected,await proposals(c,selected.id),{approve:can(c,'proposal.approve'),zone:can(c,'tenancy.timezone'),renew:can(c,'renewal.prepare')},ledger,await workData(c,selected.id),today(c.now,selected.time_zone))+((can(c,'lease.read')||can(c,'lease.metadata'))?leaseSection(selected,await leaseData(c,selected.id),a=>can(c,a),result,(await renewalData(c,selected.id)).filter((r:Row)=>r.state==='accepted')):'')+(can(c,'reports.read')?scenarioSection(selected,url.searchParams.get('scenario')==='1'?await scenarioReport(c,{...Object.fromEntries(url.searchParams),tenancyId:selected.id}):undefined,Object.fromEntries(url.searchParams)):'')+householdSection(selected,await householdData(c,selected,ledger?.balanceCents??null,ledger?.charges),can(c,'household.add'),rows)+moveChecklistSection(selected,await moveChecklistData(c,selected.id),can(c,'move.checklist'));head={eyebrow:selected.owner_name,back:backToTenancies}}
   else {
    const create=manage?createTenancy(!rows.length||url.searchParams.get('add')==='1',c.zone!,await unitChoices(c)):''
    body=rows.length?(ledgers?homeView(await monthData(c,rows),can(c,'proposal.approve'),create):chooser(rows,undefined,'tenancy')+create):emptyView(create,c.now)
    if(manage&&rows.length)head={actions:addTenancyAction}
   }
  }
  else body=chooser(rows,selected,tab)
  if(tab==='ledger'){allow(c,'ledger.read');title='Rent & arrears';if(selected){const run=url.searchParams.get('run'),ledger=await ledgerData(c,selected.id),post=can(c,'rent.charge');body+=ledgerView(selected,ledger,post,can(c,'reports.read'))+paymentView(selected,await paymentData(c,selected.id),ledger.charges,c.actor.role==='owner')+lateFeeView(selected,await lateFeeData(c,selected.id),ledger.charges,c.actor.role==='owner',result.lateFeePreview)+financialView(selected,await financialData(c,selected.id),ledger)+termSection(selected,await terms(c,selected.id),post&&!(await terms(c,selected.id)).some(x=>x.lease_version_id))+runSection(selected,post&&run?await preview(c,run):null,post,run??ledger.today.slice(0,7))}}
  else if(tab==='work'){allow(c,'work.read');title='Inspections & maintenance';if(can(c,'emergency.read'))body=`<section><h2>Safety & emergencies</h2><p>Record a safety report, give approved guidance and see urgent cases until a person acknowledges and resolves them.</p><a href="/app?tab=emergencies">Open safety & emergencies</a></section>`+body;if(selected)body+=workView(selected,{...await workData(c,selected.id),names:await operatorNames(c)})}
  else if(tab!=='tenancy') throw new Fault('not_found','Page not found.',404)
 }
 return page(c,title,body,notice,status,tab,head)
}
const COMMANDS=[...FINANCIAL_COMMANDS,...LATE_FEE_COMMANDS,...PAYMENT_COMMANDS,...PORTAL_COMMANDS,...DOCUMENT_COMMANDS,...TRUST_COMMANDS,...RULE_COMMANDS,...JOURNAL_COMMANDS,'move.checklist','tenancy.create','renewal.prepare','arrears.prepare','proposal.approve','proposal.reject','rent.charge','rent.receipt','rent.adjust','inspection.create','inspection.photo','inspection.complete','maintenance.prepare','maintenance.approve','maintenance.sent','import.preview','import.apply','import.undo','import.journal','import.compensation.preview','import.compensate','tenancy.erase','data.restore','company.save','entity.add','account.add','tenancy.timezone','asset.add','asset.replace','vendor.add','vendor.update','maintenance.reassign','maintenance.exception','schedule.add','schedule.defer','schedule.run','term.add','term.amend','charges.preview','charges.post','portfolio.add','property.add','unit.add','unit.update','tenancy.end','tenancy.transfer','turnover.open','turnover.task.update','turnover.task.submit','turnover.task.check','turnover.publish','household.add','household.leave','household.move','currency.confirm','work.limits','quote.add','quote.select','maintenance.revise','maintenance.owner','completion.record','completion.check','completion.close','owner.add','owner.w9','ownership.set','agreement.set','factor.start','factor.confirm','factor.verify','factor.require','factor.reset','operator.invite','operator.status','operator.role',...CREDENTIAL_COMMANDS,...LEASE_COMMANDS,...BILL_COMMANDS,...APPOINTMENT_COMMANDS,...RETENTION_COMMANDS,...EMERGENCY_COMMANDS,...PROSPECT_COMMANDS,...DELINQUENCY_COMMANDS,...RENEWAL_COMMANDS,...SIBLING_COMMANDS,...CUSTOM_COMMANDS,...DISPATCH_COMMANDS,...WORKFLOW_COMMANDS,...PERIOD_COMMANDS,'fees.run','fee.override',...RECOVERY_COMMANDS,'tax.prepare','tax.review']
const STEPPED=['finance.record','portal.invite','portal.revoke','trust.account.add','trust.map','trust.assign','trust.approve','trust.record','entity.add','account.add','operator.invite','operator.role','operator.status','factor.require','factor.reset',...CREDENTIAL_COMMANDS]
async function command(c:Context,name:string,p:Row) {
 const rules=await ruleCommand(c,name,p);if(rules)return rules
 const trust=await trustCommand(c,name,p);if(trust)return trust
 const journal=await journalCommand(c,name,p);if(journal)return journal
 for(const handler of [financialCommand,lateFeeCommand,paymentCommand,portalCommand,documentCommand,moveChecklistCommand,credentialCommand,dispatchCommand,tenancyCommand,ledgerCommand,workCommand,importCommand,dataCommand,companyCommand,assetCommand,vendorCommand,scheduleCommand,chargeRunCommand,propertyCommand,turnoverCommand,householdCommand,quoteCommand,completionCommand,ownerCommand,factorCommand,periodCommand,feeCommand,recoveryCommand,taxCommand,retentionCommand,appointmentCommand,billCommand,leaseCommand,emergencyCommand,prospectCommand,delinquencyCommand,renewalCommand,siblingCommand,customCommand,workflowCommand]) {
  const result=await handler(c,name,p); if(result!==undefined)return result
 }
 throw new Fault('unknown_command','Unknown Terrace command.',404)
}
export async function terraceResponse(request:Request,env:Bindings):Promise<Response|null> {
 const url=new URL(request.url),isApi=url.pathname.startsWith('/api/'),isPage=url.pathname==='/app'||url.pathname==='/app/command'
 // ROLE-002: portal people have their own door, cookie and pages; nothing below serves them.
 if(url.pathname==='/portal'||url.pathname.startsWith('/portal/'))return portalResponse(request,env)
 if(!isApi&&!isPage)return null
 // Unknown API paths retain a genuine 404 without leaking installation data.
 if(isApi&&!['/api/trust','/api/rules','/api/journal','/api/custom-reports','/api/custom-report','/api/custom-document','/api/delinquency','/api/leasing-report','/api/cash-scenario','/api/lease-source','/api/state','/api/commands','/api/statement','/api/backup','/api/rent-roll','/api/collections','/api/owner-statement','/api/maintenance-report','/api/readable-export','/api/history','/api/period-close','/api/resident-access','/api/bills','/api/bill-attachment','/api/emergencies','/api/prospects','/api/workflows','/api/documents','/api/document','/api/document-versions'].includes(url.pathname)&&!V1_PATH.test(url.pathname)&&!/^\/api\/(inspections\/photos\/[^/]+|maintenance\/[^/]+\/packet)$/.test(url.pathname))return new Response('Not found',{status:404})
 let c:Context|undefined,p:Row={},idem:string|undefined
 try {
  insist(url.origin===env.AUTH_ORIGIN,'origin','The request origin does not match this installation.',403)
  // OPS-001: an Authorization header is an API credential, loaded from D1 on every call; it never carries a cookie session or a second factor.
  const bearer=request.headers.get('authorization')
  if(bearer) {
   insist(isApi,'credential_scope','An API credential reaches only /api paths.',403)
   const now=new Date().toISOString();c={db:env.DB,actor:await credentialActor(env.DB,bearer,now),now,secret:env.SESSION_SECRET};c.zone=await officeZone(c)
  } else {
   const session=await operatorAuth(env).getSession(request)
   if(!session) return isApi?json({error:'unauthorized',message:'Sign in first.'},401):new Response(null,{status:303,headers:{location:'/signin'}})
   insist(['owner','admin','member'].includes(session.operator.role),'forbidden','Access denied.',403)
   c={db:env.DB,actor:session.operator,now:new Date().toISOString(),session:{hash:await sha256(new TextEncoder().encode(session.id)),kind:session.kind},secret:env.SESSION_SECRET};await loadStaff(c);c.zone=await officeZone(c)
   const factor=await factorState(c);c.gated=factor.needed&&!factor.satisfied
  }
  const credential=!!c.actor.credential
  if(request.method==='POST') {
   insist(url.pathname==='/api/commands'||(!credential&&url.pathname==='/app/command'),'method','Use the command endpoint.',405)
   // A bearer token is no ambient credential, so a credential call needs no same-origin proof; it needs JSON and an Idempotency-Key.
   insist(credential||(request.headers.get('origin')===env.AUTH_ORIGIN&&request.headers.get('sec-fetch-site')!=='cross-site'),'origin','Same-origin confirmation is required.',403)
   insist(Number(request.headers.get('content-length')??0)<=(credential?1024*1024:25*1024*1024),'body_limit','Request is too large.',413)
   const raw=credential?await request.text():''
   if(credential)try{insist(request.headers.get('content-type')?.includes('application/json'),'input','Send JSON.',415);p=JSON.parse(raw)}catch(e){throw e instanceof Fault?e:new Fault('input','Send a JSON command object.')}
   else p=request.headers.get('content-type')?.includes('application/json')?await request.json():Object.fromEntries(await request.formData())
   insist(p&&typeof p==='object'&&!Array.isArray(p),'input','Send a command object.')
   const name=text(p.command,'Command',100)
   // ROLE-001: an unknown command is 404; a known command outside the actor's role is 403 before any record is read.
   insist(COMMANDS.includes(name),'unknown_command','Unknown Terrace command.',404);credentialGate(c,name);allow(c,name);c.action=name
   // SAFE-002: the source the person gave (a lease reference, receipt or handoff reference, or reason) goes into the history row.
   c.source=([p.source,p.reference,p.reason].find(v=>typeof v==='string'&&v.trim()) as string|undefined)?.trim().slice(0,500)??null
   insist(!c.gated||FACTOR_COMMANDS.includes(name),'second_factor_required','Pass your second factor first: open /app?tab=security.',403)
   // SAFE-001: bank references, legal entities and access changes need Base's fresh email-link proof (10 minutes). Base's proof is per sign-in, not per action; Terrace asks under 'credentials:mint'.
   if(STEPPED.includes(name))await operatorAuth(env).requireStepUp(request,'credentials:mint').catch(e=>{throw e?.code==='step_up_required'?new Fault('step_up_required','Confirm it is you: request a link at /auth/step-up, open it in this browser, then try again within 10 minutes.',403):e})
   if(credential){const replay=await beginIdempotent(c,request.headers.get('idempotency-key'),raw);if(replay)return replay;idem=request.headers.get('idempotency-key')!}
   const result:Row=await peopleCommand(request,env,c,name,p)??await command(c,name,p)
   // WORK-001: the alert goes after its case is committed, and its provider outcome is recorded either way.
   if(result.portalEmail){const sent=await sendPortalEmail(c,env,result.portalEmail);delete result.portalEmail;result.emailOutcome=sent.outcome;result.notice=`${result.notice} ${sent.label[0].toUpperCase()+sent.label.slice(1)}.`}
   if(result.dispatchEmail){const sent=await sendDispatch(c,env,result.dispatchEmail);delete result.dispatchEmail;result.emailOutcome=sent.outcome;result.notice=sent.label}
   if(result.renewalEmails){const sent=await sendRenewalEmails(c,env,result.renewalEmails);delete result.renewalEmails;result.emailOutcomes=sent;result.notice=`${result.notice} ${sent.map(x=>`${x.to}: ${x.label}`).join('; ')}.`}
   if(result.prospectEmail){const sent=await sendProspectEmail(c,env,result.prospectEmail);delete result.prospectEmail;result.emailOutcome=sent.outcome;result.notice=`${result.notice} ${sent.label[0].toUpperCase()+sent.label.slice(1)}.`}
   if(result.alert){const sent=await deliverAlert(c,env,result.alert);result.alertOutcome=sent.outcome;result.notice=`${result.notice} Alert: ${sent.label}.`}
   // SAFE-002: move-in applies and undos and restores keep custody in Base's import journal; history records each once it succeeds.
   if(['import.apply','import.undo','data.restore'].includes(name)&&!result.replayed)await audit(c,name,String(result.job?.id??result.jobId??p.jobId??'installation')).run()
   if(isApi){if(idem)await finishIdempotent(c,idem,JSON.stringify({ok:true,result}));return json({ok:true,result})}
   const dest=new URL('/app',url);dest.searchParams.set('tab',String(p.tab??'tenancy'));dest.searchParams.set('tenancy',String(result.tenancyId??(name==='tenancy.create'?result.id:p.tenancyId)??''))
   if(name==='privacy.review')return await render(c,dest,result.notice,result)
   if(name==='import.preview'||name==='import.journal'||name==='credential.mint'||name==='credential.rotate'||name==='factor.start'||name==='factor.confirm'||name==='lease.preview'||name==='latefee.preview')return await render(c,dest,result.notice??'Review the result below.',result)
   if(name==='delinquency.assign'){dest.searchParams.set('tab','delinquency');for(const key of ['asOf','propertyId','ownerId'])if(p[key])dest.searchParams.set(key,String(p[key]))}
   if(result.month)dest.searchParams.set('month',result.month);dest.searchParams.set('notice',result.notice??'Saved.');return new Response(null,{status:303,headers:{location:dest.pathname+dest.search,'cache-control':'no-store'}})
  }
  insist(request.method==='GET','method','Method not allowed.',405)
  if(url.pathname==='/app')return await render(c,url,url.searchParams.get('notice')??'',{},200,request,env)
  insist(!c.gated,'second_factor_required','Pass your second factor first: open /app?tab=security.',403)
  if(V1_PATH.test(url.pathname))return await apiV1(c,url)
  if(url.pathname==='/api/commands')return json({commands:COMMANDS.filter(name=>can(c!,name)&&(!c!.actor.credential||c!.actor.credential.scope==='prepare'&&PREPARE_COMMANDS.includes(name)))})
  if(url.pathname==='/api/state') {
   const tenancies=(await tenancyData(c)).sort((a,b)=>a.address.localeCompare(b.address)||a.tenant_name.localeCompare(b.tenant_name)||a.id.localeCompare(b.id)),tenancyId=url.searchParams.get('tenancy'),t=tenancyId?await tenancy(c,tenancyId):undefined,ledger=t&&can(c,'ledger.read')?{...await ledgerData(c,t.id),payments:await paymentData(c,t.id),lateFees:await lateFeeData(c,t.id),financialActions:await financialData(c,t.id)}:undefined
   return json({actor:{role:c.actor.role,staffRole:c.actor.staff?.role??'owner',allPortfolios:c.actor.role==='owner'||!!c.actor.staff?.all},...await companyData(c),...await propertyData(c),turnovers:await turnoverData(c),ownership:await ownershipData(c),siblings:await siblingData(c),tenancies,...(t?{ledger,moveChecklists:await moveChecklistData(c,t.id),household:await householdData(c,t,ledger?.balanceCents??null,ledger?.charges),proposals:await proposals(c,t.id),renewals:await renewalData(c,t.id),work:await workData(c,t.id),...((can(c,'lease.read')||can(c,'lease.metadata'))?{leaseVersions:await leaseData(c,t.id)}:{})}:{})})
  }
  if(url.pathname==='/api/custom-reports')return json(await customCatalog(c))
  if(url.pathname==='/api/custom-report'){const data=await customReport(c,url.searchParams.get('id'));if(url.searchParams.get('format')==='csv'){await recordRead(c,'export:custom-report',data.id);return new Response(csv(customReportTable(data)),{headers:{'content-type':'text/csv;charset=utf-8','content-disposition':'attachment; filename="custom-report.csv"','cache-control':'no-store'}})}return json(data)}
  if(url.pathname==='/api/custom-document'){const data=await customDocument(c,url.searchParams.get('id'));if(url.searchParams.get('format')==='text'){await recordRead(c,'export:custom-document',data.id);return new Response(data.content,{headers:{'content-type':'text/plain;charset=utf-8','content-disposition':'attachment; filename="custom-document.txt"','cache-control':'no-store','x-content-type-options':'nosniff'}})}return json(data)}
  if(url.pathname==='/api/delinquency'){const data=await delinquencyReport(c,Object.fromEntries(url.searchParams));if(url.searchParams.get('format')==='csv'){await recordRead(c,'export:delinquency','delinquency');return new Response(csv(delinquencyTable(data)),{headers:{'content-type':'text/csv;charset=utf-8','content-disposition':'attachment; filename="delinquency.csv"','cache-control':'no-store'}})}return json(data)}
  if(url.pathname==='/api/leasing-report')return json(await leasingReport(c,Object.fromEntries(url.searchParams)))
  if(url.pathname==='/api/cash-scenario')return json(await scenarioReport(c,Object.fromEntries(url.searchParams)))
  if(url.pathname==='/api/lease-source')return await leaseSource(c,url.searchParams.get('id'))
  if(url.pathname==='/api/prospects')return json(await prospectData(c))
  if(url.pathname==='/api/rules'){noCredential(c,'read counsel-review rule packs');return json(await ruleData(c,url.searchParams.get('propertyId')))}
  if(url.pathname==='/api/trust'){noCredential(c,'read bank custody');const data=await trustData(c,Object.fromEntries(url.searchParams));await recordRead(c,'read:trust','custody');return json(data)}
  if(url.pathname==='/api/journal'){noCredential(c,'read the general ledger');const data=await journalData(c,Object.fromEntries(url.searchParams));await recordRead(c,'read:journal','journal');return json(data)}
  if(url.pathname==='/api/documents')return json(await documentSearch(c,Object.fromEntries(url.searchParams)))
  if(url.pathname==='/api/document')return await documentDownload(c,url.searchParams.get('id'))
  if(url.pathname==='/api/document-versions')return json(await documentVersions(c,url.searchParams.get('id')))
  if(url.pathname==='/api/workflows')return json(await workflowData(c))
  if(url.pathname==='/api/emergencies')return json(await emergencyData(c))
  if(url.pathname==='/api/bills'){const data=await billData(c);await recordRead(c,'bills.read','bills');return json(data)}
  if(url.pathname==='/api/bill-attachment')return await billAttachment(c,url.searchParams.get('id'))
  if(url.pathname==='/api/resident-access'){const r=await residentAccess(c,url.searchParams.get('tenancyId'));await recordRead(c,'export:resident-access',String(url.searchParams.get('tenancyId')));return r}
  if(url.pathname==='/api/history')return url.searchParams.get('format')==='csv'?new Response(csv(await historyCsv(c,Object.fromEntries(url.searchParams))),{headers:{'content-type':'text/csv;charset=utf-8','content-disposition':'attachment; filename="terrace-history.csv"','cache-control':'no-store'}}):json(await history(c,Object.fromEntries(url.searchParams)))
  // SAFE-002: sensitive reads and exports are recorded once they succeed.
  if(url.pathname==='/api/backup'){noCredential(c,'download an installation backup');const r=await backup(c);await recordRead(c,'export:backup','installation');return r}
  if(url.pathname==='/api/readable-export'){noCredential(c,'download the readable export');const r=await readableExport(c);await recordRead(c,'export:readable','installation');return r}
  if(url.pathname==='/api/collections'){const r=await collections(c,url.searchParams.get('month'));await recordRead(c,'read:collections',String(url.searchParams.get('month')));return json(r)}
  if(url.pathname==='/api/rent-roll') {
   const r=await rentRoll(c,Object.fromEntries(url.searchParams)),f=url.searchParams.get('format')??'json'
   await recordRead(c,'read:rent-roll',`${r.asOf} ${f}`)
   const file='terrace-rent-roll-'+r.asOf,head=(type:string,ext:string)=>({'content-type':type,'content-disposition':`attachment; filename="${file}.${ext}"`,'cache-control':'no-store'})
   if(f==='csv')return new Response(csv(rentRollTable(r)),{headers:head('text/csv;charset=utf-8','csv')})
   if(f==='xlsx')return new Response(xlsx(rentRollTable(r),'Rent roll'),{headers:head('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','xlsx')})
   if(f==='pdf')return new Response(pdf('Terrace rent roll as of '+r.asOf,rentRollTable(r).slice(1)),{headers:head('application/pdf','pdf')})
   return json(r)
  }
  if(url.pathname==='/api/period-close') {allow(c,'reports.read');const d=await periodData(c,url.searchParams.get('month'));if(url.searchParams.get('format')!=='csv')return json(d);const v=Number(url.searchParams.get('version'));await recordRead(c,'read:close-statement',`${d.month} v${v}`);return new Response(csv(closeTable(d,v,await operatorNames(c))),{headers:{'content-type':'text/csv;charset=utf-8','content-disposition':`attachment; filename="terrace-close-${d.month}-v${v}.csv"`,'cache-control':'no-store'}})}
  if(url.pathname==='/api/maintenance-report') {const r=await serviceReport(c,Object.fromEntries(url.searchParams));return url.searchParams.get('format')==='csv'?new Response(csv(serviceTable(r)),{headers:{'content-type':'text/csv;charset=utf-8','content-disposition':'attachment; filename="terrace-maintenance-report.csv"','cache-control':'no-store'}}):json(r)}
  if(url.pathname==='/api/owner-statement') {const s=await ownerStatement(c,url.searchParams.get('ownerId'),url.searchParams.get('from'),url.searchParams.get('to'));await recordRead(c,'read:owner-statement',`${s.owner.id} ${s.from}..${s.to}`);return url.searchParams.get('format')==='csv'?new Response(csv(ownerStatementTable(s)),{headers:{'content-type':'text/csv;charset=utf-8','content-disposition':'attachment; filename="terrace-owner-allocation.csv"','cache-control':'no-store'}}):json(s)}
  if(url.pathname==='/api/statement') {const s=await statement(c,text(url.searchParams.get('tenancyId'),'Tenancy'),text(url.searchParams.get('from'),'From'),text(url.searchParams.get('to'),'To'));await recordRead(c,'read:statement',`${s.tenancy.id} ${s.from}..${s.to}`);return new Response(statementCsv(s),{headers:{'content-type':'text/csv;charset=utf-8','content-disposition':'attachment; filename="terrace-owner-statement.csv"','cache-control':'no-store'}})}
  if(url.pathname.startsWith('/api/inspections/photos/')){const id=url.pathname.split('/').at(-1)!,r=await photoResponse(c,id);await recordRead(c,'read:photo',id);return r}
  if(url.pathname.startsWith('/api/maintenance/')){const id=url.pathname.split('/')[3],r=await workPacket(c,id);await recordRead(c,'read:packet',id);return r}
  return new Response('Not found',{status:404})
 } catch(error) {
  if(c&&idem)await abandonIdempotent(c,idem).catch(()=>{})
  const x=error as any,conflict=String(x.message).includes('UNIQUE constraint'),status=conflict?409:(x.status??400),message=conflict?'That reference already exists. Use the existing record or a distinct reference.':x.message??'The operation failed.',code=conflict?'duplicate':x.code??'operation_failed'
  if(isApi)return json({ok:false,error:code,message,...(x.report?{report:x.report}:{})},status)
  if(c) {const dest=new URL('/app',url);dest.searchParams.set('tab',String(p.tab??url.searchParams.get('tab')??'tenancy'));dest.searchParams.set('tenancy',String(p.tenancyId??url.searchParams.get('tenancy')??''));try{return await render(c,dest,message,{},status,request,env)}catch{return page(c,'Unable to continue','<p><a href="/app">Back to tenancies</a></p>',message,status)}}
  return new Response(message,{status})
 }
}
