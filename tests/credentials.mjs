// OPS-001: a read-only accountant and a prepare-only agent credential traverse paginated records inside their
// portfolios, retry an idempotent work proposal, and are refused approval, money, access and out-of-portfolio reads.
import assert from 'node:assert/strict'
import {installation,tenancyInput} from './api/harness.mjs'

const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jz1sAAAAASUVORK5CYII=','base64')
export async function journey({assets=false,inspect}={}) {
 const h=await installation({assets})
 try {
  const place=async(name,units)=>{const f=await h.command('portfolio.add',{name}),p=await h.command('property.add',{portfolioId:f.id,name:name+' House',address:`1 ${name} Road, Oakland, CA 94607`,kind:'multifamily',timeZone:'America/Los_Angeles'}),t=[]
   for(const [i,letter] of [...units].entries()){const u=await h.command('unit.add',{propertyId:p.id,identifier:letter,bedrooms:'2',bathrooms:'1'});t.push(await h.command('tenancy.create',{...tenancyInput,unitId:u.id,tenantName:`${name} resident ${letter}`,tenantEmail:`${name.toLowerCase()}${letter}@example.test`,startDate:'2026-09-01',endDate:'2027-08-31',rent:'1500',cadence:'monthly'}))}
   return {f,p,t}}
  const north=await place('North','AB'),south=await place('South','C')
  const charge=await h.command('rent.charge',{tenancyId:north.t[0].id,dueDate:'2026-09-01',amount:'1500',description:'September rent',reference:'NORTH-SEP'})
  await h.command('rent.receipt',{chargeId:charge.id,amount:'600',receivedDate:'2026-09-03',reference:'NORTH-CHECK'})
  const holder=async(place,name)=>{const o=await h.command('owner.add',{kind:'individual',legalName:name,email:name.toLowerCase().replace(' ','-')+'@example.test',mailingAddress:'1 Owner Way, Oakland, CA 94607'});await h.command('ownership.set',{propertyId:place.p.id,effectiveFrom:'2026-01-01',reason:'Deed',['share:'+o.id]:'100'});return o}
  const northOwner=await holder(north,'North Owner');await holder(south,'South Owner')
  const photoFor=async t=>{const i=await h.command('inspection.create',{tenancyId:t.id,date:'2026-09-01',notes:'Move-in'});return h.formCommand('inspection.photo',{inspectionId:i.id,version:'1',file:new File([png],t.id.slice(0,6)+'.png',{type:'image/png'})}),i}
  const northInspection=await photoFor(north.t[0]);await photoFor(south.t[0])
  const vendor=await h.command('vendor.add',{name:'Plumber',email:'plumber@example.test',phone:'510-555-0144',specialties:'plumbing',serviceAreas:'Oakland',w9:'received',insuranceExpires:'2036-12-31',licenseNumber:'P-1',licenseExpires:'2036-12-31',availability:'Agreed externally',rate:'95.00',standing:'approved'})
  const manager=await h.invite('admin','credential-manager@example.test')

  // Minting needs the owner and Base's fresh email-link proof; every input is checked.
  const mint=(p,opts={})=>h.command('credential.mint',p,opts),reach={['portfolio:'+north.f.id]:'1'}
  assert.equal((await mint({label:'Accountant',role:'accountant',scope:'read',...reach},{status:403})).error,'step_up_required')
  await h.stepUp()
  assert.equal((await mint({label:'Accountant',role:'accountant',scope:'read',...reach},{as:manager,status:403})).error,'forbidden')
  assert.equal((await mint({label:'x',role:'accountant',scope:'write',...reach},{status:400})).error,'scope')
  assert.equal((await mint({label:'x',role:'accountant',scope:'read'},{status:400})).error,'portfolios')
  assert.equal((await mint({label:'x',role:'owner',scope:'read',...reach},{status:400})).error,'role')
  const accountant=await mint({label:'Accountant feed',role:'accountant',scope:'read',...reach}),agent=await mint({label:'Repairs agent',role:'member',scope:'prepare',...reach}),leasing=await mint({label:'Leasing agent',role:'leasing',scope:'prepare',...reach})
  assert.match(accountant.token,/^ttk_[A-Za-z0-9_-]{43}$/)
  const page=await(await h.request('/app?tab=settings')).text()
  assert.ok(page.includes('Accountant feed')&&page.includes('Repairs agent')&&!page.includes(accountant.token)&&!page.includes(agent.token),'the list names credentials and never repeats a token')

  const call=(cred,path,{method='GET',body,key,headers={}}={})=>h.request(path,{method,as:'',body,headers:{authorization:'Bearer '+cred.token,...(key?{'idempotency-key':key}:{}),...headers}})
  const get=async(cred,path,status=200)=>{const r=await call(cred,path);assert.equal(r.status,status,path+' '+await r.clone().text());return r.json()}
  const post=async(cred,body,status,key)=>{const r=await call(cred,'/api/commands',{method:'POST',body,key});const b=await r.json();assert.equal(r.status,status,JSON.stringify(b));return {...b,replay:r.headers.get('idempotent-replay')}}

  // Unknown, malformed or cookie-only callers are not credentials.
  assert.equal((await h.request('/api/v1/leases',{as:'',headers:{authorization:'Bearer ttk_'+'A'.repeat(43)}})).status,401)
  assert.equal((await h.request('/api/v1/leases',{as:'',headers:{authorization:'Basic abc'}})).status,401)

  // The read-only accountant traverses paginated records in North only; South answers 404 and nothing leaks into pages.
  const ids=[];let cursor=null,pages=0
  do{const r=await get(accountant,'/api/v1/leases?limit=1'+(cursor?'&cursor='+cursor:''));assert.ok(r.data.length<=1);ids.push(...r.data.map(x=>x.id));cursor=r.next;pages++}while(cursor)
  assert.deepEqual(ids.sort(),north.t.map(t=>t.id).sort());assert.equal(pages,2)
  assert.equal((await get(accountant,'/api/v1/leases?limit=200')).next,null)
  await get(accountant,'/api/v1/leases/'+south.t[0].id,404);await get(accountant,'/api/state?tenancy='+south.t[0].id,404);await get(accountant,'/api/v1/ledgers/'+south.t[0].id,404)
  assert.deepEqual((await get(accountant,'/api/v1/properties')).data.map(p=>p.id),[north.p.id])
  const ledger=(await get(accountant,'/api/v1/ledgers/'+north.t[0].id)).data;assert.equal(ledger.balanceCents,90000);assert.equal(ledger.receipts.length,1)
  assert.deepEqual((await get(accountant,'/api/v1/households?limit=5')).data.map(x=>x.tenancyId).sort(),north.t.map(t=>t.id).sort())
  const docs=(await get(accountant,'/api/v1/documents')).data;assert.equal(docs.length,1);assert.equal(docs[0].kind,'inspection_photo');assert.match(docs[0].sha256,/^[0-9a-f]{64}$/)
  assert.equal((await call(accountant,docs[0].href)).status,200)
  const owners=(await get(accountant,'/api/v1/owner-ledgers?from=2026-09-01&to=2026-09-30')).data;assert.deepEqual(owners.map(o=>o.owner.id),[northOwner.id]);assert.equal(owners[0].rows.reduce((n,r)=>n+r.allocatedCents,0),60000)
  assert.equal((await call(accountant,'/api/v1/owner-ledgers')).status,400,'a statement period is required')
  assert.ok((await get(accountant,'/api/v1/reports')).data.some(r=>r.id==='rent-roll'));assert.equal((await get(accountant,'/api/rent-roll?asOf=2026-09-30')).asOf,'2026-09-30')
  for(const bad of ['limit=0','limit=201','limit=x','cursor=%25%25']) assert.ok([400].includes((await call(accountant,'/api/v1/leases?'+bad)).status),bad)
  await get(accountant,'/api/v1/nothing',404)
  // A read-only credential and a role without the capability are both refused where it matters.
  assert.deepEqual((await get(accountant,'/api/commands')).commands,[])
  assert.equal((await post(accountant,{command:'maintenance.prepare',tenancyId:north.t[0].id,title:'x',vendorId:vendor.id,trade:'plumbing',dueDate:'2027-01-01',estimate:'10'},403,'read-only-0001')).error,'credential_scope')
  assert.equal((await post(accountant,{command:'rent.receipt',chargeId:charge.id,amount:'900',receivedDate:'2026-09-05',reference:'AGENT-PAY'},403,'money-0000001')).error,'credential_scope')
  assert.equal((await get(leasing,'/api/v1/ledgers',403)).error,'forbidden')
  for(const path of ['/app?tab=ledger','/app']) assert.equal((await call(accountant,path)).status,403,'credentials never open the web app')
  for(const path of ['/api/backup','/api/readable-export']) assert.equal((await get(accountant,path,403)).error,'credential_scope')

  // The prepare-only agent proposes work once however often it retries, and can never approve it.
  const job={command:'maintenance.prepare',tenancyId:north.t[0].id,title:'Leaking tap',vendorId:vendor.id,trade:'plumbing',dueDate:'2027-01-15',estimate:'180.00'}
  assert.equal((await post(agent,job,400)).error,'idempotency_key_required')
  assert.equal((await post(agent,{...job,tenancyId:south.t[0].id},404,'agent-south-0001')).error,'not_found')
  const first=await post(agent,job,200,'agent-tap-0001'),again=await post(agent,job,200,'agent-tap-0001')
  assert.equal(first.replay,null);assert.equal(again.replay,'true');assert.equal(again.result.id,first.result.id)
  assert.equal((await post(agent,{...job,estimate:'181.00'},422,'agent-tap-0001')).error,'idempotency_conflict')
  assert.deepEqual((await get(agent,'/api/v1/work')).data.map(j=>j.id),[first.result.id])
  assert.equal((await post(agent,{command:'maintenance.approve',jobId:first.result.id,version:1},403,'agent-approve-01')).error,'credential_cannot_approve')
  assert.equal((await post(agent,{command:'proposal.approve',proposalId:'x'},403,'agent-approve-02')).error,'credential_cannot_approve')
  for(const command of ['charges.post','rent.charge','operator.role','credential.mint','factor.verify']) assert.equal((await post(agent,{command,month:'2026-09'},403,'agent-scope-'+command)).error,'credential_scope',command)
  assert.equal((await post(leasing,job,403,'leasing-tap-0001')).error,'forbidden')
  assert.equal((await post(agent,{command:'nothing.here'},404,'agent-unknown-01')).error,'unknown_command')
  assert.equal((await get(agent,'/api/v1/ledgers')).data.length,2,'a member role reads the ledger in its own portfolio')
  // The agent's proposal is a person's to approve; the history names the credential, its role version and scope.
  await h.command('maintenance.approve',{jobId:first.result.id,version:1})
  const trail=(await(await h.request('/api/history')).json()).rows,row=trail.find(x=>x.action==='maintenance.prepare'&&x.subject===first.result.id)
  assert.equal(row.actorName,'Repairs agent (API credential)');assert.equal(row.policy,'member v1 via API credential (prepare)');assert.equal(row.role,'member')
  assert.ok(trail.some(x=>x.action==='credential.mint'),'minting is in the history, with no token')
  assert.ok(!JSON.stringify(trail).includes(agent.token)&&!JSON.stringify(trail).includes(accountant.token))

  // A real database failure after the proposal commits must never make the key runnable again.
  const db=await h.mf.getD1Database('DB'), interrupted={...job,title:'synthetic-terrace-35 interrupted proposal'}, interruptedKey='synthetic-terrace-35'
  await db.exec("CREATE TRIGGER synthetic_response_failure BEFORE UPDATE OF state ON tt_api_idempotency WHEN NEW.state='done' BEGIN SELECT RAISE(ABORT,'synthetic response persistence failure'); END")
  const failed=await post(agent,interrupted,400,interruptedKey)
  assert.equal(failed.error,'operation_failed')
  await db.exec('DROP TRIGGER synthetic_response_failure')
  const committed=(await get(agent,'/api/v1/work')).data.filter(j=>j.title===interrupted.title)
  assert.equal(committed.length,1,'the proposal committed before response persistence failed')
  assert.equal((await post(agent,interrupted,409,interruptedKey)).error,'idempotency_in_progress')
  assert.equal((await post(agent,{...interrupted,estimate:'181.00'},422,interruptedKey)).error,'idempotency_conflict')
  await h.restart()
  assert.equal((await post(agent,interrupted,409,interruptedKey)).error,'idempotency_in_progress','restart retains the uncertain key')
  assert.equal((await get(agent,'/api/v1/work')).data.filter(j=>j.title===interrupted.title).length,1,'retry creates no second proposal')
  const recovered=(await(await h.request('/api/history')).json()).rows.filter(r=>r.action==='maintenance.prepare'&&r.subject===committed[0].id)
  assert.equal(recovered.length,1,'one committed proposal has one attributable history event')
  await inspect?.({h,jobId:committed[0].id})

  // Rotation, revocation and archives: the old token stops at once, and credentials are never archived.
  const rotated=await h.command('credential.rotate',{credentialId:agent.id})
  assert.equal((await call(agent,'/api/v1/work')).status,401);await get(rotated,'/api/v1/work')
  await h.command('credential.revoke',{credentialId:accountant.id});assert.equal((await call(accountant,'/api/v1/leases')).status,401)
  assert.equal((await h.command('credential.rotate',{credentialId:accountant.id},{status:409})).error,'revoked')
  const bytes=Buffer.from(await(await h.request('/api/readable-export')).arrayBuffer()),names=[]
  for(let o=0;bytes.readUInt32LE(o)===0x04034b50;){const n=bytes.readUInt16LE(o+26),x=bytes.readUInt16LE(o+28),size=bytes.readUInt32LE(o+18);names.push(bytes.subarray(o+30,o+30+n).toString());o+=30+n+x+size}
  assert.ok(names.includes('tables/tt_maintenance_jobs.csv')&&!names.some(n=>/api_credential|api_idempotency/.test(n)),'credentials and their token hashes stay out of exports')
  assert.ok(northInspection.id)
 } finally { await h.close() }
}
