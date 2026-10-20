// A committed claim prevents concurrent/replayed sends, including an uncertain provider outcome.
import type { Bindings } from '../auth.server'
import { operatorMail } from '../mail.server.mjs'
import { audit, authority, escape, guard, money, one, sha256, sql, type Context, type Row } from './core'
import { dispatchEvent } from './dispatch'
const labels: Record<string,string> = {
 accepted: 'Email accepted by the mail provider; technician delivery and acceptance are not confirmed.',
 rejected: 'Email rejected by the mail provider. Resolve the failure and arrange a reviewed handoff.',
 rate_limited: 'Email rate-limited by the mail provider. Resolve the failure and arrange a reviewed handoff.',
 uncertain: 'Email outcome uncertain. Reconcile with the provider before arranging another handoff.',
 failed: 'Email outcome uncertain after a transport failure. Reconcile with the provider before arranging another handoff.',
 development: 'Not sent: development or demo email is suppressed.',
 unconfigured: 'Not sent: configure the installation mail provider before arranging a reviewed handoff.',
}
export async function sendDispatch(c: Context, env: Bindings, m: Row) {
 const a = m.snapshot, mail = operatorMail(env)
 let outcome = mail ? 'uncertain' : 'unconfigured', provider: string | null = null
 // Recheck live authority and the exact approved revision immediately before crossing the mail boundary.
 await c.db.batch([authority(c, 'maintenance.dispatch'), guard(c, "EXISTS(SELECT 1 FROM tt_maintenance_jobs WHERE id=? AND version=? AND state='approved')", m.jobId, m.jobVersion)])
 const approval = await one(c, 'SELECT snapshot,sha256 FROM tt_maintenance_approvals WHERE id=?', m.approvalId)
 if (!approval || await sha256(new TextEncoder().encode(approval.snapshot)) !== approval.sha256) throw new Error('The approval evidence could not be verified.')
 const body = [`Approved work: ${a.title}`, `Location: ${a.address}`, `Scope: ${a.scope || a.title}`, `Authorized spend: ${money(a.estimateCents,a.currency)}`, `Due date: ${a.dueDate}`, 'Task checklist:', ...a.checklist.map((task: string) => `[ ] ${task}`), a.appointment ? `Arrival: ${a.appointment.starts} to ${a.appointment.ends} (${a.appointment.zone}; ${a.appointment.state})` : 'Arrival appointment: not booked; contact staff before attending.', `Permitted contact: ${a.permittedContact?.display_name || 'approving staff'}${a.permittedContact?.email ? ' <'+a.permittedContact.email+'>' : ''}`, `Job: ${m.jobId}; approved version: ${a.version}`, 'Reply to staff with acceptance, en route, started, blockers, parts needed and completion. Staff record replies with their source; technician completion does not confirm the resident issue is resolved.'].join('\n')
 if (mail) {
  try {
   const sent = await mail.send({ deliveryId: m.id, from: env.MAIL_FROM!, to: [a.tradeEmail], ...(a.permittedContact?.email ? {replyTo:a.permittedContact.email} : {}), subject: `Approved Terrace work: ${a.title}`, text: body, html: `<p>${escape(body).replaceAll('\n','<br>')}</p>`, headers: {} } as Parameters<NonNullable<typeof mail>['send']>[0])
   outcome = sent.status; provider = sent.providerMessageId ?? null
  } catch { outcome = 'failed' }
 }
 const label = labels[outcome] ?? labels.uncertain
 await c.db.batch([sql(c, 'UPDATE tt_dispatches SET outcome=?,provider_id=?,label=? WHERE id=?', outcome, provider, label, m.id),
  ...(outcome === 'accepted' ? [sql(c, "UPDATE tt_maintenance_jobs SET state='sent',version=version+1,sent_by=?,sent_at=?,sent_reference=? WHERE id=? AND version=? AND state='approved'", c.actor.id,c.now,`Mail provider accepted: ${provider ?? m.id}`,m.jobId,m.jobVersion)] : []),
  dispatchEvent(c,m.id,'email_result',`${label}${provider ? ' Provider reference: '+provider : ''}`), audit(c,'maintenance.dispatch.result',m.jobId,outcome),
 ])
 return {outcome,label}
}
