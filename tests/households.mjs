// PORT-004: primary and added members use identical property-local joined/left bounds.
import assert from 'node:assert/strict'
import {installation,tenancyInput} from './api/harness.mjs'
export async function journey({assets=false,inspect}={}){
 const h=await installation({assets})
 try {
  const zone='America/Los_Angeles',today=new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())
  const add=n=>new Date(Date.parse(today+'T12:00:00Z')+n*864e5).toISOString().slice(0,10)
  const leases=[]
  for(const [name,start,expected]of [['Future resident',add(1),false],['Joining today',today,true],['Leaving today',add(-30),true],['Left yesterday',add(-30),false]]){
   const t=await h.command('tenancy.create',{...tenancyInput,address:name+' at 1 Alder Street, Oakland, CA',tenantName:name,tenantEmail:name.replaceAll(' ','-').toLowerCase()+'@example.test',timeZone:zone,startDate:start,endDate:add(365)})
   if(name==='Leaving today'||name==='Left yesterday')await h.command('tenancy.end',{tenancyId:t.id,moveOut:name==='Leaving today'?today:add(-1),reason:'synthetic-terrace-1'})
   const hh=(await h.state(t.id)).household,m=hh.members[0]
   assert.deepEqual([m.current,m.recipient,m.documents],[expected,expected,expected],name+' uses inclusive dates in the property zone')
   assert.deepEqual(hh.recipients,expected?[name]:[]);assert.deepEqual(hh.liable,expected?[name]:[])
   leases.push(t)
  }
  const future=leases[0],active=leases[1]
  await h.command('household.add',{tenancyId:future.id,role:'co_tenant',name:'Future co-tenant',email:'future-co@example.test',joined:add(1)})
  const hh=(await h.state(future.id)).household
  assert.ok(hh.members.every(m=>!m.current&&!m.recipient&&!m.documents));assert.deepEqual(hh.recipients,[])
  const before=(await h.state(active.id)).household
  await h.restart()
  assert.deepEqual((await h.state(active.id)).household,before,'membership bounds survive restart')
  if(inspect)await inspect({h,future,active,today})
 }finally{await h.close()}
}
