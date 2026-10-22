// SAFE-005. A human-readable copy of the complete installation archive: one CSV per archived table (the same tables,
// columns and secret exclusions the .rer backup and restore use), every stored file (inspection photographs) as its
// original bytes with its SHA-256, a manifest, and a README naming what must be reconnected after a restore. It is
// built from the backup archive itself, so whatever a restore brings back, this copy shows.
import { readArchive, type Manifest, type Part, type Closing } from '../modules/portability/index.mjs'
import { allow, sha256, type Context } from './core'
import { backup } from './data'
import { csv, zip } from './exports'

const EXT: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'application/pdf': 'pdf', 'video/mp4': 'mp4', 'video/quicktime': 'mov', 'video/webm': 'webm', 'text/plain': 'txt', 'text/csv': 'csv', 'message/rfc822': 'eml' }
const bytes = (b64: string) => Uint8Array.from(atob(b64), ch => ch.charCodeAt(0))

export const RECONNECT = [
 'Mail delivery: set MAIL_PROVIDER, MAIL_FROM and the provider key on the new installation; invitations and sign-in links use it.',
 'People: operator accounts and sessions are not in the archive. The new owner signs in, invites each person again and sets their role and portfolios (ROLE-001).',
 'Portal people: residents, owners and vendors with portal access are not in the archive. Invite each person again from Data & access (ROLE-002).',
 'Two-step sign-in: authenticators and recovery codes never leave an installation (SAFE-001). Each person sets up a new authenticator; re-enable the requirement if you used it.',
 'Identity provider: link your organisation’s OIDC provider again under Data & access if you used one.',
 'Money: Terrace moves no money and holds no bank or payment-provider credentials, so a restore repeats no payment.',
]

export async function readableExport(c: Context) {
 allow(c, 'data.restore')
 const archive = await backup(c), records: any[] = []
 for await (const line of readArchive(archive.body!)) records.push(line)
 const manifest = records[0] as Manifest, closing = records.at(-1) as Closing
 const rows = new Map<string, Record<string, unknown>[]>()
 for (const part of records.filter(r => r.kind === 'part') as Part[]) for (const item of part.items) if (item.kind === 'row') rows.set(item.table, [...(rows.get(item.table) ?? []), item.row])
 const files: [string, string | Uint8Array][] = [], inventory: Record<string, unknown>[] = []
 for (const table of manifest.tables) {
  const columns = table.columns.map(col => col.name), list = rows.get(table.name) ?? []
  const lines = [columns, ...await Promise.all(list.map(async (row, i) => Promise.all(columns.map(async name => {
   const v = row[name] as unknown
   if (v && typeof v === 'object' && 'blob' in (v as object)) {
    const data = bytes((v as { blob: string }).blob), ext = EXT[String(row.media_type ?? row.type)] ?? 'bin', path = `files/${table.name}/${row.id ?? i}.${ext}`, digest = await sha256(data)
    files.push([path, data]); inventory.push({ path, table: table.name, column: name, size: data.length, sha256: digest })
    return `file:${path} sha256:${digest}`
   }
   return v === null || v === undefined ? '' : typeof v === 'number' ? v : String(v)
  }))))]
  files.push([`tables/${table.name}.csv`, csv(lines as (string | number)[][])])
 }
 const summary = { format: 'terrace-readable-export', version: 1, exportedAt: manifest.exportedAt, sourceIdentity: manifest.sourceIdentity, archiveContentHash: closing.contentHash, tables: manifest.tables.map(t => ({ name: t.name, rows: t.count, columns: t.columns.map(col => col.name), file: `tables/${t.name}.csv` })), files: inventory, excludedTables: manifest.excludedTables, excludedColumns: manifest.excludedColumns, reconnect: RECONNECT }
 const readme = `# Terrace readable export\n\nExported ${manifest.exportedAt}. This is a readable copy of the same records as your Terrace backup (.rer), which is the file to restore from.\n\n- tables/<table>.csv: one CSV per table (RFC 4180, UTF-8, header row). Money columns ending _cents are whole cents in the row's currency column; dates are ISO 8601 (YYYY-MM-DD); timestamps are UTC.\n- files/: every stored file as its original bytes. The CSV cell that held it reads file:<path> sha256:<hex>.\n- manifest.json: tables, row counts, columns, file checksums, and tables or columns left out (secrets and platform bookkeeping).\n\n## Reconnect after a restore\n\n${RECONNECT.map(x => `- ${x}`).join('\n')}\n`
 files.unshift(['README.md', readme], ['manifest.json', JSON.stringify(summary, null, 1)])
 return new Response(zip(files), { headers: { 'content-type': 'application/zip', 'content-disposition': 'attachment; filename="terrace-readable-export.zip"', 'cache-control': 'no-store' } })
}
