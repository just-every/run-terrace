// The writes that prepare one maintenance job and its pending proposal, shared by a person preparing work and
// the WORK-010 scheduler. The vendor's WORK-004 qualification is recorded with the job.
import { guard, id, sql, type Context, type Row } from './core'
import { assignment, issues } from './vendors'

export type JobDraft = { title: string; listed: Row | null; trade: string | null; tradeName: string; tradeEmail: string; dueDate: string; estimateCents: number; asset: Row | null; occurrenceId?: string }
export function jobWrites(c: Context, t: Row, d: JobDraft) {
 const jobId = id(), proposalId = id(), found = issues(d.listed, { trade: d.trade, due_date: d.dueDate }, t)
 const details = { title: d.title, tradeName: d.tradeName, tradeEmail: d.tradeEmail, dueDate: d.dueDate, estimateCents: d.estimateCents }
 return { jobId, proposalId, found, statements: [
  guard(c, 'EXISTS(SELECT 1 FROM tt_tenancies WHERE id=? AND version=?)', t.id, t.version),
  ...(d.asset ? [guard(c, "EXISTS(SELECT 1 FROM tt_assets WHERE id=? AND state='in_service')", d.asset.id)] : []),
  ...(d.listed ? [guard(c, 'EXISTS(SELECT 1 FROM tt_vendors WHERE id=? AND version=?)', d.listed.id, d.listed.version)] : []),
  sql(c, "INSERT INTO tt_proposals(id,tenancy_id,kind,payload,tenancy_version,prepared_by,prepared_at) VALUES(?,?,'maintenance',?,?,?,?)", proposalId, t.id, JSON.stringify({ jobId, ...details }), t.version, c.actor.id, c.now),
  sql(c, 'INSERT INTO tt_maintenance_jobs(id,tenancy_id,proposal_id,title,trade_name,trade_email,due_date,estimate_cents,prepared_by,prepared_at,currency,asset_id,vendor_id,trade,qualification,occurrence_id) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)', jobId, t.id, proposalId, d.title, d.tradeName, d.tradeEmail, d.dueDate, d.estimateCents, c.actor.id, c.now, t.currency, d.asset?.id ?? null, d.listed?.id ?? null, d.trade, JSON.stringify(found), d.occurrenceId ?? null),
  assignment(c, jobId, d.listed?.id ?? null, d.tradeName, d.trade, found),
 ] }
}
