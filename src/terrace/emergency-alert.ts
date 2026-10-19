// WORK-001 / BOUND-003 alert delivery. The installation's own email sends the on-call person a sign-in link and no case
// details. The history records the provider's answer as it was: accepted by the provider, failed, uncertain or not sent.
// "Accepted" means the provider took the email, never that a person read it; only an acknowledgement in Terrace does.
import type { Bindings } from '../auth.server'
import { operatorMail } from '../mail.server.mjs'
import { audit, escape, id, one, type Context, type Row } from './core'
import { event } from './emergencies'

const LABELS: Record<string, string> = {
 accepted: 'email accepted by the mail provider; no person has acknowledged',
 rejected: 'email failed: the mail provider rejected it',
 rate_limited: 'email failed: the mail provider rate-limited it',
 uncertain: 'email outcome uncertain: the provider did not confirm it',
 failed: 'email failed: the mail provider could not be reached',
 development: 'not sent: development or demo mail is suppressed',
 unconfigured: 'not sent: no mail provider is configured',
 unaddressed: 'not sent: the person has no active sign-in',
}

export async function deliverAlert(c: Context, env: Bindings, alert: Row) {
 alert = { ...alert, eventId: id() }
 const to = await one(c, "SELECT id,email FROM oa_operators WHERE id=? AND status='active'", alert.recipientId)
 const mail = operatorMail(env)
 let outcome = !to ? 'unaddressed' : !mail ? 'unconfigured' : 'uncertain', provider: string | null = null
 if (to && mail) {
  try {
   const link = new URL('/app', env.AUTH_ORIGIN)
   link.searchParams.set('tab', 'emergencies'); link.searchParams.set('case', alert.caseId)
   const body = 'A safety case in Terrace needs a person now. This email has no case details. If you cannot act, tell your backup. Terrace does not call or text.'
   const sent = await mail.send({ deliveryId: alert.eventId, from: env.MAIL_FROM!, to: [to.email], subject: 'Urgent: a Terrace safety case needs you now', text: `${body}\n\nSign in and acknowledge it: ${link}\n`, html: `<p>${body}</p><p><a href="${escape(link.href)}">Sign in and acknowledge it</a></p>`, headers: { 'Auto-Submitted': 'auto-generated' } })
   outcome = sent.status; provider = sent.providerMessageId ?? null
  } catch { outcome = 'failed' }
 }
 const label = LABELS[outcome] ?? LABELS.uncertain
 await c.db.batch([event(c, alert.caseId, 'alert', provider ? `provider message ${provider}` : 'no provider message id', label, alert.recipientId, outcome), audit(c, 'emergency.alert', alert.caseId, outcome)])
 return { outcome, label }
}
