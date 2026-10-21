// SAFE-002. The operating history view and export: who did what, when, under which role and role version, on which
// tenancy, with the source they gave and the outcome, including sensitive reads and exports. The owner reads and
// exports everything; portfolio managers read and accountants read and export history about tenancies in their
// portfolios (history with no tenancy only with all portfolios). Reading or filtering records nothing; an export
// is itself recorded. Rows are never edited or deleted (triggers in migration 0035).
import { all, allow, can, date, escape as e, insist, reaches, recordRead, text, type Context, type Row } from './core'
import { usDate } from './format'

export async function history(c: Context, q: Row) {
 allow(c, 'history.read')
 const from = q.from ? date(q.from, 'From') : null, to = q.to ? date(q.to, 'To') : null, limit = q.limit ? Number(q.limit) : 500
 insist(Number.isInteger(limit) && limit >= 1 && limit <= 5000, 'invalid_filter', 'Limit is 1 to 5000 rows.')
 const where: string[] = [], args: unknown[] = []
 if (from) { where.push('a.at>=?'); args.push(from) }
 if (to) { where.push('a.at<?'); args.push(new Date(Date.parse(to + 'T00:00:00Z') + 86400000).toISOString()) }
 if (q.before) { where.push('a.at<?'); args.push(text(q.before, 'Before', 40)) }
 if (q.actor) { where.push('a.actor=?'); args.push(text(q.actor, 'Actor', 100)) }
 if (q.action) { where.push('a.action LIKE ?'); args.push(text(q.action, 'Action', 60).replace(/[%_]/g, '') + '%') }
 if (q.tenancyId) { where.push('a.tenancy_id=?'); args.push(text(q.tenancyId, 'Tenancy', 100)) }
 const rows = await all(c, `SELECT a.*,COALESCE(o.display_name,k.label||' (API credential)',a.actor) AS actor_name,t.unit_id AS tenancy_unit,t.id AS tenancy_live FROM tt_audit a LEFT JOIN oa_operators o ON o.id=a.actor LEFT JOIN tt_api_credentials k ON k.id=a.actor LEFT JOIN tt_tenancies t ON t.id=a.tenancy_id${where.length ? ' WHERE ' + where.join(' AND ') : ''} ORDER BY a.at DESC,a.id DESC`, ...args)
 // Scope: a row about a tenancy the reader reaches; a row with no live tenancy only for the owner and all-portfolio readers.
 const visible = rows.filter(r => r.tenancy_live ? reaches(c, r.tenancy_unit) : c.actor.role === 'owner' || !!c.actor.staff?.all).slice(0, limit)
 return { rows: visible.map(r => ({ id: r.id, at: r.at, actor: r.actor, actorName: r.actor_name, role: r.role ?? null, policy: r.policy ?? null, action: r.action, subject: r.subject, tenancyId: r.tenancy_id ?? null, source: r.source ?? null, outcome: r.outcome ?? 'recorded' })), next: visible.length === limit ? visible.at(-1)!.at : null }
}
export async function historyCsv(c: Context, q: Row) {
 allow(c, 'history.export')
 const h = await history(c, q)
 await recordRead(c, 'export:history', JSON.stringify(Object.fromEntries(['from', 'to', 'actor', 'action', 'tenancyId'].filter(k => q[k]).map(k => [k, q[k]]))))
 return [['At (UTC)', 'Actor', 'Role', 'Policy', 'Action', 'Subject', 'Tenancy', 'Source', 'Outcome'], ...h.rows.map(r => [r.at, r.actorName, r.role ?? '', r.policy ?? '', r.action, r.subject, r.tenancyId ?? '', r.source ?? '', r.outcome])]
}
export function historyView(c: Context, data: Awaited<ReturnType<typeof history>>, q: Row) {
 const filter = `<form method="get" action="/app"><input type="hidden" name="tab" value="history"><label>From<input name="from" type="date" value="${e(q.from ?? '')}"></label><label>To<input name="to" type="date" value="${e(q.to ?? '')}"></label><label>Action starts with<input name="action" value="${e(q.action ?? '')}"></label><button type="submit">Filter</button></form>`
 const csv = can(c, 'history.export') ? `<p><a class="button secondary" href="/api/history?format=csv${['from', 'to', 'action'].filter(k => q[k]).map(k => `&amp;${k}=${encodeURIComponent(q[k])}`).join('')}" download>Export history (CSV)</a></p>` : ''
 const rows = data.rows.map(r => `<tr><td>${usDate(r.at)} ${e(r.at.slice(11, 16))} UTC</td><td>${e(r.actorName)}</td><td>${e(r.policy ?? r.role ?? '')}</td><td>${e(r.action)}</td><td>${e(r.source ?? '')}</td><td>${e(r.outcome)}</td></tr>`).join('')
 return `<section><h2>History</h2><p class="muted">Every change, sensitive read and export, with who acted, their role and its version at the time, and the source they gave. History is never edited or deleted.</p>${filter}${csv}<table><thead><tr><th>When</th><th>Who</th><th>Role</th><th>Action</th><th>Source</th><th>Outcome</th></tr></thead><tbody>${rows}</tbody></table>${data.next ? `<p><a href="/app?tab=history&amp;before=${encodeURIComponent(data.next)}">Older</a></p>` : ''}</section>`
}
