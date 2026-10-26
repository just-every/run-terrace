import assert from 'node:assert/strict'
import {createHmac} from 'node:crypto'
import {installation,tenancyInput} from './api/harness.mjs'
import {syntheticPack} from './rule-packs.mjs'
export async function journey({assets=false,inspect}={}){
 const clock='2026-10-26T12:00:00.000Z',webhookBytes=Buffer.from('synthetic-terrace-150-webhook-key'),mailWebhookKey='whsec_'+webhookBytes.toString('base64'),h=await installation({assets,mailWebhookKey,now:clock})
 try{
  const f=await h.command('portfolio.add',{name:'Statement portfolio'}),p=await h.command('property.add',{portfolioId:f.id,name:'Statement house',address:'1 Synthetic Terrace Road',kind:'duplex',timeZone:'America/Chicago'}),u=await h.command('unit.add',{propertyId:p.id,identifier:'A',bedrooms:'2',bathrooms:'1'}),t=await h.command('tenancy.create',{...tenancyInput,unitId:u.id,cadence:'monthly',rent:'1000.00'})
  const q=await h.command('rent.charge',{tenancyId:t.id,dueDate:'2026-10-01',amount:'1000.00',description:'October rent – East',reference:'synthetic-terrace-140 private charge reference'}),r=await h.command('rent.receipt',{chargeId:q.id,amount:'200.00',receivedDate:'2026-10-02',method:'card',reference:'synthetic-terrace-141 private bank reference'})
  await h.command('household.add',{tenancyId:t.id,role:'co_tenant',name:'Synthetic private co-tenant',email:'private-co@example.test',joined:'2025-01-01'})
  await h.command('property.rules',{propertyId:p.id,stateCode:'CA',version:0,reference:'synthetic-terrace-142'})
  const stages=[{minDaysPastDue:0,allowPartial:true,overpayment:'credit'}],pack=syntheticPack('CA');pack.fields.partialPayments.value={stages};const saved=await h.command('rules.pack',pack);await h.command('rules.activate',{packId:saved.id,consent:'REVIEWED'})
  await h.command('payment.policy',{tenancyId:t.id,version:0,terms:{stages,priority:[q.id]},reference:'synthetic-terrace-143'})
  await h.command('payment.record',{tenancyId:t.id,amount:'100.00',state:'pending',payerKind:'resident',method:'ach',receivedDate:'2026-10-03',reference:'synthetic-terrace-144 private pending reference'})
  await h.command('payment.record',{tenancyId:t.id,amount:'750.00',state:'settled',payerKind:'resident',method:'card',receivedDate:'2026-10-04',reference:'synthetic-terrace-145 private settled reference'})
  const residentMember=await h.command('household.add',{tenancyId:t.id,role:'co_tenant',name:'Statement resident',email:'statement-resident@example.test',contactBy:'email',joined:'2025-01-01'});await h.stepUp();const resident=await h.command('portal.invite',{kind:'resident',tenancyId:t.id,email:'statement-resident@example.test',displayName:'Statement resident',source:'synthetic-terrace-146 resident asked'}),as=await h.portalSignIn('statement-resident@example.test')
  const delegate=await h.command('portal.invite',{kind:'resident',access:'delegate',tenancyId:t.id,email:'statement-delegate@example.test',displayName:'Statement delegate',source:'synthetic-terrace-147 delegated balance view'}),delegated=await h.portalSignIn('statement-delegate@example.test')
  const path='/portal/statement?tenancyId='+t.id+'&month=2026-10',response=await h.request(path+'&format=json',{as});assert.equal(response.status,200);const d=await response.json()
  assert.deepEqual([d.currency,d.openingCents,d.closingCents,d.currentBalanceCents,d.pendingCents,d.unappliedCreditCents],['USD',0,10000,10000,10000,5000]);assert.equal(d.lines.filter(l=>l.kind==='Recorded external payment').reduce((n,l)=>n+l.amountCents,0),90000)
  const portal=await(await h.request('/portal/api/resident?tenancyId='+t.id,{as})).json();assert.equal(d.currentBalanceCents,portal.balanceCents)
  const html=await(await h.request(path,{as})).text(),csv=await(await h.request(path+'&format=csv',{as})).text()
  for(const body of [JSON.stringify(d),html,csv])for(const privateText of ['private-co@example.test','Synthetic private co-tenant','private bank reference','private pending reference','private charge reference'])assert.ok(!body.includes(privateText),'no private provider/household detail: '+privateText)
  assert.match(csv,/Closing receivable","100.00/);assert.match(csv,/Settled unapplied credit \(separate\)","50.00/);assert.ok(csv.includes('October rent – East'))
  const transaction='/portal/transaction?tenancyId='+t.id+'&id='+encodeURIComponent('receipt:'+r.id),source=await(await h.request(transaction+'&format=json',{as})).json();assert.deepEqual([source.transaction.amountCents,source.charge.dueDate,source.charge.currentBalanceCents],[20000,'2026-10-01',10000])
  assert.equal((await h.request(path,{as:''})).status,401);assert.equal((await h.request(path,{as:delegated})).status,404);assert.equal((await h.request(transaction,{as:delegated})).status,404)
  assert.equal((await h.request('/portal/statement?tenancyId='+t.id,{as:delegated})).status,200,'existing balance/charges CSV remains available to a delegate')
  const pdf=await h.request(path+'&format=pdf',{as});assert.equal(pdf.status,200);assert.equal(pdf.headers.get('content-type'),'application/pdf');assert.equal(pdf.headers.get('cache-control'),'private, no-store');assert.ok((await pdf.text()).startsWith('%PDF-1.7'))
  const old=await(await h.request('/portal/statement?tenancyId='+t.id+'&month=2026-09&format=json',{as})).json();assert.deepEqual([old.closingCents,old.pendingCents,old.unappliedCreditCents],[0,0,0])
  assert.equal((await h.request('/portal/statement?tenancyId=synthetic-terrace-unshared&month=2026-10',{as})).status,404)
  assert.equal((await h.request('/portal/transaction?tenancyId='+t.id+'&id=receipt:synthetic-terrace-unshared',{as})).status,404)
  const report=await(await h.request('/api/delinquency?tenancyId='+t.id+'&asOf=2026-10-04')).json();assert.deepEqual([report.rows[0].balanceCents,report.rows[0].pendingExternalCents],[10000,10000],'as-of staff report matches resident balance and external pending funds');assert.match(report.rows[0].pendingFunds,/Processor pending payments not recorded/,'recorded manual funds do not imply a processor workflow or settlement')
  const queue=async()=>{const response=await h.request('/api/resident-deliveries?tenancyId='+t.id);assert.equal(response.status,200);return response.json()}
  const data=await queue(),prepare={tenancyId:t.id,grantId:resident.grantId,kind:'statement',month:'2026-10',consentVersion:data.consentVersion,consent:'RESIDENT REQUESTED EMAIL',reference:'synthetic-terrace-151 resident requested private email links'}
  const member=await h.invite('member','statement-preparer@example.test');await h.command('resident.delivery.prepare',prepare,{as:member,status:403})
  await h.command('resident.delivery.prepare',{...prepare,grantId:delegate.grantId},{status:409})
  await h.command('resident.delivery.prepare',{...prepare,consent:'no'},{status:400})
  for(const [email,contactBy,joined] of [['no-statement@example.test','none','2025-01-01'],['future-statement@example.test','email','2026-11-01']]){
   await h.command('household.add',{tenancyId:t.id,role:'co_tenant',name:'Synthetic statement recipient',email,contactBy,joined})
   const grant=await h.command('portal.invite',{kind:'resident',tenancyId:t.id,email,displayName:'Synthetic statement recipient',source:'synthetic-terrace-159 test document access'});await h.portalSignIn(email)
   await h.command('resident.delivery.prepare',{...prepare,grantId:grant.grantId},{status:409})
  }
  const stale=await h.command('resident.delivery.prepare',prepare);await h.command('resident.delivery.prepare',prepare,{status:409})
  await h.command('rent.charge',{tenancyId:t.id,dueDate:'2026-10-05',amount:'1.00',description:'Reviewed extra charge',reference:'synthetic-terrace-152 reviewed correction'})
  await h.command('resident.delivery.send',{deliveryId:stale.id,fingerprint:stale.fingerprint,consent:'SEND PRIVATE LINK',reference:'synthetic-terrace-153 reviewed send'},{status:409})
  const receipt=await h.command('resident.delivery.prepare',{...prepare,kind:'receipt',transactionId:'receipt:'+r.id}),statement=await h.command('resident.delivery.prepare',prepare)
  const send=delivery=>h.command('resident.delivery.send',{deliveryId:delivery.id,fingerprint:delivery.fingerprint,consent:'SEND PRIVATE LINK',reference:'synthetic-terrace-154 exact send approved'})
  const messagesBefore=h.messages.length;assert.equal((await send(receipt)).emailOutcome,'accepted');assert.equal((await send(statement)).emailOutcome,'accepted');assert.equal(h.messages.length,messagesBefore+2)
  await send(receipt).then(()=>assert.fail('cannot resend accepted delivery'),error=>assert.match(error.message,/409|already claimed/))
  const sent=await queue(),row=id=>sent.deliveries.find(d=>d.id===id)
  const notify=async(delivery,type,eventId,recipient='statement-resident@example.test',signed=true)=>{
   const body={type,created_at:clock,data:{email_id:row(delivery.id).provider_id,to:[recipient]}},raw=JSON.stringify(body),stamp=String(Date.parse(clock)/1000),signature=createHmac('sha256',webhookBytes).update(eventId+'.'+stamp+'.'+raw).digest('base64')
   return h.request('/api/resident-mail/events',{method:'POST',as:'',body,headers:{'svix-id':eventId,'svix-timestamp':stamp,'svix-signature':'v1,'+(signed?signature:'invalid')}})
  }
  assert.equal((await notify(receipt,'email.delivered','synthetic-terrace-155','statement-resident@example.test',false)).status,400)
  assert.equal((await notify(receipt,'email.delivered','synthetic-terrace-156','another@example.test')).status,400)
  assert.equal((await notify(receipt,'email.delivered','synthetic-terrace-157')).status,200)
  assert.equal((await notify(statement,'email.bounced','synthetic-terrace-158')).status,200)
  await h.restart();assert.equal((await notify(receipt,'email.delivered','synthetic-terrace-157')).status,200,'replay after restart')
  const delivered=await queue();assert.deepEqual(delivered.deliveries.filter(d=>[receipt.id,statement.id].includes(d.id)).map(d=>[d.id,d.state,d.task_open]).sort(),[[receipt.id,'delivered',0],[statement.id,'bounced',1]].sort())
  const receiptPath='/portal/resident-document?id='+receipt.id,receiptData=await(await h.request(receiptPath+'&format=json',{as})).json()
  assert.deepEqual([receiptData.receipt.id,receiptData.receipt.amountCents,receiptData.delivery.state],['receipt:'+r.id,20000,'delivered'])
  assert.equal((await h.request(receiptPath,{as:delegated})).status,404);assert.equal((await h.request(receiptPath,{as:''})).status,401)
  assert.equal((await h.request('/api/resident-document?id='+receipt.id,{as:member})).status,403)
  const frozenPdf=await h.request(receiptPath+'&format=pdf',{as});assert.equal(frozenPdf.status,200)
  const current=await(await h.request(path+'&format=json',{as})).json(),matching=await(await h.request('/portal/api/resident?tenancyId='+t.id,{as})).json();assert.equal(current.currentBalanceCents,10100);assert.equal(current.currentBalanceCents,matching.balanceCents)
  const sourcePdf=Buffer.from(await frozenPdf.arrayBuffer());assert.ok(sourcePdf.includes(Buffer.from('/StructTreeRoot')));assert.ok(sourcePdf.includes(Buffer.from('/ActualText')))
  if(inspect)await inspect({h,t,as,delegated,transaction,receiptPath,statementId:statement.id,pdf:sourcePdf})
  if((await queue()).deliveries.find(d=>d.id===statement.id).task_open)await h.command('resident.delivery.followup',{deliveryId:statement.id,reference:'synthetic-terrace-160 owner contacted resident and reconciled the failure'})
  assert.equal((await notify(statement,'email.bounced','synthetic-terrace-158')).status,200);assert.equal((await queue()).deliveries.find(d=>d.id===statement.id).task_open,0,'callback replay cannot reopen a completed delivery task')
  await h.command('household.leave',{memberId:residentMember.id,left:'2026-10-25'});assert.equal((await h.request(receiptPath,{as})).status,404);assert.equal((await h.request(path,{as})).status,404)
  await h.command('portal.revoke',{grantId:resident.grantId,reason:'synthetic-terrace-148 access ended'})
  assert.equal((await h.request(path,{as})).status,401);assert.equal((await h.request(transaction,{as})).status,401);assert.equal((await h.request(receiptPath,{as})).status,401)
 }finally{await h.close()}
}
