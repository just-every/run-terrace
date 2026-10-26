/** MOVE-009: the tenancy-linked schema. Future record kinds join this declaration
 * before shipping. Incoming transfers and household moves are dependencies too.
 * The same predicates drive ordinary undo, preview and every atomic batch fence. */
import { canonicalJson, sha256 } from '../modules/import-kit/src/d1/index.ts'
import type { D1Database, D1Sql } from '../modules/import-kit/src/d1/index.ts'
import type { Row } from './core'

export const tenancyDependencies: [string, string][] = [
 ...['tt_resident_deliveries','tt_charges','tt_proposals','tt_lease_history','tt_inspections','tt_maintenance_jobs','tt_assets','tt_schedules','tt_household_members','tt_lease_terms','tt_lease_versions','tt_delinquency_assignments','tt_delinquency_assignment_events','tt_renewals','tt_close_corrections','tt_recovery_authorizations','tt_utility_allocations','tt_renewal_events','tt_legal_holds','tt_privacy_requests','tt_erasure_work','tt_bill_subjects','tt_emergencies','tt_move_checklists','tt_workflow_runs','tt_workflow_events','tt_payments','tt_payment_policies','tt_late_fee_policies','tt_late_fee_runs','tt_financial_actions'].map(table => [table, 'r.tenancy_id=s.id'] as [string,string]),
 ...['tt_payment_allocations','tt_payment_events'].map(table=>[table,'r.payment_id IN (SELECT id FROM tt_payments WHERE tenancy_id=s.id)'] as [string,string]),
 ['tt_late_fees','r.source_charge_id IN (SELECT id FROM tt_charges WHERE tenancy_id=s.id)'],
 ['tt_late_fee_waivers','r.fee_id IN (SELECT f.id FROM tt_late_fees f JOIN tt_charges q ON q.id=f.fee_charge_id WHERE q.tenancy_id=s.id)'],
 ...['tt_financial_revisions','tt_financial_approvals','tt_financial_recordings','tt_refund_checks','tt_financial_cancellations'].map(table=>[table,'r.action_id IN (SELECT id FROM tt_financial_actions WHERE tenancy_id=s.id)'] as [string,string]),
 ['tt_resident_delivery_events','r.delivery_id IN (SELECT id FROM tt_resident_deliveries WHERE tenancy_id=s.id)'],
 ['tt_tenancies','r.transferred_from=s.id'],
 ['tt_household_members','r.moved_to IN (SELECT id FROM tt_household_members WHERE tenancy_id=s.id)'],
 ['tt_journal','r.tenancy_id=s.id'],
 ['tt_receipts','r.charge_id IN (SELECT id FROM tt_charges WHERE tenancy_id=s.id)'],
 ['tt_adjustments','r.charge_id IN (SELECT id FROM tt_charges WHERE tenancy_id=s.id)'],
 ['tt_lease_sources','r.lease_version_id IN (SELECT id FROM tt_lease_versions WHERE tenancy_id=s.id)'],
 ['tt_inspection_photos','r.inspection_id IN (SELECT id FROM tt_inspections WHERE tenancy_id=s.id)'],
 ...['tt_vendor_assignments','tt_vendor_exceptions','tt_job_quotes','tt_owner_decisions','tt_maintenance_approvals','tt_completion_attempts','tt_resident_checks','tt_job_closures','tt_appointments','tt_dispatches'].map(table => [table,'r.job_id IN (SELECT id FROM tt_maintenance_jobs WHERE tenancy_id=s.id)'] as [string,string]),
 ['tt_schedule_occurrences','r.schedule_id IN (SELECT id FROM tt_schedules WHERE tenancy_id=s.id)'],
 ['tt_appointment_events','r.appointment_id IN (SELECT a.id FROM tt_appointments a JOIN tt_maintenance_jobs j ON j.id=a.job_id WHERE j.tenancy_id=s.id)'],
 ['tt_dispatch_events','r.dispatch_id IN (SELECT d.id FROM tt_dispatches d JOIN tt_maintenance_jobs j ON j.id=d.job_id WHERE j.tenancy_id=s.id)'],
 ['tt_emergency_events','r.emergency_id IN (SELECT id FROM tt_emergencies WHERE tenancy_id=s.id)'],
 ['tt_utility_bills','r.id IN (SELECT bill_id FROM tt_utility_allocations WHERE tenancy_id=s.id)'],
 ['tt_bills',"r.id IN (SELECT entity_id FROM tt_bill_subjects WHERE tenancy_id=s.id AND kind='bill')"],
 ['tt_bill_templates',"r.id IN (SELECT entity_id FROM tt_bill_subjects WHERE tenancy_id=s.id AND kind='template')"],
 ...['tt_bill_revisions','tt_bill_attachments','tt_bill_decisions','tt_bill_approvals','tt_bill_expenses'].map(table=>[table,"r.bill_id IN (SELECT entity_id FROM tt_bill_subjects WHERE tenancy_id=s.id AND kind='bill')"] as [string,string]),
 ...['tt_bill_template_revisions','tt_bill_template_approvals'].map(table=>[table,"r.template_id IN (SELECT entity_id FROM tt_bill_subjects WHERE tenancy_id=s.id AND kind='template')"] as [string,string]),
 ['tt_fees',"r.source='lease:'||s.id OR r.source IN (SELECT 'receipt:'||x.id FROM tt_receipts x JOIN tt_charges q ON q.id=x.charge_id WHERE q.tenancy_id=s.id) OR r.source IN (SELECT 'renewal:'||id FROM tt_proposals WHERE tenancy_id=s.id)"],
]
const either = (terms:string[]):string => terms.length===1?terms[0]:`(${either(terms.slice(0,Math.floor(terms.length/2)))} OR ${either(terms.slice(Math.floor(terms.length/2)))})`
export const relatedTenancy = (column: string) => either(tenancyDependencies.map(([table,where]) => `EXISTS(SELECT 1 FROM ${table} r WHERE ${where.replaceAll('s.id',column)})`))
export type DependencyRow = { tenancyId: string; kind: string; record: Row }
export type DependencySnapshot = { rows: DependencyRow[]; groups: DependencyRow[][]; encoded: string; query: string; ids: string[] }

/** One read observes the entire set, including absence. File bodies remain in
 * their immutable custody tables; reports carry their digest and byte length. */
export async function dependencySnapshot(db: D1Database, ids: string[]): Promise<DependencySnapshot> {
 const tables = [...new Set(['tt_tenancies',...tenancyDependencies.map(([table]) => table)])]
 const columns = (await Promise.all(tables.map(async tab=>(await db.prepare(`PRAGMA table_info(${tab})`).all<{name:string;type:string}>()).results.map(c=>({...c,tab}))))).flat()
 const clauses: [string,string,string][] = [['tt_tenancies','r.id=s.id','tenancy'],...tables.flatMap(table => {
  const where=tenancyDependencies.filter(([t])=>t===table).map(([,w])=>`(${w})`).join(' OR ')
  return where ? [[table,where,table] as [string,string,string]] : []
 })]
 const selects=clauses.map(([table,where,kind])=>{
  const cols=columns.filter(c=>c.tab===table)
  if(!cols.length)throw new Error('COMPENSATION_SNAPSHOT_UNAVAILABLE')
  const values=cols.map(c=>`'${c.name}',${c.type==='BLOB'?`length(r."${c.name}")`:`r."${c.name}"`}`).join(',')
  return `SELECT s.id AS tenancyId,'${kind}' AS kind,json_object(${values}) AS record FROM subjects s JOIN ${table} r ON (${where})`
 })
 const parts=[]
 // D1 caps compound SELECT terms. Each bounded group retains its own order.
 for(let i=0;i<selects.length;i+=5)parts.push(`json((SELECT json_group_array(json_object('tenancyId',tenancyId,'kind',kind,'record',json(record))) FROM (${selects.slice(i,i+5).join(' UNION ALL ')} ORDER BY tenancyId,kind,record)))`)
 const query=`WITH subjects(id) AS (SELECT value FROM json_each(?)) SELECT json_array(${parts.join(',')}) AS snapshot`
 const value=await db.prepare(query).bind(JSON.stringify(ids)).first<{snapshot:string}>()
 const encoded=value!.snapshot
 const groups:DependencyRow[][]=JSON.parse(encoded)
 return { rows: groups.flat(), groups, encoded, query, ids }
}
export function snapshotGuard(snapshot: DependencySnapshot, rows = snapshot.rows): D1Sql {
 // Rebuild exactly the SQL serializer's key order after removing only native
 // rows already reversed by this job. All later-work rows remain in the fence.
 return {sql:`(${snapshot.query}) IS ?`,params:[JSON.stringify(snapshot.ids),JSON.stringify(snapshot.groups.map(group=>group.filter(row=>rows.includes(row))))]}
}
export const snapshotHash = (rows: DependencyRow[]) => sha256(canonicalJson(rows))
