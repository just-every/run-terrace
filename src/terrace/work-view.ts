import {stockSection} from './work-stock-view'
import {fieldScopeForm} from './field-evidence-view'
import { dispatchSection } from './dispatch-view'
import { escape as e, money, shown, type Row } from './core'
import { usDate } from './format'
import { assetSection, assetSelect } from './asset-view'
import { jobQualification, vendorChoice, vendorSection } from './vendor-view'
import { scheduleSection } from './schedule-view'
import { limitSection, quoteSection } from './quote-view'
import { completionSection } from './completion-view'
import { appointmentSection, appointmentCalendarSection } from './appointments-view'

// People are shown by name (data.names from operatorNames); an id with no operator shows as itself.
type Who = (id: string) => string
const hidden = (name: string, value: unknown) => `<input type="hidden" name="${e(name)}" value="${e(value)}">`
function form(command: string, tenancyId: string, contents: string, fields: Row = {}, upload = false) {
  return `<form method="post" action="/app/command"${upload ? ' enctype="multipart/form-data"' : ''}>${hidden('command', command)}${hidden('tenancyId', tenancyId)}${hidden('tab', 'work')}${Object.entries(fields).map(([key,value]) => hidden(key,value)).join('')}${contents}</form>`
}
const input = (label: string, name: string, type = 'text', extra = '') => `<label>${e(label)}<input name="${e(name)}" type="${e(type)}" ${extra} required></label>`

function inspectionCard(t: Row, row: Row, photos: Row[], canManage: boolean, who: Who, originals:Row[]=[]) {
  const evidence = photos.filter(photo => photo.inspection_id === row.id), media=originals.filter(m=>m.inspection_id===row.id), hasOriginal=evidence.length||media.length
  const notes = row.notes ? `<p class="preserve-lines">${e(row.notes)}</p>` : '<p>No notes recorded yet.</p>'
  const photoList = evidence.length ? `<ul class="photo-list">${evidence.map(photo => `<li><img class="photo" alt="Inspection photo" src="/api/inspections/photos/${encodeURIComponent(photo.id)}"><br><a href="/api/inspections/photos/${encodeURIComponent(photo.id)}" target="_blank" rel="noopener">${e(photo.filename)}</a> · ${e(photo.size)} bytes<details><summary>Evidence details</summary><p>Uploaded ${usDate(photo.uploaded_at)} by ${e(who(photo.uploaded_by))}</p><p>SHA-256: <code>${e(photo.sha256)}</code></p></details></li>`).join('')}</ul>` : media.length?'<p>Original inspection photos/video are attached below.</p>':'<p>Add at least one photo before completing this inspection.</p>'
  let actions = ''
  if(row.checklist&&row.state==='draft')actions=`<p><a href="/app?tab=field&amp;tenancy=${e(t.id)}">Open the mobile condition inspection to review and complete its current checklist.</a></p>`
  if (row.state === 'draft' && canManage && !row.checklist) {
    actions = form('inspection.photo', t.id, `${input('Photo (JPEG or PNG, up to 1.5 MB)', 'file', 'file', 'accept="image/jpeg,image/png"')}<button type="submit">Save photo evidence</button>`, { inspectionId: row.id, version: row.version }, true)
      + form('inspection.complete', t.id, `<label>Inspection notes<textarea name="notes" maxlength="4000" rows="4" required>${e(row.notes)}</textarea></label><p>${hasOriginal ? 'The saved notes and original media become the completed inspection record.' : 'Save a photo above before completing the inspection.'}</p><button type="submit"${hasOriginal ? '' : ' disabled'}>Complete inspection</button>`, { inspectionId: row.id, version: row.version })
  }
  return `<article class="card"><h3>${usDate(row.inspection_date)} <span class="pill ${row.state === 'draft' ? 'pending' : ''}">${row.state === 'completed' ? 'Completed' : 'Draft'}</span></h3>${notes}${row.completed_at ? `<p>Completed ${usDate(row.completed_at)} by ${e(who(row.completed_by))}</p>` : ''}${photoList}${media.length?`<ul>${media.map(m=>`<li><a href="/api/record-media/file?id=${e(m.id)}">${e(m.name)}</a> · version ${m.version}<details><summary>Original provenance</summary><p>Captured ${e(m.captured_at)} · ${e(m.source)}</p><p>SHA-256 <code>${e(m.sha256)}</code></p></details></li>`).join('')}</ul>`:''}${actions}</article>`
}

function maintenanceCard(t: Row, row: Row, canManage: boolean, who: Who, data: Row) {
  const state = row.state === 'pending' ? 'Prepared · awaiting approval' : row.state === 'approved' ? 'Approved · awaiting dispatch' : 'Handed off · see dispatch or external reference'
  const evidence = row.approved_at ? `<details><summary>Approval evidence</summary><dl><dt>Approved by</dt><dd>${e(who(row.approved_by))} (${e(row.approved_role)})</dd><dt>Approved at</dt><dd>${usDate(row.approved_at)}</dd><dt>Approved version</dt><dd>${e(row.approved_version)}</dd><dt>Snapshot SHA-256</dt><dd><code>${e(row.approval_sha256)}</code></dd></dl><pre>${e(row.approval_snapshot)}</pre></details>` : ''
  let actions = ''
  if (row.state === 'pending' && canManage) {
    actions = form('maintenance.approve', t.id, '<p>Approve these vendor details, scope and estimate. Approval saves a permanent snapshot for the handoff packet.</p><button type="submit">Approve maintenance</button>', { jobId: row.id, version: row.version })
  }
  if (row.state !== 'pending') {
    actions = `<p><a href="/api/maintenance/${encodeURIComponent(row.id)}/packet" download>Download approved email packet (.eml)</a></p>`
    if (row.state === 'approved' && canManage) actions += form('maintenance.sent', t.id, `<p>Open the packet in your email client and send it to the vendor. Record the handoff after you send it.</p>${input('Email or external handoff reference', 'reference', 'text', 'maxlength="500"')}<button type="submit">Record external handoff</button>`, { jobId: row.id, version: row.version })
  }
  return `<article class="card"><h3>${e(row.title)}</h3><p><span class="pill ${row.state === 'pending' ? 'pending' : ''}">${state}</span></p><dl><dt>Vendor</dt><dd>${e(row.trade_name)} · ${e(row.trade_email)} · ${e(row.cost_class)}</dd><dt>Due</dt><dd>${usDate(row.due_date)}</dd><dt>Estimate</dt><dd>${e(money(row.estimate_cents, shown(t) === 'unconfirmed' ? shown(t) : row.currency))}</dd><dt>Prepared</dt><dd>${usDate(row.prepared_at)} by ${e(who(row.prepared_by))}</dd></dl>${jobQualification(t, row, data, canManage, who)}${quoteSection(t, row, data, canManage)}${completionSection(t, row, data, canManage, who)}${fieldScopeForm(t,row,canManage)}${appointmentSection(t, row, data, action => !!data.may?.[action], who)}${dispatchSection(t, row, data, who)}${evidence}${row.sent_at ? `<p>Handoff recorded ${usDate(row.sent_at)} by ${e(who(row.sent_by))}.</p><p>Reference: ${e(row.sent_reference)}</p>` : ''}${actions}</article>`
}

/** HTML fragment inside the app's Base theme frame; every action preserves the selected tenancy and tab. data is workData plus names. */
export function workView(tenancy: Row, data: any): string {
  // ROLE-001: each form shows only to roles whose capability allows it; ROLE-003 approval forms only to approvers.
  const may = (action: string) => !!data.may?.[action], canManage = may('maintenance.approve'), canInspect = may('inspection.create')
  const inspections: Row[] = data.inspections, photos: Row[] = data.photos, jobs: Row[] = data.jobs, who: Who = id => data.names[id] ?? id
  const createInspection = canInspect ? `<details><summary>New inspection</summary>${form('inspection.create', tenancy.id, `${input('Inspection date', 'date', 'date')}<label>Initial notes<textarea name="notes" maxlength="4000" rows="3"></textarea></label><button type="submit">Create inspection draft</button>`)}</details>` : '<p>An owner or administrator records and completes inspections.</p>'
  const prepare = form('maintenance.prepare', tenancy.id, `${input('Work required', 'title', 'text', 'maxlength="200"')}<label>Task checklist (one task per line)<textarea name="checklist" maxlength="4000" rows="3"></textarea></label>${vendorChoice(data.vendors)}<details><summary>Unlisted vendor</summary><label>Vendor name<input name="tradeName" maxlength="200"></label><label>Vendor email<input name="tradeEmail" type="email" maxlength="254"></label></details>${input('Due date', 'dueDate', 'date')}${input(`Estimated cost (${tenancy.currency})`, 'estimate', 'number', 'min="0.01" max="1000000" step="0.01"')}${assetSelect(data.assets)}<label>Cost category<select name="costClass"><option value="operating">Operating</option><option value="capital">Capital</option></select></label><button type="submit">Prepare for approval</button>`)
  return `<div class="grid work-columns"><section aria-labelledby="inspections-heading"><h2 id="inspections-heading">Inspections</h2><p><a href="/app?tab=media&amp;tenancy=${e(tenancy.id)}">Record attachments · photos, video &amp; documents</a> · <a href="/app?tab=field&amp;tenancy=${e(tenancy.id)}">Mobile condition inspections</a> · <a href="/app?tab=technician&amp;tenancy=${e(tenancy.id)}">Technician field capture</a></p><p>Save dated notes and photo evidence, then complete the inspection record.</p>${createInspection}${inspections.length ? inspections.map(row => inspectionCard(tenancy, row, photos, canInspect, who,data.inspectionMedia??[])).join('') : '<p>No inspections recorded for this tenancy.</p>'}</section><section aria-labelledby="maintenance-heading"><h2 id="maintenance-heading">Maintenance</h2><p>Prepare the work and task checklist, obtain approval, then dispatch by installation email or record an external handoff. Track technician replies and missed commitments here.</p><details><summary>Prepare maintenance</summary>${prepare}</details>${jobs.length ? jobs.map(row => maintenanceCard(tenancy, row, canManage, who, data)).join('') : '<p>No maintenance prepared for this tenancy.</p>'}</section></div>${stockSection(tenancy,data.stock,jobs)}${scheduleSection(tenancy, data, may('schedule.add'))}${limitSection(tenancy, data, may('work.limits'))}${vendorSection(tenancy, data.vendors, may('vendor.add'))}${assetSection(tenancy, data.assets, data.today, may('asset.add'))}${appointmentCalendarSection(data, who)}`
}
