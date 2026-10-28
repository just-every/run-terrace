// PORT-007. Tenancy documents (leases, applications, notices, screening reports and tax documents): upload, versioned
// revision, search over authorized content and metadata, download with history. A document belongs to one tenancy, so
// ROLE-001 scope applies to every read: a record outside the reader's portfolios answers 404, exactly like a missing one.
// Application, screening and tax documents need their kind's own right (document.application, document.screening,
// document.tax); a reader without it sees no trace of them. Inspection photos and video, work documents and invoices attach
// to their own records (PORT-009). Signed lease originals (PORT-005) and inspection photographs appear in search as
// read-only entries behind their own doors.
import { all, audit, can, commit, guard, id, insist, one, reaches, recordRead, sha256, sql, tenancy, text, type Context, type Row } from './core'
import {originalAuthorization,requireOriginalAuthorization} from './document-authorization'
import {redactSensitive} from './sensitive-metadata'
import { LIMIT, scan } from './document-scan'

export const DOCUMENT_COMMANDS = ['document.upload', 'document.revise']
/** The kinds a tenancy document may be uploaded as: its retention class, its sensitivity class and the right that reads it. */
export const KINDS: Record<string, { label: string; retention: string; restriction: '' | 'screening' | 'tax'; right: string }> = {
 hap: { label: 'PHA notice or remittance', retention: 'accounting', restriction: '', right: 'document.read' },
 lease: { label: 'Lease or amendment', retention: 'lease', restriction: '', right: 'document.read' },
 application: { label: 'Application', retention: 'screening', restriction: 'screening', right: 'document.application' },
 screening: { label: 'Screening report', retention: 'screening', restriction: 'screening', right: 'document.screening' },
 notice: { label: 'Notice', retention: 'communications', restriction: '', right: 'document.read' },
 tax: { label: 'Tax document', retention: 'accounting', restriction: 'tax', right: 'document.tax' },
}
/** Rows stored as an earlier kind (inspection, work, invoice, other) stay readable with document.read. */
export const right = (kind: string) => kind === 'professional' ? 'referral.read' : (Object.hasOwn(KINDS, kind) ? KINDS[kind].right : undefined) ?? 'document.read'
/** A restricted document is invisible, not forbidden, to a reader without its kind's right, and never reachable by an API credential. */
const mayRead = (c: Context, kind: string, referralOriginal = false) => { const r = referralOriginal ? 'referral.read' : right(kind); return can(c, r) && (r === 'document.read' || !c.actor.credential) }
/** Whether the Documents door opens at all: any document right (an accountant's is tax documents only). */
export const readsDocuments = (c: Context) => ['document.read', 'document.application', 'document.screening', 'document.tax', 'referral.read'].some(r => can(c, r))
export const enterDocuments = (c: Context) => insist(readsDocuments(c), 'forbidden', 'Your role does not allow this action.', 403)

async function file(value: unknown) {
 let name: string, type: string, bytes: Uint8Array
 if (value instanceof File) { name = value.name; type = value.type; bytes = new Uint8Array(await value.arrayBuffer()) }
 else {
  const v = value as Row
  insist(v && typeof v === 'object', 'file_required', 'Choose the file to upload.')
  name = text(v.name, 'File name', 200); type = text(v.type, 'File type', 100)
  try { bytes = Uint8Array.from(atob(text(v.base64, 'File bytes', 8 * 1024 * 1024)), ch => ch.charCodeAt(0)) } catch { insist(false, 'invalid_document', 'The file must contain valid base64 bytes.') }
 }
 insist(bytes.length <= LIMIT, 'document_limit', 'Each document must be at most 5 MB.', 413)
 if ((!type || type === 'application/octet-stream') && /\.eml$/i.test(name)) type = 'message/rfc822'
 return { name: text(name, 'File name', 200), type: type.split(';')[0].trim().toLowerCase(), bytes }
}

/** The checked, hashed original and the statements that store it. A refused file writes one history row, never a document. */
export async function stored(c: Context, p: Row, tenancyId: string, documentId: string, version: number) {
 const f = await file(p.file), result = await scan(f.bytes, f.type)
 if (!result.ok) { await audit(c, c.action ?? 'document.upload', tenancyId, 'refused').run(); insist(false, 'document_refused', result.reason, 422) }
 const digest = await sha256(f.bytes), key = id()
 insist(!(await one(c, 'SELECT 1 FROM tt_erased_document_files WHERE sha256=?', digest)), 'erased_artifact', 'This document was erased and cannot be uploaded again.', 409)
 insist(!(await one(c, 'SELECT 1 FROM tt_document_versions v JOIN tt_documents d ON d.id=v.document_id WHERE d.tenancy_id=? AND v.sha256=?', tenancyId, digest)), 'duplicate_bytes', 'These exact bytes are already stored on this tenancy.', 409)
 const source = text(p.source, 'Source (where the document came from)', 500)
 return { key, digest, size: f.bytes.length, statements: [
  guard(c, 'NOT EXISTS(SELECT 1 FROM tt_document_versions v JOIN tt_documents d ON d.id=v.document_id WHERE d.tenancy_id=? AND v.sha256=?)', tenancyId, digest),
  guard(c, 'NOT EXISTS(SELECT 1 FROM tt_erased_document_files WHERE sha256=?)', digest),
  sql(c, 'INSERT INTO tt_document_versions(id,document_id,version,name,media_type,size,sha256,bytes,content_text,note,scan,uploaded_by,uploaded_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)', key, documentId, version, f.name, f.type, f.bytes.length, digest, f.bytes, result.text, source, JSON.stringify({ check: result.label, text: result.text ? 'indexed' : 'metadata only' }), c.actor.id, c.now),
 ] }
}

export async function documentCommand(c: Context, command: string, p: Row): Promise<Row | undefined> {
 if (!DOCUMENT_COMMANDS.includes(command)) return
 if (command === 'document.upload') {
  const name = String(p.kind), kind = Object.hasOwn(KINDS, name) ? KINDS[name] : undefined
  insist(kind, 'document_kind', 'Choose a document type.')
  insist(mayRead(c, String(p.kind)), 'forbidden', 'Your role does not allow this action.', 403)
  const t = await tenancy(c, p.tenancyId), title = text(p.title, 'Title', 200), documentId = id(), s = await stored(c, p, t.id, documentId, 1)
  await commit(c, [guard(c, 'EXISTS(SELECT 1 FROM tt_tenancies WHERE id=? AND erased_at IS NULL)', t.id),
   sql(c, 'INSERT INTO tt_documents(id,tenancy_id,kind,title,retention_class,restriction,version,created_by,created_at) VALUES(?,?,?,?,?,?,?,?,?)', documentId, t.id, p.kind, title, kind.retention, kind.restriction || null, 1, c.actor.id, c.now), ...s.statements], command, documentId)
  return { documentId, versionId: s.key, version: 1, sha256: s.digest, tenancyId: t.id, retentionClass: kind.retention, notice: 'Document stored. ' + (kind.restriction ? 'It is restricted: only staff with that right can find it.' : 'Staff in this portfolio can find it.') }
 }
 const doc = await one(c, 'SELECT * FROM tt_documents WHERE id=?', text(p.documentId, 'Document', 100))
 insist(doc && mayRead(c, doc.kind, doc.referral_original), 'not_found', 'Document not found.', 404)
 insist(!doc.referral_original, 'referral_original', 'Record another response from its referral; an original response cannot be revised.', 409)
 const t = await tenancy(c, doc.tenancy_id)
 insist(Number(p.version) === doc.version, 'conflict', 'This document changed since you opened it. Reload and revise the current version.', 409)
 const version = doc.version + 1, s = await stored(c, p, t.id, doc.id, version)
 await commit(c, [guard(c, 'EXISTS(SELECT 1 FROM tt_documents WHERE id=? AND version=?)', doc.id, doc.version), ...s.statements, sql(c, 'UPDATE tt_documents SET version=? WHERE id=?', version, doc.id)], command, doc.id)
 return { documentId: doc.id, versionId: s.key, version, sha256: s.digest, tenancyId: t.id, notice: `Version ${version} stored. Version ${doc.version} remains available.` }
}

const words = (q: unknown) => String(q ?? '').toLowerCase().split(/\s+/).filter(Boolean).slice(0, 8)
/** Search authorized content and metadata. Current versions by default; history=1 adds earlier ones. */
export async function documentSearch(c: Context, q: Row, limit = 300) {
 enterDocuments(c)
 const tokens = words(q.q), args: unknown[] = [], where: string[] = ['t.erased_at IS NULL']
 const scope = (extra: string[], extraArgs: unknown[]) => { where.push(...extra); args.push(...extraArgs) }
 if (q.tenancyId) scope(['t.id=?'], [text(q.tenancyId, 'Tenancy', 100)])
 if (q.unitId) scope(['t.unit_id=?'], [text(q.unitId, 'Unit', 100)])
 if (q.kind === 'professional') where.push('d.referral_original=1')
 else if (q.kind) scope(['d.kind=?'], [text(q.kind, 'Type', 40)])
 if (!q.history || q.history === '0') where.push('v.version=d.version')
 const hay = "lower(d.title||' '||d.kind||' '||v.name||' '||v.note||' '||t.address||' '||t.tenant_name||' '||COALESCE(u.identifier,'')||' '||COALESCE(p.name,'')||' '||COALESCE(v.content_text,''))"
 const first = tokens[0] ?? ''
 for (const word of tokens) scope([`instr(${hay},?)>0`], [word])
 const rows = await all(c, `SELECT d.id AS document_id,d.tenancy_id,d.kind,d.title,d.restriction,d.referral_original,d.retention_class,d.version AS current_version,v.id AS version_id,v.version,v.name,v.media_type,v.size,v.sha256,v.note,v.uploaded_by,v.uploaded_at,v.content_text IS NOT NULL AS indexed,
  CASE WHEN ?<>'' AND instr(lower(COALESCE(v.content_text,'')),?)>0 THEN substr(v.content_text,max(1,instr(lower(v.content_text),?)-40),120) END AS snippet,t.unit_id,t.address,t.tenant_name,u.identifier AS unit,p.name AS property
  FROM tt_document_versions v JOIN tt_documents d ON d.id=v.document_id JOIN tt_tenancies t ON t.id=d.tenancy_id LEFT JOIN tt_units u ON u.id=t.unit_id LEFT JOIN tt_properties p ON p.id=u.property_id WHERE ${where.join(' AND ')} ORDER BY v.uploaded_at DESC,v.id LIMIT ?`, first, first, first, ...args, limit)
 const documents: Row[] = rows.filter(r => reaches(c, r.unit_id) && mayRead(c, r.kind, r.referral_original)).map(r => ({ documentId: r.document_id, versionId: r.version_id, version: r.version, current: r.version === r.current_version, kind: r.referral_original ? 'professional' : r.kind, title: r.restriction ? redactSensitive(r.title) : r.title, restricted: r.referral_original ? 'professional' : r.restriction, retentionClass: r.retention_class,
  name: r.restriction ? redactSensitive(r.name) : r.name, mediaType: r.media_type, size: r.size, sha256: r.sha256, source: r.restriction ? redactSensitive(r.note) : r.note, uploadedBy: r.uploaded_by, uploadedAt: r.uploaded_at, contentSearchable: !!r.indexed, snippet: r.restriction && r.snippet ? redactSensitive(r.snippet) : r.snippet ?? null, tenancyId: r.tenancy_id, address: r.address, unit: r.unit ?? null, property: r.property ?? null, url: (r.restriction ? '/api/document-access?id=' : '/api/document?id=') + r.version_id }))
 const entries = [...documents, ...await originals(c, q, tokens)]
 return { documents: limit < 0 ? entries : entries.slice(0, limit) }
}
/** PORT-005 signed lease originals and inspection photographs: searched by their metadata, opened by their own doors. */
async function originals(c: Context, q: Row, tokens: string[]) {
 if (q.kind && !['signed-lease', 'inspection-photo'].includes(String(q.kind))) return []
 const out: Row[] = [], match = (hay: string) => tokens.every(w => hay.toLowerCase().includes(w))
 const near = (r: Row) => reaches(c, r.unit_id) && (!q.tenancyId || r.tenancy_id === q.tenancyId) && (!q.unitId || r.unit_id === q.unitId)
 const head = 't.id AS tenancy_id,t.unit_id,t.address,t.tenant_name,u.identifier AS unit,p.name AS property'
 const join = (column: string) => `JOIN tt_tenancies t ON t.id=${column} LEFT JOIN tt_units u ON u.id=t.unit_id LEFT JOIN tt_properties p ON p.id=u.property_id WHERE t.erased_at IS NULL`
 const where = (r: Row) => `${r.address} ${r.tenant_name} ${r.unit ?? ''} ${r.property ?? ''}`
 if ((!q.kind || q.kind === 'signed-lease') && can(c, 'lease.source') && !c.actor.credential) {
  const rows = await all(c, `SELECT lv.id,lv.effective,lv.reference,lv.source_name,lv.source_size,lv.source_sha256,lv.prepared_at,lv.approved_at,${head} FROM tt_lease_versions lv ${join('lv.tenancy_id')} AND lv.source_sha256 IS NOT NULL`)
  for (const r of rows) if (near(r) && match(`signed lease ${r.source_name} ${r.reference} ${where(r)}`)) out.push({ documentId: null, versionId: r.id, version: null, current: null, kind: 'signed-lease', title: 'Signed lease effective ' + r.effective, restricted: null, retentionClass: 'lease', name: r.source_name, mediaType: 'application/pdf', size: r.source_size, sha256: r.source_sha256, source: r.reference, uploadedAt: r.prepared_at, contentSearchable: false, snippet: null, tenancyId: r.tenancy_id, address: r.address, unit: r.unit ?? null, property: r.property ?? null, url: '/api/lease-source?id=' + r.id })
 }
 if ((!q.kind || q.kind === 'inspection-photo') && can(c, 'work.read')) {
  const rows = await all(c, `SELECT x.id,x.filename,x.media_type,x.size,x.sha256,x.uploaded_at,${head} FROM tt_inspection_photos x JOIN tt_inspections i ON i.id=x.inspection_id ${join('i.tenancy_id')}`)
  for (const r of rows) if (near(r) && match(`inspection photo ${r.filename} ${where(r)}`)) out.push({ documentId: null, versionId: r.id, version: null, current: null, kind: 'inspection-photo', title: 'Inspection photo', restricted: null, retentionClass: 'lease', name: r.filename, mediaType: r.media_type, size: r.size, sha256: r.sha256, source: null, uploadedAt: r.uploaded_at, contentSearchable: false, snippet: null, tenancyId: r.tenancy_id, address: r.address, unit: r.unit ?? null, property: r.property ?? null, url: '/api/inspections/photos/' + r.id })
 }
 return out
}

async function reachable(c: Context, v: Row | null | undefined) {
 insist(v && mayRead(c, v.kind, v.referral_original), 'not_found', 'Document not found.', 404)
 await tenancy(c, v.tenancy_id)
 return v
}
/** One stored version's original bytes, recorded as a read in the operating history. */
export async function documentDownload(c: Context, value: unknown, authorization?: unknown) {
 enterDocuments(c)
 const v = await reachable(c, await one(c, 'SELECT v.*,d.tenancy_id,d.kind,d.referral_original,d.restriction FROM tt_document_versions v JOIN tt_documents d ON d.id=v.document_id WHERE v.id=?', text(value, 'Document', 100)))
 if(v.restriction)await requireOriginalAuthorization(c,v.id,v.sha256,authorization)
 await recordRead(c, 'read:document', v.id)
 return new Response(new Uint8Array(v.bytes), { headers: { 'content-type': v.media_type, 'content-disposition': `attachment; filename="${(v.restriction ? redactSensitive(v.name) : v.name).replace(/[^a-zA-Z0-9._-]/g, '_')}"`, 'cache-control': 'private, no-store', 'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer', 'content-security-policy': "default-src 'none'; sandbox", 'x-document-sha256': v.sha256 } })
}
export async function documentAccess(c:Context,value:unknown,json=false){
 enterDocuments(c)
 const v=await reachable(c,await one(c,'SELECT v.id,v.sha256,d.tenancy_id,d.kind,d.referral_original,d.restriction FROM tt_document_versions v JOIN tt_documents d ON d.id=v.document_id WHERE v.id=?',text(value,'Document',100)))
 const grant=v.restriction?await originalAuthorization(c,v.id,v.sha256):null
 const url='/api/document?id='+encodeURIComponent(v.id)+(grant?'&authorization='+grant.token:'')
 await recordRead(c,'read:document-authorization',v.id)
 const headers={'cache-control':'private, no-store','referrer-policy':'no-referrer','x-content-type-options':'nosniff'}
 return json?Response.json({url,expiresAt:grant?.expiresAt??null},{headers}):new Response(null,{status:303,headers:{...headers,location:url}})
}
/** Every version of one document with its upload check and who opened each. Never carries bytes. */
export async function documentVersions(c: Context, value: unknown) {
 enterDocuments(c)
 const d = await reachable(c, await one(c, 'SELECT * FROM tt_documents WHERE id=?', text(value, 'Document', 100)))
 const versions = await all(c, 'SELECT id,version,name,media_type,size,sha256,note,scan,uploaded_by,uploaded_at,content_text IS NOT NULL AS indexed FROM tt_document_versions WHERE document_id=? ORDER BY version DESC', d.id)
 const downloads = await all(c, "SELECT a.subject AS version_id,a.at,a.actor,COALESCE(o.display_name,a.actor) AS actor_name FROM tt_audit a LEFT JOIN oa_operators o ON o.id=a.actor WHERE a.action='read:document' AND a.subject IN (SELECT id FROM tt_document_versions WHERE document_id=?) ORDER BY a.at DESC", d.id)
 return { document: { id: d.id, tenancyId: d.tenancy_id, kind: d.referral_original ? 'professional' : d.kind, title: d.restriction ? redactSensitive(d.title) : d.title, restricted: d.referral_original ? 'professional' : d.restriction, retentionClass: d.retention_class, version: d.version }, versions: versions.map(v => ({ id: v.id, version: v.version, current: v.version === d.version, name: d.restriction ? redactSensitive(v.name) : v.name, mediaType: v.media_type, size: v.size, sha256: v.sha256, source: d.restriction ? redactSensitive(v.note) : v.note, scan: JSON.parse(v.scan), contentSearchable: !!v.indexed, uploadedBy: v.uploaded_by, uploadedAt: v.uploaded_at, url: (d.restriction ? '/api/document-access?id=' : '/api/document?id=') + v.id })), downloads: downloads.map(r => ({ versionId: r.version_id, at: r.at, actorId: r.actor, actorName: r.actor_name })) }
}

/** Called only inside the parent's reviewed erasure transaction: the stored bytes go, their hashes stay as a fence against re-upload. */
export function documentErasureStatements(c: Context, tenancyId: string, classes: string[]) {
 const marks = classes.map(() => '?').join(',')
 return [sql(c, `INSERT INTO tt_erased_document_files(sha256) SELECT v.sha256 FROM tt_document_versions v JOIN tt_documents d ON d.id=v.document_id WHERE d.tenancy_id=? AND d.retention_class IN (${marks}) ON CONFLICT DO NOTHING`, tenancyId, ...classes),
  sql(c, `DELETE FROM tt_document_versions WHERE document_id IN (SELECT id FROM tt_documents WHERE tenancy_id=? AND retention_class IN (${marks}))`, tenancyId, ...classes),
  sql(c, `DELETE FROM tt_documents WHERE tenancy_id=? AND retention_class IN (${marks})`, tenancyId, ...classes)]
}
