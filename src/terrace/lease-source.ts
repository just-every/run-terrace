import { allow, guard, insist, one, recordRead, sha256, sql, tenancy, text, type Context, type Row } from './core'

/** Original signed PDFs are staff-recorded evidence, never provider signing or extraction. */
export async function prepareLeaseSource(c: Context, value: unknown) {
 let name: string, type: string, bytes: Uint8Array
 if (value instanceof File) {
  insist(value.size > 0 && value.size <= 5 * 1024 * 1024, 'source_limit', 'The signed PDF must be at most 5 MB.', 413)
  name = value.name; type = value.type; bytes = new Uint8Array(await value.arrayBuffer())
 } else {
  const v = value as Row
  insist(v && typeof v === 'object', 'source_required', 'Upload the signed lease PDF.')
  name = text(v.name, 'Source name', 200); type = text(v.type, 'Source type', 100)
  const encoded = text(v.base64, 'Source bytes', 7 * 1024 * 1024)
  try { bytes = Uint8Array.from(atob(encoded), ch => ch.charCodeAt(0)) } catch { insist(false, 'invalid_source', 'The source must contain valid base64 PDF bytes.') }
 }
 name = text(name, 'Source name', 200)
 insist(bytes.length > 0 && bytes.length <= 5 * 1024 * 1024, 'source_limit', 'The signed PDF must be at most 5 MB.', 413)
 insist(type === 'application/pdf' && new TextDecoder().decode(bytes.slice(0,5)) === '%PDF-', 'invalid_source', 'Upload an original application/pdf file with a PDF header.')
 const sha = await sha256(bytes)
 insist(!(await one(c, 'SELECT 1 FROM tt_erased_lease_files WHERE sha256=?', sha)), 'erased_artifact', 'This lease artifact was erased and cannot be reimported.', 409)
 return {name, media_type: type, bytes, sha, size: bytes.length}
}
export async function leaseSource(c: Context, value: unknown) {
 allow(c, 'lease.source')
 const key = text(value, 'Lease version', 100)
 const v = await one(c, 'SELECT tenancy_id FROM tt_lease_versions WHERE id=?', key)
 insist(v, 'not_found', 'Lease source not found.', 404)
 await tenancy(c, v.tenancy_id)
 const source = await one(c, 'SELECT * FROM tt_lease_sources WHERE lease_version_id=?', key)
 insist(source, 'not_found', 'Lease source not found.', 404)
 await recordRead(c, 'lease.source', key)
 return new Response(new Uint8Array(source.bytes), {headers: {'content-type': 'application/pdf', 'content-disposition': `attachment; filename="${source.name.replace(/[^a-zA-Z0-9._-]/g, '_')}"`, 'cache-control': 'private, no-store', 'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer', 'content-security-policy': "default-src 'none'; sandbox"}})
}
/** Called only within the parent's reviewed lease-retention erasure transaction. */
export function leaseErasureStatements(c: Context, tenancyId: string) {
 return [guard(c, "NOT EXISTS(SELECT 1 FROM tt_legal_holds WHERE tenancy_id=? AND released_at IS NULL AND class IN ('all','lease'))", tenancyId),
  sql(c, 'INSERT INTO tt_erased_lease_files(sha256) SELECT source_sha256 FROM tt_lease_versions WHERE tenancy_id=? ON CONFLICT DO NOTHING', tenancyId),
  sql(c, 'DELETE FROM tt_lease_sources WHERE lease_version_id IN (SELECT id FROM tt_lease_versions WHERE tenancy_id=?)', tenancyId),
  sql(c, 'DELETE FROM tt_lease_versions WHERE tenancy_id=?', tenancyId),
  sql(c, 'UPDATE tt_lease_terms SET source_clause=NULL WHERE tenancy_id=?', tenancyId)]
}
