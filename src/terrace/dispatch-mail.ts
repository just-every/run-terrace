import { maintenancePacketSubject, maintenancePacketText } from './maintenance-packet'
// A committed claim prevents concurrent/replayed sends, including an uncertain provider outcome.
import type { Bindings } from '../auth.server'
import {integrationMail} from './integration-mail'
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
 const a = m.snapshot, mail = integrationMail(env,'dispatch_mail',c.now)
 let outcome = mail ? 'uncertain' : 'unconfigured', provider: string | null = null
 // Recheck live authority and the exact approved revision immediately before crossing the mail boundary.
 await c.db.batch([authority(c, 'maintenance.dispatch'), guard(c, "EXISTS(SELECT 1 FROM tt_maintenance_jobs WHERE id=? AND version=? AND state='approved')", m.jobId, m.jobVersion)])
 const approval = await one(c, 'SELECT snapshot,sha256 FROM tt_maintenance_approvals WHERE id=?', m.approvalId)
 if (!approval || await sha256(new TextEncoder().encode(approval.snapshot)) !== approval.sha256) throw new Error('The approval evidence could not be verified.')
 const body = maintenancePacketText(a)
 if (mail) {
  try {
   const sent = await mail.send({ deliveryId: m.id, from: env.MAIL_FROM!, to: [a.tradeEmail], ...(a.permittedContact?.email ? {replyTo:a.permittedContact.email} : {}), subject: maintenancePacketSubject(a), text: body, html: `<p>${escape(body).replaceAll('\n','<br>')}</p>`, headers: {} } as Parameters<NonNullable<typeof mail>['send']>[0])
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
