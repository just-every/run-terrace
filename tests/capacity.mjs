// SAFE-009 local readiness journey. This is not a Cloudflare reference-deployment capacity receipt.
// The strict check fails until every required reference-deployment measurement is available.
import assert from 'node:assert/strict'
import {execFileSync} from 'node:child_process'
import {writeFile,mkdir} from 'node:fs/promises'
import {dirname} from 'node:path'
import {installation} from './api/harness.mjs'
import {seedCapacity,counts} from './capacity-fixture.mjs'
const head=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim()
assert.equal(execFileSync('git',['status','--porcelain','--untracked-files=no'],{encoding:'utf8'}).trim(),'','Run the scale journey on a clean committed candidate.')
const h=await installation(),results={date:new Date().toISOString(),commit:head,deployment:'local Miniflare with real Worker and D1',referenceDeployment:false,counts,measurements:{},unmeasured:['reference deployment','bank auto-matching 1500 lines','three-way reconciliation','complete 150-owner statement batch','staff and portal p95'],capacityQualified:false}
const measured=async(name,boundMs,run)=>{const start=performance.now(),value=await run(),elapsedMs=Math.round((performance.now()-start)*100)/100;results.measurements[name]={elapsedMs,boundMs,withinBound:elapsedMs<=boundMs,scope:'local readiness only'};assert.ok(elapsedMs<=boundMs,name+' exceeds its bound');return value}
try {
 const fixture=await seedCapacity(h.command,message=>console.log(message))
 const state=await h.state(),properties=state.portfolios.flatMap(f=>f.properties),units=properties.flatMap(p=>p.units)
 assert.deepEqual([properties.length,units.length,state.tenancies.length,state.ownership.directory.length],[60,500,600,150])
 assert.equal(units.flatMap(u=>u.history).filter(t=>t.state==='past').length,50)
 assert.equal(units.flatMap(u=>u.history).filter(t=>t.state==='future').length,50)
 let residentCount=0,cursor=null
 const households=new Set()
 do {
  const response=await h.request('/api/v1/households?limit=200'+(cursor?'&cursor='+encodeURIComponent(cursor):''))
  assert.equal(response.status,200)
  const page=await response.json()
  for(const household of page.data){assert.ok(!households.has(household.tenancyId),'pagination never repeats a household');households.add(household.tenancyId);residentCount+=household.members.length}
  cursor=page.next
 }while(cursor)
 const vendorCount=(await h.state(fixture.leases[0].id)).work.vendors.length
 assert.deepEqual([households.size,residentCount,vendorCount],[600,1200,250])
 const run=await h.command('charges.preview',{month:'2026-10'})
 assert.equal(run.newLines,500)
 const posted=await measured('rentPosting',60000,()=>h.command('charges.post',{month:'2026-10',fingerprint:run.fingerprint}))
 assert.equal(posted.posted,500)
 assert.equal((await h.command('charges.post',{month:'2026-10',fingerprint:(await h.command('charges.preview',{month:'2026-10'})).fingerprint})).posted,0,'capacity-sized replay posts no duplicate')
 const get=async path=>{const r=await h.request(path);assert.equal(r.status,200);return r.json()}
 const roll=await measured('rentRoll',5000,()=>get('/api/rent-roll?asOf=2026-10-01'))
 assert.equal(roll.rows.length,500)
 const delinquency=await measured('delinquency',5000,()=>get('/api/delinquency?asOf=2026-10-01'))
 assert.ok(delinquency.rows.length>=500)
 const first=await h.state(fixture.leases[0].id)
 assert.equal(first.ledger.charges.length,25,'24 history months plus the measured month survive readback')
 assert.equal(h.messages.length,0,'the scale fixture sends no outbound mail')
 results.fixtureVerified=true
} finally {
 await h.close()
 if(process.env.CAPACITY_RESULT){await mkdir(dirname(process.env.CAPACITY_RESULT),{recursive:true});await writeFile(process.env.CAPACITY_RESULT,JSON.stringify(results,null,2)+'\n')}
 console.log(JSON.stringify(results,null,2))
}
if(process.argv.includes('--require-reference'))assert.ok(results.capacityQualified,'SAFE-009 is incomplete: '+results.unmeasured.join('; '))
