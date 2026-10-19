// WORK-004: the vendor directory on Inspections & maintenance, the vendor choice when preparing work, and each
// job's qualification hold, exception and reassignment.
import { escape as e, money, type Row } from './core'
import { usDate } from './format'
import { TRADES } from './vendors'

const hidden = (name: string, value: unknown) => `<input type="hidden" name="${e(name)}" value="${e(value)}">`
const form = (command: string, tenancyId: string, body: string) => `<form method="post" action="/app/command">${hidden('command', command)}${hidden('tenancyId', tenancyId)}${hidden('tab', 'work')}${body}</form>`
const field = (label: string, name: string, value: unknown = '', type = 'text', required = true, extra = '') => `<label>${e(label)}<input name="${e(name)}" type="${type}" value="${e(value)}"${required ? ' required' : ''} ${extra}></label>`
const choice = (label: string, name: string, options: string[], current = '') => `<label>${e(label)}<select name="${e(name)}">${options.map(o => `<option value="${e(o)}"${o === current ? ' selected' : ''}>${e(o)}</option>`).join('')}</select></label>`
export const tradeSelect = (current = '') => choice('Trade', 'trade', [...TRADES], current)

function vendorFields(v: Row = {}) {
 return field('Vendor name', 'name', v.name) + field('Email', 'email', v.email, 'email') + field('Phone', 'phone', v.phone, 'tel') + field('Specialties (comma-separated, for example plumbing, hvac)', 'specialties', (v.specialties ?? []).join(', ')) + field('Service areas (ZIP codes or cities, comma-separated)', 'serviceAreas', (v.service_areas ?? []).join(', ')) + choice('W-9', 'w9', ['received', 'missing'], v.w9) + field('Insurance expires', 'insuranceExpires', v.insurance_expires, 'date') + field('License number', 'licenseNumber', v.license_number ?? '', 'text', false) + field('License expires', 'licenseExpires', v.license_expires ?? '', 'date', false) + field('Availability', 'availability', v.availability ?? '', 'text', false) + field('Hourly rate (USD)', 'rate', v.rate_cents ? (v.rate_cents / 100).toFixed(2) : '', 'number', false, 'min="0.01" step="0.01"') + choice('Standing', 'standing', ['preferred', 'approved', 'blocked'], v.standing ?? 'approved')
}

export function vendorSection(t: Row, vendors: Row[], manage: boolean) {
 const rows = vendors.map(v => `<article class="card"><h3>${e(v.name)} <span class="pill${v.standing === 'blocked' ? ' overdue' : v.standing === 'preferred' ? ' paid' : ''}">${e(v.standing)}</span></h3><p>${e(v.specialties.join(', '))} · serves ${e(v.service_areas.join(', '))}</p><p class="muted">${e(v.email)} · ${e(v.phone)}${v.rate_cents ? ` · ${money(v.rate_cents, v.currency)}/h` : ''}${v.availability ? ` · ${e(v.availability)}` : ''}</p><p>W-9 ${e(v.w9)} · insurance to ${usDate(v.insurance_expires)}${v.license_number ? ` · license ${e(v.license_number)} to ${usDate(v.license_expires)}` : ''}</p><p>${v.issues.length ? `For this property today: ${e(v.issues.join('; '))}` : 'Qualifies for this property today (trade checked per job)'}</p>${manage ? `<details><summary>Update vendor</summary>${form('vendor.update', t.id, hidden('vendorId', v.id) + hidden('version', v.version) + vendorFields(v) + '<button type="submit">Save vendor</button>')}</details>` : ''}</article>`).join('')
 return `<section aria-labelledby="vendors-heading"><h2 id="vendors-heading">Vendors</h2><p>Work goes to a vendor with the job’s trade, this property in its service area, a received W-9 and insurance (and any recorded license) through the due date. Other work is held until a manager records a documented exception.</p>${manage ? `<details><summary>Add a vendor</summary>${form('vendor.add', t.id, vendorFields() + '<button type="submit">Add vendor</button>')}</details>` : ''}${rows || '<p class="muted">No vendors in the directory.</p>'}</section>`
}

/** Vendor choice on the prepare form; an unlisted vendor is still possible but is held. */
export const vendorChoice = (vendors: Row[]) => `${vendors.length ? `<label>Directory vendor<select name="vendorId"><option value="">Unlisted vendor (held for an exception)</option>${vendors.filter(v => v.standing !== 'blocked').map(v => `<option value="${e(v.id)}">${e(v.name)} · ${e(v.specialties.join(', '))}${v.issues.length ? ' · ' + e(v.issues.join('; ')) : ''}</option>`).join('')}</select></label>` : ''}${tradeSelect()}`

/** A job's qualification state, documented exceptions, assignment history and the manager's actions. */
export function jobQualification(t: Row, job: Row, data: Row, manage: boolean, who: (id: string) => string) {
 const h = data.holds[job.id], mine = (data.exceptions as Row[]).filter(x => x.job_id === job.id), moves = (data.assignments as Row[]).filter(x => x.job_id === job.id)
 const state = !h.issues.length ? '<p>Vendor qualified for this job.</p>' : h.held ? `<p class="state amber">Held: ${e(h.issues.join('; '))}</p>` : `<p>Proceeding under a documented exception: ${e(h.issues.join('; '))}</p>`
 const exceptions = mine.length ? `<h4>Qualification exceptions</h4><ul>${mine.map(x => `<li>${usDate(x.approved_at)} · ${e(who(x.approved_by))} (${e(x.approved_role)}): ${e(x.reason)} <span class="muted">for ${e(JSON.parse(x.issues).join('; '))}</span></li>`).join('')}</ul>` : ''
 const history = moves.length > 1 ? `<h4>Assignments</h4><ul>${moves.map(x => `<li>${usDate(x.assigned_at)} · ${e(x.trade_name)}${x.trade ? ` (${e(x.trade)})` : ''} · ${JSON.parse(x.issues).length ? e(JSON.parse(x.issues).join('; ')) : 'qualified'}</li>`).join('')}</ul>` : ''
 let actions = ''
 if (manage && h.held && job.state !== 'sent') actions += form('maintenance.exception', t.id, hidden('jobId', job.id) + '<label>Exception reason<textarea name="reason" required maxlength="1000"></textarea></label><button type="submit">Record documented exception</button>')
 if (manage && job.state === 'pending' && data.vendors.length) actions += `<details><summary>Reassign vendor</summary>${form('maintenance.reassign', t.id, hidden('jobId', job.id) + hidden('version', job.version) + `<label>Vendor<select name="vendorId">${(data.vendors as Row[]).map(v => `<option value="${e(v.id)}">${e(v.name)}</option>`).join('')}</select></label>` + tradeSelect(job.trade ?? '') + '<button type="submit">Reassign</button>')}</details>`
 return state + exceptions + history + actions
}
