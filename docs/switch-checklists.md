# Switching to Terrace

Generated from [the checklist source](switch-checklists.json) and [CONTRACT.md](../CONTRACT.md). Regenerate with `node scripts/contract-docs.mjs write`; `check` rejects stale output.

These are function-by-function research checklists, not a qualified full switch. Public documentation describes available features; a customer’s plan, account, region and provider entitlements still need verification. Review dates below record when the cited documentation was read, not a provider qualification date.

Covered means every named replacement acceptance excerpt still matches CONTRACT.md, every replacement is DONE with evidence and no Gap, and no function-specific gap remains. It applies only to that stated acceptance. A boundary clause or generic CSV importer proves no replacement coverage. Partial, missing and intentionally unmapped functions remain gaps. No checklist establishes authentic migration, a full operating month, settlement or permission to cut over payments.

Each function links its official source and shows the current contract Status, Evidence and Gap. Evidence is the contract’s recorded proof, not a new incumbent qualification. Status changes require regeneration; the command refuses unknown clause IDs.

## AppFolio

7 of 49 documented functions have covered replacement acceptance; 42 remain gaps. Full switch: unqualified.

### Publish vacancies on a property website

**Missing** — gap remains.

Official documentation: [AppFolio marketing and leasing](https://www.appfolio.com/property-manager/marketing-leasing) — Marketing and leasing capabilities; reviewed 2026-11-04.

- [LEASE-001](../CONTRACT.md) — **MISSING**: Publish property marketing and vacancies. Matching acceptance: “Publish two vacant units, submit an enquiry on mobile, lease one and confirm its vacancy is withdrawn while the other remains available with the approved price and fees.”
  - Evidence: None recorded.
  - Gap: Property marketing and vacancy publication are absent.

**Uncovered:** LEASE-001: MISSING. Property marketing and vacancy publication are absent.

### Syndicate listings to Zillow

**Missing** — gap remains.

Official documentation: [AppFolio marketing and leasing](https://www.appfolio.com/property-manager/marketing-leasing) — Listing syndication; reviewed 2026-11-04.

- [LEASE-002](../CONTRACT.md) — **MISSING**: Syndicate listings to Zillow. Matching acceptance: “Publish through the provider test boundary, correct a rejected fee field, change rent and withdraw the listing; show acknowledgments and the same external listing identity without duplicates.”
  - Evidence: None recorded.
  - Gap: Zillow connection and listing status reconciliation are absent.

**Uncovered:** LEASE-002: MISSING. Zillow connection and listing status reconciliation are absent.

### Syndicate listings to Apartments.com

**Missing** — gap remains.

Official documentation: [AppFolio marketing and leasing](https://www.appfolio.com/property-manager/marketing-leasing) — Listing syndication; reviewed 2026-11-04.

- [LEASE-003](../CONTRACT.md) — **MISSING**: Syndicate listings to Apartments.com. Matching acceptance: “Submit the same unit to Apartments.com, process a rejection and later success, update availability and remove it after lease execution; trace each provider result to the unit.”
  - Evidence: None recorded.
  - Gap: Apartments.com distribution is absent.

**Uncovered:** LEASE-003: MISSING. Apartments.com distribution is absent.

### Syndicate listings to Zumper

**Missing** — gap remains.

Official documentation: [AppFolio marketing and leasing](https://www.appfolio.com/property-manager/marketing-leasing) — Listing syndication; reviewed 2026-11-04.

- [LEASE-004](../CONTRACT.md) — **MISSING**: Extend listing reach with Zumper and RentCafe. Matching acceptance: “Enable each adapter in its supported environment, publish and withdraw a unit, receive an enquiry and demonstrate that an unentitled account cannot appear connected or published.”
  - Evidence: None recorded.
  - Gap: Zumper and RentCafe adapters are absent.

**Uncovered:** LEASE-004: MISSING. Zumper and RentCafe adapters are absent.

### Work prospect records and human follow-up

**Covered** — mapped replacement acceptance passed.

Official documentation: [AppFolio marketing and leasing](https://www.appfolio.com/property-manager/marketing-leasing) — Leasing CRM guest cards; reviewed 2026-11-04.

- [LEASE-005](../CONTRACT.md) — **DONE**: Work prospect records and enquiries. Matching acceptance: “Receive a listing enquiry and duplicate email, review the match, assign a leasing person, respond and follow that prospect through showing and application with source attribution intact.”
  - Evidence: `migrations/core/0044_prospects.sql`; `src/terrace/prospects.ts`; `src/terrace/prospect-mail.ts`; `src/terrace/prospect-view.ts`; `tests/prospects.mjs`; `tests/terrace.test.mjs`
  - Gap: None in the contract row.

### Schedule prospect tours

**Missing** — gap remains.

Official documentation: [AppFolio marketing and leasing](https://www.appfolio.com/property-manager/marketing-leasing) — Leasing Performer tour scheduling; reviewed 2026-11-04.

- [LEASE-006](../CONTRACT.md) — **MISSING**: Coordinate tours and showing access. Matching acceptance: “Book competing tours, reschedule through the prospect link, cancel one and process a no-show; verify each connected scheduler&#47;calendar and the permitted access window agree.”
  - Evidence: None recorded.
  - Gap: Showing scheduling and named scheduler&#47;calendar connections are absent.

**Uncovered:** LEASE-006: MISSING. Showing scheduling and named scheduler&#47;calendar connections are absent.

### Take online applications

**Partial** — gap remains.

Official documentation: [AppFolio marketing and leasing](https://www.appfolio.com/property-manager/marketing-leasing) — Full leasing workflow; reviewed 2026-11-04.

- [LEASE-007](../CONTRACT.md) — **PARTIAL**: Take complete online applications. Matching acceptance: “Two co-applicants save and resume, upload income evidence and submit; manager requests one missing document and sees revisions and fee outcome without card data in Terrace.”
  - Evidence: `tests/applications.mjs` journey: two private adult drafts, resume through a fresh email link after sign-out with the old session refused, income originals, required disclosure consent, submitted answers, manager requests and immutable revisions, verified fee outcomes without card objects, scope refusal, revocation, archive recovery and erasure fences; `tests/applications-browser.mjs`: native forms and revision screens at desktop and phone widths; `tests/applications-sandbox.mjs`: held Stripe test hosted fee and canonical event proof
  - Gap: Conservative interim policy under the standing scope rule: owner-only roster, fee preparation, invitations, revocation, retention holds and erasure; scoped portfolio managers read and request evidence; each adult controls only their answers and one explicitly consented household fee. CT approval of applicant authority, custody, retention and fee policy remains pending; scoped leasing delegation and production provider boundaries remain owed. Activated PORT-008 disclosure text is frozen and acknowledged, but synthetic counsel fixtures do not prove legally sufficient application disclosures.

**Uncovered:** LEASE-007: PARTIAL. Conservative interim policy under the standing scope rule: owner-only roster, fee preparation, invitations, revocation, retention holds and erasure; scoped portfolio managers read and request evidence; each adult controls only their answers and one explicitly consented household fee. CT approval of applicant authority, custody, retention and fee policy remains pending; scoped leasing delegation and production provider boundaries remain owed. Activated PORT-008 disclosure text is frozen and acknowledged, but synthetic counsel fixtures do not prove legally sufficient application disclosures.

### Obtain tenant screening and verification

**Missing** — gap remains.

Official documentation: [AppFolio marketing and leasing](https://www.appfolio.com/property-manager/marketing-leasing) — FolioScreen Trusted Renter; reviewed 2026-11-04.

- [LEASE-008](../CONTRACT.md) — **MISSING**: Order consented TransUnion screening. Matching acceptance: “Submit a consented application to the provider sandbox, receive a delayed report and duplicate callback, deny an unauthorized report download and show provider errors without fabricating a screening result.”
  - Evidence: None recorded.
  - Gap: Screening integration, consent and restricted reports are absent.

- [LEASE-009](../CONTRACT.md) — **PARTIAL**: Review applicants and adverse actions. Matching acceptance: “Review two applications, flag a disputed report, require a manager decision and send an explicitly approved adverse-action package with the correct provider reference and recorded delivery.”
  - Evidence: `tests/applications.mjs` — existing application journey, registered in `tests/terrace.test.mjs`: two separate submitted applications under one explicitly supplied previously disclosed criterion; integer-cent and fractional-cent thresholds, recomputation, missing and contested holds, staff verification provenance, submitted revisions and original hashes, stale-source refusal, role and credential refusal, portfolio 404 and live revocation, private originals and unchanged applicant, financial, grant and custody records. `tests/applications-browser.mjs` — native source selection and income review, recomputation and contested hold with stale-source refusal; push Verify invokes the script, with desktop assertions and 1440 and 390 proof.
  - Gap: Read-only income-criterion review is implemented; it is not a human applicant decision or screening report. CT approval of applicant authority, custody, retention and fee policy remains pending; scoped leasing delegation and production provider boundaries remain owed. Terrace counsel engagement and counsel-reviewed authored pack and template contents remain unavailable, so legally sufficient disclosures and adverse-action contents remain unqualified. TransUnion onboarding, authorized screening sandbox, real reports and provider provenance remain outstanding. Human approval and decline recording, accommodation and contested-report referral workflows, approved adverse-action packages, correct dispute and provider contacts, applicant approval and decline notice delivery evidence and screening-file export history with outcome “exported” remain owed.

**Uncovered:** LEASE-008: MISSING. Screening integration, consent and restricted reports are absent. LEASE-009: PARTIAL. Read-only income-criterion review is implemented; it is not a human applicant decision or screening report. CT approval of applicant authority, custody, retention and fee policy remains pending; scoped leasing delegation and production provider boundaries remain owed. Terrace counsel engagement and counsel-reviewed authored pack and template contents remain unavailable, so legally sufficient disclosures and adverse-action contents remain unqualified. TransUnion onboarding, authorized screening sandbox, real reports and provider provenance remain outstanding. Human approval and decline recording, accommodation and contested-report referral workflows, approved adverse-action packages, correct dispute and provider contacts, applicant approval and decline notice delivery evidence and screening-file export history with outcome “exported” remain owed. FolioScreen identity, income and employment verification are not established by a TransUnion boundary or the read-only income review.

### Prepare lease documents

**Missing** — gap remains.

Official documentation: [AppFolio marketing and leasing](https://www.appfolio.com/property-manager/marketing-leasing) — Blue Moon lease document management; reviewed 2026-11-04.

- [LEASE-010](../CONTRACT.md) — **MISSING**: Compose jurisdiction-reviewed lease templates. Matching acceptance: “Generate a lease with co-signers, pet addendum and local disclosure, detect a missing required input and approve a changed term while preserving the template version and redline.”
  - Evidence: None recorded.
  - Gap: Lease template assembly and reviewed jurisdiction packs are absent.

**Uncovered:** LEASE-010: MISSING. Lease template assembly and reviewed jurisdiction packs are absent.

### Execute an electronic lease

**Missing** — gap remains.

Official documentation: [AppFolio online portal help](https://www.appfolio.com/help/online-portal) — Electronic lease and electronic signature; reviewed 2026-11-04.

- [LEASE-011](../CONTRACT.md) — **MISSING**: Collect legally evidenced electronic signatures. Matching acceptance: “Send a multi-signer lease, process one decline and a replacement envelope, complete all signatures, replay its callback and attach exactly one executed PDF&#47;certificate to the activated tenancy.”
  - Evidence: None recorded.
  - Gap: E-signature provider&#47;sibling integration and execution lifecycle are absent.

**Uncovered:** LEASE-011: MISSING. E-signature provider&#47;sibling integration and execution lifecycle are absent.

### Review and record renewal campaigns

**Partial** — gap remains.

Official documentation: [AppFolio marketing and leasing](https://www.appfolio.com/property-manager/marketing-leasing) — Leasing Signals renewal pricing; reviewed 2026-11-04.

- [LEASE-012](../CONTRACT.md) — **DONE**: Run renewal and retention campaigns. Matching acceptance: “Run a renewal window with accepted, declined and unanswered offers; trace approved delivery and executed future terms, and verify the unresolved household remains in the follow-up queue.”
  - Evidence: `migrations/core/0046_renewals.sql`; `src/terrace/renewals.ts`; `src/terrace/renewal-mail.ts`; `src/terrace/renewal-view.ts`; `src/terrace/lease-versions.ts`; `src/terrace/leasing-metrics.ts`; `src/terrace/scenarios.ts`; `tests/renewals.mjs`; `tests/terrace.test.mjs`
  - Gap: None in the contract row.

**Uncovered:** Automated incumbent pricing guidance and market-data feeds are not replaced by owner-supplied dated assumptions.

### Pay rent by bank account

**Missing** — gap remains.

Official documentation: [AppFolio online portal help](https://www.appfolio.com/help/online-portal) — Make a one-time payment: eCheck; reviewed 2026-11-04.

- [PAY-002](../CONTRACT.md) — **MISSING**: Collect rent through ACH. Matching acceptance: “Pay a resident balance through ACH sandbox authorization, restart after provider submission and reconcile pending then settled callbacks without a second debit or exposing bank credentials.”
  - Evidence: None recorded.
  - Gap: ACH collection and processor reconciliation are absent.

**Uncovered:** PAY-002: MISSING. ACH collection and processor reconciliation are absent.

### Pay rent by card

**Partial** — gap remains.

Official documentation: [AppFolio online portal help](https://www.appfolio.com/help/online-portal) — Make a one-time payment: credit or debit card; reviewed 2026-11-04.

- [PAY-003](../CONTRACT.md) — **PARTIAL**: Collect rent by card. Matching acceptance: “Pay a partial balance with a test card requiring authentication, inspect the disclosed fee, complete payment and confirm one resident receipt and matching provider reference.”
  - Evidence: `tests/terrace.test.mjs` — "PAY-003: hosted card consent, policy admission, provider-only receipts, declines, expiry and replay" (`tests/card-payments.mjs`): scoped collection and versioned consent, inherited admission and atomic reservations, fee disclosure, canonical provider events and charge references, decline, expiry, concurrent replay and restart, credential-free restore and demo no-egress; passed at ea40fc1266b84123ea94242354838db93eca6c74 in heavy job 20261026T053952942981Z-heavy-slot-1f69fefb. `tests/card-payments-browser.mjs` — "journey", with --buffered-http: native review, pending and receipt states, staff reconciliation and uncertain-request resumption at 1440 and 390 through actual buffered Worker responses; only Stripe is faked at the network edge. Passed at c3d97576086bf0ca54d74f813846464509445986 in heavy job 20261026T054310729464Z-heavy-slot-7abac798; captures inspected. Provider-only sandbox capture on 26 October 2026: session cs_test_a1aCgX0MIKGGPYAZsRqaGqaK5zUkKkKIFQ87bwQ6m5YzF8t324KUuHTuni, intent pi_3UUfhRDg8BoejKxo4HBAlIoy, event evt_1UUfhSDg8BoejKxoEpx7eoxW, $10.00 USD paid in test mode. The public pre-event ledger contained no receipt. Two admitted live journeys stalled reading the resident return in Chromium although public HTTP returned the pending page. The corrected buffered transport passed the native network-edge journey; its held-key retry was cancelled after nineteen minutes with eight local jobs still ahead and made no provider request.
  - Gap: End-to-end live Stripe ledger receipt, decline, required authentication and provider-event replay remain unproved. Deposit collection and liability require ACCT-003 and PORT-008 counsel-reviewed rules; actual provider settlement into the ACCT-002 mapped banks and authorized production configuration remain unproved. The implementation remains test-only. CT approval of card authority, consent and zero payer fee remains open; PAY-005 stays CT-held and is inherited unchanged.

**Uncovered:** PAY-003: PARTIAL. End-to-end live Stripe ledger receipt, decline, required authentication and provider-event replay remain unproved. Deposit collection and liability require ACCT-003 and PORT-008 counsel-reviewed rules; actual provider settlement into the ACCT-002 mapped banks and authorized production configuration remain unproved. The implementation remains test-only. CT approval of card authority, consent and zero payer fee remains open; PAY-005 stays CT-held and is inherited unchanged.

### Manage resident autopay

**Missing** — gap remains.

Official documentation: [AppFolio online portal help](https://www.appfolio.com/help/online-portal) — Set up, edit, skip and delete an auto payment; reviewed 2026-11-04.

- [PAY-004](../CONTRACT.md) — **MISSING**: Manage resident autopay mandates. Matching acceptance: “Authorize capped balance autopay, change the bill above its cap, then cancel before the next run; verify the permitted debit, held exception, notice and canceled attempt.”
  - Evidence: None recorded.
  - Gap: Autopay mandates, schedules and notices are absent.

**Uncovered:** PAY-004: MISSING. Autopay mandates, schedules and notices are absent.

### Apply full and partial payment rules

**Partial** — gap remains.

Official documentation: [AppFolio online portal help](https://www.appfolio.com/help/online-portal) — Payment amount and pay-in-full restrictions; reviewed 2026-11-04.

- [PAY-005](../CONTRACT.md) — **PARTIAL**: Enforce partial and split payment policies. Matching acceptance: “Two co-tenants pay concurrently while one ACH is pending; show allocation, remaining balance and permitted credit, and refuse a partial payment under a reviewed stage-specific block.”
  - Evidence: `tests/payer-accounting.test.mjs` — PAY-005: reviewed lease stages reserve concurrent co-tenant payments, allocate settlement once, separate credit and block partial or excess funds (`tests/payments.mjs`): concurrent co-tenants and ACH reservation, allocation and remaining balance, credit, reviewed stage refusal, signed-lease resident and HAP payer records and preserved bookkeeper authority; restart and restore. `tests/payments-browser.mjs`: native settlement and refusal, 1440/390, keyboard and hover tooltip.
  - Gap: External-record slice only: resident online collection must inherit this policy in PAY-002 and PAY-003; PAY-013 has separate payer entitlement and reconciliation journeys, done at its own ct judgment. Adopted default pending ct: owner-only policy configuration; existing ROLE-001 rent receipt recorders retain payment and outcome authority, no outbound instruction or automatic credit use; DONE awaits ct approval and the remaining payment doors.

**Uncovered:** PAY-005: PARTIAL. External-record slice only: resident online collection must inherit this policy in PAY-002 and PAY-003; PAY-013 has separate payer entitlement and reconciliation journeys, done at its own ct judgment. Adopted default pending ct: owner-only policy configuration; existing ROLE-001 rent receipt recorders retain payment and outcome authority, no outbound instruction or automatic credit use; DONE awaits ct approval and the remaining payment doors.

### Collect electronic retail cash

**Partial** — gap remains.

Official documentation: [AppFolio online portal help](https://www.appfolio.com/help/online-portal) — Electronic cash payment slip; reviewed 2026-11-04.

- [PAY-007](../CONTRACT.md) — **PARTIAL**: Offer cash-at-retail and offline payment options. Matching acceptance: “Generate a cash code, receive and replay its retail transaction, clear a check and return another; reconcile resident balances to settlement batches without treating a printed code as collected rent.”
  - Evidence: `src/terrace/ledger.ts`
  - Gap: Manual external receipts exist; retail network, check deposits and clearance&#47;return states are absent.

**Uncovered:** PAY-007: PARTIAL. Manual external receipts exist; retail network, check deposits and clearance&#47;return states are absent.

### View resident payment history and receipts

**Partial** — gap remains.

Official documentation: [AppFolio online portal help](https://www.appfolio.com/help/online-portal) — View payment history and printed receipts; reviewed 2026-11-04.

- [PAY-010](../CONTRACT.md) — **PARTIAL**: Issue resident statements and receipts. Matching acceptance: “Generate a monthly statement, pay part of it, receive a delivered receipt, fail the statement email and inspect the resident portal’s matching balance and delivery task.”
  - Evidence: `tests/payer-accounting.test.mjs` — "PAY-010: resident statements, delivered receipts, failed-email tasks and private accessible downloads" (`tests/resident-statements.mjs`): monthly issuance before partial payment; itemized USD charges, fees, credits, pending funds and matching balance; private source inspection; tagged selectable PDF and CSV; frozen recipient review, explicit sending, delivered receipt and replacement statement; authenticated bounce into one follow-up, completion and replay after restart; household scope, custody, erasure and inert restore. `tests/resident-statements-browser.mjs` — "journey": native month selection, exact frozen downloads, payment source, delivered receipt and statement, matching staff aging, owner preparation, review, explicit send and task completion at 1440 and 390. The three touched API tests and statement browser component passed at ea40fc1266b84123ea94242354838db93eca6c74 in heavy job 20261026T053952942981Z-heavy-slot-1f69fefb; its subsequent independent card-transport component failed and was corrected separately. Screens and PDF inspected. Signed SendGrid outcomes use network-edge fixtures. `tests/resident-statements-live.mjs` — "PAY-010 real QA delivery": SendGrid message I3ne_caQQ2iJKekc32-sJg, delivery 05d4d855-c99d-4fe5-8ca9-2f3ff832503d, actual QA mailbox receipt e3901470-9111-4375-a512-2ba63e25842a received 26 October 2026 at 04:41:02Z; owner-recorded mailbox evidence, receipt $200.00 and matching resident balance $800.00.
  - Gap: CT approval of the adopted owner-only fresh-proof delivery authority, affirmative resident request, current household email eligibility and financial-document custody default remains open. Provider acceptance alone is never delivery.

**Uncovered:** PAY-010: PARTIAL. CT approval of the adopted owner-only fresh-proof delivery authority, affirmative resident request, current household email eligibility and financial-document custody default remains open. Provider acceptance alone is never delivery.

### Work delinquency and payment plans

**Partial** — gap remains.

Official documentation: [AppFolio accounting and reporting](https://www.appfolio.com/property-manager/accounting-reporting) — Payment Plans and debt recovery; reviewed 2026-11-04.

- [PAY-011](../CONTRACT.md) — **PARTIAL**: Work delinquencies to a recorded outcome. Matching acceptance: “Run a sequence for three late households, receive a reply and payment plan, settle one balance and break another promise; verify stopped messages, next actions and human notice approval, and serve the approved pay-or-quit notice with recorded posting evidence and its expiry date computed from service.”
  - Evidence: `src/terrace/tenancies.ts`; `src/terrace/ledger.ts`; `tests/terrace.test.mjs`
  - Gap: Arrears totals and approved drafts exist; delivered sequences, plans, replies and resolution tracking are absent.

**Uncovered:** PAY-011: PARTIAL. Arrears totals and approved drafts exist; delivered sequences, plans, replies and resolution tracking are absent.

### Maintain property and portfolio accounting

**Covered** — mapped replacement acceptance passed.

Official documentation: [AppFolio accounting and reporting](https://www.appfolio.com/property-manager/accounting-reporting) — Portfolio Accounting; reviewed 2026-11-04.

- [ACCT-001](../CONTRACT.md) — **DONE**: Maintain a balanced property ledger. Matching acceptance: “Post rent, deposit, vendor expense and owner contribution across two properties, attempt an unbalanced entry and inspect the trial balance and each subledger back to source.”
  - Evidence: `tests/journal.mjs` (journey, in `tests/terrace.test.mjs` ACCT-001&#47;ACCT-011): rent, deposits, expenses and contributions across two properties; unbalanced and cross-owner&#47;fund refusals; chart&#47;opening entries; trial and owner/property/resident/vendor/deposit subledgers back to sources; duplicate receipt reversal with unchanged originals; live role&#47;scope, migration, restart and archive restore; `tests/journal-browser.mjs`: native posting and filtered subledger at 1440/390; `migrations/core/0056_journal.sql`; `src/terrace/journal.ts`
  - Gap: None in the contract row.

### Connect bank feeds

**Missing** — gap remains.

Official documentation: [AppFolio accounting and reporting](https://www.appfolio.com/property-manager/accounting-reporting) — Plaid Bank Feed Integration; reviewed 2026-11-04.

- [ACCT-005](../CONTRACT.md) — **MISSING**: Connect Plaid bank feeds. Matching acceptance: “Connect two bank accounts through the provider boundary, import duplicate and pending-to-posted lines, expire consent and reconnect; verify no duplicate bank transaction and a visible freshness gap.”
  - Evidence: None recorded.
  - Gap: Plaid bank feeds and consent&#47;freshness management are absent.

**Uncovered:** ACCT-005: MISSING. Plaid bank feeds and consent&#47;freshness management are absent.

### Match and reconcile bank transactions

**Partial** — gap remains.

Official documentation: [AppFolio accounting and reporting](https://www.appfolio.com/property-manager/accounting-reporting) — Auto Bank Reconciliation; reviewed 2026-11-04.

- [ACCT-006](../CONTRACT.md) — **DONE**: Match statements and perform three-way reconciliation. Matching acceptance: “Reconcile a month with batched rent, fee, outstanding check, a cleared owner ACH batch and missing deposit; resolve one exception and show the remaining difference prevents a balanced three-way sign-off.”
  - Evidence: `tests/reconcile.mjs` journey: reviewed CSV, OFX, QFX and PDF lines, exact settlement and ACH matching, check numbers, outstanding items, unresolved differences and balanced sign-off, stale books, close refusal, scope and restore; `tests/reconcile-browser.mjs`: native matching and sign-off at desktop and phone widths; `docs/bank-reconciliation.md`
  - Gap: None for current recorded sources. ACCT-017 and ACCT-018 inherit check-register and transmitted-file source matching before their doors ship.

**Uncovered:** ACCT-006: None for current recorded sources. ACCT-017 and ACCT-018 inherit check-register and transmitted-file source matching before their doors ship.

### Capture and approve vendor bills

**Partial** — gap remains.

Official documentation: [AppFolio accounting and reporting](https://www.appfolio.com/property-manager/accounting-reporting) — Accounting Performer bill coding; reviewed 2026-11-04.

- [ACCT-007](../CONTRACT.md) — **DONE**: Capture and approve vendor bills. Matching acceptance: “Upload the same invoice twice, split an approved landscaping bill across properties, exceed an owner’s limit and inspect the held bill, approval route and resulting payable.”
  - Evidence: `migrations/core/0041_bills.sql`; `src/terrace/bills.ts`; `src/terrace/bills-input.ts`; `src/terrace/bills-authority.ts`; `src/terrace/bills-templates.ts`; `src/terrace/bills-attachments.ts`; `src/terrace/bills-retention.ts`; `src/terrace/bills-view.ts`; `src/terrace/owners.ts`; `tests/bills.mjs`; `tests/terrace.test.mjs`
  - Gap: None in the contract row.

**Uncovered:** Autonomous bill coding and bill capture are not proven by manual invoice intake and approval.

### Pay vendors

**Missing** — gap remains.

Official documentation: [AppFolio accounting and reporting](https://www.appfolio.com/property-manager/accounting-reporting) — Online Payments; reviewed 2026-11-04.

- [ACCT-008](../CONTRACT.md) — **MISSING**: Pay vendors and reconcile payment outcomes. Matching acceptance: “Approve a vendor batch, change one bank destination and hold it, execute the unchanged items in the paying account’s ACCT-018 NACHA file and import an R01 return from the bank’s return file; show one payment per bill, a remittance notice per vendor and the reopened returned payable.”
  - Evidence: None recorded.
  - Gap: Vendor payment rails, payee controls and reconciliation are absent.

**Uncovered:** ACCT-008: MISSING. Vendor payment rails, payee controls and reconciliation are absent.

### Pay owner distributions

**Missing** — gap remains.

Official documentation: [AppFolio accounting and reporting](https://www.appfolio.com/property-manager/accounting-reporting) — Portfolio Accounting distributions; reviewed 2026-11-04.

- [ACCT-010](../CONTRACT.md) — **MISSING**: Disburse owner funds by ACH or check. Matching acceptance: “Prepare a joint-owner distribution with a pending ACH receipt and unpaid repair, approve cleared funds only, execute it in the trust account’s ACCT-018 NACHA file and import an R01 return for one share from the bank’s return file; show corrected cash and one replacement requiring new approval.”
  - Evidence: None recorded.
  - Gap: Owner distributions, ACH&#47;check execution and return accounting are absent.

**Uncovered:** ACCT-010: MISSING. Owner distributions, ACH&#47;check execution and return accounting are absent.

### Close the accounting period

**Partial** — gap remains.

Official documentation: [AppFolio accounting and reporting](https://www.appfolio.com/property-manager/accounting-reporting) — Accounting Performer closing the books; reviewed 2026-11-04.

- [ACCT-011](../CONTRACT.md) — **DONE**: Close periods without rewriting history. Matching acceptance: “Close a reconciled month, attempt a backdated posting, approve a period reopening and adjustment, then compare old&#47;new statements with the reopening reason and unchanged original entries.”
  - Evidence: `migrations/core/0036_periods.sql`; `src/terrace/periods.ts`; `src/terrace/periods-view.ts`; `src/terrace/core.ts`; `src/terrace/api.ts`; `tests/terrace.test.mjs`
  - Gap: None in the contract row.

**Uncovered:** Autonomous closing and budget predictions remain unsupported; the mapped acceptance covers a human-reviewed period close.

### Publish owner statements

**Partial** — gap remains.

Official documentation: [AppFolio owner portal help](https://www.appfolio.com/help/owner) — Statements and published packets; reviewed 2026-11-04.

- [ACCT-012](../CONTRACT.md) — **PARTIAL**: Publish complete owner statements. Matching acceptance: “Publish a monthly owner statement with rent, a paid bill and distribution, reconcile its closing cash to books&#47;bank and download the source invoice from the owner portal.”
  - Evidence: `tests/statements.mjs` — "journey": staff cash draft opening and closing cash, expenses, reserves, separate deposits, liabilities and dated ownership. `tests/statements.mjs` — "journey", invoked by the ACCT-012 registration in `tests/terrace.test.mjs`: exact seller and buyer invoice originals on either side of a transfer, expense cents and CSV isolation, absent and other-owner files refused, staff cookies excluded, screening refusal, shared originals held, changed approval withdrawal, cross-property revision history, restart, immediate revocation, audit and native restore with fresh authorization. `tests/statements-browser.mjs`: native owner statement expense, fee and reserve sections and invoice downloads at 1440 and 390.
  - Gap: Complete paid-bill and distribution sources, corrected immutable publication, scheduled delivery, receipt and invoice bundles, bank tie-out and REPORT-007 actuals remain unproved. Joint-owner originals are held. Adopted conservative original-disclosure default pending ct: a live owner grant reads only an exact currently approved invoice attachment when every historical allocation belongs wholly to that owner on its invoice date; shared-beneficiary originals stay with staff for review. No new payment, send, bank-change or approval authority.

- [PORTAL-002](../CONTRACT.md) — **PARTIAL**: Give owners their financial and property portal. Matching acceptance: “Joint owners inspect different ownership periods, approve an over-limit repair, contribute funds and download a statement&#47;invoice; access another owner’s report and screening file is denied.”
  - Evidence: `tests/statements.mjs` — "journey", invoked by the ACCT-012 registration in `tests/terrace.test.mjs`: exact seller and buyer invoice originals on either side of a transfer, expense cents and CSV isolation, absent and other-owner files refused, staff cookies excluded, screening refusal, shared originals held, changed approval withdrawal, cross-property revision history, restart, immediate revocation, audit and native restore with fresh authorization. `tests/statements-browser.mjs`: native owner statement expense, fee and reserve sections and invoice downloads at 1440 and 390.
  - Gap: Occupancy and rent detail, complete distribution status and documents, owner contributions, communication, over-limit repair decisions with PORTAL-007 riders, joint-owner original disclosure and staff bank-change fresh-proof assertions remain unproved. Adopted conservative original-disclosure default pending ct: a live owner grant reads only an exact currently approved invoice attachment when every historical allocation belongs wholly to that owner on its invoice date; shared-beneficiary originals stay with staff for review. No new payment, send, bank-change or approval authority.

**Uncovered:** ACCT-012: PARTIAL. Complete paid-bill and distribution sources, corrected immutable publication, scheduled delivery, receipt and invoice bundles, bank tie-out and REPORT-007 actuals remain unproved. Joint-owner originals are held. Adopted conservative original-disclosure default pending ct: a live owner grant reads only an exact currently approved invoice attachment when every historical allocation belongs wholly to that owner on its invoice date; shared-beneficiary originals stay with staff for review. No new payment, send, bank-change or approval authority. PORTAL-002: PARTIAL. Occupancy and rent detail, complete distribution status and documents, owner contributions, communication, over-limit repair decisions with PORTAL-007 riders, joint-owner original disclosure and staff bank-change fresh-proof assertions remain unproved. Adopted conservative original-disclosure default pending ct: a live owner grant reads only an exact currently approved invoice attachment when every historical allocation belongs wholly to that owner on its invoice date; shared-beneficiary originals stay with staff for review. No new payment, send, bank-change or approval authority.

### Share owner 1099s

**Missing** — gap remains.

Official documentation: [AppFolio owner portal help](https://www.appfolio.com/help/owner) — Shared reports, documents and 1099s; reviewed 2026-11-04.

- [ACCT-014](../CONTRACT.md) — **MISSING**: Prepare and file owner and vendor 1099s. Matching acceptance: “Prepare owner&#47;vendor forms from reconciled payments, correct an invalid TIN, approve a Nelco submission and process accepted/rejected/corrected outcomes without duplicate filings.”
  - Evidence: None recorded.
  - Gap: W-9, reportable payment calculation, Nelco filing and correction workflows are absent.

**Uncovered:** ACCT-014: MISSING. W-9, reportable payment calculation, Nelco filing and correction workflows are absent.

### Resident account access and shared documents

**Covered** — mapped replacement acceptance passed.

Official documentation: [AppFolio online portal help](https://www.appfolio.com/help/online-portal) — Online portal access, multiple units and documents; reviewed 2026-11-04.

- [PORTAL-001](../CONTRACT.md) — **DONE**: Give residents a complete account portal. Matching acceptance: “Sign in as a resident with two leases, inspect an itemized balance, pay rent, download a receipt and update contact preferences; direct access to an unrelated household is denied.”
  - Evidence: `tests/card-payments.mjs` — journey, registered as PAY-003 in `tests/terrace.test.mjs`, with `tests/resident-account.mjs` — accountBefore and accountPaid: two-lease resident sign-in; populated current and future itemized charges and household obligations; separate native deposits; pending funds that do not reduce the balance; explicit hosted card consent and canonical once-only provider receipts; tagged receipt PDF and source amount; primary and co-tenant contact preferences, optional-email admission, no destination changes and no sends; unrelated household, private guarantor, screening and delegate refusal; staff portfolio 404 and role 403; stale email-link bank-change refusal with no stored bank details; restart, revoked sessions, erased sharing and older-archive resurrection refusal. `tests/retention.mjs` — retentionJourney: an explicit historic account grant retains its itemized balance while even a shared original still requires current household entitlement. `tests/resident-account-browser.mjs` — resident account browser journey, invoked by push Verify: owner sharing, two leases, itemized account, future charges, contact Settings and receipt downloads asserted at 1440, with captures at 1440 and 390 and staff icon tooltip focus and hover. Only Stripe is faked at its network edge; PAY-003 test mode and bank-settlement boundaries remain explicit.
  - Gap: None in the contract row.

### Owner financial and property access

**Partial** — gap remains.

Official documentation: [AppFolio owner portal help](https://www.appfolio.com/help/owner) — Reports and published packets; reviewed 2026-11-04.

- [PORTAL-002](../CONTRACT.md) — **PARTIAL**: Give owners their financial and property portal. Matching acceptance: “Joint owners inspect different ownership periods, approve an over-limit repair, contribute funds and download a statement&#47;invoice; access another owner’s report and screening file is denied.”
  - Evidence: `tests/statements.mjs` — "journey", invoked by the ACCT-012 registration in `tests/terrace.test.mjs`: exact seller and buyer invoice originals on either side of a transfer, expense cents and CSV isolation, absent and other-owner files refused, staff cookies excluded, screening refusal, shared originals held, changed approval withdrawal, cross-property revision history, restart, immediate revocation, audit and native restore with fresh authorization. `tests/statements-browser.mjs`: native owner statement expense, fee and reserve sections and invoice downloads at 1440 and 390.
  - Gap: Occupancy and rent detail, complete distribution status and documents, owner contributions, communication, over-limit repair decisions with PORTAL-007 riders, joint-owner original disclosure and staff bank-change fresh-proof assertions remain unproved. Adopted conservative original-disclosure default pending ct: a live owner grant reads only an exact currently approved invoice attachment when every historical allocation belongs wholly to that owner on its invoice date; shared-beneficiary originals stay with staff for review. No new payment, send, bank-change or approval authority.

**Uncovered:** PORTAL-002: PARTIAL. Occupancy and rent detail, complete distribution status and documents, owner contributions, communication, over-limit repair decisions with PORTAL-007 riders, joint-owner original disclosure and staff bank-change fresh-proof assertions remain unproved. Adopted conservative original-disclosure default pending ct: a live owner grant reads only an exact currently approved invoice attachment when every historical allocation belongs wholly to that owner on its invoice date; shared-beneficiary originals stay with staff for review. No new payment, send, bank-change or approval authority.

### Owner portal contributions

**Partial** — gap remains.

Official documentation: [AppFolio owner portal help](https://www.appfolio.com/help/owner) — Make a contribution; reviewed 2026-11-04.

- [PORTAL-002](../CONTRACT.md) — **PARTIAL**: Give owners their financial and property portal. Matching acceptance: “Joint owners inspect different ownership periods, approve an over-limit repair, contribute funds and download a statement&#47;invoice; access another owner’s report and screening file is denied.”
  - Evidence: `tests/statements.mjs` — "journey", invoked by the ACCT-012 registration in `tests/terrace.test.mjs`: exact seller and buyer invoice originals on either side of a transfer, expense cents and CSV isolation, absent and other-owner files refused, staff cookies excluded, screening refusal, shared originals held, changed approval withdrawal, cross-property revision history, restart, immediate revocation, audit and native restore with fresh authorization. `tests/statements-browser.mjs`: native owner statement expense, fee and reserve sections and invoice downloads at 1440 and 390.
  - Gap: Occupancy and rent detail, complete distribution status and documents, owner contributions, communication, over-limit repair decisions with PORTAL-007 riders, joint-owner original disclosure and staff bank-change fresh-proof assertions remain unproved. Adopted conservative original-disclosure default pending ct: a live owner grant reads only an exact currently approved invoice attachment when every historical allocation belongs wholly to that owner on its invoice date; shared-beneficiary originals stay with staff for review. No new payment, send, bank-change or approval authority.

**Uncovered:** PORTAL-002: PARTIAL. Occupancy and rent detail, complete distribution status and documents, owner contributions, communication, over-limit repair decisions with PORTAL-007 riders, joint-owner original disclosure and staff bank-change fresh-proof assertions remain unproved. Adopted conservative original-disclosure default pending ct: a live owner grant reads only an exact currently approved invoice attachment when every historical allocation belongs wholly to that owner on its invoice date; shared-beneficiary originals stay with staff for review. No new payment, send, bank-change or approval authority. Actual owner contribution collection and settlement are not established.

### Assigned vendor work and invoice portal

**Partial** — gap remains.

Official documentation: [AppFolio vendor portal help](https://www.appfolio.com/help/vendor-portal) — Work orders, estimates and invoices; reviewed 2026-11-04.

- [PORTAL-003](../CONTRACT.md) — **PARTIAL**: Give vendors a work and invoice portal. Matching acceptance: “Invite a plumber to one job, accept an appointment, upload evidence and an invoice and read payment state; after reassignment revoke the access details and deny every other vendor job.”
  - Evidence: `tests/portal.mjs` — "journey": live vendor invitation, exact approved-work acceptance and decline, explicit confirmation, qualification hold, same-response retry, conflicting-response refusal, assignment revocation and credential-free archive restore. `tests/documents-browser.mjs`: native response review and accepted result at 1440 and 390.  `tests/portal.mjs` — "journey": vendor appointment confirmation and cancellation, unrelated-person refusal, Origin and consent checks, stale revision and qualification refusals, concurrent identical confirmation, conflicting retry, restart retry, separate resident confirmation, cancellation under a qualification hold, reassignment revocation and restored event custody. `tests/documents-browser.mjs`: appointment response review and cancelled result at 1440 and 390.  `tests/portal.mjs` — "journey": estimate scope, consent, validation and qualification refusals, identical concurrent submission, native quote comparison, staff role and portfolio refusals, selection reopening spend approval, reassignment and restored estimate custody. `tests/documents-browser.mjs`: native estimate submission at 1440 and 390.  `tests/portal.mjs` — "journey": staff-review-only appointment proposals, exact retries, qualification and assignment guards, property-time validation, native backup; vendor invoice originals into ACCT-007, duplicate supplier invoices and original bytes, exact derived property and work allocation, pending-to-approved payable through staff authority, role and portfolio refusals.  `tests/portal.mjs` — "journey": fresh proof on bank preparation and independent verification, self-verification refusal, replacement holds and portal exclusion. `tests/vendor-proposals-browser.mjs`: native availability, invoice and Settings bank-verification end states at 1440 and 390; heavy job 20261025T234243288885Z-heavy-slot-2d234c53.
  - Gap: Vendor-origin completion originals integrated with WORK-007 and WORK-008; authorized access-detail disclosure and time-window enforcement; CT approval of the new availability, invoice and bank-reference authority and custody defaults; independent exact-SHA runtime acceptance outside the builder. ADOPTED defaults: current assigned qualified vendors explicitly submit availability and original invoices for staff review only; staff retain booking, resident permission, notice, entry, allocation, revision and payable approval authority. Owner prepares external bank references; a different authorized person verifies the exact revision with fresh proof. Submission grants no notification or payment authority. ACCT-008 and ACCT-018 retain payment execution.

**Uncovered:** PORTAL-003: PARTIAL. Vendor-origin completion originals integrated with WORK-007 and WORK-008; authorized access-detail disclosure and time-window enforcement; CT approval of the new availability, invoice and bank-reference authority and custody defaults; independent exact-SHA runtime acceptance outside the builder. ADOPTED defaults: current assigned qualified vendors explicitly submit availability and original invoices for staff review only; staff retain booking, resident permission, notice, entry, allocation, revision and payable approval authority. Owner prepares external bank references; a different authorized person verifies the exact revision with fresh proof. Submission grants no notification or payment authority. ACCT-008 and ACCT-018 retain payment execution.

### Submit and track resident repair requests

**Covered** — mapped replacement acceptance passed.

Official documentation: [AppFolio online portal help](https://www.appfolio.com/help/online-portal) — Submit or check on a maintenance request; reviewed 2026-11-04.

- [PORTAL-004](../CONTRACT.md) — **DONE**: Receive resident maintenance requests. Matching acceptance: “Submit a leaking-tap request with photo and access restrictions, add another household report and follow the tracking link through scheduled work and resident-confirmed resolution.”
  - Evidence: `tests/portal-requests.mjs` — "journey" invoked by `tests/portal.mjs` — "journey" in the ROLE-002 registration of `tests/terrace.test.mjs`: leaking-tap report with original photo, access restrictions, pets and preferred times; exact video bytes; private tracking and scheduled work; second verified mailbox with a separate original concern and answer; resident confirmation without closing another report or the work order; staff role 403 and portfolio 404 on linking and original review; unrelated resident, delegated contact, owner and vendor refusal; gas-smell WORK-001 case with frozen approved guidance version, on-call email and replay without a duplicate alert; fresh authorized invitations after restore with original media and no restored credentials. `tests/portal-requests-browser.mjs`: intake, receipt, tracking, scheduled work, answer, resolution, emergency guidance, staff review and urgent queue at 1440 and 390; text-labelled portal controls and staff hover and keyboard tooltips.
  - Gap: None in the contract row.

### Coordinate resident and technician availability

**Partial** — gap remains.

Official documentation: [AppFolio vendor portal help](https://www.appfolio.com/help/vendor-portal) — Scheduling with work orders; reviewed 2026-11-04.

- [WORK-005](../CONTRACT.md) — **PARTIAL**: Book appointments and resident access. Matching acceptance: “Book a repair, receive resident confirmation, cancel from the vendor portal and reschedule with a new permitted access window; notify both parties and preserve appointment history.”
  - Evidence: `tests/appointments.mjs` — "journey": permission, qualification, calendars, cancellation, rescheduling and report timing. `tests/portal.mjs` — "journey": vendor-portal confirmation and cancellation. `tests/messages.mjs` — "journey": reviewed arrival text, unanswered window stays proposed, signed Y confirms once after vendor confirmation, cancelled and changed-work windows stay unconfirmed, separately approved cancellation emails to both parties. `tests/messages-browser.mjs`: arrival confirmation and reply history at 1440 and 390.
  - Gap: Resident communication consent and signed-reply authority defaults await ct approval. Actual arrival-text delivery and resident-origin reply remain unproved under TEST-only authorization; signed fixtures prove native routing only. Notifications require separate exact-content human approval; no automatic notification is authorized. CT 26 October 2026 approves the current-invitation signed-reply policy WITH RIDERS, separate from resident entry permission and vendor confirmation. Earlier pending-policy wording is historical. Actual delivery, resident-origin reply proof, separately approved notifications and independent runtime and browser evidence remain gaps. Status remains partial.

**Uncovered:** WORK-005: PARTIAL. Resident communication consent and signed-reply authority defaults await ct approval. Actual arrival-text delivery and resident-origin reply remain unproved under TEST-only authorization; signed fixtures prove native routing only. Notifications require separate exact-content human approval; no automatic notification is authorized. CT 26 October 2026 approves the current-invitation signed-reply policy WITH RIDERS, separate from resident entry permission and vendor confirmation. Earlier pending-policy wording is historical. Actual delivery, resident-origin reply proof, separately approved notifications and independent runtime and browser evidence remain gaps. Status remains partial.

### Dispatch and track approved work

**Covered** — mapped replacement acceptance passed.

Official documentation: [AppFolio maintenance](https://www.appfolio.com/property-manager/maintenance) — Work orders and in-house maintenance; reviewed 2026-11-04.

- [WORK-006](../CONTRACT.md) — **DONE**: Dispatch and track technician progress. Matching acceptance: “Dispatch an approved order, receive vendor acceptance and a parts hold, miss its appointment and reassign it; inspect notifications, state history and a still-open resident issue.”
  - Evidence: `migrations/core/0049_dispatch.sql`; `src/terrace/dispatch.ts`; `src/terrace/dispatch-mail.ts`; `src/terrace/dispatch-view.ts`; `tests/dispatch.mjs`; `tests/dispatch-browser.mjs`; `tests/terrace.test.mjs`
  - Gap: None in the contract row.

### Request and approve repair estimates

**Covered** — mapped replacement acceptance passed.

Official documentation: [AppFolio vendor portal help](https://www.appfolio.com/help/vendor-portal) — Estimates and invoices; reviewed 2026-11-04.

- [WORK-003](../CONTRACT.md) — **DONE**: Estimate work and obtain owner approval. Matching acceptance: “Compare two repair quotes, request an owner decision above the spending limit, then change the approved scope and verify dispatch remains blocked until the new terms are approved.”
  - Evidence: `migrations/core/0028_quotes.sql`; `src/terrace/quotes.ts`; `src/terrace/quote-view.ts`; `src/terrace/work.ts`; `tests/terrace.test.mjs`
  - Gap: None in the contract row.

### Retain vendor compliance documents

**Partial** — gap remains.

Official documentation: [AppFolio vendor portal help](https://www.appfolio.com/help/vendor-portal) — Upload compliance documents; reviewed 2026-11-04.

- [WORK-004](../CONTRACT.md) — **DONE**: Qualify and assign vendors. Matching acceptance: “Select a plumber by area and insurance status, expire their coverage and attempt reassignment; verify qualification hold and a documented human exception rather than silent dispatch.”
  - Evidence: `migrations/core/0020_vendors.sql`; `src/terrace/vendors.ts`; `src/terrace/vendor-view.ts`; `src/terrace/work.ts`; `tests/terrace.test.mjs`
  - Gap: None in the contract row.

**Uncovered:** Vendor-uploaded compliance originals, document requests and review are not proved by qualification-status checks.

### Close work through its matched invoice

**Missing** — gap remains.

Official documentation: [AppFolio vendor portal help](https://www.appfolio.com/help/vendor-portal) — Needs Invoice, Under Review, Payment Pending and Payment Sent; reviewed 2026-11-04.

- [WORK-009](../CONTRACT.md) — **MISSING**: Match invoice work and owner charge. Matching acceptance: “Submit a completed repair invoice exceeding its quote, flag the unmatched line, approve a corrected invoice and trace work, payable, payment and owner statement without double entry.”
  - Evidence: `src/terrace/bills.ts`; `src/terrace/bills-input.ts`; `src/terrace/bills-authority.ts`; `src/terrace/owners.ts`; `tests/bills.mjs`; `tests/terrace.test.mjs`
  - Gap: Staff-entered bills match supplier, approved work and cumulative estimate, hold excess spend, and post approved owner allocations. Invoice extraction and source locations, labor and material and completion matching, settlement linkage and invoiced maintenance-report costs are absent. WORK-009 remains missing until ACCT-008 and ACCT-012 ship.

- [ACCT-008](../CONTRACT.md) — **MISSING**: Pay vendors and reconcile payment outcomes. Matching acceptance: “Approve a vendor batch, change one bank destination and hold it, execute the unchanged items in the paying account’s ACCT-018 NACHA file and import an R01 return from the bank’s return file; show one payment per bill, a remittance notice per vendor and the reopened returned payable.”
  - Evidence: None recorded.
  - Gap: Vendor payment rails, payee controls and reconciliation are absent.

**Uncovered:** WORK-009: MISSING. Staff-entered bills match supplier, approved work and cumulative estimate, hold excess spend, and post approved owner allocations. Invoice extraction and source locations, labor and material and completion matching, settlement linkage and invoiced maintenance-report costs are absent. WORK-009 remains missing until ACCT-008 and ACCT-012 ship. ACCT-008: MISSING. Vendor payment rails, payee controls and reconciliation are absent.

### Inspect properties from a mobile device

**Partial** — gap remains.

Official documentation: [AppFolio maintenance](https://www.appfolio.com/property-manager/maintenance) — Inspections; reviewed 2026-11-04.

- [WORK-011](../CONTRACT.md) — **PARTIAL**: Complete mobile move-in and move-out inspections. Matching acceptance: “Inspect on a phone offline, sync photos, compare move-out damage to the entry record and reject an unsupported deduction while retaining the resident’s disputed finding.”
  - Evidence: `tests/field-capture.test.mjs` — ‘WORK-011: structured entry&#47;exit findings preserve disputes and refuse unsupported deductions’ (`tests/mobile-inspections.mjs`); `tests/mobile-inspections-browser.mjs` — phone-offline originals, persisted device drafts, manual changed-checklist reconciliation and retained comparison&#47;dispute at 1440/390; `src/terrace/field-evidence-inspections.ts`; `migrations/core/0071_mobile_inspections.sql`
  - Gap: Structured room&#47;asset checklists, original media, readings, sourced acknowledgement&#47;disputes, completed inspections, entry&#47;exit comparison and evidence-gated human work&#47;deduction proposals ship. Adopted conservative default pending ct: new capture/configuration/acknowledgement/proposal doors are owner or portfolio-manager only; offline originals stay on the device only by explicit consent until explicit sync or deletion; acknowledgements are staff-sourced, never resident authentication or signatures; human decisions execute no work or deposit charge.

**Uncovered:** WORK-011: PARTIAL. Structured room&#47;asset checklists, original media, readings, sourced acknowledgement&#47;disputes, completed inspections, entry&#47;exit comparison and evidence-gated human work&#47;deduction proposals ship. Adopted conservative default pending ct: new capture/configuration/acknowledgement/proposal doors are owner or portfolio-manager only; offline originals stay on the device only by explicit consent until explicit sync or deletion; acknowledgements are staff-sourced, never resident authentication or signatures; human decisions execute no work or deposit charge.

### Manage unit turns

**Covered** — mapped replacement acceptance passed.

Official documentation: [AppFolio maintenance](https://www.appfolio.com/property-manager/maintenance) — Unit Turn Board; reviewed 2026-11-04.

- [WORK-013](../CONTRACT.md) — **DONE**: Run make-ready and turnover boards. Matching acceptance: “Move out a resident, delay a repair dependent on inspection, revise the ready date and show cleaning&#47;listing effects; complete checks and publish the true available date.”
  - Evidence: `migrations/core/0024_turnovers.sql`; `src/terrace/turnovers.ts`; `src/terrace/turnover-view.ts`; `tests/terrace.test.mjs`
  - Gap: None in the contract row.

### Export owner financial reports

**Partial** — gap remains.

Official documentation: [AppFolio owner portal help](https://www.appfolio.com/help/owner) — Reports: Excel and CSV export; reviewed 2026-11-04.

- [ACCT-013](../CONTRACT.md) — **DONE**: Report cash and accrual financials. Matching acceptance: “Record earned unpaid rent and an unpaid bill, compare cash and accrual P&L and balance sheet, and drill each difference to its original transaction.”
  - Evidence: `tests/financial-reports.mjs` via `tests/terrace.test.mjs` “ACCT-013: cash and accrual statements reconcile unpaid rent and bills, settlement timing and immutable scoped source drills”: earned unpaid rent, approved unpaid invoice, cash and accrual income and balance-sheet comparison, original-source drills, settlement and reversal timing, trial balance, aging, cash flow, property and owner and entity scope, unchanged ledger, restart and archive restore; `tests/financial-reports-browser.mjs`: native basis and source drill at 1440 and 390, hover and keyboard tooltips; `src/terrace/financial-reports.ts`; `docs/financial-reports.md`
  - Gap: None. Exact inclusive dates, basis timing, oldest-first aging and explicit unassigned entity semantics are documented; no bank verification or tax certification.

- [PORTAL-002](../CONTRACT.md) — **PARTIAL**: Give owners their financial and property portal. Matching acceptance: “Joint owners inspect different ownership periods, approve an over-limit repair, contribute funds and download a statement&#47;invoice; access another owner’s report and screening file is denied.”
  - Evidence: `tests/statements.mjs` — "journey", invoked by the ACCT-012 registration in `tests/terrace.test.mjs`: exact seller and buyer invoice originals on either side of a transfer, expense cents and CSV isolation, absent and other-owner files refused, staff cookies excluded, screening refusal, shared originals held, changed approval withdrawal, cross-property revision history, restart, immediate revocation, audit and native restore with fresh authorization. `tests/statements-browser.mjs`: native owner statement expense, fee and reserve sections and invoice downloads at 1440 and 390.
  - Gap: Occupancy and rent detail, complete distribution status and documents, owner contributions, communication, over-limit repair decisions with PORTAL-007 riders, joint-owner original disclosure and staff bank-change fresh-proof assertions remain unproved. Adopted conservative original-disclosure default pending ct: a live owner grant reads only an exact currently approved invoice attachment when every historical allocation belongs wholly to that owner on its invoice date; shared-beneficiary originals stay with staff for review. No new payment, send, bank-change or approval authority.

**Uncovered:** ACCT-013: None. Exact inclusive dates, basis timing, oldest-first aging and explicit unassigned entity semantics are documented; no bank verification or tax certification. PORTAL-002: PARTIAL. Occupancy and rent detail, complete distribution status and documents, owner contributions, communication, over-limit repair decisions with PORTAL-007 riders, joint-owner original disclosure and staff bank-change fresh-proof assertions remain unproved. Adopted conservative original-disclosure default pending ct: a live owner grant reads only an exact currently approved invoice attachment when every historical allocation belongs wholly to that owner on its invoice date; shared-beneficiary originals stay with staff for review. No new payment, send, bank-change or approval authority.

### Capture source records and reconcile migration

**Missing** — gap remains.

Official documentation: [AppFolio owner portal help](https://www.appfolio.com/help/owner) — Download published statements and documents; reviewed 2026-11-04.

- [MOVE-002](../CONTRACT.md) — **MISSING**: Move in from AppFolio. Matching acceptance: “Use real redacted AppFolio exports and approved API capture where available; preview, import and compare rent roll, deposits, opening trial balance and document counts to the source, holding every unmapped record.”
  - Evidence: None recorded.
  - Gap: AppFolio adapter and reconciled export fixtures are absent.

- [MOVE-001](../CONTRACT.md) — **PARTIAL**: Reconcile complete migration before cutover. Matching acceptance: “Load a multi-property source with a missing deposit, duplicate household, vendor without a W-9 and a commercial lease held as an exception (BOUND-004), preview without writes, reconcile counts and balances, resolve exceptions and approve the exact migration manifest.”
  - Evidence: `tests/migration.mjs` — journey, called by the MOVE-009 registration in `tests/terrace.test.mjs`: multi-property source and vacant units; field mapping and every native record kind; missing deposit, duplicate household, missing W-9 and commercial holds; zero-write preview; source counts and excluded dispositions; resolved exceptions and exact manifest approval; eleven source and native opening accounts with zero difference or retained named exception; document originals, vendor and owner balance-forwards, five resident history kinds, native bill approval without duplicate balances, attribution, owner-only and revoked-credential refusal, restart, archive restore, shared-source legal holds, unrelated source preservation and erasure non-resurrection. `tests/migration-browser.mjs`: native preview, retained manifest and resident history, called on push Verify, with proof at 1440 and 390 and focus and hover tooltips. Native deposit links and separate 50000 and 20000 cent liabilities are asserted by the same migration journey; dropping native deposit writes fails its native journal assertion.
  - Gap: CT 28 October 2026 A16 and R1 demotion retained. Separate native deposit link and individual-amount assertions now pass, independently of the 70000 cent opening aggregate, and the deposit-write mutation is rejected; fresh judgment of these changed rows remains pending.

- [MOVE-010](../CONTRACT.md) — **PARTIAL**: Carry vendors year-to-date tax and resident ledger history. Matching acceptance: “Import an AppFolio vendor directory and year-to-date 1099 totals with a 30 June cutover, pay the same vendor in Terrace and produce one 1099 whose total equals pre-cutover plus post-cutover payments; show a migrated resident’s pre-cutover ledger lines in the resident ledger, on the eviction ledger export and on the deposit disposition statement, with the opening balance equal to the history’s closing balance.”
  - Evidence: `tests/migration.mjs` journey: restricted vendor directory and W-9 hold, vendor and owner year-to-date balance-forwards, five source-referenced resident history kinds, staff and resident monthly statements, opening balance and no duplicate cash.
  - Gap: AppFolio-format source adapter and independent incumbent summary reconciliation; complete owner and vendor tax carry-forward with post-cutover payments and one 1099 (ACCT-014 requires the unavailable Nelco filing account); eviction ledger export and deposit disposition integration (ACCT-004 awaits PORT-008 counsel content); complete 24-month statement and export proof remain owed.

**Uncovered:** MOVE-002: MISSING. AppFolio adapter and reconciled export fixtures are absent. MOVE-001: PARTIAL. CT 28 October 2026 A16 and R1 demotion retained. Separate native deposit link and individual-amount assertions now pass, independently of the 70000 cent opening aggregate, and the deposit-write mutation is rejected; fresh judgment of these changed rows remains pending. MOVE-010: PARTIAL. AppFolio-format source adapter and independent incumbent summary reconciliation; complete owner and vendor tax carry-forward with post-cutover payments and one 1099 (ACCT-014 requires the unavailable Nelco filing account); eviction ledger export and deposit disposition integration (ACCT-004 awaits PORT-008 counsel content); complete 24-month statement and export proof remain owed.

### Qualify shadow rent and payment cutover

**Partial** — gap remains.

Official documentation: [AppFolio online portal help](https://www.appfolio.com/help/online-portal) — Existing scheduled auto payments; reviewed 2026-11-04.

- [MOVE-008](../CONTRACT.md) — **PARTIAL**: Shadow run and control payment cutover. Matching acceptance: “Shadow a rent cycle against source statements, hold a difference, approve a corrected cutover and demonstrate a retained old autopay cannot create a second Terrace collection; show every mandate’s reauthorization state.”
  - Evidence: `tests/shadow-run.mjs` — owner documentary rent comparison journey, registered through `tests/terrace.test.mjs`: exact source bytes and mapped rows; per-lease opening receivable, charges, recorded receipts, reductions and closing receivable; offsetting differences, missing and duplicate mappings, separate currencies, accountable held next actions, distinct corrected-source review, native-event invalidation even when opening totals are unchanged, non-owner and credential refusal, restart, accounting retention, shared legal holds, erasure and inert restore. `tests/shadow-run-browser.mjs` — native documentary capture and review at 1440 with screenshots at 1440 and 390, on push Verify.
  - Gap: Documentary rent comparison only; authentic incumbent shadow-cycle qualification, fees, complete owner statements, bank matching and future-schedule comparison remain outstanding. Cutover-date approval, period-by-period collecting-system authority, processor mandate reauthorization, stopping old scheduled collection and prevention of duplicate rent, deposit and payout execution remain unimplemented. Owner-only record custody is the conservative interim default under the standing scope rule; scoped delegation and provider boundaries remain unqualified. PAY-002 and PAY-004 authorized processor environments; PAY-003 live receipt, decline, 3DS and replay; mapped-bank settlement, authorized production configuration and CT card authority, consent and fee approval remain unqualified; PAY-005 stays CT-held. ACCT-003 and ACCT-004 remain blocked on PORT-008 counsel; trust, fee, refund and owner-statement disclosure approvals and payout-rail account and authorization holds are unchanged. Synthetic originals prove no authentic incumbent outcome.

**Uncovered:** MOVE-008: PARTIAL. Documentary rent comparison only; authentic incumbent shadow-cycle qualification, fees, complete owner statements, bank matching and future-schedule comparison remain outstanding. Cutover-date approval, period-by-period collecting-system authority, processor mandate reauthorization, stopping old scheduled collection and prevention of duplicate rent, deposit and payout execution remain unimplemented. Owner-only record custody is the conservative interim default under the standing scope rule; scoped delegation and provider boundaries remain unqualified. PAY-002 and PAY-004 authorized processor environments; PAY-003 live receipt, decline, 3DS and replay; mapped-bank settlement, authorized production configuration and CT card authority, consent and fee approval remain unqualified; PAY-005 stays CT-held. ACCT-003 and ACCT-004 remain blocked on PORT-008 counsel; trust, fee, refund and owner-statement disclosure approvals and payout-rail account and authorization holds are unchanged. Synthetic originals prove no authentic incumbent outcome.

### Purchase resident insurance

**Unsupported** — gap remains.

Official documentation: [AppFolio online portal help](https://www.appfolio.com/help/online-portal) — Sign up for renters insurance through FolioSpace; reviewed 2026-11-04.

Replacement: intentionally unmapped. Status: unsupported. Evidence: none. Gap: Unsupported and intentionally unmapped: Terrace has no resident insurance purchase or policy placement replacement.

**Uncovered:** Unsupported and intentionally unmapped: Terrace has no resident insurance purchase or policy placement replacement.

### Autonomous prospect communication and follow-up

**Unsupported** — gap remains.

Official documentation: [AppFolio marketing and leasing](https://www.appfolio.com/property-manager/marketing-leasing) — Realm-X Leasing Performer; reviewed 2026-11-04.

Replacement: intentionally unmapped. Status: unsupported. Evidence: none. Gap: Unsupported and intentionally unmapped: human prospect records do not replace autonomous lead response and nurturing.

**Uncovered:** Unsupported and intentionally unmapped: human prospect records do not replace autonomous lead response and nurturing.

### Assess and waive late fees

**Partial** — gap remains.

Official documentation: [AppFolio accounting and reporting](https://www.appfolio.com/property-manager/accounting-reporting) — Automated Late Fees and Late Fee Waivers; reviewed 2026-11-04.

- [PAY-006](../CONTRACT.md) — **PARTIAL**: Calculate late fees and grace periods. Matching acceptance: “Run a late-fee schedule across a weekend, record a timely pending payment that settles later and waive one fee; inspect charge basis, policy version and auditable waiver.”
  - Evidence: `tests/payer-accounting.test.mjs` — PAY-006: reviewed state caps, weekend and holiday grace, timely pending settlement and reasoned waivers retain original calculations (`tests/late-fees.mjs`): weekend&#47;holiday schedule and delayed settlement, basis/version/citation, waiver, state cap comparison, reversal hold, no compounding, restart/restore. `tests/late-fees-browser.mjs`: native review/post/waiver, 1440/390 and keyboard tooltip.
  - Gap: Adopted default pending ct: owner-only fee configuration, manual reviewed schedule posting and waivers; no automatic collections, notices or paid-fee reversal. All stated acceptance examples use synthetic owner-reviewed pack fixtures, not Terrace counsel review. Other fee bases are visibly held; PORT-008 reviewed authored contents remain open. DONE awaits ct approval of the authority and execution default.

**Uncovered:** PAY-006: PARTIAL. Adopted default pending ct: owner-only fee configuration, manual reviewed schedule posting and waivers; no automatic collections, notices or paid-fee reversal. All stated acceptance examples use synthetic owner-reviewed pack fixtures, not Terrace counsel review. Other fee bases are visibly held; PORT-008 reviewed authored contents remain open. DONE awaits ct approval of the authority and execution default.

### Hold and refund applicant deposits

**Missing** — gap remains.

Official documentation: [AppFolio accounting and reporting](https://www.appfolio.com/property-manager/accounting-reporting) — Holding Deposits; reviewed 2026-11-04.

- [ACCT-003](../CONTRACT.md) — **MISSING**: Receive hold and accrue security deposits. Matching acceptance: “Collect a deposit in installments, accrue reviewed interest and transfer ownership; inspect bank, beneficiary and tenant balances and receipts without recognizing rent revenue.”
  - Evidence: None recorded.
  - Gap: Security-deposit liabilities, custody, receipts and interest rules are absent.

- [ACCT-004](../CONTRACT.md) — **MISSING**: Complete deposit disposition and refunds. Matching acceptance: “Prepare a move-out with damage and normal wear, approve only supported deductions, deliver the disposition and execute the approved refund; verify deadline, proof and remaining deposit liability.”
  - Evidence: None recorded.
  - Gap: Deposit dispositions, deadlines, deductions and refunds are absent.

**Uncovered:** ACCT-003: MISSING. Security-deposit liabilities, custody, receipts and interest rules are absent. ACCT-004: MISSING. Deposit dispositions, deadlines, deductions and refunds are absent. Applicant holding-deposit escrow and refunds remain unqualified; a recorded liability is not settled escrow or refund execution.

### Track loans

**Unsupported** — gap remains.

Official documentation: [AppFolio accounting and reporting](https://www.appfolio.com/property-manager/accounting-reporting) — Loan Tracking; reviewed 2026-11-04.

Replacement: intentionally unmapped. Status: unsupported. Evidence: none. Gap: Unsupported and intentionally unmapped: Terrace has no loan tracking replacement.

**Uncovered:** Unsupported and intentionally unmapped: Terrace has no loan tracking replacement.

### Track and reconcile commercial common-area charges

**Unsupported** — gap remains.

Official documentation: [AppFolio accounting and reporting](https://www.appfolio.com/property-manager/accounting-reporting) — CAM Tracking and Reconciliation; reviewed 2026-11-04.

Replacement: intentionally unmapped. Status: unsupported. Evidence: none. Gap: Unsupported and intentionally unmapped: Terrace has no commercial common-area accounting replacement; the residential boundary grants no coverage.

**Uncovered:** Unsupported and intentionally unmapped: Terrace has no commercial common-area accounting replacement; the residential boundary grants no coverage.

### Autonomously triage and dispatch maintenance

**Unsupported** — gap remains.

Official documentation: [AppFolio maintenance](https://www.appfolio.com/property-manager/maintenance) — Realm-X Maintenance Performer; reviewed 2026-11-04.

Replacement: intentionally unmapped. Status: unsupported. Evidence: none. Gap: Unsupported and intentionally unmapped: manual work dispatch does not replace autonomous image analysis, emergency triage or vendor outsourcing.

**Uncovered:** Unsupported and intentionally unmapped: manual work dispatch does not replace autonomous image analysis, emergency triage or vendor outsourcing.

## Buildium

7 of 42 documented functions have covered replacement acceptance; 35 remain gaps. Full switch: unqualified.

### Publish vacancies and property listings

**Missing** — gap remains.

Official documentation: [Buildium rental listing syndication](https://www.buildium.com/features/rental-listing-syndication/) — Property details, photos and vacancies; reviewed 2026-11-04.

- [LEASE-001](../CONTRACT.md) — **MISSING**: Publish property marketing and vacancies. Matching acceptance: “Publish two vacant units, submit an enquiry on mobile, lease one and confirm its vacancy is withdrawn while the other remains available with the approved price and fees.”
  - Evidence: None recorded.
  - Gap: Property marketing and vacancy publication are absent.

**Uncovered:** LEASE-001: MISSING. Property marketing and vacancy publication are absent.

### Syndicate listings to Zillow

**Missing** — gap remains.

Official documentation: [Buildium rental listing syndication](https://www.buildium.com/features/rental-listing-syndication/) — Zillow Rental Network; reviewed 2026-11-04.

- [LEASE-002](../CONTRACT.md) — **MISSING**: Syndicate listings to Zillow. Matching acceptance: “Publish through the provider test boundary, correct a rejected fee field, change rent and withdraw the listing; show acknowledgments and the same external listing identity without duplicates.”
  - Evidence: None recorded.
  - Gap: Zillow connection and listing status reconciliation are absent.

**Uncovered:** LEASE-002: MISSING. Zillow connection and listing status reconciliation are absent.

### Syndicate listings to Apartments.com

**Missing** — gap remains.

Official documentation: [Buildium rental listing syndication](https://www.buildium.com/features/rental-listing-syndication/) — Supported rental listing websites; reviewed 2026-11-04.

- [LEASE-003](../CONTRACT.md) — **MISSING**: Syndicate listings to Apartments.com. Matching acceptance: “Submit the same unit to Apartments.com, process a rejection and later success, update availability and remove it after lease execution; trace each provider result to the unit.”
  - Evidence: None recorded.
  - Gap: Apartments.com distribution is absent.

**Uncovered:** LEASE-003: MISSING. Apartments.com distribution is absent.

### Syndicate listings to Zumper

**Missing** — gap remains.

Official documentation: [Buildium rental listing syndication](https://www.buildium.com/features/rental-listing-syndication/) — Supported rental listing websites; reviewed 2026-11-04.

- [LEASE-004](../CONTRACT.md) — **MISSING**: Extend listing reach with Zumper and RentCafe. Matching acceptance: “Enable each adapter in its supported environment, publish and withdraw a unit, receive an enquiry and demonstrate that an unentitled account cannot appear connected or published.”
  - Evidence: None recorded.
  - Gap: Zumper and RentCafe adapters are absent.

**Uncovered:** LEASE-004: MISSING. Zumper and RentCafe adapters are absent.

### Syndicate to additional listing networks

**Unsupported** — gap remains.

Official documentation: [Buildium rental listing syndication](https://www.buildium.com/features/rental-listing-syndication/) — Apartment List, Dwellsy, RentPath and Rental Beast; reviewed 2026-11-04.

Replacement: intentionally unmapped. Status: unsupported. Evidence: none. Gap: Unsupported and intentionally unmapped: the named additional networks have no Terrace adapters; the Zillow mapping does not cover them.

**Uncovered:** Unsupported and intentionally unmapped: the named additional networks have no Terrace adapters; the Zillow mapping does not cover them.

### Take online applications and fees

**Partial** — gap remains.

Official documentation: [Buildium online rent payments](https://www.buildium.com/features/online-rent-payments/) — Online application and integrated accounting; reviewed 2026-11-04.

- [LEASE-007](../CONTRACT.md) — **PARTIAL**: Take complete online applications. Matching acceptance: “Two co-applicants save and resume, upload income evidence and submit; manager requests one missing document and sees revisions and fee outcome without card data in Terrace.”
  - Evidence: `tests/applications.mjs` journey: two private adult drafts, resume through a fresh email link after sign-out with the old session refused, income originals, required disclosure consent, submitted answers, manager requests and immutable revisions, verified fee outcomes without card objects, scope refusal, revocation, archive recovery and erasure fences; `tests/applications-browser.mjs`: native forms and revision screens at desktop and phone widths; `tests/applications-sandbox.mjs`: held Stripe test hosted fee and canonical event proof
  - Gap: Conservative interim policy under the standing scope rule: owner-only roster, fee preparation, invitations, revocation, retention holds and erasure; scoped portfolio managers read and request evidence; each adult controls only their answers and one explicitly consented household fee. CT approval of applicant authority, custody, retention and fee policy remains pending; scoped leasing delegation and production provider boundaries remain owed. Activated PORT-008 disclosure text is frozen and acknowledged, but synthetic counsel fixtures do not prove legally sufficient application disclosures.

**Uncovered:** LEASE-007: PARTIAL. Conservative interim policy under the standing scope rule: owner-only roster, fee preparation, invitations, revocation, retention holds and erasure; scoped portfolio managers read and request evidence; each adult controls only their answers and one explicitly consented household fee. CT approval of applicant authority, custody, retention and fee policy remains pending; scoped leasing delegation and production provider boundaries remain owed. Activated PORT-008 disclosure text is frozen and acknowledged, but synthetic counsel fixtures do not prove legally sufficient application disclosures.

### Order screening and review applicants

**Missing** — gap remains.

Official documentation: [Buildium tenant background checks](https://www.buildium.com/features/tenant-background-checks/) — TransUnion screening results and criteria; reviewed 2026-11-04.

- [LEASE-008](../CONTRACT.md) — **MISSING**: Order consented TransUnion screening. Matching acceptance: “Submit a consented application to the provider sandbox, receive a delayed report and duplicate callback, deny an unauthorized report download and show provider errors without fabricating a screening result.”
  - Evidence: None recorded.
  - Gap: Screening integration, consent and restricted reports are absent.

- [LEASE-009](../CONTRACT.md) — **PARTIAL**: Review applicants and adverse actions. Matching acceptance: “Review two applications, flag a disputed report, require a manager decision and send an explicitly approved adverse-action package with the correct provider reference and recorded delivery.”
  - Evidence: `tests/applications.mjs` — existing application journey, registered in `tests/terrace.test.mjs`: two separate submitted applications under one explicitly supplied previously disclosed criterion; integer-cent and fractional-cent thresholds, recomputation, missing and contested holds, staff verification provenance, submitted revisions and original hashes, stale-source refusal, role and credential refusal, portfolio 404 and live revocation, private originals and unchanged applicant, financial, grant and custody records. `tests/applications-browser.mjs` — native source selection and income review, recomputation and contested hold with stale-source refusal; push Verify invokes the script, with desktop assertions and 1440 and 390 proof.
  - Gap: Read-only income-criterion review is implemented; it is not a human applicant decision or screening report. CT approval of applicant authority, custody, retention and fee policy remains pending; scoped leasing delegation and production provider boundaries remain owed. Terrace counsel engagement and counsel-reviewed authored pack and template contents remain unavailable, so legally sufficient disclosures and adverse-action contents remain unqualified. TransUnion onboarding, authorized screening sandbox, real reports and provider provenance remain outstanding. Human approval and decline recording, accommodation and contested-report referral workflows, approved adverse-action packages, correct dispute and provider contacts, applicant approval and decline notice delivery evidence and screening-file export history with outcome “exported” remain owed.

**Uncovered:** LEASE-008: MISSING. Screening integration, consent and restricted reports are absent. LEASE-009: PARTIAL. Read-only income-criterion review is implemented; it is not a human applicant decision or screening report. CT approval of applicant authority, custody, retention and fee policy remains pending; scoped leasing delegation and production provider boundaries remain owed. Terrace counsel engagement and counsel-reviewed authored pack and template contents remain unavailable, so legally sufficient disclosures and adverse-action contents remain unqualified. TransUnion onboarding, authorized screening sandbox, real reports and provider provenance remain outstanding. Human approval and decline recording, accommodation and contested-report referral workflows, approved adverse-action packages, correct dispute and provider contacts, applicant approval and decline notice delivery evidence and screening-file export history with outcome “exported” remain owed.

### Compose lease templates and addenda

**Missing** — gap remains.

Official documentation: [Buildium online leasing](https://www.buildium.com/features/online-leasing/) — Flexible document templates and autofill fields; reviewed 2026-11-04.

- [LEASE-010](../CONTRACT.md) — **MISSING**: Compose jurisdiction-reviewed lease templates. Matching acceptance: “Generate a lease with co-signers, pet addendum and local disclosure, detect a missing required input and approve a changed term while preserving the template version and redline.”
  - Evidence: None recorded.
  - Gap: Lease template assembly and reviewed jurisdiction packs are absent.

**Uncovered:** LEASE-010: MISSING. Lease template assembly and reviewed jurisdiction packs are absent.

### Execute leases with ordered signatures

**Missing** — gap remains.

Official documentation: [Buildium online leasing](https://www.buildium.com/features/online-leasing/) — Signer order, reminders and status updates; reviewed 2026-11-04.

- [LEASE-011](../CONTRACT.md) — **MISSING**: Collect legally evidenced electronic signatures. Matching acceptance: “Send a multi-signer lease, process one decline and a replacement envelope, complete all signatures, replay its callback and attach exactly one executed PDF&#47;certificate to the activated tenancy.”
  - Evidence: None recorded.
  - Gap: E-signature provider&#47;sibling integration and execution lifecycle are absent.

**Uncovered:** LEASE-011: MISSING. E-signature provider&#47;sibling integration and execution lifecycle are absent.

### Collect rent by ACH or e-check

**Missing** — gap remains.

Official documentation: [Buildium online rent payments](https://www.buildium.com/features/online-rent-payments/) — ACH payments and e-checks; reviewed 2026-11-04.

- [PAY-002](../CONTRACT.md) — **MISSING**: Collect rent through ACH. Matching acceptance: “Pay a resident balance through ACH sandbox authorization, restart after provider submission and reconcile pending then settled callbacks without a second debit or exposing bank credentials.”
  - Evidence: None recorded.
  - Gap: ACH collection and processor reconciliation are absent.

**Uncovered:** PAY-002: MISSING. ACH collection and processor reconciliation are absent.

### Collect rent by card

**Partial** — gap remains.

Official documentation: [Buildium online rent payments](https://www.buildium.com/features/online-rent-payments/) — Credit and debit card payments; reviewed 2026-11-04.

- [PAY-003](../CONTRACT.md) — **PARTIAL**: Collect rent by card. Matching acceptance: “Pay a partial balance with a test card requiring authentication, inspect the disclosed fee, complete payment and confirm one resident receipt and matching provider reference.”
  - Evidence: `tests/terrace.test.mjs` — "PAY-003: hosted card consent, policy admission, provider-only receipts, declines, expiry and replay" (`tests/card-payments.mjs`): scoped collection and versioned consent, inherited admission and atomic reservations, fee disclosure, canonical provider events and charge references, decline, expiry, concurrent replay and restart, credential-free restore and demo no-egress; passed at ea40fc1266b84123ea94242354838db93eca6c74 in heavy job 20261026T053952942981Z-heavy-slot-1f69fefb. `tests/card-payments-browser.mjs` — "journey", with --buffered-http: native review, pending and receipt states, staff reconciliation and uncertain-request resumption at 1440 and 390 through actual buffered Worker responses; only Stripe is faked at the network edge. Passed at c3d97576086bf0ca54d74f813846464509445986 in heavy job 20261026T054310729464Z-heavy-slot-7abac798; captures inspected. Provider-only sandbox capture on 26 October 2026: session cs_test_a1aCgX0MIKGGPYAZsRqaGqaK5zUkKkKIFQ87bwQ6m5YzF8t324KUuHTuni, intent pi_3UUfhRDg8BoejKxo4HBAlIoy, event evt_1UUfhSDg8BoejKxoEpx7eoxW, $10.00 USD paid in test mode. The public pre-event ledger contained no receipt. Two admitted live journeys stalled reading the resident return in Chromium although public HTTP returned the pending page. The corrected buffered transport passed the native network-edge journey; its held-key retry was cancelled after nineteen minutes with eight local jobs still ahead and made no provider request.
  - Gap: End-to-end live Stripe ledger receipt, decline, required authentication and provider-event replay remain unproved. Deposit collection and liability require ACCT-003 and PORT-008 counsel-reviewed rules; actual provider settlement into the ACCT-002 mapped banks and authorized production configuration remain unproved. The implementation remains test-only. CT approval of card authority, consent and zero payer fee remains open; PAY-005 stays CT-held and is inherited unchanged.

**Uncovered:** PAY-003: PARTIAL. End-to-end live Stripe ledger receipt, decline, required authentication and provider-event replay remain unproved. Deposit collection and liability require ACCT-003 and PORT-008 counsel-reviewed rules; actual provider settlement into the ACCT-002 mapped banks and authorized production configuration remain unproved. The implementation remains test-only. CT approval of card authority, consent and zero payer fee remains open; PAY-005 stays CT-held and is inherited unchanged.

### Set up and cancel automatic payments

**Missing** — gap remains.

Official documentation: [Buildium resident site help center](https://www.buildium.com/resident-site-help-center/resident-site-help-center/) — Set up, edit and cancel autopay; reviewed 2026-11-04.

- [PAY-004](../CONTRACT.md) — **MISSING**: Manage resident autopay mandates. Matching acceptance: “Authorize capped balance autopay, change the bill above its cap, then cancel before the next run; verify the permitted debit, held exception, notice and canceled attempt.”
  - Evidence: None recorded.
  - Gap: Autopay mandates, schedules and notices are absent.

**Uncovered:** PAY-004: MISSING. Autopay mandates, schedules and notices are absent.

### Choose a payment amount

**Partial** — gap remains.

Official documentation: [Buildium resident site help center](https://www.buildium.com/resident-site-help-center/resident-site-help-center/) — Current balance or other amount; reviewed 2026-11-04.

- [PAY-005](../CONTRACT.md) — **PARTIAL**: Enforce partial and split payment policies. Matching acceptance: “Two co-tenants pay concurrently while one ACH is pending; show allocation, remaining balance and permitted credit, and refuse a partial payment under a reviewed stage-specific block.”
  - Evidence: `tests/payer-accounting.test.mjs` — PAY-005: reviewed lease stages reserve concurrent co-tenant payments, allocate settlement once, separate credit and block partial or excess funds (`tests/payments.mjs`): concurrent co-tenants and ACH reservation, allocation and remaining balance, credit, reviewed stage refusal, signed-lease resident and HAP payer records and preserved bookkeeper authority; restart and restore. `tests/payments-browser.mjs`: native settlement and refusal, 1440/390, keyboard and hover tooltip.
  - Gap: External-record slice only: resident online collection must inherit this policy in PAY-002 and PAY-003; PAY-013 has separate payer entitlement and reconciliation journeys, done at its own ct judgment. Adopted default pending ct: owner-only policy configuration; existing ROLE-001 rent receipt recorders retain payment and outcome authority, no outbound instruction or automatic credit use; DONE awaits ct approval and the remaining payment doors.

**Uncovered:** PAY-005: PARTIAL. External-record slice only: resident online collection must inherit this policy in PAY-002 and PAY-003; PAY-013 has separate payer entitlement and reconciliation journeys, done at its own ct judgment. Adopted default pending ct: owner-only policy configuration; existing ROLE-001 rent receipt recorders retain payment and outcome authority, no outbound instruction or automatic credit use; DONE awaits ct approval and the remaining payment doors.

### Assess late fees under payment policy

**Partial** — gap remains.

Official documentation: [Buildium property management accounting](https://www.buildium.com/features/property-management-accounting/) — Automatic late fee assessment; reviewed 2026-11-04.

- [PAY-006](../CONTRACT.md) — **PARTIAL**: Calculate late fees and grace periods. Matching acceptance: “Run a late-fee schedule across a weekend, record a timely pending payment that settles later and waive one fee; inspect charge basis, policy version and auditable waiver.”
  - Evidence: `tests/payer-accounting.test.mjs` — PAY-006: reviewed state caps, weekend and holiday grace, timely pending settlement and reasoned waivers retain original calculations (`tests/late-fees.mjs`): weekend&#47;holiday schedule and delayed settlement, basis/version/citation, waiver, state cap comparison, reversal hold, no compounding, restart/restore. `tests/late-fees-browser.mjs`: native review/post/waiver, 1440/390 and keyboard tooltip.
  - Gap: Adopted default pending ct: owner-only fee configuration, manual reviewed schedule posting and waivers; no automatic collections, notices or paid-fee reversal. All stated acceptance examples use synthetic owner-reviewed pack fixtures, not Terrace counsel review. Other fee bases are visibly held; PORT-008 reviewed authored contents remain open. DONE awaits ct approval of the authority and execution default.

**Uncovered:** PAY-006: PARTIAL. Adopted default pending ct: owner-only fee configuration, manual reviewed schedule posting and waivers; no automatic collections, notices or paid-fee reversal. All stated acceptance examples use synthetic owner-reviewed pack fixtures, not Terrace counsel review. Other fee bases are visibly held; PORT-008 reviewed authored contents remain open. DONE awaits ct approval of the authority and execution default.

### Collect rent at retail cash locations

**Partial** — gap remains.

Official documentation: [Buildium online rent payments](https://www.buildium.com/features/online-rent-payments/) — Cash Payments; reviewed 2026-11-04.

- [PAY-007](../CONTRACT.md) — **PARTIAL**: Offer cash-at-retail and offline payment options. Matching acceptance: “Generate a cash code, receive and replay its retail transaction, clear a check and return another; reconcile resident balances to settlement batches without treating a printed code as collected rent.”
  - Evidence: `src/terrace/ledger.ts`
  - Gap: Manual external receipts exist; retail network, check deposits and clearance&#47;return states are absent.

**Uncovered:** PAY-007: PARTIAL. Manual external receipts exist; retail network, check deposits and clearance&#47;return states are absent.

### Read resident balance and payment history

**Partial** — gap remains.

Official documentation: [Buildium resident site help center](https://www.buildium.com/resident-site-help-center/resident-site-help-center/) — Current balance and previous transactions; reviewed 2026-11-04.

- [PAY-010](../CONTRACT.md) — **PARTIAL**: Issue resident statements and receipts. Matching acceptance: “Generate a monthly statement, pay part of it, receive a delivered receipt, fail the statement email and inspect the resident portal’s matching balance and delivery task.”
  - Evidence: `tests/payer-accounting.test.mjs` — "PAY-010: resident statements, delivered receipts, failed-email tasks and private accessible downloads" (`tests/resident-statements.mjs`): monthly issuance before partial payment; itemized USD charges, fees, credits, pending funds and matching balance; private source inspection; tagged selectable PDF and CSV; frozen recipient review, explicit sending, delivered receipt and replacement statement; authenticated bounce into one follow-up, completion and replay after restart; household scope, custody, erasure and inert restore. `tests/resident-statements-browser.mjs` — "journey": native month selection, exact frozen downloads, payment source, delivered receipt and statement, matching staff aging, owner preparation, review, explicit send and task completion at 1440 and 390. The three touched API tests and statement browser component passed at ea40fc1266b84123ea94242354838db93eca6c74 in heavy job 20261026T053952942981Z-heavy-slot-1f69fefb; its subsequent independent card-transport component failed and was corrected separately. Screens and PDF inspected. Signed SendGrid outcomes use network-edge fixtures. `tests/resident-statements-live.mjs` — "PAY-010 real QA delivery": SendGrid message I3ne_caQQ2iJKekc32-sJg, delivery 05d4d855-c99d-4fe5-8ca9-2f3ff832503d, actual QA mailbox receipt e3901470-9111-4375-a512-2ba63e25842a received 26 October 2026 at 04:41:02Z; owner-recorded mailbox evidence, receipt $200.00 and matching resident balance $800.00.
  - Gap: CT approval of the adopted owner-only fresh-proof delivery authority, affirmative resident request, current household email eligibility and financial-document custody default remains open. Provider acceptance alone is never delivery.

**Uncovered:** PAY-010: PARTIAL. CT approval of the adopted owner-only fresh-proof delivery authority, affirmative resident request, current household email eligibility and financial-document custody default remains open. Provider acceptance alone is never delivery.

### Maintain the financial transaction ledger

**Covered** — mapped replacement acceptance passed.

Official documentation: [Buildium property management accounting](https://www.buildium.com/features/property-management-accounting/) — Ledger and customizable chart of accounts; reviewed 2026-11-04.

- [ACCT-001](../CONTRACT.md) — **DONE**: Maintain a balanced property ledger. Matching acceptance: “Post rent, deposit, vendor expense and owner contribution across two properties, attempt an unbalanced entry and inspect the trial balance and each subledger back to source.”
  - Evidence: `tests/journal.mjs` (journey, in `tests/terrace.test.mjs` ACCT-001&#47;ACCT-011): rent, deposits, expenses and contributions across two properties; unbalanced and cross-owner&#47;fund refusals; chart&#47;opening entries; trial and owner/property/resident/vendor/deposit subledgers back to sources; duplicate receipt reversal with unchanged originals; live role&#47;scope, migration, restart and archive restore; `tests/journal-browser.mjs`: native posting and filtered subledger at 1440/390; `migrations/core/0056_journal.sql`; `src/terrace/journal.ts`
  - Gap: None in the contract row.

### Keep trust accounting and beneficiary balances

**Partial** — gap remains.

Official documentation: [Buildium property management accounting](https://www.buildium.com/features/property-management-accounting/) — Trust accounting reports; reviewed 2026-11-04.

- [ACCT-002](../CONTRACT.md) — **PARTIAL**: Separate operating trust and deposit accounts. Matching acceptance: “Receive rent and deposits into distinct accounts, attempt an owner payout from deposit funds and an inter-owner transfer, and verify blocked execution and separately reconciled beneficiary balances.”
  - Evidence: `tests/trust.mjs` (journey, via `tests/terrace.test.mjs` “ACCT-002 designated bank custody preserves beneficiary funds through approved transfers”): rent&#47;deposit receipt separation, deposit-funded payout and inter-owner refusal with retained exceptions, per-bank beneficiary balances reconciled to journal, approval/reserve/scope/recovery; `tests/trust-browser.mjs`: native bank configuration, transfer review/approval/external reference and balances at 1440/390; `migrations/core/0059_trust_accounts.sql`; `src/terrace/trust.ts`; `docs/trust-accounts.md`
  - Gap: Ct approval pending for the adopted conservative trust-authorization default: owner-only configuration&#47;assignment, scoped preparation&#47;recording, ROLE-003 human approval, fresh email-link proof and same-beneficiary/property/designated-purpose transfers with a dated source-bank reserve floor. No bank money movement or statement verification is claimed.

**Uncovered:** ACCT-002: PARTIAL. Ct approval pending for the adopted conservative trust-authorization default: owner-only configuration&#47;assignment, scoped preparation&#47;recording, ROLE-003 human approval, fresh email-link proof and same-beneficiary/property/designated-purpose transfers with a dated source-bank reserve floor. No bank money movement or statement verification is claimed.

### Record and reconcile deposits

**Missing** — gap remains.

Official documentation: [Buildium property management accounting](https://www.buildium.com/features/property-management-accounting/) — Bank statements, checks and deposits; reviewed 2026-11-04.

- [ACCT-003](../CONTRACT.md) — **MISSING**: Receive hold and accrue security deposits. Matching acceptance: “Collect a deposit in installments, accrue reviewed interest and transfer ownership; inspect bank, beneficiary and tenant balances and receipts without recognizing rent revenue.”
  - Evidence: None recorded.
  - Gap: Security-deposit liabilities, custody, receipts and interest rules are absent.

**Uncovered:** ACCT-003: MISSING. Security-deposit liabilities, custody, receipts and interest rules are absent.

### Reconcile bank statements

**Partial** — gap remains.

Official documentation: [Buildium property management accounting](https://www.buildium.com/features/property-management-accounting/) — Automatic reconciliations; reviewed 2026-11-04.

- [ACCT-006](../CONTRACT.md) — **DONE**: Match statements and perform three-way reconciliation. Matching acceptance: “Reconcile a month with batched rent, fee, outstanding check, a cleared owner ACH batch and missing deposit; resolve one exception and show the remaining difference prevents a balanced three-way sign-off.”
  - Evidence: `tests/reconcile.mjs` journey: reviewed CSV, OFX, QFX and PDF lines, exact settlement and ACH matching, check numbers, outstanding items, unresolved differences and balanced sign-off, stale books, close refusal, scope and restore; `tests/reconcile-browser.mjs`: native matching and sign-off at desktop and phone widths; `docs/bank-reconciliation.md`
  - Gap: None for current recorded sources. ACCT-017 and ACCT-018 inherit check-register and transmitted-file source matching before their doors ship.

**Uncovered:** ACCT-006: None for current recorded sources. ACCT-017 and ACCT-018 inherit check-register and transmitted-file source matching before their doors ship.

### Record and approve property bills

**Covered** — mapped replacement acceptance passed.

Official documentation: [Buildium property management accounting](https://www.buildium.com/features/property-management-accounting/) — Record every bill and payment; reviewed 2026-11-04.

- [ACCT-007](../CONTRACT.md) — **DONE**: Capture and approve vendor bills. Matching acceptance: “Upload the same invoice twice, split an approved landscaping bill across properties, exceed an owner’s limit and inspect the held bill, approval route and resulting payable.”
  - Evidence: `migrations/core/0041_bills.sql`; `src/terrace/bills.ts`; `src/terrace/bills-input.ts`; `src/terrace/bills-authority.ts`; `src/terrace/bills-templates.ts`; `src/terrace/bills-attachments.ts`; `src/terrace/bills-retention.ts`; `src/terrace/bills-view.ts`; `src/terrace/owners.ts`; `tests/bills.mjs`; `tests/terrace.test.mjs`
  - Gap: None in the contract row.

### Pay vendor bills

**Missing** — gap remains.

Official documentation: [Buildium online rent payments](https://www.buildium.com/features/online-rent-payments/) — Online payments for bills and fees; reviewed 2026-11-04.

- [ACCT-008](../CONTRACT.md) — **MISSING**: Pay vendors and reconcile payment outcomes. Matching acceptance: “Approve a vendor batch, change one bank destination and hold it, execute the unchanged items in the paying account’s ACCT-018 NACHA file and import an R01 return from the bank’s return file; show one payment per bill, a remittance notice per vendor and the reopened returned payable.”
  - Evidence: None recorded.
  - Gap: Vendor payment rails, payee controls and reconciliation are absent.

**Uncovered:** ACCT-008: MISSING. Vendor payment rails, payee controls and reconciliation are absent.

### Calculate management fees

**Covered** — mapped replacement acceptance passed.

Official documentation: [Buildium property management accounting](https://www.buildium.com/features/property-management-accounting/) — Built-in company, owner and vendor calculators; reviewed 2026-11-04.

- [ACCT-009](../CONTRACT.md) — **DONE**: Calculate management fees and owner reserves. Matching acceptance: “Post rent and a lease renewal under a dated fee schedule, calculate fees&#47;reserve, replay the run and inspect the owner statement with the exact agreement references.”
  - Evidence: `migrations/core/0037_fees.sql`; `src/terrace/fees.ts`; `src/terrace/owners.ts`; `src/terrace/owner-view.ts`; `src/terrace/api.ts`; `tests/terrace.test.mjs`
  - Gap: None in the contract row.

### Distribute owner funds

**Missing** — gap remains.

Official documentation: [Buildium property management accounting](https://www.buildium.com/features/property-management-accounting/) — Owner payments and built-in calculators; reviewed 2026-11-04.

- [ACCT-010](../CONTRACT.md) — **MISSING**: Disburse owner funds by ACH or check. Matching acceptance: “Prepare a joint-owner distribution with a pending ACH receipt and unpaid repair, approve cleared funds only, execute it in the trust account’s ACCT-018 NACHA file and import an R01 return for one share from the bank’s return file; show corrected cash and one replacement requiring new approval.”
  - Evidence: None recorded.
  - Gap: Owner distributions, ACH&#47;check execution and return accounting are absent.

**Uncovered:** ACCT-010: MISSING. Owner distributions, ACH&#47;check execution and return accounting are absent.

### Review financial statements

**Partial** — gap remains.

Official documentation: [Buildium property management accounting](https://www.buildium.com/features/property-management-accounting/) — Comprehensive reporting suite; reviewed 2026-11-04.

- [ACCT-013](../CONTRACT.md) — **DONE**: Report cash and accrual financials. Matching acceptance: “Record earned unpaid rent and an unpaid bill, compare cash and accrual P&L and balance sheet, and drill each difference to its original transaction.”
  - Evidence: `tests/financial-reports.mjs` via `tests/terrace.test.mjs` “ACCT-013: cash and accrual statements reconcile unpaid rent and bills, settlement timing and immutable scoped source drills”: earned unpaid rent, approved unpaid invoice, cash and accrual income and balance-sheet comparison, original-source drills, settlement and reversal timing, trial balance, aging, cash flow, property and owner and entity scope, unchanged ledger, restart and archive restore; `tests/financial-reports-browser.mjs`: native basis and source drill at 1440 and 390, hover and keyboard tooltips; `src/terrace/financial-reports.ts`; `docs/financial-reports.md`
  - Gap: None. Exact inclusive dates, basis timing, oldest-first aging and explicit unassigned entity semantics are documented; no bank verification or tax certification.

**Uncovered:** ACCT-013: None. Exact inclusive dates, basis timing, oldest-first aging and explicit unassigned entity semantics are documented; no bank verification or tax certification.

### Create and file owner and vendor 1099s

**Missing** — gap remains.

Official documentation: [Buildium 1099 e-Filing](https://www.buildium.com/features/1099-efiling/) — 1099-MISC and 1099-NEC filing; reviewed 2026-11-04.

- [ACCT-014](../CONTRACT.md) — **MISSING**: Prepare and file owner and vendor 1099s. Matching acceptance: “Prepare owner&#47;vendor forms from reconciled payments, correct an invalid TIN, approve a Nelco submission and process accepted/rejected/corrected outcomes without duplicate filings.”
  - Evidence: None recorded.
  - Gap: W-9, reportable payment calculation, Nelco filing and correction workflows are absent.

**Uncovered:** ACCT-014: MISSING. W-9, reportable payment calculation, Nelco filing and correction workflows are absent.

### Resident access, contacts and shared documents

**Covered** — mapped replacement acceptance passed.

Official documentation: [Buildium resident site help center](https://www.buildium.com/resident-site-help-center/resident-site-help-center/) — Account, lease information and documents; reviewed 2026-11-04.

- [PORTAL-001](../CONTRACT.md) — **DONE**: Give residents a complete account portal. Matching acceptance: “Sign in as a resident with two leases, inspect an itemized balance, pay rent, download a receipt and update contact preferences; direct access to an unrelated household is denied.”
  - Evidence: `tests/card-payments.mjs` — journey, registered as PAY-003 in `tests/terrace.test.mjs`, with `tests/resident-account.mjs` — accountBefore and accountPaid: two-lease resident sign-in; populated current and future itemized charges and household obligations; separate native deposits; pending funds that do not reduce the balance; explicit hosted card consent and canonical once-only provider receipts; tagged receipt PDF and source amount; primary and co-tenant contact preferences, optional-email admission, no destination changes and no sends; unrelated household, private guarantor, screening and delegate refusal; staff portfolio 404 and role 403; stale email-link bank-change refusal with no stored bank details; restart, revoked sessions, erased sharing and older-archive resurrection refusal. `tests/retention.mjs` — retentionJourney: an explicit historic account grant retains its itemized balance while even a shared original still requires current household entitlement. `tests/resident-account-browser.mjs` — resident account browser journey, invoked by push Verify: owner sharing, two leases, itemized account, future charges, contact Settings and receipt downloads asserted at 1440, with captures at 1440 and 390 and staff icon tooltip focus and hover. Only Stripe is faked at its network edge; PAY-003 test mode and bank-settlement boundaries remain explicit.
  - Gap: None in the contract row.

### Owner access to reports and documents

**Partial** — gap remains.

Official documentation: [Buildium property owner portal](https://www.buildium.com/features/property-owner-portal/) — Financial reports and secure documents; reviewed 2026-11-04.

- [PORTAL-002](../CONTRACT.md) — **PARTIAL**: Give owners their financial and property portal. Matching acceptance: “Joint owners inspect different ownership periods, approve an over-limit repair, contribute funds and download a statement&#47;invoice; access another owner’s report and screening file is denied.”
  - Evidence: `tests/statements.mjs` — "journey", invoked by the ACCT-012 registration in `tests/terrace.test.mjs`: exact seller and buyer invoice originals on either side of a transfer, expense cents and CSV isolation, absent and other-owner files refused, staff cookies excluded, screening refusal, shared originals held, changed approval withdrawal, cross-property revision history, restart, immediate revocation, audit and native restore with fresh authorization. `tests/statements-browser.mjs`: native owner statement expense, fee and reserve sections and invoice downloads at 1440 and 390.
  - Gap: Occupancy and rent detail, complete distribution status and documents, owner contributions, communication, over-limit repair decisions with PORTAL-007 riders, joint-owner original disclosure and staff bank-change fresh-proof assertions remain unproved. Adopted conservative original-disclosure default pending ct: a live owner grant reads only an exact currently approved invoice attachment when every historical allocation belongs wholly to that owner on its invoice date; shared-beneficiary originals stay with staff for review. No new payment, send, bank-change or approval authority.

**Uncovered:** PORTAL-002: PARTIAL. Occupancy and rent detail, complete distribution status and documents, owner contributions, communication, over-limit repair decisions with PORTAL-007 riders, joint-owner original disclosure and staff bank-change fresh-proof assertions remain unproved. Adopted conservative original-disclosure default pending ct: a live owner grant reads only an exact currently approved invoice attachment when every historical allocation belongs wholly to that owner on its invoice date; shared-beneficiary originals stay with staff for review. No new payment, send, bank-change or approval authority.

### Publish complete owner statements

**Partial** — gap remains.

Official documentation: [Buildium property owner portal](https://www.buildium.com/features/property-owner-portal/) — Statements, contributions and draws; reviewed 2026-11-04.

- [ACCT-012](../CONTRACT.md) — **PARTIAL**: Publish complete owner statements. Matching acceptance: “Publish a monthly owner statement with rent, a paid bill and distribution, reconcile its closing cash to books&#47;bank and download the source invoice from the owner portal.”
  - Evidence: `tests/statements.mjs` — "journey": staff cash draft opening and closing cash, expenses, reserves, separate deposits, liabilities and dated ownership. `tests/statements.mjs` — "journey", invoked by the ACCT-012 registration in `tests/terrace.test.mjs`: exact seller and buyer invoice originals on either side of a transfer, expense cents and CSV isolation, absent and other-owner files refused, staff cookies excluded, screening refusal, shared originals held, changed approval withdrawal, cross-property revision history, restart, immediate revocation, audit and native restore with fresh authorization. `tests/statements-browser.mjs`: native owner statement expense, fee and reserve sections and invoice downloads at 1440 and 390.
  - Gap: Complete paid-bill and distribution sources, corrected immutable publication, scheduled delivery, receipt and invoice bundles, bank tie-out and REPORT-007 actuals remain unproved. Joint-owner originals are held. Adopted conservative original-disclosure default pending ct: a live owner grant reads only an exact currently approved invoice attachment when every historical allocation belongs wholly to that owner on its invoice date; shared-beneficiary originals stay with staff for review. No new payment, send, bank-change or approval authority.

**Uncovered:** ACCT-012: PARTIAL. Complete paid-bill and distribution sources, corrected immutable publication, scheduled delivery, receipt and invoice bundles, bank tie-out and REPORT-007 actuals remain unproved. Joint-owner originals are held. Adopted conservative original-disclosure default pending ct: a live owner grant reads only an exact currently approved invoice attachment when every historical allocation belongs wholly to that owner on its invoice date; shared-beneficiary originals stay with staff for review. No new payment, send, bank-change or approval authority.

### Collect owner contributions

**Partial** — gap remains.

Official documentation: [Buildium property owner portal](https://www.buildium.com/features/property-owner-portal/) — Contribution requests and online funds; reviewed 2026-11-04.

- [PORTAL-002](../CONTRACT.md) — **PARTIAL**: Give owners their financial and property portal. Matching acceptance: “Joint owners inspect different ownership periods, approve an over-limit repair, contribute funds and download a statement&#47;invoice; access another owner’s report and screening file is denied.”
  - Evidence: `tests/statements.mjs` — "journey", invoked by the ACCT-012 registration in `tests/terrace.test.mjs`: exact seller and buyer invoice originals on either side of a transfer, expense cents and CSV isolation, absent and other-owner files refused, staff cookies excluded, screening refusal, shared originals held, changed approval withdrawal, cross-property revision history, restart, immediate revocation, audit and native restore with fresh authorization. `tests/statements-browser.mjs`: native owner statement expense, fee and reserve sections and invoice downloads at 1440 and 390.
  - Gap: Occupancy and rent detail, complete distribution status and documents, owner contributions, communication, over-limit repair decisions with PORTAL-007 riders, joint-owner original disclosure and staff bank-change fresh-proof assertions remain unproved. Adopted conservative original-disclosure default pending ct: a live owner grant reads only an exact currently approved invoice attachment when every historical allocation belongs wholly to that owner on its invoice date; shared-beneficiary originals stay with staff for review. No new payment, send, bank-change or approval authority.

**Uncovered:** PORTAL-002: PARTIAL. Occupancy and rent detail, complete distribution status and documents, owner contributions, communication, over-limit repair decisions with PORTAL-007 riders, joint-owner original disclosure and staff bank-change fresh-proof assertions remain unproved. Adopted conservative original-disclosure default pending ct: a live owner grant reads only an exact currently approved invoice attachment when every historical allocation belongs wholly to that owner on its invoice date; shared-beneficiary originals stay with staff for review. No new payment, send, bank-change or approval authority. Actual owner contribution collection, bank settlement and complete owner request outcomes remain unqualified.

### Submit resident maintenance requests

**Covered** — mapped replacement acceptance passed.

Official documentation: [Buildium resident site help center](https://www.buildium.com/resident-site-help-center/resident-site-help-center/) — Create and track a maintenance request; reviewed 2026-11-04.

- [PORTAL-004](../CONTRACT.md) — **DONE**: Receive resident maintenance requests. Matching acceptance: “Submit a leaking-tap request with photo and access restrictions, add another household report and follow the tracking link through scheduled work and resident-confirmed resolution.”
  - Evidence: `tests/portal-requests.mjs` — "journey" invoked by `tests/portal.mjs` — "journey" in the ROLE-002 registration of `tests/terrace.test.mjs`: leaking-tap report with original photo, access restrictions, pets and preferred times; exact video bytes; private tracking and scheduled work; second verified mailbox with a separate original concern and answer; resident confirmation without closing another report or the work order; staff role 403 and portfolio 404 on linking and original review; unrelated resident, delegated contact, owner and vendor refusal; gas-smell WORK-001 case with frozen approved guidance version, on-call email and replay without a duplicate alert; fresh authorized invitations after restore with original media and no restored credentials. `tests/portal-requests-browser.mjs`: intake, receipt, tracking, scheduled work, answer, resolution, emergency guidance, staff review and urgent queue at 1440 and 390; text-labelled portal controls and staff hover and keyboard tooltips.
  - Gap: None in the contract row.

### Track resident questions and replies

**Partial** — gap remains.

Official documentation: [Buildium resident site help center](https://www.buildium.com/resident-site-help-center/resident-site-help-center/) — General inquiry and request messages; reviewed 2026-11-04.

- [PORTAL-006](../CONTRACT.md) — **PARTIAL**: Keep shared threads and notices accountable. Matching acceptance: “Assign a resident conversation, add a private note, broadcast a water shutoff to one building and inspect delivered&#47;failed recipients; verify the resident cannot see the note or another building’s messages.”
  - Evidence: `tests/terrace.test.mjs` — "PORTAL-006: private notes, scoped conversations, exact notices and per-recipient building service evidence survive restore" (`tests/portal-threads.mjs`, journey): assignment and deadline; private-note search and attachment denial; one-building announcement recipients with staff-recorded delivered and failed evidence; staff 404 and 403; resident, owner and assigned vendor replies; stale proof, exact approval and immutable legal terms; unread state, side-effect-free opens, stale reply refusal; original bytes and hashes in readable export and native restore; communication retention, legal holds, eligible erasure and later-journal restore refusal. `tests/portal-threads-browser.mjs`: native Messages and resident, owner and vendor conversation screens at 1440 and 390; assignment, exact legal approval, service recording, accountable reconciliation, owner and vendor reply and mark-read forms; private-note absence, building isolation and existing avatar tooltip focus and delayed hover; runs in push Verify. `tests/portal-threads.mjs`, journey: missing permission refusal, fixed local-date boundaries including UTC disagreement, changed resident identity, former ownership, reopened work approval and ended-tenancy refusal; attributable reconciliation and inert restored recovery evidence; dated household notice recipients, explicit exclusion sets, original-membership fences and complete fields on the current mutation history.
  - Gap: PORTAL-009.

- [PORTAL-007](../CONTRACT.md) — **PARTIAL**: Track requests documents and approvals to completion. Matching acceptance: “Request insurance evidence and owner quote approval, expire one link and complete a replacement; show reminders stop only after validated completion and the exact signer and approver is recorded.”
  - Evidence: `tests/terrace.test.mjs` — "PORTAL-007: scoped request actions, expiry, replacement, validated originals and exact owner decisions" (`tests/action-requests.mjs`): insurance original, exact owner quote decision, expiry and replacement, open versus validated completion, reminders, named signer and approver, staff 404 and 403; `tests/action-requests-browser.mjs`: staff and external action screens at 1440 and 390, including compact icon tooltip focus and hover.
  - Gap: PARTIAL: policy is approved with changes, but assertions remain unproved. Qualification map: PORTAL-007 entry 7 and ROLE-001 entry 11, ROLE-002 entry 12, PORT-004 entry 4, PORT-001 entry 1 require before, on and after household and property-local ownership dates (including UTC and local-day disagreement) and refusal after authority changes; SAFE-001 entry 1 and ROLE-001 entry 11 require stale-proof refusal for every command, prohibited roles and credentials, and authority changes between review and mutation; SAFE-002 entry 2 and PORT-007 entry 7 require durable affirmative-consent wording or version and refusal of substituted document bytes; WORK-003 entry 3, ROLE-003 entry 13 and future PORTAL-002 entry 2 require visible decline, stopped reminders, changed-term decisions and preserved spend and independence controls; ROLE-002 entry 12 requires actual seven-day expiry, replacement refusal on reads and submissions, missing-item history and expiry distinct from cancellation; future PORTAL-005 entry 5 and PORTAL-006 entry 6 require send uncertainty and claim-interruption refusal, side-effect-free opens and lost-response once-only completion; SAFE-004 entry 4 and SAFE-005 entry 5 require subject-scoped access, retention and holds, eligible evidence and original erasure and later-journal restore fences; SAFE-005 entry 5 and ROLE-002 entry 12 require original bytes, hashes and attribution in backup and readable export and inert restored open requests until fresh invitations and preparation. LEASE-011 entry 11 and PORTAL-009 entry 9 still require their own legal-execution and statutory-delivery journeys. Future PORTAL-001 entry 1, PORTAL-002 entry 2, PORTAL-003 entry 3 and PORTAL-008 entry 8 inherit applicable identity, scope, consent, revocation and custody duties. PORT-007 remains the separate document clause. No permanent withdrawal state is commissioned; any future such capability belongs to the next free PORTAL-011, initially missing in both documents.

**Uncovered:** PORTAL-006: PARTIAL. PORTAL-009. PORTAL-007: PARTIAL. PARTIAL: policy is approved with changes, but assertions remain unproved. Qualification map: PORTAL-007 entry 7 and ROLE-001 entry 11, ROLE-002 entry 12, PORT-004 entry 4, PORT-001 entry 1 require before, on and after household and property-local ownership dates (including UTC and local-day disagreement) and refusal after authority changes; SAFE-001 entry 1 and ROLE-001 entry 11 require stale-proof refusal for every command, prohibited roles and credentials, and authority changes between review and mutation; SAFE-002 entry 2 and PORT-007 entry 7 require durable affirmative-consent wording or version and refusal of substituted document bytes; WORK-003 entry 3, ROLE-003 entry 13 and future PORTAL-002 entry 2 require visible decline, stopped reminders, changed-term decisions and preserved spend and independence controls; ROLE-002 entry 12 requires actual seven-day expiry, replacement refusal on reads and submissions, missing-item history and expiry distinct from cancellation; future PORTAL-005 entry 5 and PORTAL-006 entry 6 require send uncertainty and claim-interruption refusal, side-effect-free opens and lost-response once-only completion; SAFE-004 entry 4 and SAFE-005 entry 5 require subject-scoped access, retention and holds, eligible evidence and original erasure and later-journal restore fences; SAFE-005 entry 5 and ROLE-002 entry 12 require original bytes, hashes and attribution in backup and readable export and inert restored open requests until fresh invitations and preparation. LEASE-011 entry 11 and PORTAL-009 entry 9 still require their own legal-execution and statutory-delivery journeys. Future PORTAL-001 entry 1, PORTAL-002 entry 2, PORTAL-003 entry 3 and PORTAL-008 entry 8 inherit applicable identity, scope, consent, revocation and custody duties. PORT-007 remains the separate document clause. No permanent withdrawal state is commissioned; any future such capability belongs to the next free PORTAL-011, initially missing in both documents.

### Assign and track maintenance tasks

**Covered** — mapped replacement acceptance passed.

Official documentation: [Buildium maintenance request management](https://www.buildium.com/features/property-management-maintenance-software/) — Task ownership, due dates and work orders; reviewed 2026-11-04.

- [WORK-006](../CONTRACT.md) — **DONE**: Dispatch and track technician progress. Matching acceptance: “Dispatch an approved order, receive vendor acceptance and a parts hold, miss its appointment and reassign it; inspect notifications, state history and a still-open resident issue.”
  - Evidence: `migrations/core/0049_dispatch.sql`; `src/terrace/dispatch.ts`; `src/terrace/dispatch-mail.ts`; `src/terrace/dispatch-view.ts`; `tests/dispatch.mjs`; `tests/dispatch-browser.mjs`; `tests/terrace.test.mjs`
  - Gap: None in the contract row.

### Coordinate maintenance calendars

**Partial** — gap remains.

Official documentation: [Buildium maintenance request management](https://www.buildium.com/features/property-management-maintenance-software/) — Shared maintenance calendar; reviewed 2026-11-04.

- [WORK-005](../CONTRACT.md) — **PARTIAL**: Book appointments and resident access. Matching acceptance: “Book a repair, receive resident confirmation, cancel from the vendor portal and reschedule with a new permitted access window; notify both parties and preserve appointment history.”
  - Evidence: `tests/appointments.mjs` — "journey": permission, qualification, calendars, cancellation, rescheduling and report timing. `tests/portal.mjs` — "journey": vendor-portal confirmation and cancellation. `tests/messages.mjs` — "journey": reviewed arrival text, unanswered window stays proposed, signed Y confirms once after vendor confirmation, cancelled and changed-work windows stay unconfirmed, separately approved cancellation emails to both parties. `tests/messages-browser.mjs`: arrival confirmation and reply history at 1440 and 390.
  - Gap: Resident communication consent and signed-reply authority defaults await ct approval. Actual arrival-text delivery and resident-origin reply remain unproved under TEST-only authorization; signed fixtures prove native routing only. Notifications require separate exact-content human approval; no automatic notification is authorized. CT 26 October 2026 approves the current-invitation signed-reply policy WITH RIDERS, separate from resident entry permission and vendor confirmation. Earlier pending-policy wording is historical. Actual delivery, resident-origin reply proof, separately approved notifications and independent runtime and browser evidence remain gaps. Status remains partial.

**Uncovered:** WORK-005: PARTIAL. Resident communication consent and signed-reply authority defaults await ct approval. Actual arrival-text delivery and resident-origin reply remain unproved under TEST-only authorization; signed fixtures prove native routing only. Notifications require separate exact-content human approval; no automatic notification is authorized. CT 26 October 2026 approves the current-invitation signed-reply policy WITH RIDERS, separate from resident entry permission and vendor confirmation. Earlier pending-policy wording is historical. Actual delivery, resident-origin reply proof, separately approved notifications and independent runtime and browser evidence remain gaps. Status remains partial.

### Record maintenance time and labor

**Partial** — gap remains.

Official documentation: [Buildium maintenance request management](https://www.buildium.com/features/property-management-maintenance-software/) — Time tracking; reviewed 2026-11-04.

- [WORK-007](../CONTRACT.md) — **PARTIAL**: Capture field labor materials and completion evidence. Matching acceptance: “Lose connectivity during work, capture time and photos, reconnect with a conflicting scope change and reconcile the conflict before submitting complete evidence for review.”
  - Evidence: `tests/field-capture.test.mjs` — ‘WORK-007: direct technician originals, approved scope reconciliation and once-only review submission’ (`tests/technician-capture.mjs`); `tests/technician-capture-browser.mjs` — direct offline time&#47;photos and video, persisted originals, changed-scope reconciliation and review submission at 1440/390; `tests/field-evidence.mjs` / `tests/field-evidence-browser.mjs` — retained staff-sourced report; `src/terrace/field-evidence.ts`; `src/terrace/completions.ts`; `migrations/core/0072_field_scope.sql`
  - Gap: Direct authenticated operator capture now includes labor, materials, notes, access, current approved tasks and before&#47;after original photos and video, with once-only submission, offline drafts and manual scope reconciliation. Adopted conservative default pending ct: direct capture and field-scope changes are owner&#47;portfolio-manager only; explicit private-device consent, no credentials in drafts, explicit sync&#47;deletion; no new vendor authentication or grants. Existing sourced staff evidence remains available. Resident resolution stays a separate check.

**Uncovered:** WORK-007: PARTIAL. Direct authenticated operator capture now includes labor, materials, notes, access, current approved tasks and before&#47;after original photos and video, with once-only submission, offline drafts and manual scope reconciliation. Adopted conservative default pending ct: direct capture and field-scope changes are owner&#47;portfolio-manager only; explicit private-device consent, no credentials in drafts, explicit sync&#47;deletion; no new vendor authentication or grants. Existing sourced staff evidence remains available. Resident resolution stays a separate check.

### Close a repair through its invoice

**Missing** — gap remains.

Official documentation: [Buildium maintenance request management](https://www.buildium.com/features/property-management-maintenance-software/) — First resident request to final invoice; reviewed 2026-11-04.

- [WORK-009](../CONTRACT.md) — **MISSING**: Match invoice work and owner charge. Matching acceptance: “Submit a completed repair invoice exceeding its quote, flag the unmatched line, approve a corrected invoice and trace work, payable, payment and owner statement without double entry.”
  - Evidence: `src/terrace/bills.ts`; `src/terrace/bills-input.ts`; `src/terrace/bills-authority.ts`; `src/terrace/owners.ts`; `tests/bills.mjs`; `tests/terrace.test.mjs`
  - Gap: Staff-entered bills match supplier, approved work and cumulative estimate, hold excess spend, and post approved owner allocations. Invoice extraction and source locations, labor and material and completion matching, settlement linkage and invoiced maintenance-report costs are absent. WORK-009 remains missing until ACCT-008 and ACCT-012 ship.

**Uncovered:** WORK-009: MISSING. Staff-entered bills match supplier, approved work and cumulative estimate, hold excess spend, and post approved owner allocations. Invoice extraction and source locations, labor and material and completion matching, settlement linkage and invoiced maintenance-report costs are absent. WORK-009 remains missing until ACCT-008 and ACCT-012 ship.

### Sync HappyCo property inspections

**Missing** — gap remains.

Official documentation: [Buildium maintenance request management](https://www.buildium.com/features/property-management-maintenance-software/) — Property inspections powered by HappyCo; reviewed 2026-11-04.

- [WORK-012](../CONTRACT.md) — **MISSING**: Integrate HappyCo inspection evidence. Matching acceptance: “Bring a HappyCo inspection into the correct unit, replay it and update one finding, then create approved repair work with original media&#47;provenance and a visible unmapped-unit exception.”
  - Evidence: None recorded.
  - Gap: HappyCo adapter and provider inspection reconciliation are absent.

**Uncovered:** WORK-012: MISSING. HappyCo adapter and provider inspection reconciliation are absent.

### Manage unit turns and recurring repairs

**Covered** — mapped replacement acceptance passed.

Official documentation: [Buildium maintenance request management](https://www.buildium.com/features/property-management-maintenance-software/) — Projects and project templates; reviewed 2026-11-04.

- [WORK-013](../CONTRACT.md) — **DONE**: Run make-ready and turnover boards. Matching acceptance: “Move out a resident, delay a repair dependent on inspection, revise the ready date and show cleaning&#47;listing effects; complete checks and publish the true available date.”
  - Evidence: `migrations/core/0024_turnovers.sql`; `src/terrace/turnovers.ts`; `src/terrace/turnover-view.ts`; `tests/terrace.test.mjs`
  - Gap: None in the contract row.

- [WORK-010](../CONTRACT.md) — **DONE**: Schedule preventive and recurring maintenance. Matching acceptance: “Schedule annual HVAC service and quarterly safety work, replay a scheduler run, defer one occurrence and replace an asset; inspect exactly one order per due occurrence and an explicit overdue exception.”
  - Evidence: `migrations/core/0021_schedules.sql`; `src/terrace/schedules.ts`; `src/terrace/schedule-view.ts`; `src/terrace/job-writes.ts`; `tests/terrace.test.mjs`
  - Gap: None in the contract row.

### Export source records for a reviewed migration

**Missing** — gap remains.

Official documentation: [Buildium export data documentation](https://help.buildium.com/hc/s/article/Export-data-from-Buildium-1557494404392) — Export data from Buildium; category exports and supplemental reports are specified in MOVE-003; reviewed 2026-11-04.

- [MOVE-003](../CONTRACT.md) — **MISSING**: Move in from Buildium. Matching acceptance: “Import real redacted Buildium files plus an authorized Open API capture, detect omitted ledger financials, reconcile beneficiary&#47;deposit totals and migrate active work and files before permitting cutover.”
  - Evidence: None recorded.
  - Gap: Buildium file&#47;API importer and completeness reconciliation are absent.

- [MOVE-001](../CONTRACT.md) — **PARTIAL**: Reconcile complete migration before cutover. Matching acceptance: “Load a multi-property source with a missing deposit, duplicate household, vendor without a W-9 and a commercial lease held as an exception (BOUND-004), preview without writes, reconcile counts and balances, resolve exceptions and approve the exact migration manifest.”
  - Evidence: `tests/migration.mjs` — journey, called by the MOVE-009 registration in `tests/terrace.test.mjs`: multi-property source and vacant units; field mapping and every native record kind; missing deposit, duplicate household, missing W-9 and commercial holds; zero-write preview; source counts and excluded dispositions; resolved exceptions and exact manifest approval; eleven source and native opening accounts with zero difference or retained named exception; document originals, vendor and owner balance-forwards, five resident history kinds, native bill approval without duplicate balances, attribution, owner-only and revoked-credential refusal, restart, archive restore, shared-source legal holds, unrelated source preservation and erasure non-resurrection. `tests/migration-browser.mjs`: native preview, retained manifest and resident history, called on push Verify, with proof at 1440 and 390 and focus and hover tooltips. Native deposit links and separate 50000 and 20000 cent liabilities are asserted by the same migration journey; dropping native deposit writes fails its native journal assertion.
  - Gap: CT 28 October 2026 A16 and R1 demotion retained. Separate native deposit link and individual-amount assertions now pass, independently of the 70000 cent opening aggregate, and the deposit-write mutation is rejected; fresh judgment of these changed rows remains pending.

- [MOVE-010](../CONTRACT.md) — **PARTIAL**: Carry vendors year-to-date tax and resident ledger history. Matching acceptance: “Import an AppFolio vendor directory and year-to-date 1099 totals with a 30 June cutover, pay the same vendor in Terrace and produce one 1099 whose total equals pre-cutover plus post-cutover payments; show a migrated resident’s pre-cutover ledger lines in the resident ledger, on the eviction ledger export and on the deposit disposition statement, with the opening balance equal to the history’s closing balance.”
  - Evidence: `tests/migration.mjs` journey: restricted vendor directory and W-9 hold, vendor and owner year-to-date balance-forwards, five source-referenced resident history kinds, staff and resident monthly statements, opening balance and no duplicate cash.
  - Gap: AppFolio-format source adapter and independent incumbent summary reconciliation; complete owner and vendor tax carry-forward with post-cutover payments and one 1099 (ACCT-014 requires the unavailable Nelco filing account); eviction ledger export and deposit disposition integration (ACCT-004 awaits PORT-008 counsel content); complete 24-month statement and export proof remain owed.

**Uncovered:** MOVE-003: MISSING. Buildium file&#47;API importer and completeness reconciliation are absent. MOVE-001: PARTIAL. CT 28 October 2026 A16 and R1 demotion retained. Separate native deposit link and individual-amount assertions now pass, independently of the 70000 cent opening aggregate, and the deposit-write mutation is rejected; fresh judgment of these changed rows remains pending. MOVE-010: PARTIAL. AppFolio-format source adapter and independent incumbent summary reconciliation; complete owner and vendor tax carry-forward with post-cutover payments and one 1099 (ACCT-014 requires the unavailable Nelco filing account); eviction ledger export and deposit disposition integration (ACCT-004 awaits PORT-008 counsel content); complete 24-month statement and export proof remain owed. Source exports establish no completed Terrace importer or payment cutover. Account-specific access and report completeness remain unverified.

### Qualify scheduled-payment cutover

**Partial** — gap remains.

Official documentation: [Buildium resident site help center](https://www.buildium.com/resident-site-help-center/resident-site-help-center/) — Edit or cancel automatic and scheduled payments; reviewed 2026-11-04.

- [MOVE-008](../CONTRACT.md) — **PARTIAL**: Shadow run and control payment cutover. Matching acceptance: “Shadow a rent cycle against source statements, hold a difference, approve a corrected cutover and demonstrate a retained old autopay cannot create a second Terrace collection; show every mandate’s reauthorization state.”
  - Evidence: `tests/shadow-run.mjs` — owner documentary rent comparison journey, registered through `tests/terrace.test.mjs`: exact source bytes and mapped rows; per-lease opening receivable, charges, recorded receipts, reductions and closing receivable; offsetting differences, missing and duplicate mappings, separate currencies, accountable held next actions, distinct corrected-source review, native-event invalidation even when opening totals are unchanged, non-owner and credential refusal, restart, accounting retention, shared legal holds, erasure and inert restore. `tests/shadow-run-browser.mjs` — native documentary capture and review at 1440 with screenshots at 1440 and 390, on push Verify.
  - Gap: Documentary rent comparison only; authentic incumbent shadow-cycle qualification, fees, complete owner statements, bank matching and future-schedule comparison remain outstanding. Cutover-date approval, period-by-period collecting-system authority, processor mandate reauthorization, stopping old scheduled collection and prevention of duplicate rent, deposit and payout execution remain unimplemented. Owner-only record custody is the conservative interim default under the standing scope rule; scoped delegation and provider boundaries remain unqualified. PAY-002 and PAY-004 authorized processor environments; PAY-003 live receipt, decline, 3DS and replay; mapped-bank settlement, authorized production configuration and CT card authority, consent and fee approval remain unqualified; PAY-005 stays CT-held. ACCT-003 and ACCT-004 remain blocked on PORT-008 counsel; trust, fee, refund and owner-statement disclosure approvals and payout-rail account and authorization holds are unchanged. Synthetic originals prove no authentic incumbent outcome.

**Uncovered:** MOVE-008: PARTIAL. Documentary rent comparison only; authentic incumbent shadow-cycle qualification, fees, complete owner statements, bank matching and future-schedule comparison remain outstanding. Cutover-date approval, period-by-period collecting-system authority, processor mandate reauthorization, stopping old scheduled collection and prevention of duplicate rent, deposit and payout execution remain unimplemented. Owner-only record custody is the conservative interim default under the standing scope rule; scoped delegation and provider boundaries remain unqualified. PAY-002 and PAY-004 authorized processor environments; PAY-003 live receipt, decline, 3DS and replay; mapped-bank settlement, authorized production configuration and CT card authority, consent and fee approval remain unqualified; PAY-005 stays CT-held. ACCT-003 and ACCT-004 remain blocked on PORT-008 counsel; trust, fee, refund and owner-statement disclosure approvals and payout-rail account and authorization holds are unchanged. Synthetic originals prove no authentic incumbent outcome.

### Track community association violations

**Unsupported** — gap remains.

Official documentation: [Buildium resident site help center](https://www.buildium.com/resident-site-help-center/resident-site-help-center/) — Violations and report as resolved; reviewed 2026-11-04.

Replacement: intentionally unmapped. Status: unsupported. Evidence: none. Gap: Unsupported and intentionally unmapped: Terrace is residential rental software and provides no association violation workflow. BOUND-004 states a boundary, not replacement coverage.

**Uncovered:** Unsupported and intentionally unmapped: Terrace is residential rental software and provides no association violation workflow. BOUND-004 states a boundary, not replacement coverage.

### Autonomously monitor maintenance progress

**Unsupported** — gap remains.

Official documentation: [Buildium maintenance request management](https://www.buildium.com/features/property-management-maintenance-software/) — Lumina AI Maintenance Agent; reviewed 2026-11-04.

Replacement: intentionally unmapped. Status: unsupported. Evidence: none. Gap: Unsupported and intentionally unmapped: manual work tracking does not replace the incumbent autonomous maintenance agent.

**Uncovered:** Unsupported and intentionally unmapped: manual work tracking does not replace the incumbent autonomous maintenance agent.

## Rent Manager

10 of 45 documented functions have covered replacement acceptance; 35 remain gaps. Full switch: unqualified.

### Publish property and unit vacancies

**Missing** — gap remains.

Official documentation: [Rent Manager marketing and leasing](https://www.rentmanager.com/marketing-leasing/) — Website and ILS advertising; reviewed 2026-11-04.

- [LEASE-001](../CONTRACT.md) — **MISSING**: Publish property marketing and vacancies. Matching acceptance: “Publish two vacant units, submit an enquiry on mobile, lease one and confirm its vacancy is withdrawn while the other remains available with the approved price and fees.”
  - Evidence: None recorded.
  - Gap: Property marketing and vacancy publication are absent.

**Uncovered:** LEASE-001: MISSING. Property marketing and vacancy publication are absent.

### Syndicate to listing services

**Missing** — gap remains.

Official documentation: [Rent Manager marketing and leasing](https://www.rentmanager.com/marketing-leasing/) — Industry-leading ILS sites; reviewed 2026-11-04.

- [LEASE-002](../CONTRACT.md) — **MISSING**: Syndicate listings to Zillow. Matching acceptance: “Publish through the provider test boundary, correct a rejected fee field, change rent and withdraw the listing; show acknowledgments and the same external listing identity without duplicates.”
  - Evidence: None recorded.
  - Gap: Zillow connection and listing status reconciliation are absent.

- [LEASE-003](../CONTRACT.md) — **MISSING**: Syndicate listings to Apartments.com. Matching acceptance: “Submit the same unit to Apartments.com, process a rejection and later success, update availability and remove it after lease execution; trace each provider result to the unit.”
  - Evidence: None recorded.
  - Gap: Apartments.com distribution is absent.

- [LEASE-004](../CONTRACT.md) — **MISSING**: Extend listing reach with Zumper and RentCafe. Matching acceptance: “Enable each adapter in its supported environment, publish and withdraw a unit, receive an enquiry and demonstrate that an unentitled account cannot appear connected or published.”
  - Evidence: None recorded.
  - Gap: Zumper and RentCafe adapters are absent.

**Uncovered:** LEASE-002: MISSING. Zillow connection and listing status reconciliation are absent. LEASE-003: MISSING. Apartments.com distribution is absent. LEASE-004: MISSING. Zumper and RentCafe adapters are absent. Exact channel and account entitlements require independent qualification; a generic ILS claim establishes none.

### Track prospect guest cards

**Covered** — mapped replacement acceptance passed.

Official documentation: [Rent Manager marketing and leasing](https://www.rentmanager.com/marketing-leasing/) — Prospect Manager; reviewed 2026-11-04.

- [LEASE-005](../CONTRACT.md) — **DONE**: Work prospect records and enquiries. Matching acceptance: “Receive a listing enquiry and duplicate email, review the match, assign a leasing person, respond and follow that prospect through showing and application with source attribution intact.”
  - Evidence: `migrations/core/0044_prospects.sql`; `src/terrace/prospects.ts`; `src/terrace/prospect-mail.ts`; `src/terrace/prospect-view.ts`; `tests/prospects.mjs`; `tests/terrace.test.mjs`
  - Gap: None in the contract row.

### Take online rental applications

**Partial** — gap remains.

Official documentation: [Rent Manager marketing and leasing](https://www.rentmanager.com/marketing-leasing/) — Online applications; reviewed 2026-11-04.

- [LEASE-007](../CONTRACT.md) — **PARTIAL**: Take complete online applications. Matching acceptance: “Two co-applicants save and resume, upload income evidence and submit; manager requests one missing document and sees revisions and fee outcome without card data in Terrace.”
  - Evidence: `tests/applications.mjs` journey: two private adult drafts, resume through a fresh email link after sign-out with the old session refused, income originals, required disclosure consent, submitted answers, manager requests and immutable revisions, verified fee outcomes without card objects, scope refusal, revocation, archive recovery and erasure fences; `tests/applications-browser.mjs`: native forms and revision screens at desktop and phone widths; `tests/applications-sandbox.mjs`: held Stripe test hosted fee and canonical event proof
  - Gap: Conservative interim policy under the standing scope rule: owner-only roster, fee preparation, invitations, revocation, retention holds and erasure; scoped portfolio managers read and request evidence; each adult controls only their answers and one explicitly consented household fee. CT approval of applicant authority, custody, retention and fee policy remains pending; scoped leasing delegation and production provider boundaries remain owed. Activated PORT-008 disclosure text is frozen and acknowledged, but synthetic counsel fixtures do not prove legally sufficient application disclosures.

**Uncovered:** LEASE-007: PARTIAL. Conservative interim policy under the standing scope rule: owner-only roster, fee preparation, invitations, revocation, retention holds and erasure; scoped portfolio managers read and request evidence; each adult controls only their answers and one explicitly consented household fee. CT approval of applicant authority, custody, retention and fee policy remains pending; scoped leasing delegation and production provider boundaries remain owed. Activated PORT-008 disclosure text is frozen and acknowledged, but synthetic counsel fixtures do not prove legally sufficient application disclosures.

### Screen residents

**Missing** — gap remains.

Official documentation: [Rent Manager marketing and leasing](https://www.rentmanager.com/marketing-leasing/) — Resident Screening; reviewed 2026-11-04.

- [LEASE-008](../CONTRACT.md) — **MISSING**: Order consented TransUnion screening. Matching acceptance: “Submit a consented application to the provider sandbox, receive a delayed report and duplicate callback, deny an unauthorized report download and show provider errors without fabricating a screening result.”
  - Evidence: None recorded.
  - Gap: Screening integration, consent and restricted reports are absent.

- [LEASE-009](../CONTRACT.md) — **PARTIAL**: Review applicants and adverse actions. Matching acceptance: “Review two applications, flag a disputed report, require a manager decision and send an explicitly approved adverse-action package with the correct provider reference and recorded delivery.”
  - Evidence: `tests/applications.mjs` — existing application journey, registered in `tests/terrace.test.mjs`: two separate submitted applications under one explicitly supplied previously disclosed criterion; integer-cent and fractional-cent thresholds, recomputation, missing and contested holds, staff verification provenance, submitted revisions and original hashes, stale-source refusal, role and credential refusal, portfolio 404 and live revocation, private originals and unchanged applicant, financial, grant and custody records. `tests/applications-browser.mjs` — native source selection and income review, recomputation and contested hold with stale-source refusal; push Verify invokes the script, with desktop assertions and 1440 and 390 proof.
  - Gap: Read-only income-criterion review is implemented; it is not a human applicant decision or screening report. CT approval of applicant authority, custody, retention and fee policy remains pending; scoped leasing delegation and production provider boundaries remain owed. Terrace counsel engagement and counsel-reviewed authored pack and template contents remain unavailable, so legally sufficient disclosures and adverse-action contents remain unqualified. TransUnion onboarding, authorized screening sandbox, real reports and provider provenance remain outstanding. Human approval and decline recording, accommodation and contested-report referral workflows, approved adverse-action packages, correct dispute and provider contacts, applicant approval and decline notice delivery evidence and screening-file export history with outcome “exported” remain owed.

**Uncovered:** LEASE-008: MISSING. Screening integration, consent and restricted reports are absent. LEASE-009: PARTIAL. Read-only income-criterion review is implemented; it is not a human applicant decision or screening report. CT approval of applicant authority, custody, retention and fee policy remains pending; scoped leasing delegation and production provider boundaries remain owed. Terrace counsel engagement and counsel-reviewed authored pack and template contents remain unavailable, so legally sufficient disclosures and adverse-action contents remain unqualified. TransUnion onboarding, authorized screening sandbox, real reports and provider provenance remain outstanding. Human approval and decline recording, accommodation and contested-report referral workflows, approved adverse-action packages, correct dispute and provider contacts, applicant approval and decline notice delivery evidence and screening-file export history with outcome “exported” remain owed.

### Prepare lease documents

**Missing** — gap remains.

Official documentation: [Rent Manager marketing and leasing](https://www.rentmanager.com/marketing-leasing/) — Signable Docs; reviewed 2026-11-04.

- [LEASE-010](../CONTRACT.md) — **MISSING**: Compose jurisdiction-reviewed lease templates. Matching acceptance: “Generate a lease with co-signers, pet addendum and local disclosure, detect a missing required input and approve a changed term while preserving the template version and redline.”
  - Evidence: None recorded.
  - Gap: Lease template assembly and reviewed jurisdiction packs are absent.

**Uncovered:** LEASE-010: MISSING. Lease template assembly and reviewed jurisdiction packs are absent.

### Execute electronic leases

**Missing** — gap remains.

Official documentation: [Rent Manager marketing and leasing](https://www.rentmanager.com/marketing-leasing/) — Signable Docs and online leasing; reviewed 2026-11-04.

- [LEASE-011](../CONTRACT.md) — **MISSING**: Collect legally evidenced electronic signatures. Matching acceptance: “Send a multi-signer lease, process one decline and a replacement envelope, complete all signatures, replay its callback and attach exactly one executed PDF&#47;certificate to the activated tenancy.”
  - Evidence: None recorded.
  - Gap: E-signature provider&#47;sibling integration and execution lifecycle are absent.

**Uncovered:** LEASE-011: MISSING. E-signature provider&#47;sibling integration and execution lifecycle are absent.

### Renew leases online

**Missing** — gap remains.

Official documentation: [Rent Manager marketing and leasing](https://www.rentmanager.com/marketing-leasing/) — Online Leasing and Renewals; reviewed 2026-11-04.

- [LEASE-012](../CONTRACT.md) — **DONE**: Run renewal and retention campaigns. Matching acceptance: “Run a renewal window with accepted, declined and unanswered offers; trace approved delivery and executed future terms, and verify the unresolved household remains in the follow-up queue.”
  - Evidence: `migrations/core/0046_renewals.sql`; `src/terrace/renewals.ts`; `src/terrace/renewal-mail.ts`; `src/terrace/renewal-view.ts`; `src/terrace/lease-versions.ts`; `src/terrace/leasing-metrics.ts`; `src/terrace/scenarios.ts`; `tests/renewals.mjs`; `tests/terrace.test.mjs`
  - Gap: None in the contract row.

- [LEASE-011](../CONTRACT.md) — **MISSING**: Collect legally evidenced electronic signatures. Matching acceptance: “Send a multi-signer lease, process one decline and a replacement envelope, complete all signatures, replay its callback and attach exactly one executed PDF&#47;certificate to the activated tenancy.”
  - Evidence: None recorded.
  - Gap: E-signature provider&#47;sibling integration and execution lifecycle are absent.

**Uncovered:** LEASE-011: MISSING. E-signature provider&#47;sibling integration and execution lifecycle are absent.

### Post recurring rent and other charges

**Covered** — mapped replacement acceptance passed.

Official documentation: [Rent Manager accounting](https://www.rentmanager.com/accounting/) — Accounts Receivable and Charge Types; reviewed 2026-11-04.

- [PAY-001](../CONTRACT.md) — **DONE**: Post recurring rent and lease charges. Matching acceptance: “Preview and post rent for leases with a concession and mid-month move-in, replay the run and amend future rent; verify each period posts once and posted history is preserved.”
  - Evidence: `migrations/core/0022_recurring_charges.sql`; `src/terrace/charge-run.ts`; `src/terrace/charge-run-view.ts`; `tests/terrace.test.mjs`
  - Gap: None in the contract row.

### Collect resident rent by bank transfer

**Missing** — gap remains.

Official documentation: [Rent Manager payments](https://www.rentmanager.com/payments/) — ePay; reviewed 2026-11-04.

- [PAY-002](../CONTRACT.md) — **MISSING**: Collect rent through ACH. Matching acceptance: “Pay a resident balance through ACH sandbox authorization, restart after provider submission and reconcile pending then settled callbacks without a second debit or exposing bank credentials.”
  - Evidence: None recorded.
  - Gap: ACH collection and processor reconciliation are absent.

**Uncovered:** PAY-002: MISSING. ACH collection and processor reconciliation are absent.

### Collect resident rent by card

**Partial** — gap remains.

Official documentation: [Rent Manager accounting](https://www.rentmanager.com/accounting/) — Zego ePay; reviewed 2026-11-04.

- [PAY-003](../CONTRACT.md) — **PARTIAL**: Collect rent by card. Matching acceptance: “Pay a partial balance with a test card requiring authentication, inspect the disclosed fee, complete payment and confirm one resident receipt and matching provider reference.”
  - Evidence: `tests/terrace.test.mjs` — "PAY-003: hosted card consent, policy admission, provider-only receipts, declines, expiry and replay" (`tests/card-payments.mjs`): scoped collection and versioned consent, inherited admission and atomic reservations, fee disclosure, canonical provider events and charge references, decline, expiry, concurrent replay and restart, credential-free restore and demo no-egress; passed at ea40fc1266b84123ea94242354838db93eca6c74 in heavy job 20261026T053952942981Z-heavy-slot-1f69fefb. `tests/card-payments-browser.mjs` — "journey", with --buffered-http: native review, pending and receipt states, staff reconciliation and uncertain-request resumption at 1440 and 390 through actual buffered Worker responses; only Stripe is faked at the network edge. Passed at c3d97576086bf0ca54d74f813846464509445986 in heavy job 20261026T054310729464Z-heavy-slot-7abac798; captures inspected. Provider-only sandbox capture on 26 October 2026: session cs_test_a1aCgX0MIKGGPYAZsRqaGqaK5zUkKkKIFQ87bwQ6m5YzF8t324KUuHTuni, intent pi_3UUfhRDg8BoejKxo4HBAlIoy, event evt_1UUfhSDg8BoejKxoEpx7eoxW, $10.00 USD paid in test mode. The public pre-event ledger contained no receipt. Two admitted live journeys stalled reading the resident return in Chromium although public HTTP returned the pending page. The corrected buffered transport passed the native network-edge journey; its held-key retry was cancelled after nineteen minutes with eight local jobs still ahead and made no provider request.
  - Gap: End-to-end live Stripe ledger receipt, decline, required authentication and provider-event replay remain unproved. Deposit collection and liability require ACCT-003 and PORT-008 counsel-reviewed rules; actual provider settlement into the ACCT-002 mapped banks and authorized production configuration remain unproved. The implementation remains test-only. CT approval of card authority, consent and zero payer fee remains open; PAY-005 stays CT-held and is inherited unchanged.

**Uncovered:** PAY-003: PARTIAL. End-to-end live Stripe ledger receipt, decline, required authentication and provider-event replay remain unproved. Deposit collection and liability require ACCT-003 and PORT-008 counsel-reviewed rules; actual provider settlement into the ACCT-002 mapped banks and authorized production configuration remain unproved. The implementation remains test-only. CT approval of card authority, consent and zero payer fee remains open; PAY-005 stays CT-held and is inherited unchanged.

### Collect recurring online payments

**Missing** — gap remains.

Official documentation: [Rent Manager accounting](https://www.rentmanager.com/accounting/) — One-time, batch and recurring payments; reviewed 2026-11-04.

- [PAY-004](../CONTRACT.md) — **MISSING**: Manage resident autopay mandates. Matching acceptance: “Authorize capped balance autopay, change the bill above its cap, then cancel before the next run; verify the permitted debit, held exception, notice and canceled attempt.”
  - Evidence: None recorded.
  - Gap: Autopay mandates, schedules and notices are absent.

**Uncovered:** PAY-004: MISSING. Autopay mandates, schedules and notices are absent.

### Charge late fees

**Partial** — gap remains.

Official documentation: [Rent Manager accounting](https://www.rentmanager.com/accounting/) — Charge Types; reviewed 2026-11-04.

- [PAY-006](../CONTRACT.md) — **PARTIAL**: Calculate late fees and grace periods. Matching acceptance: “Run a late-fee schedule across a weekend, record a timely pending payment that settles later and waive one fee; inspect charge basis, policy version and auditable waiver.”
  - Evidence: `tests/payer-accounting.test.mjs` — PAY-006: reviewed state caps, weekend and holiday grace, timely pending settlement and reasoned waivers retain original calculations (`tests/late-fees.mjs`): weekend&#47;holiday schedule and delayed settlement, basis/version/citation, waiver, state cap comparison, reversal hold, no compounding, restart/restore. `tests/late-fees-browser.mjs`: native review/post/waiver, 1440/390 and keyboard tooltip.
  - Gap: Adopted default pending ct: owner-only fee configuration, manual reviewed schedule posting and waivers; no automatic collections, notices or paid-fee reversal. All stated acceptance examples use synthetic owner-reviewed pack fixtures, not Terrace counsel review. Other fee bases are visibly held; PORT-008 reviewed authored contents remain open. DONE awaits ct approval of the authority and execution default.

**Uncovered:** PAY-006: PARTIAL. Adopted default pending ct: owner-only fee configuration, manual reviewed schedule posting and waivers; no automatic collections, notices or paid-fee reversal. All stated acceptance examples use synthetic owner-reviewed pack fixtures, not Terrace counsel review. Other fee bases are visibly held; PORT-008 reviewed authored contents remain open. DONE awaits ct approval of the authority and execution default.

### Collect CashPay retail rent

**Partial** — gap remains.

Official documentation: [Rent Manager payments](https://www.rentmanager.com/payments/) — CashPay; reviewed 2026-11-04.

- [PAY-007](../CONTRACT.md) — **PARTIAL**: Offer cash-at-retail and offline payment options. Matching acceptance: “Generate a cash code, receive and replay its retail transaction, clear a check and return another; reconcile resident balances to settlement batches without treating a printed code as collected rent.”
  - Evidence: `src/terrace/ledger.ts`
  - Gap: Manual external receipts exist; retail network, check deposits and clearance&#47;return states are absent.

**Uncovered:** PAY-007: PARTIAL. Manual external receipts exist; retail network, check deposits and clearance&#47;return states are absent.

### Process checks and record offline receipts

**Partial** — gap remains.

Official documentation: [Rent Manager payments](https://www.rentmanager.com/payments/) — Check scanning and Lockbox; reviewed 2026-11-04.

- [PAY-007](../CONTRACT.md) — **PARTIAL**: Offer cash-at-retail and offline payment options. Matching acceptance: “Generate a cash code, receive and replay its retail transaction, clear a check and return another; reconcile resident balances to settlement batches without treating a printed code as collected rent.”
  - Evidence: `src/terrace/ledger.ts`
  - Gap: Manual external receipts exist; retail network, check deposits and clearance&#47;return states are absent.

**Uncovered:** PAY-007: PARTIAL. Manual external receipts exist; retail network, check deposits and clearance&#47;return states are absent. Check scanning and outsourced lockbox processing are not replaced by recording an external receipt.

### Send delinquency notices and follow up

**Partial** — gap remains.

Official documentation: [Rent Manager accounting](https://www.rentmanager.com/accounting/) — Accounts Receivable notice schedules; reviewed 2026-11-04.

- [PAY-011](../CONTRACT.md) — **PARTIAL**: Work delinquencies to a recorded outcome. Matching acceptance: “Run a sequence for three late households, receive a reply and payment plan, settle one balance and break another promise; verify stopped messages, next actions and human notice approval, and serve the approved pay-or-quit notice with recorded posting evidence and its expiry date computed from service.”
  - Evidence: `src/terrace/tenancies.ts`; `src/terrace/ledger.ts`; `tests/terrace.test.mjs`
  - Gap: Arrears totals and approved drafts exist; delivered sequences, plans, replies and resolution tracking are absent.

- [PORTAL-009](../CONTRACT.md) — **PARTIAL**: Print mail and record service of notices. Matching acceptance: “Approve a Florida deposit-claim notice and send it certified through the Lob test boundary, or record a certified tracking number for office mail; show the 30-day deadline met against the mailing date and a late mailing flagged as missed; serve a pay-or-quit notice by posting with recorded photo and server; return one mailed letter as undeliverable and see a follow-up.”
  - Evidence: `tests/portal-threads.mjs` — journey, invoked by the PORTAL-006 registration in `tests/terrace.test.mjs`: five recipient-specific frozen PDFs, combined batch and manifest; exact hash approval and downloads; changed-content and revoked-grant refusal; staff portfolio 404 and role 403, stale-proof refusal; printing distinct from service; structured server identity, actual timestamp, office certified tracking and photo originals; immutable returned and uncertain attempts with assigned reconciliation; native restart, readable export, inert restore, retention holds, eligible erasure and later-journal resurrection refusal. `tests/portal-threads-browser.mjs` — shared thread native journey in push Verify: office preparation, exact PDF review and approval, frozen-byte downloads and physical-service capture through native Messages, asserted at 1440 with screenshots at 1440 and 390.
  - Gap: Terrace counsel engagement and PORT-008 reviewed authored packs and notice template contents remain unavailable; statutory sufficiency, notice eligibility, service-based deadlines and mailing extensions remain unqualified. Deposit-disposition acceptance still depends on ACCT-004. Lob account and entitlement, provider mailing and tracking events and complete acceptance across pay-or-quit, lease violation, entry, nonrenewal, deposit disposition and owner letters remain outstanding. Vendor postal addresses are not yet recorded, so their print preparation is held rather than guessed. Current communication authority, consent and custody limits remain unchanged; recorded service and a printed PDF prove no legal sufficiency or provider delivery.

**Uncovered:** PAY-011: PARTIAL. Arrears totals and approved drafts exist; delivered sequences, plans, replies and resolution tracking are absent. PORTAL-009: PARTIAL. Terrace counsel engagement and PORT-008 reviewed authored packs and notice template contents remain unavailable; statutory sufficiency, notice eligibility, service-based deadlines and mailing extensions remain unqualified. Deposit-disposition acceptance still depends on ACCT-004. Lob account and entitlement, provider mailing and tracking events and complete acceptance across pay-or-quit, lease violation, entry, nonrenewal, deposit disposition and owner letters remain outstanding. Vendor postal addresses are not yet recorded, so their print preparation is held rather than guessed. Current communication authority, consent and custody limits remain unchanged; recorded service and a printed PDF prove no legal sufficiency or provider delivery.

### Maintain double-entry property accounting

**Covered** — mapped replacement acceptance passed.

Official documentation: [Rent Manager accounting](https://www.rentmanager.com/accounting/) — Complete Double-Entry Accounting System; reviewed 2026-11-04.

- [ACCT-001](../CONTRACT.md) — **DONE**: Maintain a balanced property ledger. Matching acceptance: “Post rent, deposit, vendor expense and owner contribution across two properties, attempt an unbalanced entry and inspect the trial balance and each subledger back to source.”
  - Evidence: `tests/journal.mjs` (journey, in `tests/terrace.test.mjs` ACCT-001&#47;ACCT-011): rent, deposits, expenses and contributions across two properties; unbalanced and cross-owner&#47;fund refusals; chart&#47;opening entries; trial and owner/property/resident/vendor/deposit subledgers back to sources; duplicate receipt reversal with unchanged originals; live role&#47;scope, migration, restart and archive restore; `tests/journal-browser.mjs`: native posting and filtered subledger at 1440/390; `migrations/core/0056_journal.sql`; `src/terrace/journal.ts`
  - Gap: None in the contract row.

### Allocate receipts to property bank accounts

**Partial** — gap remains.

Official documentation: [Rent Manager accounting](https://www.rentmanager.com/accounting/) — Bank Deposits; reviewed 2026-11-04.

- [ACCT-002](../CONTRACT.md) — **PARTIAL**: Separate operating trust and deposit accounts. Matching acceptance: “Receive rent and deposits into distinct accounts, attempt an owner payout from deposit funds and an inter-owner transfer, and verify blocked execution and separately reconciled beneficiary balances.”
  - Evidence: `tests/trust.mjs` (journey, via `tests/terrace.test.mjs` “ACCT-002 designated bank custody preserves beneficiary funds through approved transfers”): rent&#47;deposit receipt separation, deposit-funded payout and inter-owner refusal with retained exceptions, per-bank beneficiary balances reconciled to journal, approval/reserve/scope/recovery; `tests/trust-browser.mjs`: native bank configuration, transfer review/approval/external reference and balances at 1440/390; `migrations/core/0059_trust_accounts.sql`; `src/terrace/trust.ts`; `docs/trust-accounts.md`
  - Gap: Ct approval pending for the adopted conservative trust-authorization default: owner-only configuration&#47;assignment, scoped preparation&#47;recording, ROLE-003 human approval, fresh email-link proof and same-beneficiary/property/designated-purpose transfers with a dated source-bank reserve floor. No bank money movement or statement verification is claimed.

**Uncovered:** ACCT-002: PARTIAL. Ct approval pending for the adopted conservative trust-authorization default: owner-only configuration&#47;assignment, scoped preparation&#47;recording, ROLE-003 human approval, fresh email-link proof and same-beneficiary/property/designated-purpose transfers with a dated source-bank reserve floor. No bank money movement or statement verification is claimed.

### Record and approve bills

**Covered** — mapped replacement acceptance passed.

Official documentation: [Rent Manager accounting](https://www.rentmanager.com/accounting/) — Accounts Payable and Bills; reviewed 2026-11-04.

- [ACCT-007](../CONTRACT.md) — **DONE**: Capture and approve vendor bills. Matching acceptance: “Upload the same invoice twice, split an approved landscaping bill across properties, exceed an owner’s limit and inspect the held bill, approval route and resulting payable.”
  - Evidence: `migrations/core/0041_bills.sql`; `src/terrace/bills.ts`; `src/terrace/bills-input.ts`; `src/terrace/bills-authority.ts`; `src/terrace/bills-templates.ts`; `src/terrace/bills-attachments.ts`; `src/terrace/bills-retention.ts`; `src/terrace/bills-view.ts`; `src/terrace/owners.ts`; `tests/bills.mjs`; `tests/terrace.test.mjs`
  - Gap: None in the contract row.

### Execute vendor payments

**Missing** — gap remains.

Official documentation: [Rent Manager accounting](https://www.rentmanager.com/accounting/) — AvidPay and accounts payable; reviewed 2026-11-04.

- [ACCT-008](../CONTRACT.md) — **MISSING**: Pay vendors and reconcile payment outcomes. Matching acceptance: “Approve a vendor batch, change one bank destination and hold it, execute the unchanged items in the paying account’s ACCT-018 NACHA file and import an R01 return from the bank’s return file; show one payment per bill, a remittance notice per vendor and the reopened returned payable.”
  - Evidence: None recorded.
  - Gap: Vendor payment rails, payee controls and reconciliation are absent.

**Uncovered:** ACCT-008: MISSING. Vendor payment rails, payee controls and reconciliation are absent.

### Disburse owner funds

**Missing** — gap remains.

Official documentation: [Rent Manager accounting](https://www.rentmanager.com/accounting/) — Owner contributions and distributions; reviewed 2026-11-04.

- [ACCT-010](../CONTRACT.md) — **MISSING**: Disburse owner funds by ACH or check. Matching acceptance: “Prepare a joint-owner distribution with a pending ACH receipt and unpaid repair, approve cleared funds only, execute it in the trust account’s ACCT-018 NACHA file and import an R01 return for one share from the bank’s return file; show corrected cash and one replacement requiring new approval.”
  - Evidence: None recorded.
  - Gap: Owner distributions, ACH&#47;check execution and return accounting are absent.

**Uncovered:** ACCT-010: MISSING. Owner distributions, ACH&#47;check execution and return accounting are absent.

### Connect and reconcile bank transactions

**Missing** — gap remains.

Official documentation: [Rent Manager accounting](https://www.rentmanager.com/accounting/) — Electronic Reconciliations; reviewed 2026-11-04.

- [ACCT-005](../CONTRACT.md) — **MISSING**: Connect Plaid bank feeds. Matching acceptance: “Connect two bank accounts through the provider boundary, import duplicate and pending-to-posted lines, expire consent and reconnect; verify no duplicate bank transaction and a visible freshness gap.”
  - Evidence: None recorded.
  - Gap: Plaid bank feeds and consent&#47;freshness management are absent.

- [ACCT-006](../CONTRACT.md) — **DONE**: Match statements and perform three-way reconciliation. Matching acceptance: “Reconcile a month with batched rent, fee, outstanding check, a cleared owner ACH batch and missing deposit; resolve one exception and show the remaining difference prevents a balanced three-way sign-off.”
  - Evidence: `tests/reconcile.mjs` journey: reviewed CSV, OFX, QFX and PDF lines, exact settlement and ACH matching, check numbers, outstanding items, unresolved differences and balanced sign-off, stale books, close refusal, scope and restore; `tests/reconcile-browser.mjs`: native matching and sign-off at desktop and phone widths; `docs/bank-reconciliation.md`
  - Gap: None for current recorded sources. ACCT-017 and ACCT-018 inherit check-register and transmitted-file source matching before their doors ship.

**Uncovered:** ACCT-005: MISSING. Plaid bank feeds and consent&#47;freshness management are absent. ACCT-006: None for current recorded sources. ACCT-017 and ACCT-018 inherit check-register and transmitted-file source matching before their doors ship.

### Produce cash and accrual financial reports

**Partial** — gap remains.

Official documentation: [Rent Manager accounting](https://www.rentmanager.com/accounting/) — Balance Sheet, General Ledger and Profit and Loss; reviewed 2026-11-04.

- [ACCT-013](../CONTRACT.md) — **DONE**: Report cash and accrual financials. Matching acceptance: “Record earned unpaid rent and an unpaid bill, compare cash and accrual P&L and balance sheet, and drill each difference to its original transaction.”
  - Evidence: `tests/financial-reports.mjs` via `tests/terrace.test.mjs` “ACCT-013: cash and accrual statements reconcile unpaid rent and bills, settlement timing and immutable scoped source drills”: earned unpaid rent, approved unpaid invoice, cash and accrual income and balance-sheet comparison, original-source drills, settlement and reversal timing, trial balance, aging, cash flow, property and owner and entity scope, unchanged ledger, restart and archive restore; `tests/financial-reports-browser.mjs`: native basis and source drill at 1440 and 390, hover and keyboard tooltips; `src/terrace/financial-reports.ts`; `docs/financial-reports.md`
  - Gap: None. Exact inclusive dates, basis timing, oldest-first aging and explicit unassigned entity semantics are documented; no bank verification or tax certification.

**Uncovered:** ACCT-013: None. Exact inclusive dates, basis timing, oldest-first aging and explicit unassigned entity semantics are documented; no bank verification or tax certification.

### Prepare and file vendor and owner 1099s

**Missing** — gap remains.

Official documentation: [Rent Manager accounting](https://www.rentmanager.com/accounting/) — Tax Tools; reviewed 2026-11-04.

- [ACCT-014](../CONTRACT.md) — **MISSING**: Prepare and file owner and vendor 1099s. Matching acceptance: “Prepare owner&#47;vendor forms from reconciled payments, correct an invalid TIN, approve a Nelco submission and process accepted/rejected/corrected outcomes without duplicate filings.”
  - Evidence: None recorded.
  - Gap: W-9, reportable payment calculation, Nelco filing and correction workflows are absent.

**Uncovered:** ACCT-014: MISSING. W-9, reportable payment calculation, Nelco filing and correction workflows are absent.

### Print and track checks

**Missing** — gap remains.

Official documentation: [Rent Manager accounting](https://www.rentmanager.com/accounting/) — Check Management; reviewed 2026-11-04.

- [ACCT-017](../CONTRACT.md) — **MISSING**: Print mail and register trust checks. Matching acceptance: “Print a deposit-refund check from the deposit bank account and a vendor check batch from the operating trust account, void and reissue one check with new approval, refuse a duplicate check number and export positive-pay for the batch; clear one check against the bank feed and leave one outstanding past its stale date with a follow-up.”
  - Evidence: None recorded.
  - Gap: MICR check printing, Lob check mailing, check-number register, void&#47;reissue, stale checks and positive pay are absent.

**Uncovered:** ACCT-017: MISSING. MICR check printing, Lob check mailing, check-number register, void&#47;reissue, stale checks and positive pay are absent.

### Meter and bill utility consumption

**Partial** — gap remains.

Official documentation: [Rent Manager accounting](https://www.rentmanager.com/accounting/) — Metered Utilities; reviewed 2026-11-04.

- [ACCT-016](../CONTRACT.md) — **DONE**: Account for utility recoveries and ancillary income. Matching acceptance: “Allocate one water invoice by a reviewed occupancy formula, post parking and taxable ancillary charges and verify source-linked tenant allocations equal the approved recoverable total.”
  - Evidence: `migrations/core/0038_recoveries.sql`; `src/terrace/recoveries.ts`; `src/terrace/tax.ts`; `src/terrace/recovery-view.ts`; `src/terrace/charge-run.ts`; `src/terrace/api.ts`; `tests/terrace.test.mjs`
  - Gap: None in the contract row.

**Uncovered:** Meter-reading intake, consumption history and consumption-based billing are not proved by the mapped invoice-allocation acceptance.

### Resident payments, leases and requests

**Missing** — gap remains.

Official documentation: [Rent Manager marketing and leasing](https://www.rentmanager.com/marketing-leasing/) — Prospect and Tenant Online Portal; reviewed 2026-11-04.

- [PORTAL-001](../CONTRACT.md) — **DONE**: Give residents a complete account portal. Matching acceptance: “Sign in as a resident with two leases, inspect an itemized balance, pay rent, download a receipt and update contact preferences; direct access to an unrelated household is denied.”
  - Evidence: `tests/card-payments.mjs` — journey, registered as PAY-003 in `tests/terrace.test.mjs`, with `tests/resident-account.mjs` — accountBefore and accountPaid: two-lease resident sign-in; populated current and future itemized charges and household obligations; separate native deposits; pending funds that do not reduce the balance; explicit hosted card consent and canonical once-only provider receipts; tagged receipt PDF and source amount; primary and co-tenant contact preferences, optional-email admission, no destination changes and no sends; unrelated household, private guarantor, screening and delegate refusal; staff portfolio 404 and role 403; stale email-link bank-change refusal with no stored bank details; restart, revoked sessions, erased sharing and older-archive resurrection refusal. `tests/retention.mjs` — retentionJourney: an explicit historic account grant retains its itemized balance while even a shared original still requires current household entitlement. `tests/resident-account-browser.mjs` — resident account browser journey, invoked by push Verify: owner sharing, two leases, itemized account, future charges, contact Settings and receipt downloads asserted at 1440, with captures at 1440 and 390 and staff icon tooltip focus and hover. Only Stripe is faked at its network edge; PAY-003 test mode and bank-settlement boundaries remain explicit.
  - Gap: None in the contract row.

- [PAY-002](../CONTRACT.md) — **MISSING**: Collect rent through ACH. Matching acceptance: “Pay a resident balance through ACH sandbox authorization, restart after provider submission and reconcile pending then settled callbacks without a second debit or exposing bank credentials.”
  - Evidence: None recorded.
  - Gap: ACH collection and processor reconciliation are absent.

- [PAY-003](../CONTRACT.md) — **PARTIAL**: Collect rent by card. Matching acceptance: “Pay a partial balance with a test card requiring authentication, inspect the disclosed fee, complete payment and confirm one resident receipt and matching provider reference.”
  - Evidence: `tests/terrace.test.mjs` — "PAY-003: hosted card consent, policy admission, provider-only receipts, declines, expiry and replay" (`tests/card-payments.mjs`): scoped collection and versioned consent, inherited admission and atomic reservations, fee disclosure, canonical provider events and charge references, decline, expiry, concurrent replay and restart, credential-free restore and demo no-egress; passed at ea40fc1266b84123ea94242354838db93eca6c74 in heavy job 20261026T053952942981Z-heavy-slot-1f69fefb. `tests/card-payments-browser.mjs` — "journey", with --buffered-http: native review, pending and receipt states, staff reconciliation and uncertain-request resumption at 1440 and 390 through actual buffered Worker responses; only Stripe is faked at the network edge. Passed at c3d97576086bf0ca54d74f813846464509445986 in heavy job 20261026T054310729464Z-heavy-slot-7abac798; captures inspected. Provider-only sandbox capture on 26 October 2026: session cs_test_a1aCgX0MIKGGPYAZsRqaGqaK5zUkKkKIFQ87bwQ6m5YzF8t324KUuHTuni, intent pi_3UUfhRDg8BoejKxo4HBAlIoy, event evt_1UUfhSDg8BoejKxoEpx7eoxW, $10.00 USD paid in test mode. The public pre-event ledger contained no receipt. Two admitted live journeys stalled reading the resident return in Chromium although public HTTP returned the pending page. The corrected buffered transport passed the native network-edge journey; its held-key retry was cancelled after nineteen minutes with eight local jobs still ahead and made no provider request.
  - Gap: End-to-end live Stripe ledger receipt, decline, required authentication and provider-event replay remain unproved. Deposit collection and liability require ACCT-003 and PORT-008 counsel-reviewed rules; actual provider settlement into the ACCT-002 mapped banks and authorized production configuration remain unproved. The implementation remains test-only. CT approval of card authority, consent and zero payer fee remains open; PAY-005 stays CT-held and is inherited unchanged.

- [LEASE-011](../CONTRACT.md) — **MISSING**: Collect legally evidenced electronic signatures. Matching acceptance: “Send a multi-signer lease, process one decline and a replacement envelope, complete all signatures, replay its callback and attach exactly one executed PDF&#47;certificate to the activated tenancy.”
  - Evidence: None recorded.
  - Gap: E-signature provider&#47;sibling integration and execution lifecycle are absent.

**Uncovered:** PAY-002: MISSING. ACH collection and processor reconciliation are absent. PAY-003: PARTIAL. End-to-end live Stripe ledger receipt, decline, required authentication and provider-event replay remain unproved. Deposit collection and liability require ACCT-003 and PORT-008 counsel-reviewed rules; actual provider settlement into the ACCT-002 mapped banks and authorized production configuration remain unproved. The implementation remains test-only. CT approval of card authority, consent and zero payer fee remains open; PAY-005 stays CT-held and is inherited unchanged. LEASE-011: MISSING. E-signature provider&#47;sibling integration and execution lifecycle are absent.

### Owner account and property access

**Partial** — gap remains.

Official documentation: [Rent Manager Owner Web Access](https://www.rentmanager.com/webinars/owner-web-access/) — Owner Web Access content and user accounts; reviewed 2026-11-04.

- [PORTAL-002](../CONTRACT.md) — **PARTIAL**: Give owners their financial and property portal. Matching acceptance: “Joint owners inspect different ownership periods, approve an over-limit repair, contribute funds and download a statement&#47;invoice; access another owner’s report and screening file is denied.”
  - Evidence: `tests/statements.mjs` — "journey", invoked by the ACCT-012 registration in `tests/terrace.test.mjs`: exact seller and buyer invoice originals on either side of a transfer, expense cents and CSV isolation, absent and other-owner files refused, staff cookies excluded, screening refusal, shared originals held, changed approval withdrawal, cross-property revision history, restart, immediate revocation, audit and native restore with fresh authorization. `tests/statements-browser.mjs`: native owner statement expense, fee and reserve sections and invoice downloads at 1440 and 390.
  - Gap: Occupancy and rent detail, complete distribution status and documents, owner contributions, communication, over-limit repair decisions with PORTAL-007 riders, joint-owner original disclosure and staff bank-change fresh-proof assertions remain unproved. Adopted conservative original-disclosure default pending ct: a live owner grant reads only an exact currently approved invoice attachment when every historical allocation belongs wholly to that owner on its invoice date; shared-beneficiary originals stay with staff for review. No new payment, send, bank-change or approval authority.

**Uncovered:** PORTAL-002: PARTIAL. Occupancy and rent detail, complete distribution status and documents, owner contributions, communication, over-limit repair decisions with PORTAL-007 riders, joint-owner original disclosure and staff bank-change fresh-proof assertions remain unproved. Adopted conservative original-disclosure default pending ct: a live owner grant reads only an exact currently approved invoice attachment when every historical allocation belongs wholly to that owner on its invoice date; shared-beneficiary originals stay with staff for review. No new payment, send, bank-change or approval authority.

### Provide owner investment statements

**Partial** — gap remains.

Official documentation: [Rent Manager Owner Web Access](https://www.rentmanager.com/webinars/owner-web-access/) — Property and investment-related information; reviewed 2026-11-04.

- [ACCT-012](../CONTRACT.md) — **PARTIAL**: Publish complete owner statements. Matching acceptance: “Publish a monthly owner statement with rent, a paid bill and distribution, reconcile its closing cash to books&#47;bank and download the source invoice from the owner portal.”
  - Evidence: `tests/statements.mjs` — "journey": staff cash draft opening and closing cash, expenses, reserves, separate deposits, liabilities and dated ownership. `tests/statements.mjs` — "journey", invoked by the ACCT-012 registration in `tests/terrace.test.mjs`: exact seller and buyer invoice originals on either side of a transfer, expense cents and CSV isolation, absent and other-owner files refused, staff cookies excluded, screening refusal, shared originals held, changed approval withdrawal, cross-property revision history, restart, immediate revocation, audit and native restore with fresh authorization. `tests/statements-browser.mjs`: native owner statement expense, fee and reserve sections and invoice downloads at 1440 and 390.
  - Gap: Complete paid-bill and distribution sources, corrected immutable publication, scheduled delivery, receipt and invoice bundles, bank tie-out and REPORT-007 actuals remain unproved. Joint-owner originals are held. Adopted conservative original-disclosure default pending ct: a live owner grant reads only an exact currently approved invoice attachment when every historical allocation belongs wholly to that owner on its invoice date; shared-beneficiary originals stay with staff for review. No new payment, send, bank-change or approval authority.

**Uncovered:** ACCT-012: PARTIAL. Complete paid-bill and distribution sources, corrected immutable publication, scheduled delivery, receipt and invoice bundles, bank tie-out and REPORT-007 actuals remain unproved. Joint-owner originals are held. Adopted conservative original-disclosure default pending ct: a live owner grant reads only an exact currently approved invoice attachment when every historical allocation belongs wholly to that owner on its invoice date; shared-beneficiary originals stay with staff for review. No new payment, send, bank-change or approval authority.

### Receive resident repair requests

**Covered** — mapped replacement acceptance passed.

Official documentation: [Rent Manager marketing and leasing](https://www.rentmanager.com/marketing-leasing/) — Tenant Web Access maintenance requests; reviewed 2026-11-04.

- [PORTAL-004](../CONTRACT.md) — **DONE**: Receive resident maintenance requests. Matching acceptance: “Submit a leaking-tap request with photo and access restrictions, add another household report and follow the tracking link through scheduled work and resident-confirmed resolution.”
  - Evidence: `tests/portal-requests.mjs` — "journey" invoked by `tests/portal.mjs` — "journey" in the ROLE-002 registration of `tests/terrace.test.mjs`: leaking-tap report with original photo, access restrictions, pets and preferred times; exact video bytes; private tracking and scheduled work; second verified mailbox with a separate original concern and answer; resident confirmation without closing another report or the work order; staff role 403 and portfolio 404 on linking and original review; unrelated resident, delegated contact, owner and vendor refusal; gas-smell WORK-001 case with frozen approved guidance version, on-call email and replay without a duplicate alert; fresh authorized invitations after restore with original media and no restored credentials. `tests/portal-requests-browser.mjs`: intake, receipt, tracking, scheduled work, answer, resolution, emergency guidance, staff review and urgent queue at 1440 and 390; text-labelled portal controls and staff hover and keyboard tooltips.
  - Gap: None in the contract row.

### Assign and track service issues

**Covered** — mapped replacement acceptance passed.

Official documentation: [Rent Manager maintenance](https://www.rentmanager.com/maintenance/) — Service Issues and statuses; reviewed 2026-11-04.

- [WORK-006](../CONTRACT.md) — **DONE**: Dispatch and track technician progress. Matching acceptance: “Dispatch an approved order, receive vendor acceptance and a parts hold, miss its appointment and reassign it; inspect notifications, state history and a still-open resident issue.”
  - Evidence: `migrations/core/0049_dispatch.sql`; `src/terrace/dispatch.ts`; `src/terrace/dispatch-mail.ts`; `src/terrace/dispatch-view.ts`; `tests/dispatch.mjs`; `tests/dispatch-browser.mjs`; `tests/terrace.test.mjs`
  - Gap: None in the contract row.

### Schedule technicians and appointments

**Partial** — gap remains.

Official documentation: [Rent Manager maintenance](https://www.rentmanager.com/maintenance/) — Maintenance Scheduling; reviewed 2026-11-04.

- [WORK-005](../CONTRACT.md) — **PARTIAL**: Book appointments and resident access. Matching acceptance: “Book a repair, receive resident confirmation, cancel from the vendor portal and reschedule with a new permitted access window; notify both parties and preserve appointment history.”
  - Evidence: `tests/appointments.mjs` — "journey": permission, qualification, calendars, cancellation, rescheduling and report timing. `tests/portal.mjs` — "journey": vendor-portal confirmation and cancellation. `tests/messages.mjs` — "journey": reviewed arrival text, unanswered window stays proposed, signed Y confirms once after vendor confirmation, cancelled and changed-work windows stay unconfirmed, separately approved cancellation emails to both parties. `tests/messages-browser.mjs`: arrival confirmation and reply history at 1440 and 390.
  - Gap: Resident communication consent and signed-reply authority defaults await ct approval. Actual arrival-text delivery and resident-origin reply remain unproved under TEST-only authorization; signed fixtures prove native routing only. Notifications require separate exact-content human approval; no automatic notification is authorized. CT 26 October 2026 approves the current-invitation signed-reply policy WITH RIDERS, separate from resident entry permission and vendor confirmation. Earlier pending-policy wording is historical. Actual delivery, resident-origin reply proof, separately approved notifications and independent runtime and browser evidence remain gaps. Status remains partial.

**Uncovered:** WORK-005: PARTIAL. Resident communication consent and signed-reply authority defaults await ct approval. Actual arrival-text delivery and resident-origin reply remain unproved under TEST-only authorization; signed fixtures prove native routing only. Notifications require separate exact-content human approval; no automatic notification is authorized. CT 26 October 2026 approves the current-invitation signed-reply policy WITH RIDERS, separate from resident entry permission and vendor confirmation. Earlier pending-policy wording is historical. Actual delivery, resident-origin reply proof, separately approved notifications and independent runtime and browser evidence remain gaps. Status remains partial.

### Bill completed work to owners or tenants

**Missing** — gap remains.

Official documentation: [Rent Manager maintenance](https://www.rentmanager.com/maintenance/) — Work Orders and Integrated Billing; reviewed 2026-11-04.

- [WORK-009](../CONTRACT.md) — **MISSING**: Match invoice work and owner charge. Matching acceptance: “Submit a completed repair invoice exceeding its quote, flag the unmatched line, approve a corrected invoice and trace work, payable, payment and owner statement without double entry.”
  - Evidence: `src/terrace/bills.ts`; `src/terrace/bills-input.ts`; `src/terrace/bills-authority.ts`; `src/terrace/owners.ts`; `tests/bills.mjs`; `tests/terrace.test.mjs`
  - Gap: Staff-entered bills match supplier, approved work and cumulative estimate, hold excess spend, and post approved owner allocations. Invoice extraction and source locations, labor and material and completion matching, settlement linkage and invoiced maintenance-report costs are absent. WORK-009 remains missing until ACCT-008 and ACCT-012 ship.

- [WORK-014](../CONTRACT.md) — **DONE**: Control maintenance budgets inventory and chargebacks. Matching acceptance: “Consume a stocked part on a repair, cross a budget limit, propose a resident chargeback and approve one allocation; reconcile stock, payable, receivable and owner cost.”
  - Evidence: `tests/work-budgets.mjs` — "authorityBoundaries", invoked by `tests/bills.mjs` — "journey": before, on and after household joining and leaving dates at the source and current property-local day; before, on and after ownership transfer dates; October 25 UTC versus October 24 in Los Angeles; proposal and approval refusal after household or ownership changes, with no extra receivable. `tests/bills.mjs` — "journey" invoking `tests/work-budgets.mjs` — "journey": the existing stock consumption and budget-limit assertions plus resident proposal and independent approval; resident, owner and insurance allocations; source-tax preservation; exact payable, receivable and net owner-cost reconciliation; explicit authorization and fingerprint refusal; role, property and beneficiary refusal; duplicate and concurrent recovery refusal; owner-statement source allocations, restart and archive restore. `tests/work-budgets-browser.mjs`: native proposal, pending review and approved allocation at 1440 and 390, existing stock and budget screens, tooltip hover and keyboard focus.  Ct approved the authorization default on 25 October 2026. Existing bill preparers propose and independent owners or currently scoped portfolio managers approve under ROLE-001 and ROLE-003. Current household rights and property-local ownership, exact recipient and source, durable authorization declaration and version, included source tax and atomic recovery limits apply. No new readers, legal determination, notices or money movement. `tests/bills.mjs` — "journey", its "retention" segment, proves accounting-hold preservation and eligible authorization-text erasure while cents and approval survive. `tests/work-budgets.mjs` — "journey" proves subject-scoped access and restart and archive recovery. `tests/bills.mjs` — "journey" also refuses an older private authorization archive against the later erasure journal with an empty destination.
  - Gap: None in the contract row.

- [WORK-015](../CONTRACT.md) — **MISSING**: Chargeback notices, disputes and collection. Unmatched acceptance: “No matching acceptance is defined in CONTRACT.md.”
  - Evidence: None recorded.
  - Gap: No chargeback notices, dispute workflow or collection exists. This future clause inherits WORK-014’s explicit boundary; recorded accounting allocations establish no legal liability, communication delivery or money movement.

**Uncovered:** WORK-009: MISSING. Staff-entered bills match supplier, approved work and cumulative estimate, hold excess spend, and post approved owner allocations. Invoice extraction and source locations, labor and material and completion matching, settlement linkage and invoiced maintenance-report costs are absent. WORK-009 remains missing until ACCT-008 and ACCT-012 ship. WORK-015: mapped acceptance no longer matches CONTRACT.md. WORK-015: MISSING. No chargeback notices, dispute workflow or collection exists. This future clause inherits WORK-014’s explicit boundary; recorded accounting allocations establish no legal liability, communication delivery or money movement.

### Capture mobile inspection evidence

**Partial** — gap remains.

Official documentation: [Rent Manager maintenance](https://www.rentmanager.com/maintenance/) — rmAppSuite Pro inspections; reviewed 2026-11-04.

- [WORK-011](../CONTRACT.md) — **PARTIAL**: Complete mobile move-in and move-out inspections. Matching acceptance: “Inspect on a phone offline, sync photos, compare move-out damage to the entry record and reject an unsupported deduction while retaining the resident’s disputed finding.”
  - Evidence: `tests/field-capture.test.mjs` — ‘WORK-011: structured entry&#47;exit findings preserve disputes and refuse unsupported deductions’ (`tests/mobile-inspections.mjs`); `tests/mobile-inspections-browser.mjs` — phone-offline originals, persisted device drafts, manual changed-checklist reconciliation and retained comparison&#47;dispute at 1440/390; `src/terrace/field-evidence-inspections.ts`; `migrations/core/0071_mobile_inspections.sql`
  - Gap: Structured room&#47;asset checklists, original media, readings, sourced acknowledgement&#47;disputes, completed inspections, entry&#47;exit comparison and evidence-gated human work&#47;deduction proposals ship. Adopted conservative default pending ct: new capture/configuration/acknowledgement/proposal doors are owner or portfolio-manager only; offline originals stay on the device only by explicit consent until explicit sync or deletion; acknowledgements are staff-sourced, never resident authentication or signatures; human decisions execute no work or deposit charge.

**Uncovered:** WORK-011: PARTIAL. Structured room&#47;asset checklists, original media, readings, sourced acknowledgement&#47;disputes, completed inspections, entry&#47;exit comparison and evidence-gated human work&#47;deduction proposals ship. Adopted conservative default pending ct: new capture/configuration/acknowledgement/proposal doors are owner or portfolio-manager only; offline originals stay on the device only by explicit consent until explicit sync or deletion; acknowledgements are staff-sourced, never resident authentication or signatures; human decisions execute no work or deposit charge.

### Schedule recurring maintenance

**Covered** — mapped replacement acceptance passed.

Official documentation: [Rent Manager maintenance](https://www.rentmanager.com/maintenance/) — Memorized Service Issues; reviewed 2026-11-04.

- [WORK-010](../CONTRACT.md) — **DONE**: Schedule preventive and recurring maintenance. Matching acceptance: “Schedule annual HVAC service and quarterly safety work, replay a scheduler run, defer one occurrence and replace an asset; inspect exactly one order per due occurrence and an explicit overdue exception.”
  - Evidence: `migrations/core/0021_schedules.sql`; `src/terrace/schedules.ts`; `src/terrace/schedule-view.ts`; `src/terrace/job-writes.ts`; `tests/terrace.test.mjs`
  - Gap: None in the contract row.

### Track purchases, inventory and budgets

**Partial** — gap remains.

Official documentation: [Rent Manager accounting](https://www.rentmanager.com/accounting/) — Budgeting and Purchase Orders; reviewed 2026-11-04.

- [WORK-014](../CONTRACT.md) — **DONE**: Control maintenance budgets inventory and chargebacks. Matching acceptance: “Consume a stocked part on a repair, cross a budget limit, propose a resident chargeback and approve one allocation; reconcile stock, payable, receivable and owner cost.”
  - Evidence: `tests/work-budgets.mjs` — "authorityBoundaries", invoked by `tests/bills.mjs` — "journey": before, on and after household joining and leaving dates at the source and current property-local day; before, on and after ownership transfer dates; October 25 UTC versus October 24 in Los Angeles; proposal and approval refusal after household or ownership changes, with no extra receivable. `tests/bills.mjs` — "journey" invoking `tests/work-budgets.mjs` — "journey": the existing stock consumption and budget-limit assertions plus resident proposal and independent approval; resident, owner and insurance allocations; source-tax preservation; exact payable, receivable and net owner-cost reconciliation; explicit authorization and fingerprint refusal; role, property and beneficiary refusal; duplicate and concurrent recovery refusal; owner-statement source allocations, restart and archive restore. `tests/work-budgets-browser.mjs`: native proposal, pending review and approved allocation at 1440 and 390, existing stock and budget screens, tooltip hover and keyboard focus.  Ct approved the authorization default on 25 October 2026. Existing bill preparers propose and independent owners or currently scoped portfolio managers approve under ROLE-001 and ROLE-003. Current household rights and property-local ownership, exact recipient and source, durable authorization declaration and version, included source tax and atomic recovery limits apply. No new readers, legal determination, notices or money movement. `tests/bills.mjs` — "journey", its "retention" segment, proves accounting-hold preservation and eligible authorization-text erasure while cents and approval survive. `tests/work-budgets.mjs` — "journey" proves subject-scoped access and restart and archive recovery. `tests/bills.mjs` — "journey" also refuses an older private authorization archive against the later erasure journal with an empty destination.
  - Gap: None in the contract row.

**Uncovered:** Purchase-order creation and vendor reply workflows are not replaced by stock and budget accounting.

### Read rent roll and occupancy reports

**Covered** — mapped replacement acceptance passed.

Official documentation: [Rent Manager reporting](https://www.rentmanager.com/reporting/) — Built-In Reports; reviewed 2026-11-04.

- [REPORT-001](../CONTRACT.md) — **DONE**: Explain the complete rent roll. Matching acceptance: “Run an as-of rent roll before and after a scheduled renewal and move-in, reconcile occupied&#47;vacant unit counts and effective rents and download the same filtered data.”
  - Evidence: `migrations/core/0026_rent_roll.sql`; `src/terrace/rent-roll.ts`; `src/terrace/rent-roll-view.ts`; `src/terrace/exports.ts`; `tests/terrace.test.mjs`
  - Gap: None in the contract row.

### Read aged receivables and delinquency

**Covered** — mapped replacement acceptance passed.

Official documentation: [Rent Manager accounting](https://www.rentmanager.com/accounting/) — Financial Reporting; reviewed 2026-11-04.

- [REPORT-002](../CONTRACT.md) — **DONE**: Report delinquency and collection performance. Matching acceptance: “Filter delinquency to one owner, include a returned ACH, an active plan and a voucher lease with unpaid HAP, reconcile aging to resident balances and show follow-up owner and next permitted action for each overdue household.”
  - Evidence: `migrations/core/0045_delinquency.sql`; `src/terrace/delinquency-math.ts`; `src/terrace/delinquency-report.ts`; `src/terrace/delinquency-view.ts`; `src/terrace/api.ts`; `src/terrace/retention.ts`; `src/terrace/erasure.ts`; `src/terrace/imports-target.ts`; `tests/delinquency.mjs`; `tests/terrace.test.mjs`
  - Gap: None in the contract row.

### Build custom property reports

**Covered** — mapped replacement acceptance passed.

Official documentation: [Rent Manager reporting](https://www.rentmanager.com/reporting/) — Report Writer and Custom Reports; reviewed 2026-11-04.

- [REPORT-005](../CONTRACT.md) — **DONE**: Build governed custom reports and fields. Matching acceptance: “Add a unit inspection field, use it in a saved report and document template, hide a sensitive owner field from leasing staff and verify their export&#47;merge cannot reveal it.”
  - Evidence: `migrations/core/0048_custom_reports.sql`; `src/terrace/custom-commands.ts`; `src/terrace/custom-reports.ts`; `src/terrace/custom-documents.ts`; `src/terrace/custom-view.ts`; `tests/custom-reports.mjs`; `tests/custom-browser.mjs`; `tests/terrace.test.mjs`
  - Gap: None in the contract row.

### Export source records for a reviewed migration

**Missing** — gap remains.

Official documentation: [Rent Manager January release notes](https://www.rentmanager.com/release-notes-jan/) — New Excel Export Capabilities; reviewed 2026-11-04.

- [MOVE-004](../CONTRACT.md) — **MISSING**: Move in from Rent Manager. Matching acceptance: “Import real redacted Excel reports and entitled API data, map units/owners/leases/work orders, reconcile deposits and receivable&#47;payable openings and identify missing original documents before approval.”
  - Evidence: None recorded.
  - Gap: Rent Manager reports&#47;API importer is absent.

- [MOVE-001](../CONTRACT.md) — **PARTIAL**: Reconcile complete migration before cutover. Matching acceptance: “Load a multi-property source with a missing deposit, duplicate household, vendor without a W-9 and a commercial lease held as an exception (BOUND-004), preview without writes, reconcile counts and balances, resolve exceptions and approve the exact migration manifest.”
  - Evidence: `tests/migration.mjs` — journey, called by the MOVE-009 registration in `tests/terrace.test.mjs`: multi-property source and vacant units; field mapping and every native record kind; missing deposit, duplicate household, missing W-9 and commercial holds; zero-write preview; source counts and excluded dispositions; resolved exceptions and exact manifest approval; eleven source and native opening accounts with zero difference or retained named exception; document originals, vendor and owner balance-forwards, five resident history kinds, native bill approval without duplicate balances, attribution, owner-only and revoked-credential refusal, restart, archive restore, shared-source legal holds, unrelated source preservation and erasure non-resurrection. `tests/migration-browser.mjs`: native preview, retained manifest and resident history, called on push Verify, with proof at 1440 and 390 and focus and hover tooltips. Native deposit links and separate 50000 and 20000 cent liabilities are asserted by the same migration journey; dropping native deposit writes fails its native journal assertion.
  - Gap: CT 28 October 2026 A16 and R1 demotion retained. Separate native deposit link and individual-amount assertions now pass, independently of the 70000 cent opening aggregate, and the deposit-write mutation is rejected; fresh judgment of these changed rows remains pending.

- [MOVE-010](../CONTRACT.md) — **PARTIAL**: Carry vendors year-to-date tax and resident ledger history. Matching acceptance: “Import an AppFolio vendor directory and year-to-date 1099 totals with a 30 June cutover, pay the same vendor in Terrace and produce one 1099 whose total equals pre-cutover plus post-cutover payments; show a migrated resident’s pre-cutover ledger lines in the resident ledger, on the eviction ledger export and on the deposit disposition statement, with the opening balance equal to the history’s closing balance.”
  - Evidence: `tests/migration.mjs` journey: restricted vendor directory and W-9 hold, vendor and owner year-to-date balance-forwards, five source-referenced resident history kinds, staff and resident monthly statements, opening balance and no duplicate cash.
  - Gap: AppFolio-format source adapter and independent incumbent summary reconciliation; complete owner and vendor tax carry-forward with post-cutover payments and one 1099 (ACCT-014 requires the unavailable Nelco filing account); eviction ledger export and deposit disposition integration (ACCT-004 awaits PORT-008 counsel content); complete 24-month statement and export proof remain owed.

**Uncovered:** MOVE-004: MISSING. Rent Manager reports&#47;API importer is absent. MOVE-001: PARTIAL. CT 28 October 2026 A16 and R1 demotion retained. Separate native deposit link and individual-amount assertions now pass, independently of the 70000 cent opening aggregate, and the deposit-write mutation is rejected; fresh judgment of these changed rows remains pending. MOVE-010: PARTIAL. AppFolio-format source adapter and independent incumbent summary reconciliation; complete owner and vendor tax carry-forward with post-cutover payments and one 1099 (ACCT-014 requires the unavailable Nelco filing account); eviction ledger export and deposit disposition integration (ACCT-004 awaits PORT-008 counsel content); complete 24-month statement and export proof remain owed. Source exports establish no completed Terrace importer or payment cutover. Account-specific access and report completeness remain unverified.

### Qualify recurring collection cutover

**Partial** — gap remains.

Official documentation: [Rent Manager accounting](https://www.rentmanager.com/accounting/) — Recurring integrated receivables; reviewed 2026-11-04.

- [MOVE-008](../CONTRACT.md) — **PARTIAL**: Shadow run and control payment cutover. Matching acceptance: “Shadow a rent cycle against source statements, hold a difference, approve a corrected cutover and demonstrate a retained old autopay cannot create a second Terrace collection; show every mandate’s reauthorization state.”
  - Evidence: `tests/shadow-run.mjs` — owner documentary rent comparison journey, registered through `tests/terrace.test.mjs`: exact source bytes and mapped rows; per-lease opening receivable, charges, recorded receipts, reductions and closing receivable; offsetting differences, missing and duplicate mappings, separate currencies, accountable held next actions, distinct corrected-source review, native-event invalidation even when opening totals are unchanged, non-owner and credential refusal, restart, accounting retention, shared legal holds, erasure and inert restore. `tests/shadow-run-browser.mjs` — native documentary capture and review at 1440 with screenshots at 1440 and 390, on push Verify.
  - Gap: Documentary rent comparison only; authentic incumbent shadow-cycle qualification, fees, complete owner statements, bank matching and future-schedule comparison remain outstanding. Cutover-date approval, period-by-period collecting-system authority, processor mandate reauthorization, stopping old scheduled collection and prevention of duplicate rent, deposit and payout execution remain unimplemented. Owner-only record custody is the conservative interim default under the standing scope rule; scoped delegation and provider boundaries remain unqualified. PAY-002 and PAY-004 authorized processor environments; PAY-003 live receipt, decline, 3DS and replay; mapped-bank settlement, authorized production configuration and CT card authority, consent and fee approval remain unqualified; PAY-005 stays CT-held. ACCT-003 and ACCT-004 remain blocked on PORT-008 counsel; trust, fee, refund and owner-statement disclosure approvals and payout-rail account and authorization holds are unchanged. Synthetic originals prove no authentic incumbent outcome.

**Uncovered:** MOVE-008: PARTIAL. Documentary rent comparison only; authentic incumbent shadow-cycle qualification, fees, complete owner statements, bank matching and future-schedule comparison remain outstanding. Cutover-date approval, period-by-period collecting-system authority, processor mandate reauthorization, stopping old scheduled collection and prevention of duplicate rent, deposit and payout execution remain unimplemented. Owner-only record custody is the conservative interim default under the standing scope rule; scoped delegation and provider boundaries remain unqualified. PAY-002 and PAY-004 authorized processor environments; PAY-003 live receipt, decline, 3DS and replay; mapped-bank settlement, authorized production configuration and CT card authority, consent and fee approval remain unqualified; PAY-005 stays CT-held. ACCT-003 and ACCT-004 remain blocked on PORT-008 counsel; trust, fee, refund and owner-statement disclosure approvals and payout-rail account and authorization holds are unchanged. Synthetic originals prove no authentic incumbent outcome.

### Manage owner-financed loans

**Unsupported** — gap remains.

Official documentation: [Rent Manager accounting](https://www.rentmanager.com/accounting/) — Loan Manager; reviewed 2026-11-04.

Replacement: intentionally unmapped. Status: unsupported. Evidence: none. Gap: Unsupported and intentionally unmapped: Terrace has no owner-financed loan amortization, payoff or prequalification replacement.

**Uncovered:** Unsupported and intentionally unmapped: Terrace has no owner-financed loan amortization, payoff or prequalification replacement.

### Reconcile commercial common-area charges

**Unsupported** — gap remains.

Official documentation: [Rent Manager accounting](https://www.rentmanager.com/accounting/) — Commercial Module; reviewed 2026-11-04.

Replacement: intentionally unmapped. Status: unsupported. Evidence: none. Gap: Unsupported and intentionally unmapped: commercial leases and common-area reconciliation remain outside Terrace. A DONE residential-only boundary is not coverage.

**Uncovered:** Unsupported and intentionally unmapped: commercial leases and common-area reconciliation remain outside Terrace. A DONE residential-only boundary is not coverage.

### Explore an aerial property map

**Unsupported** — gap remains.

Official documentation: [Rent Manager marketing and leasing](https://www.rentmanager.com/marketing-leasing/) — Bird’s Eye View; reviewed 2026-11-04.

Replacement: intentionally unmapped. Status: unsupported. Evidence: none. Gap: Unsupported and intentionally unmapped: Terrace has no aerial interactive property-map replacement.

**Uncovered:** Unsupported and intentionally unmapped: Terrace has no aerial interactive property-map replacement.

### Report held security deposits

**Missing** — gap remains.

Official documentation: [Rent Manager reporting](https://www.rentmanager.com/reporting/) — Summary Rent Roll held security deposits; reviewed 2026-11-04.

- [ACCT-003](../CONTRACT.md) — **MISSING**: Receive hold and accrue security deposits. Matching acceptance: “Collect a deposit in installments, accrue reviewed interest and transfer ownership; inspect bank, beneficiary and tenant balances and receipts without recognizing rent revenue.”
  - Evidence: None recorded.
  - Gap: Security-deposit liabilities, custody, receipts and interest rules are absent.

**Uncovered:** ACCT-003: MISSING. Security-deposit liabilities, custody, receipts and interest rules are absent.

## What remains before a complete switch

Authentic redacted books of a 50-unit portfolio from each incumbent, source-specific importers and reconciliation, remaining MOVE-001 and MOVE-010 completeness, authentic shadow-cycle qualification and MOVE-008 payment cutover remain owed. Synthetic fixtures and the tenancy CSV establish none of these.

A complete operating month through leasing, applications, screening, electronic signatures, ACH, card and cash collection, autopay and fees, trust and deposit accounting, vendor and owner payouts, 1099s, resident, owner and vendor portals, repair-to-matched-invoice closure, owner statements and three-way bank reconciliation remains unqualified.

Terrace counsel engagement and counsel-reviewed PORT-008 authored pack and template contents, authorized provider accounts, scopes, entitlements and settlement proof remain outstanding. Existing account, CT, Base and device holds are unchanged. This checklist grants no execution authority.
