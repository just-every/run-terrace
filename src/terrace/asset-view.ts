// WORK-002: the asset register on Inspections & maintenance: warranty, manual, replacement plan, service
// history with warranty or owner attribution, and replacement that keeps the old asset.
import { escape as e, money, type Row } from './core'
import { usDate } from './format'

const hidden = (name: string, value: unknown) => `<input type="hidden" name="${e(name)}" value="${e(value)}">`
const field = (label: string, name: string, type = 'text', required = true, extra = '') => `<label>${e(label)}<input name="${e(name)}" type="${type}"${required ? ' required' : ''} ${extra}></label>`
const fields = (currency: string) => `${field('Equipment (for example HVAC furnace)', 'kind')}${field('Location', 'location')}${field('Make', 'make')}${field('Model', 'model')}${field('Serial number', 'serial')}${field('Installed date', 'installedDate', 'date')}${field('Warranty provider', 'warrantyProvider', 'text', false)}${field('Warranty ends', 'warrantyEnds', 'date', false)}${field('Manual (link or where it is kept)', 'manual', 'text', false)}${field('Planned replacement date', 'replaceBy', 'date', false)}${field(`Planned replacement cost (${currency})`, 'replacementCost', 'number', false, 'min="0.01" step="0.01"')}`
const form = (command: string, tenancyId: string, body: string) => `<form method="post" action="/app/command">${hidden('command', command)}${hidden('tenancyId', tenancyId)}${hidden('tab', 'work')}${body}</form>`

function assetCard(t: Row, a: Row, all: Row[], today: string, manage: boolean) {
 const k = a.currency as string, m = (n: number) => money(n, k)
 const warranty = a.warranty_ends ? `${e(a.warranty_provider)} · ${a.warranty_ends >= today ? 'active' : 'expired'} until ${usDate(a.warranty_ends)}` : 'None recorded'
 const link = (id: string | null, label: string) => { const x = all.find(y => y.id === id); return x ? `<dt>${label}</dt><dd>${e(x.kind)} · ${e(x.make)} ${e(x.model)} · serial ${e(x.serial)}</dd>` : '' }
 const history = a.history.length ? `<ul class="asset-history">${a.history.map((j: Row) => `<li>${usDate(j.due_date)} · ${e(j.title)} · ${e(j.trade_name)} · ${m(j.estimate_cents)} ${j.state === 'pending' ? '(prepared, not yet approved)' : 'approved estimate'} · ${j.attribution === 'warranty' ? `under warranty: claim with ${e(j.payer)}` : `owner cost: ${e(j.payer)}`}</li>`).join('')}</ul>` : '<p class="muted">No repairs linked to this asset.</p>'
 const replace = manage && a.state === 'in_service' ? `<details><summary>Record a replacement</summary><p class="muted">The replacement becomes a new asset. This asset and its service history are kept.</p>${form('asset.replace', t.id, hidden('assetId', a.id) + fields(k) + '<button type="submit">Record replacement</button>')}</details>` : ''
 return `<article class="card"><h3>${e(a.kind)} <span class="pill${a.state === 'replaced' ? '' : ' paid'}">${a.state === 'replaced' ? `Replaced ${usDate(a.replaced_date)}` : 'In service'}</span></h3><dl><dt>Location</dt><dd>${e(a.location)}</dd><dt>Make and model</dt><dd>${e(a.make)} ${e(a.model)}</dd><dt>Serial</dt><dd>${e(a.serial)}</dd><dt>Installed</dt><dd>${usDate(a.installed_date)}</dd><dt>Warranty</dt><dd>${warranty}</dd><dt>Manual</dt><dd>${a.manual ? e(a.manual) : 'None recorded'}</dd><dt>Replacement plan</dt><dd>${a.replace_by ? `${usDate(a.replace_by)}${a.replacement_cents ? ` · ${m(a.replacement_cents)}` : ''}` : 'None recorded'}</dd>${link(a.replaces, 'Replaces')}${link(a.replaced_by, 'Replaced by')}<dt>Approved repair costs</dt><dd>Owner ${m(a.ownerCostCents)} · under warranty ${m(a.warrantyCostCents)}</dd></dl><h4>Service history</h4>${history}${replace}</article>`
}

export function assetSection(t: Row, assets: Row[], today: string, manage: boolean) {
 const add = manage ? `<details><summary>Add an asset</summary>${form('asset.add', t.id, fields(t.currency) + '<button type="submit">Add asset</button>')}</details>` : ''
 return `<section aria-labelledby="assets-heading"><h2 id="assets-heading">Assets &amp; warranties</h2><p>Installed equipment for this tenancy’s unit. A repair linked to an asset counts against its warranty when due on or before the warranty end; Terrace flags coverage but does not file a claim.</p>${add}${assets.length ? assets.map(a => assetCard(t, a, assets, today, manage)).join('') : '<p class="muted">No assets recorded.</p>'}</section>`
}

/** The asset select on the maintenance form: in-service assets only. */
export const assetSelect = (assets: Row[]) => { const live = assets.filter(a => a.state === 'in_service'); return live.length ? `<label>Asset (optional)<select name="assetId"><option value="">Not linked to an asset</option>${live.map(a => `<option value="${e(a.id)}">${e(a.kind)} · ${e(a.location)} · ${e(a.serial)}</option>`).join('')}</select></label>` : '' }
