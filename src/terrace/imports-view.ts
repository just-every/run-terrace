import { escape as e, money, type Row } from './core'
import { CSV_HEADERS, IMPORT_KIT } from './imports-source'

const hidden = (name: string, value: unknown) => `<input type="hidden" name="${e(name)}" value="${e(value)}">`
function form(command: string, body: string, payload: Row = {}) {
  return `<form method="post" action="/app/command">${hidden('command',command)}${hidden('tab','import')}${Object.entries(payload).map(([key,value])=>hidden(key,value)).join('')}${body}</form>`
}

function review(data: Row) {
  if (!data.fingerprint || !data.counts) return ''
  const counts = data.counts
  const rows: Row[] = data.rows ?? []
  const table = `<div class="table-scroll"><table><thead><tr><th>Source ref</th><th>Property</th><th>Tenant</th><th>Lease</th><th>Rent</th><th>Review</th></tr></thead><tbody>${rows.map(row => `<tr><td>${e(row.ref)}</td><td>${e(row.value?.address)}</td><td>${e(row.value?.tenant_name)}<br>${e(row.value?.tenant_email)}</td><td>${e(row.value?.start_date)} — ${e(row.value?.end_date)}</td><td>${row.value ? `${e(money(row.value.rent_cents))} ${e(row.value.cadence)}` : ''}</td><td>${e(row.rejection ?? 'Ready')}</td></tr>`).join('')}</tbody></table></div>`
  const diagnostics: Row[] = data.diagnostics ?? []
  const errors = diagnostics.some(d=>d.severity === 'error') || counts.rejected > 0
  const approval = errors ? '<p>Correct rejected records and preview again before importing.</p>' : form('import.apply', '<p>Approval creates the tenancy records shown above. The source and journal remain available after undo.</p><button type="submit">Approve and import these tenancies</button>', { namespace: data.namespace, csvBase64: data.csvBase64, fingerprint: data.fingerprint })
  return `<article class="card"><h3>Review before importing</h3><p>${e(counts.input)} source records · ${e(counts.effects)} tenancies · ${e(counts.rejected)} rejected</p><p>Source namespace: <strong>${e(data.namespace)}</strong></p><p>Reviewed fingerprint: <code>${e(data.fingerprint)}</code></p>${diagnostics.length ? `<ul>${diagnostics.map(d=>`<li>${e(d.severity)}: ${e(d.message)}</li>`).join('')}</ul>` : ''}${table}${approval}</article>`
}

function journal(data: Row) {
  if (!data.job) return ''
  const job = data.job
  const originals: Row[] = data.originals ?? []
  const batches: Row[] = data.journal ?? []
  return `<article class="card"><h3>Import ${e(job.id)}</h3><p>${e(job.state)} · ${e(job.checkpoint)} / ${e(job.total)} source records</p><p>Fingerprint: <code>${e(job.fingerprint)}</code></p>${['queued','applying'].includes(job.state) ? form('import.apply','<button type="submit">Continue approved import</button>',{jobId:job.id,fingerprint:job.fingerprint}) : ''}${job.error ? `<p>${e(job.error)}</p>` : ''}${originals.length ? `<h4>Original source</h4><ul>${originals.map(original=>`<li>${e(original.name)} · ${e(original.size)} bytes · SHA-256 <code>${e(original.sha256)}</code>${original.original?.status === 'retained' ? ` · <a download="terrace-tenancies.csv" href="data:text/csv;base64,${e(original.original.base64)}">Download exact original</a>` : ` · ${e(original.original?.reason)}`}</li>`).join('')}</ul>` : ''}${batches.length ? `<h4>Durable journal</h4><ul>${batches.map(batch=>`<li>${e(batch.action)} · source ${e(batch.position)}–${e(batch.end_position)} · fence ${e(batch.fence)}</li>`).join('')}</ul>` : ''}</article>`
}

export function importView(data: any): string {
  const jobs: Row[] = data.jobs ?? [], erasures: Row[] = data.erasureJournal ?? []
  const intake = form('import.preview', `<label>Source namespace<input name="namespace" value="${e(data.namespace ?? 'terrace-tenancies-v1')}" maxlength="100" pattern="[A-Za-z0-9][A-Za-z0-9_.-]*" required></label><label>CSV source<textarea name="csv" rows="9" required maxlength="256000" placeholder="${e(CSV_HEADERS.join(','))}">${e(data.csv ?? '')}</textarea></label><p>Up to 100 tenancies and 256,000 UTF-8 bytes. Keep one namespace for the same source system and stable references for each tenancy.</p><button type="submit">Preview import</button>`)
  return `<section aria-labelledby="move-in-heading"><h2 id="move-in-heading">Move into Terrace</h2><p>${e(IMPORT_KIT)} imports existing tenancy records. Preview the file, inspect its fingerprint and approve it as the installation owner.</p><details><summary>CSV columns</summary><p><code>${e(CSV_HEADERS.join(','))}</code></p><p>Dates use YYYY-MM-DD. Rent is a positive AUD decimal. Cadence is weekly, fortnightly or monthly. created_at is the source record's ISO UTC creation timestamp, for example 2025-01-01T00:00:00.000Z. CSV quotes and escaped quotes are supported.</p></details>${intake}${review(data)}${journal(data)}<h3>Import history</h3>${jobs.length ? jobs.map(job=>`<article class="card"><h4>${e(job.namespace)}</h4><p>${e(job.state)} · ${e(job.checkpoint)} / ${e(job.total)} source records</p><p><code>${e(job.fingerprint)}</code></p>${form('import.journal','<button type="submit">Inspect journal and original</button>',{jobId:job.id})}${['queued','applying'].includes(job.state) ? form('import.apply','<button type="submit">Continue approved import</button>',{jobId:job.id,fingerprint:job.fingerprint}) : ''}${!['undone','rolled_back'].includes(job.state) ? form('import.undo','<p>Undo removes unchanged imported tenancies. Later edits or added ledger, inspection or maintenance work are preserved and stop undo.</p><button type="submit">Undo import</button>',{jobId:job.id}) : ''}</article>`).join('') : '<p>No imports yet.</p>'}${erasures.length ? `<h3>Import erasure receipts</h3><ul>${erasures.map(row=>`<li>${e(row.recordedAt)} · receipt <code>${e(row.receiptId)}</code> · ${e(row.recordsErased)} records erased · ${e(row.jobsRetired)} jobs retired</li>`).join('')}</ul>` : ''}</section>`
}
