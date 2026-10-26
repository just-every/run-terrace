// Test portfolio only; credentials and the consenting QA mailbox come from the injector.
import assert from 'node:assert/strict'
import {installation,tenancyInput} from './api/harness.mjs'
const {MAIL_API_KEY,MAIL_FROM,TEST_MAIL_TO,MAILBOX_RECEIPT_URL,QA_INBOX_RECEIPT_TOKEN}=process.env
assert.ok(MAIL_API_KEY&&MAIL_FROM&&TEST_MAIL_TO&&MAILBOX_RECEIPT_URL&&QA_INBOX_RECEIPT_TOKEN,'Inject the held mail and QA reader configuration')
const accepted=new Map(),since=new Date().toISOString();let stage='installation',h
try{
 h=await installation({asyncDatabase:true,mailProvider:'sendgrid',mailFrom:MAIL_FROM,mailResponse:async(message,wire)=>{
  if(!message.subject.startsWith('Your Terrace payment receipt')&&!message.subject.startsWith('Your Terrace monthly statement'))return new Response(null,{status:202,headers:{'x-message-id':crypto.randomUUID()}})
  assert.deepEqual(message.to,[TEST_MAIL_TO],'only the consenting QA recipient')
  const response=await fetch('https://api.sendgrid.com/v3/mail/send',{method:'POST',headers:{authorization:'Bearer '+MAIL_API_KEY,'content-type':'application/json'},body:JSON.stringify(wire),signal:AbortSignal.timeout(20000)})
  accepted.set(message.deliveryId,response.headers.get('x-message-id'));if(response.body)await response.body.cancel();return new Response(null,{status:response.status,headers:{'x-message-id':response.headers.get('x-message-id')??''}})
 }})
 stage='test portfolio';const t=await h.command('tenancy.create',{...tenancyInput,tenantEmail:TEST_MAIL_TO,cadence:'monthly',rent:'1000.00'}),month=(await h.state(t.id)).ledger.today.slice(0,7),day=month+'-01'
 const charge=await h.command('rent.charge',{tenancyId:t.id,dueDate:day,amount:'1000.00',description:'Synthetic QA rent',reference:'synthetic-terrace-170'}),payment=await h.command('rent.receipt',{chargeId:charge.id,amount:'200.00',receivedDate:day,reference:'synthetic-terrace-171'})
 await h.stepUp();const grant=await h.command('portal.invite',{kind:'resident',tenancyId:t.id,email:TEST_MAIL_TO,displayName:'QA test resident',source:'synthetic-terrace-172 consented QA test'}),as=await h.portalSignIn(TEST_MAIL_TO)
 const data=await(await h.request('/api/resident-deliveries?tenancyId='+t.id)).json(),document=await h.command('resident.delivery.prepare',{tenancyId:t.id,grantId:grant.grantId,kind:'receipt',month,transactionId:'receipt:'+payment.id,consentVersion:data.consentVersion,consent:'RESIDENT REQUESTED EMAIL',reference:'synthetic-terrace-173 consenting QA receipt proof'})
 stage='provider send';const sent=await h.command('resident.delivery.send',{deliveryId:document.id,fingerprint:document.fingerprint,consent:'SEND PRIVATE LINK',reference:'synthetic-terrace-174 owner-approved QA send'});assert.equal(sent.emailOutcome,'accepted');assert.ok(accepted.get(document.id))
 stage='mailbox receipt';const base=new URL(MAILBOX_RECEIPT_URL);assert.equal(base.protocol,'https:')
 const read=async url=>{assert.equal(url.origin,base.origin);const r=await fetch(url,{headers:{authorization:'Bearer '+QA_INBOX_RECEIPT_TOKEN},redirect:'manual',signal:AbortSignal.timeout(15000)});assert.equal(r.status,200);return r}
 let receipt
 for(let i=0;i<24&&!receipt;i++){
  const url=new URL(base);url.searchParams.set('to',TEST_MAIL_TO);url.searchParams.set('since',since);url.searchParams.set('limit','20')
  const list=await(await read(url)).json()
  for(const candidate of (list.receipts??[]).filter(r=>r.subject==='Your Terrace payment receipt is ready')){
   let body=candidate.excerpt??'';if(!body.includes(document.id)&&candidate.rawUrl)body=await(await read(new URL(candidate.rawUrl,base))).text()
   if(body.replace(/=\r?\n/g,'').replace(/=3D/g,'=').includes(document.id)){receipt=candidate;break}
  }
  if(!receipt)await new Promise(done=>setTimeout(done,5000))
 }
 assert.ok(receipt,'a real receipt with the exact private document link reached the QA inbox')
 stage='record delivered evidence';await h.command('resident.delivery.outcome',{deliveryId:document.id,outcome:'delivered',reference:'QA mailbox receipt '+receipt.id+'; SendGrid message '+accepted.get(document.id)})
 const viewed=await(await h.request('/portal/resident-document?id='+document.id+'&format=json',{as})).json();assert.equal(viewed.delivery.state,'delivered');assert.equal(viewed.receipt.amountCents,20000);assert.equal(viewed.currentBalanceCents,80000)
 console.log(JSON.stringify({journey:'PAY-010 real QA delivery',deliveryId:document.id,sendgridMessageId:accepted.get(document.id),mailboxReceiptId:receipt.id,receivedAt:receipt.receivedAt,receiptCents:20000,matchingBalanceCents:80000,outcomeSource:'owner recorded actual QA inbox evidence'}))
}catch{throw Error('Live resident receipt proof failed at '+stage)}finally{await h?.close()}
