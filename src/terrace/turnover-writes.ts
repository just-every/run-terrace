// PORT-006 / WORK-013: shared make-ready writes, composed atomically with the lease transition.
import { guard, id, one, sql, type Context, type Row } from './core'
import { occupiedFollowup } from './move-followups'
const nextDay = (d: string) => new Date(Date.parse(d + 'T00:00:00Z') + 86400000).toISOString().slice(0, 10)
// kind, title, duration, dependencies (by kind)
const STANDARD: [string, string, number, string[]][] = [
 ['inspection', 'Move-out inspection', 1, []], ['utility', 'Transfer utilities to the owner', 1, []],
 ['deposit', 'Prepare the deposit disposition', 2, ['inspection']], ['repair', 'Repairs found at inspection', 3, ['inspection']],
 ['cleaning', 'Make-ready cleaning', 1, ['repair']], ['listing', 'Prepare the listing', 1, ['cleaning']],
]


export function turnoverWrites(c: Context, unitId: string, moveOut: string, key: string, source = '') {
 const ids = new Map(STANDARD.map(([kind]) => [kind, id()]))
 return [
  guard(c, 'NOT EXISTS(SELECT 1 FROM tt_tenancies WHERE unit_id=? AND id<>? AND start_date<=? AND COALESCE(ended_on,end_date)>=?)', unitId, source, nextDay(moveOut), nextDay(moveOut)),
  sql(c, 'INSERT INTO tt_turnovers(id,unit_id,move_out,created_by,created_at) VALUES(?,?,?,?,?)', key, unitId, moveOut, c.actor.id, c.now),
  sql(c, 'UPDATE tt_units SET available_on=NULL,version=version+1 WHERE id=?', unitId),
  ...STANDARD.map(([kind, title, days, deps], i) => sql(c, "INSERT INTO tt_turnover_tasks(id,turnover_id,kind,title,assignee,duration_days,depends_on,position) VALUES(?,?,?,?,'Unassigned',?,?,?)", ids.get(kind), key, kind, title, days, JSON.stringify(deps.map(d => ids.get(d))), i)),
 ]
}

/** Existing WORK-013 vacancy prerequisite applies; a successor occupancy retains an atomic staff follow-up. */
export async function moveOutTurnover(c: Context, t: Row, moveOut: string) {
 if (!t.unit_id) return { statements: [], turnoverId: null, outcome: 'unit_not_linked', notice: 'No unit is linked; no make-ready board was opened.' }
 const occupied = await one(c, 'SELECT * FROM tt_tenancies WHERE unit_id=? AND id<>? AND start_date<=? AND COALESCE(ended_on,end_date)>=?', t.unit_id, t.id, nextDay(moveOut), nextDay(moveOut))
 if (occupied) {
  const followup=await occupiedFollowup(c,t,moveOut,occupied)
  return { ...followup, turnoverId: null, outcome: 'successor_occupied', notice: 'Staff follow-up saved on Properties: another lease occupies the unit the day after move-out. No vacancy board or work was authorized.' }
 }
 const existing = await one(c, 'SELECT id FROM tt_turnovers WHERE unit_id=? AND move_out=?', t.unit_id, moveOut)
 if (existing) return { statements: [guard(c, 'EXISTS(SELECT 1 FROM tt_turnovers WHERE id=?)', existing.id)], turnoverId: existing.id, outcome: 'existing', notice: 'The existing make-ready board is linked on Properties.' }
 const key = id()
 return { statements: turnoverWrites(c, t.unit_id, moveOut, key, t.id), turnoverId: key, outcome: 'opened', notice: 'Make-ready board and dependent tasks opened on Properties. Deposit disposition remains a review task, not a refund.' }
}
