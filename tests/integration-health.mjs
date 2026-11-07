import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {cardFixture} from './card-payments.mjs'
import {installation,tenancyInput} from './api/harness.mjs'
import {leaseFields} from './leases.mjs'

export const diagnostics=async h=>{const response=await h.request('/api/integrations');assert.equal(response.status,200);return response.json()}
export const readiness=async h=>{const response=await h.request('/api/setup-readiness');assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');return response.json()}
async function readinessLimits(h,t,job){
 const data=await readiness(h),limit=id=>data.limits.find(l=>l.id===id).maxBytes
 // Wrong content at each ceiling passes byte validation then fails its content check; one more byte fails the size gate.
 const inspection=await h.command('inspection.create',{tenancyId:t.id,date:'2026-10-29',notes:'Synthetic setup limit probe'})
 const photo=Buffer.alloc(limit('inspection-photo'));photo.set([137,80,78,71,13,10,26,10])
 await h.formCommand('inspection.photo',{inspectionId:inspection.id,file:new File([photo],'synthetic-terrace-9401.png',{type:'image/png'})})
 const tooLarge=await h.formCommand('inspection.photo',{inspectionId:inspection.id,file:new File([photo,Buffer.alloc(1)],'synthetic-terrace-9402.png',{type:'image/png'})},{status:400});assert.equal(tooLarge.error,'invalid_photo')
 const document=Buffer.alloc(limit('tenancy-document'),65),fields={tenancyId:t.id,kind:'notice',title:'Synthetic setup limit',source:'Synthetic setup boundary'}
 assert.equal((await h.formCommand('document.upload',{...fields,file:new File([document],'synthetic-terrace-9403.bin',{type:'application/octet-stream'})},{status:422})).error,'document_refused')
 assert.equal((await h.formCommand('document.upload',{...fields,file:new File([document,Buffer.alloc(1)],'synthetic-terrace-9404.txt',{type:'text/plain'})},{status:413})).error,'document_limit')
 const signed=Buffer.alloc(limit('signed-lease'),32)
 const lease=leaseFields(t.id,'2026-10-29'),source={name:'synthetic-terrace-9405.txt',type:'text/plain',base64:signed.toString('base64')}
 assert.equal((await h.command('lease.prepare',{...lease,source},{status:400})).error,'invalid_source')
 assert.equal((await h.command('lease.prepare',{...lease,source:{...source,base64:Buffer.concat([signed,Buffer.alloc(1)]).toString('base64')}},{status:413})).error,'source_limit')
 for(const [id,mediaType]of [['record-visual','image/png'],['record-document','application/pdf']]){
  const p={kind:'work',recordId:job.id,name:'synthetic-terrace-9406',mediaType,size:limit(id),sha256:'a'.repeat(64),capturedAt:'2026-10-29',source:'Synthetic setup boundary'}
  const upload=await h.command('media.begin',p);await h.command('media.abort',{uploadId:upload.id})
  assert.equal((await h.command('media.begin',{...p,size:limit(id)+1},{status:400})).error,'media_size')
 }
 const chunk=limit('media-chunk'),upload=await h.command('media.begin',{kind:'work',recordId:job.id,name:'synthetic-terrace-9407.png',mediaType:'image/png',size:chunk+1,sha256:'b'.repeat(64),capturedAt:'2026-10-29',source:'Synthetic setup chunk boundary'})
 assert.equal(upload.chunkSize,chunk)
 await h.formCommand('media.chunk',{uploadId:upload.id,position:0,file:new File([Buffer.alloc(chunk)],'synthetic-terrace-9408')})
 assert.equal((await h.formCommand('media.chunk',{uploadId:upload.id,position:0,file:new File([Buffer.alloc(chunk+1)],'synthetic-terrace-9409')},{status:400})).error,'chunk_size')
 await h.command('media.abort',{uploadId:upload.id})
 const archive=Buffer.alloc(limit('web-archive'),32)
 assert.notEqual((await h.formCommand('data.restore',{confirm:'RESTORE',backup:new File([archive],'synthetic-terrace-9410.rer')},{status:400})).error,'archive_file','a file at the disclosed ceiling reaches archive validation')
 assert.equal((await h.formCommand('data.restore',{confirm:'RESTORE',backup:new File([archive,Buffer.alloc(1)],'synthetic-terrace-9410.rer')},{status:400})).error,'archive_file')
 const html=await(await h.request('/app?tab=settings')).text()
 for(const l of data.limits)assert.ok(html.includes(l.maxBytes.toLocaleString('en-US')+' bytes'),'native Settings displays the enforced limit for '+l.id)
 console.log('PROBE SAFE-008 limits: actual native upload doors enforce disclosed byte ceilings before content validation; larger originals and an oversized browser archive are refused.')
}
export async function journey({assets=false,inspect}={}){
 let stripeStatus=200,mailStatus=200,networkFailure=false,stripeCalls=0,mailCalls=0
 const sentinel='synthetic-terrace-private-response-401'
 await cardFixture({assets,bufferedTransport:assets,stripeKey:'synthetic-terrace-9301',mailKey:'synthetic-terrace-9302',provider:async request=>{
  stripeCalls++
  if(networkFailure)throw Error(sentinel)
  if(stripeStatus!==200)return Response.json({error:{code:sentinel,message:sentinel}},{status:stripeStatus})
  return Response.json({id:'cs_test_'+randomUUID().replaceAll('-',''),url:'https://checkout.stripe.com/c/pay/synthetic-terrace-300',livemode:false})
 },mailResponse:message=>{
  if(!['Terrace repair update'].includes(message.subject)&&!message.subject.startsWith('Approved Terrace work'))return Response.json({id:randomUUID()})
  mailCalls++
  return mailStatus===200?Response.json({id:randomUUID()}):Response.json({name:sentinel,message:sentinel},{status:mailStatus})
 },inspect:async({h,t,pay})=>{
  let data=await diagnostics(h),stripe=data.providers.find(p=>p.provider==='stripe')
  assert.equal(stripe.configured,true);assert.equal(stripe.outcome,'not_checked');assert.equal(stripe.metadata,null);assert.equal(stripe.measuredBilling,null)
  const admin=await h.invite('admin',tenancyInput.ownerEmail),input={provider:'stripe',scope:'hosted_test_payments',entitlement:'unknown',centsPerThousand:'250',costAsOf:'2026-10-26'}
  const before=stripeCalls
  await h.command('integration.save',input,{as:admin,status:403})
  assert.equal((await h.request('/api/integrations',{as:admin})).status,403)
  assert.equal((await h.request('/api/setup-readiness',{as:admin})).status,403)
  assert.equal((await h.request('/api/setup-readiness',{as:''})).status,401)
  assert.ok(!(await(await h.request('/app?tab=settings',{as:admin})).text()).includes('Integration diagnostics'))
  assert.ok(!(await(await h.request('/app?tab=settings',{as:admin})).text()).includes('Setup readiness'))
  assert.equal((await diagnostics(h)).providers.find(p=>p.provider==='stripe').metadata,null,'refused setup leaves metadata unchanged')
  await h.setTime('2026-10-27T12:00:00.000Z')
  await h.stepUp()
  await h.command('integration.save',input)
  assert.equal(stripeCalls,before,'metadata save never validates, sends or retries against a provider')
  await h.command('integration.save',{provider:'resend',scope:'transactional_mail',entitlement:'unknown',centsPerThousand:'',costAsOf:''})
  for(const [status,outcome]of [[403,'denied_scope'],[401,'credential_expired'],[503,'transient_failure'],[422,'semantic_error'],[200,'success']]){
   stripeStatus=status
   const response=await h.request('/api/commands',{method:'POST',body:{command:'payment.card',...pay,requestKey:randomUUID()}}),body=await response.text()
   assert.equal(response.status,status===200?200:status===503?503:409,body)
   assert.ok(!body.includes(sentinel),'Stripe errors redact remote text and codes')
   stripe=(await diagnostics(h)).providers.find(p=>p.provider==='stripe')
   assert.equal(stripe.outcome,outcome,'Stripe boundary distinguishes '+status)
   const screen=await(await h.request('/app?tab=settings')).text()
   const visible={denied_scope:'The provider denied access',credential_expired:'The provider rejected the credential',transient_failure:'The provider or transport failed temporarily',semantic_error:'The provider rejected the operation',success:'Last exchange succeeded'}[outcome]
   assert.ok(screen.includes(visible),'native diagnostics show the actionable Stripe state')
  }
  networkFailure=true
  const failed=await h.request('/api/commands',{method:'POST',body:{command:'payment.card',...pay,requestKey:randomUUID()}})
  assert.equal(failed.status,503);assert.ok(!(await failed.text()).includes(sentinel));networkFailure=false
  stripe=(await diagnostics(h)).providers.find(p=>p.provider==='stripe')
  assert.equal(stripe.outcome,'transient_failure');assert.equal(stripe.requests,6);assert.equal(stripe.operations,6);assert.equal(stripe.successes,1);assert.equal(stripe.failures,5)
  assert.equal(stripe.metadata.entitlement,'unknown');assert.equal(stripe.metadata.cents_per_thousand,250);assert.equal(stripe.lastSuccess,'2026-10-27T12:00:00.000Z')
  await h.setTime('2026-10-29T12:00:00.000Z')
  stripe=(await diagnostics(h)).providers.find(p=>p.provider==='stripe');assert.equal(stripe.ageSeconds,172800);assert.equal(stripe.freshness,'Older than 24 hours')
  const vendor=await h.command('vendor.add',{name:'Synthetic diagnostics contractor',email:tenancyInput.ownerEmail,phone:'510-555-0190',specialties:'plumbing',serviceAreas:'Oakland',w9:'received',insuranceExpires:'2036-12-31',licenseNumber:'synthetic-terrace-301',licenseExpires:'2036-12-31',availability:'Weekdays',rate:'95',standing:'approved'})
  let lastJob
  for(const [status,outcome]of [[403,'denied_scope'],[401,'credential_expired'],[503,'transient_failure'],[200,'success']]){
   mailStatus=status
   const j=await h.command('maintenance.prepare',{tenancyId:t.id,title:'Synthetic diagnostics repair',scope:'Inspect leaking valve',checklist:'Inspect valve',vendorId:vendor.id,trade:'plumbing',dueDate:'2026-10-30',estimate:'100'})
   await h.command('maintenance.approve',{jobId:j.id,version:1},{as:admin})
   const sent=await h.command('maintenance.dispatch',{jobId:j.id,version:2});assert.equal(sent.emailOutcome,status===200?'accepted':status===503?'uncertain':'rejected')
   const mail=(await diagnostics(h)).providers.find(p=>p.provider==='resend');assert.equal(mail.outcome,outcome,'mail boundary distinguishes '+status)
   const count=mailCalls;await h.command('maintenance.dispatch',{jobId:j.id,version:2});assert.equal(mailCalls,count,'a dispatch replay cannot retry a provider write')
   lastJob=j
  }
  await h.stepUp()
  const people=await(await h.request('/auth/operators')).json(),operator=people.find(p=>p.email===tenancyInput.ownerEmail)
  assert.equal((await h.request('/auth/operator/status',{method:'POST',body:{operatorId:operator.id,status:'inactive'}})).status,200)
  assert.equal((await h.request('/api/integrations',{as:admin})).status,401,'revoked operators cannot read diagnostics')
  assert.equal((await h.request('/api/setup-readiness',{as:admin})).status,401,'revoked operators cannot read readiness')
  await h.command('integration.save',input,{as:admin,status:401})
  const contact=await h.command('message.contact',{tenancyId:t.id,kind:'resident',subjectId:t.id,phone:'',timeZone:'America/Los_Angeles',emailConsent:'granted',smsConsent:'unknown',voiceConsent:'unknown',reference:'Synthetic resident requested repair email'})
  const message=await h.command('message.prepare',{contactId:contact.id,channel:'email',body:'Synthetic diagnostics repair update'})
  const approved=await h.command('message.approve',{messageId:message.id,version:message.version,consent:'APPROVE EXACT MESSAGE'})
  assert.equal((await h.command('message.send',{messageId:message.id,version:approved.version})).messageOutcome,'accepted')
  const count=mailCalls;await h.command('message.send',{messageId:message.id,version:approved.version},{status:409});assert.equal(mailCalls,count)
  data=await diagnostics(h);const mail=data.providers.find(p=>p.provider==='resend')
  assert.deepEqual(mail.observations.find(r=>r.operation==='dispatch_mail').outcomes.map(o=>[o.outcome,o.operations]),[['credential_expired',1],['denied_scope',1],['success',1],['transient_failure',1]],'later success preserves each distinct historical failure category')
  assert.equal(mail.requests,5);assert.equal(mail.successes,2);assert.equal(mail.failures,3);assert.equal(mail.metadata.entitlement,'unknown');assert.equal(mail.measuredBilling,null)
  assert.ok(mail.observations.some(r=>r.operation==='message_mail'&&r.successes===1),'resident message sends join the same diagnostics')
  await h.restart();assert.equal((await diagnostics(h)).providers.find(p=>p.provider==='stripe').requests,6,'counters survive process restart')
  await h.command('integration.save',{...input,entitlement:'owner_reported_available'})
  const credential=await h.command('credential.mint',{label:'synthetic-terrace-9411',scope:'read',role:'portfolio_manager',allPortfolios:true}),headers={authorization:'Bearer '+credential.token}
  assert.equal((await h.request('/api/setup-readiness',{as:'',headers})).status,403,'even an all-portfolio credential cannot read owner setup')
  await h.command('credential.revoke',{credentialId:credential.id})
  assert.equal((await h.request('/api/setup-readiness',{as:'',headers})).status,401)
  await readinessLimits(h,t,lastJob)
  const snapshot=async()=>Promise.all(['tt_journal','tt_charges','tt_receipts','tt_card_payments','tt_payments','tt_payment_policies','tt_company','tt_operating_accounts','tt_integration_metadata','tt_integration_health','tt_integration_outcomes'].map(async table=>(await h.db.prepare('SELECT * FROM '+table).all()).results))
  const stateBefore=await snapshot(),callsBefore=[stripeCalls,h.messages.length]
  const ready=await readiness(h),rs=ready.integrations.find(p=>p.provider==='stripe')
  assert.equal(rs.configurationPresent,true);assert.equal(rs.ownerReportedEntitlement,'owner_reported_available');assert.ok(rs.lastSuccessfulExchange)
  assert.equal(ready.activationReady,false);assert.equal(ready.authorityVerified,false)
  for(const d of ready.dependencies){assert.equal(d.agreement,'unverified');assert.equal(d.authorizedCredentials,'unverified');assert.equal(d.authorityVerified,false);assert.equal(d.activationReady,false);assert.ok(d.required&&d.implementation&&d.clauses.length)}
  for(const id of ['payments','bank-feeds','screening','marketplaces','insurance','tax','signing','communications','native'])assert.ok(ready.dependencies.some(d=>d.id===id),'required contract boundary is disclosed: '+id)
  assert.equal(ready.capacity.qualified,false);assert.equal(ready.capacity.receipt,null)
  assert.ok(ready.capacity.targets.length);for(const target of ready.capacity.targets){assert.ok(target.boundMs>0);assert.equal(target.measuredMs,null)}
  assert.equal(ready.costs.measuredStorageBilling,null);assert.equal(ready.costs.measuredExternalFees,null)
  const assumption=ready.costs.assumptions.find(p=>p.provider==='stripe');assert.equal(assumption.usdCentsPerThousand,250);assert.equal(assumption.asOf,input.costAsOf);assert.equal(assumption.estimatedUsdCents,Math.round(stripe.requests*250/1000))
  assert.ok(ready.costs.sources.some(s=>new URL(s.url).hostname==='resend.com'));assert.ok(ready.costs.sources.some(s=>new URL(s.url).hostname==='developers.cloudflare.com'))
  const readyHtml=await(await h.request('/app?tab=settings')).text()
  assert.ok(readyHtml.includes('<section id="setup-readiness">'))
  const wire=JSON.stringify(ready)+readyHtml.split('<section id="setup-readiness">')[1].split('</section>')[0]
  for(const secret of [sentinel,'synthetic-terrace-9301','synthetic-terrace-9302',credential.token,tenancyInput.tenantEmail])assert.ok(!wire.includes(secret),'setup disclosures exclude secrets and private resident data')
  assert.ok(readyHtml.includes('Agreement and authority: unverified'));assert.ok(readyHtml.includes('Reference measurements are unavailable'))
  for(const method of ['POST','PUT','PATCH','DELETE'])assert.equal((await h.request('/api/setup-readiness',{method,body:{activate:true}})).status,405,'the disclosure endpoint refuses '+method+' without activation or state changes')
  assert.deepEqual(await snapshot(),stateBefore,'owner setup reads change no financial, provider, policy or configuration state')
  assert.deepEqual([stripeCalls,h.messages.length],callsBefore,'setup reads make no provider requests')
  console.log('PROBE SAFE-008 authority: configured test transport, a successful exchange and owner-reported entitlement -> agreements and activation unverified; staff and credentials refused.')
  console.log('PROBE SAFE-008 costs and capacity: owner-dated estimates and pricing sources -> storage and external fees unknown; target bounds shown without reference measurements or receipts.')
  console.log('PROBE SAFE-008 read safety: authenticated endpoint and native Settings -> no provider requests, secrets, money or configuration changes.')
  const html=await(await h.request('/app?tab=settings')).text();assert.ok(!html.includes(sentinel));assert.ok(html.includes('not measured billing'));assert.ok(html.includes('Unknown'))
  await inspect?.({h,t,data:await diagnostics(h),phase:'diagnostics'})
  const archive=await(await h.request('/api/backup')).text(),zip=Buffer.from(await(await h.request('/api/readable-export')).arrayBuffer())
  assert.ok(!archive.includes(sentinel)&&!zip.includes(Buffer.from(sentinel)),'no raw response enters portable records')
  assert.ok(!archive.includes('synthetic-terrace-9301')&&!archive.includes('synthetic-terrace-9302')&&!zip.includes(Buffer.from('synthetic-terrace-9301'))&&!zip.includes(Buffer.from('synthetic-terrace-9302')),'provider secrets are excluded from the backup')
  for(const name of ['Stripe diagnostics:','Resend mail diagnostics:'])assert.ok(zip.includes(Buffer.from(name)),'readable export includes provider-specific reconnect instructions')
  const fresh=await installation({assets,bufferedTransport:assets,now:'2026-10-29T12:00:00.000Z'})
  try{
   await fresh.formCommand('data.restore',{confirm:'RESTORE',backup:new File([archive],'synthetic-terrace-302.rer')})
   const restored=await diagnostics(fresh),rs=restored.providers.find(p=>p.provider==='stripe'),rm=restored.providers.find(p=>p.provider==='resend')
   assert.equal(rs.configured,false);assert.equal(rs.lastSuccess,null);assert.equal(rs.requests,0);assert.equal(rs.observations[0].requests,6);assert.equal(rs.observations[0].currentInstallation,false)
   assert.equal(rm.outcome,'restored_evidence');assert.equal(rm.lastSuccess,null);assert.equal(rm.requests,0);assert.equal(rm.metadata.entitlement,'unknown')
   const readinessAfterRestore=await readiness(fresh)
   assert.equal(readinessAfterRestore.activationReady,false);assert.equal(readinessAfterRestore.authorityVerified,false);assert.equal(readinessAfterRestore.capacity.receipt,null)
   assert.equal(readinessAfterRestore.integrations.find(p=>p.provider==='stripe').lastSuccessfulExchange,null,'restored configuration history cannot verify authority')
   const n=fresh.messages.length
   await fresh.stepUp();const afterProof=fresh.messages.length
   await fresh.command('message.send',{messageId:message.id,version:approved.version},{status:409})
   const replayed=await fresh.command('maintenance.dispatch',{jobId:lastJob.id,version:2});assert.ok(replayed.notice.includes('No duplicate email sent'))
   await fresh.scheduled(Date.parse('2026-10-29T13:00:00Z'))
   assert.equal(fresh.messages.length,afterProof,'restored diagnostics, sends and scheduler replay no mail');assert.ok(afterProof>=n)
   await inspect?.({h:fresh,t,data:restored,phase:'restored'})
  }finally{await fresh.close()}
 }})
 const missing=await installation({mailProvider:'development'})
 try{
  await missing.command('integration.save',{provider:'stripe',scope:'unknown',entitlement:'unknown'},{status:403})
  const d=await diagnostics(missing);assert.equal(d.mailConfigured,false);assert.equal(d.providers.find(p=>p.provider==='stripe').outcome,'missing_configuration')
  assert.equal(d.providers.find(p=>p.provider==='stripe').requests,0)
  const unavailable=await readiness(missing);assert.equal(unavailable.activationReady,false);assert.equal(unavailable.integrations.find(p=>p.provider==='stripe').configurationPresent,false)
  assert.ok(unavailable.costs.assumptions.every(p=>p.usdCentsPerThousand===null&&p.asOf===null))
 }finally{await missing.close()}
}
if(process.argv[1]===import.meta.filename)await journey()
