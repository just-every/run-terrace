// WORK-004: vendor directory and qualified assignment. A vendor qualifies for a job when it is listed and not
// blocked, has the job's trade as a specialty, serves the property, has a received W-9, and its insurance (and
// license, when one is recorded) runs through the job's due date. Unqualified work is held: it is prepared and
// shown with its issues, but approval and handoff wait for a manager's documented exception for those issues.
import { all, cents, commit, date, email, guard, id, insist, allow, one, sql, tenancy, text, type Context, type Row } from './core'

export const TRADES = ['plumbing','electrical','hvac','appliance','roofing','locksmith','pest control','cleaning','general'] as const
const list = (v: unknown, label: string) => {
 const items = (Array.isArray(v) ? v : String(v ?? '').split(',')).map(x => String(x).trim()).filter(Boolean)
 insist(items.length > 0 && items.length <= 30 && items.every(x => x.length <= 60), 'invalid_input', `${label}: enter one to 30 entries, separated by commas.`)
 return [...new Set(items)]
}
export const trade = (v: unknown) => { const s = text(v, 'Trade', 60).toLowerCase(); return s }
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** Unmet requirements for this vendor, trade, property and due date; empty when qualified. */
export function issues(v: Row | null | undefined, job: Row, t: Row): string[] {
 if (!v) return ['Not in the vendor directory']
 const out: string[] = []
 if (v.standing === 'blocked') out.push('Blocked vendor')
 if (!job.trade || !JSON.parse(v.specialties).includes(job.trade)) out.push(`No ${job.trade ?? 'trade'} specialty`)
 if (!JSON.parse(v.service_areas).some((a: string) => new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRe(a)}($|[^\\p{L}\\p{N}])`, 'iu').test(t.address))) out.push('Does not serve this property')
 if (v.w9 !== 'received') out.push('W-9 not received')
 if (v.insurance_expires < job.due_date) out.push(`Insurance expires ${v.insurance_expires}, before the due date`)
 if (v.license_expires && v.license_expires < job.due_date) out.push(`License expires ${v.license_expires}, before the due date`)
 return out
}

function vendorFields(p: Row) {
 const insurance = date(p.insuranceExpires, 'Insurance expires'), licence = p.licenseNumber ? text(p.licenseNumber, 'License number', 60) : null
 const licenceEnds = licence ? date(p.licenseExpires, 'License expires') : null
 insist(['received','missing'].includes(p.w9), 'invalid_input', 'W-9 status is received or missing.')
 insist(['preferred','approved','blocked'].includes(p.standing), 'invalid_input', 'Standing is preferred, approved or blocked.')
 return [text(p.name, 'Vendor name', 200), email(p.email), text(p.phone, 'Phone', 40), JSON.stringify(list(p.specialties, 'Specialties').map(x => x.toLowerCase())), JSON.stringify(list(p.serviceAreas, 'Service areas')), p.w9, insurance, licence, licenceEnds, String(p.availability ?? '').trim().slice(0, 300), p.rate ? cents(p.rate) : null, p.standing]
}

export async function vendor(c: Context, v: unknown) { const row = await one(c, 'SELECT * FROM tt_vendors WHERE id=?', text(v, 'Vendor', 100)); insist(row, 'not_found', 'Vendor not found.', 404); return row }
/** The live hold on a job: current issues and whether a manager's exception covers exactly those issues. */
export async function hold(c: Context, job: Row, t: Row) {
 const v = job.vendor_id ? await one(c, 'SELECT * FROM tt_vendors WHERE id=?', job.vendor_id) : null
 const found = issues(v, job, t), key = JSON.stringify(found)
 const exception = found.length ? await one(c, 'SELECT * FROM tt_vendor_exceptions WHERE job_id=? AND vendor_id IS ? AND issues=? ORDER BY approved_at DESC', job.id, job.vendor_id, key) : null
 return { issues: found, exception, held: found.length > 0 && !exception, vendorVersion: v?.version ?? null }
}
/** A guard that the vendor row read for the hold is unchanged at commit. */
export const vendorGuard = (c: Context, job: Row, version: number | null) => version === null ? guard(c, 'NOT EXISTS(SELECT 1 FROM tt_vendors WHERE id IS ?)', job.vendor_id) : guard(c, 'EXISTS(SELECT 1 FROM tt_vendors WHERE id=? AND version=?)', job.vendor_id, version)

export async function vendorCommand(c: Context, command: string, p: Row): Promise<Row | undefined> {
 if (command === 'vendor.add') {
  allow(c, command)
  const key = id()
  await commit(c, [sql(c, "INSERT INTO tt_vendors(id,name,email,phone,specialties,service_areas,w9,insurance_expires,license_number,license_expires,availability,rate_cents,standing,currency,updated_by,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,'USD',?,?)", key, ...vendorFields(p), c.actor.id, c.now)], command, key)
  return { id: key, notice: 'Vendor added to the directory.' }
 }
 if (command === 'vendor.update') {
  allow(c, command)
  const row = await vendor(c, p.vendorId), version = Number(p.version ?? row.version)
  await commit(c, [
   guard(c, 'EXISTS(SELECT 1 FROM tt_vendors WHERE id=? AND version=?)', row.id, version),
   sql(c, 'UPDATE tt_vendors SET name=?,email=?,phone=?,specialties=?,service_areas=?,w9=?,insurance_expires=?,license_number=?,license_expires=?,availability=?,rate_cents=?,standing=?,version=version+1,updated_by=?,updated_at=? WHERE id=?', ...vendorFields(p), c.actor.id, c.now, row.id),
  ], command, row.id)
  return { id: row.id, version: version + 1, notice: 'Vendor updated. Work assigned to this vendor is checked again before approval and handoff.' }
 }
 if (command === 'maintenance.reassign') {
  allow(c, command)
  const job = await one(c, 'SELECT * FROM tt_maintenance_jobs WHERE id=?', text(p.jobId, 'Maintenance job', 100))
  insist(job, 'not_found', 'Maintenance job not found.', 404)
  insist(job.state === 'pending', 'job_state', 'Only prepared, unapproved work can be reassigned.', 409)
  const t = await tenancy(c, job.tenancy_id), v = await vendor(c, p.vendorId), work = { trade: p.trade ? trade(p.trade) : job.trade, due_date: job.due_date }
  const found = issues(v, work, t)
  await commit(c, [
   guard(c, "EXISTS(SELECT 1 FROM tt_maintenance_jobs WHERE id=? AND version=? AND state='pending')", job.id, Number(p.version ?? job.version)),
   guard(c, 'EXISTS(SELECT 1 FROM tt_vendors WHERE id=? AND version=?)', v.id, v.version),
   sql(c, 'UPDATE tt_maintenance_jobs SET vendor_id=?,trade=?,trade_name=?,trade_email=?,qualification=?,version=version+1 WHERE id=?', v.id, work.trade, v.name, v.email, JSON.stringify(found), job.id),
   sql(c, "UPDATE tt_proposals SET payload=json_set(payload,'$.tradeName',?,'$.tradeEmail',?) WHERE id=?", v.name, v.email, job.proposal_id),
   assignment(c, job.id, v.id, v.name, work.trade, found),
  ], command, job.id)
  return { id: job.id, tenancyId: t.id, version: job.version + 1, issues: found, notice: found.length ? `Reassigned and held: ${found.join('; ')}. A manager's documented exception is needed before approval.` : 'Reassigned to a qualified vendor.' }
 }
 if (command === 'maintenance.exception') {
  allow(c, command)
  const job = await one(c, 'SELECT * FROM tt_maintenance_jobs WHERE id=?', text(p.jobId, 'Maintenance job', 100))
  insist(job, 'not_found', 'Maintenance job not found.', 404)
  insist(job.state !== 'sent', 'job_state', 'This work has already been handed off.', 409)
  const t = await tenancy(c, job.tenancy_id), h = await hold(c, job, t), key = id()
  insist(h.issues.length > 0, 'no_hold', 'This vendor qualifies; no exception is needed.', 409)
  await commit(c, [
   guard(c, 'EXISTS(SELECT 1 FROM tt_maintenance_jobs WHERE id=? AND version=?)', job.id, job.version), vendorGuard(c, job, h.vendorVersion),
   sql(c, 'INSERT INTO tt_vendor_exceptions(id,job_id,vendor_id,issues,reason,approved_by,approved_role,approved_at) VALUES(?,?,?,?,?,?,?,?)', key, job.id, job.vendor_id, JSON.stringify(h.issues), text(p.reason, 'Exception reason', 1000), c.actor.id, c.actor.role, c.now),
  ], command, job.id)
  return { id: job.id, tenancyId: t.id, exceptionId: key, notice: 'Qualification exception recorded for these issues. The work can now be approved.' }
 }
}

export const assignment = (c: Context, jobId: string, vendorId: string | null, name: string, work: string | null, found: string[]) => sql(c, 'INSERT INTO tt_vendor_assignments(id,job_id,vendor_id,trade_name,trade,issues,assigned_by,assigned_at) VALUES(?,?,?,?,?,?,?,?)', id(), jobId, vendorId, name, work, JSON.stringify(found), c.actor.id, c.now)

/** Vendors with their standing for this tenancy's property as of the property-local day (trade aside). */
export async function vendorData(c: Context, t: Row, today: string, jobs: Row[]) {
 const vendors = (await all(c, 'SELECT * FROM tt_vendors ORDER BY standing DESC,name')).map(v => ({ ...v, specialties: JSON.parse(v.specialties), service_areas: JSON.parse(v.service_areas), issues: issues(v, { trade: null, due_date: today }, t).filter(x => !x.startsWith('No ')) }))
 const [assignments, exceptions] = await Promise.all([
  all(c, 'SELECT a.* FROM tt_vendor_assignments a JOIN tt_maintenance_jobs j ON j.id=a.job_id WHERE j.tenancy_id=? ORDER BY a.assigned_at', t.id),
  all(c, 'SELECT e.* FROM tt_vendor_exceptions e JOIN tt_maintenance_jobs j ON j.id=e.job_id WHERE j.tenancy_id=? ORDER BY e.approved_at', t.id),
 ])
 const holds = Object.fromEntries(await Promise.all(jobs.map(async j => [j.id, await hold(c, j, t)] as const)))
 return { vendors, assignments, exceptions, holds }
}
