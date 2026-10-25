import assert from 'node:assert/strict'
import {installation,tenancyInput} from './api/harness.mjs'
export async function journey({inspect,assets=false}={}) {
 const r=await installation({assets})
 try {
  const f=await r.command('portfolio.add',{name:'Synthetic North'}),south=await r.command('portfolio.add',{name:'Synthetic South'}),p=await r.command('property.add',{portfolioId:f.id,name:'Alder House',address:tenancyInput.address,kind:'duplex',timeZone:'America/Los_Angeles'}),u=await r.command('unit.add',{propertyId:p.id,identifier:'1C',bedrooms:'2',bathrooms:'1'}),t=await r.command('tenancy.create',{...tenancyInput,unitId:u.id})
  await r.stepUp()
  const staff={}
  for(const [key,role,portfolioId] of [['manager','portfolio_manager',f.id],['south','portfolio_manager',south.id],['member','member',f.id]]) {
   await r.command('operator.invite',{displayName:key,email:key+'@example.test',role,portfolioIds:[portfolioId]});staff[key]=await r.accept(key+'@example.test')
  }
  const owner=await r.command('owner.add',{kind:'individual',legalName:'Rowan Ellis',email:'rowan@example.test',mailingAddress:'Synthetic owner address'})
  await r.command('ownership.set',{propertyId:p.id,effectiveFrom:'2000-01-01',reason:'Synthetic current ownership',shares:[{ownerId:owner.id,percent:'100'}]})
  const resident=await r.command('portal.invite',{kind:'resident',tenancyId:t.id,email:'alex@example.test',displayName:'Alex Chen',source:'Synthetic resident consent'}),residentCookie=await r.portalSignIn('alex@example.test')
  const ownerGrant=await r.command('portal.invite',{kind:'owner',ownerId:owner.id,email:'rowan@example.test',displayName:'Rowan Ellis',source:'Synthetic owner consent'}),ownerCookie=await r.portalSignIn('rowan@example.test')
  const create=(extra={},opts={})=>r.command('request.create',{tenancyId:t.id,grantId:resident.grantId,action:'upload',title:'Insurance evidence',instructions:'Upload the current insurance original.',...extra},opts)
  const req=await create(),data=async id=>(await(await r.request('/api/requests?id='+id)).json()).requests[0]
  const mutate=async(command,id,extra={},opts={})=>r.command('request.'+command,{requestId:id,version:(await data(id)).version,reference:'Synthetic explicit review',consent:'SEND LINK',...extra},opts)
  const token=()=>{const m=r.messages.findLast(m=>(m.text??'').includes('/portal/request?token='));assert.ok(m);return m.text.match(/token=([a-f0-9]+)/)[1]}
  const path=tok=>'/portal/request?token='+tok
  const submit=async(tok,fields={},as=residentCookie)=>{const form=new FormData();for(const [k,v] of Object.entries({token:tok,name:'Alex Chen',consent:'I AGREE',...fields}))form.set(k,v);return r.request('/portal/request',{method:'POST',as,form})}
  for(const url of ['/api/requests','/app?tab=requests'])assert.equal((await r.request(url,{as:''})).status,url.startsWith('/api')?401:303)
  for(const url of ['/api/requests?id='+req.id,'/app?tab=requests&tenancy='+t.id]){
   assert.equal((await r.request(url,{as:staff.south})).status,404)
   assert.equal((await r.request(url,{as:staff.member})).status,403)
  }
  await create({}, {as:staff.member,status:403});await r.stepUp('south@example.test',staff.south);await create({}, {as:staff.south,status:404})
  await r.stepUp('manager@example.test',staff.manager)
  await r.command('request.expire',{requestId:req.id,version:1,reference:'Out of scope'},{as:staff.south,status:404})
  await r.command('request.expire',{requestId:req.id,version:1,reference:'Wrong role'},{as:staff.member,status:403})
  assert.equal((await r.request(path('synthetic-terrace-1'),{as:residentCookie})).status,404)
  const sent=await mutate('replace',req.id);assert.equal(sent.emailOutcome,'accepted');const old=token()
  assert.ok(!JSON.stringify(await data(req.id)).includes(old),'Staff listing contains no bearer link')
  assert.equal((await r.request(path(old),{as:ownerCookie})).status,404,'A valid token never changes its recipient')
  assert.equal((await r.request(path(old),{as:residentCookie})).status,200)
  assert.equal((await data(req.id)).state,'open','Opening never completes an action')
  await mutate('expire',req.id);assert.equal((await r.request(path(old),{as:residentCookie})).status,404)
  await mutate('replace',req.id);const replacement=token();assert.notEqual(replacement,old)
  assert.equal((await r.request(path(old),{as:residentCookie})).status,404)
  assert.equal((await submit(replacement,{name:'Someone Else',file:new File(['Synthetic insurance'],'policy.txt',{type:'text/plain'})})).status,400)
  assert.equal((await submit(replacement,{consent:'',file:new File(['Synthetic insurance'],'policy.txt',{type:'text/plain'})})).status,400)
  assert.equal((await submit(replacement,{file:new File(['<script>bad</script>'],'policy.txt',{type:'text/plain'})})).status,422)
  assert.equal((await data(req.id)).state,'open','A refused original cannot complete the request')
  await inspect?.({phase:'open',r,t,staff,residentCookie,ownerCookie,path:path(replacement),requestId:req.id})
  const bytes='Synthetic insurance policy 2026-10-25'
  const answers=await Promise.all([submit(replacement,{file:new File([bytes],'policy.txt',{type:'text/plain'})}),submit(replacement,{file:new File([bytes],'policy.txt',{type:'text/plain'})})])
  assert.equal(answers.filter(x=>x.status===200).length,1,'One concurrent upload wins; statuses: '+answers.map(x=>x.status).join(','))
  assert.equal(answers.filter(x=>x.status===409).length,1)
  let uploaded=await data(req.id);assert.equal(uploaded.state,'submitted');assert.equal(uploaded.missing,true)
  const result=JSON.parse(uploaded.result);assert.equal(result.name,'Alex Chen');assert.equal(await(await r.request('/api/document?id='+result.versionId)).text(),bytes)
  await mutate('remind',req.id);assert.equal((await data(req.id)).events.filter(x=>x.kind==='reminder').length,1,'Reminders remain possible until validation')
  await mutate('validate',req.id,{sha256:'synthetic-terrace-2'},{status:409})
  await inspect?.({phase:'submitted',r,t,staff,residentCookie,requestId:req.id})
  await mutate('validate',req.id,{sha256:result.sha256})
  const completed=await data(req.id);assert.equal(completed.state,'completed');assert.equal(completed.missing,false);assert.ok(completed.completed_by)
  for(const action of ['replace','remind','expire','validate'])await mutate(action,req.id,{}, {status:409})
  await r.restart();assert.equal((await data(req.id)).state,'completed')
  const document=await r.formCommand('document.upload',{tenancyId:t.id,kind:'lease',title:'Agreement to sign',source:'Synthetic reviewed agreement',file:new File(['Synthetic agreement v1'],'agreement.txt',{type:'text/plain'})})
  const notice=await r.formCommand('document.upload',{tenancyId:t.id,kind:'notice',title:'Permitted informational notice',source:'Synthetic permitted notice',file:new File(['Synthetic informational notice'],'notice.txt',{type:'text/plain'})})
  for(const action of ['sign','acknowledge']){
   const source=action==='sign'?document:notice
   const a=await create({action,title:action==='sign'?'Agreement signature':'Permitted notice',documentVersionId:source.versionId,permitted:'PERMITTED'})
   await mutate('replace',a.id);const tok=token()
   assert.equal(await(await r.request(path(tok)+'&file=1',{as:residentCookie})).text(),action==='sign'?'Synthetic agreement v1':'Synthetic informational notice')
   await inspect?.({phase:action,r,t,staff,residentCookie,path:path(tok)})
   assert.equal((await submit(tok)).status,200)
   const saved=await data(a.id);assert.equal(saved.state,'completed');assert.equal(JSON.parse(saved.result).documentSha256,source.sha256);assert.ok(saved.completed_by.startsWith('portal:'))
   assert.equal((await submit(tok)).status,409)
  }
  const job=await r.command('maintenance.prepare',{tenancyId:t.id,title:'Repair kitchen valve',tradeName:'Synthetic plumber',tradeEmail:'plumber@example.test',trade:'plumbing',dueDate:'2026-11-01',estimate:'180.00'})
  const quote=await r.command('quote.add',{jobId:job.id,vendorName:'Synthetic plumber',vendorEmail:'plumber@example.test',scope:'Replace valve',availableDate:'2026-11-01',amount:'180.00'})
  const selected=await r.command('quote.select',{jobId:job.id,quoteId:quote.id,version:1})
  const q=await create({action:'quote',grantId:ownerGrant.grantId,jobId:job.id,title:'Owner quote approval'})
  await mutate('replace',q.id);const qt=token()
  await inspect?.({phase:'quote',r,t,staff,ownerCookie,path:path(qt)})
  assert.equal((await submit(qt,{name:'Rowan Ellis',decision:'approved'},residentCookie)).status,404)
  assert.equal((await submit(qt,{name:'Rowan Ellis',decision:'approved'},ownerCookie)).status,200)
  const approved=await data(q.id);assert.equal(approved.state,'completed');assert.equal(JSON.parse(approved.result).name,'Rowan Ellis');assert.equal(JSON.parse(approved.result).decision,'approved')
  const work=(await r.state(t.id)).work
  assert.ok(JSON.stringify(work).includes('Portal request '+q.id),'Quote decision reaches existing work authority')
  const stale=await create({action:'quote',grantId:ownerGrant.grantId,jobId:job.id,title:'Stale quote review'});await mutate('replace',stale.id);const st=token()
  await r.command('maintenance.revise',{jobId:job.id,version:selected.version,estimate:'200.00'})
  assert.equal((await submit(st,{name:'Rowan Ellis',decision:'approved'},ownerCookie)).status,409)
  const revoked=await create();await mutate('replace',revoked.id);const rt=token()
  await r.command('portal.revoke',{grantId:resident.grantId,reason:'Consent withdrawn'})
  assert.ok([303,401].includes((await r.request(path(rt),{as:residentCookie})).status))
  const archive=await(await r.request('/api/backup')).text(),manifest=JSON.parse(archive.split('\n')[0]);assert.ok(!manifest.tables.some(t=>t.name==='tt_action_links'),'Bearer links never leave the installation');assert.ok(manifest.tables.some(t=>t.name==='tt_action_requests'),'Operating completion evidence remains portable')
  const restored=await installation();try{await restored.formCommand('data.restore',{confirm:'RESTORE',backup:new File([archive],'backup.rer')});const saved=(await(await restored.request('/api/requests?id='+req.id)).json()).requests[0];assert.equal(saved.state,'completed');assert.equal(JSON.parse(saved.result).sha256,result.sha256);assert.ok(saved.events.some(x=>x.kind==='validated'));assert.equal((await restored.request(path(rt),{as:residentCookie})).status,303)}finally{await restored.close()}
  await inspect?.({phase:'completed',r,t,staff,requestId:req.id})
 } finally {await r.close()}
}
