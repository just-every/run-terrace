import { sha256 } from '../modules/import-kit/src/d1/index.ts'
import type { D1Database as KitDatabase, D1ImportContext, D1Sql, D1TargetAdapter, TargetRow } from '../modules/import-kit/src/d1/index.ts'
import { Context } from './core'
import { relatedTenancy } from './imports-dependencies'
import { IMPORT_DESTINATION, IMPORT_VERSION, TENANCY_KIND } from './imports-source'

export const kitSql = (sql: string, ...params: unknown[]): D1Sql => ({ sql, params })
const fields = ['address','owner_name','owner_email','tenant_name','tenant_email','start_date','end_date','rent_cents','cadence','created_at','version','currency','time_zone'] as const
const related = relatedTenancy
const relatedMarker = '|related-work'
const nativeMarker='|native-edit'
const nativeEdit=(alias:string)=>`(${['unit_id','ended_on','end_reason','transferred_from','erased_at'].map(k=>`${alias}.${k} IS NOT NULL`).join(' OR ')} OR ${alias}.currency_confirmed<>1)`
const toTarget = (r: Record<string,any>): TargetRow => ({
  destination: IMPORT_DESTINATION, targetKind: TENANCY_KIND, targetId: r.id,
  revision: (r.import_revision ?? '') + (r.related_work ? relatedMarker : '') + (['unit_id','ended_on','end_reason','transferred_from','erased_at'].some(k=>r[k]!=null)||r.currency_confirmed===0?nativeMarker:''),
  value: Object.fromEntries(fields.map(field => [field,r[field]])),
})

/** A tenancy is a complete native row. Import does not write rent ledger,
 * inspection or maintenance rows. Their later presence blocks reversal, as does
 * every native field edit, including an edit that did not increment version. */
export const tenancyTargets: D1TargetAdapter = {
  ownedContent(row) { return {revision:row.revision.replace(relatedMarker,''),value:row.value,attachment:row.attachment??null} },
  async read(db, destination, kind, id) {
    if (destination !== IMPORT_DESTINATION || kind !== TENANCY_KIND) return undefined
    const row = await db.prepare(`SELECT t.*, (${related('t.id')}) AS related_work FROM tt_tenancies t WHERE t.id=? AND t.custody_retired_at IS NULL`).bind(id).first()
    return row ? toTarget(row) : undefined
  },
  matches(row, destination, kind, id) {
    if (destination !== IMPORT_DESTINATION || kind !== TENANCY_KIND) return kitSql('0')
    if (!row) return kitSql('NOT EXISTS(SELECT 1 FROM tt_tenancies WHERE id=? AND custody_retired_at IS NULL)', id)
    const value = row.value as Record<string,any>, hasRelated = row.revision.includes(relatedMarker), hasNative = row.revision.includes(nativeMarker)
    const revision = row.revision.replace(relatedMarker,'').replace(nativeMarker,'')
    // Journals written before PORT-001 hold no currency or time_zone; those match on the fields they hold.
    const held = fields.filter(field => field in value)
    return kitSql(`EXISTS(SELECT 1 FROM tt_tenancies t WHERE t.id=? AND t.custody_retired_at IS NULL AND ${held.map(field => `t.${field} IS ?`).join(' AND ')} AND t.import_revision IS ? AND (${related('t.id')})=? AND ${nativeEdit('t')}=?)`, id, ...held.map(field => value[field]), revision || null, hasRelated ? 1 : 0, hasNative?1:0)
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
      kitSql(`INSERT INTO tt_guard(ok) VALUES(CASE WHEN NOT EXISTS(SELECT 1 FROM tt_tenancies t WHERE t.id=? AND t.custody_retired_at IS NULL AND (${related('t.id')})) THEN 1 ELSE 0 END)`, id),
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
export function tenancyImportContext(c: Context, namespace: string, extra: Partial<Pick<D1ImportContext,'reviewedFingerprint'|'operationKey'|'reversalPolicy'>> = {}): D1ImportContext {
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
