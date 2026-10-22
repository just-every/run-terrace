// PORT-007: versioned tenancy documents, authorized search, restricted records by role, the upload check, download history,
// retention classes, backup and readable export. Inspection video, work documents and invoices are PORT-009's, not tenancy documents.
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {deflateSync} from 'node:zlib'
import {installation,tenancyInput} from './api/harness.mjs'
import {leaseFields} from './leases.mjs'
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jz1sAAAAASUVORK5CYII=','base64')
const sha=b=>createHash('sha256').update(b).digest('hex')
const pdf=(words,{flate=false,extra=''}={})=>{const body=Buffer.from(`BT /F1 12 Tf (${words}) Tj ET`),data=flate?deflateSync(body):body;return Buffer.concat([Buffer.from(`%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\n2 0 obj<</Length ${data.length}${flate?'/Filter/FlateDecode':''}>>\nstream\n`),data,Buffer.from(`\nendstream\nendobj\n${extra}trailer<</Root 1 0 R>>\n%%EOF`)])}
const mp4=Buffer.concat([Buffer.from([0,0,0,24]),Buffer.from('ftypisom'),Buffer.from([0,0,2,0]),Buffer.from('isomiso2'),Buffer.from('mdat inspection walkthrough bytes')])
const file=(bytes,name,type)=>new File([bytes],name,{type})
export async function journey({inspect,assets=false}={}){
 const r=await installation({assets})
 try{
  const place=async(name,unit)=>{const f=await r.command('portfolio.add',{name}),p=await r.command('property.add',{portfolioId:f.id,name:name+' House',address:`${unit} ${name} Road, Oakland, CA 94607`,kind:'duplex',timeZone:'America/Los_Angeles'}),u=await r.command('unit.add',{propertyId:p.id,identifier:unit,bedrooms:'2',bathrooms:'1'});return {f,p,u,t:await r.command('tenancy.create',{...tenancyInput,address:`Unit ${unit}, ${name} Road, Oakland, CA`,unitId:u.id,tenantName:name+' Tenant',tenantEmail:name.toLowerCase()+'@example.test'})}}
  const north=await place('North','4B'),south=await place('South','9Z')
  await r.stepUp()
  const staff={}
  for(const [key,role,fs] of [['manager','portfolio_manager',[north]],['leasing','leasing',[north]],['southLeasing','leasing',[south]],['accountant','accountant',[north]],['southAccountant','accountant',[south]],['maintenance','maintenance_coordinator',[north]],['bookkeeper','bookkeeper',[north,south]],['member','member',[north,south]]]){
   const email=key.toLowerCase()+'@example.test'
   await r.command('operator.invite',{displayName:key,email,role,...Object.fromEntries(fs.map(x=>['portfolio:'+x.f.id,'1']))})
   staff[key]=await r.accept(email)
  }
  const as=k=>({as:staff[k]}),get=(k,path)=>r.request(path,k===''?{as:''}:as(k)),json=async(k,path)=>(await get(k,path)).json()
  const upload=(extra,opts={},who)=>r.formCommand('document.upload',{tenancyId:north.t.id,kind:'lease',title:'Lease',source:'Signed copy handed over at move-in',...extra},{...(who?as(who):{}),...opts})
  // An amended lease is a new version of the same document; the earlier lease stays recoverable.
  const v1=pdf('Original lease: no pets, rent 620.00 monthly'),v2=pdf('Amended lease: one cat allowed, pet rent 25.00 monthly',{flate:true})
  const first=await upload({title:'Lease with amendments',file:file(v1,'lease-original.pdf','application/pdf')})
  assert.equal(first.sha256,sha(v1));assert.equal(first.version,1)
  await r.formCommand('document.revise',{documentId:first.documentId,version:'1',source:'Amendment signed 2 Nov',file:file(v1,'same.pdf','application/pdf')},{status:409})
  await r.formCommand('document.revise',{documentId:first.documentId,version:'7',source:'stale',file:file(v2,'lease-amended.pdf','application/pdf')},{status:409})
  const second=await r.formCommand('document.revise',{documentId:first.documentId,version:'1',source:'Amendment signed 2 Nov',file:file(v2,'lease-amended.pdf','application/pdf')})
  assert.equal(second.version,2)
  await r.formCommand('document.revise',{documentId:first.documentId,version:'1',source:'second tab',file:file(pdf('Another'),'x.pdf','application/pdf')},{status:409})
  // Inspection video, work documents and invoices attach to their own records (PORT-009): not tenancy document kinds or types.
  for(const kind of ['inspection','work','invoice'])await upload({kind,title:'Walkthrough',source:'Phone',file:file(pdf('x '+kind),kind+'.pdf','application/pdf')},{status:400})
  await upload({title:'Walkthrough video',file:file(mp4,'walkthrough.mp4','video/mp4')},{status:422})
  const screening=pdf('Applicant screening report: credit and background summary'),screened=await upload({kind:'screening',title:'Screening report',source:'Provider PDF by email',file:file(screening,'screening.pdf','application/pdf')})
  const application=await upload({kind:'application',title:'Rental application',source:'Applicant by email',file:file(pdf('Rental application: employer and references'),'application.pdf','application/pdf')})
  const taxBytes=pdf('Tax year 2025 form'),tax=await upload({kind:'tax',title:'Owner 1099 copy',source:'Accountant',file:file(taxBytes,'1099.pdf','application/pdf')})
  const viaJson=await r.command('document.upload',{tenancyId:north.t.id,kind:'notice',title:'Entry notice',source:'Mailed 3 Nov',file:{name:'notice.txt',type:'text/plain',base64:Buffer.from('Notice of entry for the kitchen valve repair on Friday').toString('base64')}})
  assert.ok(viaJson.versionId)
  // Find the current version from its unit, by words inside the file, or by its details.
  assert.equal((await get('','/api/documents?q=4B')).status,401)
  const unit=(await json('manager','/api/documents?q=4B')).documents,lease=unit.filter(x=>x.title==='Lease with amendments')
  assert.equal(lease.length,1,'only the current version by default');assert.equal(lease[0].version,2);assert.equal(lease[0].current,true);assert.equal(lease[0].sha256,sha(v2));assert.equal(lease[0].unit,'4B')
  assert.equal((await json('manager',`/api/documents?unitId=${north.u.id}&kind=lease`)).documents[0].versionId,second.versionId)
  const inside=(await json('manager','/api/documents?q=cat+allowed')).documents;assert.deepEqual(inside.map(x=>x.versionId),[second.versionId],'content of the current version is searchable');assert.match(inside[0].snippet,/one cat allowed/)
  assert.equal((await json('manager','/api/documents?q=cat+allowed')).documents.some(x=>x.version===1),false)
  const prior=(await json('manager','/api/documents?q=no+pets&history=1')).documents;assert.deepEqual(prior.map(x=>[x.version,x.current]),[[1,false]],'the prior lease is found in history')
  assert.deepEqual(Buffer.from(await(await get('manager',prior[0].url)).arrayBuffer()),v1,'the prior lease is recovered byte for byte')
  const dl=await get('manager',lease[0].url);assert.deepEqual(Buffer.from(await dl.arrayBuffer()),v2);assert.equal(dl.headers.get('x-document-sha256'),sha(v2));assert.match(dl.headers.get('content-security-policy'),/sandbox/);assert.equal(dl.headers.get('x-content-type-options'),'nosniff')
  // Each kind keeps its retention class: leases with the lease, applications and screening 2 years, notices 3 years, tax 7.
  assert.deepEqual(Object.fromEntries((await json('manager','/api/documents')).documents.filter(x=>x.documentId).map(x=>[x.kind,x.retentionClass])),{lease:'lease',application:'screening',screening:'screening',notice:'communications',tax:'accounting'})
  // Download history: who opened which version.
  const detail=await json('manager','/api/document-versions?id='+first.documentId)
  assert.deepEqual(detail.versions.map(v=>[v.version,v.current,v.sha256]),[[2,true,sha(v2)],[1,false,sha(v1)]]);assert.match(detail.versions[0].scan.check,/Not a malware scan/);assert.equal(detail.versions[0].scan.text,'indexed')
  assert.ok(detail.downloads.some(d=>d.versionId===first.versionId&&d.actorName==='manager')&&detail.downloads.some(d=>d.versionId===second.versionId))
  // PORT-005 signed originals and inspection photographs are found beside the documents and open through their own doors.
  const signed=await r.command('lease.prepare',leaseFields(north.t.id,'2026-08-01')),inspection=await r.command('inspection.create',{tenancyId:north.t.id,date:'2026-10-19',notes:'Kitchen'}),photo=await r.formCommand('inspection.photo',{inspectionId:inspection.id,file:file(png,'kitchen-before.png','image/png')})
  const originals=(await json('manager','/api/documents?q=4B')).documents.filter(x=>['signed-lease','inspection-photo'].includes(x.kind))
  assert.deepEqual(originals.map(x=>x.kind).sort(),['inspection-photo','signed-lease']);assert.equal(originals.find(x=>x.kind==='inspection-photo').sha256,sha(png))
  const signedHit=originals.find(x=>x.kind==='signed-lease');assert.equal((await get('manager',signedHit.url)).status,200)
  assert.ok(!(await json('southLeasing','/api/documents')).documents.some(x=>x.kind==='signed-lease'||x.kind==='inspection-photo'))
  await inspect?.({phase:'documents',r,north,staff,v2})
  // The upload check refuses active content and anything it cannot read, and says it is not a malware verdict.
  const refuse=async(f,note)=>{const before=(await json('manager','/api/documents?history=1')).documents.length;const b=await r.formCommand('document.upload',{tenancyId:north.t.id,kind:'lease',title:'Refused '+note,source:'Test',file:f},{status:422});assert.equal(b.error,'document_refused',note);assert.equal((await json('manager','/api/documents?history=1')).documents.length,before,note+': nothing stored')}
  await refuse(file(pdf('Hello',{extra:'3 0 obj<</S/JavaScript/JS(app.alert(1))>>endobj\n'}),'js.pdf','application/pdf'),'plain JavaScript')
  await refuse(file(pdf('Hello',{extra:'3 0 obj<</S/#4A#61vaScript/JS(x)>>endobj\n'}),'escaped.pdf','application/pdf'),'escaped JavaScript name')
  const hidden=deflateSync(Buffer.from('<</S/Launch/F(cmd.exe)>>')),objstm=Buffer.concat([Buffer.from(`%PDF-1.5\n4 0 obj<</Type/ObjStm/N 1/First 4/Filter/FlateDecode/Length ${hidden.length}>>\nstream\n`),hidden,Buffer.from('\nendstream\nendobj\n%%EOF')])
  await refuse(file(objstm,'hidden.pdf','application/pdf'),'action hidden in a compressed object stream')
  await refuse(file(Buffer.concat([Buffer.from('%PDF-1.5\n4 0 obj<</Type/ObjStm/N 1/First 4/Filter/FlateDecode/Length 9>>\nstream\n'),Buffer.from('not flate!'),Buffer.from('\nendstream\nendobj\n%%EOF')]),'broken.pdf','application/pdf'),'an object stream that cannot be read')
  await refuse(file(pdf('Hello',{extra:'/Encrypt 5 0 R\n'}),'enc.pdf','application/pdf'),'encrypted PDF')
  await refuse(file(Buffer.from('<html><script>alert(1)</script></html>'),'page.txt','text/plain'),'script in text')
  await refuse(file(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>1</script></svg>'),'x.svg','image/svg+xml'),'SVG image')
  await refuse(file(Buffer.concat([Buffer.from('MZ'),Buffer.alloc(64)]),'tool.pdf','application/pdf'),'executable named PDF')
  await refuse(file(Buffer.concat([Buffer.from([255,216,255,224]),Buffer.from('<script>alert(1)</script>')]),'scan.jpg','image/jpeg'),'script inside an image')
  await refuse(file(Buffer.from('From: a@example.test\nContent-Type: text/html\n\n<b>x</b>'),'mail.eml','message/rfc822'),'email with HTML part')
  await refuse(file(Buffer.from('plain'),'x.bin','application/octet-stream'),'unlisted type')
  await r.formCommand('document.upload',{tenancyId:north.t.id,kind:'lease',title:'Big',source:'Test',file:file(Buffer.alloc(5*1024*1024+1,65),'big.txt','text/plain')},{status:413})
  // Restricted records: screening for the owner and portfolio managers, applications also for leasing, tax also for
  // accountants (read and download only). Staff without the right see no trace, and the same 404 as a missing document.
  const names=async k=>(await json(k,'/api/documents?history=1')).documents.filter(x=>x.documentId).map(x=>x.title).sort()
  const finds=async(k,want,hidden)=>{const seen=await names(k);for(const t of want)assert.ok(seen.includes(t),`${k} finds ${t}`);for(const t of hidden)assert.ok(!seen.includes(t),`${k} finds no ${t}`)}
  await finds('manager',['Lease with amendments','Entry notice','Rental application','Screening report','Owner 1099 copy'],[])
  await finds('leasing',['Lease with amendments','Entry notice','Rental application'],['Screening report','Owner 1099 copy'])
  await finds('maintenance',['Lease with amendments','Entry notice'],['Rental application','Screening report','Owner 1099 copy'])
  assert.deepEqual(await names('accountant'),['Owner 1099 copy'],'an accountant finds tax documents and nothing else')
  assert.equal((await json('leasing','/api/documents?q=credit+background')).documents.length,0)
  for(const doc of [screened,tax])assert.equal((await get('leasing','/api/document?id='+doc.versionId)).status,404)
  for(const doc of [screened,application,second])assert.equal((await get('accountant','/api/document?id='+doc.versionId)).status,404)
  for(const doc of [screened,application,tax])assert.equal((await get('maintenance','/api/document?id='+doc.versionId)).status,404)
  assert.equal((await get('leasing','/api/document-versions?id='+screened.documentId)).status,404)
  assert.equal((await get('leasing','/api/document?id='+application.versionId)).status,200)
  assert.equal((await get('accountant','/api/document?id='+tax.versionId)).status,200);assert.equal((await get('accountant','/api/document-versions?id='+tax.documentId)).status,200);assert.equal((await get('accountant','/app?tab=documents')).status,200)
  await r.formCommand('document.upload',{tenancyId:north.t.id,kind:'tax',title:'Accountant copy',source:'x',file:file(pdf('Tax 2026'),'t.pdf','application/pdf')},{...as('accountant'),status:403})
  await r.formCommand('document.revise',{documentId:tax.documentId,version:'1',source:'x',file:file(pdf('Tax 2027'),'t2.pdf','application/pdf')},{...as('accountant'),status:403})
  assert.equal((await json('southAccountant','/api/documents?history=1')).documents.length,0);assert.equal((await get('southAccountant','/api/document?id='+tax.versionId)).status,404,'an accountant outside the portfolio gets 404')
  await r.formCommand('document.upload',{tenancyId:north.t.id,kind:'application',title:'Co-applicant form',source:'Applicant by email',file:file(pdf('Co-applicant'),'co.pdf','application/pdf')},as('leasing'))
  await r.formCommand('document.upload',{tenancyId:north.t.id,kind:'screening',title:'Sneaky',source:'x',file:file(screening,'s2.pdf','application/pdf')},{...as('leasing'),status:403})
  await r.formCommand('document.revise',{documentId:screened.documentId,version:'1',source:'x',file:file(pdf('x'),'s.pdf','application/pdf')},{...as('leasing'),status:404})
  assert.equal((await get('manager','/api/document?id='+screened.versionId)).status,200)
  // Roles without a document right, and signed-out callers, get nothing.
  for(const k of ['bookkeeper','member']){assert.equal((await get(k,'/api/documents')).status,403,k);assert.equal((await get(k,'/api/document?id='+second.versionId)).status,403,k);assert.equal((await get(k,'/app?tab=documents')).status,403,k)}
  for(const path of ['/api/documents','/api/document?id='+second.versionId,'/api/document-versions?id='+first.documentId])assert.equal((await get('',path)).status,401,path)
  // Portfolio scope: South staff find nothing from North, and a direct fetch is a plain 404.
  assert.equal((await json('southLeasing','/api/documents?history=1')).documents.length,0)
  assert.equal((await json('southLeasing','/api/documents?q=4B')).documents.length,0)
  for(const path of [lease[0].url,'/api/document?id='+application.versionId,'/api/document-versions?id='+first.documentId])assert.equal((await get('southLeasing',path)).status,404,path)
  await r.formCommand('document.upload',{tenancyId:north.t.id,kind:'lease',title:'x',source:'x',file:file(pdf('x'),'x.pdf','application/pdf')},{...as('southLeasing'),status:404})
  await r.formCommand('document.revise',{documentId:first.documentId,version:'2',source:'x',file:file(pdf('y'),'y.pdf','application/pdf')},{...as('southLeasing'),status:404})
  assert.equal((await get('southLeasing','/app?tab=documents')).status,200)
  assert.ok(!(await(await get('southLeasing','/app?tab=documents')).text()).includes('Lease with amendments'))
  const page=await(await get('manager','/app?tab=documents&q=amended')).text();assert.ok(page.includes('Download original')&&page.includes('Upload a new version')&&page.includes(sha(v2)))
  const ownerPage=await(await r.request('/app?tab=documents&q=credit')).text();assert.ok(ownerPage.includes('Restricted')&&ownerPage.includes('Screening report'))
  // History records the downloads and the refused uploads; a restricted download by the manager is attributable.
  const history=(await(await r.request('/api/history?limit=2000')).json()).rows
  assert.ok(history.some(x=>x.action==='read:document'&&x.subject===second.versionId&&x.actorName==='manager'&&x.tenancyId===north.t.id))
  assert.ok(history.filter(x=>x.action==='document.upload'&&x.outcome==='refused').length>=11,'refused uploads are in the history')
  assert.ok(history.some(x=>x.action==='document.revise'&&x.source==='Amendment signed 2 Nov'))
  // The same records restore from a backup and appear in the readable export as original files with their SHA-256.
  const archive=await(await r.request('/api/backup')).text(),fresh=await installation()
  try{
   await fresh.formCommand('data.restore',{confirm:'RESTORE',backup:new File([archive],'backup.rer')})
   const restored=(await(await fresh.request('/api/documents?history=1')).json()).documents,original=(await(await r.request('/api/documents?history=1')).json()).documents
   assert.deepEqual(restored.map(x=>[x.versionId,x.sha256,x.version,x.title]).sort(),original.map(x=>[x.versionId,x.sha256,x.version,x.title]).sort())
   assert.deepEqual(Buffer.from(await(await fresh.request('/api/document?id='+first.versionId)).arrayBuffer()),v1)
   assert.deepEqual(Buffer.from(await(await fresh.request('/api/document?id='+tax.versionId)).arrayBuffer()),taxBytes)
   assert.equal((await fresh.request('/api/documents?q=cat+allowed')).status,200)
  }finally{await fresh.close()}
  const zip=Buffer.from(await(await r.request('/api/readable-export')).arrayBuffer()),entries=new Map()
  for(let o=0;zip.readUInt32LE(o)===0x04034b50;){const size=zip.readUInt32LE(o+18),n=zip.readUInt16LE(o+26),x=zip.readUInt16LE(o+28),name=zip.subarray(o+30,o+30+n).toString();entries.set(name,zip.subarray(o+30+n+x,o+30+n+x+size));o+=30+n+x+size}
  const manifest=JSON.parse(entries.get('manifest.json')),csv=entries.get('tables/tt_document_versions.csv').toString()
  for(const [v,bytes,ext] of [[first,v1,'pdf'],[second,v2,'pdf'],[tax,taxBytes,'pdf'],[screened,screening,'pdf']]){
   const path=`files/tt_document_versions/${v.versionId}.${ext}`,entry=manifest.files.find(f=>f.path===path)
   assert.ok(entry,path+' is listed');assert.deepEqual(entries.get(path),bytes);assert.equal(entry.sha256,sha(bytes));assert.ok(csv.includes(`file:${path} sha256:${sha(bytes)}`))
  }
 }finally{await r.close()}
}
