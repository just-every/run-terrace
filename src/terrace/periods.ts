import {journalData} from './journal'
// ACCT-011. Closing a month of the recorded rent ledger. A month that has ended in the office time zone is closed
// once a bookkeeper (or the owner) has signed its three checklist items and no close correction is pending; the
// close keeps a statement of every posting dated in the month, and the database refuses any later charge due, or
// receipt received, in it (migration 0036). Reopening needs the owner or a bookkeeper and a reason; it supersedes
// that close version without editing it, and the next close is a new version beside it. Accountants prepare close
// corrections (a missed charge or receipt) that another bookkeeper, portfolio manager or the owner approves.
import { all, cents, commit, date, everywhere, guard, id, insist, one, reaches, reachesPortfolio, sql, tenancy, text, UNCONFIRMED, type Context, type Row } from './core'
import { independence } from './dual-control'
import { BALANCE } from './ledger'
import { DEFAULT_ZONE, localDate } from './zones'

export const CHECKLIST: [string, string][] = [
 ['receipts', 'Every receipt received in the month is recorded in Terrace'],
 ['deposits', 'Recorded receipts agree with the bank deposits for the month (checked by staff; Terrace has not matched a bank statement)'],
 ['exceptions', 'Open receivables and charge reductions in the month are reviewed and carried forward'],
]
export const PERIOD_COMMANDS = ['period.signoff', 'period.close', 'period.reopen', 'correction.prepare', 'correction.approve', 'correction.reject']
const KIND: Record<string, string> = { charge: 'Charge', receipt: 'Recorded external receipt', adjustment: 'Charge reduction' }

export function month(v: unknown) { const s = text(v, 'Month', 7); insist(/^\d{4}-(0[1-9]|1[0-2])$/.test(s), 'invalid_month', 'Month must be YYYY-MM.'); return s }
/** The office's current month: only months before it have ended and can close. */
const current = (c: Context) => localDate(c.now, c.zone ?? DEFAULT_ZONE).slice(0, 7)
const versions = (c: Context, m: string) => all(c, 'SELECT * FROM tt_period_closes WHERE month=? ORDER BY version', m)

/** Every posting dated in the month: charges by due date, receipts by received date, reductions by the property-local day they were recorded. */
async function postings(c: Context, m: string) {
 const unconfirmed = (r: Row) => r.currency_confirmed === 0 ? UNCONFIRMED : r.currency
 const [charges, receipts, reductions] = await Promise.all([
  all(c, 'SELECT q.id,q.tenancy_id,t.unit_id,q.due_date AS day,q.amount_cents,q.reference,q.currency,t.currency_confirmed FROM tt_charges q JOIN tt_tenancies t ON t.id=q.tenancy_id WHERE substr(q.due_date,1,7)=?', m),
  all(c, 'SELECT r.id,q.tenancy_id,t.unit_id,r.received_date AS day,r.amount_cents,r.reference,r.currency,t.currency_confirmed FROM tt_net_receipts r JOIN tt_charges q ON q.id=r.charge_id JOIN tt_tenancies t ON t.id=q.tenancy_id WHERE substr(r.received_date,1,7)=?', m),
  // A reduction's UTC time is at most one day either side of its property-local day.
  all(c, "SELECT a.id,q.tenancy_id,t.unit_id,a.at,t.time_zone,a.amount_cents,a.reason AS reference,a.currency,t.currency_confirmed FROM tt_adjustments a JOIN tt_charges q ON q.id=a.charge_id JOIN tt_tenancies t ON t.id=q.tenancy_id WHERE a.at>=date(?||'-01','-1 day') AND a.at<date(?||'-01','+1 month','+1 day')", m, m),
 ])
 const line = (kind: string) => (r: Row) => ({ id: r.id, kind, day: r.day ?? localDate(r.at, r.time_zone), tenancyId: r.tenancy_id, unitId: r.unit_id ?? null, reference: r.reference, amountCents: r.amount_cents, currency: unconfirmed(r) })
 return [...charges.map(line('charge')), ...receipts.map(line('receipt')), ...reductions.map(line('adjustment'))].filter(l => l.day.slice(0, 7) === m).sort((a, b) => a.day.localeCompare(b.day) || a.kind.localeCompare(b.kind) || a.id.localeCompare(b.id))
}
type Line = Awaited<ReturnType<typeof postings>>[number]
/** Per currency (never added across currencies): charges, receipts, reductions and the month's net receivable change. */
export function totals(lines: Line[]) {
 return [...new Set(lines.map(l => l.currency))].sort().map(currency => {
  const sum = (kind: string) => lines.filter(l => l.currency === currency && l.kind === kind).reduce((s, l) => s + l.amountCents, 0)
  const charges = sum('charge'), receipts = sum('receipt'), reductions = sum('adjustment')
  return { currency, chargesCents: charges, receiptsCents: receipts, reductionsCents: reductions, netCents: charges - receipts - reductions }
 })
}

async function openMonth(c: Context, p: Row) {
 everywhere(c)
 const m = month(p.month)
 insist(m < current(c), 'month_not_ended', 'Only a month that has ended in the office time zone can be signed off or closed.', 409)
 const list = await versions(c, m)
 insist(!list.some(v => !v.reopened_at), 'period_closed', 'This month is already closed. Reopen it first.', 409)
 return { m, version: list.length + 1 }
}

export async function periodCommand(c: Context, command: string, p: Row): Promise<Row | undefined> {
 if (!PERIOD_COMMANDS.includes(command)) return
 if (command === 'period.signoff') {
  const { m, version } = await openMonth(c, p), item = String(p.item ?? '')
  insist(CHECKLIST.some(x => x[0] === item), 'invalid_item', 'Choose a checklist item.')
  insist(!(await one(c, 'SELECT 1 FROM tt_close_signoffs WHERE month=? AND version=? AND item=?', m, version, item)), 'signed', 'This item is already signed off for this close.', 409)
  await commit(c, [sql(c, 'INSERT INTO tt_close_signoffs(month,version,item,signed_by,signed_at,note) VALUES(?,?,?,?,?,?)', m, version, item, c.actor.id, c.now, p.note ? text(p.note, 'Note', 500) : null)], command, `${m} v${version} ${item}`)
  return { month: m, version, item, notice: 'Signed off.' }
 }
 if (command === 'period.close') {
  const { m, version } = await openMonth(c, p)
  const signed = await all(c, 'SELECT item FROM tt_close_signoffs WHERE month=? AND version=?', m, version)
  insist(signed.length === CHECKLIST.length, 'checklist', 'Sign off every checklist item before closing.', 409)
  insist(!(await one(c, "SELECT 1 FROM tt_close_corrections WHERE month=? AND state='pending'", m)), 'pending_corrections', 'Approve or reject the pending close corrections first.', 409)
  const lines = await postings(c, m), key = id()
  const journalCount=(await one<{n:number}>(c,'SELECT COUNT(*) AS n FROM tt_journal'))!.n
  const journals=(await journalData(c,{from:m+'-01',to:new Date(Date.UTC(Number(m.slice(0,4)),Number(m.slice(5)),0)).toISOString().slice(0,10)})).entries.map(({reference,...j})=>j)
  await commit(c, [
   guard(c, "NOT EXISTS(SELECT 1 FROM tt_close_corrections WHERE month=? AND state='pending') AND (SELECT COUNT(*) FROM tt_close_signoffs WHERE month=? AND version=?)=?", m, m, version, CHECKLIST.length),
   guard(c,'(SELECT COUNT(*) FROM tt_journal)=?',journalCount),
   sql(c, 'INSERT INTO tt_period_closes(id,month,version,closed_by,closed_at,statement,journal_statement) VALUES(?,?,?,?,?,?,?)', key, m, version, c.actor.id, c.now, JSON.stringify(lines),JSON.stringify(journals)),
  ], command, `${m} v${version}`)
  return { id: key, month: m, version, notice: `${m} closed (version ${version}).` }
 }
 if (command === 'period.reopen') {
  everywhere(c)
  const m = month(p.month), reason = text(p.reason, 'Reopening reason', 1000)
  const open = (await versions(c, m)).find(v => !v.reopened_at)
  insist(open, 'period_open', 'This month is not closed.', 409)
  await commit(c, [sql(c, 'UPDATE tt_period_closes SET reopened_by=?,reopened_at=?,reopen_reason=? WHERE id=? AND reopened_at IS NULL', c.actor.id, c.now, reason, open.id), guard(c, 'EXISTS(SELECT 1 FROM tt_period_closes WHERE id=? AND reopened_by=? AND reopened_at=?)', open.id, c.actor.id, c.now)], command, `${m} v${open.version}`)
  return { month: m, version: open.version, notice: `${m} reopened. Version ${open.version} is superseded.` }
 }
 if (command === 'correction.prepare') {
  const t = await tenancy(c, p.tenancyId), kind = String(p.kind ?? ''), reason = text(p.reason, 'Correction reason', 1000)
  insist(['charge', 'receipt'].includes(kind), 'invalid_kind', 'A close correction is a missed charge or a missed receipt.')
  let payload: Row
  if (kind === 'charge') payload = { dueDate: date(p.dueDate, 'Due date'), amount: cents(p.amount), description: text(p.description, 'Description', 300), reference: text(p.reference, 'Unique charge reference', 150) }
  else {
   const charge = await one(c, 'SELECT id FROM tt_charges WHERE id=? AND tenancy_id=?', text(p.chargeId, 'Charge', 100), t.id)
   insist(charge, 'not_found', 'Charge not found.', 404)
   const method = p.method ? String(p.method) : null
   insist(!method || ['ach', 'card', 'cash', 'check', 'other'].includes(method), 'invalid_method', 'Method is ach, card, cash, check or other.')
   payload = { chargeId: charge.id, amount: cents(p.amount), receivedDate: date(p.receivedDate, 'Received date'), reference: text(p.reference, 'External receipt reference', 150), method }
  }
  const m = String(payload.dueDate ?? payload.receivedDate).slice(0, 7), key = id()
  insist(m < current(c), 'month_not_ended', 'A close correction is for a month that has ended. Post this month’s entries directly.', 409)
  await commit(c, [sql(c, 'INSERT INTO tt_close_corrections(id,month,tenancy_id,kind,payload,reason,prepared_by,prepared_at) VALUES(?,?,?,?,?,?,?,?)', key, m, t.id, kind, JSON.stringify(payload), reason, c.actor.id, c.now)], command, key)
  return { id: key, month: m, tenancyId: t.id, notice: 'Close correction prepared for approval. Nothing is posted yet.' }
 }
 const row = await one(c, 'SELECT * FROM tt_close_corrections WHERE id=?', text(p.correctionId, 'Correction', 100))
 insist(row, 'not_found', 'Correction not found.', 404)
 await tenancy(c, row.tenancy_id)
 insist(row.state === 'pending', 'decided', 'This correction was already decided.', 409)
 const still = guard(c, "EXISTS(SELECT 1 FROM tt_close_corrections WHERE id=? AND state='pending')", row.id)
 if (command === 'correction.reject') {
  await commit(c, [still, sql(c, "UPDATE tt_close_corrections SET state='rejected',decided_by=?,decided_at=? WHERE id=?", c.actor.id, c.now, row.id)], command, row.id)
  return { id: row.id, month: row.month, notice: 'Correction rejected. Nothing was posted.' }
 }
 // Approval posts the exact prepared entry, which the database refuses while its month is closed.
 const { label, guards } = await independence(c, command, [row.prepared_by]), x = JSON.parse(row.payload), posted = id()
 const t = await one(c, 'SELECT currency FROM tt_tenancies WHERE id=?', row.tenancy_id)
 const write = row.kind === 'charge'
  ? [sql(c, 'INSERT INTO tt_charges(id,tenancy_id,due_date,amount_cents,description,reference,created_at,currency) VALUES(?,?,?,?,?,?,?,?)', posted, row.tenancy_id, x.dueDate, x.amount, x.description, x.reference, c.now, t!.currency)]
  : [guard(c, `(SELECT ${BALANCE} FROM tt_charges q WHERE id=?)>=?`, x.chargeId, x.amount), sql(c, 'INSERT INTO tt_receipts(id,charge_id,amount_cents,received_date,reference,created_at,currency,method) SELECT ?,id,?,?,?,?,currency,? FROM tt_charges WHERE id=?', posted, x.amount, x.receivedDate, x.reference, c.now, x.method, x.chargeId)]
 await commit(c, [still, ...guards, ...write, sql(c, "UPDATE tt_close_corrections SET state='approved',decided_by=?,decided_at=?,approval_label=?,posted_id=? WHERE id=?", c.actor.id, c.now, label, posted, row.id)], command, row.id)
 return { id: row.id, month: row.month, postedId: posted, notice: 'Correction approved and posted.' }
}

/** The month's close state, checklist, exception queue, corrections and every close version with what changed from the one before. */
export async function periodData(c: Context, value: unknown) {
 const m = value ? month(value) : (() => { const d = new Date(current(c) + '-01T00:00:00Z'); d.setUTCMonth(d.getUTCMonth() - 1); return d.toISOString().slice(0, 7) })()
 const [list, live, open, corrections] = await Promise.all([
  versions(c, m), postings(c, m),
  all(c, `SELECT q.id,q.tenancy_id,t.unit_id,t.address,q.due_date,q.description,q.reference,q.currency,t.currency_confirmed,${BALANCE} AS balance_cents FROM tt_charges q JOIN tt_tenancies t ON t.id=q.tenancy_id WHERE substr(q.due_date,1,7)=? ORDER BY q.due_date`, m),
  all(c, 'SELECT k.*,t.unit_id,t.address FROM tt_close_corrections k JOIN tt_tenancies t ON t.id=k.tenancy_id WHERE k.month=? ORDER BY k.prepared_at', m),
 ])
 // ROLE-001: lines, receivables and corrections on tenancies outside the reader's portfolios are left out, and totals follow what is shown.
 const mine = <T extends Row>(rows: T[], unit: (r: T) => string | null) => rows.filter(r => reaches(c, unit(r)))
 const closed = list.find(v => !v.reopened_at), version = closed ? closed.version : list.length + 1
 const signoffs = closed ? [] : await all(c, 'SELECT * FROM tt_close_signoffs WHERE month=? AND version=?', m, version)
 const shownLines = (lines: Line[]) => mine(lines, l => l.unitId)
 const propertyScopes=await all(c,'SELECT id,portfolio_id FROM tt_properties')
 const history = list.map((v, i) => {
  const lines = shownLines(JSON.parse(v.statement)), before = i ? shownLines(JSON.parse(list[i - 1].statement)) : null
  const ids = new Set(lines.map(l => l.id)), was = new Set((before ?? []).map(l => l.id))
  const journal=JSON.parse(v.journal_statement).filter((j:Row)=>j.property_id?propertyScopes.some(p=>p.id===j.property_id&&reachesPortfolio(c,p.portfolio_id)):c.actor.role==='owner'||c.actor.staff?.all)
  return { journal, version: v.version, closedBy: v.closed_by, closedAt: v.closed_at, superseded: !!v.reopened_at, reopenedBy: v.reopened_by, reopenedAt: v.reopened_at, reopenReason: v.reopen_reason, lines, totals: totals(lines), added: before ? lines.filter(l => !was.has(l.id)) : [], removed: before ? before.filter(l => !ids.has(l.id)) : [] }
 })
 const receivables = mine(open, r => r.unit_id).filter(r => r.balance_cents > 0).map(r => ({ ...r, currency: r.currency_confirmed === 0 ? UNCONFIRMED : r.currency }))
 return {
  month: m, state: closed ? 'closed' : 'open', version, ended: m < current(c),
  checklist: CHECKLIST.map(([item, label]) => { const s = signoffs.find(x => x.item === item); return { item, label, signedBy: s?.signed_by ?? null, signedAt: s?.signed_at ?? null, note: s?.note ?? null } }),
  exceptions: { openReceivables: receivables, pendingCorrections: mine(corrections, r => r.unit_id).filter(k => k.state === 'pending').length },
  corrections: mine(corrections, r => r.unit_id).map(k => ({ id: k.id, tenancyId: k.tenancy_id, address: k.address, kind: k.kind, payload: JSON.parse(k.payload), reason: k.reason, state: k.state, preparedBy: k.prepared_by, preparedAt: k.prepared_at, decidedBy: k.decided_by, approvalLabel: k.approval_label, postedId: k.posted_id })),
  live: { lines: shownLines(live), totals: totals(shownLines(live)) },
  versions: history,
 }
}

/** One close version's statement as a table, marked superseded with the reopening reason when it was reopened. */
export function closeTable(d: Awaited<ReturnType<typeof periodData>>, version: number, names: Record<string, string>) {
 const v = d.versions.find(x => x.version === version)
 insist(v, 'not_found', 'Close version not found.', 404)
 const status = v.superseded ? `Superseded: reopened ${v.reopenedAt} by ${names[v.reopenedBy] ?? v.reopenedBy}. Reason: ${v.reopenReason}` : 'Current close'
 return [['Terrace month close', d.month, `Version ${v.version}`], ['Closed', v.closedAt, names[v.closedBy] ?? v.closedBy], ['Status', status], ['Date', 'Kind', 'Reference', 'Tenancy', 'Currency', 'Amount'], ...v.lines.map(l => [l.day, KIND[l.kind], l.reference, l.tenancyId, l.currency, (l.amountCents / 100).toFixed(2)]), ...v.totals.flatMap(t => [[`Charges ${t.currency}`, (t.chargesCents / 100).toFixed(2)], [`Receipts ${t.currency}`, (t.receiptsCents / 100).toFixed(2)], [`Reductions ${t.currency}`, (t.reductionsCents / 100).toFixed(2)], [`Net receivable change ${t.currency}`, (t.netCents / 100).toFixed(2)]]), ['Recorded rent only. Not a bank reconciliation, trust account or tax statement.']]
}
export const kindLabel = (kind: string) => KIND[kind] ?? kind
