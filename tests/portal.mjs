import {journey as residentRequests} from './portal-requests.mjs'
// ROLE-002: portal people (resident, delegated contact, joint owners, vendors) see only the record a live grant names;
// assignments, ownership dates and revocation apply on the next request and end the sessions they touch; invitations work
// once and expire within 7 days; the resident revokes their delegated contact; a restore carries no portal person.
// PORT-007: a vendor and an unrelated resident are denied every document door.
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {installation,tenancyInput} from './api/harness.mjs'
const pdf=n=>({name:'invoice-'+n+'.pdf',type:'application/pdf',base64:Buffer.from('%PDF-1.4\n'+n+'\n%%EOF').toString('base64')})
const SENTINELS=['SOUTH-SENTINEL','southres@example.test','Other Owner Sentinel','LANDLORD-SENTINEL','SCREEN-SENTINEL','LEASE-DOC-SENTINEL','987654321','Oakland Bank Sentinel']
export async function journey({inspect,revokeDelegate,assets=false}={}){
 await residentRequests()
 const r=await installation({assets})
 try{
  const zone='America/Los_Angeles',vendorFields={name:'River Plumbing',email:'river-contact@example.test',phone:'510-555-0190',specialties:'plumbing',serviceAreas:'Oakland',w9:'received',insuranceExpires:'2036-12-31',licenseNumber:'PL-240',licenseExpires:'2036-12-31',availability:'Weekdays',rate:'95',standing:'approved'}
  const nf=await r.command('portfolio.add',{name:'North'}),sf=await r.command('portfolio.add',{name:'South'})
  const np=await r.command('property.add',{portfolioId:nf.id,name:'North House',address:'1 North Road, Oakland, CA 94607',kind:'duplex',timeZone:zone}),sp=await r.command('property.add',{portfolioId:sf.id,name:'South House',address:'2 South Road, Oakland, CA 94607',kind:'duplex',timeZone:zone})
  const nu=await r.command('unit.add',{propertyId:np.id,identifier:'4B',bedrooms:2,bathrooms:1}),su=await r.command('unit.add',{propertyId:sp.id,identifier:'9Z',bedrooms:2,bathrooms:1})
  const north=await r.command('tenancy.create',{...tenancyInput,address:'Unit 4B, North Road, Oakland, CA',unitId:nu.id,tenantName:'North Resident',tenantEmail:'northres@example.test',ownerName:'LANDLORD-SENTINEL',ownerEmail:'landlord-sentinel@example.test',startDate:'2026-08-01',endDate:'2027-07-31',rent:'1000.00',cadence:'monthly'})
  const south=await r.command('tenancy.create',{...tenancyInput,address:'Unit 9Z, SOUTH-SENTINEL Road, Oakland, CA',unitId:su.id,tenantName:'South Person',tenantEmail:'southres@example.test',startDate:'2026-08-01',endDate:'2027-07-31',rent:'900.00',cadence:'monthly'})
  const owner=(name,email)=>r.command('owner.add',{kind:'individual',legalName:name,email,mailingAddress:'Owner mailing address'})
  const o1=await owner('Rowan Ellis','rowan@example.test'),o2=await owner('Sam Oakes','sam@example.test'),o3=await owner('Other Owner Sentinel','other-owner@example.test')
  await r.command('ownership.set',{propertyId:np.id,effectiveFrom:'2026-01-01',reason:'Original ownership',shares:[{ownerId:o1.id,percent:'50'},{ownerId:o2.id,percent:'50'}]})
  await r.command('ownership.set',{propertyId:sp.id,effectiveFrom:'2026-01-01',reason:'Original ownership',shares:[{ownerId:o3.id,percent:'100'}]})
  await r.command('agreement.set',{propertyId:np.id,starts:'2026-01-01',feePercent:'10',reserve:'0',reference:'North agreement'})
  for(const [t,amount,ref] of [[north,'1000.00','NORTH'],[south,'900.00','SOUTH-SENTINEL']])for(const [due,paid] of [['2026-09-01','2026-09-02'],['2026-10-01','2026-10-02']]){const q=await r.command('rent.charge',{tenancyId:t.id,dueDate:due,amount,description:'Rent '+due.slice(0,7),reference:ref+'-'+due});await r.command('rent.receipt',{chargeId:q.id,amount,receivedDate:paid,reference:ref+'-RCPT-'+paid})}
  const river=await r.command('vendor.add',vendorFields),bay=await r.command('vendor.add',{...vendorFields,name:'Bay Plumbing',email:'bay-contact@example.test'})
  const job=await r.command('maintenance.prepare',{tenancyId:north.id,title:'Kitchen valve',vendorId:river.id,trade:'plumbing',dueDate:'2026-11-20',estimate:'180.00'});await r.command('maintenance.approve',{jobId:job.id,version:1})
  const billFor=(vendorId,propertyId,n)=>r.command('bill.create',{vendorId,invoiceNumber:'INV-'+n,date:'2026-10-05',lines:[{description:'Repair',code:'repairs',amount:'100',tax:'0'}],allocations:[{propertyId,amount:'100'}],original:pdf(n)})
  const riverBill=await billFor(river.id,np.id,'RIVER-1'),bayBill=await billFor(bay.id,sp.id,'BAY-1')
  const screening=await r.formCommand('document.upload',{tenancyId:north.id,kind:'screening',title:'SCREEN-SENTINEL report',source:'Provider',file:new File([Buffer.from('SCREEN-SENTINEL applicant background')],'screening.txt',{type:'text/plain'})})
  await r.formCommand('document.upload',{tenancyId:north.id,kind:'lease',title:'LEASE-DOC-SENTINEL signed lease',source:'Office copy',file:new File([Buffer.from('LEASE-DOC-SENTINEL lease terms')],'lease.txt',{type:'text/plain'})})
  await r.stepUp();await r.command('company.save',{name:'Bay Homes',timeZone:zone,officeEmail:'office@example.test',officePhone:'510-555-0100',officeAddress:'1 Main Street, Oakland, CA'});await r.command('entity.add',{legalName:'Oakland Bank Sentinel LLC',ein:'987654321'})
  // Staff side: rights, scope and the fresh email-link proof.
  const staff={}
  for(const [key,role,fs] of [['southmanager','portfolio_manager',[sf]],['leasing','leasing',[nf]],['approver','portfolio_manager',[nf,sf]]]){await r.command('operator.invite',{displayName:key,email:key+'@example.test',role,...Object.fromEntries(fs.map(f=>['portfolio:'+f.id,'1']))});staff[key]=await r.accept(key+'@example.test')}
  const invite=(p,opts)=>r.command('portal.invite',{source:'Request by email 20 Oct',...p},opts)
  await invite({kind:'resident',tenancyId:north.id,email:'northres@example.test',displayName:'North Resident'},{as:staff.leasing,status:403})
  await invite({kind:'resident',tenancyId:north.id,email:'northres@example.test',displayName:'North Resident'},{as:staff.southmanager,status:404})
  await r.stepUp('southmanager@example.test',staff.southmanager)
  await invite({kind:'owner',ownerId:o1.id,email:'rowan@example.test',displayName:'Rowan'},{as:staff.southmanager,status:403})
  await invite({kind:'vendor',vendorId:river.id,email:'x@example.test',displayName:'X'},{as:staff.southmanager,status:403})
  const login=async email=>r.portalSignIn(email)
  await invite({kind:'resident',tenancyId:north.id,email:'northres@example.test',displayName:'North Resident'})
  await invite({kind:'resident',tenancyId:north.id,email:'delegate@example.test',displayName:'Delegate Contact',access:'delegate'})
  await invite({kind:'resident',tenancyId:south.id,email:'southres@example.test',displayName:'South Person'})
  await invite({kind:'owner',ownerId:o1.id,email:'rowan@example.test',displayName:'Rowan Ellis'});await invite({kind:'owner',ownerId:o2.id,email:'sam@example.test',displayName:'Sam Oakes'})
  await invite({kind:'vendor',vendorId:river.id,email:'river@example.test',displayName:'River Plumbing'});await invite({kind:'vendor',vendorId:bay.id,email:'bay@example.test',displayName:'Bay Plumbing'})
  await invite({kind:'resident',tenancyId:north.id,email:'northres@example.test',displayName:'North Resident'},{status:409})
  await invite({kind:'resident',tenancyId:north.id,email:'bad',displayName:'Bad'},{status:400})
  // A link opens a page, the single confirm sets the session, and it works once.
  const token=r.portalToken('northres@example.test'),page=await r.request('/portal/accept?token='+token,{as:''});assert.equal(page.status,200);assert.ok((await page.text()).includes('Continue'))
  assert.equal((await r.request('/portal/accept',{method:'POST',as:'',form:new URLSearchParams({token}),originHeader:'https://elsewhere.test'})).status,403)
  assert.equal((await r.request('/portal/accept',{method:'POST',as:'',form:new URLSearchParams({token:'0'.repeat(64)})})).status,400)
  const cookies={resident:await login('northres@example.test')};assert.match(cookies.resident,/^tt_portal=/)
  assert.equal((await r.request('/portal/accept',{method:'POST',as:'',form:new URLSearchParams({token})})).status,400,'a link works once')
  for(const [k,e] of [['delegate','delegate@example.test'],['south','southres@example.test'],['owner1','rowan@example.test'],['owner2','sam@example.test'],['vendor1','river@example.test'],['vendor2','bay@example.test']])cookies[k]=await login(e)
  // An invitation expires within 7 days: seven days on (the link's clock moved back in D1), an unused one is refused.
  const db=r.db,hashOf=t=>createHash('sha256').update(t).digest('hex')
  await invite({kind:'vendor',vendorId:bay.id,email:'stale@example.test',displayName:'Stale Vendor'})
  const staleToken=r.portalToken('stale@example.test'),link=await db.prepare('SELECT created_at,expires_at FROM tt_portal_links WHERE token_hash=?').bind(hashOf(staleToken)).first()
  assert.ok(Date.parse(link.expires_at)-Date.parse(link.created_at)<=7*864e5,'an invitation expires within 7 days')
  await db.prepare("UPDATE tt_portal_links SET created_at=strftime('%Y-%m-%dT%H:%M:%fZ',created_at,'-7 days'),expires_at=strftime('%Y-%m-%dT%H:%M:%fZ',expires_at,'-7 days') WHERE token_hash=?").bind(hashOf(staleToken)).run()
  assert.equal((await r.request('/portal/accept',{method:'POST',as:'',form:new URLSearchParams({token:staleToken})})).status,400,'seven days on, the unused invitation is refused')
  const again=async(k,email)=>{assert.equal((await r.request('/portal/signin',{method:'POST',as:'',form:new URLSearchParams({email})})).status,202);cookies[k]=await login(email)}
  const get=(k,path)=>r.request(path,{as:k===''?'':cookies[k]}),body=async(k,path)=>(await get(k,path)).text(),data=async(k,path)=>(await get(k,path)).json()
  await inspect?.({phase:'staff-portal',r,north,cookies})
  // Crawl every portal page, API and download a person can reach, and check nothing private to anyone else shows.
  const crawl=async k=>{
   const seen=new Map(),queue=['/portal','/portal/api/me']
   while(queue.length){const path=queue.shift();if(seen.has(path))continue;const res=await get(k,path),text=Buffer.from(await res.arrayBuffer()).toString('latin1');seen.set(path,{status:res.status,text,type:res.headers.get('content-type')})
    if((res.headers.get('content-type')??'').includes('html'))for(const m of text.matchAll(/href="(\/portal[^"]*)"/g))queue.push(m[1].replaceAll('&amp;','&'))
    if((res.headers.get('content-type')??'').includes('json'))for(const m of text.matchAll(/"url":"(\/portal[^"]*)"/g))queue.push(m[1])
    if(path==='/portal/api/me')for(const g of JSON.parse(text).grants){if(g.tenancyId)queue.push('/portal/api/resident?tenancyId='+g.tenancyId);if(g.ownerId)queue.push('/portal/api/owner','/portal/owner-statement?from=2026-01-01&to=2026-12-31&format=json');if(g.vendorId)queue.push('/portal/api/vendor')}}
   return seen
  }
  const private_=(k,extra=[])=>async seen=>{for(const [path,x] of seen){assert.equal(x.status,200,k+' '+path);for(const s of [...SENTINELS,...extra])assert.ok(!x.text.includes(s),`${k} ${path} must not show ${s}`)}}
  const pages={resident:await crawl('resident'),delegate:await crawl('delegate'),owner1:await crawl('owner1'),owner2:await crawl('owner2'),vendor1:await crawl('vendor1'),vendor2:await crawl('vendor2')}
  await private_('resident',['Sam Oakes','Rowan Ellis','River Plumbing'])(pages.resident);await private_('delegate',['Sam Oakes','Rowan Ellis'])(pages.delegate)
  await private_('owner1',['Sam Oakes','North Resident'])(pages.owner1);await private_('owner2',['Rowan Ellis'])(pages.owner2)
  await private_('vendor1',['BAY-1','North Resident','Sam Oakes','Rowan Ellis'])(pages.vendor1);await private_('vendor2',['RIVER-1','Kitchen valve'])(pages.vendor2)
  const resident=await data('resident','/portal/api/resident?tenancyId='+north.id);assert.equal(resident.balanceCents,0);assert.deepEqual(resident.charges.map(q=>q.amountCents),[100000,100000]);assert.equal(resident.tenancy.unit,'4B')
  assert.ok(pages.resident.get('/portal/statement?tenancyId='+north.id)?.text.includes('Rent 2026-09')||(await body('resident','/portal/statement?tenancyId='+north.id)).includes('Rent 2026-09'),'a resident downloads their own statement')
  const delegate=await data('delegate','/portal/api/resident?tenancyId='+north.id);assert.equal(delegate.tenancy.unit,undefined);assert.equal(delegate.tenancy.startDate,undefined);assert.equal(delegate.charges.length,2,'a delegated contact sees balance and charges only')
  assert.equal(delegate.receipts,undefined);assert.equal(delegate.adjustments,undefined);assert.equal(delegate.delegates,undefined);
  for(const path of ['/portal/lease?tenancy='+north.id,'/portal/statement?tenancyId='+north.id])assert.ok(!(await body('delegate',path)).includes('Recorded payment'),'a delegate has balance and charges without payment history on '+path);
  for(const path of ['/portal/api/resident?tenancyId='+south.id,'/portal/lease?tenancy='+south.id,'/portal/statement?tenancyId='+south.id,'/portal/api/owner','/portal/api/vendor','/portal/invoice-file?id=nonexistent'])assert.equal((await get('delegate',path)).status,404,'a delegate cannot reach another record: '+path);
  assert.deepEqual(resident.delegates.map(x=>x.name),['Delegate Contact'],'the resident sees who they share the account with')
  // Unrelated records are plain 404s on every portal door; staff doors and documents refuse portal people outright.
  for(const [k,paths] of Object.entries({resident:['/portal/api/resident?tenancyId='+south.id,'/portal/lease?tenancy='+south.id,'/portal/statement?tenancyId='+south.id,'/portal/api/owner','/portal/owner-statement','/portal/api/vendor','/portal/invoice-file?id='+riverBill.id],owner1:['/portal/api/resident?tenancyId='+north.id,'/portal/api/vendor'],vendor1:['/portal/api/resident?tenancyId='+north.id,'/portal/api/owner','/portal/owner-statement','/portal/invoice-file?id=nonexistent'],south:['/portal/api/resident?tenancyId='+north.id,'/portal/statement?tenancyId='+north.id]}))for(const path of paths)assert.equal((await get(k,path)).status,404,k+' '+path)
  const bayFile=(await data('vendor2','/portal/api/vendor')).invoices[0].files[0],riverFile=(await data('vendor1','/portal/api/vendor')).invoices[0].files[0]
  assert.equal((await get('vendor1',bayFile.url)).status,404,'another vendor’s invoice file is a 404');assert.equal((await get('vendor1',riverFile.url)).status,200)
  assert.equal((await get('vendor2',riverFile.url)).status,404)
  for(const k of ['resident','delegate','owner1','vendor1','vendor2','south'])for(const path of ['/api/state','/api/documents','/api/v1/documents','/api/v1/documents/document-version:'+screening.versionId,'/api/document?id='+screening.versionId,'/api/document-versions?id='+screening.documentId,'/api/bills','/api/bill-attachment?id='+riverFile.url.split('=')[1],'/api/backup','/api/rent-roll?asOf=2026-10-15','/api/history','/api/readable-export'])assert.equal((await get(k,path)).status,401,k+' '+path)
  for(const k of ['resident','owner1','vendor1'])assert.equal((await get(k,'/app?tab=documents')).status,303,k+' staff pages send portal people to sign in')
  assert.equal((await get('','/portal/api/me')).status,401);assert.equal((await get('','/portal/lease?tenancy='+north.id)).status,303)
  // The staff cookie reaches no portal page, and a portal cookie sent as a staff cookie is no session.
  assert.equal((await r.request('/portal/api/me')).status,401)
  // Joint owners see their own ownership periods; a dated transfer changes what each sees on the next request.
  const stmt=async(k)=>(await data(k,'/portal/owner-statement?from=2026-01-01&to=2026-12-31&format=json'))
  assert.deepEqual((await data('owner2','/portal/api/owner')).properties[0].periods,[{from:'2026-01-01',to:null,shareBp:5000}])
  assert.deepEqual((await stmt('owner2')).rows.map(x=>x.allocatedCents),[50000,50000]);assert.deepEqual((await stmt('owner1')).rows.map(x=>x.allocatedCents),[50000,50000])
  await r.command('ownership.set',{propertyId:np.id,effectiveFrom:'2026-10-01',reason:'Sam sold to Rowan',shares:[{ownerId:o1.id,percent:'100'}]})
  // The dated change ends both owners' sessions on their next request; nobody else is signed out. Signed in again, each sees it.
  for(const k of ['owner1','owner2'])assert.equal((await get(k,'/portal/api/owner')).status,401,k+' session ended by the ownership change')
  for(const k of ['resident','delegate','vendor1','south'])assert.equal((await get(k,'/portal/api/me')).status,200,k+' stays signed in')
  await again('owner1','rowan@example.test');await again('owner2','sam@example.test')
  assert.deepEqual((await data('owner2','/portal/api/owner')).properties[0].periods,[{from:'2026-01-01',to:'2026-09-30',shareBp:5000}])
  assert.deepEqual((await stmt('owner2')).rows.map(x=>[x.date,x.allocatedCents]),[['2026-09-02',50000]],'the former owner loses October at once')
  assert.deepEqual((await data('owner1','/portal/api/owner')).properties[0].periods,[{from:'2026-01-01',to:'2026-09-30',shareBp:5000},{from:'2026-10-01',to:null,shareBp:10000}])
  assert.deepEqual((await stmt('owner1')).rows.map(x=>x.allocatedCents),[50000,100000])
  const sold=await data('owner2','/portal/owner-statement?from=2026-10-01&to=2026-12-31&format=json');assert.deepEqual([sold.rows,sold.expenses],[[],[]],'after the sale the former owner reads the periods they owned and nothing after')
  assert.ok((await body('owner1','/portal/owner-statement?from=2026-01-01&to=2026-12-31&format=csv')).includes('Terrace owner allocation statement'))
  assert.equal((await get('owner1','/portal/owner-statement?from=bad&to=2026-12-31')).status,400)
  // PORTAL-003: one exact, affirmative vendor response; it changes no approval or dispatch state.
  const responseVersion=String((await r.state(north.id)).work.jobs.find(j=>j.id===job.id).version)
  const respond=(k,fields={},opts={})=>r.request('/portal/api/work-response',{method:'POST',as:cookies[k]??'',form:new URLSearchParams({jobId:job.id,version:responseVersion,outcome:'accepted',consent:'yes',...fields}),...opts})
  for(const k of ['resident','delegate','owner1','vendor2'])assert.equal((await respond(k)).status,404,k+' cannot answer another vendor job')
  assert.equal((await respond('vendor1',{}, {originHeader:'https://elsewhere.test'})).status,403)
  assert.equal((await respond('vendor1',{version:'0'})).status,409)
  assert.equal((await respond('vendor1',{consent:'no'})).status,400)
  await r.command('vendor.update',{...vendorFields,vendorId:river.id,standing:'blocked'})
  assert.equal((await respond('vendor1')).status,409,'qualification hold applies to the portal response door')
  await r.command('vendor.update',{...vendorFields,vendorId:river.id})
  await inspect?.({phase:'vendor-response',r,north,cookies})
  const notices=r.messages.length
  const answers=await Promise.all([respond('vendor1'),respond('vendor1')]);for(const answer of answers)assert.equal(answer.status,200,await answer.clone().text())
  const accepted=await answers[0].json();assert.equal(accepted.outcome,'accepted');assert.equal(accepted.consent_version,1);assert.match(accepted.approval_sha256,/^[a-f0-9]{64}$/)
  assert.equal((await (await respond('vendor1')).json()).id,accepted.id,'lost-response retry returns the stored result')
  assert.equal((await respond('vendor1',{outcome:'declined'})).status,409,'a response cannot silently replace the prior decision')
  assert.equal((await data('vendor1','/portal/api/vendor')).responses.length,1)
  assert.equal(r.messages.length,notices,'accepting work sends nothing')
  assert.equal((await r.state(north.id)).work.jobs.find(j=>j.id===job.id).state,'approved')
  // A reassignment moves the work: the first vendor loses it and the second sees it on the next request.
  assert.deepEqual((await data('vendor1','/portal/api/vendor')).jobs.map(j=>j.id),[job.id]);assert.deepEqual((await data('vendor2','/portal/api/vendor')).jobs,[])
  const day=n=>new Intl.DateTimeFormat('en-CA',{timeZone:zone}).format(Date.now()+n*86400000),at=(d,h)=>`${d}T${h}:00${new Intl.DateTimeFormat('en-US',{timeZone:zone,timeZoneName:'longOffset'}).formatToParts(new Date(d+'T20:00:00Z')).find(p=>p.type==='timeZoneName').value.replace('GMT','')}`
  const appt=await r.command('appointment.book',{jobId:job.id,startsAt:at(day(-1),'09'),endsAt:at(day(-1),'10'),accessStartsAt:at(day(-1),'08'),accessEndsAt:at(day(-1),'11'),permission:'granted',permissionReference:'Resident call',noticeReference:'Entry notice EN-1',noticeAt:at(day(-2),'09'),keysAccess:'PRIVATE-KEY-SENTINEL',availabilityReference:'Vendor email'})
  await r.command('appointment.cancel',{appointmentId:appt.id,version:1,party:'vendor',reference:'River withdrew'})
  const moved=await r.command('appointment.reassign',{appointmentId:appt.id,version:2,vendorId:bay.id,reference:'Owner chose Bay'})
  for(const k of ['vendor1','vendor2'])assert.equal((await respond(k)).status,401,k+' cannot submit with an ended assignment session')
  for(const k of ['vendor1','vendor2'])assert.equal((await get(k,'/portal/api/vendor')).status,401,k+' session ended by the reassignment')
  assert.equal((await get('owner1','/portal/api/owner')).status,200);await again('vendor1','river@example.test');await again('vendor2','bay@example.test')
  assert.deepEqual((await data('vendor1','/portal/api/vendor')).jobs,[],'reassignment takes the job from the first vendor before any re-approval')
  assert.deepEqual((await data('vendor2','/portal/api/vendor')).jobs,[],'and the new vendor sees it only once its exact terms are approved')
  await r.command('maintenance.approve',{jobId:job.id,version:moved.version},{as:staff.approver})
  assert.deepEqual((await data('vendor1','/portal/api/vendor')).jobs,[],'the former vendor no longer sees the job');assert.deepEqual((await data('vendor2','/portal/api/vendor')).jobs.map(j=>j.id),[job.id])
  const reassignedVersion=String((await r.state(north.id)).work.jobs.find(j=>j.id===job.id).version)
  assert.equal((await respond('vendor1',{version:reassignedVersion})).status,404,'former vendor cannot answer after signing in again')
  assert.deepEqual((await data('vendor1','/portal/api/vendor')).responses,[])
  const declined=await respond('vendor2',{version:reassignedVersion,outcome:'declined'});assert.equal(declined.status,200,await declined.clone().text());assert.equal((await declined.json()).outcome,'declined')
  await inspect?.({phase:'portal-people',r,north,cookies})
  // Revoking one grant ends that record at once; revoking a person ends their sessions, links and every grant.
  const delegateId=(await data('delegate','/portal/api/me')).grants[0].id,revokeAs=(k,grantId,opts={})=>r.request('/portal/delegate/revoke',{method:'POST',as:cookies[k],form:new URLSearchParams({grantId}),...opts})
  await r.command('portal.revoke',{grantId:delegateId,reason:'Resident withdrew the delegation'},{as:staff.leasing,status:403})
  await r.command('portal.revoke',{grantId:delegateId},{status:400})
  // The resident on the lease, and nobody else, revokes the delegated contact; the contact's session ends at once.
  for(const k of ['delegate','south','owner1','vendor2'])assert.equal((await revokeAs(k,delegateId)).status,404,k+' cannot revoke that delegation')
  assert.equal((await revokeAs('resident',delegateId,{originHeader:'https://elsewhere.test'})).status,403)
  if(revokeDelegate)await revokeDelegate({r,north,cookies});else assert.equal((await revokeAs('resident',delegateId)).status,303);
  assert.deepEqual((await data('resident','/portal/api/resident?tenancyId='+north.id)).delegates,[])
  assert.equal((await get('delegate','/portal/api/me')).status,401,'the delegated contact’s session ended')
  await again('delegate','delegate@example.test');assert.deepEqual((await data('delegate','/portal/api/me')).grants,[])
  for(const path of pages.delegate.keys())if(!['/portal','/portal/api/me'].includes(path))assert.equal((await get('delegate',path)).status,404,'after revocation the delegated contact reaches nothing at '+path)
  await invite({kind:'vendor',vendorId:river.id,email:'late@example.test',displayName:'Late Vendor'})
  const lateToken=r.portalToken('late@example.test'),people=await(await r.request('/app?tab=settings')).text()
  assert.ok(people.includes('Portal access')&&people.includes('Delegate Contact')&&!people.includes(lateToken),'staff see people and grants, never link secrets')
  const everyone=(await (await r.request('/app?tab=settings')).text()).matchAll(/<article><h3>([^<]*)<\/h3><p>([^<]*)<\/p>[\s\S]*?name="identityId" value="([^"]+)"/g)
  const ids=Object.fromEntries([...everyone].map(m=>[m[2].split(' ·')[0],m[3]]))
  const before=r.messages.length
  for(const [k,email] of [['resident','northres@example.test'],['owner2','sam@example.test'],['vendor1','river@example.test'],['late','late@example.test']]){await r.command('portal.revoke',{identityId:ids[email],reason:'Access ended '+k})}
  // The crawl again after revocation: every page, download and API the revoked people reached before is closed to them,
  // and the people still holding access see only their own records.
  for(const k of ['resident','owner2','vendor1'])for(const path of pages[k].keys()){const res=await get(k,path),s=res.status;assert.ok(s===401||(s===303&&res.headers.get('location')==='/portal/signin'),`${k} ${path} after revocation was ${s}`)}
  await private_('owner1',['Sam Oakes','North Resident'])(await crawl('owner1'));await private_('vendor2',['RIVER-1','North Resident','Sam Oakes','Rowan Ellis'])(await crawl('vendor2'))
  assert.equal((await r.request('/portal/accept',{method:'POST',as:'',form:new URLSearchParams({token:lateToken})})).status,400,'a revoked person’s unused invitation link is dead')
  assert.equal((await r.request('/portal/signin',{method:'POST',as:'',form:new URLSearchParams({email:'northres@example.test'})})).status,202);assert.equal((await r.request('/portal/signin',{method:'POST',as:'',form:new URLSearchParams({email:'nobody@example.test'})})).status,202)
  assert.equal(r.messages.length,before,'no sign-in link is sent to a revoked or unknown address')
  // Everyone else is untouched, and a still-active person can ask for a fresh link.
  assert.equal((await get('owner1','/portal/api/owner')).status,200);assert.equal((await get('vendor2','/portal/api/vendor')).status,200);assert.equal((await get('south','/portal/api/me')).status,200)
  const sent=r.messages.length,asks=await r.atOnce(Array.from({length:6},()=>['/portal/signin',{method:'POST',as:'',form:new URLSearchParams({email:'southres@example.test'})}]))
  assert.deepEqual(asks.map(a=>a.status),Array(6).fill(202));assert.equal(r.messages.length-sent,1,'requests made at once still send one sign-in link a minute')
  const fresh=await login('southres@example.test');assert.notEqual(fresh,cookies.south);assert.equal((await r.request('/portal/api/me',{as:fresh})).status,200)
  assert.equal((await r.request('/portal/signout',{method:'POST',as:fresh})).status,303);assert.equal((await r.request('/portal/api/me',{as:fresh})).status,401)
  await invite({kind:'vendor',vendorId:bay.id,email:'restore@example.test',displayName:'Pending Vendor'})
  const restoreToken=r.portalToken('restore@example.test')
  // Every change and every portal read is in the operating history.
  const history=(await(await r.request('/api/history?limit=3000')).json()).rows
  for(const action of ['portal.invite','portal.revoke','portal.invite.email','portal.read:statement','portal.read:owner-statement','portal.read:invoice'])assert.ok(history.some(x=>x.action===action),action+' is recorded')
  assert.ok(history.some(x=>x.action==='portal.revoke'&&x.subject===delegateId&&x.actor.startsWith('portal:')&&x.tenancyId===north.id),'the resident’s revocation is recorded as theirs')
  await inspect?.({phase:'portal-revoked',r,north,cookies});
  const archive=await(await r.request('/api/backup')).text(),manifest=JSON.parse(archive.split('\n')[0]);assert.ok(!manifest.tables.some(x=>x.name.startsWith('tt_portal_')),'portal people, links and sessions are never archived');assert.ok(!archive.includes('river@example.test'))
  // A restore carries no portal session, link or person: everyone is invited again by staff.
  const restored=await installation()
  try{
   await restored.formCommand('data.restore',{confirm:'RESTORE',backup:new File([archive],'backup.rer')})
   assert.equal((await restored.db.prepare('SELECT COUNT(*) AS n FROM tt_vendor_work_responses').first()).n,2,'attributable responses survive restore without portal credentials')
   for(const k of ['owner1','vendor2','south'])assert.equal((await restored.request('/portal/api/me',{as:cookies[k]})).status,401,k+' has no session after a restore')
   assert.equal((await restored.request('/portal/accept',{method:'POST',as:'',form:new URLSearchParams({token:restoreToken})})).status,400,'an unused live invitation from the source cannot sign in after restore')
   assert.equal((await restored.request('/portal/signin',{method:'POST',as:'',form:new URLSearchParams({email:'southres@example.test'})})).status,202);assert.ok(!restored.messages.some(m=>m.to.includes('southres@example.test')),'no portal person exists until staff invite them again')
  }finally{await restored.close()}
 }finally{await r.close()}
}
