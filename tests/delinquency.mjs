import assert from 'node:assert/strict'
import {installation,tenancyInput} from './api/harness.mjs'
import {assignmentCustody} from './delinquency-custody.mjs'

/** REPORT-002: effective-date household balances, dated-owner filters and named operational follow-up. */
export async function journey({inspect,assets=false}={}) {
 const h=await installation({assets})
 try {
  const f=await h.command('portfolio.add',{name:'East Bay residential'}),outside=await h.command('portfolio.add',{name:'Outside management'})
  const property=async(portfolioId,name)=>h.command('property.add',{portfolioId,name,address:name+', Oakland, CA',kind:'duplex',timeZone:'America/Los_Angeles'})
  const p=await property(f.id,'Linden Duplex'),other=await property(outside.id,'Outside House')
  const today=(await h.state()).portfolios.find(x=>x.id===f.id).properties[0].today,shift=n=>new Date(Date.parse(today+'T00:00:00Z')+n*86400000).toISOString().slice(0,10)
  const make=async(prop,label,email)=>{const u=await h.command('unit.add',{propertyId:prop.id,identifier:label,bedrooms:2,bathrooms:1});return h.command('tenancy.create',{...tenancyInput,unitId:u.id,tenantEmail:email,startDate:shift(-400),endDate:shift(365),rent:'2400',cadence:'monthly'})}
  const t=await make(p,'A','dana@example.test'),second=await make(p,'B','lee@example.test'),out=await make(other,'X','outside@example.test')
  await h.command('household.add',{tenancyId:t.id,role:'co_tenant',name:'Lee Ortiz',email:'lee-ortiz@example.test',joined:shift(-30)})
  const owners=[]
  for(const [name,email] of [['Ana Ruiz','ana@example.test'],['Ben Ito','ben@example.test']])owners.push(await h.command('owner.add',{kind:'individual',legalName:name,email,mailingAddress:'10 Owner Street, Oakland, CA'}))
  await h.command('ownership.set',{propertyId:p.id,effectiveFrom:shift(-400),reason:'Original recorded ownership',shares:[{ownerId:owners[0].id,percent:'100'}]})
  await h.command('ownership.set',{propertyId:p.id,effectiveFrom:shift(-10),reason:'Dated transfer to Ben',shares:[{ownerId:owners[1].id,percent:'100'}]})
  const charges=[]
  for(const [age,amount] of [[0,'100'],[12,'200'],[45,'300'],[75,'400'],[120,'500']])charges.push(await h.command('rent.charge',{tenancyId:t.id,dueDate:shift(-age),amount,description:`Recorded rent ${age} days`,reference:`LINDEN-A-${age}`}))
  await h.command('rent.charge',{tenancyId:t.id,dueDate:shift(5),amount:'900',description:'Future rent',reference:'FUTURE'})
  await h.command('rent.receipt',{chargeId:charges[2].id,amount:'50',receivedDate:shift(-2),reference:'External bank receipt',method:'ach'})
  await h.command('rent.receipt',{chargeId:charges[2].id,amount:'25',receivedDate:today,reference:'Today external cash',method:'cash'})
  await h.command('rent.adjust',{chargeId:charges[3].id,amount:'10',reason:'Reviewed correction recorded today'})
  await h.command('rent.charge',{tenancyId:second.id,dueDate:shift(-8),amount:'80',description:'Recorded unpaid rent B',reference:'LINDEN-B-8'})
  const q={asOf:today,propertyId:p.id},url=x=>'/api/delinquency?'+new URLSearchParams(x)
  const read=async(x=q,opts={})=>{const r=await h.request(url(x),opts);assert.equal(r.status,200,await r.clone().text());assert.equal(r.headers.get('cache-control'),'no-store');return r.json()}
  const before=await read(),row=before.rows.find(x=>x.tenancyId===t.id)
  assert.deepEqual(row.buckets,{current:10000,days1to30:20000,days31to60:22500,days61to90:39000,over90:50000})
  assert.equal(row.balanceCents,141500);assert.equal(row.overdueCents,131500);assert.equal(row.charges.length,5,'future-due charges are not current receivables')
  assert.equal(row.household.filter(x=>x.name==='Lee Ortiz').length,1);assert.equal(row.balanceCents,row.charges.reduce((n,x)=>n+x.outstandingCents,0),'co-tenants share one balance')
  assert.equal(row.assignment,null);assert.match(row.nextAction,/assign/i)
  const current=await read({...q,ownerId:owners[1].id}),former=await read({...q,ownerId:owners[0].id})
  assert.ok(current.rows.some(x=>x.tenancyId===t.id));assert.equal(former.rows.length,0)
  const past=await read({...q,asOf:shift(-20),ownerId:owners[0].id}),old=past.rows.find(x=>x.tenancyId===t.id)
  assert.equal(old.balanceCents,120000,'later receipts and corrections do not rewrite historical effective-date balances');assert.equal(old.ownership[0].ownerId,owners[0].id)
  const yesterday=await read({...q,asOf:shift(-1)}),prior=yesterday.rows.find(x=>x.tenancyId===t.id)
  assert.deepEqual([prior.receivedCents,prior.reductionsCents,prior.balanceCents],[5000,0,135000])
  for(const field of ['pendingFunds','returnedAch','paymentPlan','subsidyShare'])assert.ok(typeof row[field]==='string'&&row[field].includes('not recorded'),'absent workflow is unknown, never settled or zero')
  await h.stepUp()
  const staff={}
  for(const [key,role,portfolio] of [['books','bookkeeper',f],['member','member',f],['outside','bookkeeper',outside],['accountant','accountant',f]]){
   const email=key+'-aging@example.test';await h.command('operator.invite',{displayName:key,email,role,['portfolio:'+portfolio.id]:'1'});staff[key]=await h.accept(email)
  }
  const people=await(await h.request('/auth/operators')).json(),who=key=>people.find(x=>x.email===key+'-aging@example.test').id
  const draft=await h.command('arrears.prepare',{tenancyId:t.id,message:'Please review the outstanding rent with Dana.',followUpDate:shift(2)},{as:staff.member});await h.command('proposal.approve',{proposalId:draft.id})
  await h.command('delinquency.assign',{tenancyId:t.id,assignedTo:who('books'),version:0,reference:'Morning collection meeting'},{as:staff.member,status:403})
  await h.command('delinquency.assign',{tenancyId:t.id,assignedTo:who('outside'),version:0,reference:'Wrong portfolio'},{as:staff.books,status:409})
  await h.command('delinquency.assign',{tenancyId:out.id,assignedTo:who('books'),version:0,reference:'Wrong household'},{as:staff.books,status:404})
  await h.command('delinquency.assign',{tenancyId:t.id,assignedTo:who('books'),version:0,reference:'Morning collection meeting'},{as:staff.books})
  await h.command('delinquency.assign',{tenancyId:t.id,assignedTo:who('books'),version:0,reference:'Stale reassignment'},{as:staff.books,status:409})
  const assigned=(await read()).rows.find(x=>x.tenancyId===t.id)
  assert.equal(assigned.assignment.assignedTo,who('books'));assert.equal(assigned.approvedDraft.proposalId,draft.id);assert.equal(assigned.approvedDraft.followUpDate,shift(2));assert.match(assigned.nextAction,/review and send externally/)
  assert.equal((await h.request(url(q),{as:staff.member})).status,403);assert.equal((await h.request(url(q),{as:''})).status,401)
  assert.equal((await h.request(url({...q,propertyId:other.id}),{as:staff.accountant})).status,404)
  assert.equal((await h.request(url({...q,tenancyId:out.id}),{as:staff.accountant})).status,404)
  const scoped=await read(q,{as:staff.accountant});assert.ok(scoped.rows.every(x=>x.propertyId===p.id))
  const csv=await h.request(url({...q,ownerId:owners[1].id,format:'csv'}),{as:staff.accountant});assert.equal(csv.status,200);assert.equal(csv.headers.get('cache-control'),'no-store');const text=await csv.text();assert.ok(text.includes('External bank receipt'));assert.ok(text.includes('Morning collection meeting'));assert.ok(!text.includes('Outside House'))
  assert.equal((await h.request(url({...q,asOf:shift(1)}))).status,400)
  const access=await(await h.request('/api/resident-access?tenancyId='+t.id)).json()
  assert.equal(access.followupAssignments[0].reference,'Morning collection meeting');assert.ok(!Object.keys(access.followupAssignments[0]).some(k=>/assigned_to|assigned_by|email/i.test(k)),'subject access includes references without staff identity')
  const backup=await(await h.request('/api/backup')).text(),fresh=await installation()
  try{await fresh.formCommand('data.restore',{backup:new File([backup],'backup.rer',{type:'application/json'}),confirm:'RESTORE'});const restored=await(await fresh.request(url(q))).json(),restoredRow=restored.rows.find(x=>x.tenancyId===t.id);assert.equal(restoredRow.balanceCents,141500);assert.equal(restoredRow.assignment.assignedTo,null,'source staff identity never becomes destination authority');assert.ok(restoredRow.assignment.reference.includes('Morning collection meeting'))}finally{await fresh.close()}
  const csvImport=['ref,address,owner_name,owner_email,tenant_name,tenant_email,start_date,end_date,rent,cadence,created_at',`FOLLOWUP-1,10 Source Street,Owner,source-owner@example.test,Source Resident,source-resident@example.test,2024-01-01,${shift(365)},1000.00,monthly,2024-01-01T00:00:00.000Z`].join('\n')
  const previewImport=await h.command('import.preview',{csv:csvImport,namespace:'aging-undo'}),appliedImport=await h.command('import.apply',{csv:csvImport,namespace:'aging-undo',fingerprint:previewImport.fingerprint}),importId=previewImport.rows[0].targetId
  await h.command('delinquency.assign',{tenancyId:importId,assignedTo:people.find(x=>x.email==='owner@example.test').id,version:0,reference:'Later native collection work'})
  await h.command('import.undo',{jobId:appliedImport.job.id},{status:409});assert.ok((await h.state()).tenancies.some(x=>x.id===importId),'import undo preserves assigned native follow-up')
  if(inspect)await inspect({h,p,q,t,staff})
  await h.command('operator.status',{operatorId:who('books'),status:'inactive'})
  const revoked=(await read()).rows.find(x=>x.tenancyId===t.id);assert.ok(!revoked.assignment||revoked.assignment.assignedTo===null);assert.match(revoked.nextAction,/assign/i,'inactive assignee cannot remain the accountable follow-up person')
 }finally{await h.close()}
 await assignmentCustody()
}
