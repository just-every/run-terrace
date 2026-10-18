// The Tenancies home: this calendar month's recorded rent per tenancy, the work and decisions waiting on a
// person, and the month's dated events. Every figure is read from recorded charges, receipts, proposals,
// inspections and maintenance; nothing is estimated.
import { all, type Context, type Row } from './core'
import { BALANCE } from './ledger'
import { place } from './format'

export type Standing = 'paid' | 'partial' | 'overdue' | 'due' | 'none'
export type Stop = { date: string; label: string; tone: 'green' | 'blue' | 'amber' | 'red' | 'violet'; today?: boolean }

export async function monthData(c: Context, tenancies: Row[]) {
 const today = c.now.slice(0, 10), first = today.slice(0, 8) + '01'
 const last = new Date(Date.UTC(Number(today.slice(0, 4)), Number(today.slice(5, 7)), 0)).toISOString().slice(0, 10)
 const [charges, proposals, jobs, inspections] = await Promise.all([
  all(c, `SELECT q.id,q.tenancy_id,q.due_date,q.amount_cents,${BALANCE} AS balance_cents,COALESCE((SELECT SUM(amount_cents) FROM tt_receipts WHERE charge_id=q.id),0) AS received_cents,(SELECT MAX(received_date) FROM tt_receipts WHERE charge_id=q.id) AS received_date FROM tt_charges q WHERE q.due_date BETWEEN ? AND ? ORDER BY q.due_date`, first, last),
  all(c, "SELECT p.id,p.tenancy_id,p.kind,p.payload,p.prepared_at,COALESCE(o.display_name,p.prepared_by) AS prepared_name FROM tt_proposals p LEFT JOIN oa_operators o ON o.id=p.prepared_by WHERE p.state='pending' AND p.kind IN ('renewal','arrears') ORDER BY p.prepared_at DESC"),
  all(c, "SELECT id,tenancy_id,title,trade_name,estimate_cents,due_date,state,sent_at FROM tt_maintenance_jobs ORDER BY prepared_at DESC"),
  all(c, "SELECT i.id,i.tenancy_id,i.inspection_date,i.state,i.completed_at,(SELECT COUNT(*) FROM tt_inspection_photos p WHERE p.inspection_id=i.id) AS photos FROM tt_inspections i ORDER BY i.inspection_date DESC"),
 ])
 const byId = new Map(tenancies.map(t => [t.id, t]))
 const unit = (tenancyId: string) => { const t = byId.get(tenancyId); if (!t) return ''; const p = place(t.address); return p.unit ? (/^\w+$/.test(p.unit) ? `Unit ${p.unit}` : p.unit) : p.property.split(',')[0] }
 // Track labels drop "Unit" ("3A handoff") so the stops stay one short line.
 const short = (tenancyId: string) => unit(tenancyId).replace(/^Unit /, '')

 const rows = tenancies.map(t => {
  const mine = charges.filter(q => q.tenancy_id === t.id)
  const due = mine.reduce((s, q) => s + q.amount_cents, 0), balance = mine.reduce((s, q) => s + q.balance_cents, 0), received = mine.reduce((s, q) => s + q.received_cents, 0)
  const unpaid = mine.filter(q => q.balance_cents > 0), oldest = unpaid[0]?.due_date
  const standing: Standing = !mine.length ? 'none' : balance === 0 ? 'paid' : received > 0 ? 'partial' : oldest < today ? 'overdue' : 'due'
  const receivedDate = mine.map(q => q.received_date).filter(Boolean).sort().at(-1) ?? ''
  return { tenancy: t, ...place(t.address), due, balance, received, standing, oldest, receivedDate, pending: proposals.filter(p => p.tenancy_id === t.id) }
 })
 const charged = rows.filter(r => r.standing !== 'none')
 const totals = { due: charged.reduce((s, r) => s + r.due, 0), received: charged.reduce((s, r) => s + r.received, 0), outstanding: charged.reduce((s, r) => s + r.balance, 0), paid: charged.filter(r => r.standing === 'paid').length, charged: charged.length }

 const waiting: Row[] = [
  ...proposals.map(p => ({ kind: p.kind, tenancyId: p.tenancy_id, unit: unit(p.tenancy_id), payload: JSON.parse(p.payload), id: p.id, preparedBy: p.prepared_name, rentCents: byId.get(p.tenancy_id)?.rent_cents })),
  ...jobs.filter(j => j.state !== 'sent').map(j => ({ kind: 'maintenance', tenancyId: j.tenancy_id, unit: unit(j.tenancy_id), job: j })),
  ...inspections.filter(i => i.state === 'draft').map(i => ({ kind: 'inspection', tenancyId: i.tenancy_id, unit: unit(i.tenancy_id), inspection: i })),
 ]

 // Interleave kinds so the first cards show one of each kind waiting.
 const kinds = [...new Set(waiting.map(w => w.kind))], order = new Map<Row, number>()
 for (const k of kinds) waiting.filter(w => w.kind === k).forEach((w, i) => order.set(w, i * kinds.length + kinds.indexOf(k)))
 waiting.sort((a, b) => order.get(a)! - order.get(b)!)

 const inMonth = (d: unknown) => typeof d === 'string' && d.slice(0, 10) >= first && d.slice(0, 10) <= last
 const events: Stop[] = []
 for (const d of [...new Set(charges.map(q => q.due_date))]) { const open = charges.some(q => q.due_date === d && q.balance_cents > 0); events.push({ date: d, label: 'Rent due', tone: !open ? 'green' : d < today ? 'red' : 'amber' }) }
 for (const j of jobs) if (j.sent_at && inMonth(j.sent_at)) events.push({ date: j.sent_at.slice(0, 10), label: `${short(j.tenancy_id)} handoff`, tone: 'blue' })
 for (const i of inspections) {
  if (i.state === 'completed' && inMonth(i.completed_at)) events.push({ date: i.completed_at.slice(0, 10), label: `${short(i.tenancy_id)} inspection`, tone: 'green' })
  else if (i.state === 'draft' && inMonth(i.inspection_date)) events.push({ date: i.inspection_date, label: `${short(i.tenancy_id)} inspection draft`, tone: 'blue' })
 }
 for (const p of proposals) { const f = p.kind === 'arrears' ? JSON.parse(p.payload).followUpDate : ''; if (inMonth(f)) events.push({ date: f, label: `${short(p.tenancy_id)} follow-up`, tone: 'amber' }) }
 for (const t of tenancies) if (inMonth(t.end_date)) events.push({ date: t.end_date, label: `${short(t.id)} lease ends`, tone: 'violet' })
 const seen = new Set<string>(), unique = events.sort((a, b) => a.date.localeCompare(b.date)).filter(s => !seen.has(s.date + s.label) && seen.add(s.date + s.label))
 // At most four stops each side of today, the nearest kept.
 const track = [...unique.filter(s => s.date <= today).slice(-4), { date: today, label: 'Today', tone: 'violet' as const, today: true }, ...unique.filter(s => s.date > today).slice(0, 4)]
 return { today, first, rows, totals, waiting, track }
}
