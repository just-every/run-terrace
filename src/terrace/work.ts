import { independence } from './dual-control'
import { all, can, cents, commit, date, email, guard, id, insist, allow, money, one, sha256, sql, tenancy, text, UNCONFIRMED, type Context, type Row } from './core'
import { assetData, serviceableAsset } from './assets'
import { hold, trade, vendor, vendorData, vendorGuard } from './vendors'
import { jobWrites } from './job-writes'
import { scheduleData } from './schedules'
import { localDate } from './zones'
import { authority, authorityGuard, OWNER_LABEL, quoteData } from './quotes'
import { completionData } from './completions'
import { appointmentData } from './appointments'
import { checklist, dispatchData } from './dispatch'

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
  if (c.actor.credential) { insist(await one(c, 'SELECT 1 AS ok FROM tt_api_credentials WHERE id=? AND revoked_at IS NULL AND version=?', c.actor.id, c.actor.version ?? 0), 'forbidden', 'This credential was revoked or changed.', 403); return }
  insist(await one(c, "SELECT id FROM oa_operators WHERE id=? AND status='active' AND role=? AND version=?", c.actor.id, c.actor.role, c.actor.version ?? 1), 'forbidden', 'Your access changed. Sign in again.', 403)
}
async function inspection(c: Context, p: Row) {
  const row = await one(c, 'SELECT * FROM tt_inspections WHERE id=?', text(p.inspectionId, 'Inspection', 100))
  insist(row, 'not_found', 'Inspection not found.', 404)
  await tenancy(c, row.tenancy_id)
  contextMatches(p, row)
  return row
}
async function job(c: Context, p: Row) {
  const row = await one(c, 'SELECT * FROM tt_maintenance_jobs WHERE id=?', text(p.jobId, 'Maintenance job', 100))
  insist(row, 'not_found', 'Maintenance job not found.', 404)
  await tenancy(c, row.tenancy_id)
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
      allow(c, command)
      const t = await tenancy(c, p.tenancyId), inspectionId = id()
      const notes = p.notes === undefined || p.notes === '' ? '' : text(p.notes, 'Inspection notes', 4000)
      await commit(c, [
        guard(c, 'EXISTS(SELECT 1 FROM tt_tenancies WHERE id=? AND version=?)', t.id, t.version),
        sql(c, 'INSERT INTO tt_inspections(id,tenancy_id,inspection_date,notes,created_by,created_at) VALUES(?,?,?,?,?,?)', inspectionId, t.id, date(p.date), notes, c.actor.id, c.now),
      ], command, inspectionId)
      return { id: inspectionId, tenancyId: t.id, notice: 'Inspection draft created. Add photo evidence and complete your notes.' }
    }
    case 'inspection.photo': {
      allow(c, command)
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
      allow(c, command)
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
      allow(c, command)
      const t = await tenancy(c, p.tenancyId)
      // WORK-004: a directory vendor is checked for the job's trade; a typed-in vendor is held as unlisted.
      const listed = p.vendorId ? await vendor(c, p.vendorId) : null, work = listed || p.trade ? trade(p.trade) : null
      const tradeEmail = listed ? listed.email : email(p.tradeEmail)
      insist(!/[<>"(),:;\\]/.test(tradeEmail), 'invalid_email', 'Enter a plain vendor email address.')
      const tasks = checklist(p.checklist || p.title)
      const { jobId, proposalId, found, statements } = jobWrites(c, t, { title: text(p.title, 'Work required', 200), listed, trade: work, tradeName: listed ? listed.name : text(p.tradeName, 'Vendor name', 200), tradeEmail, dueDate: date(p.dueDate, 'Due date'), estimateCents: cents(p.estimate), asset: await serviceableAsset(c, t.id, p.assetId) })
      await commit(c, [...statements, sql(c, 'UPDATE tt_maintenance_jobs SET checklist=?,scope=? WHERE id=?', JSON.stringify(tasks), p.scope ? text(p.scope,'Scope',2000) : null, jobId)], command, jobId)
      return { id: jobId, tenancyId: t.id, proposalId, version: 1, issues: found, notice: found.length ? `Maintenance prepared and held: ${found.join('; ')}. A manager's documented exception is needed before approval.` : 'Maintenance prepared. An owner or administrator must approve it before handoff.' }
    }
    case 'maintenance.approve': {
      allow(c, command)
      const row = await job(c, p), version = validVersion(p.version), t = await tenancy(c, row.tenancy_id), h = await qualified(c, row, t)
      // WORK-003: above the owner's limit or budget, a manager approves only the exact terms the owner approved.
      const a = await authority(c, row, t), owner = a.decision, solo = await independence(c, command, [row.prepared_by, row.revised_by])
      // ROLE-003: the owner's quote requirement for estimates above a set amount.
      if (a.limit?.quotes_needed && row.estimate_cents > a.limit.quotes_above_cents) { const n = (await one<{ n: number }>(c, 'SELECT COUNT(*) AS n FROM tt_job_quotes WHERE job_id=?', row.id))!.n; insist(n >= a.limit.quotes_needed, 'quotes_required', `The owner requires ${a.limit.quotes_needed} quotes above ${money(a.limit.quotes_above_cents, a.limit.currency)}; this job has ${n}.`, 409) }
      insist(!a.needsOwner || owner?.decision === 'approved', owner ? 'owner_declined' : 'owner_approval_required', owner ? 'The owner declined these terms. Change the scope, vendor or price, or record a new owner decision on new terms.' : `Needs the owner’s decision: ${a.reasons.join('; ')}. Record the owner’s approval of these exact terms first.`, 409)
      const contact = await one(c, 'SELECT display_name,email FROM oa_operators WHERE id=?', c.actor.id)
      const snapshot = JSON.stringify({ checklist: JSON.parse(row.checklist).length ? JSON.parse(row.checklist) : [row.title], permittedContact: contact, jobId: row.id, version, tenancyId: t.id, tenancyVersion: t.version, address: t.address, title: row.title, scope: row.scope ?? null, quoteId: row.quote_id ?? null, ownerLimit: a.limit ? { limitCents: a.limit.limit_cents, budgetCents: a.limit.budget_cents, spentCents: a.spentCents, reasons: a.reasons } : null, ownerDecision: owner ? { decision: owner.decision, source: owner.source, reference: owner.reference, recordedBy: owner.recorded_by, recordedAt: owner.recorded_at, termsSha256: owner.terms_sha256, label: OWNER_LABEL } : null, tradeName: row.trade_name, tradeEmail: row.trade_email, vendorId: row.vendor_id, trade: row.trade, qualificationIssues: h.issues, qualificationException: h.exception ? { id: h.exception.id, reason: h.exception.reason, approvedBy: h.exception.approved_by } : null, dueDate: row.due_date, estimateCents: row.estimate_cents, currency: row.currency, preparedBy: row.prepared_by, preparedAt: row.prepared_at, revisedBy: row.revised_by ?? null, approvedBy: c.actor.id, approvedRole: c.actor.role, approvedAt: c.now, approvalLabel: solo.label })
      const digest = await sha256(new TextEncoder().encode(snapshot))
      await commit(c, [
        jobGuard(c, row, version, 'pending'), vendorGuard(c, row, h.vendorVersion), ...solo.guards,
        authorityGuard(c, row, version, a),
        guard(c, "EXISTS(SELECT 1 FROM tt_proposals p JOIN tt_tenancies t ON t.id=p.tenancy_id WHERE p.id=? AND p.kind='maintenance' AND p.state='pending' AND p.tenancy_version=t.version AND t.version=?)", row.proposal_id, t.version),
        sql(c, 'INSERT INTO tt_maintenance_approvals(id,job_id,job_version,snapshot,sha256,approved_by,approved_role,approved_at,approval_label) VALUES(?,?,?,?,?,?,?,?,?)', id(), row.id, version, snapshot, digest, c.actor.id, c.actor.role, c.now, solo.label),
        sql(c, "UPDATE tt_proposals SET state='approved',approved_by=?,approved_at=? WHERE id=?", c.actor.id, c.now, row.proposal_id),
        sql(c, "UPDATE tt_maintenance_jobs SET state='approved',version=version+1 WHERE id=?", row.id),
      ], command, row.id)
      return { ...result(row, 'Maintenance approved. Dispatch by installation email or download the packet for an external handoff.'), version: version + 1 }
    }
    case 'maintenance.sent': {
      allow(c, command)
      const row = await job(c, p), version = validVersion(p.version), reference = text(p.reference, 'External handoff reference', 500)
      insist(row.state === 'approved', 'not_approved', 'Approve the current terms before recording the handoff.', 409)
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
    all(c, 'SELECT j.*,a.id AS approval_id,a.job_version AS approved_version,a.approved_by,a.approved_role,a.approved_at,a.sha256 AS approval_sha256,a.snapshot AS approval_snapshot FROM tt_maintenance_jobs j LEFT JOIN tt_maintenance_approvals a ON a.job_id=j.id AND j.state<>\'pending\' AND a.job_version=(SELECT MAX(job_version) FROM tt_maintenance_approvals WHERE job_id=j.id) WHERE j.tenancy_id=? ORDER BY j.prepared_at DESC', t.id),
  ])
  const today = localDate(c.now, t.time_zone)
  return { inspections, photos, jobs, assets: await assetData(c, t), today, ...await vendorData(c, t, today, jobs), schedules: await scheduleData(c, t, today), ...await quoteData(c, t, jobs), ...await completionData(c, t.id), ...await appointmentData(c, t), ...await dispatchData(c, t), role: c.actor.role, may: Object.fromEntries(['maintenance.dispatch', 'maintenance.progress', 'maintenance.escalate', 'maintenance.approve', 'inspection.create', 'quote.add', 'schedule.add', 'work.limits', 'vendor.add', 'asset.add', 'appointment.book', 'appointment.confirm', 'appointment.cancel', 'appointment.no-show', 'appointment.reassign'].map(a => [a, can(c, a)])) }
}

/** Operator ids to display names, for showing who prepared, approved, uploaded or handed off work. */
export async function operatorNames(c: Context): Promise<Record<string, string>> {
  const keys = (await all(c, 'SELECT id,label FROM tt_api_credentials')).map(k => [k.id, `${k.label} (API credential)`])
  return Object.fromEntries([...keys, ...(await all(c, 'SELECT id,display_name FROM oa_operators')).filter(o => o.display_name).map(o => [o.id, o.display_name])])
}

export async function photoResponse(c: Context, photoId: string): Promise<Response> {
  await readAccess(c); allow(c, 'work.read')
  const row = await one(c, 'SELECT p.media_type,p.bytes,i.tenancy_id FROM tt_inspection_photos p JOIN tt_inspections i ON i.id=p.inspection_id WHERE p.id=?', text(photoId, 'Photo', 100))
  insist(row, 'not_found', 'Photo not found.', 404)
  await tenancy(c, row.tenancy_id)
  return new Response(new Uint8Array(row.bytes), { headers: {
    'content-type': row.media_type, 'content-disposition': `inline; filename="inspection-${photoId.replace(/[^a-zA-Z0-9-]/g,'')}.${row.media_type === 'image/png' ? 'png' : 'jpg'}"`,
    'cache-control': 'private, no-store', 'x-content-type-options': 'nosniff', 'content-security-policy': "default-src 'none'; sandbox",
  } })
}

export async function workPacket(c: Context, jobId: string): Promise<Response> {
  await readAccess(c); allow(c, 'work.read')
  const row = await one(c, "SELECT a.*,j.currency,j.tenancy_id,t.currency_confirmed FROM tt_maintenance_approvals a JOIN tt_maintenance_jobs j ON j.id=a.job_id JOIN tt_tenancies t ON t.id=j.tenancy_id WHERE j.id=? AND j.state IN ('approved','sent') ORDER BY a.job_version DESC LIMIT 1", text(jobId, 'Maintenance job', 100))
  insist(row, 'not_approved', 'An approved maintenance job is required to download a handoff packet.', 409)
  await tenancy(c, row.tenancy_id)
  const s = JSON.parse(row.snapshot)
  insist(await sha256(new TextEncoder().encode(row.snapshot)) === row.sha256, 'conflict', 'The approval evidence could not be verified.', 409)
  const body = [
    `Hello ${s.tradeName},`, '', `Please arrange the approved maintenance work at ${s.address}.`, '',
    `Work: ${s.title}`, ...(s.scope ? [`Scope: ${s.scope}`] : []), `Due date: ${s.dueDate}`, `Approved estimate: ${money(s.estimateCents, row.currency_confirmed === 0 ? UNCONFIRMED : row.currency)}`,
    ...(s.ownerDecision ? [`Owner approval: ${s.ownerDecision.label} (${s.ownerDecision.source}: ${s.ownerDecision.reference})`] : []),
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
