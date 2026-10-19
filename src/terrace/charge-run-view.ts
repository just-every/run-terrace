// PAY-001 on Rent & arrears: the selected tenancy's lease charge terms, and the portfolio's monthly charge run
// (preview, missing terms and the reviewed post).
import { escape as e, money, type Row } from './core'
import { usDate } from './format'
import { KINDS } from './charge-run'

const hidden = (name: string, value: unknown) => `<input type="hidden" name="${e(name)}" value="${e(value)}">`
const form = (command: string, tenancyId: string, body: string) => `<form method="post" action="/app/command">${hidden('command', command)}${hidden('tenancyId', tenancyId)}${hidden('tab', 'ledger')}${body}</form>`
const field = (label: string, name: string, type = 'text', required = true, extra = '') => `<label>${e(label)}<input name="${e(name)}" type="${type}"${required ? ' required' : ''} ${extra}></label>`

export function termSection(t: Row, terms: Row[], manage: boolean) {
 const k = t.currency as string
 const rows = terms.map(x => `<li>${e(x.kind)} · ${e(x.description)} · ${money(x.amount_cents, x.currency)} per ${t.cadence === 'monthly' ? 'month' : t.cadence === 'weekly' ? 'week' : 'two weeks'} · ${usDate(x.starts)} to ${x.ends ? usDate(x.ends) : 'lease end'}${manage && (!x.ends || x.ends >= x.starts) ? `<details><summary>Amend from a date</summary>${form('term.amend', t.id, hidden('termId', x.id) + field('Effective date', 'effective', 'date') + field(`New amount (${k})`, 'amount', 'number', true, 'min="0.01" step="0.01"') + '<button type="submit">Amend term</button>')}</details>` : ''}</li>`).join('')
 const add = manage ? `<details><summary>Add a lease charge term</summary>${form('term.add', t.id, `<label>Kind<select name="kind">${KINDS.map(x => `<option value="${x}">${x}</option>`).join('')}</select></label>` + field('Description', 'description') + field(`Amount per period (${k})`, 'amount', 'number', true, `min="0.01" step="0.01" value="${(t.rent_cents / 100).toFixed(2)}"`) + field('Starts', 'starts', 'date', true, `value="${e(t.start_date)}"`) + field('Ends (empty: lease end)', 'ends', 'date', false) + '<button type="submit">Add term</button>')}</details>` : ''
 return `<section><h2>Recurring charges</h2><p class="muted">Terms post through the monthly charge run. A partly covered period is prorated by days, rounded half up to the cent; a concession reduces that period’s rent. Approving a renewal does not change these terms: amend the rent term.</p>${rows ? `<ul>${rows}</ul>` : '<p class="muted">No lease charge terms.</p>'}${add}</section>`
}

export function runSection(t: Row, run: Row | null, manage: boolean, month: string) {
 if (!manage) return ''
 const pick = `<form method="get" action="/app">${hidden('tab', 'ledger')}${hidden('tenancy', t.id)}${field('Charge run month', 'run', 'month', true, `value="${e(month)}"`)}<button class="secondary" type="submit">Preview charge run</button></form>`
 if (!run) return `<section><h2>Charge run</h2>${pick}</section>`
 const lines = run.lines.map((l: Row) => `<tr><td>${e(l.address)}</td><td>${e(l.kind)} · ${e(l.description)}</td><td>${usDate(l.periodStart)} to ${usDate(l.periodEnd)}${l.coveredDays < l.periodDays ? ` · ${l.coveredDays} of ${l.periodDays} days` : ''}</td><td>${l.kind === 'concession' ? '−' : ''}${money(l.amountCents, l.currency)}</td><td>${l.posted ? 'Posted' : 'New'}</td></tr>`).join('')
 const missing = run.missing.length ? `<h3>Missing terms</h3><ul>${run.missing.map((x: Row) => `<li>${e(x.address)} · ${usDate(x.period[0])} to ${usDate(x.period[1])}: ${e(x.reason)}</li>`).join('')}</ul>` : ''
 const post = run.newLines ? form('charges.post', t.id, hidden('month', run.month) + hidden('fingerprint', run.fingerprint) + `<button type="submit">Post ${run.newLines} new ${run.newLines === 1 ? 'line' : 'lines'}</button>`) : '<p>Every line of this run is posted.</p>'
 return `<section><h2>Charge run · ${e(run.month)}</h2>${pick}<div class="scroll"><table><thead><tr><th>Tenancy</th><th>Term</th><th>Period</th><th>Amount</th><th>State</th></tr></thead><tbody>${lines || '<tr><td colspan="5">No lines.</td></tr>'}</tbody></table></div>${missing}${post}</section>`
}
