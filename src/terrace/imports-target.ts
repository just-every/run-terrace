import { sha256 } from '../modules/import-kit/src/d1/index.ts'
import type { D1Database as KitDatabase, D1ImportContext, D1Sql, D1TargetAdapter, TargetRow } from '../modules/import-kit/src/d1/index.ts'
import { Context } from './core'
import { IMPORT_DESTINATION, IMPORT_VERSION, TENANCY_KIND } from './imports-source'

export const kitSql = (sql: string, ...params: unknown[]): D1Sql => ({ sql, params })
const fields = ['address','owner_name','owner_email','tenant_name','tenant_email','start_date','end_date','rent_cents','cadence','created_at','version','currency','time_zone'] as const
const children = ['tt_charges','tt_proposals','tt_lease_history','tt_inspections','tt_maintenance_jobs','tt_assets']
const related = (column: string) => children.map(table => `EXISTS(SELECT 1 FROM ${table} WHERE tenancy_id=${column})`).join(' OR ')
const relatedMarker = '|related-work'
const toTarget = (r: Record<string,any>): TargetRow => ({
  destination: IMPORT_DESTINATION, targetKind: TENANCY_KIND, targetId: r.id,
  revision: (r.import_revision ?? '') + (r.related_work ? relatedMarker : ''),
  value: Object.fromEntries(fields.map(field => [field,r[field]])),
})

/** A tenancy is a complete native row. Import does not write rent ledger,
 * inspection or maintenance rows. Their later presence blocks reversal, as does
 * every native field edit, including an edit that did not increment version. */
export const tenancyTargets: D1TargetAdapter = {
  async read(db, destination, kind, id) {
    if (destination !== IMPORT_DESTINATION || kind !== TENANCY_KIND) return undefined
    const row = await db.prepare(`SELECT t.*, (${related('t.id')}) AS related_work FROM tt_tenancies t WHERE t.id=?`).bind(id).first()
    return row ? toTarget(row) : undefined
  },
  matches(row, destination, kind, id) {
    if (destination !== IMPORT_DESTINATION || kind !== TENANCY_KIND) return kitSql('0')
    if (!row) return kitSql('NOT EXISTS(SELECT 1 FROM tt_tenancies WHERE id=?)', id)
    const value = row.value as Record<string,any>, hasRelated = row.revision.endsWith(relatedMarker)
    const revision = hasRelated ? row.revision.slice(0,-relatedMarker.length) : row.revision
    // Journals written before PORT-001 hold no currency or time_zone; those match on the fields they hold.
    const held = fields.filter(field => field in value)
    return kitSql(`EXISTS(SELECT 1 FROM tt_tenancies t WHERE t.id=? AND ${held.map(field => `t.${field} IS ?`).join(' AND ')} AND t.import_revision IS ? AND (${related('t.id')})=?)`, id, ...held.map(field => value[field]), revision || null, hasRelated ? 1 : 0)
  },
  matchesCount(count) { return kitSql('(SELECT count(*) FROM tt_tenancies WHERE import_revision IS NOT NULL)=?', count) },
  write(row) {
    const value = row.value as Record<string,any>
    return [
      kitSql("INSERT INTO tt_guard(ok) VALUES(CASE WHEN NOT EXISTS(SELECT 1 FROM tt_erasures WHERE subject=?) THEN 1 ELSE 0 END)", sha256(value.tenant_email)),
      kitSql(`INSERT INTO tt_tenancies(id,${fields.join(',')},import_revision) VALUES(${Array(fields.length+2).fill('?').join(',')})`, row.targetId, ...fields.map(field => value[field]), row.revision),
    ]
  },
  remove(_destination, _kind, id) {
    return [
      kitSql(`INSERT INTO tt_guard(ok) VALUES(CASE WHEN NOT EXISTS(SELECT 1 FROM tt_tenancies t WHERE t.id=? AND (${related('t.id')})) THEN 1 ELSE 0 END)`, id),
      kitSql('DELETE FROM tt_tenancies WHERE id=?', id),
    ]
  },
  async list(db) {
    const { results } = await db.prepare(`SELECT t.*, (${related('t.id')}) AS related_work FROM tt_tenancies t WHERE import_revision IS NOT NULL ORDER BY id`).all()
    return results.map(toTarget)
  },
}

/** Role custody survives an installation restore. Authority always checks the
 * acting operator's durable row and session generation again inside D1. */
export function tenancyImportContext(c: Context, namespace: string, extra: Partial<Pick<D1ImportContext,'reviewedFingerprint'|'operationKey'>> = {}): D1ImportContext {
  return {
    destination: IMPORT_DESTINATION, namespace, mappingVersion: IMPORT_VERSION, batchSize: 1, maxBatches: 10,
    storage: { database: c.db as unknown as KitDatabase, targets: tenancyTargets },
    authorization: {
      principalId: 'role:owner',
      predicate: (_action,destination) => kitSql("?=? AND EXISTS(SELECT 1 FROM oa_operators WHERE id=? AND status='active' AND role='owner' AND version=?)", destination, IMPORT_DESTINATION, c.actor.id, c.actor.version ?? 1),
    },
    ...extra,
  }
}
