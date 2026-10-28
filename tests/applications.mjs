import assert from 'node:assert/strict'
import {randomUUID,createHash} from 'node:crypto'
import {installation} from './api/harness.mjs'
import {syntheticPack} from './rule-packs.mjs'
import {applicationFeeProvider} from './application-fees.mjs'
export const applicantEmail=n=>['synthetic-terrace-'+n,'example.test'].join('@')
export async function applicationSetup(h){
 await h.stepUp()
 const f=await h.command('portfolio.add',{name:'Application portfolio'}),property=await h.command('property.add',{portfolioId:f.id,name:'Alder homes',address:'1840 Alder Street, Oakland, CA',kind:'multifamily',timeZone:'America/Los_Angeles'})
 const prospect=await h.command('prospect.add',{propertyId:property.id,name:'Synthetic household',email:applicantEmail(1),source:'phone',reference:'synthetic-terrace-1 requested an application'})
 const open={prospectId:prospect.id,version:1,adults:[{name:'Synthetic adult A',email:applicantEmail(1)},{name:'Synthetic adult B',email:applicantEmail(2)}],fee:'45.00',reference:'synthetic-terrace-1 reviewed fee and invitation authority',consent:'PREPARE APPLICATION'}
 return {f,property,prospect,open}
}
export async function activateApplicationPack(h,property){
 const pack=await h.command('rules.pack',syntheticPack('CA'))
 await h.command('rules.activate',{packId:pack.id,consent:'REVIEWED'})
 await h.command('property.rules',{propertyId:property.id,stateCode:'CA',overlays:[],version:0,reference:'synthetic-terrace-1 reviewed jurisdiction'})
 return pack
}
export async function applicantCookie(h,app,adult,n){
 await h.command('application.invite',{applicationId:app.id,adultId:adult.id,consent:'SEND LINK'})
 const mail=h.messages.findLast(m=>m.to.includes(applicantEmail(n))),token=mail.text.match(/\/apply\/accept\?token=([a-f0-9]+)/)?.[1]
 assert.ok(token,'Explicit invitation reaches mail provider edge')
 const accept=await h.request('/apply/accept',{method:'POST',as:'',form:new URLSearchParams({token})})
 assert.equal(accept.status,303,await accept.text())
 const cookie=accept.headers.getSetCookie().map(x=>x.split(';')[0]).join('; ')
 assert.match(accept.headers.get('set-cookie'),/HttpOnly; SameSite=Lax/)
 assert.equal((await h.request('/apply/accept',{method:'POST',as:'',form:new URLSearchParams({token})})).status,400,'one-time link cannot be replayed')
 return {cookie,token}
}
export const ownData=async(h,cookie)=>{const r=await h.request('/apply/api/application',{as:cookie});assert.equal(r.status,200,await r.clone().text());return r.json()}
export async function applicantPost(h,cookie,fields,status=200,path='/apply/api/application'){
 const form=new FormData();for(const[k,v]of Object.entries(fields))form.set(k,v)
 const r=await h.request(path,{method:'POST',as:cookie,form}),body=await r.json()
 assert.equal(r.status,status,JSON.stringify(body));return body
}
export const completeAnswers={identity:'Synthetic adult A; adult identity and contact reference synthetic-terrace-1',income:'Synthetic employer, 5200 USD monthly, verified by attached evidence',rentalHistory:'Synthetic prior home; 2023 to 2026; manager reference synthetic-terrace-3',references:'Synthetic reference, written contact authorization synthetic-terrace-4'}
const document=(text='Synthetic income evidence: 5200 USD monthly')=>new File([text],'income.txt',{type:'text/plain'})
export async function journey({assets=false,inspect}={}){
 const provider=applicationFeeProvider(),h=await installation({assets,now:'2026-10-28T12:00:00.000Z',stripeKey:'synthetic-terrace-1',stripeRequest:provider.stripeRequest})
 try{
  const setup=await applicationSetup(h),{f,property,prospect,open}=setup
  await h.command('application.open',open,{status:409})
  await activateApplicationPack(h,property)
  await h.command('application.open',{...open,consent:''},{status:400})
  const app=await h.command('application.open',open)
  assert.equal(app.adults.length,2)
  await h.command('application.open',open,{status:409})
  const staff={}
  for(const [name,role,scope]of [['manager','portfolio_manager',f.id],['outsider','portfolio_manager',(await h.command('portfolio.add',{name:'Other portfolio'})).id],['leasing','leasing',f.id]]){
   const email=applicantEmail(name);await h.command('operator.invite',{displayName:name,email,role,['portfolio:'+scope]:'1'});staff[name]=await h.accept(email)
  }
  await h.stepUp(applicantEmail('manager'),staff.manager)
  await h.stepUp(applicantEmail('outsider'),staff.outsider)
  assert.equal((await h.request('/api/applications',{as:staff.leasing})).status,403)
  assert.equal((await h.request('/api/applications?id='+app.id,{as:staff.outsider})).status,404)
  const a=await applicantCookie(h,app,app.adults[0],1),b=await applicantCookie(h,app,app.adults[1],2)
  assert.equal((await h.request('/api/applications',{as:a.cookie})).status,401,'applicant session grants no staff access')
  assert.equal((await h.request('/portal/api/threads',{as:a.cookie})).status,401,'applicant session grants no resident access')
  assert.equal((await h.request('/apply/api/application',{as:h.cookie})).status,401,'staff session cannot edit applicant answers')
  const foreign=new FormData();foreign.set('action','save');foreign.set('version','1')
  assert.equal((await h.request('/apply/api/application',{method:'POST',as:a.cookie,originHeader:'https://example.test',form:foreign})).status,403)
  let da=await ownData(h,a.cookie),db=await ownData(h,b.cookie)
  assert.equal(da.applicant.id,app.adults[0].id);assert.equal(db.applicant.id,app.adults[1].id)
  await applicantPost(h,a.cookie,{action:'save',version:1,identity:completeAnswers.identity,income:completeAnswers.income})
  await h.restart()
  da=await ownData(h,a.cookie);assert.equal(da.applicant.answers.income,completeAnswers.income,'adult A resumes a durable incomplete draft')
  assert.equal(da.applicant.answers.rentalHistory,'')
  await applicantPost(h,b.cookie,{action:'save',version:1,...completeAnswers,identity:'Synthetic adult B private identity',income:'Synthetic adult B income 6100 USD'})
  const priorCookie=b.cookie
  assert.equal((await h.request('/apply/signout',{method:'POST',as:priorCookie,form:new FormData()})).status,303)
  assert.equal((await h.request('/apply/api/application',{as:priorCookie})).status,401,'sign-out ends the old applicant session')
  await h.setTime('2026-10-28T12:02:00.000Z')
  assert.equal((await h.request('/apply/signin',{method:'POST',as:'',form:new URLSearchParams({email:applicantEmail(2)})})).status,202)
  const resumeToken=h.messages.findLast(m=>m.to.includes(applicantEmail(2))).text.match(/\/apply\/accept\?token=([a-f0-9]+)/)?.[1]
  assert.ok(resumeToken,'the applicant can request a fresh resume link without another staff invitation')
  const resumed=await h.request('/apply/accept',{method:'POST',as:'',form:new URLSearchParams({token:resumeToken})})
  assert.equal(resumed.status,303,await resumed.text())
  b.cookie=resumed.headers.getSetCookie().map(x=>x.split(';')[0]).join('; ')
  db=await ownData(h,b.cookie);assert.equal(db.applicant.answers.income,'Synthetic adult B income 6100 USD','adult B independently resumes saved answers')
  assert.equal((await h.request('/apply/api/application',{as:priorCookie})).status,401,'fresh sign-in does not revive the signed-out session')
  assert.ok(!JSON.stringify(da).includes('Synthetic adult B private identity'))
  await applicantPost(h,a.cookie,{action:'save',version:1,...completeAnswers},409)
  await applicantPost(h,a.cookie,{action:'submit',version:2,consent:'SUBMIT MY ANSWERS',disclosureHash:da.disclosureHash},400)
  await applicantPost(h,a.cookie,{action:'save',version:2,...completeAnswers})
  await applicantPost(h,a.cookie,{action:'submit',version:3,consent:'SUBMIT MY ANSWERS',disclosureHash:da.disclosureHash},409)
  await applicantPost(h,a.cookie,{action:'upload',version:3,purpose:'income',file:new File(['<script>alert(1)</script>'],'active.txt',{type:'text/plain'})},400)
  await applicantPost(h,a.cookie,{action:'upload',version:3,purpose:'income',file:document()})
  da=await ownData(h,a.cookie)
  const original=da.applicant.files[0]
  assert.equal(original.sha256,createHash('sha256').update('Synthetic income evidence: 5200 USD monthly').digest('hex'))
  const download=await h.request('/apply/file?id='+original.id,{as:a.cookie});assert.equal(download.status,200);assert.equal(await download.text(),'Synthetic income evidence: 5200 USD monthly');assert.match(download.headers.get('cache-control'),/private, no-store/)
  assert.equal((await h.request('/apply/file?id='+original.id,{as:b.cookie})).status,404,'co-applicant cannot fetch the other adult original')
  await applicantPost(h,a.cookie,{action:'submit',version:4,consent:'SUBMIT MY ANSWERS',disclosureHash:'wrong'},400)
  await applicantPost(h,a.cookie,{action:'submit',version:4,consent:'SUBMIT MY ANSWERS',disclosureHash:da.disclosureHash})
  await applicantPost(h,b.cookie,{action:'upload',version:2,purpose:'income',file:document('Synthetic adult B pay evidence')})
  await applicantPost(h,b.cookie,{action:'submit',version:3,consent:'SUBMIT MY ANSWERS',disclosureHash:db.disclosureHash})
  da=await ownData(h,a.cookie);db=await ownData(h,b.cookie)
  assert.equal(da.applicant.state,'submitted');assert.equal(db.applicant.state,'submitted')
  const frozenDisclosures=structuredClone(da.disclosures),frozenHash=da.disclosureHash
  assert.equal(frozenDisclosures.length,1)
  assert.equal(frozenDisclosures[0].code,'CA')
  assert.equal(frozenDisclosures[0].text,syntheticPack('CA').fields.leaseDisclosures.value.text)
  const replacement=syntheticPack('CA',2)
  replacement.fields.leaseDisclosures.value.text='Synthetic replacement disclosure for later applications; no legal review claimed'
  const published=await h.command('rules.pack',replacement)
  await h.command('rules.activate',{packId:published.id,consent:'REVIEWED'})
  for(const applicant of [a,b]){
   const current=await ownData(h,applicant.cookie)
   assert.deepEqual(current.disclosures,frozenDisclosures,'later pack publication cannot change the disclosures this adult accepted')
   assert.equal(current.disclosureHash,frozenHash)
   assert.equal(current.applicant.answers.disclosureConsent.hash,frozenHash,'submitted consent retains the original disclosed terms')
   const page=await(await h.request('/apply',{as:applicant.cookie})).text()
   assert.ok(page.includes(frozenDisclosures[0].text),'the applicant can still read the original disclosure')
   assert.ok(!page.includes(replacement.fields.leaseDisclosures.value.text),'replacement terms are not substituted into an existing application')
  }
  await applicantPost(h,a.cookie,{action:'save',version:5,...completeAnswers,income:'Silently overwritten'},409)
  await h.command('application.save',{applicationId:app.id,adultId:app.adults[0].id,income:'staff overwrite'},{status:404})
  assert.equal((await ownData(h,a.cookie)).applicant.answers.income,completeAnswers.income)
  const request={applicationId:app.id,adultId:app.adults[0].id,version:5,message:'Upload the second income statement'}
  await h.command('application.request',request,{as:staff.outsider,status:404})
  await h.command('application.request',request,{as:staff.leasing,status:403})
  const requested=await h.command('application.request',request,{as:staff.manager})
  da=await ownData(h,a.cookie);assert.equal(da.applicant.state,'changes_requested');assert.equal(da.applicant.requests[0].message,request.message)
  assert.equal((await ownData(h,b.cookie)).applicant.requests.length,0)
  await applicantPost(h,a.cookie,{action:'submit',version:6,consent:'SUBMIT MY ANSWERS',disclosureHash:da.disclosureHash},409)
  await applicantPost(h,b.cookie,{action:'upload',version:4,purpose:'requested',requestId:requested.id,file:document()},409)
  await applicantPost(h,a.cookie,{action:'upload',version:6,purpose:'requested',requestId:requested.id,file:document('Synthetic second income original')})
  await applicantPost(h,a.cookie,{action:'save',version:7,...completeAnswers,income:'Corrected employer income: 5400 USD monthly'})
  await applicantPost(h,a.cookie,{action:'submit',version:8,consent:'SUBMIT MY ANSWERS',disclosureHash:da.disclosureHash})
  let view=await(await h.request('/api/applications?id='+app.id,{as:staff.manager})).json(),adult=view.applications[0].adults[0]
  assert.equal(adult.answers.income,'Corrected employer income: 5400 USD monthly')
  assert.equal(adult.revisions.find(r=>r.version===5).answers.income,completeAnswers.income,'earlier submitted answer remains visible')
  assert.equal(adult.revisions.at(-1).state,'submitted');assert.equal(adult.files.length,2);assert.ok(adult.requests[0].resolved_at)
  const requestedOriginal=adult.files.find(file=>file.purpose==='requested')
  assert.equal(adult.requests[0].file_id,requestedOriginal.id,'the manager can trace the resolved request to its original')
  for(const [file,contents]of [[original,'Synthetic income evidence: 5200 USD monthly'],[requestedOriginal,'Synthetic second income original']]){
   const path='/api/application-file?id='+file.id
   const opened=await h.request(path,{as:staff.manager})
   assert.equal(opened.status,200,'the scoped manager opens the applicant original')
   assert.equal(await opened.text(),contents,'the requested evidence retains its original bytes')
   assert.match(opened.headers.get('cache-control'),/private, no-store/)
   assert.equal((await h.request(path,{as:staff.outsider})).status,404,'another portfolio cannot open applicant originals')
   assert.equal((await h.request(path,{as:staff.leasing})).status,403,'the current owner-only policy grants leasing no applicant custody')
  }
  const feePath='/apply/api/fee',key=randomUUID(),fee={requestKey:key,consent:'yes',consentVersion:'application-fee-1'}
  await applicantPost(h,a.cookie,{...fee,consent:''},400,feePath)
  provider.edge.uncertainNextCreate=true
  await applicantPost(h,a.cookie,fee,503,feePath)
  const pending=await ownData(h,a.cookie);assert.equal(pending.currentFee.requestKey,key,'uncertain creation retains original resumable key')
  await applicantPost(h,b.cookie,{...fee,requestKey:randomUUID()},409,feePath)
  const checkout=await applicantPost(h,a.cookie,fee,200,feePath)
  assert.match(checkout.checkoutUrl,/^https:\/\/checkout\.stripe\.com\//);assert.equal(provider.sessions.size,1,'uncertain retry uses one provider checkout')
  await h.request('/apply?returned=1&paid=true',{as:a.cookie})
  assert.equal((await ownData(h,a.cookie)).fees[0].state,'checkout','redirect cannot claim payment')
  const session=[...provider.sessions.values()][0],decline=provider.declined(session)
  assert.equal((await applicantPost(h,a.cookie,{action:'reconcile',eventId:decline.id},200,feePath)).state,'declined')
  const expired=provider.expired(session)
  assert.equal((await applicantPost(h,a.cookie,{action:'reconcile',eventId:expired.id},200,feePath)).state,'expired')
  await applicantPost(h,b.cookie,{...fee,requestKey:randomUUID()},200,feePath)
  const second=[...provider.sessions.values()][1],paid=provider.paid(second)
  const wrong=provider.event('checkout.session.completed',{...paid.data.object,amount_total:4501})
  await h.command('application.fee.reconcile',{applicationId:app.id,eventId:wrong.id},{as:staff.manager,status:409})
  const wrongCurrency=provider.event('checkout.session.completed',{...paid.data.object,currency:'eur'})
  await h.command('application.fee.reconcile',{applicationId:app.id,eventId:wrongCurrency.id},{as:staff.manager,status:409})
  const live=provider.event('checkout.session.completed',paid.data.object);live.livemode=true
  await h.command('application.fee.reconcile',{applicationId:app.id,eventId:live.id},{as:staff.manager,status:503})
  const intent=provider.intents.get(second.payment_intent),charge=provider.charges.get(intent.latest_charge)
  intent.amount_received=4499
  await h.command('application.fee.reconcile',{applicationId:app.id,eventId:paid.id},{as:staff.manager,status:409})
  intent.amount_received=4500;charge.refunded=true
  await h.command('application.fee.reconcile',{applicationId:app.id,eventId:paid.id},{as:staff.manager,status:409})
  charge.refunded=false
  assert.equal((await ownData(h,b.cookie)).fees.find(f=>f.checkout_id===second.id).state,'checkout','mismatched provider facts never mark the fee paid')
  const result=await h.command('application.fee.reconcile',{applicationId:app.id,eventId:paid.id},{as:staff.manager})
  assert.equal(result.state,'paid')
  assert.equal((await h.command('application.fee.reconcile',{applicationId:app.id,eventId:paid.id},{as:staff.manager})).replayed,true)
  await applicantPost(h,a.cookie,{...fee,requestKey:randomUUID()},409,feePath)
  view=await(await h.request('/api/applications?id='+app.id,{as:staff.manager})).json()
  assert.deepEqual(view.applications[0].fees.map(f=>f.state).sort(),['expired','paid']);assert.equal(view.applications[0].fees.find(f=>f.state==='paid').amount_cents,4500)
  assert.ok(!/payment_method_details|card_number|last4|client_secret|checkout_url/.test(JSON.stringify(view)),'staff has only safe fee outcome, never card objects or hosted secret')
  const markup=await(await h.request('/app?tab=applications',{as:staff.manager})).text();assert.ok(markup.includes('Corrected employer income: 5400 USD monthly'));assert.ok(markup.includes(completeAnswers.income));assert.ok(markup.includes('paid'))
  if(inspect)await inspect({h,app,a,b,staff,provider})
  await h.command('application.erase',{applicationId:app.id,reference:'synthetic-terrace-erasure'},{status:409})
  await h.command('prospect.erase',{prospectId:prospect.id,version:1,reason:'synthetic-terrace-erasure'},{status:409})
  await h.command('application.revoke',{applicationId:app.id,adultId:app.adults[0].id,reference:'synthetic-terrace-revocation'})
  assert.equal((await h.request('/apply/api/application',{as:a.cookie})).status,401)
  await applicantPost(h,a.cookie,fee,401,feePath)
  assert.equal((await h.request('/apply/file?id='+original.id,{as:a.cookie})).status,303)
  assert.equal((await h.request('/apply/accept',{method:'POST',as:'',form:new URLSearchParams({token:a.token})})).status,400)
  await applicationRecovery(h,app,b,provider,paid)
 }finally{await h.close()}
}

async function applicationRecovery(h,app,b,provider,paid){
 const archive=await(await h.request('/api/backup')).text(),manifest=JSON.parse(archive.split('\n')[0])
 for(const name of ['tt_application_access','tt_application_links','tt_application_sessions','tt_application_fee_links'])assert.ok(!manifest.tables.some(t=>t.name===name),'installation-local applicant authority is excluded: '+name)
 for(const name of ['tt_applications','tt_application_adults','tt_application_revisions','tt_application_files','tt_application_fees'])assert.ok(manifest.tables.some(t=>t.name===name),'application evidence is portable: '+name)
 const restored=await installation({now:'2035-10-28T12:00:00.000Z',stripeKey:'synthetic-terrace-1',stripeRequest:provider.stripeRequest})
 try{
  await restored.formCommand('data.restore',{confirm:'RESTORE',backup:new File([archive],'application.rer')})
  assert.equal((await restored.request('/apply/api/application',{as:b.cookie})).status,401,'source session grants no restored access')
  const messages=restored.messages.length
  assert.equal((await restored.request('/apply/signin',{method:'POST',as:'',form:new URLSearchParams({email:applicantEmail(2)})})).status,202)
  assert.equal(restored.messages.length,messages,'archived email is evidence, never restored sign-in authority')
  await restored.stepUp()
  const read=await(await restored.request('/api/applications?id='+app.id)).json()
  const adult=read.applications[0].adults.find(a=>a.id===app.adults[0].id)
  assert.equal(adult.answers.income,'Corrected employer income: 5400 USD monthly');assert.equal(adult.files.length,2)
  assert.equal(adult.revisions.find(r=>r.version===5).answers.income,completeAnswers.income)
  const fresh=await applicantCookie(restored,app,app.adults[1],2)
  const data=await ownData(restored,fresh.cookie);assert.equal(data.currentFee,null);assert.ok(data.fees.some(f=>f.state==='paid'))
  await applicantPost(restored,fresh.cookie,{requestKey:randomUUID(),consent:'yes',consentVersion:'application-fee-1'},409,'/apply/api/fee')
  await restored.command('application.fee.reconcile',{applicationId:app.id,eventId:paid.id},{status:409})
  await restored.command('application.hold',{applicationId:app.id,action:'hold',reference:'synthetic-terrace-legal-hold'})
  await restored.command('application.erase',{applicationId:app.id,reference:'synthetic-terrace-erasure-request'},{status:409})
  await restored.command('application.hold',{applicationId:app.id,action:'release',reference:'synthetic-terrace-reviewed-release'})
  await restored.command('application.erase',{applicationId:app.id,reference:'synthetic-terrace-erasure-request'})
  assert.equal((await restored.request('/apply/api/application',{as:fresh.cookie})).status,401,'erasure ends every applicant session')
  const erasedAudit=await(await restored.request('/api/history?action=application.open')).json()
  assert.ok(erasedAudit.rows.length>0);assert.equal(erasedAudit.rows[0].subject,app.id);assert.equal(erasedAudit.rows[0].source,null)
  assert.equal((await restored.request('/api/application-file?id='+adult.files[0].id)).status,404,'erased originals cannot be fetched')
  await restored.command('application.fee.reconcile',{applicationId:app.id,eventId:paid.id},{status:404})
  const later=await(await restored.request('/api/backup')).text()
  const empty=await installation({now:'2035-10-28T12:00:00.000Z'})
  try{
   const refused=await empty.formCommand('data.restore',{confirm:'RESTORE',backup:new File([archive],'older.rer'),journal:new File([later],'later.rer')},{status:409})
   assert.equal(refused.error,'erasure_fence','later journal refuses resurrection from the older archive')
  }finally{await empty.close()}
 }finally{await restored.close()}
}
