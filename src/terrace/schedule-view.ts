// WORK-010: recurring maintenance on Inspections & maintenance: schedules, each occurrence's order or deferral,
// and the explicit overdue exceptions.
import { escape as e, money, shown, type Row } from './core'
import { usDate } from './format'
import { tradeSelect } from './vendor-view'

const hidden = (name: string, value: unknown) => `<input type="hidden" name="${e(name)}" value="${e(value)}">`
const form = (command: string, tenancyId: string, body: string) => `<form method="post" action="/app/command">${hidden('command', command)}${hidden('tenancyId', tenancyId)}${hidden('tab', 'work')}${body}</form>`
const field = (label: string, name: string, type = 'text', extra = '') => `<label>${e(label)}<input name="${e(name)}" type="${type}" required ${extra}></label>`
const select = (label: string, name: string, rows: Row[], text: (r: Row) => string, optional = '') => `<label>${e(label)}<select name="${e(name)}">${optional ? `<option value="">${e(optional)}</option>` : ''}${rows.map(r => `<option value="${e(r.id)}">${e(text(r))}</option>`).join('')}</select></label>`

function occurrence(s: Row, o: Row, data: Row) {
 const asset = (data.assets as Row[]).find(a => a.id === o.assetId)
 const state = o.jobId ? `order ${o.jobState === 'pending' ? 'awaiting approval' : o.jobState === 'approved' ? 'approved, awaiting handoff' : 'handed off'}` : o.effectiveDate > s.horizon ? 'not yet due' : 'no order yet: run the scheduler'
 return `<li${o.overdue ? ' class="overdue"' : ''}>${usDate(o.dueDate)}${o.deferredTo ? ` · deferred to ${usDate(o.deferredTo)}: ${e(o.deferReason)}` : ''} · ${state}${asset ? ` · ${e(asset.make)} ${e(asset.model)} (${e(asset.serial)})` : ''}${o.overdue ? ' · <strong>Overdue</strong>' : ''}</li>`
}

export function scheduleSection(t: Row, data: Row, manage: boolean) {
 const schedules: Row[] = data.schedules, live = (data.assets as Row[]).filter(a => a.state === 'in_service'), done = (data.inspections as Row[]).filter(i => i.state === 'completed')
 const overdue = schedules.flatMap(s => s.overdue.map((o: Row) => `<li>${e(s.title)} · due ${usDate(o.effectiveDate)} · ${o.jobId ? `order ${e(o.jobState)}, not yet handed off` : 'no order'}</li>`))
 const add = manage && data.vendors.length ? `<details><summary>Add a schedule</summary>${form('schedule.add', t.id, field('Work', 'title') + tradeSelect() + select('Vendor', 'vendorId', data.vendors, v => v.name) + (live.length ? select('Asset', 'assetId', live, a => `${a.kind} · ${a.serial}`, 'Not for one asset') : '') + (done.length ? select('From inspection finding', 'inspectionId', done, i => `Inspection ${usDate(i.inspection_date)}`, 'Not from an inspection') : '') + field('Repeat every (months)', 'intervalMonths', 'number', 'min="1" max="60" value="12"') + field('First due date', 'firstDue', 'date') + field(`Budget per occurrence (${t.currency})`, 'budget', 'number', 'min="0.01" step="0.01"') + field('Create orders this many days ahead', 'leadDays', 'number', 'min="0" max="90" value="30"') + '<button type="submit">Save schedule</button>')}</details>` : manage ? '<p class="muted">Add a vendor before scheduling recurring work.</p>' : ''
 const cards = schedules.map(s => `<article class="card"><h3>${e(s.title)}</h3><p>Every ${s.interval_months} ${s.interval_months === 1 ? 'month' : 'months'} from ${usDate(s.first_due)} · ${e(s.trade)} · ${e((data.vendors as Row[]).find(v => v.id === s.vendor_id)?.name ?? '')} · budget ${money(s.budget_cents, shown(t) === 'unconfirmed' ? shown(t) : s.currency)} · ${s.source === 'asset' ? 'asset interval' : s.source === 'inspection' ? 'from an inspection finding' : 'seasonal task'}</p><h4>Occurrences</h4><ul>${s.occurrences.map((o: Row) => occurrence(s, o, data)).join('') || '<li class="muted">None due yet.</li>'}</ul>${manage ? `<details><summary>Defer an occurrence</summary>${form('schedule.defer', t.id, hidden('scheduleId', s.id) + `<label>Occurrence<select name="dueDate">${s.occurrences.filter((o: Row) => !o.jobId).map((o: Row) => `<option value="${e(o.dueDate)}">${usDate(o.dueDate)}</option>`).join('')}</select></label>` + field('Defer to', 'deferTo', 'date') + field('Reason', 'reason') + '<button type="submit">Defer occurrence</button>')}</details>` : ''}</article>`).join('')
 const run = manage ? form('schedule.run', t.id, '<button type="submit">Run the scheduler</button>') : ''
 return `<section aria-labelledby="schedules-heading"><h2 id="schedules-heading">Recurring maintenance</h2><p>Each run creates one order, for approval, per occurrence due within its lead days. Running again creates nothing twice.</p>${run}${overdue.length ? `<div class="notice" role="status"><strong>Overdue occurrences</strong><ul>${overdue.join('')}</ul></div>` : ''}${add}${cards || '<p class="muted">No recurring maintenance scheduled.</p>'}</section>`
}
