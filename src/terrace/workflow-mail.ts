// Existing LEASE-005 / LEASE-012 sends share the workflow contact limit. The send is still explicit
// and human-authorized. Reserve its slot in the original send batch, then record provider answers
// and workflow effects in the same D1 batch. One offer to several recipients is one attempt.
import { all, guard, insist, sql, type Context, type Row } from './core'
import { pauseStatements, settle, workflowEvent, workflowFence, workflowUpdate } from './workflows'

export async function workflowSendClaim(c: Context, subjectKind: string, subjectId: string, sendId: string) {
 const runs = await all(c, "SELECT r.*,t.contact_limit FROM tt_workflow_runs r JOIN tt_workflow_templates t ON t.id=r.template_id WHERE r.subject_kind=? AND r.subject_id=? AND r.state IN ('running','paused','escalated')", subjectKind, subjectId)
 const writes: D1PreparedStatement[] = []
 for (const run of runs) {
  if (run.state === 'running') {
   const pending = await sql(c, 'SELECT COUNT(*) AS n FROM tt_workflow_sends WHERE run_id=? AND results IS NULL', run.id).first<Row>()
   insist(run.contacts + pending!.n < run.contact_limit, 'contact_limit', 'The workflow contact limit is used up or an earlier send has no confirmed outcome. Review the run before another send.', 409)
   writes.push(guard(c, 'EXISTS(SELECT 1 FROM tt_workflow_runs WHERE id=? AND version=? AND contacts+(SELECT COUNT(*) FROM tt_workflow_sends WHERE run_id=? AND results IS NULL)<?)', run.id, run.version, run.id, run.contact_limit), workflowUpdate(c, run, {}))
  }
  writes.push(sql(c, 'INSERT INTO tt_workflow_sends(run_id,send_id,send_state) VALUES(?,?,?)', run.id, sendId, run.state))
 }
 return writes
}

/** Nothing is counted twice on a repeated result, even if the Worker restarts. Known non-sends are listed only. */
export async function recordWorkflowSend(c: Context, sendId: string, answers: Row[], resultWrites: D1PreparedStatement[]) {
 for (let retry = 0; ; retry++) {
  const linked = await all(c, 'SELECT r.*,s.results,s.provider_results,s.send_state,t.contact_limit,t.steps FROM tt_workflow_sends s JOIN tt_workflow_runs r ON r.id=s.run_id JOIN tt_workflow_templates t ON t.id=r.template_id WHERE s.send_id=?', sendId)
  if (linked.length && linked.every(r => r.provider_results !== null)) return
  const writes: D1PreparedStatement[] = []
  for (const run of linked.filter(r => r.provider_results === null)) {
   const tpl: Row = { ...run, steps: JSON.parse(run.steps) }, uncertain = answers.some(a => !['accepted','rejected','rate_limited','failed','development','unconfigured'].includes(a.outcome))
   const accepted = answers.some(a => a.outcome === 'accepted'), active = run.state === 'running' && run.send_state === 'running', counted = active && run.results === null && (accepted || uncertain), contacts = run.contacts + (counted ? 1 : 0)
   const outcome = uncertain ? 'uncertain' : accepted ? 'accepted' : 'not_sent'
   const reviewed = run.results !== null, prior = reviewed ? JSON.parse(run.results) : [], contradicts = reviewed && (uncertain || prior.some((a: Row) => a.staffResolution === 'delivered') !== accepted)
   const detail = { afterStaffReview: reviewed, channel: 'email', outcome, counted, attempt: counted ? contacts : null, limit: tpl.contact_limit, emailEvents: answers }
   writes.push(workflowFence(c, run), guard(c, 'EXISTS(SELECT 1 FROM tt_workflow_sends WHERE run_id=? AND send_id=? AND results IS ? AND provider_results IS NULL)', run.id, sendId, run.results),
    sql(c, 'UPDATE tt_workflow_sends SET results=COALESCE(results,?),provider_results=? WHERE run_id=? AND send_id=?', JSON.stringify(answers), JSON.stringify(answers), run.id, sendId),
    workflowEvent(c, run, 'attempt', run.step_index, detail, sendId, reviewed ? 'provider answer after staff review; listed without counting again' : active ? (uncertain ? 'mail provider outcome uncertain; a person must reconcile it' : accepted ? 'email accepted by the mail provider; delivery is not confirmed' : 'not sent; does not count toward the contact limit') : 'email sent while ' + run.state + '; listed for the reviewing person, no workflow state or count changed'))
   if (active && contradicts) writes.push(...pauseStatements(c, run, tpl, 'uncertain_result', {}, 'provider answer differs from the staff review; a person must reconcile it'))
   if (counted) {
    const over = { contacts, awaiting: accepted && !uncertain ? 1 : 0 }
    writes.push(...(uncertain ? pauseStatements(c, run, tpl, 'uncertain_result', { ...over, next_action: `Paused: reconcile contact attempt ${contacts}. Confirm every recipient’s outcome, then resume with that result. Do not repeat it until you know.` }) : [workflowUpdate(c, run, settle(tpl, run, over))]))
   }
  }
  try { await c.db.batch([...resultWrites, ...writes]); return }
  catch (error) { if (retry >= 2 || !/CHECK constraint/.test(String(error))) throw error }
 }
}
