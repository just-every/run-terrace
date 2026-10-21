// OPS-003: persistent workflow runs. Every run lives in D1 with its template version, current step, due day, attempts and
// durable next action, so a restart loses nothing. A run completes only through recorded completion evidence on its
// last step. It pauses (a person must review and resume it) when the authority it started under, its assignee or its
// subject has changed, or when a contact attempt's result is uncertain; it escalates to a named person when a step is
// overdue, the run's contact limit is used up without a reply, or a reply needs a person. The workflow engine sends nothing itself:
// attempts and replies are recorded by staff, and an escalation is closed only by a person.
import { all, allow, can, commit, date, everywhere, Fault, guard, id, insist, one, reaches, reachesPortfolio, sql, text, type Context, type Row } from './core'
import { localDate } from './zones'
import { CHANNELS, GATES, KIND_ACTION, KINDS, latestTemplates, nameable, nameableIn, OUTCOMES, parseTemplate, REPLIES } from './workflow-spec'
import { matching, standing, type Subject } from './workflow-subjects'

export const WORKFLOW_COMMANDS = ['workflow.template', 'workflow.retire', 'workflow.start', 'workflow.sweep', 'workflow.step', 'workflow.attempt', 'workflow.reply', 'workflow.resume', 'workflow.resolve', 'workflow.cancel']
const LIVE = ['running', 'paused', 'escalated']
export const PAUSES: Record<string, string> = {
 authority_changed: 'the person who started or last resumed it no longer holds the authority it ran under',
 assignee_unavailable: 'its assignee is no longer an active person who may work it',
 subject_changed: 'the record it runs on changed underneath it',
 subject_resolved: 'the record it runs on has already reached its outcome',
 subject_missing: 'the record it runs on is gone',
 uncertain_result: 'a contact attempt’s result is not known',
}
export const ESCALATIONS: Record<string, string> = {
 overdue: 'a step is past its due day', contact_limit: 'the contact limit is used up without an agreed reply', reply_needs_review: 'a reply needs a person’s judgment',
}
const RECORDED = 'recorded by staff; Terrace contacted no one'
const addDays = (day: string, n: number) => new Date(Date.parse(day + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10)
export const parsed = (t: Row): Row => ({ ...t, trigger: JSON.parse(t.trigger), conditions: JSON.parse(t.conditions), steps: JSON.parse(t.steps) })

export const workflowEvent = (c: Context, run: Row, kind: string, step: number, detail: Row, reference: string, label: string) =>
 sql(c, 'INSERT INTO tt_workflow_events(id,run_id,tenancy_id,sequence,kind,step_index,detail,reference,label,recorded_by,recorded_at) VALUES(?,?,?,(SELECT COALESCE(MAX(sequence),0)+1 FROM tt_workflow_events WHERE run_id=?),?,?,?,?,?,?,?)', id(), run.id, run.tenancy_id, run.id, kind, step, JSON.stringify(detail), reference, label, c.scheduler ? 'scheduler:workflows' : c.actor.id, c.now)
export const workflowFence = (c: Context, run: Row) => guard(c, 'EXISTS(SELECT 1 FROM tt_workflow_runs WHERE id=? AND version=? AND state=?)', run.id, run.version, run.state)
export const workflowUpdate = (c: Context, run: Row, set: Row) => sql(c, `UPDATE tt_workflow_runs SET ${[...Object.keys(set).map(k => k + '=?'), 'version=version+1'].join(',')} WHERE id=?`, ...Object.values(set), run.id)
const OPEN = { pause_reason: null, escalation_reason: null, escalated_to: null }

/** The durable sentence a person reads for what happens next on a running step. */
function next(tpl: Row, i: number, due: string, contacts: number, awaiting: boolean) {
 const s = tpl.steps[i]
 if (s.kind === 'task') return `Do “${s.title}” and record its evidence by ${due}.`
 if (s.kind === 'gate') return `Waiting until ${GATES[tpl.kind][1]} (“${s.title}”), due ${due}.`
 return awaiting ? `Awaiting a reply to “${s.title}” (contact ${contacts} of ${tpl.contact_limit}), due ${due}. Record the reply when it arrives.`
  : `Contact for “${s.title}”: attempt ${contacts + 1} of ${tpl.contact_limit}, due ${due}. Contact them outside Terrace, then record the attempt and its outcome.`
}
export const settle = (tpl: Row, run: Row, over: Row = {}) => {
 const r = { ...run, ...over }
 return { ...OPEN, state: 'running', next_action: next(tpl, r.step_index, r.step_due_on, r.contacts, !!r.awaiting), ...over }
}
/** Moves to the next step, or completes when the last step's evidence has just been recorded. */
function advance(tpl: Row, run: Row, today: string, c: Context) {
 const i = run.step_index + 1
 if (i >= tpl.steps.length) return { ...OPEN, state: 'completed', ended_at: c.now, next_action: null, awaiting: 0 }
 const s = tpl.steps[i], due = addDays(today, s.dueDays)
 return settle(tpl, run, { step_index: i, step_started_on: today, step_due_on: due, assignee: s.assignee, awaiting: 0 })
}
async function evidence(c: Context, run: Row, now: Row[]) {
 const done = (await all(c, "SELECT step_index,detail,reference,recorded_at FROM tt_workflow_events WHERE run_id=? AND kind='step_done' ORDER BY sequence", run.id)).map(e => ({ step: e.step_index, title: JSON.parse(e.detail).title, reference: e.reference, at: e.recorded_at }))
 return [...done, ...now]
}

async function load(c: Context, value: unknown) {
 const run = await one(c, 'SELECT * FROM tt_workflow_runs WHERE id=?', text(value, 'Workflow run', 100))
 insist(run && (run.portfolio_id ? reachesPortfolio(c, run.portfolio_id) : reaches(c, run.unit_id)), 'not_found', 'Workflow run not found.', 404)
 c.tenancyId ??= run.tenancy_id ?? undefined
 return { run, tpl: parsed((await one(c, 'SELECT * FROM tt_workflow_templates WHERE id=?', run.template_id))!) }
}
const assignable = (c: Context, who: string, run: Row, tpl: Row) => one(c, `SELECT 1 FROM oa_operators o WHERE o.id=? AND ${nameableIn([KIND_ACTION[tpl.kind], 'workflow.step'])}`, who, run.portfolio_id, run.portfolio_id)
const authorityOk = (c: Context, run: Row) => one(c, "SELECT 1 FROM oa_operators o WHERE o.id=? AND o.status='active' AND ((?='owner' AND o.role='owner') OR EXISTS(SELECT 1 FROM tt_staff_roles r WHERE r.operator_id=o.id AND r.role=? AND r.version=?))", run.authority_operator, run.authority_role, run.authority_role, run.authority_version)
/** Why a running step cannot safely go on, or null. */
async function stale(c: Context, run: Row, tpl: Row): Promise<string | null> {
 if (!await authorityOk(c, run)) return 'authority_changed'
 if (run.assignee && !await assignable(c, run.assignee, run, tpl)) return 'assignee_unavailable'
 return (await standing(c, run, tpl.steps[run.step_index].gate)).reason
}
/** The person an escalation goes to: the template's contact while still eligible for this portfolio, otherwise the owner. */
async function escalatee(c: Context, run: Row, tpl: Row) {
 if (await one(c, `SELECT 1 FROM oa_operators o WHERE o.id=? AND ${nameableIn(['workflow.resolve'])}`, tpl.escalate_to, run.portfolio_id, run.portfolio_id)) return { to: tpl.escalate_to as string, fallback: false }
 const owner = await one(c, "SELECT id FROM oa_operators WHERE role='owner' AND status='active' ORDER BY id LIMIT 1")
 insist(owner, 'no_escalation', 'No active owner can take an escalation.', 409)
 return { to: owner.id as string, fallback: true }
}
export async function escalation(c: Context, run: Row, tpl: Row, reason: string, over: Row = {}, label = 'escalated to a person; Terrace takes no further step') {
 const who = await escalatee(c, run, tpl)
 return [workflowUpdate(c, run, { ...over, state: 'escalated', pause_reason: null, escalation_reason: reason, escalated_to: who.to, next_action: `Escalated because ${ESCALATIONS[reason]}. A person decides what happens next; Terrace takes no further step.` }),
  workflowEvent(c, run, 'escalated', run.step_index, { reason, to: who.to, fallbackToOwner: who.fallback, step: tpl.steps[run.step_index].title }, `Step ${run.step_index + 1} of ${tpl.steps.length}`, label)]
}
export const pauseStatements = (c: Context, run: Row, tpl: Row, reason: string, over: Row = {}, label = 'paused until a person reviews it') => [
 workflowUpdate(c, run, { next_action: `Paused because ${PAUSES[reason]}. A manager reviews it, then resumes or cancels it.`, ...over, state: 'paused', pause_reason: reason, escalation_reason: null, escalated_to: null }),
 workflowEvent(c, run, 'paused', run.step_index, { reason }, `Step ${run.step_index + 1} of ${tpl.steps.length}`, label)]
async function pauseThenRefuse(c: Context, run: Row, tpl: Row, reason: string, command: string): Promise<never> {
 await commit(c, [workflowFence(c, run), ...pauseStatements(c, run, tpl, reason)], command, run.id)
 throw new Fault('workflow_paused', `Paused: ${PAUSES[reason]}. Nothing was recorded. A manager reviews it, then resumes or cancels it.`, 409)
}
/** The common gate for step, attempt and reply: version seen, run live, not paused, and still safe to act on. */
async function ready(c: Context, run: Row, tpl: Row, p: Row, command: string, escalatedOk = false) {
 insist(Number.isInteger(Number(p.version)) && Number(p.version) === run.version, 'conflict', 'Reload the current workflow run.', 409)
 insist(LIVE.includes(run.state), 'workflow_closed', 'This workflow run has ended.', 409)
 insist(run.state !== 'paused', 'workflow_paused', `Paused: ${PAUSES[run.pause_reason]}. A manager reviews it, then resumes or cancels it.`, 409)
 if (run.state === 'escalated') { insist(escalatedOk, 'workflow_escalated', 'This run is escalated to a person; Terrace takes no further step.', 409); return }
 insist(!await one(c, 'SELECT 1 FROM tt_workflow_sends WHERE run_id=? AND results IS NULL', run.id), 'workflow_send_pending', 'An email send has no confirmed outcome. Review its source record before working this run.', 409)
 const reason = await stale(c, run, tpl)
 if (reason) await pauseThenRefuse(c, run, tpl, reason, command)
}
function workedBy(c: Context, run: Row) {
 if (run.state === 'escalated') return allow(c, 'workflow.resolve')
 if (run.assignee && run.assignee !== c.actor.id) insist(can(c, 'workflow.resume'), 'not_assignee', 'This step is assigned to someone else; a manager may record it.', 403)
}
const ref = (p: Row, label = 'Evidence reference') => text(p.reference, label, 500)

async function startStatements(c: Context, tpl: Row, s: Subject, reference: string) {
 const today = localDate(c.now, s.zone), first = tpl.steps[0], key = id()
 const run = { id: key, tenancy_id: s.tenancyId }
 if (first.assignee) insist(await one(c, `SELECT 1 FROM oa_operators o WHERE o.id=? AND ${nameableIn([KIND_ACTION[tpl.kind], 'workflow.step'])}`, first.assignee, s.portfolioId, s.portfolioId), 'not_eligible', 'The first step’s assignee cannot work this record.', 409)
 await escalatee(c, { portfolio_id: s.portfolioId }, tpl)
 const due = addDays(today, first.dueDays), staff = c.actor.staff
 return { key, statements: [
  sql(c, "INSERT INTO tt_workflow_runs(id,template_id,template_key,kind,subject_kind,subject_id,tenancy_id,unit_id,portfolio_id,label,zone,state,step_index,step_started_on,step_due_on,assignee,contacts,awaiting,next_action,authority_operator,authority_role,authority_version,started_by,started_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,'running',0,?,?,?,0,0,?,?,?,?,?,?)",
   key, tpl.id, tpl.template_key, tpl.kind, s.kind, s.id, s.tenancyId, s.unitId, s.portfolioId, s.label, s.zone, today, due, first.assignee,
   next(tpl, 0, due, 0, false), c.actor.id, staff?.role ?? c.actor.role, staff?.version ?? 1, c.scheduler ? 'scheduler:workflows' : c.actor.id, c.now),
  workflowEvent(c, run, 'started', 0, { template: tpl.name, templateVersion: tpl.version, subject: s.label, steps: tpl.steps.length, contactLimit: tpl.contact_limit }, reference, c.scheduler ? 'started by scheduler:workflows for ' + c.actor.id + '; nothing was sent' : 'started by a person; nothing was sent'),
 ] }
}
const liveTemplate = async (c: Context, key: unknown) => {
 const t = await one(c, 'SELECT * FROM tt_workflow_templates WHERE template_key=? ORDER BY version DESC LIMIT 1', text(key, 'Template', 100))
 insist(t, 'not_found', 'Template not found.', 404)
 return t
}

export async function workflowCommand(c: Context, command: string, p: Row): Promise<Row | undefined> {
 if (!WORKFLOW_COMMANDS.includes(command)) return
 allow(c, command)
 if (command === 'workflow.template') {
  everywhere(c)
  const key = p.templateKey ? text(p.templateKey, 'Template', 100) : null, seen = Number(p.version ?? 0)
  const last = key ? await one(c, 'SELECT version,retired_at FROM tt_workflow_templates WHERE template_key=? ORDER BY version DESC LIMIT 1', key) : null
  insist(key ? last : true, 'not_found', 'Template not found.', 404)
  insist(Number.isInteger(seen) && seen === (last?.version ?? 0), 'conflict', 'Reload the current template version.', 409)
  insist(!last?.retired_at, 'template_retired', 'A retired template is not changed; create a new one.', 409)
  const t = await parseTemplate(c, p), reference = ref(p, 'Why this template'), row = id(), at = key ?? id()
  c.source = reference
  await commit(c, [guard(c, 'COALESCE((SELECT MAX(version) FROM tt_workflow_templates WHERE template_key=?),0)=?', at, seen),
   sql(c, 'INSERT INTO tt_workflow_templates(id,template_key,version,name,kind,trigger,conditions,steps,contact_limit,escalate_to,reference,created_by,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)', row, at, seen + 1, t.name, t.kind, JSON.stringify(t.trigger), JSON.stringify(t.conditions), JSON.stringify(t.steps), t.contactLimit, t.escalateTo, reference, c.actor.id, c.now)], command, at)
  return { id: row, templateKey: at, version: seen + 1, tab: 'workflows', notice: 'Workflow template saved. Runs already started keep the version they began under.' }
 }
 if (command === 'workflow.retire') {
  everywhere(c)
  const t = await liveTemplate(c, p.templateKey)
  insist(Number(p.version) === t.version, 'conflict', 'Reload the current template version.', 409)
  insist(!t.retired_at, 'template_retired', 'This template is already retired.', 409)
  c.source = text(p.reason, 'Reason', 500)
  await commit(c, [guard(c, 'EXISTS(SELECT 1 FROM tt_workflow_templates WHERE id=? AND retired_at IS NULL)', t.id), sql(c, 'UPDATE tt_workflow_templates SET retired_at=?,retired_by=? WHERE id=?', c.now, c.actor.id, t.id)], command, t.template_key)
  return { templateKey: t.template_key, tab: 'workflows', notice: 'Template retired. Runs already started continue; nothing new starts from it.' }
 }
 if (command === 'workflow.start') {
  const t = parsed(await liveTemplate(c, p.templateKey))
  insist(!t.retired_at, 'template_retired', 'This template is retired.', 409)
  allow(c, KIND_ACTION[t.kind])
  const reference = ref(p, 'Why it starts now'), s = (await matching(c, t, text(p.subjectId, 'Subject', 100)))[0]
  insist(s, 'trigger_not_met', 'That record does not match this template’s trigger and conditions, or is outside your portfolios.', 409)
  insist(!await one(c, "SELECT 1 FROM tt_workflow_runs WHERE template_key=? AND subject_kind=? AND subject_id=? AND state IN ('running','paused','escalated')", t.template_key, s.kind, s.id), 'workflow_running', 'This workflow is already running on that record.', 409)
  c.source = reference; c.tenancyId = s.tenancyId ?? undefined
  const made = await startStatements(c, t, s, reference)
  await commit(c, made.statements, command, made.key)
  return { id: made.key, tenancyId: s.tenancyId ?? undefined, tab: 'workflows', nextAction: next(t, 0, addDays(localDate(c.now, s.zone), t.steps[0].dueDays), 0, false), notice: 'Workflow started. Terrace sent nothing; the first step waits for a person.' }
 }
 if (command === 'workflow.sweep') {
  everywhere(c); insist(c.actor.role === 'owner' || c.actor.staff?.role === 'portfolio_manager', 'forbidden', 'Only the owner or an every-portfolio manager runs the sweep.', 403)
  const { workflowTick } = await import('./workflow-scheduler')
  return workflowTick(c.db, c.now, 'manual:' + id(), c)
 }
 const { run, tpl } = await load(c, p.runId), step = tpl.steps[run.step_index], today = localDate(c.now, run.zone)
 if (command === 'workflow.cancel') {
  insist(Number(p.version) === run.version && LIVE.includes(run.state), 'conflict', 'Reload the current workflow run.', 409)
  c.source = text(p.reason, 'Reason', 500)
  await commit(c, [workflowFence(c, run), workflowUpdate(c, run, { ...OPEN, state: 'cancelled', ended_at: c.now, next_action: null, awaiting: 0 }), workflowEvent(c, run, 'cancelled', run.step_index, {}, c.source, 'cancelled by a person; the steps were not completed')], command, run.id)
  return { id: run.id, state: 'cancelled', tab: 'workflows', notice: 'Workflow cancelled. It is not recorded as completed.' }
 }
 if (command === 'workflow.resolve') {
  insist(Number(p.version) === run.version && run.state === 'escalated', 'conflict', 'Only an escalated run you have reloaded can be closed this way.', 409)
  c.source = ref(p, 'What the person did')
  await commit(c, [workflowFence(c, run), workflowUpdate(c, run, { ...OPEN, state: 'closed', ended_at: c.now, next_action: null, awaiting: 0 }), workflowEvent(c, run, 'escalation_resolved', run.step_index, { resolution: 'closed_by_person', reason: run.escalation_reason }, c.source, 'closed by a person; the remaining steps were not completed')], command, run.id)
  return { id: run.id, state: 'closed', tab: 'workflows', notice: 'Escalation closed by a person. The run is closed, not completed.' }
 }
 if (command === 'workflow.resume') {
  const pending = await all(c, 'SELECT send_id,send_state FROM tt_workflow_sends WHERE run_id=? AND results IS NULL', run.id)
  insist(Number(p.version) === run.version && (run.state === 'paused' || (run.state === 'running' && pending.length)), 'conflict', 'Reload a paused run or a run with an unconfirmed send before reviewing it.', 409)
  c.source = ref(p, 'What you reviewed')
  const staff = c.actor.staff, snapshot = { authority_operator: c.actor.id, authority_role: staff?.role ?? c.actor.role, authority_version: staff?.version ?? 1 }
  if (pending.length) {
   const resolution = String(p.resolution ?? '')
   insist(['delivered','not_delivered'].includes(resolution), 'resolution', 'Confirm whether every pending recipient was delivered or not delivered, from the source record.')
   const count = pending.filter(s => s.send_state === 'running').length, contacts = run.contacts + count
   const over = { ...snapshot, contacts, awaiting: resolution === 'delivered' ? 1 : 0 }
   const writes = resolution === 'not_delivered' && contacts >= tpl.contact_limit ? await escalation(c, run, tpl, 'contact_limit', over) : [workflowUpdate(c, run, settle(tpl, run, over))]
   await commit(c, [workflowFence(c, run), ...pending.flatMap(s => [
    guard(c, 'EXISTS(SELECT 1 FROM tt_workflow_sends WHERE run_id=? AND send_id=? AND results IS NULL)', run.id, s.send_id),
    sql(c, 'UPDATE tt_workflow_sends SET results=? WHERE run_id=? AND send_id=?', JSON.stringify([{ eventId: s.send_id, staffResolution: resolution, reference: c.source }]), run.id, s.send_id),
    workflowEvent(c, run, 'attempt', run.step_index, { channel: 'email', outcome: 'uncertain', counted: s.send_state === 'running', pendingSend: s.send_id }, s.send_id, 'interrupted send; result reconciled by staff, not a provider answer'),
    workflowEvent(c, run, 'reconciled', run.step_index, { pendingSend: s.send_id, resolution }, c.source!, 'result confirmed by a person from the source record')]), ...writes,
    workflowEvent(c, run, 'resumed', run.step_index, { pendingSends: pending.map(s => s.send_id) }, c.source, 'pending sends reviewed by a person')], command, run.id)
   return { id: run.id, tab: 'workflows', notice: 'Pending sends reconciled. An unconfirmed attempt used its reserved contact slot; no message was repeated.' }
  }
  if (run.pause_reason === 'uncertain_result') {
   const resolution = String(p.resolution ?? ''); insist(['delivered', 'not_delivered'].includes(resolution), 'resolution', 'Say whether the uncertain attempt was delivered or not delivered.')
   const attempt = (await all(c, "SELECT sequence FROM tt_workflow_events WHERE run_id=? AND kind='attempt' AND json_extract(detail,'$.counted') IS NOT 0 ORDER BY sequence DESC LIMIT 1", run.id))[0]
   const over = { ...snapshot, awaiting: resolution === 'delivered' ? 1 : 0 }, spent = run.contacts >= tpl.contact_limit && resolution === 'not_delivered'
   const writes = spent ? await escalation(c, run, tpl, 'contact_limit', over) : [workflowUpdate(c, run, settle(tpl, run, over))]
   await commit(c, [workflowFence(c, run), workflowEvent(c, run, 'reconciled', run.step_index, { attemptSequence: attempt?.sequence, resolution }, c.source, 'result confirmed by a person'), ...writes, workflowEvent(c, run, 'resumed', run.step_index, { reason: run.pause_reason }, c.source, 'resumed by a person')], command, run.id)
   return { id: run.id, state: spent ? 'escalated' : 'running', tab: 'workflows', notice: spent ? 'Result recorded; the contact limit is used up, so the run escalated to a person.' : 'Result recorded and the run resumed.' }
  }
  let assignee = run.assignee
  if (p.assignee) { assignee = text(p.assignee, 'Assignee', 100); insist(await assignable(c, assignee, run, tpl), 'not_eligible', 'Choose an active person who may work this kind of record.', 409) }
  const still = await stale(c, { ...run, ...snapshot, assignee }, tpl)
  insist(!still, 'still_stale', `Still paused: ${PAUSES[still!]}. Fix that first, or cancel the run.`, 409)
  await commit(c, [workflowFence(c, run), workflowUpdate(c, run, settle(tpl, run, { ...snapshot, assignee })), workflowEvent(c, run, 'resumed', run.step_index, { reason: run.pause_reason, assignee }, c.source, 'resumed by a person after review')], command, run.id)
  return { id: run.id, state: 'running', tab: 'workflows', notice: 'Workflow resumed under your authority.' }
 }
 allow(c, KIND_ACTION[tpl.kind])
 await ready(c, run, tpl, p, command, command === 'workflow.reply')
 workedBy(c, run)
 if (command === 'workflow.step') {
  insist(step.kind !== 'contact', 'contact_step', 'A contact step finishes with an agreed reply: record the attempt and the reply.', 409)
  const reference = ref(p), note = p.note ? text(p.note, 'Note', 1000) : null
  if (step.kind === 'gate') insist((await standing(c, run, step.gate)).goal, 'gate_open', `Not yet: this step waits until ${GATES[tpl.kind][1]}.`, 409)
  const set = advance(tpl, run, today, c), done = [{ step: run.step_index, title: step.title, reference, at: c.now }]
  c.source = reference
  await commit(c, [workflowFence(c, run), workflowUpdate(c, run, set), workflowEvent(c, run, 'step_done', run.step_index, { title: step.title, kind: step.kind, ...(step.gate ? { gate: step.gate, confirmed: true } : {}), note }, reference, step.kind === 'gate' ? 'confirmed against the record Terrace holds' : RECORDED),
   ...(set.state === 'completed' ? [workflowEvent(c, run, 'completed', run.step_index, { evidence: await evidence(c, run, done) }, reference, 'every step has recorded evidence')] : [])], command, run.id)
  return { id: run.id, state: set.state, nextAction: set.next_action, tab: 'workflows', notice: set.state === 'completed' ? 'Last step recorded: workflow completed with its evidence.' : 'Step recorded.' }
 }
 if (command === 'workflow.attempt') {
  insist(step.kind === 'contact', 'not_contact_step', 'The current step is not a contact step.', 409)
  const channel = String(p.channel ?? ''), outcome = String(p.outcome ?? '')
  insist(CHANNELS.includes(channel), 'invalid_input', 'Choose email, phone, text, letter or in person.')
  insist(OUTCOMES.some(o => o[0] === outcome), 'invalid_input', 'The outcome is reached, no answer, refused or uncertain.')
  const reference = ref(p, 'External reference (message id, call note or letter reference)')
  c.source = reference
  if (run.contacts >= tpl.contact_limit) {
   await commit(c, [workflowFence(c, run), ...await escalation(c, run, tpl, 'contact_limit')], command, run.id)
   throw new Fault('contact_limit', `Contact limit reached (${tpl.contact_limit}). Nothing was recorded or sent; the run escalated to a person.`, 409)
  }
  if (run.subject_kind === 'prospect') {
   const consent = JSON.parse((await one(c, 'SELECT consent FROM tt_prospects WHERE id=?', run.subject_id))?.consent ?? '{}')
   insist(consent[channel]?.state !== 'refused', 'consent_refused', 'This prospect refused contact by that channel (LEASE-005). Nothing was recorded.', 409)
  }
  const n = run.contacts + 1, detail = { channel, outcome, attempt: n, limit: tpl.contact_limit, note: p.note ? text(p.note, 'Note', 1000) : null }
  const over = { contacts: n, awaiting: outcome === 'reached' ? 1 : 0 }
  const writes = outcome === 'uncertain' ? pauseStatements(c, run, tpl, 'uncertain_result', { ...over, next_action: `Paused: reconcile contact attempt ${n}. Confirm whether it was delivered, then resume with that result. Do not repeat it until you know.` })
   : outcome !== 'reached' && n >= tpl.contact_limit ? await escalation(c, run, tpl, 'contact_limit', over)
   : [workflowUpdate(c, run, settle(tpl, run, over))]
  await commit(c, [workflowFence(c, run), workflowEvent(c, run, 'attempt', run.step_index, detail, reference, RECORDED), ...writes], command, run.id)
  const after = (await one(c, 'SELECT state,next_action FROM tt_workflow_runs WHERE id=?', run.id))!
  return { id: run.id, attempt: n, state: after.state, nextAction: after.next_action, tab: 'workflows', notice: `Attempt ${n} of ${tpl.contact_limit} recorded. Terrace contacted no one.` }
 }
 // workflow.reply
 insist(step.kind === 'contact' && run.contacts > 0, 'no_contact', 'A reply answers a recorded contact attempt on a contact step.', 409)
 const outcome = String(p.outcome ?? ''); insist(REPLIES.some(r => r[0] === outcome), 'invalid_input', 'The reply is agreed, declined or unclear.')
 const on = date(p.on, 'Received on'); insist(on <= today, 'invalid_date', 'Record what already happened: the date cannot be in the future.')
 const reference = ref(p, 'Where the reply is kept'), note = p.note ? text(p.note, 'Note', 2000) : null
 c.source = reference
 const replied = workflowEvent(c, run, 'reply', run.step_index, { outcome, on, note }, reference, RECORDED)
 if (outcome === 'agreed') {
  const set = advance(tpl, run, today, c), done = [{ step: run.step_index, title: step.title, reference, at: c.now }]
  await commit(c, [workflowFence(c, run), replied, ...(run.state === 'escalated' ? [workflowEvent(c, run, 'escalation_resolved', run.step_index, { resolution: 'reply_received', reason: run.escalation_reason }, reference, 'a person recorded the reply and the run continues')] : []), workflowUpdate(c, run, set),
   workflowEvent(c, run, 'step_done', run.step_index, { title: step.title, kind: 'contact', reply: outcome }, reference, RECORDED),
   ...(set.state === 'completed' ? [workflowEvent(c, run, 'completed', run.step_index, { evidence: await evidence(c, run, done) }, reference, 'every step has recorded evidence')] : [])], command, run.id)
  return { id: run.id, state: set.state, nextAction: set.next_action, tab: 'workflows', notice: set.state === 'completed' ? 'Reply recorded: workflow completed with its evidence.' : 'Reply recorded; the next step is ready.' }
 }
 await commit(c, [workflowFence(c, run), replied, ...(run.state === 'escalated' ? [workflowUpdate(c, run, {})] : await escalation(c, run, tpl, 'reply_needs_review', { awaiting: 0 }))], command, run.id)
 return { id: run.id, state: 'escalated', tab: 'workflows', notice: 'Reply recorded. It needs a person’s judgment, so the run is escalated.' }
}

/** The shared sweep planner. A tick may start runs and escalate overdue steps; it never records a person's work or pauses/resumes a run. */
export async function workflowSweepPlan(c: Context, templates: Row[], runs: Row[]) {
 const writes: D1PreparedStatement[] = [], touched: Row = { paused: [], escalated: [], started: [], skipped: [] }
 for (const run of runs) {
  const tpl = parsed((await one(c, 'SELECT * FROM tt_workflow_templates WHERE id=?', run.template_id))!), today = localDate(c.now, run.zone)
  if (await stale(c, run, tpl)) continue
  if (today > run.step_due_on) {
   const spent = tpl.steps[run.step_index].kind === 'contact' && run.contacts >= tpl.contact_limit
   writes.push(workflowFence(c, run), ...await escalation(c, run, tpl, spent ? 'contact_limit' : 'overdue', {}, 'escalated by scheduler:workflows; Terrace takes no further step')); touched.escalated.push(run.id)
  }
 }
 for (const t of templates.filter(x => !x.retired_at && can(c, KIND_ACTION[x.kind]))) {
  for (const s of await matching(c, t)) {
   const ran = await one(c, 'SELECT 1 FROM tt_workflow_runs WHERE template_key=? AND subject_kind=? AND subject_id=?', t.template_key, s.kind, s.id)
   if (ran) continue
   try {
    const made = await startStatements(c, t, s, 'trigger: ' + JSON.stringify(t.trigger))
    writes.push(guard(c, 'EXISTS(SELECT 1 FROM tt_workflow_templates WHERE id=? AND retired_at IS NULL AND version=(SELECT MAX(version) FROM tt_workflow_templates WHERE template_key=?))', t.id, t.template_key), ...made.statements)
    touched.started.push(made.key)
   } catch (e) { if (!(e instanceof Fault)) throw e; touched.skipped.push({ templateId: t.id, name: t.name, reason: e.message }) }
  }
 }
 return { writes, touched }
}

const STATE_ORDER: Record<string, number> = { escalated: 0, paused: 1, running: 2, completed: 3, closed: 4, cancelled: 5 }
/** Templates, and runs in the actor's scope with their sequenced history, due state and durable next action. */
export async function workflowData(c: Context) {
 allow(c, 'workflow.read')
 const [templates, runs, events, people, assignees, pending] = await Promise.all([latestTemplates(c),
  all(c, 'SELECT r.*,t.name AS template_name,t.version AS template_version,t.contact_limit,t.steps FROM tt_workflow_runs r JOIN tt_workflow_templates t ON t.id=r.template_id ORDER BY r.started_at DESC,r.id'),
  all(c, 'SELECT * FROM tt_workflow_events ORDER BY run_id,sequence'),
  all(c, `SELECT o.id,o.display_name AS name FROM oa_operators o WHERE ${nameable(['workflow.resolve'])} ORDER BY o.display_name`),
  all(c, `SELECT o.id,o.display_name AS name FROM oa_operators o WHERE ${nameable(['workflow.step'])} ORDER BY o.display_name`), all(c, 'SELECT run_id,send_id FROM tt_workflow_sends WHERE results IS NULL')])
 const mine = runs.filter(r => (r.portfolio_id ? reachesPortfolio(c, r.portfolio_id) : reaches(c, r.unit_id)))
 const shaped: Row[] = mine.map((r): Row => {
  const steps = JSON.parse(r.steps), today = localDate(c.now, r.zone), history = events.filter(e => e.run_id === r.id).map(e => ({ ...e, detail: JSON.parse(e.detail) }))
  return { ...r, pendingSends: pending.filter(p => p.run_id === r.id).map(p => p.send_id), steps: undefined, stepCount: steps.length, step: LIVE.includes(r.state) ? steps[r.step_index] : null, overdue: r.state === 'running' && today > r.step_due_on, events: history,
   pauseText: r.pause_reason ? PAUSES[r.pause_reason] : null, escalationText: r.escalation_reason ? ESCALATIONS[r.escalation_reason] : null }
 }).sort((a, b) => STATE_ORDER[a.state] - STATE_ORDER[b.state] || a.step_due_on.localeCompare(b.step_due_on) || a.id.localeCompare(b.id))
 const start = can(c, 'workflow.start'), ready: Row[] = []
 if (start) for (const t of templates.filter(x => !x.retired_at && can(c, KIND_ACTION[x.kind]))) {
  const live = new Set(shaped.filter(r => r.template_key === t.template_key && LIVE.includes(r.state)).map(r => r.subject_id))
  ready.push({ templateKey: t.template_key, subjects: (await matching(c, t)).filter(s => !live.has(s.id)).map(s => ({ id: s.id, label: s.label })) })
 }
 const ticks = c.actor.role === 'owner' || (c.actor.staff?.role === 'portfolio_manager' && c.actor.staff.all) ? await all(c, 'SELECT * FROM tt_workflow_ticks ORDER BY at DESC,id DESC LIMIT 20') : []
 return { maySweep: c.actor.role === 'owner' || (c.actor.staff?.role === 'portfolio_manager' && c.actor.staff.all), ticks: ticks.map(t => ({ ...t, detail: JSON.parse(t.detail) })), kinds: KINDS.map(([k, label]) => ({ kind: k, label, gate: GATES[k][1] })), templates, runs: shaped, ready, escalationPeople: people, assignees, contactChannels: CHANNELS, outcomes: OUTCOMES, replies: REPLIES }
}
