import type { D1ImportContext, ImportMapping, MappingResult, SourceBundle } from '../modules/import-kit/src/d1/index.ts'
import { all, type Context, type Row } from './core'
import { kitSql } from './imports-target'

// Match only the same address and resident email, ignoring ASCII case and
// surrounding spaces. Do not infer address abbreviations or merge records.
const normalized = (value: string) => value.replace(/^ +| +$/g, '').replace(/[A-Z]/g, ch => ch.toLowerCase())
const identity = (value: Row) => JSON.stringify([normalized(value.address), normalized(value.tenant_email)])
const lastDay = (value: Row): string => value.ended_on && value.ended_on < value.end_date ? value.ended_on : value.end_date
const overlaps = (a: Row, b: Row) => a.start_date <= lastDay(b) && b.start_date <= lastDay(a)

/** Reject strong business-identity duplicates before producing a fingerprint.
 * The kit retains the rejection against its original source ref and location.
 * A stable namespace/ref targets the same row and remains eligible for replay. */
export async function tenancyDuplicateMapping(c: Context, source: SourceBundle, mapping: ImportMapping): Promise<ImportMapping> {
  const mapped = new Map<string, MappingResult>()
  for (const record of source.records) mapped.set(record.sourceId, mapping.map(record))
  const emails = [...new Set([...mapped.values()].flatMap(result => result.effects.map(effect => normalized((effect.value as Row).tenant_email))))]
  const existing = emails.length ? await all(c, `SELECT id,address,tenant_email,start_date,end_date,ended_on FROM tt_tenancies
    WHERE erased_at IS NULL AND custody_retired_at IS NULL
    AND lower(trim(tenant_email)) IN (SELECT value FROM json_each(?)) ORDER BY id`, JSON.stringify(emails)) : []
  const candidates = new Map<string, Row[]>()
  const remember = (row: Row) => {
    const key = identity(row)
    candidates.set(key, [...candidates.get(key) ?? [], row])
  }
  existing.forEach(remember)
  return {
    version: mapping.version,
    map(record) {
      const result = mapped.get(record.sourceId)!
      if (result.rejection || !result.effects.length) return result
      const effect = result.effects[0], value = effect.value as Row
      const match = candidates.get(identity(value))?.find(row => row.id !== effect.targetId && overlaps(value, row))
      if (match) {
        const target = match.sourceRef ? `CSV source ref ${match.sourceRef}` : 'an existing tenancy'
        return { effects: [], rejection: `Source ref ${record.sourceId} matches ${target} at ${match.address}: the resident email is the same and the lease dates overlap. Review the existing record and remove this duplicate CSV row before importing.` }
      }
      remember({ ...value, id: effect.targetId, sourceRef: record.sourceId })
      return result
    },
  }
}

/** Fence the same identity inside each native write, including resumed jobs.
 * This also closes the gap between preview/planning and the atomic apply batch. */
export function guardTenancyImportDuplicates(context: D1ImportContext): D1ImportContext {
  const targets = context.storage.targets
  return {
    ...context,
    storage: {
      ...context.storage,
      targets: {
        ...targets,
        write(row) {
          const value = row.value as Row
          return [kitSql(`INSERT INTO tt_guard(ok) VALUES(CASE WHEN NOT EXISTS(
            SELECT 1 FROM tt_tenancies WHERE id<>? AND erased_at IS NULL AND custody_retired_at IS NULL
            AND lower(trim(address))=lower(trim(?)) AND lower(trim(tenant_email))=lower(trim(?))
            AND start_date<=? AND (CASE WHEN ended_on IS NOT NULL AND ended_on<end_date THEN ended_on ELSE end_date END)>=?
          ) THEN 1 ELSE 0 END)`, row.targetId, value.address, value.tenant_email, value.end_date, value.start_date), ...targets.write(row)]
        },
      },
    },
  }
}
