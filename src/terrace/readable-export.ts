// SAFE-005. A human-readable copy of the complete installation archive: one CSV per archived table (the same tables,
// columns and secret exclusions the .rer backup and restore use), every stored file (inspection photographs) as its
// original bytes with its SHA-256, a manifest, and a README naming what must be reconnected after a restore. It is
// built from the backup archive itself, so whatever a restore brings back, this copy shows.
import { readArchive, type Manifest, type Part, type Closing } from '../modules/portability/index.mjs'
import { allow, sha256, type Context } from './core'
import { backup } from './data'
import { csv, zip } from './exports'
import { documentExportCell } from './document-redaction'

const EXT: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'application/pdf': 'pdf', 'video/mp4': 'mp4', 'video/quicktime': 'mov', 'video/webm': 'webm', 'text/plain': 'txt', 'text/csv': 'csv', 'message/rfc822': 'eml' }
const bytes = (b64: string) => Uint8Array.from(atob(b64), ch => ch.charCodeAt(0))

export const RECONNECT = [
 'Shadow rent: source originals, mappings, differences, next actions and prior reviews are documentary evidence. Restored reviews are inert; capture and review a new comparison with current native statements. No cutover, collection or schedule is authorized.',
 'Stripe diagnostics: set the Stripe test secret privately, review the authorized account and scope, and reconcile existing references. Restored counters and setup metadata are evidence only; no collection is replayed.',
 'Resend mail diagnostics: reconnect the key and verified sender privately; review sending permission. No restored message is sent.',
 'SendGrid mail diagnostics: reconnect the key and verified sender privately; review Mail Send permission. No restored message is sent.',
 'Cloudflare mail diagnostics: reconnect the key, account and verified sender privately; review mail permission. No restored message is sent.',
 'RER mail diagnostics: reconnect the approved relay privately; origin validation remains Base-held. No restored message is sent.',
 'Restricted documents: readable metadata is redacted; private original files and the complete owner backup retain their exact bytes. Download authorization belongs to the current sign-in and must be requested again after restore.',
 'Office prints: frozen PDFs, manifests, approvals and service photographs are retained as evidence. Restored batches grant no printing or service authority; invite recipients again and prepare and approve a new batch.',
 'Applications: answers, originals, revisions and provider outcomes are retained. Applicant sign-in links, sessions and active Checkout destinations are installation-local. Restore never permits another collection; invite each adult again explicitly.',
 'Repair messages: archived content, delivery events and opt-outs are evidence only. Set Twilio credentials, record consent again and prepare new messages; restored messages never authorize sends.',
 'Resident document delivery: frozen documents and delivery evidence are retained, but restored deliveries never authorize a send or a recipient. Invite the resident again and prepare a new reviewed document.',
 'Mail delivery: set MAIL_PROVIDER, MAIL_FROM and the provider key on the new installation; invitations and sign-in links use it.',
 'People: operator accounts and sessions are not in the archive. The new owner signs in, invites each person again and sets their role and portfolios (ROLE-001).',
 'Portal people: residents, owners and vendors with portal access are not in the archive. Invite each person again from Data & access (ROLE-002).',
 'Two-step sign-in: authenticators and recovery codes never leave an installation (SAFE-001). Each person sets up a new authenticator; re-enable the requirement if you used it.',
 'Identity provider: link your organisation’s OIDC provider again under Data & access if you used one.',
 'Card payments: provider references and ledger receipts are portable; Stripe credentials and active Checkout links stay in the originating installation. A restore repeats no collection.',
]

export async function readableExport(c: Context) {
 allow(c, 'data.restore')
 const archive = await backup(c), records: any[] = []
 for await (const line of readArchive(archive.body!)) records.push(line)
 const manifest = records[0] as Manifest, closing = records.at(-1) as Closing
 const rows = new Map<string, Record<string, unknown>[]>()
 for (const part of records.filter(r => r.kind === 'part') as Part[]) for (const item of part.items) if (item.kind === 'row') rows.set(item.table, [...(rows.get(item.table) ?? []), item.row])
 const restricted = new Set((rows.get('tt_documents') ?? []).filter(row => row.restriction).map(row => row.id))
 const files: [string, string | Uint8Array][] = [], inventory: Record<string, unknown>[] = []
 for (const table of manifest.tables) {
  const columns = table.columns.map(col => col.name), list = rows.get(table.name) ?? []
  const lines = [columns, ...await Promise.all(list.map(async (row, i) => Promise.all(columns.map(async name => {
   const v = documentExportCell(table.name, row, name, row[name], restricted)
   if (v && typeof v === 'object' && 'blob' in (v as object)) {
    const data = bytes((v as { blob: string }).blob), ext = EXT[String(name==='pdf_bytes'?'application/pdf':name==='photo_bytes'?row.photo_type:row.media_type ?? row.type)] ?? 'bin', path = `files/${table.name}/${row.id ?? i}.${ext}`, digest = await sha256(data)
    files.push([path, data]); inventory.push({ path, table: table.name, column: name, size: data.length, sha256: digest })
    return `file:${path} sha256:${digest}`
   }
   return v === null || v === undefined ? '' : typeof v === 'number' ? v : String(v)
  }))))]
  files.push([`tables/${table.name}.csv`, csv(lines as (string | number)[][])])
 }
 // Chunked media are also exported as one usable original per immutable version.
 for(const row of rows.get('tt_record_media')??[]) if(row.state==='ready') {
  const chunks=(rows.get('tt_record_media_chunks')??[]).filter(p=>p.media_id===row.id).sort((a,b)=>Number(a.position)-Number(b.position))
  const data=new Uint8Array(Number(row.size));let at=0
  for(const chunk of chunks){const b=bytes((chunk.bytes as {blob:string}).blob);data.set(b,at);at+=b.length}
  const digest=await sha256(data)
  if(at!==data.length||digest!==row.sha256)throw Error('A chunked original failed its export checksum.')
  const path=`files/tt_record_media/${row.id}.${EXT[String(row.media_type)]??'bin'}`
  files.push([path,data]);inventory.push({path,table:'tt_record_media',id:row.id,attachmentId:row.attachment_id,version:row.version,size:data.length,sha256:digest})
 }
 const summary = { format: 'terrace-readable-export', version: 1, exportedAt: manifest.exportedAt, sourceIdentity: manifest.sourceIdentity, archiveContentHash: closing.contentHash, tables: manifest.tables.map(t => ({ name: t.name, rows: t.count, columns: t.columns.map(col => col.name), file: `tables/${t.name}.csv` })), files: inventory, excludedTables: manifest.excludedTables, excludedColumns: manifest.excludedColumns, reconnect: RECONNECT }
 const readme = `# Terrace readable export\n\nRestricted document metadata is redacted in this readable copy. Original files keep their exact bytes and checksums; the private backup retains complete custody for restore.\n\nExported ${manifest.exportedAt}. This is a readable copy of the same records as your Terrace backup (.rer), which is the file to restore from.\n\n- tables/<table>.csv: one CSV per table (RFC 4180, UTF-8, header row). Money columns ending _cents are whole cents in the row's currency column; dates are ISO 8601 (YYYY-MM-DD); timestamps are UTC.\n- files/: every stored file as its original bytes. The CSV cell that held it reads file:<path> sha256:<hex>.\n- manifest.json: tables, row counts, columns, file checksums, and tables or columns left out (secrets and platform bookkeeping).\n\n## Reconnect after a restore\n\n${RECONNECT.map(x => `- ${x}`).join('\n')}\n`
 files.unshift(['README.md', readme], ['manifest.json', JSON.stringify(summary, null, 1)])
 return new Response(zip(files), { headers: { 'content-type': 'application/zip', 'content-disposition': 'attachment; filename="terrace-readable-export.zip"', 'cache-control': 'no-store' } })
}
