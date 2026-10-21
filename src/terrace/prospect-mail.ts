import { recordWorkflowSend } from './workflow-mail'
// LEASE-005 prospect email. The message was committed to the prospect's history before sending; this records the
// mail provider's own answer beside it. "Accepted" means the provider took the email, not that the prospect read it.
import type { Bindings } from '../auth.server'
import { operatorMail } from '../mail.server.mjs'
import { audit, escape, one, type Context, type Row } from './core'
import { event } from './prospects'

const LABELS: Record<string, string> = {
 accepted: 'email accepted by the mail provider; delivery to the prospect is not confirmed',
 rejected: 'email not sent: the mail provider rejected it',
 rate_limited: 'email not sent: the mail provider rate-limited it',
 uncertain: 'email outcome uncertain: the provider did not confirm it',
 failed: 'email not sent: the mail provider could not be reached',
 development: 'not sent: development or demo mail is suppressed',
 unconfigured: 'not sent: no mail provider is configured',
}

export async function sendProspectEmail(c: Context, env: Bindings, m: Row) {
 const mail = operatorMail(env), staff = await one(c, 'SELECT email FROM oa_operators WHERE id=?', c.actor.id)
 let outcome = mail ? 'uncertain' : 'unconfigured', provider: string | null = null
 if (mail) {
  try {
   const sent = await mail.send({ deliveryId: m.eventId, from: env.MAIL_FROM!, to: [m.to], ...(staff?.email ? { replyTo: staff.email } : {}), subject: m.subject, text: m.body, html: `<p>${escape(m.body).replace(/\n/g, '<br>')}</p>`, headers: {} } as Parameters<NonNullable<typeof mail>['send']>[0])
   outcome = sent.status; provider = sent.providerMessageId ?? null
  } catch { outcome = 'failed' }
 }
 const label = LABELS[outcome] ?? LABELS.uncertain
 await recordWorkflowSend(c, m.eventId, [{ eventId: m.eventId, outcome, providerMessageId: provider }], [event(c, m.prospectId, 'email_result', { emailEvent: m.eventId, outcome, providerMessageId: provider }, provider ? `provider message ${provider}` : 'no provider message id', label), audit(c, 'prospect.email.result', m.prospectId, outcome)])
 return { outcome, label }
}
