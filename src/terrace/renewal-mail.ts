// LEASE-012 offer email. Each send was committed to the renewal's history before sending; this records the mail
// provider's own answer beside it. "Accepted" means the provider took the email, not that the household read it.
import type { Bindings } from '../auth.server'
import { operatorMail } from '../mail.server.mjs'
import { escape, one, type Context, type Row } from './core'
import { sendResult } from './renewals'

const LABELS: Record<string, string> = {
 accepted: 'email accepted by the mail provider; delivery to the household is not confirmed',
 rejected: 'email not sent: the mail provider rejected it',
 rate_limited: 'email not sent: the mail provider rate-limited it',
 uncertain: 'email outcome uncertain: the provider did not confirm it; it is not sent again',
 failed: 'email outcome uncertain: the mail provider could not be confirmed reached; it is not sent again',
 development: 'not sent: development or demo mail is suppressed',
 unconfigured: 'not sent: no mail provider is configured',
}

export async function sendRenewalEmails(c: Context, env: Bindings, emails: Row[]) {
 const mail = operatorMail(env), staff = await one(c, 'SELECT email FROM oa_operators WHERE id=?', c.actor.id), out: Row[] = []
 for (const m of emails) {
  let outcome = mail ? 'uncertain' : 'unconfigured', provider: string | null = null
  if (mail) {
   try {
    const sent = await mail.send({ deliveryId: m.eventId, from: env.MAIL_FROM!, to: [m.to], ...(staff?.email ? { replyTo: staff.email } : {}), subject: m.subject, text: m.body, html: `<p>${escape(m.body).replace(/\n/g, '<br>')}</p>`, headers: {} } as Parameters<NonNullable<typeof mail>['send']>[0])
    outcome = sent.status; provider = sent.providerMessageId ?? null
   } catch { outcome = 'failed' }
  }
  const label = LABELS[outcome] ?? LABELS.uncertain
  await c.db.batch(sendResult(c, m, outcome, provider, label))
  out.push({ to: m.to, outcome, label })
 }
 return out
}
