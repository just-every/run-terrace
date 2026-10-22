// ROLE-002: portal people (resident, delegated contact, joint owners, vendors) see only the record a live grant names;
// assignments, ownership dates and revocation apply on the next request. PORT-007: a vendor and an unrelated resident are denied every document door.
import assert from 'node:assert/strict'
import {installation,tenancyInput} from './api/harness.mjs'
const pdf=n=>({name:'invoice-'+n+'.pdf',type:'application/pdf',base64:Buffer.from('%PDF-1.4\n'+n+'\n%%EOF').toString('base64')})
const SENTINELS=['SOUTH-SENTINEL','southres@example.test','Other Owner Sentinel','LANDLORD-SENTINEL','SCREEN-SENTINEL','987654321','Oakland Bank Sentinel']
export async function journey({inspect,assets=false}={}){
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
  // Unrelated records are plain 404s on every portal door; staff doors and documents refuse portal people outright.
  for(const [k,paths] of Object.entries({resident:['/portal/api/resident?tenancyId='+south.id,'/portal/lease?tenancy='+south.id,'/portal/statement?tenancyId='+south.id,'/portal/api/owner','/portal/owner-statement','/portal/api/vendor','/portal/invoice-file?id='+riverBill.id],owner1:['/portal/api/resident?tenancyId='+north.id,'/portal/api/vendor'],vendor1:['/portal/api/resident?tenancyId='+north.id,'/portal/api/owner','/portal/owner-statement','/portal/invoice-file?id=nonexistent'],south:['/portal/api/resident?tenancyId='+north.id,'/portal/statement?tenancyId='+north.id]}))for(const path of paths)assert.equal((await get(k,path)).status,404,k+' '+path)
  const bayFile=(await data('vendor2','/portal/api/vendor')).invoices[0].files[0],riverFile=(await data('vendor1','/portal/api/vendor')).invoices[0].files[0]
  assert.equal((await get('vendor1',bayFile.url)).status,404,'another vendor’s invoice file is a 404');assert.equal((await get('vendor1',riverFile.url)).status,200)
  assert.equal((await get('vendor2',riverFile.url)).status,404)
  for(const k of ['resident','delegate','owner1','vendor1','vendor2','south'])for(const path of ['/api/state','/api/documents','/api/document?id='+screening.versionId,'/api/document-versions?id='+screening.documentId,'/api/bills','/api/bill-attachment?id='+riverFile.url.split('=')[1],'/api/backup','/api/rent-roll?asOf=2026-10-15','/api/history','/api/readable-export'])assert.equal((await get(k,path)).status,401,k+' '+path)
  for(const k of ['resident','owner1','vendor1'])assert.equal((await get(k,'/app?tab=documents')).status,303,k+' staff pages send portal people to sign in')
  assert.equal((await get('','/portal/api/me')).status,401);assert.equal((await get('','/portal/lease?tenancy='+north.id)).status,303)
  // The staff cookie reaches no portal page, and a portal cookie sent as a staff cookie is no session.
  assert.equal((await r.request('/portal/api/me')).status,401)
  // Joint owners see their own ownership periods; a dated transfer changes what each sees on the next request.
  const stmt=async(k)=>(await data(k,'/portal/owner-statement?from=2026-01-01&to=2026-12-31&format=json'))
  assert.deepEqual((await data('owner2','/portal/api/owner')).properties[0].periods,[{from:'2026-01-01',to:null,shareBp:5000}])
  assert.deepEqual((await stmt('owner2')).rows.map(x=>x.allocatedCents),[50000,50000]);assert.deepEqual((await stmt('owner1')).rows.map(x=>x.allocatedCents),[50000,50000])
  await r.command('ownership.set',{propertyId:np.id,effectiveFrom:'2026-10-01',reason:'Sam sold to Rowan',shares:[{ownerId:o1.id,percent:'100'}]})
  assert.deepEqual((await data('owner2','/portal/api/owner')).properties[0].periods,[{from:'2026-01-01',to:'2026-09-30',shareBp:5000}])
  assert.deepEqual((await stmt('owner2')).rows.map(x=>[x.date,x.allocatedCents]),[['2026-09-02',50000]],'the former owner loses October at once')
  assert.deepEqual((await data('owner1','/portal/api/owner')).properties[0].periods,[{from:'2026-01-01',to:'2026-09-30',shareBp:5000},{from:'2026-10-01',to:null,shareBp:10000}])
  assert.deepEqual((await stmt('owner1')).rows.map(x=>x.allocatedCents),[50000,100000])
  assert.ok((await body('owner1','/portal/owner-statement?from=2026-01-01&to=2026-12-31&format=csv')).includes('Terrace owner allocation statement'))
  assert.equal((await get('owner1','/portal/owner-statement?from=bad&to=2026-12-31')).status,400)
  // A reassignment moves the work: the first vendor loses it and the second sees it on the next request.
  assert.deepEqual((await data('vendor1','/portal/api/vendor')).jobs.map(j=>j.id),[job.id]);assert.deepEqual((await data('vendor2','/portal/api/vendor')).jobs,[])
  const day=n=>new Intl.DateTimeFormat('en-CA',{timeZone:zone}).format(Date.now()+n*86400000),at=(d,h)=>`${d}T${h}:00${new Intl.DateTimeFormat('en-US',{timeZone:zone,timeZoneName:'longOffset'}).formatToParts(new Date(d+'T20:00:00Z')).find(p=>p.type==='timeZoneName').value.replace('GMT','')}`
  const appt=await r.command('appointment.book',{jobId:job.id,startsAt:at(day(-1),'09'),endsAt:at(day(-1),'10'),accessStartsAt:at(day(-1),'08'),accessEndsAt:at(day(-1),'11'),permission:'granted',permissionReference:'Resident call',noticeReference:'Entry notice EN-1',noticeAt:at(day(-2),'09'),keysAccess:'PRIVATE-KEY-SENTINEL',availabilityReference:'Vendor email'})
  await r.command('appointment.cancel',{appointmentId:appt.id,version:1,party:'vendor',reference:'River withdrew'})
  const moved=await r.command('appointment.reassign',{appointmentId:appt.id,version:2,vendorId:bay.id,reference:'Owner chose Bay'})
  assert.deepEqual((await data('vendor1','/portal/api/vendor')).jobs,[],'reassignment takes the job from the first vendor before any re-approval')
  assert.deepEqual((await data('vendor2','/portal/api/vendor')).jobs,[],'and the new vendor sees it only once its exact terms are approved')
  await r.command('maintenance.approve',{jobId:job.id,version:moved.version},{as:staff.approver})
  assert.deepEqual((await data('vendor1','/portal/api/vendor')).jobs,[],'the former vendor no longer sees the job');assert.deepEqual((await data('vendor2','/portal/api/vendor')).jobs.map(j=>j.id),[job.id])
  await inspect?.({phase:'portal-people',r,north,cookies})
  // Revoking one grant ends that record at once; revoking a person ends their sessions, links and every grant.
  const delegateId=(await data('delegate','/portal/api/me')).grants[0].id
  await r.command('portal.revoke',{grantId:delegateId,reason:'Resident withdrew the delegation'},{as:staff.leasing,status:403})
  await r.command('portal.revoke',{grantId:delegateId},{status:400})
  await r.command('portal.revoke',{grantId:delegateId,reason:'Resident withdrew the delegation'})
  assert.equal((await get('delegate','/portal/api/resident?tenancyId='+north.id)).status,404);assert.deepEqual((await data('delegate','/portal/api/me')).grants,[])
  await invite({kind:'vendor',vendorId:river.id,email:'late@example.test',displayName:'Late Vendor'})
  const lateToken=r.portalToken('late@example.test'),people=await(await r.request('/app?tab=settings')).text()
  assert.ok(people.includes('Portal access')&&people.includes('Delegate Contact')&&!people.includes(lateToken),'staff see people and grants, never link secrets')
  const everyone=(await (await r.request('/app?tab=settings')).text()).matchAll(/<article><h3>([^<]*)<\/h3><p>([^<]*)<\/p>[\s\S]*?name="identityId" value="([^"]+)"/g)
  const ids=Object.fromEntries([...everyone].map(m=>[m[2].split(' ·')[0],m[3]]))
  const before=r.messages.length
  for(const [k,email] of [['resident','northres@example.test'],['owner2','sam@example.test'],['vendor1','river@example.test'],['late','late@example.test']]){await r.command('portal.revoke',{identityId:ids[email],reason:'Access ended '+k})}
  for(const [k,paths] of [['resident',['/portal','/portal/api/me','/portal/api/resident?tenancyId='+north.id,'/portal/statement?tenancyId='+north.id]],['owner2',['/portal/api/owner','/portal/owner-statement?from=2026-01-01&to=2026-12-31']],['vendor1',['/portal/api/vendor',riverFile.url]]])for(const path of paths){const s=(await get(k,path)).status;assert.ok([401,303].includes(s),`${k} ${path} after revocation was ${s}`)}
  assert.equal((await r.request('/portal/accept',{method:'POST',as:'',form:new URLSearchParams({token:lateToken})})).status,400,'a revoked person’s unused invitation link is dead')
  assert.equal((await r.request('/portal/signin',{method:'POST',as:'',form:new URLSearchParams({email:'northres@example.test'})})).status,202);assert.equal((await r.request('/portal/signin',{method:'POST',as:'',form:new URLSearchParams({email:'nobody@example.test'})})).status,202)
  assert.equal(r.messages.length,before,'no sign-in link is sent to a revoked or unknown address')
  // Everyone else is untouched, and a still-active person can ask for a fresh link.
  assert.equal((await get('owner1','/portal/api/owner')).status,200);assert.equal((await get('vendor2','/portal/api/vendor')).status,200);assert.equal((await get('south','/portal/api/me')).status,200)
  assert.equal((await r.request('/portal/signin',{method:'POST',as:'',form:new URLSearchParams({email:'southres@example.test'})})).status,202)
  const fresh=await login('southres@example.test');assert.notEqual(fresh,cookies.south);assert.equal((await r.request('/portal/api/me',{as:fresh})).status,200)
  assert.equal((await r.request('/portal/signout',{method:'POST',as:fresh})).status,303);assert.equal((await r.request('/portal/api/me',{as:fresh})).status,401)
  // Every change and every portal read is in the operating history.
  const history=(await(await r.request('/api/history?limit=3000')).json()).rows
  for(const action of ['portal.invite','portal.revoke','portal.invite.email','portal.read:statement','portal.read:owner-statement','portal.read:invoice'])assert.ok(history.some(x=>x.action===action),action+' is recorded')
  const archive=await(await r.request('/api/backup')).text(),manifest=JSON.parse(archive.split('\n')[0]);assert.ok(!manifest.tables.some(x=>x.name.startsWith('tt_portal_')),'portal people, links and sessions are never archived');assert.ok(!archive.includes('river@example.test'))
 }finally{await r.close()}
}
