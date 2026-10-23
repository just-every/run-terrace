import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {readFile} from 'node:fs/promises'
import {installation,tenancyInput} from './api/harness.mjs'
export const sha=b=>createHash('sha256').update(b).digest('hex')
export const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jz1sAAAAASUVORK5CYII=','base64')
export async function upload(h,{kind,recordId,bytes,name='original.png',type='image/png',...extra},opts={}) {
 const began=await h.command('media.begin',{kind,recordId,size:bytes.length,sha256:sha(bytes),name,mediaType:type,capturedAt:'2026-10-20',source:'Original from the site technician',...extra},opts)
 for(let i=0;i<Math.ceil(bytes.length/began.chunkSize);i++)await h.formCommand('media.chunk',{uploadId:began.id,position:i,file:new File([bytes.subarray(i*began.chunkSize,(i+1)*began.chunkSize)],'chunk')},opts)
 const result=await h.command('media.finish',{uploadId:began.id},opts);return {...began,...result}
}
export async function fixture(h) {
 const f=await h.command('portfolio.add',{name:'Field operations'}),p=await h.command('property.add',{portfolioId:f.id,name:'Alder duplex',address:'1840 Alder Street, Oakland, CA',kind:'duplex',timeZone:'America/Los_Angeles'}),u=await h.command('unit.add',{propertyId:p.id,identifier:'1C',bedrooms:2,bathrooms:1})
 const t=await h.command('tenancy.create',{...tenancyInput,unitId:u.id}),i=await h.command('inspection.create',{tenancyId:t.id,date:'2026-10-20',notes:'Move-in walkthrough'})
 const v=await h.command('vendor.add',{name:'Alder Plumbing',email:'plumber@example.test',phone:'510-555-0100',specialties:'plumbing',serviceAreas:'Oakland',w9:'received',insuranceExpires:'2036-12-31',licenseNumber:'PLUMB-1',licenseExpires:'2036-12-31',availability:'Weekdays',rate:'100',standing:'approved'})
 const j=await h.command('maintenance.prepare',{tenancyId:t.id,title:'Replace inlet valve',checklist:'Replace valve\nTest for leaks',vendorId:v.id,trade:'plumbing',dueDate:'2026-12-01',estimate:'100.00'})
 const original={name:'invoice.pdf',type:'application/pdf',base64:Buffer.from('%PDF-1.4\nOriginal supplier invoice\n%%EOF').toString('base64')}
 const b=await h.command('bill.create',{vendorId:v.id,invoiceNumber:'FIELD-2026-1',date:'2026-10-20',lines:[{description:'Valve',code:'repairs',amount:'100',tax:'0'}],allocations:[{propertyId:p.id,jobId:j.id,amount:'100'}],original})
 return {f,p,u,t,i,v,j,b}
}
export async function journey({assets=false,inspect}={}) {
 const h=await installation({assets}),fresh=await installation()
 try {
  const f=await fixture(h),{t,i,j,b}=f
  const video=await readFile(new URL('./fixtures/inspection-walkthrough.mp4',import.meta.url))
  assert.ok(video.length>5*1024*1024,'fixture really exercises more than 5 MB')
  const began=await h.command('media.begin',{kind:'inspection',recordId:i.id,name:'entry-walkthrough.mp4',mediaType:'video/mp4',size:video.length,sha256:sha(video),capturedAt:'2026-10-20',source:'Original phone walkthrough'})
  await h.command('media.finish',{uploadId:began.id},{status:409})
  const part=new File([video.subarray(0,began.chunkSize)],'part')
  await h.formCommand('media.chunk',{uploadId:began.id,position:0,file:part})
  await h.formCommand('media.chunk',{uploadId:began.id,position:0,file:part})
  await h.formCommand('media.chunk',{uploadId:began.id,position:0,file:new File([Buffer.alloc(part.size,1)],'different')},{status:409})
  assert.equal((await h.request('/api/record-media/file?id='+began.id)).status,404,'unfinished originals stay private')
  await h.restart()
  assert.deepEqual((await(await h.request('/api/record-media/upload?id='+began.id)).json()).positions,[0],'resume survives a worker restart')
  for(let n=1;n<Math.ceil(video.length/began.chunkSize);n++)await h.formCommand('media.chunk',{uploadId:began.id,position:n,file:new File([video.subarray(n*began.chunkSize,(n+1)*began.chunkSize)],'part')})
  await h.command('media.finish',{uploadId:began.id});assert.equal((await h.command('media.finish',{uploadId:began.id})).replayed,true)
  const prior=await upload(h,{kind:'inspection',recordId:i.id,bytes:png,name:'entry-photo.png'}),second=await upload(h,{kind:'inspection',recordId:i.id,bytes:Buffer.concat([png,Buffer.from('second original')]),name:'corrected-entry.png',attachmentId:prior.attachmentId,version:1})
  await h.command('media.begin',{kind:'inspection',recordId:i.id,name:'stale.png',mediaType:'image/png',size:png.length,sha256:sha(png),capturedAt:'2026-10-20',source:'stale',attachmentId:prior.attachmentId,version:1},{status:409})
  const work=await upload(h,{kind:'work',recordId:j.id,bytes:Buffer.from('Valve replacement method and manufacturer instructions'),name:'instructions.txt',type:'text/plain'})
  const invoice=await upload(h,{kind:'invoice',recordId:b.id,bytes:Buffer.from('%PDF-1.4\nSupplier invoice revision\n%%EOF'),name:'supplier.pdf',type:'application/pdf'})
  const work2=await upload(h,{kind:'work',recordId:j.id,bytes:Buffer.from('Revised valve method with isolation step'),name:'instructions-revised.txt',type:'text/plain',attachmentId:work.attachmentId,version:1})
  const invoice2=await upload(h,{kind:'invoice',recordId:b.id,bytes:Buffer.from('%PDF-1.4\nSupplier supplemental original\n%%EOF'),name:'supplier-revised.pdf',type:'application/pdf',attachmentId:invoice.attachmentId,version:1})
  for(const [kind,key,attachment]of [['work',j.id,work.attachmentId],['invoice',b.id,invoice.attachmentId]])assert.deepEqual((await(await h.request('/api/record-media?kind='+kind+'&recordId='+key)).json()).files.filter(x=>x.attachment_id===attachment).map(x=>x.version),[2,1],'each record kind retains earlier versions')
  const get=id=>h.request('/api/record-media/file?id='+id)
  for(const [id,bytes]of [[began.id,video],[prior.id,png]]){const r=await get(id);assert.equal(r.headers.get('cache-control'),'private, no-store');assert.equal(r.headers.get('x-content-sha256'),sha(bytes));assert.deepEqual(Buffer.from(await r.arrayBuffer()),bytes)}
  const list=await(await h.request('/api/record-media?kind=inspection&recordId='+i.id)).json();assert.deepEqual(list.files.filter(x=>x.attachment_id===prior.attachmentId).map(x=>x.version),[2,1])
  assert.equal((await h.request('/api/record-media/file?id='+work.id,{as:''})).status,401)
  await h.command('maintenance.approve',{jobId:j.id,version:1})
  await h.stepUp()
  const staff=async(role,email,portfolio)=>{await h.command('operator.invite',{displayName:role,email,role,['portfolio:'+portfolio]:'1'});return h.accept(email)}
  const other=await h.command('portfolio.add',{name:'Other portfolio'}),out=await staff('portfolio_manager','outside@example.test',other.id),mc=await staff('maintenance_coordinator','tech@example.test',f.f.id),accountant=await staff('accountant','accountant@example.test',f.f.id)
  for(const path of ['/api/record-media/file?id='+prior.id,'/api/record-media?kind=inspection&recordId='+i.id])assert.equal((await h.request(path,{as:out})).status,404)
  assert.equal((await h.request('/api/record-media/file?id='+invoice.id,{as:mc})).status,403)
  assert.equal((await h.request('/api/record-media/file?id='+invoice.id,{as:accountant})).status,200)
  await h.command('portal.invite',{kind:'vendor',vendorId:f.v.id,email:'vendor@example.test',displayName:'Vendor',source:'Assigned vendor authorized'})
  const vendor=await h.portalSignIn('vendor@example.test')
  assert.equal((await h.request('/portal/record-media?file='+work.id,{as:vendor})).status,200)
  assert.equal((await h.request('/portal/record-media?file='+invoice.id,{as:vendor})).status,200)
  assert.equal((await h.request('/portal/record-media?file='+prior.id,{as:vendor})).status,404)
  assert.equal((await h.request('/api/record-media/file?id='+work.id,{as:vendor})).status,401)
  const grants=(await(await h.request('/portal/api/me',{as:vendor})).json()).grants
  await h.command('portal.revoke',{grantId:grants[0].id,reason:'Assignment ended'})
  assert.equal((await h.request('/portal/record-media?file='+work.id,{as:vendor})).status,401)
  await inspect?.({h,...f,prior,work,invoice,video})
  console.log('media proof: exporting backup');const archive=await(await h.request('/api/backup')).text();console.log('media proof: restoring backup',Buffer.byteLength(archive))
  await fresh.formCommand('data.restore',{confirm:'RESTORE',backup:new File([archive],'media.rer')})
  console.log('media proof: comparing restored originals');for(const id of [began.id,prior.id,second.id,work.id,work2.id,invoice.id,invoice2.id])assert.deepEqual(Buffer.from(await(await fresh.request('/api/record-media/file?id='+id)).arrayBuffer()),Buffer.from(await(await get(id)).arrayBuffer()),'every original version survives restore')
  console.log('media proof: creating readable export');const zip=Buffer.from(await(await h.request('/api/readable-export')).arrayBuffer())
  const entries=new Map();let offset=0
  while(zip.readUInt32LE(offset)===0x04034b50){const size=zip.readUInt32LE(offset+18),nameLength=zip.readUInt16LE(offset+26),extraLength=zip.readUInt16LE(offset+28),name=zip.subarray(offset+30,offset+30+nameLength).toString(),start=offset+30+nameLength+extraLength;entries.set(name,zip.subarray(start,start+size));offset=start+size}
  const manifest=JSON.parse(entries.get('manifest.json')),original=manifest.files.find(x=>x.table==='tt_record_media'&&x.id===began.id)
  assert.ok(original,'readable export names the complete original video, not just chunks');assert.equal(original.sha256,sha(video));assert.deepEqual(entries.get(original.path),video)
  for(const id of [prior.id,second.id,work.id,work2.id,invoice.id,invoice2.id]){const f=manifest.files.find(x=>x.table==='tt_record_media'&&x.id===id);assert.ok(f);assert.equal(sha(entries.get(f.path)),f.sha256)}
  const history=(await(await h.request('/api/history')).json()).rows;assert.ok(history.some(x=>x.action==='read:record-media'))
 }finally{await h.close();await fresh.close()}
}
