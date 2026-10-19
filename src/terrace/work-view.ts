import { escape as e, money, type Row } from './core'
import { usDate } from './format'
import { assetSection, assetSelect } from './asset-view'
import { jobQualification, vendorChoice, vendorSection } from './vendor-view'

// People are shown by name (data.names from operatorNames); an id with no operator shows as itself.
type Who = (id: string) => string
const hidden = (name: string, value: unknown) => `<input type="hidden" name="${e(name)}" value="${e(value)}">`
function form(command: string, tenancyId: string, contents: string, fields: Row = {}, upload = false) {
  return `<form method="post" action="/app/command"${upload ? ' enctype="multipart/form-data"' : ''}>${hidden('command', command)}${hidden('tenancyId', tenancyId)}${hidden('tab', 'work')}${Object.entries(fields).map(([key,value]) => hidden(key,value)).join('')}${contents}</form>`
}
const input = (label: string, name: string, type = 'text', extra = '') => `<label>${e(label)}<input name="${e(name)}" type="${e(type)}" ${extra} required></label>`

function inspectionCard(t: Row, row: Row, photos: Row[], canManage: boolean, who: Who) {
  const evidence = photos.filter(photo => photo.inspection_id === row.id)
  const notes = row.notes ? `<p class="preserve-lines">${e(row.notes)}</p>` : '<p>No notes recorded yet.</p>'
  const photoList = evidence.length ? `<ul class="photo-list">${evidence.map(photo => `<li><img class="photo" alt="Inspection photo" src="/api/inspections/photos/${encodeURIComponent(photo.id)}"><br><a href="/api/inspections/photos/${encodeURIComponent(photo.id)}" target="_blank" rel="noopener">${e(photo.filename)}</a> · ${e(photo.size)} bytes<details><summary>Evidence details</summary><p>Uploaded ${usDate(photo.uploaded_at)} by ${e(who(photo.uploaded_by))}</p><p>SHA-256: <code>${e(photo.sha256)}</code></p></details></li>`).join('')}</ul>` : '<p>Add at least one photo before completing this inspection.</p>'
  let actions = ''
  if (row.state === 'draft' && canManage) {
    actions = form('inspection.photo', t.id, `${input('Photo (JPEG or PNG, up to 1.5 MB)', 'file', 'file', 'accept="image/jpeg,image/png"')}<button type="submit">Save photo evidence</button>`, { inspectionId: row.id, version: row.version }, true)
      + form('inspection.complete', t.id, `<label>Inspection notes<textarea name="notes" maxlength="4000" rows="4" required>${e(row.notes)}</textarea></label><p>${evidence.length ? 'The saved notes and photos become the completed inspection record.' : 'Save a photo above before completing the inspection.'}</p><button type="submit"${evidence.length ? '' : ' disabled'}>Complete inspection</button>`, { inspectionId: row.id, version: row.version })
  }
  return `<article class="card"><h3>${usDate(row.inspection_date)} <span class="pill ${row.state === 'draft' ? 'pending' : ''}">${row.state === 'completed' ? 'Completed' : 'Draft'}</span></h3>${notes}${row.completed_at ? `<p>Completed ${usDate(row.completed_at)} by ${e(who(row.completed_by))}</p>` : ''}${photoList}${actions}</article>`
}

function maintenanceCard(t: Row, row: Row, canManage: boolean, who: Who, data: Row) {
  const state = row.state === 'pending' ? 'Prepared · awaiting approval' : row.state === 'approved' ? 'Approved · awaiting external handoff' : 'Sent · external handoff recorded'
  const evidence = row.approved_at ? `<details><summary>Approval evidence</summary><dl><dt>Approved by</dt><dd>${e(who(row.approved_by))} (${e(row.approved_role)})</dd><dt>Approved at</dt><dd>${usDate(row.approved_at)}</dd><dt>Approved version</dt><dd>${e(row.approved_version)}</dd><dt>Snapshot SHA-256</dt><dd><code>${e(row.approval_sha256)}</code></dd></dl><pre>${e(row.approval_snapshot)}</pre></details>` : ''
  let actions = ''
  if (row.state === 'pending' && canManage) {
    actions = form('maintenance.approve', t.id, '<p>Approve these vendor details, scope and estimate. Approval saves a permanent snapshot for the handoff packet.</p><button type="submit">Approve maintenance</button>', { jobId: row.id, version: row.version })
  }
  if (row.state !== 'pending') {
    actions = `<p><a href="/api/maintenance/${encodeURIComponent(row.id)}/packet" download>Download approved email packet (.eml)</a></p>`
    if (row.state === 'approved' && canManage) actions += form('maintenance.sent', t.id, `<p>Open the packet in your email client and send it to the vendor. Record the handoff after you send it.</p>${input('Email or external handoff reference', 'reference', 'text', 'maxlength="500"')}<button type="submit">Record external handoff</button>`, { jobId: row.id, version: row.version })
  }
  return `<article class="card"><h3>${e(row.title)}</h3><p><span class="pill ${row.state === 'pending' ? 'pending' : ''}">${state}</span></p><dl><dt>Vendor</dt><dd>${e(row.trade_name)} · ${e(row.trade_email)}</dd><dt>Due</dt><dd>${usDate(row.due_date)}</dd><dt>Estimate</dt><dd>${e(money(row.estimate_cents, row.currency))}</dd><dt>Prepared</dt><dd>${usDate(row.prepared_at)} by ${e(who(row.prepared_by))}</dd></dl>${jobQualification(t, row, data, canManage, who)}${evidence}${row.sent_at ? `<p>External handoff recorded ${usDate(row.sent_at)} by ${e(who(row.sent_by))}.</p><p>Reference: ${e(row.sent_reference)}</p>` : ''}${actions}</article>`
}

/** HTML fragment inside the app's Base theme frame; every action preserves the selected tenancy and tab. data is workData plus names. */
export function workView(tenancy: Row, data: any): string {
  const canManage = ['owner','admin'].includes(data.role)
  const inspections: Row[] = data.inspections, photos: Row[] = data.photos, jobs: Row[] = data.jobs, who: Who = id => data.names[id] ?? id
  const createInspection = canManage ? `<details><summary>New inspection</summary>${form('inspection.create', tenancy.id, `${input('Inspection date', 'date', 'date')}<label>Initial notes<textarea name="notes" maxlength="4000" rows="3"></textarea></label><button type="submit">Create inspection draft</button>`)}</details>` : '<p>An owner or administrator records and completes inspections.</p>'
  const prepare = form('maintenance.prepare', tenancy.id, `${input('Work required', 'title', 'text', 'maxlength="200"')}${vendorChoice(data.vendors)}<details><summary>Unlisted vendor</summary><label>Vendor name<input name="tradeName" maxlength="200"></label><label>Vendor email<input name="tradeEmail" type="email" maxlength="254"></label></details>${input('Due date', 'dueDate', 'date')}${input(`Estimated cost (${tenancy.currency})`, 'estimate', 'number', 'min="0.01" max="1000000" step="0.01"')}${assetSelect(data.assets)}<button type="submit">Prepare for approval</button>`)
  return `<div class="grid work-columns"><section aria-labelledby="inspections-heading"><h2 id="inspections-heading">Inspections</h2><p>Save dated notes and photo evidence, then complete the inspection record.</p>${createInspection}${inspections.length ? inspections.map(row => inspectionCard(tenancy, row, photos, canManage, who)).join('') : '<p>No inspections recorded for this tenancy.</p>'}</section><section aria-labelledby="maintenance-heading"><h2 id="maintenance-heading">Maintenance</h2><p>Prepare the work, obtain approval, then send the approved packet through your email client. Terrace records the human handoff; it does not deliver email.</p><details><summary>Prepare maintenance</summary>${prepare}</details>${jobs.length ? jobs.map(row => maintenanceCard(tenancy, row, canManage, who, data)).join('') : '<p>No maintenance prepared for this tenancy.</p>'}</section></div>${vendorSection(tenancy, data.vendors, canManage)}${assetSection(tenancy, data.assets, data.today, canManage)}`
}
