import { Fault, type Row } from './core'
import { AuthError } from '../modules/operator-auth/index.mjs'
import { PortabilityError } from '../modules/portability/index.mjs'

export const withheld = '[Restricted metadata]'
/** Display copies only. Original bytes and the owner backup remain complete custody records. */
export function redactSensitive(value: unknown): string {
 return String(value ?? '')
  .replace(/\b(?:\d{3}[ -]?\d{2}[ -]?\d{4}|\d{2}[ -]?\d{7})\b/g, '[Redacted identifier]')
  .replace(/\b(?:\d[ -]?){12,18}\d\b/g, '[Redacted number]')
  .replace(/\b((?:tin|ssn|pan|tax[ -]?id|identity[ -]?(?:number|id)|api[ _-]?key|access[ _-]?token|secret|password)\s*[:=]\s*)[^\s,;<>"']+/gi, '$1[Redacted]')
}

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

/** Unexpected exceptions are never reflected or logged with their messages, stack or attached report. */
export function publicFailure(error: unknown, pendingCredentialCommand = false) {
 if (error instanceof Fault) return { status: error.status, code: error.code, message: redactSensitive(error.message), ...((error as Fault & { report?: Row }).report ? { report: (error as Fault & { report: Row }).report } : {}) }
 if (error instanceof AuthError) return { status: error.status, code: error.code, message: 'The account operation was refused. Confirm your current access and try again.' }
 if (error instanceof PortabilityError) return { status: error.status, code: error.code, message: 'The archive operation was refused. Review its configuration and custody requirements.' }
 if (error instanceof Error && error.message.includes('UNIQUE constraint')) return { status: 409, code: 'duplicate', message: 'That reference already exists. Use the existing record or a distinct reference.' }
 // Claimed credential attempts keep their refusal status and pending key; no error details escape.
 return { status: pendingCredentialCommand ? 400 : 500, code: 'operation_failed', message: 'The operation could not complete. Try again or contact the installation owner.' }
}
