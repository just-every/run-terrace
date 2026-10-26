// Run only with TEST credentials through the named-key injector. The public
// commands submit to Twilio's magic number; no handset or inbound is involved.
import assert from 'node:assert/strict'
import {installation,tenancyInput} from '../tests/api/harness.mjs'
const magic='+15005550006'
const {TWILIO_ACCOUNT_SID:accountSid,TWILIO_AUTH_TOKEN:authToken}=process.env
if(!accountSid||!authToken)throw Error('Inject the held Twilio TEST credential pair')
const statuses=[]
const h=await installation({now:'2026-10-26T18:00:00.000Z',asyncDatabase:true,twilio:{accountSid,authToken,from:magic,mode:'test'},twilioRequest:async request=>{
 const params=new URLSearchParams(await request.clone().text())
 assert.equal(params.get('From'),magic);assert.equal(params.get('To'),magic);assert.equal(params.has('StatusCallback'),false)
 const response=await fetch(request);statuses.push(response.status);return response
}})
try{
 const f=await h.command('portfolio.add',{name:'Sandbox safety'}),p=await h.command('property.add',{portfolioId:f.id,name:'Sandbox House',address:'1 Synthetic Terrace Road',kind:'duplex',timeZone:'America/Los_Angeles'}),u=await h.command('unit.add',{propertyId:p.id,identifier:'A',bedrooms:'1',bathrooms:'1'}),t=await h.command('tenancy.create',{...tenancyInput,unitId:u.id,timeZone:'America/Los_Angeles'})
 await h.stepUp()
 const send=async(contactId,channel,extra={})=>{const m=await h.command('message.prepare',{contactId,channel,body:'Terrace provider test.',...extra}),a=await h.command('message.approve',{messageId:m.id,version:m.version,consent:'APPROVE EXACT MESSAGE'}),sent=await h.command('message.send',{messageId:m.id,version:a.version});console.log(JSON.stringify({channel,publicDoor:'message.send',receiptStatus:statuses.at(-1),outcome:sent.messageOutcome,handsetContacted:false}));assert.equal(sent.messageOutcome,'accepted')}
 const r=await h.command('message.contact',{tenancyId:t.id,kind:'resident',subjectId:t.id,phone:magic,timeZone:'America/Los_Angeles',smsConsent:'granted',reference:'Synthetic test consent for approved magic number only'})
 await send(r.id,'sms')
 await h.command('operator.invite',{displayName:'Sandbox backup',email:'sandbox-backup@example.test',role:'portfolio_manager',['portfolio:'+f.id]:'1'});await h.accept('sandbox-backup@example.test')
 const people=await(await h.request('/auth/operators')).json(),owner=people.find(x=>x.email==='owner@example.test').id,backup=people.find(x=>x.email==='sandbox-backup@example.test').id
 await h.command('emergency.guidance',{risk:'gas',guidance:'Leave the property.',callInstruction:'Call 911 and the gas utility from a safe place.'});await h.command('emergency.oncall',{portfolioId:f.id,primaryId:owner,backupId:backup})
 const e=await h.command('emergency.report',{tenancyId:t.id,risk:'gas',emergency:'yes',channel:'phone',reporter:'Synthetic sandbox report',description:'Sandbox gas report'})
 const responder=await h.command('message.contact',{tenancyId:t.id,kind:'responder',subjectId:owner,phone:magic,timeZone:'America/Los_Angeles',voiceConsent:'granted',reference:'Synthetic test consent for magic-number voice only'})
 await send(responder.id,'voice',{purpose:'page',emergencyId:e.id})
 console.log(JSON.stringify({testCredentialsOnly:true,callbacksOriginated:false,realPagingProven:false}))
}finally{await h.close()}
