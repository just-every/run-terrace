// WORK-002: asset register, warranty and replacement history. A repair is linked to the asset it is for;
// its approved estimate is attributed to the warranty when the job's due date is on or before the warranty
// end, otherwise to the property owner. Terrace flags coverage; it does not file or confirm a warranty claim.
import { all, cents, commit, date, guard, id, insist, manager, one, sql, tenancy, text, type Context, type Row } from './core'

const optional = (v: unknown, label: string, max = 300) => v === undefined || v === null || String(v).trim() === '' ? null : text(v, label, max)
function details(p: Row) {
 const installed = date(p.installedDate, 'Installed date'), provider = optional(p.warrantyProvider, 'Warranty provider', 150), ends = p.warrantyEnds ? date(p.warrantyEnds, 'Warranty end') : null
 insist(!provider === !ends, 'warranty', 'Enter both the warranty provider and its end date, or neither.')
 insist(!ends || ends >= installed, 'warranty', 'The warranty must end on or after the installed date.')
 const replaceBy = p.replaceBy ? date(p.replaceBy, 'Planned replacement date') : null
 insist(!replaceBy || replaceBy > installed, 'replace_by', 'The planned replacement must follow the installed date.')
 return [text(p.kind, 'Equipment', 100), text(p.location, 'Location', 150), text(p.make, 'Make', 100), text(p.model, 'Model', 100), text(p.serial, 'Serial number', 100), installed, provider, ends, optional(p.manual, 'Manual (link or where it is kept)', 500), replaceBy, p.replacementCost ? cents(p.replacementCost) : null]
}
const insert = (c: Context, key: string, t: Row, values: unknown[], replaces: string | null) => sql(c, 'INSERT INTO tt_assets(id,tenancy_id,kind,location,make,model,serial,installed_date,warranty_provider,warranty_ends,manual,replace_by,replacement_cents,currency,replaces,created_by,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)', key, t.id, ...values, t.currency, replaces, c.actor.id, c.now)

export async function assetCommand(c: Context, command: string, p: Row): Promise<Row | undefined> {
 if (command === 'asset.add') {
  manager(c)
  const t = await tenancy(c, p.tenancyId), key = id()
  await commit(c, [insert(c, key, t, details(p), null)], command, key)
  return { id: key, tenancyId: t.id, notice: 'Asset recorded.' }
 }
 if (command === 'asset.replace') {
  manager(c)
  const old = await one(c, 'SELECT * FROM tt_assets WHERE id=?', text(p.assetId, 'Asset', 100))
  insist(old, 'not_found', 'Asset not found.', 404)
  insist(old.state === 'in_service', 'asset_state', 'This asset has already been replaced.', 409)
  const t = await tenancy(c, old.tenancy_id), key = id(), values = details(p), replaced = values[5] as string
  insist(replaced >= old.installed_date, 'replace_date', 'The replacement must be installed on or after the old asset.')
  await commit(c, [
   guard(c, "EXISTS(SELECT 1 FROM tt_assets WHERE id=? AND version=? AND state='in_service')", old.id, old.version),
   insert(c, key, t, values, old.id),
   sql(c, "UPDATE tt_assets SET state='replaced',replaced_by=?,replaced_date=?,version=version+1 WHERE id=?", key, replaced, old.id),
  ], command, key)
  return { id: key, tenancyId: t.id, replaced: old.id, notice: 'Replacement recorded. The old asset and its service history are kept.' }
 }
}

/** An in-service asset of this tenancy, for linking a repair request. */
export async function serviceableAsset(c: Context, tenancyId: string, v: unknown) {
 if (v === undefined || v === null || v === '') return null
 const row = await one(c, 'SELECT * FROM tt_assets WHERE id=? AND tenancy_id=?', text(v, 'Asset', 100), tenancyId)
 insist(row, 'not_found', 'Asset not found for this tenancy.', 404)
 insist(row.state === 'in_service', 'asset_state', 'This asset has been replaced. Link the repair to its replacement.', 409)
 return row
}

export async function assetData(c: Context, t: Row) {
 const [assets, jobs] = await Promise.all([
  all(c, 'SELECT * FROM tt_assets WHERE tenancy_id=? ORDER BY kind,installed_date', t.id),
  all(c, 'SELECT id,asset_id,title,trade_name,due_date,estimate_cents,currency,state FROM tt_maintenance_jobs WHERE tenancy_id=? AND asset_id IS NOT NULL ORDER BY due_date', t.id),
 ])
 return assets.map(a => {
  const history: Row[] = jobs.filter(j => j.asset_id === a.id).map(j => {
   const covered = !!a.warranty_ends && j.due_date >= a.installed_date && j.due_date <= a.warranty_ends
   return { ...j, attribution: covered ? 'warranty' : 'owner', payer: covered ? a.warranty_provider : t.owner_name }
  })
  // Costs are approved estimates (a pending job is not yet a cost); WORK-009 adds matched invoices.
  const approved = history.filter(j => j.state !== 'pending')
  return { ...a, history, ownerCostCents: approved.filter(j => j.attribution === 'owner').reduce((s, j) => s + j.estimate_cents, 0), warrantyCostCents: approved.filter(j => j.attribution === 'warranty').reduce((s, j) => s + j.estimate_cents, 0) }
 })
}
