import { type Row } from './core'
import { redactSensitive } from './sensitive-metadata'

export const withheld = '[Restricted metadata]'
/** Display copies only. Original bytes and the owner backup remain complete custody records. */
export function documentMetadata(row: Row) {
 return { ...row, title: redactSensitive(row.title), name: redactSensitive(row.name), source: row.restricted ? withheld : redactSensitive(row.source), snippet: row.restricted ? null : row.snippet == null ? null : redactSensitive(row.snippet) }
}

/** Readable metadata is safe to inspect separately from the deliberately included private originals. */
export function documentExportCell(table: string, row: Row, column: string, value: unknown, restricted: Set<unknown>) {
 if (table === 'tt_documents' && ['title'].includes(column)) return row.restriction ? withheld : redactSensitive(value)
 if (table === 'tt_document_versions' && ['name', 'note', 'content_text', 'scan'].includes(column)) return restricted.has(row.document_id) ? withheld : redactSensitive(value)
 if (table === 'tt_audit' && String(row.action).startsWith('document.') && column === 'source') return restricted.has(row.subject) ? withheld : redactSensitive(value)
 return value
}
