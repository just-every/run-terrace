// SAFE-002. The operating history view and export: who did what, when, under which role and role version, on which
// tenancy, with the source they gave and the outcome, including sensitive reads and exports. The owner reads and
// exports everything; portfolio managers read and accountants read and export history about tenancies in their
// portfolios (history with no tenancy only with all portfolios). Reading or filtering records nothing; an export
// is itself recorded. Rows are never edited or deleted (triggers in migration 0035).
import { all, allow, can, date, escape as e, insist, reaches, recordRead, text, type Context, type Row } from './core'
import { localTime } from './format'
import { DEFAULT_ZONE } from './zones'
import { actionGroups,actionLabel,outcomeLabel,referenceLabel,rolePolicyLabel,UUID } from './history-labels'

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
 const rows = await all(c, `SELECT a.*,COALESCE(a.agent_label,o.display_name,k.label||' (API credential)',a.actor) AS actor_name,t.unit_id AS tenancy_unit,t.id AS tenancy_live FROM tt_audit a LEFT JOIN oa_operators o ON o.id=a.actor LEFT JOIN tt_api_credentials k ON k.id=a.actor LEFT JOIN tt_tenancies t ON t.id=a.tenancy_id${where.length ? ' WHERE ' + where.join(' AND ') : ''} ORDER BY a.at DESC,a.id DESC`, ...args)
 // Scope: a row about a tenancy the reader reaches; a row with no live tenancy only for the owner and all-portfolio readers.
 const visible = rows.filter(r => r.tenancy_live ? reaches(c, r.tenancy_unit) : c.actor.role === 'owner' || !!c.actor.staff?.all).slice(0, limit)
 return { rows: visible.map(r => ({ id: r.id, at: r.at, actor: r.actor, actorName: r.actor_name, role: r.role ?? null, policy: r.policy ?? null, action: r.action, subject: r.subject, tenancyId: r.tenancy_id ?? null, source: r.source ?? null, outcome: r.outcome ?? 'recorded' })), next: visible.length === limit ? visible.at(-1)!.at : null }
}
/** Current display labels are resolved separately; the JSON history door retains the original audit fields. */
export async function historyForView(c:Context,q:Row){
 const data=await history(c,q)
 const ids=[...new Set(data.rows.flatMap(r=>[r.subject,r.tenancyId,r.actor,...String(r.subject).matchAll(UUID)].map(v=>Array.isArray(v)?v[0]:v)).filter(Boolean))]
 const labels=new Map<string,string>(),zones=new Map<string,string>()
 if(ids.length){
  // Keep reference lookups separate: accounting views already contain compound
  // selects, so combining every record kind can exceed D1's select-term limit.
  const queries = [
   `SELECT t.id,CASE WHEN t.erased_at IS NOT NULL THEN 'Erased tenancy' ELSE t.address||' · '||t.tenant_name END AS label,t.time_zone AS zone FROM tt_tenancies t JOIN refs r ON r.id=t.id`,
   `SELECT o.id,o.display_name AS label,NULL AS zone FROM oa_operators o JOIN refs r ON r.id=o.id`,
   `SELECT k.id,k.label||' (API credential)' AS label,NULL AS zone FROM tt_api_credentials k JOIN refs r ON r.id=k.id`,
   `SELECT p.id,p.name||' · '||p.address AS label,NULL AS zone FROM tt_properties p JOIN refs r ON r.id=p.id`,
   `SELECT u.id,p.name||' · Unit '||u.identifier AS label,NULL AS zone FROM tt_units u JOIN tt_properties p ON p.id=u.property_id JOIN refs r ON r.id=u.id`,
   `SELECT p.id,p.name AS label,NULL AS zone FROM tt_portfolios p JOIN refs r ON r.id=p.id`,
   `SELECT v.id,v.name AS label,NULL AS zone FROM tt_vendors v JOIN refs r ON r.id=v.id`,
   `SELECT o.id,o.legal_name AS label,NULL AS zone FROM tt_owners o JOIN refs r ON r.id=o.id`,
   `SELECT q.id,q.description||' · '||q.reference AS label,NULL AS zone FROM tt_charges q JOIN refs r ON r.id=q.id`,
   `SELECT x.id,'Receipt · '||x.reference AS label,NULL AS zone FROM tt_net_receipts x JOIN refs r ON r.id=x.id`,
   `SELECT p.id,p.filename AS label,NULL AS zone FROM tt_inspection_photos p JOIN refs r ON r.id=p.id`,
   `SELECT i.id,'Inspection · '||i.inspection_date AS label,NULL AS zone FROM tt_inspections i JOIN refs r ON r.id=i.id`,
   `SELECT j.id,j.title AS label,NULL AS zone FROM tt_maintenance_jobs j JOIN refs r ON r.id=j.id`,
   `SELECT p.id,p.kind||' proposal' AS label,NULL AS zone FROM tt_proposals p JOIN refs r ON r.id=p.id`,
  ]
  const records=(await Promise.all(queries.map(query=>all(c,`WITH refs AS (SELECT value AS id FROM json_each(?)) ${query}`,JSON.stringify(ids))))).flat()
  for(const row of records){labels.set(row.id,referenceLabel(row.label,new Map()));if(row.zone)zones.set(row.id,row.zone)}
 }
 return {...data,rows:data.rows.map(r=>{
  const tenancyLabel=referenceLabel(r.tenancyId,labels),subject=referenceLabel(r.subject,labels)
  return {...r,actorLabel:r.actor==='scheduler:workflows'?'Workflow scheduler':referenceLabel(r.actorName,labels),tenancyLabel,sourceLabel:referenceLabel(r.source,labels),subjectLabel:subject==='record reference (label unavailable)'&&r.tenancyId&&labels.has(r.tenancyId)?tenancyLabel:subject,timeZone:zones.get(r.tenancyId??'')??c.zone??DEFAULT_ZONE}
 })}
}
export async function historyCsv(c: Context, q: Row) {
 allow(c, 'history.export')
 const h = await historyForView(c, q)
 await recordRead(c, 'export:history', JSON.stringify(Object.fromEntries(['from', 'to', 'actor', 'action', 'tenancyId'].filter(k => q[k]).map(k => [k, q[k]]))))
 return [['When (property or office time)', 'Actor', 'Role', 'Policy', 'Action', 'Subject', 'Tenancy', 'Source', 'Outcome'], ...h.rows.map(r => [localTime(r.at,r.timeZone), r.actorLabel, rolePolicyLabel(r.role,null), rolePolicyLabel(r.role,r.policy), actionLabel(r.action), r.subjectLabel, r.tenancyLabel, r.sourceLabel, outcomeLabel(r.outcome)])]
}
export function historyView(c: Context, data: Awaited<ReturnType<typeof historyForView>>, q: Row) {
 const actions=[...new Set([...actionGroups,...data.rows.map(r=>r.action),...(q.action?[String(q.action)]:[])])].sort((a,b)=>actionLabel(a).localeCompare(actionLabel(b)))
 const filters=['from','to','actor','action','tenancyId']
 const filter = `<form method="get" action="/app"><input type="hidden" name="tab" value="history">${['actor','tenancyId'].filter(k=>q[k]).map(k=>`<input type="hidden" name="${k}" value="${e(q[k])}">`).join('')}<label>From<input name="from" type="date" value="${e(q.from ?? '')}"></label><label>To<input name="to" type="date" value="${e(q.to ?? '')}"></label><label>Action<select name="action"><option value="">All actions</option>${actions.map(a=>`<option value="${e(a)}"${q.action===a?' selected':''}>${e(actionLabel(a))}</option>`).join('')}</select></label><button type="submit">Filter</button></form>`
 const csv = can(c, 'history.export') ? `<p><a class="button secondary" href="/api/history?format=csv${filters.filter(k => q[k]).map(k => `&amp;${k}=${encodeURIComponent(q[k])}`).join('')}" download>Export history (CSV)</a></p>` : ''
 const rows = data.rows.map(r => `<tr><td data-label="When">${e(localTime(r.at,r.timeZone))}</td><td data-label="Who">${e(r.actorLabel)}</td><td data-label="Role">${e(rolePolicyLabel(r.role,r.policy))}</td><td data-label="Action">${e(actionLabel(r.action))}</td><td data-label="Record">${e(r.subjectLabel)}${r.tenancyLabel&&r.subjectLabel!==r.tenancyLabel?`<br><span class="muted">${e(r.tenancyLabel)}</span>`:''}</td><td data-label="Source">${e(r.sourceLabel)}</td><td data-label="Outcome">${e(outcomeLabel(r.outcome))}</td></tr>`).join('')
 return `<section><h2>History</h2><p class="muted">Every change, sensitive read and export, with who acted, their role and its version at the time, and the source they gave. History is never edited or deleted. Record names show their current labels. Times use the property’s time zone, or the office time zone for installation records. Date filters use UTC calendar days.</p>${filter}${csv}<table class="history-table"><thead><tr><th>When</th><th>Who</th><th>Role</th><th>Action</th><th>Record</th><th>Source</th><th>Outcome</th></tr></thead><tbody>${rows}</tbody></table>${data.next ? `<p><a href="/app?tab=history${filters.filter(k=>q[k]).map(k=>`&amp;${k}=${encodeURIComponent(q[k])}`).join('')}&amp;before=${encodeURIComponent(data.next)}">Older</a></p>` : ''}</section>`
}
