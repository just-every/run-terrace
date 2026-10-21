// OPS-003: what a workflow template is. A template names one kind, a trigger and conditions that choose its subjects,
// ordered steps with assignees and due days, a contact limit and the human an escalation goes to. Steps are task
// (a person does it and keeps evidence), contact (a person contacts the subject outside Terrace and records each
// attempt, then the reply) and gate (waits for a recorded fact Terrace already holds about the subject).
import { all, insist, one, text, type Context, type Row } from './core'

export const KINDS: [string, string, string][] = [
 ['leasing', 'Leasing follow-up', 'prospect'], ['renewal', 'Renewal', 'renewal'], ['rent', 'Rent reminder', 'tenancy'],
 ['delinquency', 'Delinquency', 'tenancy'], ['unit_turn', 'Unit turn', 'turnover'],
]
export const SUBJECT = Object.fromEntries(KINDS.map(([k, , s]) => [k, s])) as Record<string, string>
/** The existing action a person must hold to work each kind of subject, over and above the workflow command itself. */
export const KIND_ACTION: Record<string, string> = { leasing: 'prospect.respond', renewal: 'renewal.reply', rent: 'arrears.prepare', delinquency: 'arrears.prepare', unit_turn: 'turnover.task.update' }
export const GATES: Record<string, [string, string]> = {
 leasing: ['prospect_leased', 'the prospect is recorded as leased'], renewal: ['renewal_executed', 'the signed renewal is recorded and activated'],
 rent: ['balance_cleared', 'no overdue balance remains'], delinquency: ['balance_cleared', 'no overdue balance remains'], unit_turn: ['turnover_ready', 'the make-ready board is published as ready'],
}
export const CHANNELS = ['email', 'phone', 'text', 'letter', 'in_person']
export const OUTCOMES: [string, string][] = [['reached', 'reached: accepted by the provider or spoke to someone'], ['no_answer', 'no answer'], ['refused', 'refused or bounced'], ['uncertain', 'uncertain: the outcome is not known']]
export const REPLIES: [string, string][] = [['agreed', 'agreed'], ['declined', 'declined'], ['unclear', 'unclear']]
type Step = { key: string; kind: 'task' | 'contact' | 'gate'; title: string; dueDays: number; assignee: string | null; gate: string | null }
export type Template = { kind: string; name: string; trigger: Row; conditions: Row; steps: Step[]; contactLimit: number; escalateTo: string }

const whole = (v: unknown, label: string, min: number, max: number) => {
 insist(['string', 'number'].includes(typeof v) && /^\d+$/.test(String(v)), 'invalid_input', `${label} is a whole number from ${min} to ${max}.`)
 const n = Number(v); insist(n >= min && n <= max, 'invalid_input', `${label} is a whole number from ${min} to ${max}.`); return n
}
/** Operators who may be named on a template: active, and the owner or a role that works this kind (portfolio scope is rechecked per run). */
export const nameable = (actions: string[]) => `o.status='active' AND (o.role='owner' OR EXISTS(SELECT 1 FROM tt_staff_roles r WHERE r.operator_id=o.id AND ${actions.map(a => `EXISTS(SELECT 1 FROM tt_role_actions k WHERE k.role=r.role AND k.action='${a}')`).join(' AND ')}))`
/** The same, over one portfolio: owners, all-portfolio staff, or staff assigned that portfolio (two bound parameters, both the portfolio id). */
export const nameableIn = (actions: string[]) => `o.status='active' AND (o.role='owner' OR EXISTS(SELECT 1 FROM tt_staff_roles r WHERE r.operator_id=o.id AND ${actions.map(a => `EXISTS(SELECT 1 FROM tt_role_actions k WHERE k.role=r.role AND k.action='${a}')`).join(' AND ')} AND (r.all_portfolios=1 OR (? IS NOT NULL AND EXISTS(SELECT 1 FROM tt_role_portfolios rp WHERE rp.operator_id=o.id AND rp.portfolio_id=?)))))`

function stepList(v: unknown): Row[] {
 if (Array.isArray(v)) return v as Row[]
 return text(v, 'Steps', 4000).split(/\r?\n/).map(l => l.trim()).filter(Boolean).map(line => {
  const [k, title, due, assignee] = line.split('|').map(s => s.trim())
  return { kind: k, title, dueDays: due, assignee: assignee || null }
 })
}
/** Validates a template as a person or API client wrote it; steps are lines "kind | title | due days | assignee id" or an array of objects. */
export async function parseTemplate(c: Context, p: Row): Promise<Template> {
 const kind = String(p.kind ?? ''); insist(KINDS.some(k => k[0] === kind), 'workflow_kind', 'Choose leasing, renewal, rent, delinquency or unit turn.')
 const trigger: Row = {}, conditions: Row = {}
 if (kind === 'renewal') trigger.daysBeforeLeaseEnd = whole(p.daysBeforeLeaseEnd, 'Days before the lease ends', 1, 365)
 else if (kind === 'leasing') trigger.staleDays = whole(p.staleDays, 'Days an enquiry has had no activity', 1, 90)
 else if (kind === 'rent') trigger.minDaysPastDue = whole(p.minDaysPastDue, 'Days past due (rent reminders: 1 to 30)', 1, 30)
 else if (kind === 'delinquency') trigger.minDaysPastDue = whole(p.minDaysPastDue, 'Days past due (delinquency: 31 to 365)', 31, 365)
 else trigger.onBoardOpen = true
 if (p.propertyId) { insist(await one(c, 'SELECT 1 FROM tt_properties WHERE id=?', text(p.propertyId, 'Property', 100)), 'not_found', 'Property not found.', 404); conditions.propertyId = String(p.propertyId) }
 if (['rent', 'delinquency'].includes(kind) && p.minOverdue) conditions.minOverdueCents = Math.round(Number(text(String(p.minOverdue), 'Minimum overdue amount', 16)) * 100), insist(Number.isSafeInteger(conditions.minOverdueCents) && conditions.minOverdueCents > 0, 'invalid_money', 'Enter a positive minimum overdue amount.')
 const raw = stepList(p.steps)
 insist(raw.length >= 1 && raw.length <= 12, 'workflow_steps', 'A workflow has 1 to 12 steps.')
 const steps = raw.map((s, i): Step => {
  const k = String(s.kind ?? ''); insist(['task', 'contact', 'gate'].includes(k), 'workflow_steps', `Step ${i + 1}: choose task, contact or gate.`)
  const assignee = s.assignee ? text(s.assignee, 'Assignee', 100) : null
  return { key: 's' + (i + 1), kind: k as Step['kind'], title: text(s.title, `Step ${i + 1} title`, 120), dueDays: whole(s.dueDays, `Step ${i + 1} due days`, 0, 120), assignee, gate: k === 'gate' ? GATES[kind][0] : null }
 })
 const contacts = steps.some(s => s.kind === 'contact'), limit = p.contactLimit === undefined || p.contactLimit === '' ? (contacts ? NaN : 1) : whole(p.contactLimit, 'Contact limit', 1, 10)
 insist(!Number.isNaN(limit), 'workflow_limit', 'A workflow with a contact step needs a contact limit from 1 to 10 attempts for the whole run.')
 for (const a of new Set(steps.map(s => s.assignee).filter(Boolean) as string[])) insist(await one(c, `SELECT 1 FROM oa_operators o WHERE o.id=? AND ${nameable([KIND_ACTION[kind], 'workflow.step'])}`, a), 'not_eligible', 'Name an active owner or staff member whose role works this kind of workflow.', 409)
 const escalateTo = text(p.escalateTo, 'Escalation contact', 100)
 insist(await one(c, `SELECT 1 FROM oa_operators o WHERE o.id=? AND ${nameable(['workflow.resolve'])}`, escalateTo), 'not_eligible', 'Escalate to an active owner or portfolio manager.', 409)
 return { kind, name: text(p.name, 'Template name', 120), trigger, conditions, steps, contactLimit: limit, escalateTo }
}
/** One template per key: its latest version, with whether it is retired. */
export async function latestTemplates(c: Context): Promise<Row[]> {
 return (await all(c, 'SELECT t.* FROM tt_workflow_templates t WHERE t.version=(SELECT MAX(version) FROM tt_workflow_templates x WHERE x.template_key=t.template_key) ORDER BY t.name,t.template_key'))
  .map(t => ({ ...t, trigger: JSON.parse(t.trigger), conditions: JSON.parse(t.conditions), steps: JSON.parse(t.steps) }))
}
