// WORK-013 on the Properties page: a unit's make-ready board with planned dates, blockers, checks and publishing.
import { escape as e, money, type Row } from './core'
import { usDate } from './format'

const hidden = (name: string, value: unknown) => `<input type="hidden" name="${e(name)}" value="${e(value)}">`
const form = (command: string, body: string) => `<form method="post" action="/app/command">${hidden('command', command)}${hidden('tab', 'properties')}${body}</form>`

function taskRow(t: Row, manage: boolean, open: boolean) {
 const actions = !open ? '' : `${t.state === 'open' ? form('turnover.task.submit', hidden('taskId', t.id) + '<button class="secondary" type="submit">Submit done</button>') : ''}${manage && t.state === 'submitted' ? form('turnover.task.check', hidden('taskId', t.id) + `<button type="submit"${t.blockedBy.length ? ' disabled' : ''}>Check completion</button>`) : ''}${manage && t.state !== 'checked' ? `<details><summary>Edit task</summary>${form('turnover.task.update', hidden('taskId', t.id) + `<label>Assignee<input name="assignee" value="${e(t.assignee)}"></label><label>Duration (days)<input name="durationDays" type="number" min="1" max="60" value="${t.duration_days}"></label><label>Delay (days)<input name="delayDays" type="number" min="0" max="120" value="${t.delay_days}"></label><label>Quote (USD)<input name="quote" type="number" min="0.01" step="0.01" value="${t.quote_cents ? (t.quote_cents / 100).toFixed(2) : ''}"></label><button type="submit">Save task</button>`)}</details>` : ''}`
 return `<li>${e(t.title)} · ${e(t.assignee)} · ${usDate(t.start)} to ${usDate(t.end)}${t.delay_days ? ` (delayed ${t.delay_days} ${t.delay_days === 1 ? 'day' : 'days'})` : ''}${t.quote_cents ? ` · quote ${money(t.quote_cents, 'USD')}` : ''} · ${t.state}${t.blockedBy.length && t.state !== 'checked' ? ' · <strong>blocked by an unchecked earlier task</strong>' : ''}${actions}</li>`
}

export function turnoverSection(u: Row, boards: Row[], manage: boolean, lastMoveOut: string | null) {
 const mine = boards.filter(b => b.unit_id === u.id), open = mine.find(b => b.state === 'open')
 const board = (b: Row) => `<div class="board" id="turnover-${e(b.id)}"><h5>Make-ready from move-out ${usDate(b.move_out)}</h5><p>${b.state === 'ready' ? `Ready: available from ${usDate(b.available_on)}` : `Planned ready ${usDate(b.readyDate)} · ${b.vacancyDays} vacant ${b.vacancyDays === 1 ? 'day' : 'days'} after move-out`}</p><ul>${b.tasks.map((t: Row) => taskRow(t, manage, b.state === 'open')).join('')}</ul>${manage && b.state === 'open' ? form('turnover.publish', hidden('turnoverId', b.id) + `<button type="submit"${b.tasks.every((t: Row) => t.state === 'checked') ? '' : ' disabled'}>Publish available date</button>`) : ''}</div>`
 const start = manage && !open && lastMoveOut ? form('turnover.open', hidden('unitId', u.id) + `<label>Move-out date<input name="moveOut" type="date" required value="${e(lastMoveOut)}"></label><button class="secondary" type="submit">Open make-ready board</button>`) : ''
 return mine.map(board).join('') + start
}
