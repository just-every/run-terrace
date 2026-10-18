import type { Bindings } from './auth.server'
import { portfolio, maintenance } from './terrace/demo/portfolio'
import sink from './terrace/demo/sink.txt?raw'
import tap from './terrace/demo/tap.txt?raw'
import { sha256 } from './terrace/core'

const intervals: Record<'weekly' | 'fortnightly' | 'monthly', number> = { weekly: 7, fortnightly: 14, monthly: 30 }

/** Real records in the visitor's disposable database. No requests or random IDs. */
export async function seedDemo(env: Bindings, { ownerEmail, now }: { ownerEmail: string; now: Date }) {
 const owner = await env.DB.prepare("SELECT id FROM oa_operators WHERE email=? AND role='owner'").bind(ownerEmail).first<{ id: string }>()
 if (!owner) throw Error('Demo owner is missing')
 const at = (days: number) => new Date(now.getTime() + days * 86400000).toISOString()
 const day = (days: number) => at(days).slice(0, 10)
 // Whole days from now to the 1st of the month `offset` months away (UTC).
 const firstOfMonth = (offset: number) => Math.floor((Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset, 1) - Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())) / 86400000)
 const statements: D1PreparedStatement[] = [env.DB.prepare('UPDATE oa_operators SET display_name=? WHERE id=?').bind('Rowan Patel', owner.id)]
 const insert = (table: string, row: Record<string, unknown>) => {
  const columns = Object.keys(row)
  statements.push(env.DB.prepare(`INSERT INTO ${table}(${columns.join(',')}) VALUES(${columns.map(() => '?').join(',')}) ON CONFLICT DO NOTHING`).bind(...Object.values(row)))
 }
 for (const [id, name, role] of [['demo-manager', 'Casey Morgan', 'admin'], ['demo-preparer', 'Jamie Ellis', 'member']]) {
  insert('oa_operators', { id, display_name: name, email: `${id}@example.test`, role, status: 'active', version: 1, created_at: now.getTime() - 90 * 86400000 })
 }
 insert('oa_first_run', { singleton: 1, completed_by: owner.id, completed_at: now.getTime() })
 for (const [index, p] of portfolio.entries()) {
  const id = `demo-${p.id}`, interval = intervals[p.cadence]
  insert('tt_tenancies', { id, address: p.address, owner_name: p.owner, owner_email: `${p.owner.toLowerCase().replaceAll(' ', '.')}@example.test`, tenant_name: p.tenant, tenant_email: `${p.tenant.toLowerCase().replaceAll(' ', '.')}@example.test`, start_date: day(-280), end_date: day(p.end), rent_cents: p.rent, cadence: p.cadence, version: 1, created_at: at(-290) })
  for (let period = 0; period < 4; period++) {
   // Monthly rent falls due on the 1st: two past months, this month, next month.
   const chargeId = `${id}-rent-${period}`, due = p.cadence === 'monthly' ? firstOfMonth(period - 2) : (period - 3) * interval + 3
   const received = Math.min(due + index % 3, 0)
   insert('tt_charges', { id: chargeId, tenancy_id: id, due_date: day(due), amount_cents: p.rent, description: `${p.cadence[0].toUpperCase() + p.cadence.slice(1)} rent`, reference: `${p.id.toUpperCase()}-${period + 1}`, created_at: at(due - 4) })
   if (period < 3 && !(p.id === 'maple' && period === 2)) {
    insert('tt_receipts', { id: `${chargeId}-receipt`, charge_id: chargeId, amount_cents: p.id === 'banksia' && period === 2 ? 90000 : p.rent, received_date: day(received), reference: `BANK-${p.id.toUpperCase()}-${period + 1}`, created_at: at(received) })
   }
  }
  const renewal = index % 2 === 0
  insert('tt_proposals', { id: `${id}-proposal`, tenancy_id: id, kind: renewal ? 'renewal' : 'arrears', payload: JSON.stringify(renewal ? { endDate: day(p.end + 365), rentCents: p.rent + 2000, source: 'Annual lease review · owner discussion recorded' } : { message: `Hello ${p.tenant.split(' ')[0]}, please confirm the reference for your latest rent payment so we can match our records. Thank you, Casey.`, followUpDate: day(2) }), tenancy_version: 1, state: index === 3 ? 'approved' : index === 5 ? 'rejected' : 'pending', prepared_by: 'demo-preparer', prepared_at: at(-2), approved_by: index === 3 || index === 5 ? owner.id : null, approved_at: index === 3 || index === 5 ? at(-1) : null })
 }
 for (const [index, encoded] of [sink, tap].entries()) {
  const id = `demo-inspection-${index}`, completed = index === 0, photo = Uint8Array.from(atob(encoded.trim()), c => c.charCodeAt(0))
  insert('tt_inspections', { id, tenancy_id: `demo-${portfolio[index].id}`, inspection_date: day(index === 0 ? -14 : -1), notes: index === 0 ? 'Kitchen and living areas clean and well maintained. Faucet drips after closing; maintenance prepared. No other concerns raised.' : 'Kitchen sink P-trap replaced; cabinet dry. Faucet and seals checked; finish report after discussing access with Jordan.', state: completed ? 'completed' : 'draft', version: 2, created_by: 'demo-manager', created_at: at(-15), completed_by: completed ? 'demo-manager' : null, completed_at: completed ? at(-14) : null })
  insert('tt_inspection_photos', { id: `${id}-photo`, inspection_id: id, filename: index === 0 ? 'kitchen-sink.jpg' : 'kitchen-tap.jpg', media_type: 'image/jpeg', size: photo.length, sha256: await sha256(photo), bytes: photo, uploaded_by: 'demo-manager', uploaded_at: at(index === 0 ? -14 : -1) })
 }
 for (const [index, m] of maintenance.entries()) {
  const jobId = `demo-maintenance-${index}`, proposalId = `${jobId}-proposal`, tenancyId = `demo-${m.property}`, p = portfolio.find(p => p.id === m.property)!
  const details = { jobId, title: m.title, tradeName: m.trade, tradeEmail: m.email, dueDate: day(m.due), estimateCents: m.estimate }
  insert('tt_proposals', { id: proposalId, tenancy_id: tenancyId, kind: 'maintenance', payload: JSON.stringify(details), tenancy_version: 1, state: m.state === 'pending' ? 'pending' : 'approved', prepared_by: 'demo-preparer', prepared_at: at(-5), approved_by: m.state === 'pending' ? null : owner.id, approved_at: m.state === 'pending' ? null : at(-4) })
  insert('tt_maintenance_jobs', { id: jobId, tenancy_id: tenancyId, proposal_id: proposalId, title: m.title, trade_name: m.trade, trade_email: m.email, due_date: day(m.due), estimate_cents: m.estimate, state: m.state, version: m.state === 'pending' ? 1 : m.state === 'approved' ? 2 : 3, prepared_by: 'demo-preparer', prepared_at: at(-5), sent_by: m.state === 'sent' ? owner.id : null, sent_at: m.state === 'sent' ? at(-4) : null, sent_reference: m.state === 'sent' ? 'Email handoff · Bayline accepted job WO-2291' : null })
  if (m.state !== 'pending') {
   const snapshot = JSON.stringify({ ...details, version: 1, tenancyId, tenancyVersion: 1, address: p.address, preparedBy: 'demo-preparer', preparedAt: at(-5), approvedBy: owner.id, approvedRole: 'owner', approvedAt: at(-4) })
   insert('tt_maintenance_approvals', { id: `${jobId}-approval`, job_id: jobId, job_version: 1, snapshot, sha256: await sha256(new TextEncoder().encode(snapshot)), approved_by: owner.id, approved_role: 'owner', approved_at: at(-4) })
  }
 }
 await env.DB.batch(statements)
}
