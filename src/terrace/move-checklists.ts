// PORT-006: dated, sourced operational evidence, kept separately for each lease and direction.
import { all, allow, commit, date, guard, id, insist, sql, tenancy, text, type Context, type Row } from './core'
export const MOVE_ITEMS = [
 ['keys', 'Keys'], ['meters', 'Meters and readings'], ['condition', 'Condition'],
 ['possession', 'Possession'], ['forwarding', 'Forwarding address'],
] as const
export const MOVE_STATES = [['pending', 'Pending'], ['recorded', 'Recorded by staff'], ['not_applicable', 'Not applicable — reason recorded']] as const
export async function moveChecklistData(c: Context, tenancyId: string) {
 const t = await tenancy(c, tenancyId)
 return (await all(c, 'SELECT * FROM tt_move_checklists WHERE tenancy_id=? ORDER BY version DESC,kind', t.id)).map(row => {
  const items = JSON.parse(row.items), needsReview = row.kind === 'move_in' ? row.move_date !== t.start_date : !!t.ended_on && row.move_date !== t.ended_on
  return { ...row, items, needsReview, complete: !needsReview && MOVE_ITEMS.every(([key]) => items[key].state !== 'pending') }
 })
}
export async function moveChecklistCommand(c: Context, command: string, p: Row): Promise<Row | undefined> {
 if (command !== 'move.checklist') return
 allow(c, command)
 const t = await tenancy(c, p.tenancyId), day = date(p.moveDate, 'Handover date'), version = Number(p.version), leaseVersion = Number(p.leaseVersion)
 insist(['move_in', 'move_out'].includes(p.kind), 'checklist_kind', 'Choose a move-in or move-out checklist.')
 insist(['string','number'].includes(typeof p.version) && /^(0|[1-9]\d*)$/.test(String(p.version)) && Number.isSafeInteger(version) && version >= 0, 'checklist_version', 'Include the checklist revision you reviewed (0 for a new checklist).')
 insist(['string','number'].includes(typeof p.leaseVersion) && /^[1-9]\d*$/.test(String(p.leaseVersion)) && Number.isSafeInteger(leaseVersion) && leaseVersion > 0, 'lease_version', 'Include the lease version you reviewed.')
 insist(leaseVersion === t.version, 'lease_changed', 'The lease changed. Reload and review the handover again.', 409)
 insist(day >= t.start_date && day <= t.end_date && (p.kind !== 'move_in' || day === t.start_date), 'handover_date', 'Move-in uses the lease start date; move-out falls within the lease.')
 insist(p.kind !== 'move_out' || !t.ended_on || day === t.ended_on, 'handover_changed', 'Use the recorded move-out day. Reload and review the handover.', 409)
 const items: Row = {}
 for (const [key, label] of MOVE_ITEMS) {
  const state = p[key + 'State']
  insist(MOVE_STATES.some(([v]) => v === state), 'checklist_state', `Choose a status for ${label.toLowerCase()}.`)
  const notes = state === 'pending' && !p[key + 'Notes'] ? '' : text(p[key + 'Notes'], label + ' details or reason', 1000)
  items[key] = { state, notes }
 }
 const reference = text(p.reference, 'Handover source reference', 500), key = id()
 await commit(c, [
  guard(c, 'EXISTS(SELECT 1 FROM tt_tenancies WHERE id=? AND version=? AND erased_at IS NULL)', t.id, leaseVersion),
  guard(c, 'COALESCE((SELECT MAX(version) FROM tt_move_checklists WHERE tenancy_id=? AND kind=?),0)=?', t.id, p.kind, version),
  sql(c, 'INSERT INTO tt_move_checklists(id,tenancy_id,kind,move_date,version,items,reference,recorded_by,recorded_at) VALUES(?,?,?,?,?,?,?,?,?)', key, t.id, p.kind, day, version + 1, JSON.stringify(items), reference, c.actor.id, c.now),
  sql(c, 'UPDATE tt_tenancies SET version=version+1 WHERE id=?', t.id),
 ], command, key)
 const complete = MOVE_ITEMS.every(([item]) => items[item].state !== 'pending')
 return { id: key, tenancyId: t.id, version: version + 1, complete, notice: 'Handover checklist recorded. Earlier revisions are kept. Financial reconciliation and deposit disposition remain separate.' }
}
