// PORT-006: roommate changes and unit transfers close and reopen the people named on each charge, by date.
import assert from 'node:assert/strict'
import {installation,tenancyInput} from './api/harness.mjs'
export async function journey(){
 const h=await installation()
 try{
  const zone='America/Los_Angeles',f=await h.command('portfolio.add',{name:'North'}),p=await h.command('property.add',{portfolioId:f.id,name:'North House',address:'1 North Road, Oakland, CA 94607',kind:'duplex',timeZone:zone})
  const a=await h.command('unit.add',{propertyId:p.id,identifier:'A',bedrooms:2,bathrooms:1}),b=await h.command('unit.add',{propertyId:p.id,identifier:'B',bedrooms:2,bathrooms:1})
  const t=await h.command('tenancy.create',{...tenancyInput,address:'Unit A, North Road, Oakland, CA',unitId:a.id,tenantName:'Alex Chen',tenantEmail:'alex@example.test',startDate:'2026-01-01',endDate:'2026-12-31',rent:'1000.00',cadence:'monthly'})
  const charge=(tenancyId,due)=>h.command('rent.charge',{tenancyId,dueDate:due,amount:'1000.00',description:'Rent '+due.slice(0,7),reference:'ROOMMATE-'+tenancyId.slice(0,4)+due})
  for(const due of ['2026-02-01','2026-04-01','2026-06-01'])await charge(t.id,due)
  const sam=await h.command('household.add',{tenancyId:t.id,role:'co_tenant',name:'Sam Oakes',email:'sam-roommate@example.test',joined:'2026-01-01'})
  const guarantor=await h.command('household.add',{tenancyId:t.id,role:'guarantor',name:'Pat Guarantor',joined:'2026-01-01'})
  await h.command('household.add',{tenancyId:t.id,role:'occupant',name:'Robin Occupant',joined:'2026-01-01'})
  const named=async(tenancyId=t.id)=>Object.fromEntries((await h.state(tenancyId)).household.chargeLiability.map(q=>[q.dueDate,[...q.liable].sort()]))
  assert.deepEqual(await named(),{'2026-02-01':['Alex Chen','Pat Guarantor','Sam Oakes'],'2026-04-01':['Alex Chen','Pat Guarantor','Sam Oakes'],'2026-06-01':['Alex Chen','Pat Guarantor','Sam Oakes']},'occupants are never named on a charge')
  // A roommate leaves on 31 March: named through that day, not after. A replacement joining on 1 May is never named on earlier charges.
  await h.command('household.leave',{memberId:sam.id,left:'2026-03-31'})
  const lee=await h.command('household.add',{tenancyId:t.id,role:'co_tenant',name:'Lee Park',email:'lee-roommate@example.test',joined:'2026-05-01'})
  assert.deepEqual(await named(),{'2026-02-01':['Alex Chen','Pat Guarantor','Sam Oakes'],'2026-04-01':['Alex Chen','Pat Guarantor'],'2026-06-01':['Alex Chen','Lee Park','Pat Guarantor']})
  // A transfer on 1 June carries everyone who joined before it; the old lease closes them the day before and the new lease opens them on the move-in day.
  const moved=await h.command('tenancy.transfer',{tenancyId:t.id,unitId:b.id,moveIn:'2026-07-01',stay:[guarantor.id]})
  assert.match(moved.notice,/2 household members moved/)
  const old=(await h.state(t.id)).household.members,next=(await h.state(moved.id)).household.members
  assert.deepEqual(old.filter(m=>m.left_on&&m.moved_to).map(m=>[m.name,m.left_on]).sort(),[['Lee Park','2026-06-30'],['Robin Occupant','2026-06-30']].sort())
  assert.ok(old.find(m=>m.name==='Pat Guarantor').left_on===null,'a member named in stay remains on the old lease')
  assert.deepEqual(next.filter(m=>m.id).map(m=>[m.name,m.role,m.joined]).sort(),[['Lee Park','co_tenant','2026-07-01'],['Robin Occupant','occupant','2026-07-01']].sort())
  await charge(moved.id,'2026-08-01');await charge(moved.id,'2026-09-01')
  assert.deepEqual(await named(moved.id),{'2026-08-01':['Alex Chen','Lee Park'],'2026-09-01':['Alex Chen','Lee Park']},'the new lease names the carried co-tenant from the move-in day')
  assert.deepEqual((await named()),{'2026-02-01':['Alex Chen','Pat Guarantor','Sam Oakes'],'2026-04-01':['Alex Chen','Pat Guarantor'],'2026-06-01':['Alex Chen','Lee Park','Pat Guarantor']},'the old lease keeps its own history')
  // Replay, a stale member and a moved member cannot be carried twice, and the page shows the dated liability.
  await h.command('tenancy.transfer',{tenancyId:t.id,unitId:a.id,moveIn:'2026-07-15'},{status:409})
  await h.command('household.leave',{memberId:lee.id,left:'2026-06-30'},{status:409})
  const page=await(await h.request('/app?tab=tenancy&tenancy='+moved.id)).text();assert.ok(page.includes('Who is named on each charge')&&page.includes('Alex Chen, Lee Park'))
  const restored=await installation();try{await restored.formCommand('data.restore',{confirm:'RESTORE',backup:new File([await(await h.request('/api/backup')).text()],'backup.rer')});assert.deepEqual((await restored.state(moved.id)).household.chargeLiability,(await h.state(moved.id)).household.chargeLiability,'liability dates survive a restore')}finally{await restored.close()}
 }finally{await h.close()}
}
