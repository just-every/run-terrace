// PAY-001: recurring charges from effective lease terms. A monthly tenancy bills calendar months; a weekly or
// fortnightly one bills 7- or 14-day periods counted from its lease start. A month's run covers every period that
// starts in that month, so a period crossing a month boundary belongs to one run only. A term covers the days of a
// period that fall inside both the lease and the term; a partly covered period is prorated by days:
// amount × covered days ÷ period days, rounded half up to the cent. A concession posts as a reduction of the same
// period's rent charge. Each line has a reference from its term and period start, so a replayed or retried run
// posts nothing twice, and a term is amended only from a period that has not been posted.
import { all, cents, commit, date, guard, id, insist, allow, one, sha256, sql, tenancy, text, type Context, type Row, shown, reaches } from './core'
import { BALANCE } from './ledger'
import { taxCharge } from './tax'
import { concessionLines } from './charge-concessions'

export const KINDS = ['rent','utility','pet','parking','concession'] as const
const DAY = 86400000
const ms = (d: string) => Date.parse(d + 'T00:00:00Z'), iso = (n: number) => new Date(n).toISOString().slice(0, 10)
const addDays = (d: string, n: number) => iso(ms(d) + n * DAY), days = (a: string, b: string) => Math.round((ms(b) - ms(a)) / DAY) + 1
const month = (v: unknown) => { const s = text(v, 'Month', 7); insist(/^\d{4}-(0[1-9]|1[0-2])$/.test(s), 'invalid_month', 'Choose a month as YYYY-MM.'); return s }
const prorate = (amount: number, covered: number, length: number) => covered === length ? amount : Math.floor((2 * amount * covered + length) / (2 * length))

/** Periods of a tenancy that start within the month. */
export function periods(t: Row, m: string) {
 const first = m + '-01', last = iso(Date.UTC(+m.slice(0, 4), +m.slice(5, 7), 0)), out: [string, string][] = []
 const end = t.ended_on ?? t.end_date
 if (t.cadence === 'monthly') return t.start_date <= last && end >= first ? [[first, last] as [string, string]] : out
 const step = t.cadence === 'weekly' ? 7 : 14
 const k = Math.floor(Math.max(0, days(t.start_date, first) - 1) / step)
 for (let s = addDays(t.start_date, k * step); s <= last && s <= end; s = addDays(s, step)) if (s >= first) out.push([s, addDays(s, step - 1)])
 return out
}

/** The run's lines and missing terms for one month, each line marked new or already posted. */
export async function preview(c: Context, value: unknown) {
 allow(c, 'charges.preview')
 const m = month(value)
 const [tenancies, terms, posted] = await Promise.all([
  all(c, 'SELECT * FROM tt_tenancies WHERE erased_at IS NULL ORDER BY address,tenant_name').then(rows => rows.filter(t => reaches(c, t.unit_id))),
  all(c, 'SELECT * FROM tt_lease_terms WHERE superseded_by IS NULL ORDER BY starts'),
  all(c, "SELECT id,tenancy_id,reference FROM tt_charges WHERE reference LIKE 'RUN-%'"),
 ])
 return runFor(c,m,tenancies,terms,posted)
}
/** PORT-005 previews the exact same engine against the proposed effective term view, without writing. */
export async function previewLease(c:Context,t:Row,terms:Row[],value:unknown) {
 const posted=await all(c,"SELECT id,tenancy_id,reference FROM tt_charges WHERE tenancy_id=? AND reference LIKE 'RUN-%'",t.id)
 return runFor(c,month(value),[t],terms,posted)
}
async function runFor(c:Context,m:string,tenancies:Row[],terms:Row[],posted:Row[]) {
 const lines: Row[] = [], missing: Row[] = []
 for (const t of tenancies) for (const [ps, pe] of periods(t, m)) {
  const from = ps > t.start_date ? ps : t.start_date, end = t.ended_on ?? t.end_date, to = pe < end ? pe : end, length = days(ps, pe)
  const rents: Row[] = []
  for (const term of terms.filter(x => x.tenancy_id === t.id && x.starts <= to && (x.ends ?? '9999-12-31') >= from).sort((a, b) => KINDS.indexOf(a.kind) - KINDS.indexOf(b.kind))) {
   const a = term.starts > from ? term.starts : from, b = term.ends && term.ends < to ? term.ends : to, covered = days(a, b)
   const reference = `RUN-${term.id.slice(0, 8)}-${ps}`, amount = prorate(term.amount_cents, covered, length)
   const line = { tenancyId: t.id, address: t.address, termId: term.id, kind: term.kind, description: term.description, currency: t.currency, shown: shown(t), periodStart: ps, periodEnd: pe, dueDate: a, coveredDays: covered, periodDays: length, amountCents: amount, termVersion:term.version, sourceClause: term.source_clause ?? null, leaseVersionId: term.lease_version_id ?? null, coveredFrom:a, coveredTo:b, reference, posted: posted.some(q => q.tenancy_id === t.id && q.reference === reference) } as Row
   if (term.kind === 'rent') rents.push(line)
   if (term.kind === 'concession') {
    const result=await concessionLines(c,line,rents)
    if(result.reason)missing.push({tenancyId:t.id,address:t.address,period:[ps,pe],reason:result.reason})
    lines.push(...result.lines)
    continue
   }
   lines.push(line)
   // ACCT-016: a parking or utility term's charge carries the tax its reviewed rule calls for, as its own line.
   const tax = term.kind === 'parking' || term.kind === 'utility' ? await taxCharge(c, t, term.kind, a, amount, reference, term.description) : null
   if (tax) lines.push({ ...line, kind: 'tax', termId: null, description: tax.description, amountCents: tax.amount, reference: tax.reference, taxRuleId: tax.rule.id, posted: posted.some(q => q.tenancy_id === t.id && q.reference === tax.reference) })
  }
  if (!rents.length) missing.push({ tenancyId: t.id, address: t.address, period: [ps, pe], reason: 'No rent term covers this period' })
 }
 const pending = lines.filter(l => !l.posted)
 return { month: m, lines, missing, fingerprint: await sha256(new TextEncoder().encode(JSON.stringify(pending))), newLines: pending.length }
}

export async function chargeRunCommand(c: Context, command: string, p: Row): Promise<Row | undefined> {
 if (command === 'term.add' || command === 'term.amend') {
  allow(c, command)
  const old = command === 'term.amend' ? await one(c, 'SELECT * FROM tt_lease_terms WHERE id=?', text(p.termId, 'Lease term', 100)) : null
  insist(command === 'term.add' || old, 'not_found', 'Lease term not found.', 404)
  const t = await tenancy(c, old?.tenancy_id ?? p.tenancyId), key = id(), kind = old?.kind ?? p.kind
  insist(KINDS.includes(kind), 'invalid_kind', `Choose a term kind: ${KINDS.join(', ')}.`)
  insist(!old?.lease_version_id && !(await one(c,'SELECT 1 FROM tt_lease_versions WHERE tenancy_id=? AND approved_at IS NOT NULL',t.id)), 'lease_version_required', 'This tenancy has a signed lease version. Prepare and review a signed amendment instead.',409)
  const starts = date(command === 'term.amend' ? p.effective : p.starts, command === 'term.amend' ? 'Effective date' : 'Starts'), ends = p.ends ? date(p.ends, 'Ends') : old?.ends ?? null
  insist(!ends || ends >= starts, 'invalid_term', 'A term must end on or after it starts.')
  const writes = [sql(c, 'INSERT INTO tt_lease_terms(id,tenancy_id,kind,description,amount_cents,currency,starts,ends,replaces,created_by,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)', key, t.id, kind, p.description ? text(p.description, 'Description', 200) : old?.description ?? text(p.description, 'Description', 200), cents(p.amount), t.currency, starts, ends, old?.id ?? null, c.actor.id, c.now)]
  if (old) {
   insist(starts > old.starts && (!old.ends || starts <= old.ends), 'invalid_amendment', 'The amendment must take effect within the current term, after it starts.')
   // Posted history is kept: an amendment cannot reach back into a posted period.
   const last = await one(c, "SELECT MAX(period_end) AS last FROM tt_charges WHERE term_id=?", old.id)
   insist(!last?.last || starts > last.last, 'posted_period', `Charges from this term are posted through ${last?.last}. Amend from a later date.`, 409)
   writes.unshift(guard(c, 'EXISTS(SELECT 1 FROM tt_lease_terms WHERE id=? AND version=?)', old.id, old.version), guard(c, 'NOT EXISTS(SELECT 1 FROM tt_charges WHERE term_id=? AND period_end>=?)', old.id, starts))
   writes.push(sql(c, 'UPDATE tt_lease_terms SET ends=?,version=version+1 WHERE id=?', addDays(starts, -1), old.id))
  }
  writes.unshift(guard(c,'NOT EXISTS(SELECT 1 FROM tt_lease_versions WHERE tenancy_id=? AND approved_at IS NOT NULL)',t.id))
  await commit(c, writes, command, key)
  return { id: key, tenancyId: t.id, notice: old ? 'Term amended from the effective date. Posted charges are unchanged.' : 'Lease term added.' }
 }
 if (command === 'charges.preview') return await preview(c, p.month)
 if (command === 'charges.post') {
  const run = await preview(c, p.month)
  insist(p.fingerprint === run.fingerprint, 'review_changed', 'The run changed since its preview. Preview it again and post the new lines.', 409)
  insist(!run.missing.some(x=>x.reason.startsWith('Concession')), 'concession_hold', 'Resolve the concession coverage or amount before posting this run.',409)
  const writes: D1PreparedStatement[] = [], chargeIds = new Map<string, string>()
  for(const l of run.lines.filter(l=>!l.posted&&l.termId))writes.push(guard(c,'EXISTS(SELECT 1 FROM tt_lease_terms WHERE id=? AND version=? AND superseded_by IS NULL)',l.termId,l.termVersion))
  for (const l of run.lines.filter(l => !l.posted && l.kind !== 'concession')) {
   const key = id(); chargeIds.set(l.tenancyId + l.reference, key)
   writes.push(sql(c, 'INSERT INTO tt_charges(id,tenancy_id,due_date,amount_cents,description,reference,created_at,currency,term_id,period_start,period_end,tax_rule_id) VALUES(?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(tenancy_id,reference) DO NOTHING', key, l.tenancyId, l.dueDate, l.amountCents, `${l.description} ${l.periodStart} to ${l.periodEnd}${l.coveredDays < l.periodDays ? ` (${l.coveredDays} of ${l.periodDays} days)` : ''}`, l.reference, c.now, l.currency, l.termId, l.periodStart, l.periodEnd, l.taxRuleId ?? null))
  }
  for (const l of run.lines.filter(l => !l.posted && l.kind === 'concession')) {
   const charge = chargeIds.get(l.tenancyId + l.rentReference) ?? (await one(c, 'SELECT id FROM tt_charges WHERE tenancy_id=? AND reference=?', l.tenancyId, l.rentReference))?.id
   writes.push(guard(c, `(SELECT ${BALANCE} FROM tt_charges q WHERE id=?)>=?`, charge, l.amountCents), sql(c, 'INSERT INTO tt_adjustments(id,charge_id,amount_cents,reason,at,currency,reference,posting_day) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT DO NOTHING', id(), charge, l.amountCents, `Concession: ${l.description} ${l.periodStart} to ${l.periodEnd}`, c.now, l.currency, l.reference,localDate(c.now,(await tenancy(c,l.tenancyId)).time_zone)))
  }
  if (writes.length) await commit(c, writes, command, run.month)
  return { month: run.month, posted: run.newLines, notice: `${run.newLines} ${run.newLines === 1 ? 'line' : 'lines'} posted for ${run.month}.` }
 }
}

export const terms = (c: Context, tenancyId: string) => all(c, 'SELECT * FROM tt_lease_terms WHERE tenancy_id=? AND superseded_by IS NULL ORDER BY kind,starts', tenancyId)
