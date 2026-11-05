import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import {installation,tenancyInput} from './api/harness.mjs'

export async function journey(){
 const h=await installation({now:'2026-11-04T16:00:00Z'})
 try{
  const t=await h.command('tenancy.create',{...tenancyInput,startDate:'2026-03-01',endDate:'2027-02-28',rent:'2875',cadence:'monthly',timeZone:'America/New_York'})
  for(const [endDate,rent]of [['2028-02-29','2990'],['2029-02-28','3100']]){
   const p=await h.command('renewal.prepare',{tenancyId:t.id,endDate,rent,source:'Signed renewal schedule'})
   await h.command('proposal.approve',{proposalId:p.id})
  }
  const current=async()=> (await h.state(t.id)).tenancies.find(x=>x.id===t.id)
  let lease=await current()
  assert.deepEqual([lease.current_terms.start_date,lease.current_terms.end_date,lease.current_terms.rent_cents],['2026-03-01','2027-02-28',287500])
  assert.deepEqual(lease.upcoming_terms.map(x=>[x.start_date,x.end_date,x.rent_cents]),[['2027-03-01','2028-02-29',299000],['2028-03-01','2029-02-28',310000]])
  assert.deepEqual(lease.lease_history.map(x=>[x.end_date,x.rent_cents]),[['2027-02-28',287500],['2028-02-29',299000]])
  assert.ok(lease.lease_history.every(x=>x.confirmed_by&&x.confirmed_at))
  for(const [reference,description,reduction]of [['RENT-NOV','November rent','115'],['PARK-NOV','Parking','2870']]){
   const q=await h.command('rent.charge',{tenancyId:t.id,dueDate:'2026-11-01',amount:'2990',description,reference})
   await h.command('rent.adjust',{chargeId:q.id,amount:reduction,reason:description+' corrected to signed terms'})
   if(reference==='RENT-NOV')await h.command('rent.receipt',{chargeId:q.id,amount:'1500',receivedDate:'2026-11-03',reference:'BANK-NOV'})
  }
  const state=await h.state(t.id)
  assert.deepEqual(state.ledger.charges.map(x=>[x.amount_cents,x.reduced_cents,x.net_cents,x.balance_cents]),[[299000,11500,287500,137500],[299000,287000,12000,12000]])
  const home=await(await h.request('/app')).text()
  assert.ok(home.includes('recorded of $2,995.00 due')&&home.includes('value="50"')&&home.includes('$1,495.00 outstanding'))
  const csv=await(await h.request(`/api/statement?tenancyId=${t.id}&from=2026-10-01&to=2026-11-30`)).text()
  for(const [ref,reason]of [['RENT-NOV','November rent corrected to signed terms'],['PARK-NOV','Parking corrected to signed terms']])assert.ok(csv.split('\r\n').some(row=>row.includes('"Charge reduction","'+ref+'"')&&row.endsWith('"'+reason+'"')))
  const bytes=Buffer.concat([Buffer.from([239,187,191]),Buffer.from((await readFile('fixtures/terrace-tenancies.csv','utf8')).replaceAll('\n','\r\n'))])
  const preview=await h.formCommand('import.preview',{namespace:'original-file',csvFile:new File([bytes],'tenancies.csv')})
  const applied=await h.command('import.apply',{namespace:'original-file',csvBase64:preview.csvBase64,fingerprint:preview.fingerprint})
  const retained=(await h.command('import.journal',{jobId:applied.job.id})).originals[0]
  assert.deepEqual(Buffer.from(retained.original.base64,'base64'),bytes)
  assert.equal(retained.sha256,createHash('sha256').update(bytes).digest('hex'))
  for(const [now,rent,end]of [['2027-03-01T04:59:59Z',287500,'2027-02-28'],['2027-03-01T05:00:00Z',299000,'2028-02-29'],['2028-03-01T05:00:00Z',310000,'2029-02-28']]){
   await h.setTime(now);lease=await current()
   assert.deepEqual([lease.current_terms.rent_cents,lease.current_terms.end_date],[rent,end],'property-local effective boundary')
   const roll=await(await h.request('/api/rent-roll?asOf='+now.slice(0,10))).json()
   if(now.endsWith('05:00:00Z'))assert.deepEqual([roll.rows.find(x=>x.tenancyId===t.id).contractRentCents,roll.rows.find(x=>x.tenancyId===t.id).leaseEnd],[rent,end])
  }
  // The original October tile repro uses the same net-due arithmetic.
  await h.setTime('2026-10-27T16:00:00Z')
  const maya=await h.command('tenancy.create',{...tenancyInput,tenantName:'Maya Chen',rent:'1850',cadence:'monthly'})
  const october=await h.command('rent.charge',{tenancyId:maya.id,dueDate:'2026-10-01',amount:'1850',description:'October rent',reference:'RENT-2026-10-2B'})
  await h.command('rent.receipt',{chargeId:october.id,amount:'900',receivedDate:'2026-10-26',reference:'BANK-OCT-2B'})
  await h.command('rent.adjust',{chargeId:october.id,amount:'50',reason:'Agreed October correction'})
  const octoberHome=await(await h.request('/app')).text()
  assert.ok(octoberHome.includes('recorded of $1,800.00 due')&&octoberHome.includes('value="50"')&&octoberHome.includes('$900.00 outstanding'))
 }finally{await h.close()}
}
