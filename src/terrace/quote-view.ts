// WORK-003 on a maintenance card: compared quotes, the owner's limit and budget, the owner's decision
// (recorded by staff for the owner) and the change form that reopens authorization.
import { escape as e, money, shown, type Row } from './core'
import { usDate } from './format'
import { OWNER_LABEL } from './quotes'
import { vendorChoice } from './vendor-view'

const hidden = (name: string, value: unknown) => `<input type="hidden" name="${e(name)}" value="${e(value)}">`
const form = (command: string, t: Row, row: Row, body: string) => `<form method="post" action="/app/command">${hidden('command', command)}${hidden('tenancyId', t.id)}${hidden('tab', 'work')}${hidden('jobId', row.id)}${hidden('version', row.version)}${body}</form>`
const field = (label: string, name: string, type = 'text', required = true, extra = '') => `<label>${e(label)}<input name="${e(name)}" type="${type}"${required ? ' required' : ''} ${extra}></label>`

export function limitSection(t: Row, data: Row, manage: boolean) {
 const l = data.limit, k = shown(t)
 const facts = l ? `<p>Owner’s per-job limit ${money(l.limit_cents, k)}${l.budget_cents ? ` · yearly maintenance budget ${money(l.budget_cents, k)}` : ''} <span class="muted">(${OWNER_LABEL})</span></p>` : '<p class="muted">No owner spending limit recorded: a manager’s approval stands for any amount.</p>'
 const set = manage ? `<details><summary>Record the owner’s limit and budget</summary><form method="post" action="/app/command">${hidden('command', 'work.limits')}${hidden('tenancyId', t.id)}${hidden('tab', 'work')}${field('Per-job limit', 'limit', 'number', true, 'min="0.01" step="0.01"')}${field('Yearly budget (optional)', 'budget', 'number', false, 'min="0.01" step="0.01"')}<button type="submit">Save limit</button></form></details>` : ''
 return `<section><h2>Owner spending limit</h2>${facts}${set}</section>`
}

export function quoteSection(t: Row, row: Row, data: Row, manage: boolean) {
 const prepare = ['owner', 'admin', 'member'].includes(data.role), open = row.state !== 'sent', k = shown(t)
 const quotes = (data.quotes as Row[]).filter(q => q.job_id === row.id), a = data.authorities[row.id]
 const lines = quotes.map((q, i) => `<tr><td>${e(q.vendor_name)}${i === 0 && quotes.length > 1 ? ' <span class="pill paid">lowest</span>' : ''}${row.quote_id === q.id ? ' <span class="pill">selected</span>' : ''}</td><td>${e(q.scope)}</td><td>${usDate(q.available_date)}</td><td>${money(q.amount_cents, k)}</td><td>${money(q.tax_cents, k)}</td><td>${money(q.amount_cents + q.tax_cents, k)}</td><td>${prepare && open && row.quote_id !== q.id ? form('quote.select', t, row, hidden('quoteId', q.id) + '<button class="secondary" type="submit">Select</button>') : ''}</td></tr>`).join('')
 const table = quotes.length ? `<div class="scroll"><table><thead><tr><th>Vendor</th><th>Scope</th><th>Available</th><th>Price</th><th>Tax</th><th>Total</th><th></th></tr></thead><tbody>${lines}</tbody></table></div>` : ''
 const add = prepare && open ? `<details><summary>Add a quote</summary>${form('quote.add', t, row, vendorChoice(data.vendors) + `<details><summary>Unlisted vendor</summary>${field('Vendor name', 'vendorName', 'text', false)}${field('Vendor email', 'vendorEmail', 'email', false)}</details>` + field('Quoted scope', 'scope') + field('Available from', 'availableDate', 'date') + field('Price before tax', 'amount', 'number', true, 'min="0.01" step="0.01"') + field('Tax', 'tax', 'number', false, 'min="0" step="0.01"') + '<button type="submit">Add quote</button>')}</details>` : ''
 const decision = (data.decisions as Row[]).filter(d => d.job_id === row.id && d.job_version === row.version).at(-1)
 const owner = a?.needsOwner && row.state === 'pending' ? `<p class="state amber">Needs the owner’s decision: ${e(a.reasons.join('; '))}.</p>${decision ? `<p>Owner ${e(decision.decision)} these terms · ${OWNER_LABEL} · ${e(decision.source)}: ${e(decision.reference)}</p>` : ''}${manage && !decision ? `<details open><summary>Record the owner’s decision</summary><p class="muted">Ask the owner outside Terrace; Terrace has not contacted them.</p>${form('maintenance.owner', t, row, `<label>Decision<select name="decision"><option value="approved">Approved</option><option value="declined">Declined</option></select></label><label>Source<select name="source"><option value="email">Email</option><option value="document">Document</option><option value="call">Call</option></select></label>` + field('Where it is recorded (email subject, document or call note)', 'reference') + '<button type="submit">Record owner decision</button>')}</details>` : ''}` : ''
 const earlier = (data.approvals as Row[]).filter(x => x.job_id === row.id && (row.state === 'pending' || x.job_version !== row.approved_version))
 const history = earlier.length ? `<p class="muted">Earlier approval of version ${earlier.map(x => e(x.job_version)).join(', ')} no longer applies: the terms changed.</p>` : ''
 const revise = prepare && open ? `<details><summary>Change scope or price</summary><p class="muted">Changing scope, vendor or price reopens approval; handoff waits for the new terms to be approved.</p>${form('maintenance.revise', t, row, field('Scope', 'scope', 'text', false) + field('Estimate', 'estimate', 'number', false, 'min="0.01" step="0.01"') + '<button type="submit">Save change</button>')}</details>` : ''
 return `${row.scope ? `<p>Scope: ${e(row.scope)}</p>` : ''}${table}${owner}${history}${add}${revise}`
}
