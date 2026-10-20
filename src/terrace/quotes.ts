import { checklist } from './dispatch'
// WORK-003: comparable vendor quotes for a job, the owner's per-job spending limit and annual maintenance
// budget, the owner's decision on work above them (recorded by staff for the owner: Terrace has no owner
// portal and contacts no one), and changes to scope, vendor or price, which reopen authorization.
import { all, cents, commit, date, email, guard, id, insist, allow, money, one, sha256, sql, tenancy, text, type Context, type Row } from './core'
import { assignment, issues, vendor } from './vendors'

export const OWNER_LABEL = 'recorded by staff for the owner'
const SOURCES = ['email', 'document', 'call']
const tax = (v: unknown) => v === undefined || v === '' || /^0+(\.0{1,2})?$/.test(String(v)) ? 0 : cents(v)

async function job(c: Context, v: unknown) {
 const row = await one(c, 'SELECT * FROM tt_maintenance_jobs WHERE id=?', text(v, 'Maintenance job', 100))
 insist(row, 'not_found', 'Maintenance job not found.', 404)
 await tenancy(c, row.tenancy_id)
 return row
}

/** Limits and budgets belong to the property when the tenancy is on a unit (PORT-002), otherwise to the tenancy. */
export async function limitScope(c: Context, t: Row) {
 const u = t.unit_id ? await one(c, 'SELECT property_id FROM tt_units WHERE id=?', t.unit_id) : null
 return u ? `property:${u.property_id}` : `tenancy:${t.id}`
}
const inScope = (scope: string): [string, string] => scope.startsWith('property:')
 ? ['SELECT t.id FROM tt_tenancies t JOIN tt_units u ON u.id=t.unit_id WHERE u.property_id=?', scope.slice(9)]
 : ['SELECT ?', scope.slice(8)]

/** The exact terms an approval or an owner's decision covers. */
const terms = (j: Row) => JSON.stringify({ jobId: j.id, version: j.version, title: j.title, scope: j.scope ?? null, checklist: j.checklist, vendorId: j.vendor_id ?? null, tradeName: j.trade_name, tradeEmail: j.trade_email, dueDate: j.due_date, estimateCents: j.estimate_cents, quoteId: j.quote_id ?? null })
const digest = (j: Row) => sha256(new TextEncoder().encode(terms(j)))

/** Whether a manager may approve this job version alone. The owner decides when the estimate is above the
 * per-job limit, or when this year's approved spend in the scope plus this estimate is above the budget. */
export async function authority(c: Context, j: Row, t: Row) {
 const scope = await limitScope(c, t), limit = await one(c, 'SELECT * FROM tt_work_limits WHERE scope=?', scope)
 const decision = await one(c, 'SELECT * FROM tt_owner_decisions WHERE job_id=? AND job_version=?', j.id, j.version), sha = await digest(j)
 if (!limit) return { scope, limit: null, spentCents: 0, reasons: [] as string[], needsOwner: false, decision: null, sha }
 const [q, v] = inScope(scope), year = String(j.due_date).slice(0, 4)
 const spent = (await one<{ n: number }>(c, `SELECT COALESCE(SUM(estimate_cents),0) AS n FROM tt_maintenance_jobs WHERE tenancy_id IN (${q}) AND state IN ('approved','sent') AND substr(due_date,1,4)=? AND id<>?`, v, year, j.id))!.n
 const reasons: string[] = []
 if (j.estimate_cents > limit.limit_cents) reasons.push(`above the owner’s ${money(limit.limit_cents, limit.currency)} per-job limit`)
 if (limit.budget_cents && spent + j.estimate_cents > limit.budget_cents) reasons.push(`over the owner’s ${year} maintenance budget of ${money(limit.budget_cents, limit.currency)} (${money(spent, limit.currency)} already approved)`)
 return { scope, limit, spentCents: spent, reasons, needsOwner: reasons.length > 0, decision: decision && decision.terms_sha256 === sha ? decision : null, sha }
}

/** Writes that put a changed job back to prepared: a new version and a pending proposal needing approval. */
async function reopen(c: Context, j: Row, version: number, changes: Row, vendorChanged: boolean) {
 const t = await tenancy(c, j.tenancy_id), next = { ...j, ...changes }
 const found = issues(next.vendor_id ? await one(c, 'SELECT * FROM tt_vendors WHERE id=?', next.vendor_id) : null, next, t)
 const payload = JSON.stringify({ jobId: j.id, title: next.title, scope: next.scope, tradeName: next.trade_name, tradeEmail: next.trade_email, dueDate: next.due_date, estimateCents: next.estimate_cents })
 return { found, statements: [
  guard(c, "EXISTS(SELECT 1 FROM tt_maintenance_jobs WHERE id=? AND version=? AND state IN ('pending','approved'))", j.id, version),
  sql(c, "UPDATE tt_maintenance_jobs SET title=?,scope=?,checklist=?,vendor_id=?,trade_name=?,trade_email=?,due_date=?,estimate_cents=?,quote_id=?,qualification=?,revised_by=?,state='pending',version=version+1 WHERE id=?", next.title, next.scope ?? null, next.checklist ?? j.checklist, next.vendor_id ?? null, next.trade_name, next.trade_email, next.due_date, next.estimate_cents, next.quote_id ?? null, JSON.stringify(found), c.actor.id, j.id),
  sql(c, "UPDATE tt_proposals SET state='pending',approved_by=NULL,approved_at=NULL,tenancy_version=?,payload=? WHERE id=?", t.version, payload, j.proposal_id),
  ...(vendorChanged ? [assignment(c, j.id, next.vendor_id ?? null, next.trade_name, j.trade, found)] : []),
 ] }
}
const reopened = (j: Row, found: string[]) => `${j.state === 'approved' ? 'Changed after approval: authorization reopened, and handoff waits for approval of the new terms.' : 'Terms changed. An owner or administrator approves them before handoff.'}${found.length ? ` Held: ${found.join('; ')}.` : ''}`

export async function quoteCommand(c: Context, command: string, p: Row): Promise<Row | undefined> {
 if (command === 'work.limits') {
  allow(c, command)
  const t = await tenancy(c, p.tenancyId), scope = await limitScope(c, t), budget = p.budget ? cents(p.budget) : null
  // ROLE-003: optionally, the owner's quote requirement: at least quotesNeeded quotes when the estimate is above quotesAbove.
  const needed = p.quotesNeeded ? Number(p.quotesNeeded) : null, above = needed ? (String(p.quotesAbove ?? '').trim().match(/^0(\.0{1,2})?$/) ? 0 : cents(p.quotesAbove)) : null
  insist(needed === null || (Number.isInteger(needed) && needed >= 2 && needed <= 10), 'invalid_input', 'Quotes needed is a whole number from 2 to 10.')
  await commit(c, [sql(c, 'INSERT INTO tt_work_limits(scope,limit_cents,budget_cents,currency,quotes_needed,quotes_above_cents,set_by,set_at) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(scope) DO UPDATE SET limit_cents=excluded.limit_cents,budget_cents=excluded.budget_cents,quotes_needed=excluded.quotes_needed,quotes_above_cents=excluded.quotes_above_cents,version=version+1,set_by=excluded.set_by,set_at=excluded.set_at', scope, cents(p.limit), budget, t.currency, needed, above, c.actor.id, c.now)], command, scope)
  return { tenancyId: t.id, scope, notice: `Owner’s spending limit ${OWNER_LABEL}. Work above it, or over the year’s budget, needs the owner’s decision.` }
 }
 if (command === 'quote.add') {
  allow(c, command)
  const j = await job(c, p.jobId)
  insist(j.state !== 'sent', 'job_state', 'This work has already been handed off.', 409)
  const listed = p.vendorId ? await vendor(c, p.vendorId) : null, key = id()
  const amount = cents(p.amount), taxCents = tax(p.tax)
  await commit(c, [
   guard(c, "EXISTS(SELECT 1 FROM tt_maintenance_jobs WHERE id=? AND state<>'sent')", j.id),
   sql(c, 'INSERT INTO tt_job_quotes(id,job_id,vendor_id,vendor_name,vendor_email,scope,available_date,amount_cents,tax_cents,currency,recorded_by,recorded_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)', key, j.id, listed?.id ?? null, listed ? listed.name : text(p.vendorName, 'Vendor name', 200), listed ? listed.email : email(p.vendorEmail), text(p.scope, 'Quoted scope', 2000), date(p.availableDate, 'Available from'), amount, taxCents, j.currency, c.actor.id, c.now),
  ], command, key)
  return { id: key, tenancyId: j.tenancy_id, totalCents: amount + taxCents, notice: 'Quote recorded for comparison.' }
 }
 if (command === 'quote.select') {
  allow(c, command)
  const j = await job(c, p.jobId), version = Number(p.version ?? j.version)
  const quote = await one(c, 'SELECT * FROM tt_job_quotes WHERE id=? AND job_id=?', text(p.quoteId, 'Quote', 100), j.id)
  insist(quote, 'not_found', 'Quote not found for this job.', 404)
  insist(j.state !== 'sent', 'job_state', 'This work has already been handed off.', 409)
  const { found, statements } = await reopen(c, j, version, { vendor_id: quote.vendor_id, trade_name: quote.vendor_name, trade_email: quote.vendor_email, scope: quote.scope, estimate_cents: quote.amount_cents + quote.tax_cents, quote_id: quote.id }, quote.vendor_id !== j.vendor_id || quote.vendor_name !== j.trade_name)
  await commit(c, statements, command, j.id)
  return { id: j.id, tenancyId: j.tenancy_id, version: j.version + 1, issues: found, notice: `Quote selected. ${reopened(j, found)}` }
 }
 if (command === 'maintenance.revise') {
  allow(c, command)
  const j = await job(c, p.jobId), version = Number(p.version ?? j.version)
  insist(j.state !== 'sent', 'job_state', 'This work has already been handed off.', 409)
  const changes: Row = {}
  if (p.title) changes.title = text(p.title, 'Work required', 200)
  if (p.checklist) changes.checklist = JSON.stringify(checklist(p.checklist))
  if (p.scope) changes.scope = text(p.scope, 'Scope', 2000)
  if (p.estimate) changes.estimate_cents = cents(p.estimate)
  if (p.dueDate) changes.due_date = date(p.dueDate, 'Due date')
  insist(Object.keys(changes).length > 0, 'invalid_input', 'Change the scope, title, estimate or due date.')
  if (changes.estimate_cents !== undefined && changes.estimate_cents !== j.estimate_cents) changes.quote_id = null
  const { found, statements } = await reopen(c, j, version, changes, false)
  await commit(c, statements, command, j.id)
  return { id: j.id, tenancyId: j.tenancy_id, version: j.version + 1, issues: found, notice: reopened(j, found) }
 }
 if (command === 'maintenance.owner') {
  allow(c, command)
  const j = await job(c, p.jobId), version = Number(p.version ?? j.version), t = await tenancy(c, j.tenancy_id)
  insist(j.state === 'pending' && j.version === version, 'conflict', 'The work changed. Reload and record the owner’s decision on the current terms.', 409)
  const a = await authority(c, j, t)
  insist(a.needsOwner, 'within_limit', 'This work is within the owner’s limit and budget: a manager approves it.', 409)
  const decision = String(p.decision ?? ''), source = String(p.source ?? '')
  insist(['approved', 'declined'].includes(decision), 'invalid_input', 'The owner’s decision is approved or declined.')
  insist(SOURCES.includes(source), 'invalid_input', 'Say where the owner’s decision came from: email, document or call.')
  const key = id()
  await commit(c, [
   guard(c, "EXISTS(SELECT 1 FROM tt_maintenance_jobs WHERE id=? AND version=? AND state='pending')", j.id, version),
   sql(c, 'INSERT INTO tt_owner_decisions(id,job_id,job_version,terms_sha256,decision,source,reference,recorded_by,recorded_role,recorded_at) VALUES(?,?,?,?,?,?,?,?,?,?)', key, j.id, version, a.sha, decision, source, text(p.reference, 'Owner decision source', 1000), c.actor.id, c.actor.role, c.now),
  ], command, j.id)
  return { id: j.id, tenancyId: t.id, decisionId: key, notice: `Owner’s decision (${decision}) ${OWNER_LABEL}, from ${source}. Terrace did not contact the owner.` }
 }
}

/** Quotes, the owner's limit and each job's authority, for the tenancy's work page. */
export async function quoteData(c: Context, t: Row, jobs: Row[]) {
 const [quotes, decisions, approvals] = await Promise.all([
  all(c, 'SELECT q.* FROM tt_job_quotes q JOIN tt_maintenance_jobs j ON j.id=q.job_id WHERE j.tenancy_id=? ORDER BY q.amount_cents+q.tax_cents,q.recorded_at', t.id),
  all(c, 'SELECT d.* FROM tt_owner_decisions d JOIN tt_maintenance_jobs j ON j.id=d.job_id WHERE j.tenancy_id=? ORDER BY d.recorded_at', t.id),
  all(c, 'SELECT a.job_id,a.job_version,a.approved_by,a.approved_at FROM tt_maintenance_approvals a JOIN tt_maintenance_jobs j ON j.id=a.job_id WHERE j.tenancy_id=? ORDER BY a.job_version', t.id),
 ])
 const authorities = Object.fromEntries(await Promise.all(jobs.map(async j => [j.id, await authority(c, j, t)] as const)))
 const scope = await limitScope(c, t), limit = await one(c, 'SELECT * FROM tt_work_limits WHERE scope=?', scope)
 return { quotes, decisions, approvals, authorities, limit: limit ?? null }
}
