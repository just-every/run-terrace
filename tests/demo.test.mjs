import {test} from 'node:test'
import assert from 'node:assert/strict'
import {execFile} from 'node:child_process'
import {promisify} from 'node:util'
import {installation} from './api/harness.mjs'

const exec=promisify(execFile)
async function refusesProduction(verb){
 let failure
 try{
  // This subprocess is a CI assertion; the public queue bypass requires its
  // original environment to declare CI, before the CLI imports queue policy.
  await exec(process.execPath,['node_modules/@runeditrun/rer/global/rer.mjs',verb,'--json','--non-interactive','--no-queue'],{
   env:{...process.env,CI:'true',RER_DEMO:'1',RER_NODE_AUTO:'0'},timeout:30000,maxBuffer:1024*1024,
  })
 }catch(error){failure=error}
 assert.ok(failure,`rer ${verb} must refuse demo mode`)
 assert.ok(!failure.killed,`rer ${verb} must refuse before running project work`)
 assert.match((failure.stdout??'')+(failure.stderr??''),/Production build and deploy refuse[^\n]*RER_DEMO/,`rer ${verb} rejects the demo binding`)
}
const cookieFrom=response=>response.headers.getSetCookie().map(value=>value.split(';')[0]).join('; ')

// This local journey proves the actual Worker/D1 product doors. Hosted admission
// and visitor isolation are exercised separately against the deployed demo.
test('DEMO-001: ordinary installs are empty; native demo records, approvals and mail suppression persist',async()=>{
 for(const verb of ['build','deploy'])await refusesProduction(verb)
 const ordinary=await installation({asyncDatabase:true})
 try{
  const empty=await ordinary.state()
  assert.deepEqual(empty.tenancies,[],'an ordinary installation has no fabricated tenancies')
  assert.deepEqual(empty.portfolios,[])
  assert.equal((await ordinary.request('/auth/one-click?as=owner%40example.test&returnTo=%2Fapp',{as:''})).status,404,'ordinary production-style one-click is unavailable without dev admission')
 }finally{await ordinary.close()}

 const h=await installation({demo:true,asyncDatabase:true})
 try{
  const initial=await h.state()
  assert.ok(initial.tenancies.length>0,'demo mode seeds real tenancies after owner bootstrap')
  const details=[]
  for(const tenancy of initial.tenancies)details.push(await h.state(tenancy.id))
  assert.ok(details.some(s=>s.ledger.charges.length&&s.ledger.receipts.length),'the demo has linked rent history')
  for(const kind of ['renewal','arrears'])assert.ok(details.some(s=>s.proposals.some(p=>p.kind===kind&&p.state==='pending')),`a ${kind} awaits a person`)
  const jobs=details.flatMap(s=>s.work.jobs)
  for(const state of ['pending','approved','sent'])assert.ok(jobs.some(j=>j.state===state),`maintenance includes ${state} work`)
  const photo=details.flatMap(s=>s.work.photos)[0]
  assert.ok(photo,'an inspection has an original photograph')
  const image=await h.request('/api/inspections/photos/'+encodeURIComponent(photo.id))
  assert.equal(image.status,200)
  assert.equal(image.headers.get('content-type'),photo.media_type)
  assert.equal((await image.arrayBuffer()).byteLength,photo.size,'the original photo bytes are served')

  const entry=await h.request('/auth/one-click?as=demo-preparer%40example.test&returnTo=%2Fapp',{as:''})
  assert.equal(entry.status,303)
  assert.equal(entry.headers.get('location'),'/app')
  const preparer=cookieFrom(entry)
  assert.ok(preparer,'native one-click issues a real session cookie')
  const session=await(await h.request('/auth/session',{as:preparer})).json()
  assert.equal(session.kind,'native','demo access uses native auth rather than the dev-key session tier')
  assert.equal(session.operator.role,'member')
  const proposal=details.flatMap(s=>s.proposals).find(p=>p.kind==='renewal'&&p.state==='pending')
  const pending=jobs.find(j=>j.state==='pending'&&j.tenancy_id!==proposal.tenancy_id)
  assert.ok(pending,'a separate tenancy has prepared maintenance')
  await h.command('proposal.approve',{proposalId:proposal.id},{as:preparer,status:403})
  await h.command('maintenance.approve',{jobId:pending.id,version:pending.version},{as:preparer,status:403})
  assert.equal((await h.state(proposal.tenancy_id)).proposals.find(p=>p.id===proposal.id).state,'pending')
  await h.command('proposal.approve',{proposalId:proposal.id})
  const approved=await h.command('maintenance.approve',{jobId:pending.id,version:pending.version})
  const packet=await h.request('/api/maintenance/'+encodeURIComponent(pending.id)+'/packet')
  assert.equal(packet.status,200)
  assert.ok((await packet.text()).includes(pending.trade_email),'the unsent packet names the approved recipient')
  await h.command('maintenance.sent',{jobId:pending.id,version:approved.version,reference:'Demo visitor recorded external handoff'})

  // Mail is a real application action; only the outbound provider edge is fake.
  const invitation=await h.request('/auth/invite',{method:'POST',body:{email:'demo-invited@example.test',displayName:'Demo visitor',role:'member'}})
  assert.equal(invitation.status,202)
  assert.equal((await invitation.json()).status,'accepted')
  const people=await(await h.request('/auth/operators')).json()
  assert.ok(people.some(p=>p.email==='demo-invited@example.test'&&p.status==='invited'),'suppression retains the real invitation workflow')
  const rename=await h.request('/auth/display-name',{method:'POST',body:{displayName:'Demo visiting owner'}})
  assert.equal(rename.status,200)
  assert.equal((await h.request('/app')).status,200)
  const refreshed=await h.state()
  assert.deepEqual(refreshed.tenancies.map(t=>t.id).sort(),initial.tenancies.map(t=>t.id).sort(),'refresh does not duplicate the portfolio')
  assert.equal((await h.state(proposal.tenancy_id)).proposals.find(p=>p.id===proposal.id).state,'approved')
  const work=(await h.state(pending.tenancy_id)).work.jobs.find(j=>j.id===pending.id)
  assert.equal(work.state,'sent')
  assert.equal(work.approved_role,'owner')
  assert.notEqual(work.approved_by,work.prepared_by,'the authenticated person approves the preparer’s work')
  const owner=await(await h.request('/auth/session')).json()
  assert.equal(owner.operator.displayName,'Demo visiting owner','seed runs once instead of overwriting visitor edits on refresh')
  await h.command('message.send',{messageId:'synthetic-terrace-230',version:1},{status:403})
  for(const path of ['/api/twilio/inbound','/api/twilio/status'])assert.equal((await h.request(path,{method:'POST',as:'',form:new URLSearchParams({Body:'Y'})})).status,403,'demo messaging door blocks egress and callbacks')
  assert.equal(h.messages.length,0,'no provider request escaped demo mode during invitations or work approval/handoff')
 }finally{await h.close()}
})
