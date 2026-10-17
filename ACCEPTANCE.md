# Terrace acceptance

This is the target acceptance plan for [CONTRACT.md](CONTRACT.md), retaining the existing numbered first-release journeys. Each clause below has the same status as the canonical contract table, judged at `7a13504658bf83a0363908e7403a3b5650deec14` (17 October 2026). A listed journey is a build obligation; only a done status with the cited executed check is a completed claim. Partial rows name exactly what remains in the contract’s Gap column.

## Published first-release journeys

1. **ACCEPTANCE-1:** Sign in as owner, invite a manager or preparer, onboard tenancy/lease/rent terms and approve a renewal with the decision retained. Clause coverage: TER-001, TER-002, TER-003. **Status: done.**
2. **ACCEPTANCE-2:** Record charges, externally received rent and explained corrections, see arrears, approve a follow-up and export a period owner statement. Clause coverage: TER-004, TER-005, TER-006. **Status: done.**
3. **ACCEPTANCE-3:** Complete a dated photographed inspection, approve maintenance, download the trade email packet and record its external handoff. Clause coverage: TER-007, TER-008. **Status: done.**
4. **ACCEPTANCE-4:** Preview Terrace tenancy CSV v1, approve its fingerprint, inspect original/journal and undo unchanged imports without deleting later work. Clause coverage: TER-009. **Status: done.**
5. **ACCEPTANCE-5:** Export/restore complete current product data including photos/import custody, erase a tenancy and use a later journal to fence older restores. Clause coverage: TER-010, TER-011. **Status: done.**

These five remain the released operating slice. Their AUD manual ledger and external handoff boundary do not narrow the USD collection, trust accounting and delivered/completed target. No test or workflow is removed or weakened by this plan.

## How evidence is obtained

Use public pages/forms, authenticated JSON commands, portal/API downloads, the actual Worker/D1, documented rer commands and real provider callbacks. Fakes are allowed only at paid/network edges; provider acceptance uses the authorized sandbox or a consented limited live transaction where no sandbox exists. Importer acceptance uses real redacted exports from each named incumbent with source totals and missing-coverage manifests. General product records in acceptance scenarios are test-suite data only; production starts empty.

Run the existing seven integration tests with `pnpm run test:terrace`. Run the repository’s contract/source check and site build for document changes. CI is the complete source, typecheck, product and emitted-runtime wall; missing target journeys are future implementation work, not passing tests. For UI build rounds, exercise affected journeys with realistic records at 1440 and 390 pixels and native devices where applicable, checking successful, failed and unresolved end states.

## Clause acceptance journeys

### Published operating core

1. **TER-001 — Sign in and control operator access.** **Status: done.** Use ordinary invitation and sign-in, attempt protected commands as a preparer, submit a cross-origin command, revoke a manager and retry the old session; forbidden requests make no changes. **Current evidence:** `src/terrace/api.ts`; `src/terrace/core.ts`; `src/terrace/people.ts`; `tests/terrace.test.mjs`

2. **TER-002 — Keep linked tenancy terms.** **Status: done.** Create a tenancy through the command API, open its linked row in /app, and verify detail forms address that tenancy and its saved terms. **Current evidence:** `src/terrace/tenancies.ts`; `src/terrace/tenancy-view.ts`; `tests/terrace.test.mjs`

3. **TER-003 — Approve exact renewal revisions.** **Status: done.** Prepare two renewals as a member, refuse member approval, approve one as manager, and show that the second is stale while prior terms and approver remain retained. **Current evidence:** `src/terrace/tenancies.ts`; `tests/terrace.test.mjs`

4. **TER-004 — Record external rent accurately.** **Status: done.** Post a charge and partial receipt, replay the reference, race two further receipts, reduce the charge with a reason and read the resulting balance through /api/state. **Current evidence:** `src/terrace/ledger.ts`; `tests/terrace.test.mjs`

5. **TER-005 — Prepare dated arrears decisions.** **Status: done.** Prepare an arrears follow-up as a member, approve it as the owner and inspect its saved message, due date and approval through the tenancy state. **Current evidence:** `src/terrace/tenancies.ts`; `tests/terrace.test.mjs`

6. **TER-006 — Export period rent receivables.** **Status: done.** Download a statement spanning the charge and receipts, reconcile its opening plus movements to closing, find receipt references, and refuse the same download to a member. **Current evidence:** `src/terrace/ledger.ts`; `src/terrace/api.ts`; `tests/terrace.test.mjs`

7. **TER-007 — Retain photographed inspections.** **Status: done.** Refuse an empty completion and invalid image, upload a photo through multipart API, retrieve identical bytes and complete the inspection with notes. **Current evidence:** `src/terrace/work.ts`; `tests/terrace.test.mjs`

8. **TER-008 — Approve an external trade handoff.** **Status: done.** Refuse packet retrieval before approval, approve the current job once, inspect its addressed packet and record an external Sent-folder reference with the approval fingerprint retained. **Current evidence:** `src/terrace/work.ts`; `tests/terrace.test.mjs`

9. **TER-009 — Review and undo tenancy CSV move-in.** **Status: done.** Preview the published CSV, reject an incorrect fingerprint, apply the reviewed preview, inspect originals and journal, undo an untouched batch and refuse undo after a later charge. **Current evidence:** `src/terrace/imports.ts`; `src/terrace/imports-source.ts`; `src/terrace/imports-target.ts`; `tests/terrace.test.mjs`

10. **TER-010 — Export and restore product custody.** **Status: done.** Download /api/backup and restore through data.restore into a fresh installation; compare tenancy, ledger and photo bytes, exercise retained import undo and refuse a second restore into occupied data. **Current evidence:** `src/terrace/data.ts`; `src/terrace/archive-policy.mjs`; `tests/terrace.test.mjs`

11. **TER-011 — Erase tenancy custody with a restore fence.** **Status: done.** Reject an incorrect confirmation, erase the tenancy, verify absent state and photo 404, export the later journal and refuse an older archive plus that journal in a clean destination. **Current evidence:** `src/terrace/data.ts`; `src/terrace/imports.ts`; `src/terrace/archive-policy.mjs`; `tests/terrace.test.mjs`

12. **TER-012 — Preserve the installed app and run site.** **Status: partial.** Build the site and open /, /run, /docs and a missing path; in the signed-in app use linked tenancy actions and inspect the rent ledger at 1440 and 390 pixels with real entered records. **Current evidence:** `src/terrace/view.ts`; `src/terrace/ledger-view.ts`; `src/site/docs.ts`; `src/site/run.ts`; `tests/terrace.test.mjs` **Remaining:** Site and responsive source exist; complete public-site and phone user journeys are not covered by the product tests.

### Portfolio, leases and operating rights

1. **PORT-001 — Run a US portfolio in USD.** **Status: partial.** Create a US company and two property timezones, enter USD rent, cross a daylight-saving boundary and import an AUD historical tenancy; show currency and period boundaries without converting or relabeling old balances. **Current evidence:** `src/terrace/core.ts`; `src/terrace/tenancies.ts` **Remaining:** Existing amounts and displays are AUD; US settings, USD migration and property timezones are absent.

2. **PORT-002 — Separate properties buildings and units.** **Status: partial.** Create a duplex with two units, end one lease, move a resident to the other unit and view each unit’s dated occupancy and lease history. **Current evidence:** `src/terrace/tenancies.ts`; `src/terrace/tenancy-view.ts` **Remaining:** Only a tenancy address exists; independent property/unit records and occupancy lifecycle are absent.

3. **PORT-003 — Manage owners and management agreements.** **Status: partial.** Add two owners with shares, change ownership on a dated transfer and inspect the income, reserve and statement allocation on each side of that date. **Current evidence:** `src/terrace/tenancies.ts` **Remaining:** Tenancies hold one owner name/email; owner entities, shares, agreements and reserves are absent.

4. **PORT-004 — Keep resident households and occupants.** **Status: partial.** Add co-tenants and a guarantor, transfer one person between leases and verify balances, recipients and document rights stay with the correct household. **Current evidence:** `src/terrace/tenancies.ts` **Remaining:** One tenant contact exists; household identities, guarantors and membership rights are absent.

5. **PORT-005 — Version complete lease obligations.** **Status: partial.** Enter a lease with a concession and pet charge, approve a mid-month amendment, and reconcile previewed charges and source clauses to the resident ledger while retaining the signed prior version. **Current evidence:** `src/terrace/tenancies.ts`; `tests/terrace.test.mjs` **Remaining:** Basic dates/rent and renewal history exist; complete obligations, attachments, amendment preview and US proration are absent.

6. **PORT-006 — Complete move-in transfers and move-out.** **Status: missing.** Move a household in mid-month, transfer units and move out; verify prorations, distinct deposits, final balances, keys checklist and linked turnover tasks. **Current evidence:** No implementation evidence yet. **Remaining:** Full occupancy transitions and final-account workflows are absent.

7. **PORT-007 — Store searchable operating documents.** **Status: partial.** Upload an amended lease, video and restricted screening PDF; find the current version from its unit, recover the prior lease and deny a vendor and unrelated resident access. **Current evidence:** `src/terrace/work.ts`; `src/terrace/api.ts` **Remaining:** Inspection image custody exists; general documents, video, search and document-specific rights are absent.

8. **ROLE-001 — Grant staff rights by responsibility.** **Status: partial.** Exercise each role across two assigned portfolios, directly request another property’s API/download, and attempt a payout as leasing staff and an access change as bookkeeper; every unauthorized path is denied. **Current evidence:** `src/terrace/core.ts`; `src/terrace/api.ts`; `tests/terrace.test.mjs` **Remaining:** Owner/admin/member roles exist; property scoping and specialized role capabilities are absent.

9. **ROLE-002 — Isolate residents owners and vendors.** **Status: missing.** Invite a resident, joint owner and vendor, change an assignment and ownership date, then crawl portal pages, direct downloads and APIs before and after revocation. **Current evidence:** No implementation evidence yet. **Remaining:** External portal identities and record-scoped permissions are absent.

10. **ROLE-003 — Apply dual control and spending limits.** **Status: partial.** Prepare an over-limit repair and owner distribution, change the payee after approval, and show approval escalation and execution refusal until an independently authorized person approves the exact new inputs. **Current evidence:** `src/terrace/work.ts`; `src/terrace/tenancies.ts`; `tests/terrace.test.mjs` **Remaining:** Exact revision approval exists; budgets, dual-person rules, payee verification and financial execution controls are absent.

### Leasing acquisition and execution

1. **LEASE-001 — Publish property marketing and vacancies.** **Status: missing.** Publish two vacant units, submit an enquiry on mobile, lease one and confirm its vacancy is withdrawn while the other remains available with the approved price and fees. **Current evidence:** No implementation evidence yet. **Remaining:** Property marketing and vacancy publication are absent.

2. **LEASE-002 — Syndicate listings to Zillow.** **Status: missing.** Publish through the provider test boundary, correct a rejected fee field, change rent and withdraw the listing; show acknowledgments and the same external listing identity without duplicates. **Current evidence:** No implementation evidence yet. **Remaining:** Zillow connection and listing status reconciliation are absent.

3. **LEASE-003 — Syndicate listings to Apartments.com.** **Status: missing.** Submit the same unit to Apartments.com, process a rejection and later success, update availability and remove it after lease execution; trace each provider result to the unit. **Current evidence:** No implementation evidence yet. **Remaining:** Apartments.com distribution is absent.

4. **LEASE-004 — Extend listing reach with Zumper and RentCafe.** **Status: missing.** Enable each adapter in its supported environment, publish and withdraw a unit, receive an enquiry and demonstrate that an unentitled account cannot appear connected or published. **Current evidence:** No implementation evidence yet. **Remaining:** Zumper and RentCafe adapters are absent.

5. **LEASE-005 — Work prospect records and enquiries.** **Status: missing.** Receive a listing enquiry and duplicate email, review the match, assign a leasing person, respond and follow that prospect through showing and application with source attribution intact. **Current evidence:** No implementation evidence yet. **Remaining:** Prospect records and leasing pipeline are absent.

6. **LEASE-006 — Coordinate tours and showing access.** **Status: missing.** Book competing tours, reschedule through the prospect link, cancel one and process a no-show; verify each connected scheduler/calendar and the permitted access window agree. **Current evidence:** No implementation evidence yet. **Remaining:** Showing scheduling and named scheduler/calendar connections are absent.

7. **LEASE-007 — Take complete online applications.** **Status: missing.** Two co-applicants save and resume, upload income evidence and submit; manager requests one missing document and sees revisions and fee outcome without card data in Terrace. **Current evidence:** No implementation evidence yet. **Remaining:** Online applications, application fees and applicant workspace are absent.

8. **LEASE-008 — Order consented TransUnion screening.** **Status: missing.** Submit a consented application to the provider sandbox, receive a delayed report and duplicate callback, deny an unauthorized report download and show provider errors without fabricating a screening result. **Current evidence:** No implementation evidence yet. **Remaining:** Screening integration, consent and restricted reports are absent.

9. **LEASE-009 — Review applicants and adverse actions.** **Status: missing.** Review two applications, flag a disputed report, require a manager decision and send an explicitly approved adverse-action package with the correct provider reference and recorded delivery. **Current evidence:** No implementation evidence yet. **Remaining:** Applicant decision, dispute and approved adverse-action workflows are absent.

10. **LEASE-010 — Compose jurisdiction-reviewed lease templates.** **Status: missing.** Generate a lease with co-signers, pet addendum and local disclosure, detect a missing required input and approve a changed term while preserving the template version and redline. **Current evidence:** No implementation evidence yet. **Remaining:** Lease template assembly and reviewed jurisdiction packs are absent.

11. **LEASE-011 — Collect legally evidenced electronic signatures.** **Status: missing.** Send a multi-signer lease, process one decline and a replacement envelope, complete all signatures, replay its callback and attach exactly one executed PDF/certificate to the activated tenancy. **Current evidence:** No implementation evidence yet. **Remaining:** E-signature provider/sibling integration and execution lifecycle are absent.

12. **LEASE-012 — Run renewal and retention campaigns.** **Status: partial.** Run a renewal window with accepted, declined and unanswered offers; trace approved delivery and executed future terms, and verify the unresolved household remains in the follow-up queue. **Current evidence:** `src/terrace/tenancies.ts`; `tests/terrace.test.mjs` **Remaining:** Reviewed term proposals exist; scheduled campaigns, delivery, reply handling and signatures are absent.

### Rent collection and receivables

1. **PAY-001 — Post recurring rent and lease charges.** **Status: partial.** Preview and post rent for leases with a concession and mid-month move-in, replay the run and amend future rent; verify each period posts once and posted history is preserved. **Current evidence:** `src/terrace/ledger.ts`; `tests/terrace.test.mjs` **Remaining:** Manual charges exist; recurring schedules, proration and USD runs are absent.

2. **PAY-002 — Collect rent through ACH.** **Status: missing.** Pay a resident balance through ACH sandbox authorization, restart after provider submission and reconcile pending then settled callbacks without a second debit or exposing bank credentials. **Current evidence:** No implementation evidence yet. **Remaining:** ACH collection and processor reconciliation are absent.

3. **PAY-003 — Collect rent by card.** **Status: missing.** Pay a partial balance with a test card requiring authentication, inspect the disclosed fee, complete payment and confirm one resident receipt and matching provider reference. **Current evidence:** No implementation evidence yet. **Remaining:** Card collection and hosted payment fields are absent.

4. **PAY-004 — Manage resident autopay mandates.** **Status: missing.** Authorize capped balance autopay, change the bill above its cap, then cancel before the next run; verify the permitted debit, held exception, notice and canceled attempt. **Current evidence:** No implementation evidence yet. **Remaining:** Autopay mandates, schedules and notices are absent.

5. **PAY-005 — Enforce partial and split payment policies.** **Status: partial.** Two co-tenants pay concurrently while one ACH is pending; show allocation, remaining balance and permitted credit, and refuse a partial payment under a reviewed stage-specific block. **Current evidence:** `src/terrace/ledger.ts`; `tests/terrace.test.mjs` **Remaining:** Manual partial receipt guards exist; online policy, pending funds, split payments and credits are absent.

6. **PAY-006 — Calculate late fees and grace periods.** **Status: missing.** Run a late-fee schedule across a weekend, record a timely pending payment that settles later and waive one fee; inspect charge basis, policy version and auditable waiver. **Current evidence:** No implementation evidence yet. **Remaining:** Late-fee and jurisdiction rule engine is absent.

7. **PAY-007 — Offer cash-at-retail and offline payment options.** **Status: partial.** Generate a cash code, receive and replay its retail transaction, clear a check and return another; reconcile resident balances to settlement batches without treating a printed code as collected rent. **Current evidence:** `src/terrace/ledger.ts` **Remaining:** Manual external receipts exist; retail network, check deposits and clearance/return states are absent.

8. **PAY-008 — Resolve failed payments returns and disputes.** **Status: missing.** Return a previously settled ACH and dispute a card payment, inspect reversal entries and restored balances, submit approved evidence and verify a revoked mandate prevents another attempt. **Current evidence:** No implementation evidence yet. **Remaining:** Provider failures, returns, disputes and retry controls are absent.

9. **PAY-009 — Authorize refunds credits and write-offs.** **Status: partial.** Prepare and approve a refund, change its source after approval and refuse it; execute an unchanged refund twice and reconcile one provider refund, one ledger reversal and the correct owner effect. **Current evidence:** `src/terrace/ledger.ts` **Remaining:** Reasoned manual reductions exist; refunds, write-offs, owner effects and financial approval are absent.

10. **PAY-010 — Issue resident statements and receipts.** **Status: partial.** Generate a monthly statement, pay part of it, receive a delivered receipt, fail the statement email and inspect the resident portal’s matching balance and delivery task. **Current evidence:** `src/terrace/ledger.ts`; `src/terrace/api.ts` **Remaining:** Operator receivable CSV exists; resident delivery, PDF and collection states are absent.

11. **PAY-011 — Work delinquencies to a recorded outcome.** **Status: partial.** Run a sequence for three late households, receive a reply and payment plan, settle one balance and break another promise; verify stopped messages, next actions and human notice approval. **Current evidence:** `src/terrace/tenancies.ts`; `src/terrace/ledger.ts`; `tests/terrace.test.mjs` **Remaining:** Arrears totals and approved drafts exist; delivered sequences, plans, replies and resolution tracking are absent.

12. **PAY-012 — Reconcile processor fees and settlements.** **Status: missing.** Collect several rents into one net payout with a refund and fee, import its bank line and reconcile gross-to-net; replay callbacks and leave an intentionally short payout unresolved. **Current evidence:** No implementation evidence yet. **Remaining:** Processor settlements and bank-to-subledger matching are absent.

### Trust accounting and owner finance

1. **ACCT-001 — Maintain a balanced property ledger.** **Status: partial.** Post rent, deposit, vendor expense and owner contribution across two properties, attempt an unbalanced entry and inspect the trial balance and each subledger back to source. **Current evidence:** `src/terrace/ledger.ts` **Remaining:** A single-entry rent receivable ledger exists; double entry and owner/property/deposit subledgers are absent.

2. **ACCT-002 — Separate operating trust and deposit accounts.** **Status: missing.** Receive rent and deposits into distinct accounts, attempt an owner payout from deposit funds and an inter-owner transfer, and verify blocked execution and separately reconciled beneficiary balances. **Current evidence:** No implementation evidence yet. **Remaining:** Trust bank mappings, fund restrictions and transfers are absent.

3. **ACCT-003 — Receive hold and accrue security deposits.** **Status: missing.** Collect a deposit in installments, accrue reviewed interest and transfer ownership; inspect bank, beneficiary and tenant balances and receipts without recognizing rent revenue. **Current evidence:** No implementation evidence yet. **Remaining:** Security-deposit liabilities, custody, receipts and interest rules are absent.

4. **ACCT-004 — Complete deposit disposition and refunds.** **Status: missing.** Prepare a move-out with damage and normal wear, approve only supported deductions, deliver the disposition and execute the approved refund; verify deadline, proof and remaining deposit liability. **Current evidence:** No implementation evidence yet. **Remaining:** Deposit dispositions, deadlines, deductions and refunds are absent.

5. **ACCT-005 — Connect Plaid bank feeds.** **Status: missing.** Connect two bank accounts through the provider boundary, import duplicate and pending-to-posted lines, expire consent and reconnect; verify no duplicate bank transaction and a visible freshness gap. **Current evidence:** No implementation evidence yet. **Remaining:** Plaid bank feeds and consent/freshness management are absent.

6. **ACCT-006 — Match statements and perform three-way reconciliation.** **Status: missing.** Reconcile a month with batched rent, fee, outstanding check and missing deposit; resolve one exception and show the remaining difference prevents a balanced three-way sign-off. **Current evidence:** No implementation evidence yet. **Remaining:** Statement ingestion, matching and three-way bank reconciliation are absent.

7. **ACCT-007 — Capture and approve vendor bills.** **Status: missing.** Upload the same invoice twice, split an approved landscaping bill across properties, exceed an owner’s limit and inspect the held bill, approval route and resulting payable. **Current evidence:** No implementation evidence yet. **Remaining:** Vendor bills, coding and payable approval are absent.

8. **ACCT-008 — Pay vendors and reconcile payment outcomes.** **Status: missing.** Approve a vendor batch, change one bank destination and hold it, execute the unchanged items and process a return; show one payment per bill and the reopened returned payable. **Current evidence:** No implementation evidence yet. **Remaining:** Vendor payment rails, payee controls and reconciliation are absent.

9. **ACCT-009 — Calculate management fees and owner reserves.** **Status: missing.** Post rent and a lease renewal under a dated fee schedule, calculate fees/reserve, replay the run and inspect the owner statement with the exact agreement references. **Current evidence:** No implementation evidence yet. **Remaining:** Management fee engine, reserves and owner cash controls are absent.

10. **ACCT-010 — Disburse owner funds by ACH.** **Status: missing.** Prepare a joint-owner distribution with a pending ACH receipt and unpaid repair, approve cleared funds only, execute it and return one share; show corrected cash and one replacement requiring new approval. **Current evidence:** No implementation evidence yet. **Remaining:** Owner distributions, ACH execution and return accounting are absent.

11. **ACCT-011 — Close periods without rewriting history.** **Status: missing.** Close a reconciled month, attempt a backdated posting, approve a period reopening and adjustment, then compare old/new statements with the reopening reason and unchanged original entries. **Current evidence:** No implementation evidence yet. **Remaining:** Accounting close, locks and controlled reopening are absent.

12. **ACCT-012 — Publish complete owner statements.** **Status: partial.** Publish a monthly owner statement with rent, a paid bill and distribution, reconcile its closing cash to books/bank and download the source invoice from the owner portal. **Current evidence:** `src/terrace/ledger.ts`; `tests/terrace.test.mjs` **Remaining:** Period receivable CSV exists; full owner cash statements, source bills, delivery and portal publication are absent.

13. **ACCT-013 — Report cash and accrual financials.** **Status: missing.** Record earned unpaid rent and an unpaid bill, compare cash/accrual P&L and balance sheet, and drill each difference to its original transaction. **Current evidence:** No implementation evidence yet. **Remaining:** Cash/accrual financial statements and complete ledger reporting are absent.

14. **ACCT-014 — Prepare and file owner and vendor 1099s.** **Status: missing.** Prepare owner/vendor forms from reconciled payments, correct an invalid TIN, approve a Nelco submission and process accepted/rejected/corrected outcomes without duplicate filings. **Current evidence:** No implementation evidence yet. **Remaining:** W-9, reportable payment calculation, Nelco filing and correction workflows are absent.

15. **ACCT-015 — Sync QuickBooks Online without losing trust truth.** **Status: missing.** Sync a property close to a QuickBooks sandbox, replay it, change an account mapping and reconcile resulting totals and a visible conflict back to Terrace’s owner/deposit subledgers. **Current evidence:** No implementation evidence yet. **Remaining:** QuickBooks Online mapping and reconciled sync are absent.

16. **ACCT-016 — Account for utility recoveries and ancillary income.** **Status: missing.** Allocate one water invoice by a reviewed occupancy formula, post parking and taxable ancillary charges and verify source-linked tenant allocations equal the approved recoverable total. **Current evidence:** No implementation evidence yet. **Remaining:** Utility allocations, ancillary tax rules and recovery accounting are absent.

### Resident owner and vendor service portals

1. **PORTAL-001 — Give residents a complete account portal.** **Status: missing.** Sign in as a resident with two leases, inspect an itemized balance, pay rent, download a receipt and update contact preferences; direct access to an unrelated household is denied. **Current evidence:** No implementation evidence yet. **Remaining:** Resident portal and self-service account workflows are absent.

2. **PORTAL-002 — Give owners their financial and property portal.** **Status: missing.** Joint owners inspect different ownership periods, approve an over-limit repair, contribute funds and download a statement/invoice; access another owner’s report and screening file is denied. **Current evidence:** No implementation evidence yet. **Remaining:** Owner portal, contributions and owner-facing approvals are absent.

3. **PORTAL-003 — Give vendors a work and invoice portal.** **Status: missing.** Invite a plumber to one job, accept an appointment, upload evidence/invoice and read payment state; after reassignment revoke the access details and deny every other vendor job. **Current evidence:** No implementation evidence yet. **Remaining:** Vendor portal and scoped service credentials are absent.

4. **PORTAL-004 — Receive resident maintenance requests.** **Status: missing.** Submit a leaking-tap request with photo and access restrictions, add another household report and follow the tracking link through scheduled work and resident-confirmed resolution. **Current evidence:** No implementation evidence yet. **Remaining:** Resident intake, tracking and consented service status are absent.

5. **PORTAL-005 — Deliver two-way email and SMS.** **Status: partial.** Approve a repair message, deliver email/SMS at provider boundaries, receive a reply and opt-out, replay callbacks and show failed delivery and suppressed future SMS in the shared thread. **Current evidence:** `src/terrace/work.ts`; `src/modules/mail/src/sender.mjs` **Remaining:** Unsent trade packets and shared mail infrastructure exist; product delivery, SMS, replies and consent-aware routing are absent.

6. **PORTAL-006 — Keep shared threads and notices accountable.** **Status: missing.** Assign a resident conversation, add a private note, broadcast a water shutoff to one building and inspect delivered/failed recipients; verify the resident cannot see the note or another building’s messages. **Current evidence:** No implementation evidence yet. **Remaining:** Shared conversations, announcements and notice service records are absent.

7. **PORTAL-007 — Track requests documents and approvals to completion.** **Status: missing.** Request insurance evidence and owner quote approval, expire one link and complete a replacement; show reminders stop only after validated completion and the exact signer/approver is recorded. **Current evidence:** No implementation evidence yet. **Remaining:** External request/approval links and document-chasing state are absent.

8. **PORTAL-008 — Support mobile and accessible everyday work.** **Status: partial.** Use 1440- and 390-pixel screens and assistive navigation to pay, submit a request and approve work; suspend/resume native sessions and revoke a lost device without exposing cached private data. **Current evidence:** `src/terrace/view.ts`; `src/terrace/work-view.ts` **Remaining:** Responsive web forms exist; full accessible mobile journeys, native apps and push/device controls are absent.

### Maintenance from request to reconciled bill

1. **WORK-001 — Triage safety and emergency requests.** **Status: missing.** Submit a gas-smell request outside office hours, show approved emergency guidance and escalate to an acknowledged human; an unanswered alert remains urgent and open. **Current evidence:** No implementation evidence yet. **Remaining:** Safety triage, emergency guidance and on-call acknowledgment are absent.

2. **WORK-002 — Maintain property asset and warranty history.** **Status: missing.** Add an HVAC asset and warranty, open a repair, replace the asset and inspect both service histories with warranty and owner-cost attribution. **Current evidence:** No implementation evidence yet. **Remaining:** Asset register, warranties and replacement history are absent.

3. **WORK-003 — Estimate work and obtain owner approval.** **Status: partial.** Compare two repair quotes, request an owner decision above the spending limit, then change the approved scope and verify dispatch remains blocked until the new terms are approved. **Current evidence:** `src/terrace/work.ts`; `tests/terrace.test.mjs` **Remaining:** Single trade estimate and revision approval exist; competing quotes, budgets and owner thresholds are absent.

4. **WORK-004 — Qualify and assign vendors.** **Status: partial.** Select a plumber by area and insurance status, expire their coverage and attempt reassignment; verify qualification hold and a documented human exception rather than silent dispatch. **Current evidence:** `src/terrace/work.ts` **Remaining:** Jobs store trade name/email; vendor directory, qualifications and assignment rules are absent.

5. **WORK-005 — Book appointments and resident access.** **Status: partial.** Book a repair, receive resident confirmation, cancel from the vendor portal and reschedule with a new permitted access window; notify both parties and preserve appointment history. **Current evidence:** `src/terrace/work.ts` **Remaining:** A due date exists; appointments, access consent, confirmation and rescheduling are absent.

6. **WORK-006 — Dispatch and track technician progress.** **Status: partial.** Dispatch an approved order, receive vendor acceptance and a parts hold, miss its appointment and reassign it; inspect notifications, state history and a still-open resident issue. **Current evidence:** `src/terrace/work.ts`; `tests/terrace.test.mjs` **Remaining:** Approved packet and recorded external handoff exist; delivered dispatch and execution tracking are absent.

7. **WORK-007 — Capture field labor materials and completion evidence.** **Status: partial.** Lose connectivity during work, capture time and photos, reconnect with a conflicting scope change and reconcile the conflict before submitting complete evidence for review. **Current evidence:** `src/terrace/work.ts` **Remaining:** Inspection photos exist; technician labor/materials, video, offline sync and completion submission are absent.

8. **WORK-008 — Verify repair with the resident.** **Status: missing.** Vendor submits completion, resident reports the tap still leaks and the job reopens; after a return visit obtain confirmation and retain both attempts and the final resolution. **Current evidence:** No implementation evidence yet. **Remaining:** Resident completion checks, reopening and callback tracking are absent.

9. **WORK-009 — Match invoice work and owner charge.** **Status: missing.** Submit a completed repair invoice exceeding its quote, flag the unmatched line, approve a corrected invoice and trace work, payable, payment and owner statement without double entry. **Current evidence:** No implementation evidence yet. **Remaining:** Invoice extraction, three-way work/bill match and owner-ledger linkage are absent.

10. **WORK-010 — Schedule preventive and recurring maintenance.** **Status: missing.** Schedule annual HVAC service and quarterly safety work, replay a scheduler run, defer one occurrence and replace an asset; inspect exactly one order per due occurrence and an explicit overdue exception. **Current evidence:** No implementation evidence yet. **Remaining:** Preventive maintenance schedules and generated work are absent.

11. **WORK-011 — Complete mobile move-in and move-out inspections.** **Status: partial.** Inspect on a phone offline, sync photos, compare move-out damage to the entry record and reject an unsupported deduction while retaining the resident’s disputed finding. **Current evidence:** `src/terrace/work.ts`; `src/terrace/work-view.ts`; `tests/terrace.test.mjs` **Remaining:** Dated photo inspections ship; structured comparisons, acknowledgement, video and offline journeys are absent.

12. **WORK-012 — Integrate HappyCo inspection evidence.** **Status: missing.** Bring a HappyCo inspection into the correct unit, replay it and update one finding, then create approved repair work with original media/provenance and a visible unmapped-unit exception. **Current evidence:** No implementation evidence yet. **Remaining:** HappyCo adapter and provider inspection reconciliation are absent.

13. **WORK-013 — Run make-ready and turnover boards.** **Status: missing.** Move out a resident, delay a repair dependent on inspection, revise the ready date and show cleaning/listing effects; complete checks and publish the true available date. **Current evidence:** No implementation evidence yet. **Remaining:** Turnover boards, dependencies and ready-date controls are absent.

14. **WORK-014 — Control maintenance budgets inventory and chargebacks.** **Status: missing.** Consume a stocked part on a repair, cross a budget limit, propose a resident chargeback and approve one allocation; reconcile stock, payable, receivable and owner cost. **Current evidence:** No implementation evidence yet. **Remaining:** Maintenance budgets, stock/purchase links and chargeback accounting are absent.

### Reports and portfolio performance

1. **REPORT-001 — Explain the complete rent roll.** **Status: partial.** Run an as-of rent roll before and after a scheduled renewal and move-in, reconcile occupied/vacant unit counts and effective rents and download the same filtered data. **Current evidence:** `src/terrace/tenancies.ts`; `src/terrace/tenancy-view.ts` **Remaining:** Current tenancy list exists; historical rent roll, vacancy/future leases and report exports are absent.

2. **REPORT-002 — Report delinquency and collection performance.** **Status: partial.** Filter delinquency to one owner, include a returned ACH and active plan, reconcile ageing to resident balances and show follow-up owner and next permitted action for each overdue household. **Current evidence:** `src/terrace/ledger.ts` **Remaining:** Basic arrears totals exist; ageing buckets, plan/notice outcomes and portfolio reporting are absent.

3. **REPORT-003 — Measure vacancy leasing and renewal performance.** **Status: missing.** Follow a vacant unit through showing, lease and move-in, compare source conversion and vacancy days and drill the metric to dated source events. **Current evidence:** No implementation evidence yet. **Remaining:** Vacancy, acquisition funnel and renewal performance reporting are absent.

4. **REPORT-004 — Report maintenance service and cost.** **Status: missing.** Run a service report for a reopened repair and an unconfirmed completion, trace durations and owner cost to evidence and export the filtered unresolved queue. **Current evidence:** No implementation evidence yet. **Remaining:** Maintenance resolution/cost analytics are absent.

5. **REPORT-005 — Build governed custom reports and fields.** **Status: partial.** Add a unit inspection field, use it in a saved report and document template, hide a sensitive owner field from leasing staff and verify their export/merge cannot reveal it. **Current evidence:** `src/terrace/ledger.ts`; `src/terrace/work.ts` **Remaining:** Fixed CSV and packet templates exist; configurable fields, formulas and governed report/template builder are absent.

6. **REPORT-006 — Schedule delivered operating reports.** **Status: missing.** Schedule an owner report across a timezone boundary, revoke an owner before delivery and bounce another recipient; verify scope recheck, one authorized delivery and a failed-delivery task. **Current evidence:** No implementation evidence yet. **Remaining:** Report schedules, recipient scope and delivered-report tracking are absent.

7. **REPORT-007 — Expose cash and vacancy trade-offs.** **Status: missing.** Compare repairing before listing versus immediate marketing with a rent concession, change the vacancy assumption and inspect the recalculated cash/ready dates while actual books remain unchanged. **Current evidence:** No implementation evidence yet. **Remaining:** Integrated scenario cash and vacancy projections are absent.

### Integrations and persistent operating automation

1. **OPS-001 — Expose a scoped property operations API.** **Status: partial.** Connect a read-only accountant and prepare-only agent, traverse paginated records, retry an idempotent work proposal and refuse approval, payout or cross-property reads outside each credential’s scope. **Current evidence:** `src/terrace/api.ts`; `API.md` **Remaining:** Session-authenticated tenancy/rent/work commands exist; integration credentials, full resources and versioned API coverage are absent.

2. **OPS-002 — Publish dependable events and automation hooks.** **Status: missing.** Subscribe to work completion and rent settlement, fail then replay delivery, process a duplicate and revoke the subscription; show exactly one downstream effect and no later delivery. **Current evidence:** No implementation evidence yet. **Remaining:** Signed webhooks, replay controls and Zapier/Crank connections are absent.

3. **OPS-003 — Run persistent workflow templates.** **Status: missing.** Start a renewal and unit-turn workflow, restart between steps, receive a reply and exhaust a contact limit; inspect durable next actions and a human escalation rather than a false completed state. **Current evidence:** No implementation evidence yet. **Remaining:** Durable cross-step automation and workflow templates are absent.

4. **OPS-004 — Operate integrations with visible health and cost.** **Status: missing.** Connect a valid provider and one with denied scope, expire a token and simulate transport failure; inspect distinct actionable states, bounded retries and cost/usage records with secrets redacted. **Current evidence:** No implementation evidence yet. **Remaining:** Unified provider setup, health, entitlement and cost controls are absent.

5. **OPS-005 — Link insurance coverage through MSI.** **Status: missing.** Resident submits external proof and another enrolls through the partner boundary; expire a policy, request renewed evidence and hand a claim to the insurer with status/reference retained. **Current evidence:** No implementation evidence yet. **Remaining:** MSI integration, external coverage proof and expiry follow-up are absent.

6. **OPS-006 — Connect finance signing and trade siblings.** **Status: missing.** Send an approved repair to a Glove boundary, receive completion and invoice references, sign a lease through Inkwell and reconcile a Pantry journal; verify each external identity and permission remains distinct. **Current evidence:** No implementation evidence yet. **Remaining:** Named sibling adapters and reconciled handoff workflows are absent.

7. **OPS-007 — Respect adjacent property product boundaries.** **Status: missing.** Link a mixed owner’s residential property to its Cabin record and a Chest document, navigate the authorized references and confirm residential ledger exports remain complete without short-stay reservation duplication. **Current evidence:** No implementation evidence yet. **Remaining:** Permissioned sibling links and mixed-portfolio cross-product navigation are absent.

8. **OPS-008 — Handle commercial CAM and specialist housing through adapters.** **Status: missing.** Import a specialist CAM allocation and subsidy receipt through authorized provider boundaries, reconcile the residential owner/tenant effects and expose unsupported mappings as held exceptions for a person. **Current evidence:** No implementation evidence yet. **Remaining:** Specialist housing/CAM interfaces and reconciled impacts are absent.

### Incumbent migration and reversible cutover

1. **MOVE-001 — Reconcile complete migration before cutover.** **Status: partial.** Load a multi-property source with a missing deposit and duplicate household, preview without writes, reconcile counts and balances, resolve exceptions and approve the exact migration manifest. **Current evidence:** `src/terrace/imports.ts`; `src/terrace/imports-source.ts`; `tests/terrace.test.mjs` **Remaining:** Reviewed tenancy-only CSV custody exists; full record, document, opening-balance and active-work migration is absent.

2. **MOVE-002 — Move in from AppFolio.** **Status: missing.** Use real redacted AppFolio exports and approved API capture where available; preview, import and compare rent roll, deposits, opening trial balance and document counts to the source, holding every unmapped record. [Format evidence](https://www.appfolio.com/help/owner) and [API access](https://www.appfolio.com/stack/partners/api). **Current evidence:** No implementation evidence yet. **Remaining:** AppFolio adapter and reconciled export fixtures are absent.

3. **MOVE-003 — Move in from Buildium.** **Status: missing.** Import real redacted Buildium files plus an authorized Open API capture, detect omitted ledger financials, reconcile beneficiary/deposit totals and migrate active work and files before permitting cutover. [Export evidence](https://help.buildium.com/hc/s/article/Export-data-from-Buildium-1557494404392) and [Open API](https://developer.buildium.com/). **Current evidence:** No implementation evidence yet. **Remaining:** Buildium file/API importer and completeness reconciliation are absent.

4. **MOVE-004 — Move in from Rent Manager.** **Status: missing.** Import real redacted Excel reports and entitled API data, map units/owners/leases/work orders, reconcile deposits and receivable/payable openings and identify missing original documents before approval. [Report evidence](https://www.rentmanager.com/release-notes-jan/) and [Web API](https://www.rentmanager.com/software-customization/). **Current evidence:** No implementation evidence yet. **Remaining:** Rent Manager reports/API importer is absent.

5. **MOVE-005 — Move in from Yardi Breeze.** **Status: missing.** Import real redacted Breeze reports and original documents, inspect extracted row provenance, reconcile rent roll/deposits/openings and hold missing ownership or active-work coverage visibly. [Report formats](https://www.yardibreeze.com/blog/2025/07/custom-reports-ad-hoc/). **Current evidence:** No implementation evidence yet. **Remaining:** Yardi Breeze/Premier importer and reviewed report extraction are absent.

6. **MOVE-006 — Move in from DoorLoop.** **Status: missing.** Import real redacted DoorLoop reports, lease PDFs, statement ZIP and entitled API capture; reconcile openings, lease terms and documents, then identify unexported records before approval. [Export formats](https://support.doorloop.com/en/articles/14489492-what-s-new-doorloop-reporting-v2-version-9-2-0) and [API](https://support.doorloop.com/en/articles/7902913-api-documentation-and-where-to-find-help). **Current evidence:** No implementation evidence yet. **Remaining:** DoorLoop importer and source-completeness fixtures are absent.

7. **MOVE-007 — Move in from TurboTenant.** **Status: missing.** Import real redacted TurboTenant files with one pending payment and future lease, reconcile completed deposits and income/expenses, and require reviewed supplemental inputs for omitted states before cutover. [Payments export](https://support.turbotenant.com/en/articles/4802302-how-to-export-your-rent-payments-to-csv), [rent roll](https://support.turbotenant.com/en/articles/13862432-rent-roll), [lease PDFs](https://support.turbotenant.com/en/articles/14728527-how-do-i-download-or-print-a-lease-agreement). **Current evidence:** No implementation evidence yet. **Remaining:** TurboTenant importer and supplemental pending/future-state reconciliation are absent.

8. **MOVE-008 — Shadow run and control payment cutover.** **Status: missing.** Shadow a rent cycle against source statements, hold a difference, approve a corrected cutover and demonstrate a retained old autopay cannot create a second Terrace collection; show every mandate’s reauthorization state. **Current evidence:** No implementation evidence yet. **Remaining:** Shadow financial comparison and payment-authority cutover are absent.

9. **MOVE-009 — Undo untouched imports and protect later operations.** **Status: partial.** Replay a migration apply, undo an untouched property and refuse silent undo after a settled receipt or signed lease; inspect the conflict report and approved compensation preserving later work. **Current evidence:** `src/terrace/imports.ts`; `src/terrace/imports-target.ts`; `tests/terrace.test.mjs` **Remaining:** Tenancy CSV undo/conflict protection ships; complete financial/provider migration compensation is absent.

### Security privacy ownership and recovery

1. **SAFE-001 — Enforce authenticated least-privilege doors.** **Status: partial.** Crawl all private doors signed out and with each restricted role, replay a revoked session and attempt a cross-site payout or bank change without step-up; deny all unauthorized reads and writes. **Current evidence:** `src/terrace/api.ts`; `src/terrace/core.ts`; `src/auth.server.ts`; `tests/terrace.test.mjs` **Remaining:** Session/role/origin checks exist; property isolation, step-up, staff SSO/MFA and expanded doors are absent.

2. **SAFE-002 — Keep attributable immutable operating history.** **Status: partial.** Change a lease, approve work, export a screening file and reverse a payment; inspect actor/source-linked history via an authorized audit view and refuse edits or deletion of accounting history. **Current evidence:** `src/terrace/core.ts`; `src/terrace/tenancies.ts`; `src/terrace/work.ts` **Remaining:** Mutation audit rows and approval sources exist; complete event provenance, sensitive-read audit and audit UI/export are absent.

3. **SAFE-003 — Protect sensitive documents and provider secrets.** **Status: partial.** Upload a restricted report, inspect its private download headers and expiry, request it with a revoked role and inspect logs/export/browser output for secrets, PAN and TIN leakage. **Current evidence:** `src/terrace/api.ts`; `src/terrace/work.ts`; `src/modules/operator-auth/routes.mjs` **Remaining:** Authenticated no-store downloads exist; expanded encryption/redaction, scanning and credential/tokenization coverage need implementation.

4. **SAFE-004 — Apply reviewed retention holds and erasure.** **Status: partial.** Request erasure with an accounting hold, review retained obligations, erase eligible documents, release a later hold and verify provider/search/media deletion plus blocked resurrection on restore. **Current evidence:** `src/terrace/data.ts`; `src/terrace/archive-policy.mjs`; `tests/terrace.test.mjs` **Remaining:** Whole-tenancy erasure and archive fence ship; retention classes, legal holds and provider/search erasure are absent.

5. **SAFE-005 — Leave with complete usable operating data.** **Status: partial.** Export a complete leased/paid/repaired property, restore to a fresh installation and compare balances, signed files, communications and work evidence; reconnect providers without importing sessions or repeating money movement. **Current evidence:** `src/terrace/data.ts`; `src/terrace/archive-policy.mjs`; `tests/terrace.test.mjs` **Remaining:** Current product archive round-trip ships; target domains, provider reconnection and human-readable complete exports are absent.

6. **SAFE-006 — Recover durable jobs and reconcile uncertain outcomes.** **Status: missing.** Interrupt a payment and dispatch after external acceptance but before local acknowledgment, restart and reconcile by external ID; restore an archive and prove old jobs cannot send or pay again. **Current evidence:** No implementation evidence yet. **Remaining:** Durable external job recovery, uncertain-outcome reconciliation and measured recovery objectives are absent.

7. **SAFE-007 — Run an owned installation with honest diagnostics.** **Status: partial.** Launch a clean checkout with rer dev, complete setup, enter a real tenancy, export it, apply a documented upgrade in a separate installation and inspect useful redacted diagnostics with no unsolicited outbound telemetry. **Current evidence:** `README.md`; `rer-project.json`; `src/base/setup-state.ts`; `tests/runtime.mjs` **Remaining:** Documented runtime/setup exists; full upgrade, provider operations and no-telemetry/empty-install journey need end-to-end evidence.

8. **SAFE-008 — Make configuration limits and costs visible.** **Status: partial.** Attempt activation without a required provider agreement, inspect the blocked setup and cost disclosures, then connect the provider and complete a real operation at a documented tested capacity. **Current evidence:** `src/terrace/work.ts`; `src/terrace/data.ts`; `README.md` **Remaining:** Current upload/archive limits are enforced; target provider agreements, capacity evidence and cost/fee setup are absent.

### Service boundaries and specialist partners

1. **BOUND-001 — Use regulated rails without becoming the custodian.** **Status: missing.** Onboard a manager’s processor and bank account, collect rent, reconcile trust subledgers and execute an approved payout; show funds remain at the bank/provider and Terrace records authoritative reconciled outcomes. **Current evidence:** No implementation evidence yet. **Remaining:** Regulated provider onboarding and the full reconciled money lifecycle are absent.

2. **BOUND-002 — Keep housing legal tax and insurance decisions human.** **Status: missing.** Hold a disputed screening result, uncertain notice rule and rejected tax filing; refer each to its authorized professional, record the response and resume only the explicitly approved action. **Current evidence:** No implementation evidence yet. **Remaining:** Professional referral/response tracking and reviewed jurisdiction/provider rule activation are absent.

3. **BOUND-003 — Coordinate emergency and physical work with people.** **Status: missing.** Receive a safety request, provide reviewed 911/utility guidance, obtain a human on-call acknowledgment and keep the case open until authorized resolution evidence and resident follow-up are recorded. **Current evidence:** No implementation evidence yet. **Remaining:** Acknowledged emergency handoff and verified physical-resolution workflows are absent.

### Push further — accountable portfolio agents

1. **AGENT-001 — Run repair intake through owner-statement resolution.** **Status: partial.** Give the agent a leaking tap, approved vendor/spend envelope and resident availability; interrupt booking, change the invoice and receive a failed completion check. It resumes safely, reopens the repair, holds the mismatch and closes only after confirmed repair and reconciled owner cost. **Current evidence:** `src/terrace/work.ts`; `tests/terrace.test.mjs` **Remaining:** Trade estimate, exact approval and external handoff exist; agent booking, resident checks, bill matching and ledger closure are absent.

2. **AGENT-002 — Plan vacancy recovery with cash trade-offs.** **Status: missing.** Present two turnover plans with source-linked cost/vacancy assumptions, approve one, delay a vendor and recalculate; follow the revised authorized plan to a human-approved applicant and executed lease, comparing actual vacancy/cash with forecast. **Current evidence:** No implementation evidence yet. **Remaining:** Cross-domain vacancy planning and continuing execution agent are absent.

3. **AGENT-003 — Investigate deposit and close exceptions.** **Status: missing.** Introduce a duplicate receipt, missing deposit and repair charged to the wrong owner; have the agent explain each difference from source evidence, propose corrections and reconcile only approved entries while unresolved differences block close. **Current evidence:** No implementation evidence yet. **Remaining:** Deposit/bank exception investigation and source-linked correction agent are absent.

4. **AGENT-004 — Pursue arrears to a permitted resolution.** **Status: partial.** Work late rent with a promise that fails, a later returned payment and a disputed fee; show permitted next actions and holds, obtain human approvals, then verify settled resolution rather than treating a promise or submitted debit as payment. **Current evidence:** `src/terrace/tenancies.ts`; `src/terrace/ledger.ts`; `tests/terrace.test.mjs` **Remaining:** Dated arrears proposals and receipt balances exist; continuing agent contacts/replies/plans and verified financial resolution are absent.

5. **AGENT-005 — Steward renewals through executed future rent.** **Status: partial.** Prepare renewal options, approve one, receive a counteroffer and require new approval; collect all signatures, verify future charges match the executed terms and escalate an unanswered offer before the deadline. **Current evidence:** `src/terrace/tenancies.ts`; `tests/terrace.test.mjs` **Remaining:** Source-referenced renewal proposal/history exists; agent comparisons, delivery, counteroffers, signing and future charge verification are absent.

6. **AGENT-006 — Compare inspection evidence without inventing damage.** **Status: partial.** Compare an unchanged fixture, documented damage and ambiguous low-light image; inspect source-linked findings, reject an unsupported deduction and carry a human-approved repair into work with original media retained. **Current evidence:** `src/terrace/work.ts`; `tests/terrace.test.mjs` **Remaining:** Original photo custody exists; AI comparison, uncertainty and reviewed finding workflows are absent.

7. **AGENT-007 — Learn operating risks from verified outcomes.** **Status: missing.** Detect repeated HVAC callbacks and a leasing bottleneck, show source cases and quantified assumptions, approve one preventive plan and compare later actual outcomes without silently modifying the other workflow. **Current evidence:** No implementation evidence yet. **Remaining:** Cross-portfolio risk learning and reviewed improvement proposals are absent.

8. **AGENT-008 — Keep agent authority and evidence inspectable.** **Status: partial.** Embed a payment instruction in an invoice, revoke the agent during a queued booking and cancel a follow-up. Show ignored document instructions, stopped execution and a complete human-readable action history with no self-approval. **Current evidence:** `src/terrace/core.ts`; `src/terrace/api.ts`; `tests/terrace.test.mjs` **Remaining:** Preparers cannot approve and sessions are revocable; scoped agent workloads, document-instruction isolation, cost and execution controls are absent.
