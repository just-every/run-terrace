import { all, cents, commit, date, email, guard, id, insist, manager, money, one, sha256, sql, tenancy, text, type Context, type Row } from './core'
import { assetData, serviceableAsset } from './assets'
import { hold, trade, vendor, vendorData, vendorGuard } from './vendors'
import { jobWrites } from './job-writes'
import { scheduleData } from './schedules'
import { localDate } from './zones'

// Adapted evidence storage/version guards from gasket/src/gasket/work.ts
// at 3f87ba0fdba9955f2b7d018d10afafcd50afa919; proposal preparation and
// approval snapshots from glove/src/glove/commands/dispatch.ts
// at 778474d80bf5f440b42fb8f3364a191908d0e4b9. JPEG/PNG signatures are checked here.
const PHOTO_LIMIT = 1_500_000
const validVersion = (v: unknown) => {
  insist(typeof v === 'number' || (typeof v === 'string' && /^\d+$/.test(v)), 'invalid_version', 'A current record version is required.')
  const n = Number(v)
  insist(Number.isSafeInteger(n) && n > 0, 'invalid_version', 'A current record version is required.')
  return n
}
const contextMatches = (p: Row, row: Row) => {
  if (p.tenancyId !== undefined) insist(p.tenancyId === row.tenancy_id, 'conflict', 'This record belongs to another tenancy.', 409)
}
async function readAccess(c: Context) {
  insist(await one(c, "SELECT id FROM oa_operators WHERE id=? AND status='active' AND role=? AND version=?", c.actor.id, c.actor.role, c.actor.version ?? 1), 'forbidden', 'Your access changed. Sign in again.', 403)
}
async function inspection(c: Context, p: Row) {
  const row = await one(c, 'SELECT * FROM tt_inspections WHERE id=?', text(p.inspectionId, 'Inspection', 100))
  insist(row, 'not_found', 'Inspection not found.', 404)
  contextMatches(p, row)
  return row
}
async function job(c: Context, p: Row) {
  const row = await one(c, 'SELECT * FROM tt_maintenance_jobs WHERE id=?', text(p.jobId, 'Maintenance job', 100))
  insist(row, 'not_found', 'Maintenance job not found.', 404)
  contextMatches(p, row)
  return row
}
const inspectionGuard = (c: Context, row: Row, version = row.version) => guard(c,
  "EXISTS(SELECT 1 FROM tt_inspections WHERE id=? AND version=? AND state='draft')", row.id, version)
const jobGuard = (c: Context, row: Row, version: number, state: string) => guard(c,
  'EXISTS(SELECT 1 FROM tt_maintenance_jobs WHERE id=? AND version=? AND state=?)', row.id, version, state)
const result = (row: Row, notice: string) => ({ id: row.id, tenancyId: row.tenancy_id, notice })
async function qualified(c: Context, row: Row, t: Row) {
  const h = await hold(c, row, t)
  insist(!h.held, 'qualification_hold', `Held: ${h.issues.join('; ')}. A manager records a documented exception for these issues first.`, 409)
  return h
}

/** Unknown commands are left for the next module. All writes include the live operator guard in commit. */
export async function workCommand(c: Context, command: string, p: Row): Promise<Row | undefined> {
  switch (command) {
    case 'inspection.create': {
      manager(c)
      const t = await tenancy(c, p.tenancyId), inspectionId = id()
      const notes = p.notes === undefined || p.notes === '' ? '' : text(p.notes, 'Inspection notes', 4000)
      await commit(c, [
        guard(c, 'EXISTS(SELECT 1 FROM tt_tenancies WHERE id=? AND version=?)', t.id, t.version),
        sql(c, 'INSERT INTO tt_inspections(id,tenancy_id,inspection_date,notes,created_by,created_at) VALUES(?,?,?,?,?,?)', inspectionId, t.id, date(p.date), notes, c.actor.id, c.now),
      ], command, inspectionId)
      return { id: inspectionId, tenancyId: t.id, notice: 'Inspection draft created. Add photo evidence and complete your notes.' }
    }
    case 'inspection.photo': {
      manager(c)
      const row = await inspection(c, p), file = p.file
      insist(file instanceof File && file.size > 0 && file.size <= PHOTO_LIMIT, 'invalid_photo', 'Choose a JPEG or PNG photo up to 1.5 MB.')
      const bytes = new Uint8Array(await file.arrayBuffer())
      const png = [137,80,78,71,13,10,26,10].every((byte, i) => bytes[i] === byte)
      const jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
      insist(png || jpeg, 'invalid_photo', 'The file must contain a real JPEG or PNG signature.')
      const photoId = id(), digest = await sha256(bytes)
      await commit(c, [
        inspectionGuard(c, row, p.version === undefined ? row.version : validVersion(p.version)),
        sql(c, 'INSERT INTO tt_inspection_photos(id,inspection_id,filename,media_type,size,sha256,bytes,uploaded_by,uploaded_at) VALUES(?,?,?,?,?,?,?,?,?)', photoId, row.id, text(file.name || 'inspection-photo', 'Filename', 255), png ? 'image/png' : 'image/jpeg', bytes.byteLength, digest, bytes, c.actor.id, c.now),
        sql(c, 'UPDATE tt_inspections SET version=version+1 WHERE id=?', row.id),
      ], command, row.id)
      return { ...result(row, 'Photo evidence saved.'), photoId, sha256: digest }
    }
    case 'inspection.complete': {
      manager(c)
      const row = await inspection(c, p), notes = text(p.notes ?? row.notes, 'Inspection notes', 4000)
      insist(await one(c, 'SELECT id FROM tt_inspection_photos WHERE inspection_id=? LIMIT 1', row.id), 'inspection_evidence', 'Save at least one photo before completing the inspection.', 409)
      await commit(c, [
        inspectionGuard(c, row, p.version === undefined ? row.version : validVersion(p.version)),
        guard(c, 'EXISTS(SELECT 1 FROM tt_inspection_photos WHERE inspection_id=?)', row.id),
        sql(c, "UPDATE tt_inspections SET notes=?,state='completed',version=version+1,completed_by=?,completed_at=? WHERE id=?", notes, c.actor.id, c.now, row.id),
      ], command, row.id)
      return result(row, 'Inspection completed with notes and photo evidence.')
    }
    case 'maintenance.prepare': {
      insist(['owner','admin','member'].includes(c.actor.role), 'forbidden', 'You cannot prepare maintenance.', 403)
      const t = await tenancy(c, p.tenancyId)
      // WORK-004: a directory vendor is checked for the job's trade; a typed-in vendor is held as unlisted.
      const listed = p.vendorId ? await vendor(c, p.vendorId) : null, work = listed || p.trade ? trade(p.trade) : null
      const tradeEmail = listed ? listed.email : email(p.tradeEmail)
      insist(!/[<>"(),:;\\]/.test(tradeEmail), 'invalid_email', 'Enter a plain vendor email address.')
      const { jobId, proposalId, found, statements } = jobWrites(c, t, { title: text(p.title, 'Work required', 200), listed, trade: work, tradeName: listed ? listed.name : text(p.tradeName, 'Vendor name', 200), tradeEmail, dueDate: date(p.dueDate, 'Due date'), estimateCents: cents(p.estimate), asset: await serviceableAsset(c, t.id, p.assetId) })
      await commit(c, statements, command, jobId)
      return { id: jobId, tenancyId: t.id, proposalId, version: 1, issues: found, notice: found.length ? `Maintenance prepared and held: ${found.join('; ')}. A manager's documented exception is needed before approval.` : 'Maintenance prepared. An owner or administrator must approve it before handoff.' }
    }
    case 'maintenance.approve': {
      manager(c)
      const row = await job(c, p), version = validVersion(p.version), t = await tenancy(c, row.tenancy_id), h = await qualified(c, row, t)
      const snapshot = JSON.stringify({ jobId: row.id, version, tenancyId: t.id, tenancyVersion: t.version, address: t.address, title: row.title, tradeName: row.trade_name, tradeEmail: row.trade_email, vendorId: row.vendor_id, trade: row.trade, qualificationIssues: h.issues, qualificationException: h.exception ? { id: h.exception.id, reason: h.exception.reason, approvedBy: h.exception.approved_by } : null, dueDate: row.due_date, estimateCents: row.estimate_cents, currency: row.currency, preparedBy: row.prepared_by, preparedAt: row.prepared_at, approvedBy: c.actor.id, approvedRole: c.actor.role, approvedAt: c.now })
      const digest = await sha256(new TextEncoder().encode(snapshot))
      await commit(c, [
        jobGuard(c, row, version, 'pending'), vendorGuard(c, row, h.vendorVersion),
        guard(c, "EXISTS(SELECT 1 FROM tt_proposals p JOIN tt_tenancies t ON t.id=p.tenancy_id WHERE p.id=? AND p.kind='maintenance' AND p.state='pending' AND p.tenancy_version=t.version AND t.version=?)", row.proposal_id, t.version),
        sql(c, 'INSERT INTO tt_maintenance_approvals(id,job_id,job_version,snapshot,sha256,approved_by,approved_role,approved_at) VALUES(?,?,?,?,?,?,?,?)', id(), row.id, version, snapshot, digest, c.actor.id, c.actor.role, c.now),
        sql(c, "UPDATE tt_proposals SET state='approved',approved_by=?,approved_at=? WHERE id=?", c.actor.id, c.now, row.proposal_id),
        sql(c, "UPDATE tt_maintenance_jobs SET state='approved',version=version+1 WHERE id=?", row.id),
      ], command, row.id)
      return { ...result(row, 'Maintenance approved. Download the email packet and send it using your email client.'), version: version + 1 }
    }
    case 'maintenance.sent': {
      manager(c)
      const row = await job(c, p), version = validVersion(p.version), reference = text(p.reference, 'External handoff reference', 500)
      // Qualification is checked again at handoff: a vendor that lapsed after approval is held, never silently dispatched.
      const h = await qualified(c, row, await tenancy(c, row.tenancy_id))
      await commit(c, [
        jobGuard(c, row, version, 'approved'), vendorGuard(c, row, h.vendorVersion),
        guard(c, 'EXISTS(SELECT 1 FROM tt_maintenance_approvals WHERE job_id=? AND job_version=?)', row.id, version - 1),
        sql(c, "UPDATE tt_maintenance_jobs SET state='sent',version=version+1,sent_by=?,sent_at=?,sent_reference=? WHERE id=?", c.actor.id, c.now, reference, row.id),
      ], command, row.id)
      return { ...result(row, 'External handoff recorded. Terrace has not sent an email.'), version: version + 1 }
    }
  }
}

export async function workData(c: Context, tenancyId: string) {
  await readAccess(c)
  const t = await tenancy(c, tenancyId)
  const [inspections, photos, jobs] = await Promise.all([
    all(c, 'SELECT * FROM tt_inspections WHERE tenancy_id=? ORDER BY inspection_date DESC,created_at DESC', t.id),
    all(c, 'SELECT p.id,p.inspection_id,p.filename,p.media_type,p.size,p.sha256,p.uploaded_by,p.uploaded_at FROM tt_inspection_photos p JOIN tt_inspections i ON i.id=p.inspection_id WHERE i.tenancy_id=? ORDER BY p.uploaded_at', t.id),
    all(c, 'SELECT j.*,a.job_version AS approved_version,a.approved_by,a.approved_role,a.approved_at,a.sha256 AS approval_sha256,a.snapshot AS approval_snapshot FROM tt_maintenance_jobs j LEFT JOIN tt_maintenance_approvals a ON a.job_id=j.id WHERE j.tenancy_id=? ORDER BY j.prepared_at DESC', t.id),
  ])
  const today = localDate(c.now, t.time_zone)
  return { inspections, photos, jobs, assets: await assetData(c, t), today, ...await vendorData(c, t, today, jobs), schedules: await scheduleData(c, t, today), role: c.actor.role }
}

/** Operator ids to display names, for showing who prepared, approved, uploaded or handed off work. */
export async function operatorNames(c: Context): Promise<Record<string, string>> {
  return Object.fromEntries((await all(c, 'SELECT id,display_name FROM oa_operators')).filter(o => o.display_name).map(o => [o.id, o.display_name]))
}

export async function photoResponse(c: Context, photoId: string): Promise<Response> {
  await readAccess(c)
  const row = await one(c, 'SELECT media_type,bytes FROM tt_inspection_photos WHERE id=?', text(photoId, 'Photo', 100))
  insist(row, 'not_found', 'Photo not found.', 404)
  return new Response(new Uint8Array(row.bytes), { headers: {
    'content-type': row.media_type, 'content-disposition': `inline; filename="inspection-${photoId.replace(/[^a-zA-Z0-9-]/g,'')}.${row.media_type === 'image/png' ? 'png' : 'jpg'}"`,
    'cache-control': 'private, no-store', 'x-content-type-options': 'nosniff', 'content-security-policy': "default-src 'none'; sandbox",
  } })
}

export async function workPacket(c: Context, jobId: string): Promise<Response> {
  await readAccess(c)
  const row = await one(c, "SELECT a.*,j.currency FROM tt_maintenance_approvals a JOIN tt_maintenance_jobs j ON j.id=a.job_id WHERE j.id=? AND j.state IN ('approved','sent')", text(jobId, 'Maintenance job', 100))
  insist(row, 'not_approved', 'An approved maintenance job is required to download a handoff packet.', 409)
  const s = JSON.parse(row.snapshot)
  insist(await sha256(new TextEncoder().encode(row.snapshot)) === row.sha256, 'conflict', 'The approval evidence could not be verified.', 409)
  const body = [
    `Hello ${s.tradeName},`, '', `Please arrange the approved maintenance work at ${s.address}.`, '',
    `Work: ${s.title}`, `Due date: ${s.dueDate}`, `Approved estimate: ${money(s.estimateCents, row.currency)}`,
    '', `Job reference: ${s.jobId}`, `Approved version: ${s.version}`, `Approved by: ${s.approvedBy} (${s.approvedRole})`,
    `Approved at: ${s.approvedAt}`, `Approval SHA-256: ${row.sha256}`, '',
    'Please reply to the sender to arrange access and confirm the work.',
  ].join('\r\n')
  const base64 = btoa(Array.from(new TextEncoder().encode(body), byte => String.fromCharCode(byte)).join('')).match(/.{1,76}/g)!.join('\r\n')
  const message = [`To: ${s.tradeEmail}`, `Subject: Terrace maintenance ${s.jobId}`, `Date: ${new Date(s.approvedAt).toUTCString()}`, 'X-Unsent: 1', 'MIME-Version: 1.0', 'Content-Type: text/plain; charset=UTF-8', 'Content-Transfer-Encoding: base64', '', base64, ''].join('\r\n')
  return new Response(message, { headers: {
    'content-type': 'message/rfc822', 'content-disposition': `attachment; filename="maintenance-${jobId.replace(/[^a-zA-Z0-9-]/g,'')}.eml"`,
    'cache-control': 'private, no-store', 'x-content-type-options': 'nosniff',
  } })
}
