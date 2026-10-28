import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {cardFixture} from './card-payments.mjs'
import {installation,tenancyInput} from './api/harness.mjs'

export const diagnostics=async h=>{const response=await h.request('/api/integrations');assert.equal(response.status,200);return response.json()}
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
  assert.ok(!(await(await h.request('/app?tab=settings',{as:admin})).text()).includes('Integration diagnostics'))
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
 }finally{await missing.close()}
}
if(process.argv[1]===import.meta.filename)await journey()
