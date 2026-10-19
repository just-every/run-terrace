// The Tenancies home: the month card (recorded rent and the month's dated stops), the decisions and work
// waiting on a person, and the rent roll grouped by property.
import { escape as e, money, type Row } from './core'
import { daysBetween, monthName, place, shortDate, usDate } from './format'
import { icon } from './icons'
import type { monthData } from './month'
import { avatar, button, form, hidden, pill } from './view'

type Month = Awaited<ReturnType<typeof monthData>>
type RollRow = Month['rows'][number]

function monthCard(m: Month) {
 // One summary per currency (PORT-001): USD and legacy AUD are never summed.
 const summary = m.totals.length
  ? m.totals.map(t => { const pct = t.due ? Math.floor(t.received / t.due * 100) : 0; return `<p class="month-total"><strong>${money(t.received, t.currency)}</strong> recorded of ${money(t.due, t.currency)} due</p><div class="progress-row"><progress max="100" value="${pct}">${pct}%</progress><span class="progress-pct">${pct}%</span></div><p class="month-note">${t.paid} of ${t.charged} ${t.charged === 1 ? 'tenancy' : 'tenancies'} paid in full · ${money(t.outstanding, t.currency)} outstanding</p>` }).join('')
  : `<p class="month-note">No rent charges recorded for ${monthName(m.today)} yet.</p>`
 const track = `<ol class="track" aria-label="${e(monthName(m.today))} so far">${m.track.map(s => `<li class="stop ${s.tone}${s.today ? ' today' : ''}"><span class="stop-date">${s.today ? `<b>Today</b><span>${shortDate(s.date)}</span>` : shortDate(s.date)}</span><span class="stop-dot" aria-hidden="true"></span><span class="stop-label">${e(s.label)}</span></li>`).join('')}</ol>`
 return `<section class="month-card"><div class="month-rent"><h2>${e(monthName(m.today))} rent</h2>${summary}</div><div class="month-track"><h2>${e(monthName(m.today))}</h2>${track}</div></section>`
}

function waitingCard(w: Row, manage: boolean) {
 const who = w.preparedBy ? `<p class="muted">prepared by ${e(w.preparedBy)}</p>` : ''
 const detail = `/app?tab=tenancy&amp;tenancy=${e(w.tenancyId)}`, work = `/app?tab=work&amp;tenancy=${e(w.tenancyId)}`
 let kind = '', title = '', lines = '', href = detail, actions = ''
 if (w.kind === 'renewal') {
  const change = w.rentCents ? (w.payload.rentCents - w.rentCents) / w.rentCents * 100 : 0
  kind = 'renewal'; title = 'Renewal'; lines = `<p>${e(w.unit)} · to ${usDate(w.payload.endDate)} at ${money(w.payload.rentCents, w.currency)}${change ? ` (${change > 0 ? '+' : ''}${change.toFixed(1)}%)` : ''}</p>${who}`
 } else if (w.kind === 'arrears') {
  kind = 'arrears'; title = 'Arrears follow-up'; lines = `<p>${e(w.unit)} · follow-up ${shortDate(w.payload.followUpDate)}</p>${who}`
 } else if (w.kind === 'maintenance') {
  const j = w.job; kind = 'maintenance'; title = 'Maintenance'; href = work
  lines = `<p>${e(w.unit)} · ${e(j.title)}</p><p class="muted">${e(j.trade_name)} · est. ${money(j.estimate_cents, j.currency)}</p><p class="state amber">${j.state === 'pending' ? 'Prepared · awaiting approval' : 'Approved · awaiting external handoff'}</p>`
 } else {
  const i = w.inspection; kind = 'inspection'; title = 'Inspection draft'; href = work
  lines = `<p>${e(w.unit)} · ${shortDate(i.inspection_date)}</p><p class="muted">${i.photos} ${i.photos === 1 ? 'photo' : 'photos'}</p>`
 }
 // A decision made here returns to this page (no tenancy in the redirect).
 if (manage && (w.kind === 'renewal' || w.kind === 'arrears')) actions = `<div class="decision-actions">${form('proposal.approve', hidden('proposalId', w.id) + button(w.kind === 'renewal' ? 'Approve renewal' : 'Approve follow-up'))}${form('proposal.reject', hidden('proposalId', w.id) + '<button class="secondary" type="submit">Reject proposal</button>')}</div>`
 return `<article class="waiting-card"><div class="waiting-head"><span class="icon-disc ${kind}">${icon(kind)}</span><h3><a href="${href}">${title}<span class="sr-only"> · ${e(w.unit)}</span></a></h3>${icon('chevron')}</div>${lines}${actions}</article>`
}

function waitingStrip(m: Month, manage: boolean) {
 if (!m.waiting.length) return ''
 const cards = m.waiting.map(w => waitingCard(w, manage)), more = cards.slice(4)
 return `<section class="waiting" aria-labelledby="waiting-heading"><h2 class="eyebrow" id="waiting-heading">Waiting on a person</h2><div class="waiting-grid">${cards.slice(0, 4).join('')}</div>${more.length ? `<details class="waiting-more"><summary>Show ${more.length} more</summary><div class="waiting-grid">${more.join('')}</div></details>` : ''}</section>`
}

function standing(r: RollRow) {
 if (r.standing === 'paid') return pill('Paid', 'paid')
 if (r.standing === 'partial') return pill('Partial', 'pending')
 if (r.standing === 'overdue') return pill(`Overdue · ${daysBetween(r.oldest, r.today)} days`, 'overdue')
 if (r.standing === 'due') return pill(`Due ${shortDate(r.oldest)}`, 'due')
 return '<span class="muted">No charge this month</span>'
}

function rollRow(r: RollRow) {
 const t = r.tenancy, ending = daysBetween(r.today, t.end_date) <= 60
 const recorded = r.standing === 'none' ? '<span class="muted">—</span>' : r.standing === 'paid' ? `${money(r.received, r.currency)}<small>${r.receivedDate ? `on ${shortDate(r.receivedDate)}` : 'reduced'}</small>` : `${money(r.received, r.currency)} <span class="muted">of ${money(r.due, r.currency)}</span>`
 const pending = r.pending.length ? pill(r.pending.some(p => p.kind === 'renewal') ? 'Renewal pending' : 'Arrears pending', 'pending') : ''
 return `<a class="roll-row tenancy-row" href="/app?tab=tenancy&amp;tenancy=${e(t.id)}">${avatar(t.tenant_name)}<span class="roll-who"><strong>${r.unit ? `${e(r.unit)} · ` : ''}${e(t.tenant_name)}</strong></span><span class="roll-rent" data-label="Rent">${money(t.rent_cents, t.currency)} <span class="muted">${e(t.cadence)}</span></span><span class="roll-recorded" data-label="Recorded">${recorded}</span><span class="roll-status">${standing(r)}</span><span class="roll-lease${ending ? ' soon' : ''}" data-label="Lease end">${usDate(t.end_date)}${pending}</span>${icon('chevron')}</a>`
}

function rentRoll(m: Month) {
 const groups = new Map<string, RollRow[]>()
 for (const r of m.rows) groups.set(r.property, [...(groups.get(r.property) ?? []), r])
 // Largest property first; units in order within it.
 const sorted = [...groups].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0])).map(([k, rows]) => [k, rows.sort((a, b) => a.unit.localeCompare(b.unit, 'en', { numeric: true }))] as const)
 const body = sorted.map(([property, rows]) => {
  const owners = [...new Set(rows.map(r => r.tenancy.owner_name))].join(', ')
  return `<div class="roll-group" role="group" aria-label="${e(property)}"><h3>${icon('building')}<span>${e(property)}</span><span class="owner">Owner: ${e(owners)}</span></h3>${rows.map(r => rollRow(r)).join('')}</div>`
 }).join('')
 return `<section class="rent-roll" aria-labelledby="roll-heading"><h2 id="roll-heading">Rent roll</h2><div class="roll-head" aria-hidden="true"><span>Tenancy</span><span>Rent</span><span>Recorded · ${e(monthName(m.today))}</span><span>Status</span><span>Lease end</span></div>${body}</section>`
}

export function homeView(m: Month, manage: boolean, create: string) {
 return `${monthCard(m)}${waitingStrip(m, manage)}${rentRoll(m)}${create}`
}

export const addTenancyAction = `<a class="button add-action" href="/app?tab=tenancy&amp;add=1#add-tenancy">${icon('plus')}Add a tenancy</a>`
