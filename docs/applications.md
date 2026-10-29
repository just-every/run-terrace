# Online applications

The owner prepares an application from a reviewed open prospect. Record every
adult's name and individual email, the reviewed invitation authority and one
household fee in USD. The native prospect form supports two adults; the ordinary
`application.open` command accepts a roster of up to twenty adults. The owner
must explicitly confirm `PREPARE APPLICATION`. Every applicable state and local
pack must have activated, effective disclosure text. Terrace freezes those pack
versions and citations for the application. Recorded review is not legal advice.

From **Applications**, explicitly send each adult their own one-time sign-in
link. Links expire after one hour. Applicants use `/apply/signin` to resume;
sessions last twelve hours. A co-applicant sees their own identity, income,
rental history, references, originals, disclosure consent and revision history.
Only the household fee outcome is shared. Applicant sessions grant no staff or
resident access. Never enter card numbers, bank details or Social Security
numbers in an application answer.

Applicants may save incomplete drafts, upload income evidence, review the
frozen disclosures and submit their own answers. Submission requires all answer
sections, an income original and explicit acknowledgment of the exact disclosure
fingerprint. Each upload is limited to 5 MB and uses Terrace's existing static
content screen. The screen is not a malware verdict. Originals are private
attachments with retained fingerprints.

Submitted answers are locked. A currently scoped portfolio manager or the owner
may request a missing document from the current submitted revision. The applicant
sees that request, uploads its original and submits a new revision. Earlier
answers and originals remain visible and attributable. Staff have no command
that edits applicant answers. A request sends no external message automatically.

The household fee uses Stripe-hosted Checkout in test mode. Every attempt needs
explicit current consent; no payer surcharge or saved method is requested.
Terrace reserves one active household fee before contacting Stripe. If the
provider response is uncertain, resume the same request; a different request is
refused. A decline stays in its Checkout attempt until canonical expiry permits
another attempt. Returning from Checkout does not mark the fee paid.

A manager verifies a Stripe event id in **Applications**. Terrace retrieves the
canonical test event and checks its matching session, reserved amount, currency,
successful intent and captured charge. Replays change no amount and create no
second fee. Staff see provider references and safe outcomes, never card objects,
client secrets or active hosted destinations. A fee does not post resident rent,
a bank deposit or settlement evidence. Production collection remains outside the
current approved boundary.

**Data & access → Applicant access and retention** lets the owner revoke access,
record or release a legal hold, and erase eligible application evidence. Evidence
is retained for three years after last activity, or seven years after fee
activity where a fee was collected. A legal hold prevents erasure. A retained
application also prevents its prospect from being erased independently.

Backups retain answers, originals, requests, revisions, consent and fee outcomes.
Sign-in links, sessions, local access grants and active Checkout destinations are
excluded. Restore authorizes no collection or sign-in: the destination owner
must explicitly invite each adult again, and restored fee evidence remains held
for reconciliation in its originating installation. After eligible erasure,
retain a new backup as the later journal when restoring an older backup; that
journal fences resurrection.

The conservative interim policy is owner-only preparation, fee selection,
invitations, revocation, holds and erasure; scoped portfolio managers read and
request evidence. CT approval of authority, custody, retention and fee policy is
pending. Scoped leasing delegation, production provider boundaries and legally
sufficient application disclosures remain named gaps in LEASE-007. Synthetic
PORT-008 test packs are not counsel-reviewed application disclosures.

Public commands are `application.open`, `application.invite`,
`application.request`, `application.fee.reconcile`, `application.revoke`,
`application.hold` and `application.erase`. Reads use `/api/applications` with an
optional application `id`, and `/api/application-file?id=FILE`. Native applicant
forms use `/apply`; the same application and fee actions return JSON under
`/apply/api/application` and `/apply/api/fee`. The session chooses the adult;
submitted adult ids grant no access. Mutations require a matching Origin and
current version; all staff mutations also require a fresh native sign-in.

## Read-only income criterion review

From **Applications → Income criterion review**, the owner or an already
in-scope portfolio manager selects two submitted applicants and their disclosure
and income-original sources. Supply one monthly-income multiple for both, its
previously disclosed reference, monthly rent and staff-entered monthly income in
USD. Confirm that this exact multiple was disclosed to both applicants before
submission. Terrace shows each acknowledged disclosure's text, citation, version
and fingerprint; this staff assertion does not establish legal sufficiency.

For each applicant, select the evidence state and enter the staff verification
assertion `I VERIFIED INCOME`, its date and external reference. Verification is
an attributable staff assertion, not document extraction or provider validation.
Missing income or originals, missing verification and unverified or contested
evidence produce **Held**. Contested evidence needs authorized human review;
this calculation neither records a dispute case nor resolves one.

The same criterion uses integer cents and an exact decimal multiple with up to
six fractional digits. The calculation shows its exact rational threshold and
the minimum whole cents that meet it. A value at the threshold meets the income
criterion; a value below it does not. This result never approves or declines an
applicant. There is no protected-trait input, ranking, document instruction
execution, screening report, notice, fee or financial action.

Changing rent, income, criterion or verification requires **Recompute income
review**. Each result displays only the inputs it computed. No review or extra
applicant record is saved. Submitted answers stay locked. Reload after a source
revision changes; stale versions, changed fingerprints and unavailable sources
are refused. The source door rechecks current staff role and portfolio access
on every request. Applicant revocation also makes that applicant unavailable
for this review, without deleting retained original evidence. Original downloads
keep the existing authenticated, private, no-store custody rules.

Only attributable sensitive-read history is retained, without the supplied
criterion, income or verification reference. Review input is sent in a request
body rather than a URL. Restore carries no cached review or execution authority;
source references must be selected and recomputed in the destination. Existing
application retention, legal holds, erasure and later-journal fences are unchanged.

LEASE-009 remains partial. CT approval of applicant authority, custody, retention
and fee policy, scoped leasing delegation and production provider boundaries
remain owed. Counsel engagement, legally sufficient disclosures and approved
adverse-action contents, authorized TransUnion screening and report provenance,
human decisions, accommodation and contested-report referrals, correct dispute
and provider contacts, approved notice delivery and screening-file export history
remain outside this calculation.
