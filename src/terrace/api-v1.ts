import {recordMediaCatalog} from './field-evidence-media'
import { moveChecklistData } from './move-checklists'
// OPS-001. Version 1 of the property operations API: cursor-paginated resources over the records a role's
// capabilities and portfolios already reach, for people and API credentials alike. Every list is scoped before
// it is cut into pages, so a page, a cursor or a record id never reveals another portfolio's rows; a record
// outside the caller's scope answers 404 and a resource its role lacks answers 403.
import { all, allow, can, Fault, insist, reaches, recordRead, text, type Context, type Row } from './core'
import { tenancyData } from './tenancies'
import { ledgerData } from './ledger'
import { propertyData } from './properties'
import { householdData } from './households'
import { leaseData } from './lease-versions'
import { ownerStatement } from './owners'
import { documentSearch, readsDocuments } from './documents'

const DEFAULT_LIMIT = 50, MAX_LIMIT = 200
const head = { 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer' }
type Resource = { ids: (c: Context, q: URLSearchParams) => Promise<Row[]>; detail?: (c: Context, row: Row, q: URLSearchParams) => Promise<Row>; sensitive?: boolean }
const noUnit = ({ unit_id, ...rest }: Row) => rest

const RESOURCES: Record<string, Resource> = {
 properties: { ids: async c => (await propertyData(c)).portfolios.flatMap((f: Row) => f.properties) },
 leases: {
  ids: tenancyData,
  detail: async (c, t) => ({ ...t, moveChecklists: await moveChecklistData(c,t.id), versions: can(c, 'lease.read') || can(c, 'lease.metadata') ? await leaseData(c, t.id) : undefined }),
 },
 households: { ids: tenancyData, detail: (c, t) => householdData(c, t, null) },
 ledgers: { ids: async c => { allow(c, 'ledger.read'); return tenancyData(c) }, detail: async (c, t) => ({ tenancyId: t.id, address: t.address, ...await ledgerData(c, t.id) }), sensitive: true },
 'owner-ledgers': {
  ids: async c => {
   allow(c, 'reports.read')
   const rows = await all(c, 'SELECT o.id,o.legal_name FROM tt_owners o ORDER BY o.id'), links = await all(c, 'SELECT DISTINCT h.owner_id,p.portfolio_id FROM tt_ownership_shares h JOIN tt_ownership_sets s ON s.id=h.set_id JOIN tt_properties p ON p.id=s.property_id')
   const wide = c.actor.role === 'owner' || !!c.actor.staff?.all
   return rows.filter(o => wide || links.some(l => l.owner_id === o.id && (c.actor.staff?.portfolios ?? []).includes(l.portfolio_id)))
  },
  detail: (c, o, q) => ownerStatement(c, o.id, q.get('from'), q.get('to')),
  sensitive: true,
 },
 documents: {
  ids: async c => {
   const lease = can(c, 'lease.source'), photos = can(c, 'work.read'), tenancy = readsDocuments(c)
   if (!lease && !photos && !tenancy) allow(c, 'work.read')
   const leases = lease ? await all(c, "SELECT 'lease-version:'||v.id AS id,'lease_version' AS kind,v.tenancy_id,v.effective,v.source_name AS name,'application/pdf' AS media_type,v.source_size AS size,v.source_sha256 AS sha256,'/api/lease-source?id='||v.id AS href,t.unit_id FROM tt_lease_versions v JOIN tt_tenancies t ON t.id=v.tenancy_id WHERE t.erased_at IS NULL") : []
   const images = photos ? await all(c, "SELECT 'inspection-photo:'||p.id AS id,'inspection_photo' AS kind,i.tenancy_id,i.inspection_date AS effective,p.filename AS name,p.media_type,p.size,p.sha256,'/api/inspections/photos/'||p.id AS href,t.unit_id FROM tt_inspection_photos p JOIN tt_inspections i ON i.id=p.inspection_id JOIN tt_tenancies t ON t.id=i.tenancy_id WHERE t.erased_at IS NULL") : []
   const stored = tenancy ? (await documentSearch(c, {}, -1)).documents.filter(d => d.documentId).map(d => ({ id: 'document-version:' + d.versionId, kind: d.kind, documentId: d.documentId, tenancy_id: d.tenancyId, name: d.name, media_type: d.mediaType, size: d.size, sha256: d.sha256, version: d.version, retentionClass: d.retentionClass, href: d.url })) : []
   return [...leases, ...images].filter(d => reaches(c, d.unit_id)).map(noUnit).concat(stored,await recordMediaCatalog(c))
  },
  sensitive: true,
 },
 work: {
  ids: async c => {
   allow(c, 'work.read')
   return (await all(c, 'SELECT j.id,j.tenancy_id,j.title,j.trade_name,j.due_date,j.estimate_cents,j.state,j.version,j.prepared_by,j.prepared_at,t.unit_id FROM tt_maintenance_jobs j JOIN tt_tenancies t ON t.id=j.tenancy_id WHERE t.erased_at IS NULL')).filter(j => reaches(c, j.unit_id)).map(noUnit)
  },
 },
 reports: {
  ids: async c => [
   ['rent-roll', '/api/rent-roll', 'reports.read'], ['collections', '/api/collections', 'reports.read'], ['delinquency', '/api/delinquency', 'reports.read'],
   ['leasing-report', '/api/leasing-report', 'reports.read'], ['owner-statement', '/api/v1/owner-ledgers', 'reports.read'], ['maintenance-report', '/api/maintenance-report', 'maintenance.report'], ['history', '/api/history', 'history.read'],
  ].filter(r => can(c, r[2])).map(([id, href, needs]) => ({ id, href, needs })),
 },
}
export const V1_PATH = /^\/api\/v1(\/[a-z-]+(\/[^/]+)?)?$/

const encode = (key: string) => btoa(key).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const decode = (cursor: string) => { try { return atob(cursor.replace(/-/g, '+').replace(/_/g, '/')) } catch { throw new Fault('invalid_cursor', 'The cursor is not one this API returned.', 400) } }

export async function apiV1(c: Context, url: URL): Promise<Response> {
 const [, , , name, key] = url.pathname.split('/'), q = url.searchParams
 if (!name) return Response.json({ version: 1, resources: Object.keys(RESOURCES).map(r => ({ name: r, href: '/api/v1/' + r })), pagination: { limit: `1 to ${MAX_LIMIT}, default ${DEFAULT_LIMIT}`, cursor: 'the next value from the previous page' } }, { headers: head })
 const resource = Object.hasOwn(RESOURCES, name) ? RESOURCES[name] : undefined
 insist(resource, 'not_found', 'Unknown resource.', 404)
 const rows = (await resource.ids(c, q)).sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
 if (key) {
  const row = rows.find(r => r.id === decodeURIComponent(key))
  insist(row, 'not_found', 'Record not found.', 404)
  if (resource.sensitive) await recordRead(c, 'read:v1:' + name, row.id)
  return Response.json({ data: resource.detail ? await resource.detail(c, row, q) : row }, { headers: head })
 }
 const raw = q.get('limit'), limit = raw === null ? DEFAULT_LIMIT : Number(raw)
 insist(Number.isInteger(limit) && limit >= 1 && limit <= MAX_LIMIT, 'invalid_limit', `limit must be a whole number from 1 to ${MAX_LIMIT}.`)
 const after = q.has('cursor') ? decode(text(q.get('cursor'), 'Cursor', 400)) : null
 const rest = rows.filter(r => after === null || r.id > after), slice = rest.slice(0, limit)
 const data = resource.detail ? await Promise.all(slice.map(r => resource.detail!(c, r, q))) : slice
 if (resource.sensitive) await recordRead(c, 'read:v1:' + name, `${slice.length} of ${rows.length}`)
 return Response.json({ data, next: rest.length > limit ? encode(slice.at(-1)!.id) : null, limit }, { headers: head })
}
