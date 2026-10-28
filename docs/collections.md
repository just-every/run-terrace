# Work a collection case

Open **Properties → Delinquency**, choose the report date and filters, then
**Work collection case** for a household. The report keeps the resident's balance
separate from housing-authority receivables and from unconfirmed bank settlement.
Its CSV includes dated plan, notice and outcome sources.

The owner records primary-resident email consent, its evidence, the contact
allowance and any hold under **Settings → Collection contact and holds**.
Disputes, accommodation requests, contact limits and manual or counsel holds
pause collection contact. A changed balance stops unsent drafts and approvals;
review the new facts before preparing another action. An active payment plan
pauses ordinary reminders. Nothing contacts a person automatically.

Record a reply with its actual date and source. Staff-recorded replies are
labelled as such. Prepare dated installments covering the overdue balance, then
have a person approve the exact plan. Plan progress reads receipts allocated to
the original overdue charges; a promise or pending payment is never cash. A
missed installment opens human review, rather than automatically serving a notice.

The cash and vacancy comparison shows plan, notice and waiting options, dated
assumptions, source charges and receipts, history weights and confidence. It
requires the property's active reviewed notice pack, including its eventual
turnover timeline. Change the vacancy or cost assumptions and compare again to
retain a new forecast. Estimates are not legal advice. A scoped prepare credential
can compare and draft, but cannot approve, send, serve or post money. A human
choosing another option records a reason.

Prepare each sequence step with its due date and exact content. Review and approve
it, then explicitly **Send exact collection action**. The installation's configured
mail provider receives one attempt. Provider acceptance, verified mail delivery,
physical service and payment settlement are distinct facts. An uncertain attempt
is not retried automatically. Authenticated SendGrid or Resend delivery events use
`POST /api/arrears-mail/events` and the installation's resident-mail webhook key.
No new provider credential is introduced by collection cases.

Pay-or-quit and violation notices require the property's explicit reviewed pack.
Record actual physical service only after human approval: a permitted method,
service instant with timezone, named server, evidence reference and original
JPEG or PNG photo. Expiry starts on the property-local service day and applies
the frozen pack's explicit calendar or business-day basis, excluded dates and any mailing extension. Missing counting fields hold the action. Printing or sending email
never counts as physical service. This path records staff evidence; it does not
validate local law, use a postal provider or start an eviction.

Record actual vacancy against the selected forecast with its date and evidence.
Actual cash comes from subsequent recorded receipts on the forecast's original
charges. Export and restore preserve collection history, original service photos
and forecasts. Restored history grants no send authority: the destination owner
records new consent and prepares new actions. Collection evidence follows fiscal
retention and accounting holds; eligible personal erasure also retires delivery
receipts, originals and the archive restore fence.
