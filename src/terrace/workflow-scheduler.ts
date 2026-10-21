// OPS-003 hourly Cron and Run now use the same atomic sweep. No session, outbound contact, reply,
// evidence, resumption or closure is available to the unattended actor.
import { all, audit, authority, guard, one, sql, type Context, type Row } from './core'
import { loadStaff } from './roles'
import { officeZone } from './company'
import { latestTemplates } from './workflow-spec'
import { workflowSweepPlan } from './workflows'
import { schedulePlan } from './schedules'
import type { Bindings } from '../auth.server'

async function configurer(db: D1Database, now: string, person: string): Promise<Context | null> {
 const actor = await db.prepare("SELECT id,role,version,display_name AS displayName FROM oa_operators o WHERE id=? AND status='active' AND (role='owner' OR EXISTS(SELECT 1 FROM tt_staff_roles r WHERE r.operator_id=o.id AND r.role='portfolio_manager' AND r.all_portfolios=1))").bind(person).first<Context['actor']>()
 if (!actor) return null
 const c: Context = { db, actor, now, scheduler: true }
 await loadStaff(c); c.zone = await officeZone(c)
 return c
}
const receipt = (row: Row, replayed = false) => ({ id: row.id, ...JSON.parse(row.detail), replayed, tab: 'workflows', notice: `Sweep: ${JSON.parse(row.detail).started.length} started, ${JSON.parse(row.detail).escalated.length} escalated, ${JSON.parse(row.detail).ordersCreated} maintenance orders. Nothing was sent.` })

export async function workflowTick(db: D1Database, now: string, tickId: string, requester?: Context): Promise<Row> {
 // A conflicting distinct tick or person transition may win while this plan is read. Re-read only that race;
 // no partial tick has committed and no external work has happened.
 for (let retry = 0; ; retry++) {
  const prior = await db.prepare('SELECT * FROM tt_workflow_ticks WHERE id=?').bind(tickId).first<Row>()
  if (prior) return receipt(prior, true)
  const base: Context = { db, actor: { id: 'scheduler:workflows', role: 'member', displayName: 'Workflow scheduler' }, now }
  const templates = await latestTemplates(base), running = await all(base, "SELECT r.*,t.created_by AS configurer FROM tt_workflow_runs r JOIN tt_workflow_templates t ON t.id=r.template_id WHERE r.state='running' ORDER BY r.id")
  const writes: D1PreparedStatement[] = requester ? [authority(requester, 'workflow.sweep'), guard(requester, "EXISTS(SELECT 1 FROM oa_operators o WHERE id=? AND status='active' AND (role='owner' OR EXISTS(SELECT 1 FROM tt_staff_roles r WHERE r.operator_id=o.id AND r.role='portfolio_manager' AND r.all_portfolios=1)))", requester.actor.id)] : [], detail: Row = { started: [], escalated: [], paused: [], skipped: [], ordersCreated: 0 }
  for (const person of new Set([...templates.filter(t => !t.retired_at).map(t => t.created_by), ...running.map(r => r.configurer)])) {
   const mine = templates.filter(t => !t.retired_at && t.created_by === person), runs = running.filter(r => r.configurer === person), c = await configurer(db, now, person)
   if (!c) {
    for (const t of mine) detail.skipped.push({ templateId: t.id, name: t.name, reason: 'needs a configurer: the configuring person is no longer the owner or an every-portfolio manager' })
    continue
   }
   const plan = await workflowSweepPlan(c, mine, runs)
   // Fence inside the same transaction, even if no run matched this person's template.
   writes.push(authority(c, 'workflow.template'), ...plan.writes)
   for (const k of ['started', 'escalated', 'skipped']) detail[k].push(...plan.touched[k])
  }
  // WORK-010 orders remain pending for a person to approve. The active installation owner authorizes
  // this scheduler, while scheduler:workflows is their preparer and the attributed audit actor.
  const owner = await one(base, "SELECT id FROM oa_operators WHERE role='owner' AND status='active' ORDER BY id LIMIT 1")
  const ownerContext = owner && await configurer(db, now, owner.id)
  if (ownerContext) {
   const orders = await schedulePlan(ownerContext)
   writes.push(authority(ownerContext, 'schedule.run'), ...orders.writes)
   detail.ordersCreated = orders.created
   writes.push(audit(ownerContext, 'workflow.sweep', tickId))
  }
  const row = { id: tickId, detail: JSON.stringify(detail) }
  try {
   await db.batch([sql(base, 'INSERT INTO tt_workflow_ticks(id,at,requested_by,actor,detail) VALUES(?,?,?,?,?)', tickId, now, requester?.actor.id ?? null, 'scheduler:workflows', row.detail), ...writes])
   return receipt(row)
  } catch (error) {
   if (retry >= 2 || !/UNIQUE constraint|CHECK constraint/.test(String(error))) throw error
  }
 }
}

export async function workflowScheduled(controller: ScheduledController, env: Bindings) {
 const now = new Date(controller.scheduledTime).toISOString()
 await workflowTick(env.DB, now, 'cron:' + now)
}
