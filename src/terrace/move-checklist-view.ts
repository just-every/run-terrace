// PORT-006: reuse the app's established disclosures, fields and status pills.
import { escape as e, type Row } from './core'
import { usDate } from './format'
import { form, hidden, input, button } from './view'
import { MOVE_ITEMS, MOVE_STATES } from './move-checklists'
function snapshot(row: Row) {
 return `<p>${usDate(row.move_date)} · revision ${row.version} · ${row.needsReview ? 'Lease dates changed — review required' : row.complete ? 'Operational items recorded' : 'Pending operational items'}</p><dl>${MOVE_ITEMS.map(([key, label]) => `<dt>${e(label)} · ${e(MOVE_STATES.find(([v]) => v === row.items[key].state)?.[1])}</dt><dd>${e(row.items[key].notes || 'No details recorded.')}</dd>`).join('')}</dl><p class="muted">Source: ${e(row.reference)} · Recorded ${e(row.recorded_at)} by ${e(row.recorded_by)}</p>`
}
export function moveChecklistSection(t: Row, rows: Row[], manage: boolean) {
 return `<section id="move-checklists"><h2>Move-in &amp; move-out checklists</h2><p class="muted">Record the sourced handover for this lease. Pending items stay open. Operational records do not post charges, reconcile final balances or dispose of a deposit.</p>${(['move_in', 'move_out'] as const).map(kind => {
  const list = rows.filter(r => r.kind === kind), current = list[0], name = kind === 'move_in' ? 'Move-in' : 'Move-out'
  return `<article><h3>${name} handover</h3>${current ? snapshot(current) : '<p>No handover recorded.</p>'}${manage ? `<details><summary>Record ${name.toLowerCase()} checklist</summary>${form('move.checklist', hidden('kind', kind) + hidden('version', current?.version ?? 0) + hidden('leaseVersion', t.version) + input('Handover date', 'moveDate', 'date', kind === 'move_in' ? t.start_date : t.ended_on ?? current?.move_date ?? t.end_date) + MOVE_ITEMS.map(([key, label]) => `<label>${e(label)} status<select name="${key}State">${MOVE_STATES.map(([value, title]) => `<option value="${value}"${(current?.items[key].state ?? 'pending') === value ? ' selected' : ''}>${e(title)}</option>`).join('')}</select></label><label>${e(label)} details or reason<textarea name="${key}Notes" maxlength="1000">${e(current?.items[key].notes ?? '')}</textarea></label>`).join('') + input('Handover source reference', 'reference', 'text', current?.reference ?? '', 'maxlength="500"') + button('Save handover checklist'), t.id)}</details>` : ''}${list.length > 1 ? `<details><summary>Earlier ${name.toLowerCase()} revisions (${list.length - 1})</summary>${list.slice(1).map(snapshot).join('')}</details>` : ''}</article>`
 }).join('')}</section>`
}
