// WORK-013: make-ready boards. Opening a board for a vacated unit creates the standard dependent tasks. A task
// starts the day after its last dependency ends (the first tasks the day after move-out), plus any delay, and
// runs for its duration in whole days; the planned ready date is the day after the last task ends, and vacancy
// days run from the day after move-out to the ready date. Anyone may submit a task; only an owner or admin checks
// it, and only once its dependencies are checked. A board is published, setting the unit's available date, only
// when every task is checked: available from the later of the planned ready date and the day after the last check.
import { all, cents, commit, date, guard, id, insist, manager, one, sql, text, type Context, type Row } from './core'
import { localDate } from './zones'

const DAY = 86400000
const shift = (d: string, n: number) => new Date(Date.parse(d + 'T00:00:00Z') + n * DAY).toISOString().slice(0, 10)
const span = (a: string, b: string) => Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / DAY)
// kind, title, duration, dependencies (by kind)
const STANDARD: [string, string, number, string[]][] = [
 ['inspection', 'Move-out inspection', 1, []], ['utility', 'Transfer utilities to the owner', 1, []],
 ['deposit', 'Prepare the deposit disposition', 2, ['inspection']], ['repair', 'Repairs found at inspection', 3, ['inspection']],
 ['cleaning', 'Make-ready cleaning', 1, ['repair']], ['listing', 'Prepare the listing', 1, ['cleaning']],
]

/** Planned start and end of each task, the ready date and vacancy days. */
export function plan(board: Row, tasks: Row[]) {
 const ends = new Map<string, string>(), out: Row[] = []
 for (const t of [...tasks].sort((a, b) => a.position - b.position)) {
  const deps: string[] = JSON.parse(t.depends_on), after = deps.map(d => ends.get(d)!).reduce((m, d) => d > m ? d : m, board.move_out)
  const start = shift(after, 1 + t.delay_days), end = shift(start, t.duration_days - 1)
  ends.set(t.id, end)
  const blockedBy = deps.filter(d => tasks.find(x => x.id === d)?.state !== 'checked')
  out.push({ ...t, start, end, blockedBy })
 }
 const ready = shift(out.reduce((m, t) => t.end > m ? t.end : m, board.move_out), 1)
 return { tasks: out, readyDate: ready, vacancyDays: span(shift(board.move_out, 1), ready) }
}

async function task(c: Context, v: unknown) {
 const row = await one(c, 'SELECT t.*,b.state AS board_state,b.unit_id FROM tt_turnover_tasks t JOIN tt_turnovers b ON b.id=t.turnover_id WHERE t.id=?', text(v, 'Task', 100))
 insist(row, 'not_found', 'Task not found.', 404)
 insist(row.board_state === 'open', 'board_published', 'This board is published.', 409)
 return row
}

export async function turnoverCommand(c: Context, command: string, p: Row): Promise<Row | undefined> {
 if (command === 'turnover.open') {
  manager(c)
  const unit = await one(c, 'SELECT id FROM tt_units WHERE id=?', text(p.unitId, 'Unit', 100))
  insist(unit, 'not_found', 'Unit not found.', 404)
  const moveOut = date(p.moveOut, 'Move-out date'), key = id(), ids = new Map(STANDARD.map(([kind]) => [kind, id()]))
  // The unit must be vacant the day after the move-out.
  insist(!(await one(c, 'SELECT 1 FROM tt_tenancies WHERE unit_id=? AND start_date<=? AND COALESCE(ended_on,end_date)>=?', unit.id, shift(moveOut, 1), shift(moveOut, 1))), 'unit_occupied', 'A lease occupies this unit the day after that move-out date.', 409)
  await commit(c, [
   sql(c, 'INSERT INTO tt_turnovers(id,unit_id,move_out,created_by,created_at) VALUES(?,?,?,?,?)', key, unit.id, moveOut, c.actor.id, c.now),
   sql(c, 'UPDATE tt_units SET available_on=NULL,version=version+1 WHERE id=?', unit.id),
   ...STANDARD.map(([kind, title, days, deps], i) => sql(c, "INSERT INTO tt_turnover_tasks(id,turnover_id,kind,title,assignee,duration_days,depends_on,position) VALUES(?,?,?,?,'Unassigned',?,?,?)", ids.get(kind), key, kind, title, days, JSON.stringify(deps.map(d => ids.get(d))), i)),
  ], command, key)
  return { id: key, notice: 'Make-ready board opened with its standard tasks.' }
 }
 if (command === 'turnover.task.update') {
  manager(c)
  const row = await task(c, p.taskId), duration = Number(p.durationDays ?? row.duration_days), delay = Number(p.delayDays ?? row.delay_days)
  insist(Number.isInteger(duration) && duration >= 1 && duration <= 60, 'invalid_task', 'Duration is 1 to 60 days.')
  insist(Number.isInteger(delay) && delay >= 0 && delay <= 120, 'invalid_task', 'Delay is 0 to 120 days.')
  insist(row.state !== 'checked', 'task_checked', 'A checked task is not changed.', 409)
  await commit(c, [guard(c, 'EXISTS(SELECT 1 FROM tt_turnover_tasks WHERE id=? AND version=?)', row.id, row.version), sql(c, 'UPDATE tt_turnover_tasks SET assignee=?,duration_days=?,delay_days=?,quote_cents=?,version=version+1 WHERE id=?', p.assignee ? text(p.assignee, 'Assignee', 150) : row.assignee, duration, delay, p.quote ? cents(p.quote) : row.quote_cents, row.id)], command, row.id)
  return { id: row.id, notice: 'Task updated; the planned dates are recalculated.' }
 }
 if (command === 'turnover.task.submit') {
  const row = await task(c, p.taskId)
  insist(row.state === 'open', 'task_state', 'This task is already submitted.', 409)
  await commit(c, [sql(c, "UPDATE tt_turnover_tasks SET state='submitted',submitted_by=?,submitted_at=?,version=version+1 WHERE id=? AND state='open'", c.actor.id, c.now, row.id)], command, row.id)
  return { id: row.id, notice: 'Task submitted for an owner or admin to check.' }
 }
 if (command === 'turnover.task.check') {
  manager(c)
  const row = await task(c, p.taskId), deps: string[] = JSON.parse(row.depends_on)
  insist(row.state === 'submitted', 'task_state', 'Only a submitted task can be checked.', 409)
  await commit(c, [
   ...deps.map(d => guard(c, "EXISTS(SELECT 1 FROM tt_turnover_tasks WHERE id=? AND state='checked')", d)),
   sql(c, "UPDATE tt_turnover_tasks SET state='checked',checked_by=?,checked_at=?,version=version+1 WHERE id=? AND state='submitted'", c.actor.id, c.now, row.id),
  ], command, row.id).catch(e => { if (e?.code === 'conflict') e.message = 'Check the tasks this one depends on first.'; throw e })
  return { id: row.id, notice: 'Task checked.' }
 }
 if (command === 'turnover.publish') {
  manager(c)
  const board = await one(c, 'SELECT b.*,p.time_zone FROM tt_turnovers b JOIN tt_units u ON u.id=b.unit_id JOIN tt_properties p ON p.id=u.property_id WHERE b.id=?', text(p.turnoverId, 'Board', 100))
  insist(board && board.state === 'open', 'not_found', 'Open board not found.', 404)
  const tasks = await all(c, 'SELECT * FROM tt_turnover_tasks WHERE turnover_id=?', board.id)
  insist(tasks.every(t => t.state === 'checked'), 'not_ready', 'Every task must be checked before the unit is ready.', 409)
  const planned = plan(board, tasks).readyDate, checked = shift(localDate(tasks.map(t => t.checked_at).sort().at(-1)!, board.time_zone), 1), available = planned > checked ? planned : checked
  await commit(c, [
   guard(c, "NOT EXISTS(SELECT 1 FROM tt_turnover_tasks WHERE turnover_id=? AND state<>'checked')", board.id),
   sql(c, "UPDATE tt_turnovers SET state='ready',available_on=?,published_by=?,published_at=? WHERE id=? AND state='open'", available, c.actor.id, c.now, board.id),
   sql(c, 'UPDATE tt_units SET available_on=?,version=version+1 WHERE id=?', available, board.unit_id),
  ], command, board.id)
  return { id: board.id, availableOn: available, notice: `Unit ready: available from ${available}.` }
 }
}

export async function turnoverData(c: Context) {
 const [boards, tasks] = await Promise.all([all(c, 'SELECT * FROM tt_turnovers ORDER BY created_at DESC'), all(c, 'SELECT * FROM tt_turnover_tasks ORDER BY position')])
 return boards.map(b => ({ ...b, ...plan(b, tasks.filter(t => t.turnover_id === b.id)) }))
}
