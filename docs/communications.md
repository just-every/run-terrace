# Repair communications

Open a tenancy's work screen and choose **Open repair messages**. Record recipient
permissions under Settings first. Only the installation owner and portfolio
managers in the property's scope may manage these messages, using a fresh sign-in
proof. API credentials have no messaging authority.

Record the exact identity and consent source for each email, text or voice
channel, together with the recipient's timezone. Unknown permission blocks that
channel. Phone messages are held outside 8 a.m. to 8 p.m. in that timezone; no
later send is scheduled. A signed STOP records a durable phone suppression and
cannot be cleared by another staff consent entry.

Prepare a repair update, an arrival window or a manual safety page. Review the
exact recipient and content, approve it, then explicitly send it. An attempt is
claimed before contacting the provider. Provider acceptance confirms neither
delivery nor a person reached. An uncertain attempt requires manual provider
reconciliation and cannot be retried. Email replies currently require staff
follow-up; inbound email routing and postal fallback remain incomplete.

An arrival text contains the separately permitted current appointment window.
A signed Y confirms only one unambiguous active window with unchanged approved
work and current vendor qualification. It supplies no new entry permission or
legal notice. Vendor confirmation remains separate. If an earlier arrival invitation exists in
the thread, a bare Y needs staff review; it never selects a newer window by guesswork.
Cancelled, superseded and stale windows cannot be revived by a reply. Cancellation notifications to both
parties are separate reviewed messages.

Safety pages carry no case details and never acknowledge or close the emergency.
Only the named person acknowledges in Terrace. Before paging the backup, record
the existing manual escalation and its reason on the safety case; its email remains.
Nothing escalates on a timer under the existing ct ruling; timed paging and real
human reach remain unproved.

## Provider configuration

Set these installation bindings using the deployment's secret configuration:
`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER` and
`TWILIO_MODE` (`test` or `live`). Never put credentials in the repository.
Test mode permits only the approved magic From and To number `+15005550006`.
Configure production Twilio SMS intake at `/api/twilio/inbound` and status events
at `/api/twilio/status`, on the installation's exact external origin. The server
checks the account, destination, full signed form and exact configured URL;
forged, ambiguous or unrelated callbacks cannot change a thread. Duplicate
callbacks have one effect and late progress cannot regress a terminal outcome.
No automatic webhook reply is sent.

Email uses the existing installation mail provider. Demo messaging commands and
callbacks are disabled before any provider request.

## Test boundary and portability

`tests/messages.mjs` exercises the public command and webhook doors with provider
fakes only at the network edge. `scripts/twilio-sandbox.mjs` uses injected TEST
credentials and the magic number against the real provider adapter. Native
authority and routing are proved separately through the public commands with
the contract's allowed provider-edge fake.
Twilio TEST acceptance originates no call, handset text, status callback or
inbound reply. Signed fixtures establish local routing only.

Message content, immutable consent revisions, delivery events and replies are
included in native backup and readable export. A restored installation cannot
send an archived message, reuse old consent authority or replay its provider
callbacks. Credentials stay outside the archive. Communication evidence follows
SAFE-004's three-year period and holds; eligible erasure deletes its content,
leaving only the hashed phone suppression to prevent accidental re-contact.

The communication authority, consent and reply defaults await ct approval.
PORTAL-006 and PORTAL-009 inherit these restrictions when their future shared
threads and postal delivery doors ship. Neither this implementation nor TEST
receipts close WORK-001's real paging and timed escalation gap.
