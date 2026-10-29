import { all, can, insist, one, tenancy, type Context, type Row } from '../core'
import { companyData } from '../company'
import { tenancyData, proposals } from '../tenancies'
import { workData } from '../work'
import { agentWorkloads } from '../agent-workloads'
import { preview } from '../charge-run'
import { redactErrorReport } from '../sensitive-metadata'

export async function nativeJob(c: Context, args: Row) {
 const row = await one(c,'SELECT * FROM tt_maintenance_jobs WHERE id=?',String(args.jobId ?? ''))
 insist(row,'not_found','Maintenance job not found.',404)
 await tenancy(c,row.tenancy_id)
 return row
}
export async function nativeWorkload(c: Context, args: Row) {
 const row = await one(c,'SELECT * FROM tt_agent_workloads WHERE id=?',String(args.workloadId ?? ''))
 insist(row && (c.actor.role === 'owner' || c.actor.credential && c.actor.id === row.credential_id),'not_found','Workload not found.',404)
 await tenancy(c,row.tenancy_id)
 return row
}
/** Native services retain role/portfolio filtering; the witness excludes auth and audit stores. */
export async function read(c: Context, action: string, args: Row): Promise<Row> {
 if (action === 'company.read') return redactErrorReport(await companyData(c)) as Row
 if (action === 'charges.preview') return redactErrorReport(await preview(c,args.month)) as Row
 if (action === 'tenancy.read') {
  const t = await tenancy(c,args.tenancyId)
  return redactErrorReport({tenancy:t,proposals:await proposals(c,t.id)}) as Row
 }
 if (action === 'work.read') {
  const j = await nativeJob(c,args)
  const data = await workData(c,j.tenancy_id)
  return redactErrorReport({job:j,quotes:data.quotes.filter((q: Row)=>q.job_id===j.id)}) as Row
 }
 if (action === 'agent.read') {
  const row = await nativeWorkload(c,args)
  const data = await agentWorkloads(c)
  return redactErrorReport({workload:data.workloads.find(w=>w.id===row.id)}) as Row
 }
 const tenancies = await tenancyData(c)
 const records = await Promise.all(tenancies.map(async t => ({
  tenancy:t,proposals:await proposals(c,t.id),
  ...(can(c,'work.read') ? {work:await workData(c,t.id)} : {}),
  ...(can(c,'correction.prepare') ? {corrections:await all(c,'SELECT id,kind,payload,reason,state FROM tt_close_corrections WHERE tenancy_id=? ORDER BY id',t.id)} : {}),
 })))
 const workloads = c.actor.role === 'owner' || c.actor.credential ? await agentWorkloads(c) : {workloads:[]}
 return redactErrorReport({records,...workloads}) as Row
}
export function mayRead(action: string) {
 // These aggregate native GET views have no separate action grant in Terrace.
 return ['company.read','portfolio.read','tenancy.read','agent.read'].includes(action)
}
