import { canonicalJson, sha256 } from '../modules/import-kit/src/d1/index.ts'
import type { ImportMapping, Json, SourceBundle } from '../modules/import-kit/src/d1/index.ts'
import { Fault, cents, date, email, insist, text } from './core'

export const IMPORT_KIT = 'Terrace tenancy CSV v1'
export const IMPORT_VERSION = 'terrace-tenancy-csv-v1'
export const IMPORT_DESTINATION = 'terrace-tenancies'
export const TENANCY_KIND = 'tenancy'
export const CSV_HEADERS = ['ref','address','owner_name','owner_email','tenant_name','tenant_email','start_date','end_date','rent','cadence','created_at'] as const
/** Optional; empty or `residential` imports. Any other value is held as an exception (BOUND-004). */
export const LEASE_TYPE_HEADER = 'lease_type'
export const RESIDENTIAL_ONLY = 'Terrace manages residential rentals only: it has no commercial leases, CAM reconciliation or homeowners’-association dues.'
export const importNamespace = (v: unknown) => {
  const namespace = text(v, 'Source namespace', 100)
  insist(/^[A-Za-z0-9][A-Za-z0-9_.-]*$/.test(namespace), 'invalid_namespace', 'Namespace must use letters, digits, dots, hyphens or underscores.')
  return namespace
}
export const tenancyImportId = (namespace: string, ref: string) => `import-${sha256(canonicalJson([namespace, ref]))}`

/** RFC 4180 quoting, CRLF/LF, escaped quotes and quoted newlines. The original
 * string is retained separately; parsing never reconstructs its original bytes. */
function parseCsv(csv: string): string[][] {
  const rows: string[][] = []
  let row: string[] = [], field = '', quoted = false, closed = false
  const cell = () => { row.push(field); field = ''; closed = false }
  const record = () => { cell(); rows.push(row); row = [] }
  const input = csv.charCodeAt(0) === 0xfeff ? csv.slice(1) : csv
  for (let i = 0; i < input.length; i++) {
    const ch = input[i]
    if (quoted) {
      if (ch === '"' && input[i+1] === '"') { field += '"'; i++ }
      else if (ch === '"') { quoted = false; closed = true }
      else field += ch
      continue
    }
    if (ch === ',') cell()
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && input[i+1] === '\n') i++; record() }
    else if (ch === '"' && !field && !closed) quoted = true
    else {
      insist(!closed && ch !== '"', 'invalid_csv', 'CSV has text outside a quoted field or an unexpected quote.')
      field += ch
    }
  }
  insist(!quoted, 'invalid_csv', 'CSV has an unclosed quoted field.')
  if (field || row.length || closed) record()
  return rows
}

export function tenancySource(input: unknown, namespace: string): SourceBundle {
  insist(typeof input === 'string', 'invalid_csv', 'Paste the CSV source.')
  const bytes = new TextEncoder().encode(input)
  insist(bytes.length > 0 && bytes.length <= 256_000, 'invalid_csv', 'CSV must contain between 1 and 256,000 UTF-8 bytes.')
  const rows = parseCsv(input), headers = rows.shift()
  insist(headers && headers.length === CSV_HEADERS.length + Number(headers.includes(LEASE_TYPE_HEADER)) && CSV_HEADERS.every(h => headers.includes(h)) && new Set(headers).size === headers.length, 'invalid_csv', `CSV requires these exact columns: ${CSV_HEADERS.join(',')}, plus an optional ${LEASE_TYPE_HEADER}.`)
  insist(rows.length > 0 && rows.length <= 100, 'invalid_csv', 'Import between 1 and 100 tenancies at a time.')
  const digest = sha256(bytes), name = 'terrace-tenancies.csv'
  let binary = ''
  for (let i=0; i<bytes.length; i+=0x8000) binary += String.fromCharCode(...bytes.subarray(i, i+0x8000))
  const seen = new Set<string>()
  return {
    diagnostics: [],
    artifacts: [{ name, sha256: digest, size: bytes.length, original: { status: 'available', base64: btoa(binary) } }],
    records: rows.map((cells, index) => {
      insist(cells.length === headers.length, 'invalid_csv', `CSV record ${index+2} has ${cells.length} columns; expected ${headers.length}.`)
      const payload = Object.fromEntries(headers.map((h,i) => [h,cells[i]])) as Record<string,Json>
      const ref = text(payload.ref, `Reference at CSV record ${index+2}`, 100)
      insist(/^[A-Za-z0-9][A-Za-z0-9_.-]*$/.test(ref), 'invalid_csv', `CSV record ${index+2} has an invalid reference.`)
      insist(!seen.has(ref), 'invalid_csv', `CSV repeats reference ${ref}. Use one record for each reference.`)
      seen.add(ref)
      return { namespace, kind: TENANCY_KIND, sourceId: ref, payload, payloadHash: sha256(canonicalJson(payload)), artifactHash: digest, location: { artifact: name, row: index+2 } }
    }),
  }
}

export const tenancyMapping: ImportMapping = {
  version: IMPORT_VERSION,
  map(record) {
    const p = record.payload as Record<string,Json>
    const leaseType = String(p[LEASE_TYPE_HEADER] ?? '').trim()
    if (leaseType && leaseType.toLowerCase() !== 'residential') return { effects: [], rejection: `Held as an exception: lease_type "${leaseType.slice(0,40)}" is not residential. ${RESIDENTIAL_ONLY} Keep this lease in your commercial or association system and remove the row to import the rest.` }
    try {
      const start_date = date(p.start_date, 'Start date'), end_date = date(p.end_date, 'End date')
      insist(end_date >= start_date, 'invalid_date', 'End date must be on or after start date.')
      const cadence = text(p.cadence, 'Cadence')
      insist(['weekly','fortnightly','monthly'].includes(cadence), 'invalid_cadence', 'Cadence must be weekly, fortnightly or monthly.')
      const created_at = text(p.created_at, 'Created timestamp', 24)
      insist(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(created_at) && Number.isFinite(Date.parse(created_at)) && new Date(created_at).toISOString() === created_at, 'invalid_date', 'created_at must be an ISO UTC timestamp, for example 2025-01-01T00:00:00.000Z.')
      const value = { address: text(p.address, 'Address', 500), owner_name: text(p.owner_name, 'Owner name', 200), owner_email: email(p.owner_email), tenant_name: text(p.tenant_name, 'Tenant name', 200), tenant_email: email(p.tenant_email), start_date, end_date, rent_cents: cents(p.rent), cadence, created_at, version: 1 }
      return { effects: [{ targetKind: TENANCY_KIND, targetId: tenancyImportId(record.namespace, record.sourceId), value }] }
    } catch (error) {
      if (!(error instanceof Fault)) throw error
      return { effects: [], rejection: error.message }
    }
  },
}
