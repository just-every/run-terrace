import { escape as e, money, type Row } from './core'
import { count, fileSize, localTime, usDate } from './format'
import { CSV_HEADERS, IMPORT_KIT, LEASE_TYPE_HEADER, OPTIONAL_HEADERS, RESIDENTIAL_ONLY } from './imports-source'
import { migrationView } from './migration-view'

const hidden = (name: string, value: unknown) => `<input type="hidden" name="${e(name)}" value="${e(value)}">`
function form(command: string, body: string, payload: Row = {}) {
  return `<form method="post" action="/app/command">${hidden('command',command)}${hidden('tab','import')}${Object.entries(payload).map(([key,value])=>hidden(key,value)).join('')}${body}</form>`
}

function leaseDate(value: unknown) {
  const entered = String(value ?? ''), parsed = new Date(`${entered}T00:00:00Z`)
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(entered) && Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0,10) === entered
  return valid ? e(usDate(entered)) : `${e(entered || 'Not entered')} <strong class="import-invalid">Invalid date</strong>`
}

function reviewMessage(value: unknown) {
  const message = String(value ?? '')
  return message.startsWith('created_at must be an ISO UTC timestamp')
    ? 'Created timestamp must be a valid UTC date and time with milliseconds. See the CSV format guide.'
    : message
}

function outcome(job: Row, value = job.outcome ?? job.state) {
  const labels: Record<string,string> = { queued:'Ready to continue', applying:'Import in progress', completed:'Imported', failed:'Import stopped', undoing:'Undo stopped', undone:'Undone', rolling_back:'Reversal in progress', rolled_back:'Reversed', compensated:'Compensated', stopped:'Stopped' }
  return labels[value] ?? 'Review needed'
}

function progress(job: Row) {
  return `${e(outcome(job))} · ${e(job.checkpoint)} of ${e(count(job.total,'source record'))} processed`
}

function reviewRow(row: Row, zone: string) {
  const value = row.value ?? row.source ?? {}, mapped = !!row.value
  const rent = mapped ? money(value.rent_cents,value.currency) : value.rent
  const currency = mapped ? value.currency : String(value.currency ?? '').trim() || 'USD'
  const review = row.rejection ? `<strong>Needs correction</strong><br>${e(reviewMessage(row.rejection))}` : 'Ready'
  return `<tr${row.rejection ? ' class="import-rejected"' : ''}><td data-label="Source ref"><strong>${e(row.ref)}</strong><br>Row ${e(row.sourceRow)}</td><td data-label="Property">${e(value.address)}</td><td data-label="Tenant">${e(value.tenant_name)}<br>${e(value.tenant_email)}</td><td data-label="Lease"><span>Start: ${leaseDate(value.start_date)}</span><br><span>End: ${leaseDate(value.end_date)}</span></td><td data-label="Rent">${e(rent)} ${e(currency)} ${e(value.cadence)}</td><td data-label="Time zone">${e(value.time_zone || zone)}</td><td data-label="Review">${review}</td></tr>`
}

function review(data: Row) {
  if (!data.fingerprint || !data.counts) return ''
  const counts = data.counts, rows: Row[] = data.rows ?? []
  const table = `<div class="table-scroll import-review-scroll"><table class="import-review-table"><caption>Tenancy source rows and review</caption><thead><tr><th>Source ref</th><th>Property</th><th>Tenant</th><th>Lease</th><th>Rent</th><th>Time zone</th><th>Review</th></tr></thead><tbody>${rows.map(row=>reviewRow(row,data.zone)).join('')}</tbody></table></div>`
  const diagnostics: Row[] = data.diagnostics ?? []
  const errors = diagnostics.some(d=>d.severity === 'error') || counts.rejected > 0
  const approval = errors ? '<p>Correct rejected records and preview again before importing.</p>' : form('import.apply', '<p>Approval creates the tenancy records shown above. The source and journal remain available after undo.</p><button type="submit">Approve and import these tenancies</button>', { namespace: data.namespace, csvBase64: data.csvBase64, fingerprint: data.fingerprint })
  const messages = diagnostics.length ? `<ul>${diagnostics.map(d=>`<li>${d.sourceId ? `${e(d.sourceId)}${d.location?.row ? ` (row ${e(d.location.row)})` : ''}: ` : ''}${e(reviewMessage(d.message))}</li>`).join('')}</ul>` : ''
  return `<article class="card"><h3>Review before importing</h3><p>${e(count(counts.input,'source record'))} · ${e(count(counts.effects,'tenancy','tenancies'))} · ${e(counts.rejected)} rejected</p><p>Source namespace: <strong>${e(data.namespace)}</strong></p><p>Reviewed fingerprint: <code>${e(data.fingerprint)}</code></p>${messages}${table}${approval}</article>`
}

function batchEntries(data: Row) {
  const batches: Row[] = data.journal ?? [], provenance: Row[] = data.provenance ?? []
  return batches.map(batch => {
    if (batch.action !== 'apply') return `<li>${e(batch.action === 'undo' ? 'Undo progress recorded' : 'Reversal progress recorded')}</li>`
    const sources = provenance.filter(row=>row.ordinal >= batch.position && row.ordinal < batch.end_position).map(row=>JSON.parse(row.record_json))
    return sources.length ? sources.map(source=>`<li>Imported ${e(source.sourceId)}${source.location?.row ? ` (row ${e(source.location.row)})` : ''}</li>`).join('') : `<li>Imported ${e(count(batch.end_position - batch.position,'source record'))}</li>`
  }).join('')
}

function originalSource(original: Row) {
  const available = original.original?.status === 'retained'
  const reasons: Record<string,string> = { 'not-supplied':'Original file was not supplied.', 'credentials-removed':'Original file withheld because credentials were removed.', 'unavailable-after-erasure':'Original file withdrawn after erasure.' }
  return `<li>${e(original.name)} · ${e(fileSize(original.size))}<br>SHA-256 fingerprint: <code>${e(original.sha256)}</code>${available ? `<br><a download="terrace-tenancies.csv" href="data:text/csv;base64,${e(original.original.base64)}">Download exact original</a>` : `<p>${e(reasons[original.original?.reason] ?? 'Original file unavailable.')}</p>`}</li>`
}

function journal(data: Row) {
  if (!data.job) return ''
  const job = data.job, originals: Row[] = data.originals ?? [], batches: Row[] = data.journal ?? []
  const when = data.recordedAt ? `<p>Approved ${e(localTime(data.recordedAt,data.zone))}</p>` : ''
  const failure = job.error ? '<p>The import stopped before finishing. Inspect the journal and source, then review before continuing.</p>' : ''
  return `<article class="card"><h3>Import: ${e(job.namespace)}</h3>${when}<p>${e(outcome(job,data.outcome ?? job.outcome ?? job.state))} · ${e(count(job.total,'source record'))}</p><p>${e(job.checkpoint)} of ${e(count(job.total,'source record'))} processed</p><p>Fingerprint: <code>${e(job.fingerprint)}</code></p>${['queued','applying'].includes(job.state) ? form('import.apply','<button type="submit">Continue approved import</button>',{jobId:job.id,fingerprint:job.fingerprint}) : ''}${failure}${originals.length ? `<h4>Original source</h4><ul>${originals.map(originalSource).join('')}</ul>` : ''}${batches.length ? `<h4>Import journal</h4><ul>${batchEntries(data)}</ul>` : ''}</article>`
}

function historyJob(job: Row, zone: string) {
  return `<article class="card"><h4>${e(job.namespace)}</h4>${job.recordedAt ? `<p>Approved ${e(localTime(job.recordedAt,zone))}</p>` : ''}<p>${progress(job)}</p><p>Fingerprint: <code>${e(job.fingerprint)}</code></p>${form('import.journal','<button type="submit">Inspect journal and original</button>',{jobId:job.id})}${['queued','applying'].includes(job.state) ? form('import.apply','<button type="submit">Continue approved import</button>',{jobId:job.id,fingerprint:job.fingerprint}) : ''}${!['undone','rolled_back'].includes(job.state) ? form('import.undo','<p>Undo removes unchanged imported tenancies. Later edits or added ledger, inspection or maintenance work are preserved and stop undo.</p><button class="danger" type="submit">Undo import</button>',{jobId:job.id}) : ''}</article>`
}

export function importView(data: Row): string {
  const jobs: Row[] = data.jobs ?? [], erasures: Row[] = data.erasureJournal ?? []
  const intake = form('import.preview', `<label>Source namespace<input name="namespace" value="${e(data.namespace ?? 'terrace-tenancies-v1')}" maxlength="100" pattern="[A-Za-z0-9][A-Za-z0-9_.\\-]*" required></label><label>CSV source<textarea name="csv" rows="9" required maxlength="256000" placeholder="${e(CSV_HEADERS.join(','))}">${e(data.csv ?? '')}</textarea></label><p>Up to 100 tenancies and ${e(fileSize(256_000))} of UTF-8 text. Keep one namespace for the same source system and stable references for each tenancy.</p><button type="submit">Preview import</button>`)
  const columns = `<details><summary>CSV columns</summary><p><code>${e(CSV_HEADERS.join(','))}</code></p><p>Dates use year-month-day. Rent is a positive decimal with at most two decimal places, in the row's currency. Optional ${e(OPTIONAL_HEADERS.slice(1).join(' and '))}: currency is USD (when empty) or AUD for a historical AUD tenancy, which stays AUD and is never converted; time_zone is the property's IANA zone, for example America/Chicago (when empty, the office zone). Cadence is weekly, fortnightly (every two weeks) or monthly. created_at is the source record's UTC creation timestamp; see the <a href="https://run-terrace.com/docs/move-in">CSV format guide</a> for its exact format. Optional ${e(LEASE_TYPE_HEADER)} is empty or residential; any other value is held as an exception. CSV quotes and escaped quotes are supported.</p></details>`
  const receipts = erasures.length ? `<h3>Import erasure receipts</h3><ul>${erasures.map(row=>`<li>${e(localTime(row.recordedAt,data.zone))} · ${e(count(row.recordsErased,'record'))} erased · ${e(count(row.jobsRetired,'import'))} retired</li>`).join('')}</ul>` : ''
  return `<section aria-labelledby="move-in-heading"><h2 id="move-in-heading">Move into Terrace</h2><p>${e(IMPORT_KIT)} imports existing tenancy records. Preview the file, inspect its fingerprint and approve it as the installation owner.</p><p>${e(RESIDENTIAL_ONLY)} A row whose ${e(LEASE_TYPE_HEADER)} is not residential is held as an exception and never imported as a tenancy.</p>${columns}${migrationView(data)}<h3>Tenancy CSV</h3>${intake}${review(data)}${journal(data)}<h3>Import history</h3>${jobs.length ? jobs.map(job=>historyJob(job,data.zone)).join('') : '<p>No imports yet.</p>'}${receipts}</section>`
}
