<!-- Generated from CONTRACT.md by contract-docs. Edit CONTRACT.md, then regenerate. -->

# Accept a Terrace installation

The primary journey: set up the company, properties and owners, lease a unit, post and record rent into the owners’ books, take a repair from report to a reconciled bill, and close the month with statements the owners can read.

## Progress

| Tier | Done | Partial | Missing | Total |
| --- | ---: | ---: | ---: | ---: |
| Core | 48 | 44 | 50 | 142 |
| Agent surface | 0 | 0 | 7 | 7 |
| Later | 0 | 0 | 1 | 1 |
| Full target | 48 | 44 | 58 | 150 |

Judged from the code and tests at commit `e3cd9fc85195b2e5f9f263437d392fbc3b9e8973` (26 October 2026). Field proof register: 15 rows; 0 passed, 0 failed, 15 not run.

## Core

### Published operating core

#### TER-001 — Sign in and control operator access

Core · published · **done** · Cites BASE-ACCESS-001, BASE-ACCESS-002, BASE-ROLE-001

**Requirement.** An owner invites managers (admin) and preparers (member). Managers record and approve property work; preparers read and propose but cannot approve, post rent, import, erase or restore. Owner-only data and access operations check the live role. Same-origin mutation checks apply through every existing command and download.

**Acceptance.**
1. Use ordinary invitation and sign-in, attempt protected commands as a preparer, submit a cross-origin command, revoke a manager and retry the old session; forbidden requests make no changes.

**Evidence.** `src/terrace/api.ts`; `src/terrace/core.ts`; `src/terrace/people.ts`; `tests/terrace.test.mjs`
**Gap.** None.

#### TER-002 — Keep linked tenancy terms

Core · published · **done** · Cites BASE-INPUT-001

**Requirement.** Managers create a tenancy with address, owner and tenant contacts, lease dates, rent and cadence. The tenancy list opens that tenancy’s detail with its actions carrying the selected identity. Each tenancy stores its currency: new tenancies are USD and records entered before PORT-001 are “currency unconfirmed” until the installation owner confirms AUD or USD, never converted (PORT-001).

**Acceptance.**
1. Create a tenancy through the command door, open its linked row in the app, and verify detail forms address that tenancy and its saved terms.

**Evidence.** `src/terrace/tenancies.ts`; `src/terrace/tenancy-view.ts`; `tests/terrace.test.mjs`
**Gap.** None.

#### TER-003 — Approve exact renewal revisions

Core · published · **done** · Rules D-3

**Requirement.** Preparers propose a later lease end and rent with a source reference. An owner or manager approves or rejects the pending proposal; approval retains previous terms and the actual decision actor. Competing proposals based on the old tenancy version cannot overwrite the accepted terms.

**Acceptance.**
1. Prepare two renewals as a member, refuse member approval, approve one as manager, and show that the second is stale while prior terms and approver remain retained.

**Evidence.** `src/terrace/tenancies.ts`; `tests/terrace.test.mjs`
**Gap.** None.

#### TER-004 — Record external rent accurately

Core · published · **done** · Rules D-2, D-4

**Requirement.** Managers record dated charges, already received external receipts and explained charge reductions in integer cents. Unique references prevent duplication; concurrent receipts cannot exceed the unpaid charge. Recording a receipt does not claim that Terrace collected or settled money.

**Acceptance.**
1. Post a charge and partial receipt, replay the reference, race two further receipts, reduce the charge with a reason and read the resulting balance through the state door.

**Evidence.** `src/terrace/ledger.ts`; `tests/terrace.test.mjs`
**Gap.** None.

#### TER-005 — Prepare dated arrears decisions

Core · published · **partial** · Rules D-5

**Requirement.** Preparers draft an arrears message and follow-up date against a tenancy. Only an owner or manager decides the proposal and the decision retains the actor. An approved draft remains distinct from a delivered message or a resolved delinquency.

**Acceptance.**
1. Prepare an arrears follow-up as a member, approve it as the owner and inspect its saved message, due date and approval through the tenancy state.

**Evidence.** `src/terrace/tenancies.ts`; `tests/terrace.test.mjs`
**Gap.** The arrears follow-up is prepared as a member and approved as the owner, but the saved message, follow-up date and approval are never read back through the tenancy state in its cited test file.

#### TER-006 — Export period rent receivables

Core · published · **done**

**Requirement.** Managers download a tenancy-period owner CSV with opening receivable, charges, external receipts, explained reductions and closing receivable. It states its recorded-rent boundary; it is not yet a trust, bank, distribution or tax statement. Preparers cannot download it.

**Acceptance.**
1. Download a statement spanning the charge and receipts, reconcile its opening plus movements to closing, find receipt references, and refuse the same download to a member.

**Evidence.** `src/terrace/ledger.ts`; `src/terrace/api.ts`; `tests/terrace.test.mjs`
**Gap.** None.

#### TER-007 — Retain photographed inspections

Core · published · **done** · Cites BASE-INPUT-003

**Requirement.** Managers create dated inspections with notes, upload real JPEG/PNG bytes and complete only with notes and photo evidence. Authenticated photo retrieval preserves the stored bytes and fingerprint; completed inspections retain their tenancy relationship.

**Acceptance.**
1. Refuse an empty completion and invalid image, upload a photo through multipart API, retrieve identical bytes and complete the inspection with notes.

**Evidence.** `src/terrace/work.ts`; `tests/terrace.test.mjs`
**Gap.** None.

#### TER-008 — Approve an external trade handoff

Core · published · **done** · Cites BASE-MAIL-001 · Rules D-3, D-5

**Requirement.** A preparer records maintenance, trade contact, due date and estimate. Managers approve the exact revision before downloading an unsent .eml packet, then record a reference to the human’s external handoff. A packet download never counts as provider delivery or repair completion.

**Acceptance.**
1. Refuse packet retrieval before approval, approve the current job once, inspect its addressed packet and record an external Sent-folder reference with the approval fingerprint retained.

**Evidence.** `src/terrace/work.ts`; `tests/terrace.test.mjs`
**Gap.** None.

#### TER-009 — Review and undo tenancy CSV move-in

Core · published · **done** · Cites BASE-DATA-001

**Requirement.** The owner previews Terrace tenancy CSV v1 under a stable namespace, approves its exact fingerprint, retains original bytes and a journal, and undoes unchanged imports. Undo refuses to erase tenancies with later rent, work or edits. This kit is not an incumbent importer.

**Acceptance.**
1. Preview the published CSV, reject an incorrect fingerprint, apply the reviewed preview, inspect originals and journal, undo an untouched batch and refuse undo after a later charge.

**Evidence.** `src/terrace/imports.ts`; `src/terrace/imports-source.ts`; `src/terrace/imports-target.ts`; `tests/terrace.test.mjs`
**Gap.** None.

#### TER-010 — Export and restore product custody

Core · published · **done** · Cites BASE-DATA-001, BASE-BACKUP-001

**Requirement.** The owner exports all current product rows, photos, original imports and journals to a .rer archive and restores into an empty product destination. The destination retains its own owner identity; sessions and private configuration are not restored. Nonempty destinations and corrupt archives are refused.

**Acceptance.**
1. Download the backup archive and restore it through the restore command into a fresh installation; compare tenancy, ledger and photo bytes, exercise retained import undo and refuse a second restore into occupied data.

**Evidence.** `src/terrace/data.ts`; `src/terrace/archive-policy.mjs`; `tests/terrace.test.mjs`
**Gap.** None.

#### TER-011 — Erase tenancy custody with a restore fence

Core · published · **partial** · Cites BASE-DATA-003

**Requirement.** The owner confirms the exact tenant email before erasing the tenancy, its dependent product data, photos and import custody. A later archive carries an erasure journal that blocks resurrection from an older archive when supplied during restore. Offline archives require that later journal to know about later erasure.

**Acceptance.**
1. Reject an incorrect confirmation, erase the tenancy, verify absent state and photo 404, export the later journal and refuse an older archive plus that journal in a clean destination.

**Evidence.** `src/terrace/data.ts`; `src/terrace/imports.ts`; `src/terrace/archive-policy.mjs`; `tests/terrace.test.mjs`
**Gap.** The erasure journey is asserted in `tests/retention.mjs` (the SAFE-004 journey), which this clause’s Evidence does not cite; its cited `tests/terrace.test.mjs` only refuses erasure to a member.

#### TER-012 — Preserve the installed app and run site

Core · published · **done** · Cites BASE-ACCESSIBILITY-001, BASE-DOCS-001

**Requirement.** The installed root remains the shared Lobby. The app keeps linked tenancies and existing rent, work, move-in and data/access forms with a stacked phone ledger. The separate public run site builds the approved homepage, Run Terrace, Markdown guides and real not-found document without reading installation data.

**Acceptance.**
1. Build the site and open /, /run, /docs and a missing path; in the signed-in app use linked tenancy actions and inspect the rent ledger at 1440 and 390 pixels with real entered records.

**Evidence.** `src/terrace/view.ts`; `src/terrace/ledger-view.ts`; `src/site/docs.ts`; `src/site/run.ts`; `tests/terrace.test.mjs`; `tests/app-journey.mjs`
**Gap.** None.

### Portfolio, leases and operating rights

#### PORT-001 — Run a US portfolio in USD

Core · target · **done** · Rules D-2

**Requirement.** Set up a US management company, legal entities, office contacts, EIN reference, property timezones and USD operating accounts. Dates and schedules use property-local time and money uses exact cents with explicit rounding. Preserve legacy AUD history as AUD with a reviewed migration rather than relabeling currency. Its exact terms are in [docs/contract/terms/portfolio.md](docs/contract/terms/portfolio.md#port-001--run-a-us-portfolio-in-usd).

**Acceptance.**
1. Create a US company and two property timezones, enter USD rent, cross a daylight-saving boundary and import an AUD historical tenancy; show currency and period boundaries without converting or relabeling old balances.

**Evidence.** `migrations/core/0018_us_portfolio.sql`; `migrations/core/0027_legacy_currency.sql`; `src/terrace/company.ts`; `src/terrace/zones.ts`; `src/terrace/ledger.ts`; `src/terrace/tenancies.ts`; `src/terrace/imports-source.ts`; `tests/terrace.test.mjs`
**Gap.** None.

#### PORT-002 — Separate properties buildings and units

Core · target · **done**

**Requirement.** Maintain portfolios, buildings, addresses, unit identifiers, bedrooms, amenities, occupancy state and rentable status independently from tenancies. Units retain past and future leases; transfers never merge two units or lose prior history. Its exact terms are in [docs/contract/terms/portfolio.md](docs/contract/terms/portfolio.md#port-002--separate-properties-buildings-and-units).

**Acceptance.**
1. Create a duplex with two units, end one lease, move a resident to the other unit and view each unit’s dated occupancy and lease history.

**Evidence.** `migrations/core/0023_properties.sql`; `src/terrace/properties.ts`; `src/terrace/property-view.ts`; `src/terrace/tenancies.ts`; `tests/terrace.test.mjs`
**Gap.** None.

#### PORT-003 — Manage owners and management agreements

Core · target · **done**

**Requirement.** Track individual/entity owners, joint ownership shares with effective dates, W-9 collection status, management agreements, reserve requirements and property allocations. A mid-period ownership change preserves who earned income and owed expenses before and after transfer. Its exact terms are in [docs/contract/terms/portfolio.md](docs/contract/terms/portfolio.md#port-003--manage-owners-and-management-agreements).

**Acceptance.**
1. Add two owners with shares, change ownership on a dated transfer and inspect the income, reserve and statement allocation on each side of that date.

**Evidence.** `migrations/core/0031_owners.sql`; `src/terrace/owners.ts`; `src/terrace/owner-view.ts`; `src/terrace/api.ts`; `tests/terrace.test.mjs`
**Gap.** None.

#### PORT-004 — Keep resident households and occupants

Core · target · **done**

**Requirement.** Separate residents, co-tenants, guarantors, nonpaying occupants, emergency contacts and authorized contacts; track communication preferences and household membership dates. A person on multiple leases has distinct liabilities and portal access for each. Its exact terms are in [docs/contract/terms/portfolio.md](docs/contract/terms/portfolio.md#port-004--keep-resident-households-and-occupants).

**Acceptance.**
1. Add co-tenants and a guarantor, transfer one person between leases and verify balances, recipients and document rights stay with the correct household.

**Evidence.** `tests/terrace.test.mjs`; `tests/households.mjs`; `tests/households-browser.mjs`; `src/terrace/households.ts`
**Gap.** None.

#### PORT-005 — Version complete lease obligations

Core · target · **done** · Rules D-3

**Requirement.** Record signed lease versions, recurring rent schedules, proration, concessions, deposits, pets, utilities, parking, insurance, addenda and any Housing Choice Voucher HAP contract (housing authority, tenant portion and HAP portion, PAY-013) with effective dates and source documents. Amendments preserve old terms and preview their future charges before approval. Its exact terms are in [docs/contract/terms/portfolio.md](docs/contract/terms/portfolio.md#port-005--version-complete-lease-obligations).

**Acceptance.**
1. Enter a lease with a concession and pet charge, approve a mid-month amendment, and reconcile previewed charges and source clauses to the resident ledger while retaining the signed prior version.

**Evidence.** `migrations/core/0042_lease_versions.sql`; `src/terrace/lease-versions.ts`; `src/terrace/lease-input.ts`; `src/terrace/lease-source.ts`; `src/terrace/lease-view.ts`; `src/terrace/charge-run.ts`; `src/terrace/charge-concessions.ts`; `tests/leases.mjs`; `tests/terrace.test.mjs`
**Gap.** None.

#### PORT-006 — Complete move-in transfers and move-out

Core · target · **partial**

**Requirement.** Use checklists for keys, meters, condition, prorated charges, deposits, forwarding address and possession. Roommate changes and unit transfers close and reopen the appropriate obligations; move-out produces the deposit disposition and make-ready work without deleting the lease. Its exact terms are in [docs/contract/terms/portfolio.md](docs/contract/terms/portfolio.md#port-006--complete-move-in-transfers-and-move-out).

**Acceptance.**
1. Move a household in mid-month, transfer units and move out; verify prorations, distinct deposits, final balances, keys checklist and linked turnover tasks.

**Evidence.** `src/terrace/properties.ts`; `src/terrace/turnover-writes.ts`; `src/terrace/property-view.ts`; `src/terrace/move-checklists.ts`; `src/terrace/move-checklist-view.ts`; `migrations/core/0052_move_checklists.sql`; `tests/move-out.mjs`; `tests/move-checklists.mjs`; `tests/move-out-browser.mjs`; `tests/roommates.mjs`; `src/terrace/households.ts`; `src/terrace/household-view.ts`; `tests/terrace.test.mjs`
**Gap.** Linked make-ready transitions and sourced, versioned keys/meters/condition/possession/forwarding checklists ship through scoped staff doors, with stale/concurrent-edit refusal, prior revisions, lease-date review, archive restore and lease erasure. Roommate changes and unit transfers close and reopen who is named on each charge by membership dates, and a transfer carries the household to the new lease in the same write. Gap: distinct deposits/disposition, final accounts and complete proration reconciliation (ACCT-003/004, blocked on PORT-008 counsel); successor-occupied make-ready follow-up remains manual.

#### PORT-007 — Store searchable operating documents

Core · target · **done** · Cites BASE-INPUT-003

**Requirement.** Attach and version leases, applications, notices, screening reports and tax documents on their tenancy records; inspection photos and video, work documents and invoices attach to their own records under PORT-009. Search authorized content and metadata; restrict screening and tax documents, screen uploads and preserve download history and retention classes; the malware-verdict leg of “scan uploads” is PORT-010. ROLE-001 applies before this ships: document search and downloads return only records on tenancies in the searcher’s portfolios and role. Its exact terms are in [docs/contract/terms/portfolio.md](docs/contract/terms/portfolio.md#port-007--store-searchable-operating-documents).

**Acceptance.**
1. Upload an amended lease and restricted screening PDF; find the current version from its unit, recover the prior lease and deny a vendor and unrelated resident access.
2. A scoped staff user’s search and direct document download return nothing from another portfolio (404).
3. SAFE-005 applies before this ships: each stored document appears in the readable export as its original file with its SHA-256 and restores with the backup.
4. PORT-005 signed originals, versions, source clauses and retention remain intact when broader document search and custody ship.

**Evidence.** `tests/documents.mjs`; `tests/terrace.test.mjs`; `tests/portal.mjs`; `tests/retention.mjs`; `tests/leases.mjs`; `tests/documents-browser.mjs`; `src/terrace/documents.ts`; `src/terrace/document-scan.ts`; `src/terrace/document-view.ts`; `migrations/core/0060_documents.sql`; `migrations/core/0062_document_access.sql`; `API.md`
**Gap.** None.

#### PORT-008 — Apply named state landlord-tenant rule packs

Core · target · **partial** · Register R-7

**Requirement.** Terrace ships a versioned rule pack for each of the 50 states and the District of Columbia, reviewed by counsel (register R-7), plus local overlays where a city or county adds deposit, late-fee, notice or rent rules (first: Los Angeles, San Francisco, New York City, Chicago and Seattle). Packs activate in this order: California, Texas and Florida; then New York, Georgia, North Carolina, Arizona, Illinois, Washington and Colorado; then every remaining state and DC. Its exact terms are in [docs/contract/terms/portfolio.md](docs/contract/terms/portfolio.md#port-008--apply-named-state-landlord-tenant-rule-packs).

**Acceptance.**
1. Run the same move-out with a $1,800 deposit in a California, a Texas and a Florida property: California returns an itemized statement due in 21 days by personal delivery or first-class mail (Cal. Civ. Code §1950.5(g)); Texas a refund due in 30 days after surrender (Tex. Prop. Code §92.103); Florida a certified-mail notice of claim due in 30 days, or a refund in 15 days with no claim (Fla. Stat. §83.49(3)).
2. Compute a late fee in the Texas property only after rent stays unpaid two full days and within the 12% presumption for a structure of four or fewer units (Tex. Prop. Code §92.019).
3. In a California property, propose a renewal increase above the §1947.12 cap and show it held with the cap calculation, and show a nonrenewal of a resident in occupancy for 12 months held until a §1946.2 just cause is recorded.
4. List all 51 packs with version and review state, remove one field from a pack and show the dependent action blocked, then publish a new pack version and show an earlier disposition keeps its original version.

**Evidence.** `tests/rule-packs.mjs`; `tests/terrace.test.mjs`; `tests/rule-packs-browser.mjs`; `docs/state-rule-packs.md`; `migrations/core/0058_rule_authority.sql`
**Gap.** No active counsel-reviewed values ship (see the rule-pack guide, docs/state-rule-packs.md). Existing operating commands do not yet enforce these previews. No Terrace counsel-reviewed contents or templates (counsel engagement not executed); existing commands do not enforce packs; complete engines and applicability unproved. Synthetic counsel-input previews are not legal review. Authority and content follow the rule-pack terms.

#### PORT-009 — Attach inspection media, work documents and invoices to their records

Core · target · **done** · Cites BASE-INPUT-003

**Requirement.** Inspection photos and video attach to their inspection, work documents to their work order and invoices to their vendor invoice, with their own bounds: photos and video exceed 5 MB and upload in resumable chunks, and each stored file keeps its original bytes and SHA-256. ROLE-001 scope and ROLE-002 vendor rights apply to every read. Its exact terms are in [docs/contract/terms/portfolio.md](docs/contract/terms/portfolio.md#port-009--attach-inspection-media-work-documents-and-invoices-to-their-records).

**Acceptance.**
1. Upload a video to an inspection.
2. SAFE-005 applies before this ships: each stored photo or video appears in the readable export as its original file with its SHA-256 and restores with the backup.

**Evidence.** `tests/field-capture.test.mjs`; `tests/record-media.mjs`; `tests/record-media-browser.mjs`; `src/terrace/field-evidence-media.ts`; `migrations/core/0070_record_media.sql`
**Gap.** None.

#### PORT-010 — Scan uploads with the owner’s scanner

Core · target · **missing** · Cites BASE-INPUT-003, BASE-DATA-004

**Requirement.** An upload’s malware verdict comes only from a scanner processor the owner configures for the installation, and a scanner outage quarantines the upload instead of passing it. Its exact terms are in [docs/contract/terms/portfolio.md](docs/contract/terms/portfolio.md#port-010--scan-uploads-with-the-owners-scanner).

**Acceptance.**
1. Scan uploads with the owner’s scanner: the malware-verdict leg of PORT-007’s “scan uploads”.

**Evidence.** None.
**Gap.** No owner-configured scanner processor, verdict, consent record or outage quarantine exists; uploads pass only PORT-007’s static screen, which is never called a malware verdict. Needs a Base scanner adapter.

#### ROLE-001 — Grant staff rights by responsibility

Core · target · **partial** · Cites BASE-ROLE-001, BASE-ACCESS-004

**Requirement.** Owner controls access, integrations, money authorities and cutover. Portfolio managers lease and approve property work within assigned properties and limits; leasing staff manage prospects without bank data; bookkeepers post and reconcile without managing access; accountants read/export and propose close corrections; maintenance coordinators schedule work without approving payouts. Its exact terms are in [docs/contract/terms/portfolio.md](docs/contract/terms/portfolio.md#role-001--grant-staff-rights-by-responsibility).

**Acceptance.**
1. Exercise each role across two assigned portfolios, directly request another property’s API/download, and attempt a payout as leasing staff and an access change as bookkeeper; every unauthorized path is denied.
2. Until payouts ship (ACCT-008, ACCT-010, ACCT-018 carry the leasing refusal), leasing staff attempt to post money (an external receipt and the charge run) and are refused.

**Evidence.** `migrations/core/0030_roles.sql`; `src/terrace/roles.ts`; `src/terrace/core.ts`; `src/terrace/api.ts`; `src/terrace/people.ts`; `src/auth.server.ts`; `tests/terrace.test.mjs`
**Gap.** The leasing-staff payout refusal in point 1 waits for a payout door (ACCT-008, ACCT-010, ACCT-018); the money-posting refusals that stand in for it today, the portfolio scope and the bookkeeper’s access refusal are asserted.

#### ROLE-002 — Isolate residents owners and vendors

Core · target · **done** · Cites BASE-ROLE-001, BASE-ACCESS-002

**Requirement.** Residents see only their authorized lease/household accounts; owners see only properties and periods they own; vendors see assigned work and their invoices. Invitations, delegated contacts, ownership changes and revocation update rights immediately without exposing other households, owners, screening or bank details. Its exact terms are in [docs/contract/terms/portfolio.md](docs/contract/terms/portfolio.md#role-002--isolate-residents-owners-and-vendors).

**Acceptance.**
1. Invite a resident, joint owner and vendor, change an assignment and ownership date, then crawl portal pages, direct downloads and APIs before and after revocation.

**Evidence.** `tests/portal.mjs`; `tests/terrace.test.mjs`; `tests/retention.mjs`; `tests/documents-browser.mjs`; `src/terrace/portal.ts`; `src/terrace/portal-session.ts`; `src/terrace/portal-data.ts`; `src/terrace/portal-http.ts`; `src/terrace/portal-view.ts`; `src/terrace/portal-view-staff.ts`; `migrations/core/0061_portal.sql`; `API.md`
**Gap.** None.

#### ROLE-003 — Apply dual control and spending limits

Core · target · **partial** · Rules D-3

**Requirement.** Set owner-approved per-property repair limits, quote requirements, reserves and separate preparation/approval/payment authorities. Whoever prepared work cannot approve it. Changed amount, payee, bank details or terms invalidate approval; bank-detail changes, including an ACH notification of change (ACCT-018), use independent verification and a separate audit event. SAFE-001 applies before this ships: a bank-detail change needs the changer’s fresh email-link proof. Its exact terms are in [docs/contract/terms/portfolio.md](docs/contract/terms/portfolio.md#role-003--apply-dual-control-and-spending-limits).

**Acceptance.**
1. Prepare an over-limit repair and owner distribution, change the payee after approval, and show approval escalation and execution refusal until an independently authorized person approves the exact new inputs.
2. A bank-detail change without a fresh email-link proof is refused (403).

**Evidence.** `migrations/core/0034_dual_control.sql`; `src/terrace/dual-control.ts`; `src/terrace/work.ts`; `src/terrace/tenancies.ts`; `src/terrace/quotes.ts`; `tests/terrace.test.mjs`
**Gap.** The owner-distribution leg of point 1 is unasserted: owner distributions do not exist yet (ACCT-010). The repair leg, payee change, escalation, execution refusal and independent approval are asserted.

### Leasing acquisition and execution

#### LEASE-001 — Publish property marketing and vacancies

Core · target · **missing** · Cites BASE-PUBLIC-001, BASE-ACCESSIBILITY-001

**Requirement.** Publish accessible property/unit pages with accurate availability, rent, fees, deposits, amenities, photos, floorplans and enquiry/application actions. Vacancies come from unit and lease status; managers preview changes and withdraw occupied units. One listing record is the source for every channel: the same unit publishes to the manager’s own site page and, through LEASE-002 and LEASE-003, to Zillow and Apartments.com, and a later edit or withdrawal reaches all three.

**Acceptance.**
1. Publish two vacant units, submit an enquiry on mobile, lease one and confirm its vacancy is withdrawn while the other remains available with the approved price and fees.
2. Edit the rent once and show the own-site page, the Zillow submission and the Apartments.com submission each carrying the new rent with its own channel status.
3. LEASE-005 applies before this ships: an enquiry from the own-site page creates a LEASE-005 prospect with source “own site listing”, held for duplicate review like any other lead.
4. REPORT-003 applies before this ships: its real listing publication, channel status and freshness become dated source events in the leasing-performance report; a ready unit never implies a fresh listing.

**Evidence.** None.
**Gap.** Property marketing and vacancy publication are absent.

#### LEASE-002 — Syndicate listings to Zillow

Core · target · **missing**

**Requirement.** Connect authorized Zillow rental distribution, map required fields and media, submit approved listings and retain marketplace IDs, rejection details, updates and removals. Publication is confirmed from provider status; one submission is not proof that a listing is live.

**Acceptance.**
1. Publish through the provider test boundary, correct a rejected fee field, change rent and withdraw the listing; show acknowledgments and the same external listing identity without duplicates.
2. LEASE-005 applies before this ships: each Zillow lead creates a LEASE-005 prospect with source “marketplace listing” and the lead reference, held for duplicate review like any other lead.
3. REPORT-003 applies before this ships: its real listing publication, channel status and freshness become dated source events in the leasing-performance report; a ready unit never implies a fresh listing.

**Evidence.** None.
**Gap.** Zillow connection and listing status reconciliation are absent.

#### LEASE-003 — Syndicate listings to Apartments.com

Core · target · **missing**

**Requirement.** Distribute approved vacancy, price, fee and photo data to Apartments.com using its supported partner path and account permissions. Reconcile accepted, rejected, updated and removed listings independently of Zillow.

**Acceptance.**
1. Submit the same unit to Apartments.com, process a rejection and later success, update availability and remove it after lease execution; trace each provider result to the unit.
2. LEASE-005 applies before this ships: each Apartments.com lead creates a LEASE-005 prospect with source “marketplace listing” and the lead reference, held for duplicate review like any other lead.
3. REPORT-003 applies before this ships: its real listing publication, channel status and freshness become dated source events in the leasing-performance report; a ready unit never implies a fresh listing.

**Evidence.** None.
**Gap.** Apartments.com distribution is absent.

#### LEASE-004 — Extend listing reach with Zumper and RentCafe

Core · target · **missing**

**Requirement.** Offer separate authorized adapters for Zumper and the RentCafe ecosystem, with explicit entitlement and field mappings. Show per-channel freshness and errors and consolidate channel-attributed enquiries; an unavailable entitlement leaves a visible setup requirement.

**Acceptance.**
1. Enable each adapter in its supported environment, publish and withdraw a unit, receive an enquiry and demonstrate that an unentitled account cannot appear connected or published.
2. LEASE-005 applies before this ships: each Zumper or RentCafe lead creates a LEASE-005 prospect with source “marketplace listing” and the lead reference, held for duplicate review like any other lead.

**Evidence.** None.
**Gap.** Zumper and RentCafe adapters are absent.

#### LEASE-005 — Work prospect records and enquiries

Core · target · **done** · Cites BASE-DATA-003

**Requirement.** Capture web, marketplace, email and phone leads, deduplicate with review, retain household preferences, source, consent, assigned leasing staff and activity history. Track enquiry to showing, application, offer and lost reason without importing general sales CRM scope. ROLE-001 applies before this ships: leasing staff work prospects in their portfolios and never see bank data. Its exact terms are in [docs/contract/terms/leasing.md](docs/contract/terms/leasing.md#lease-005--work-prospect-records-and-enquiries).

**Acceptance.**
1. Receive a listing enquiry and duplicate email, review the match, assign a leasing person, respond and follow that prospect through showing and application with source attribution intact.
2. Leasing staff work a prospect in their portfolio and get 404 for another portfolio’s prospect.

**Evidence.** `migrations/core/0044_prospects.sql`; `src/terrace/prospects.ts`; `src/terrace/prospect-mail.ts`; `src/terrace/prospect-view.ts`; `tests/prospects.mjs`; `tests/terrace.test.mjs`
**Gap.** None.

#### LEASE-006 — Coordinate tours and showing access

Core · target · **missing**

**Requirement.** Offer resident-safe showing slots, conflict checks, reminders, cancellations and no-show follow-up; honor notice/access rules and occupancy. Integrate Tenant Turner and Showings Coordinator and sync appointments with Google Calendar and Microsoft 365 without revealing resident private data.

**Acceptance.**
1. Book competing tours, reschedule through the prospect link, cancel one and process a no-show; verify each connected scheduler/calendar and the permitted access window agree.

**Evidence.** None.
**Gap.** Showing scheduling and named scheduler/calendar connections are absent.

#### LEASE-007 — Take complete online applications

Core · target · **missing** · Cites BASE-INPUT-003

**Requirement.** Applicants submit mobile applications for each adult/co-applicant with identity, income, rental history, references, required disclosures, attachments and provider-collected application fees. Save progress, request missing evidence and prevent staff from silently changing submitted answers.

**Acceptance.**
1. Two co-applicants save and resume, upload income evidence and submit; manager requests one missing document and sees revisions and fee outcome without card data in Terrace.

**Evidence.** None.
**Gap.** Online applications, application fees and applicant workspace are absent.

#### LEASE-008 — Order consented TransUnion screening

Core · target · **missing** · Rules D-6

**Requirement.** Use TransUnion’s authorized screening service for credit, background and eviction data after explicit applicant consent and provider onboarding. Restrict report access, show coverage, pending/error states and provider references, and retain consent and retrieval provenance.

**Acceptance.**
1. Submit a consented application to the provider sandbox, receive a delayed report and duplicate callback, deny an unauthorized report download and show provider errors without fabricating a screening result.

**Evidence.** None.
**Gap.** Screening integration, consent and restricted reports are absent.

#### LEASE-009 — Review applicants and adverse actions

Core · target · **missing** · Rules D-6

**Requirement.** Managers apply disclosed criteria consistently, inspect source reports and record the decision. Provide approved adverse-action packages, dispute/provider contacts and delivery evidence; accommodation and contested findings route to authorized staff or counsel. Terrace never ranks applicants by protected traits, for any person or agent; choosing a tenant is a commitment, and its record names who decided. Criteria include the manager’s disclosed income rule (for example monthly income of at least a stated multiple of rent), evaluated against verified income and shown with its result beside the screening report; an approval or decline notice reaches the applicant only after the manager’s explicit decision.

**Acceptance.**
1. Review two applications, flag a disputed report, require a manager decision and send an explicitly approved adverse-action package with the correct provider reference and recorded delivery.
2. Apply an income-multiple rule to both applications, show the calculation beside the report, approve one and decline the other, and show each applicant’s notice sent only after that decision with its delivery record.
3. SAFE-002 applies before this ships: a screening file export is a history row with outcome “exported”.

**Evidence.** None.
**Gap.** Applicant decision, dispute and approved adverse-action workflows are absent.

#### LEASE-010 — Compose jurisdiction-reviewed lease templates

Core · target · **missing** · Register R-7

**Requirement.** Maintain property/jurisdiction template versions with the required disclosures and addenda listed in the property's PORT-008 state and local pack, merge reviewed application and approved terms and compare deviations. Missing mandatory inputs block issue; legal wording is approved by a manager or counsel, and no generated text is presented as a claim of legal validity.

**Acceptance.**
1. Generate a lease with co-signers, pet addendum and local disclosure, detect a missing required input and approve a changed term while preserving the template version and redline.

**Evidence.** None.
**Gap.** Lease template assembly and reviewed jurisdiction packs are absent.

#### LEASE-011 — Collect legally evidenced electronic signatures

Core · target · **missing**

**Requirement.** Send leases and renewals to every required resident, guarantor and manager with consent, signing order, identity evidence, reminders, expiry and declined/void states. Integrate Inkwell or DocuSign; only the completed artifact and certificate activate the lease, and changed terms require a new envelope.

**Acceptance.**
1. Send a multi-signer lease, process one decline and a replacement envelope, complete all signatures, replay its callback and attach exactly one executed PDF/certificate to the activated tenancy.
2. PORT-005 applies before this ships: the executed original and certificate establish a retained signed version and its source-linked charge schedule, rather than overwriting a prior signed version.
3. LEASE-012 applies before this ships: renewals sent for electronic signature replace the staff-recorded signed renewal original, and only the completed artifact and certificate activate the renewal once.

**Evidence.** None.
**Gap.** E-signature provider/sibling integration and execution lifecycle are absent.

#### LEASE-012 — Run renewal and retention campaigns

Core · target · **partial** · Rules D-3

**Requirement.** Schedule renewal work from lease-end dates, compare proposed terms with current rent and vacancy assumptions, deliver approved offers, track replies and deadlines and collect signatures. Acceptance activates future terms once; nonresponse, nonrenewal and month-to-month conversion create named next actions. The comparison shows the proposed rent’s change from current rent in dollars and percent, a dated market-rent assumption and an estimated turnover cost (vacant days at the unit’s rent plus make-ready and leasing costs), each with its source. Its exact terms are in [docs/contract/terms/leasing.md](docs/contract/terms/leasing.md#lease-012--run-renewal-and-retention-campaigns).

**Acceptance.**
1. Run a renewal window with accepted, declined and unanswered offers; trace approved delivery and executed future terms, and verify the unresolved household remains in the follow-up queue.
2. Before approving a 12-month renewal, show its percentage increase against the dated market rent and the estimated turnover cost.
3. SAFE-005 applies before this ships: its signed renewal documents appear in the readable export and come back with a restore into a fresh installation.
4. PORT-005 applies before this ships: approved executed renewal terms activate a reviewed versioned charge schedule with its signed source and prior versions retained.
5. REPORT-007 applies before this ships: actual approved renewals source its cash and vacancy comparison with dated terms, while proposed alternatives remain labeled assumptions.
6. REPORT-003 applies before this ships: campaign, reply and executed-renewal outcomes replace the report’s recorded-term limitation with dated sources and no inferred signature or delivery.

**Evidence.** `migrations/core/0046_renewals.sql`; `src/terrace/renewals.ts`; `src/terrace/renewal-mail.ts`; `src/terrace/renewal-view.ts`; `src/terrace/lease-versions.ts`; `src/terrace/leasing-metrics.ts`; `src/terrace/scenarios.ts`; `tests/renewals.mjs`; `tests/terrace.test.mjs`
**Gap.** Two outcomes are unasserted in its cited tests: that the tenancy’s prior lease versions are retained beside the activated renewal schedule (point 4), and that the leasing report infers no delivery from a campaign send (point 6).

### Rent collection and receivables

#### PAY-001 — Post recurring rent and lease charges

Core · target · **done** · Rules D-2, D-4

**Requirement.** Generate recurring rent, utilities, pet/parking charges, concessions and move-in/out prorations from effective lease terms in USD. Preview a run, surface missing terms and prevent duplicate posting across retries, amendments and month boundaries. Its exact terms are in [docs/contract/terms/rent.md](docs/contract/terms/rent.md#pay-001--post-recurring-rent-and-lease-charges).

**Acceptance.**
1. Preview and post rent for leases with a concession and mid-month move-in, replay the run and amend future rent; verify each period posts once and posted history is preserved.

**Evidence.** `migrations/core/0022_recurring_charges.sql`; `src/terrace/charge-run.ts`; `src/terrace/charge-run-view.ts`; `tests/terrace.test.mjs`
**Gap.** None.

#### PAY-002 — Collect rent through ACH

Core · target · **missing** · Rules D-3, D-4, D-5

**Requirement.** Connect the manager’s authorized Stripe ACH account or contracted rent processor using hosted bank authorization and required onboarding. Residents see USD fees and authorization before paying; pending, submitted and settled states remain distinct and each attempt has one provider identity. Each receipt type settles to the bank account ACCT-002 maps it to, using a separate processor connected account per receiving bank account where the processor pays out to one account, so an online security deposit never lands in the rent-trust account.

**Acceptance.**
1. Pay a resident balance through ACH sandbox authorization, restart after provider submission and reconcile pending then settled callbacks without a second debit or exposing bank credentials.
2. In a property whose deposit and rent-trust accounts differ, pay a security deposit and the first month's rent online and show the deposit payout settling to the deposit bank account and the rent payout to the trust account.
3. DEMO-001 applies before this ships: its demo flow retains the effect guard and adds a public-door no-egress assertion; no real payment, message or webhook is sent from a demo.

**Evidence.** None.
**Gap.** ACH collection and processor reconciliation are absent.

#### PAY-003 — Collect rent by card

Core · target · **partial** · Rules D-3, D-4, D-5 · Register R-13

**Requirement.** Use Stripe-hosted card entry or an approved rent processor with tokenized payment methods. Disclose permitted payer fees, accept supported debit/credit cards, handle required authentication and retain payment references without storing PAN or security codes. Card receipts settle to the bank account ACCT-002 maps their charge type to, as for PAY-002. One hosted card payment runs only on the explicit consent of a currently authorized full resident or of receipt staff who also hold the payer’s recorded authorization; the payer pays no surcharge, the provider receipt binds the reserved amount, currency, mode and intent, and settlement into the designated bank is a separate verified fact. Its exact terms are in [docs/contract/terms/rent.md](docs/contract/terms/rent.md#pay-003--collect-rent-by-card).

**Acceptance.**
1. Pay a partial balance with a test card requiring authentication, inspect the disclosed fee, complete payment and confirm one resident receipt and matching provider reference.
2. Pay a security deposit by card in a property with separate deposit and trust accounts and show it settling to the deposit account.
3. DEMO-001 applies before this ships: its demo flow retains the effect guard and adds a public-door no-egress assertion; no real payment, message or webhook is sent from a demo.

**Evidence.** `tests/terrace.test.mjs`; `tests/card-payments.mjs`; `tests/card-payments-browser.mjs`
**Gap.** End-to-end live Stripe ledger receipt, decline, required authentication and provider-event replay remain unproved. Deposit collection and liability require ACCT-003 and PORT-008 counsel-reviewed rules; actual provider settlement into the ACCT-002 mapped banks and authorized production configuration remain unproved. The implementation remains test-only.

#### PAY-004 — Manage resident autopay mandates

Core · target · **missing** · Rules D-3

**Requirement.** Residents authorize fixed amount or outstanding-balance autopay, start/end dates, limits and advance notifications; managers control eligibility without inventing authorization. A person approves each mandate, which supplies standing authority for scheduled debits within its exact limits. Cancellation stops unsent attempts.

**Acceptance.**
1. Authorize capped balance autopay, change the bill above its cap, then cancel before the next run; verify the permitted debit, held exception, notice and canceled attempt.
2. DEMO-001 applies before this ships: its demo flow retains the effect guard and adds a public-door no-egress assertion; no real payment, message or webhook is sent from a demo.

**Evidence.** None.
**Gap.** Autopay mandates, schedules and notices are absent.

#### PAY-005 — Enforce partial and split payment policies

Core · target · **partial**

**Requirement.** Configure partial-payment rules by lease and delinquency stage within the property's PORT-008 pack, distinguish pending from settled funds, support co-tenant split payments and resident/housing-authority split rent (PAY-013), and allocate receipts by explicit charge priority. Reject overpayment or hold it as separately identified credit according to approved policy. The owner alone configures the policy, and only the owner and in-scope portfolio managers read it with its sources; existing receipt recorders keep their recording and outcome authority, and credit is used only by an explicit recorded decision. Its exact terms are in [docs/contract/terms/rent.md](docs/contract/terms/rent.md#pay-005--enforce-partial-and-split-payment-policies).

**Acceptance.**
1. Two co-tenants pay concurrently while one ACH is pending; show allocation, remaining balance and permitted credit, and refuse a partial payment under a reviewed stage-specific block.

**Evidence.** `tests/payer-accounting.test.mjs`; `tests/payments.mjs`; `tests/payments-browser.mjs`
**Gap.** External-record slice only: resident online collection must inherit this policy in PAY-002 and PAY-003; PAY-013 has separate payer entitlement and reconciliation journeys, done at its own ct judgment.

#### PAY-006 — Calculate late fees and grace periods

Core · target · **partial** · Register R-7

**Requirement.** Apply the grace period, cap and fee basis from the property's PORT-008 state and local pack, with weekend/holiday rules and lease terms that may only be stricter than the pack; show the calculation and permit authorized waivers with reasons. Reversals and delayed settlements recalculate only as the approved policy allows, with no compounding surprise. The owner configures fee terms; each fee posts only after review of its exact revision, a waiver keeps who waived it and why, nothing collects, notices or posts a late fee automatically, and a paid fee changes only by a new dated correcting entry. Its exact terms are in [docs/contract/terms/rent.md](docs/contract/terms/rent.md#pay-006--calculate-late-fees-and-grace-periods).

**Acceptance.**
1. Run a late-fee schedule across a weekend, record a timely pending payment that settles later and waive one fee; inspect charge basis, policy version and auditable waiver.
2. Charge the same late rent in a Texas and a California property and show each pack's grace period, cap and citation on the calculation.

**Evidence.** `tests/payer-accounting.test.mjs`; `tests/late-fees.mjs`; `tests/late-fees-browser.mjs`
**Gap.** All stated acceptance examples use synthetic owner-reviewed pack fixtures, not Terrace counsel review. Other fee bases are visibly held; PORT-008 reviewed authored contents remain open.

#### PAY-007 — Offer cash-at-retail and offline payment options

Core · target · **partial** · Register R-14

**Requirement.** Provide PayNearMe or a contracted retail-cash network with resident payment codes, fees, receipt references and settlement tracking. Record check, money-order and external ACH/check-scan deposits, allocating each once and distinguishing receipt from bank clearance.

**Acceptance.**
1. Generate a cash code, receive and replay its retail transaction, clear a check and return another; reconcile resident balances to settlement batches without treating a printed code as collected rent.
2. SAFE-002 applies before this ships: a returned or reversed payment is a new history row and a new posting, never an edit of the receipt.

**Evidence.** `src/terrace/ledger.ts`
**Gap.** Manual external receipts exist; retail network, check deposits and clearance/return states are absent.

#### PAY-008 — Resolve failed payments returns and disputes

Core · target · **missing**

**Requirement.** Handle ACH returns, NSF fees, card disputes, chargebacks and canceled attempts with processor evidence, resident communication and reopened receivables. Retries follow approved mandates and contact rules; suspended methods cannot be charged again silently.

**Acceptance.**
1. Return a previously settled ACH and dispute a card payment, inspect reversal entries and restored balances, submit approved evidence and verify a revoked mandate prevents another attempt.
2. SAFE-002 applies before this ships: an ACH return is a new history row and a reversing posting, never an edit of the receipt.
3. REPORT-002 applies before this ships: add returned/reversed ACH and pending/attempted collection outcomes, including its returned-ACH delinquency acceptance to the as-of report with dated source drills and no inferred settlement or resolution.

**Evidence.** None.
**Gap.** Provider failures, returns, disputes and retry controls are absent.

#### PAY-009 — Authorize refunds credits and write-offs

Core · target · **partial** · Rules D-3, D-4

**Requirement.** Prepare refunds to the original method, by ACH (ACCT-018), or by printed or mailed check to a forwarding address (ACCT-017), and reasoned credits/write-offs with before/after resident and owner effects. Human approval names payee, amount and source; limits and independent execution checks prevent duplicate or excessive refunds and preserve original receipts. Each recorded refund, credit or write-off binds its exact revision and an independent approver, recording its execution needs fresh email-link proof and the external facts the owner records, original receipts and owner allocations stay, and these commands send no bank or provider instruction. Its exact terms are in [docs/contract/terms/rent.md](docs/contract/terms/rent.md#pay-009--authorize-refunds-credits-and-write-offs).

**Acceptance.**
1. Prepare and approve a refund, change its source after approval and refuse it; execute an unchanged refund twice and reconcile one provider refund, one ledger reversal and the correct owner effect; issue a former resident's refund by check to a forwarding address and see it in the check register.

**Evidence.** `tests/payer-accounting.test.mjs`; `tests/financial-actions.mjs`; `tests/financial-actions-browser.mjs`
**Gap.** Provider refund execution and reconciliation are not implemented: a staff-entered external confirmation is not a provider receipt. ACCT-018 ACH and ACCT-017 negotiable printed/mailed checks, clearance and provider proof remain open; check register entries are explicitly non-negotiable drafts or staff-recorded external issuance. Actual rail acceptance remains open.

#### PAY-010 — Issue resident statements and receipts

Core · target · **partial** · Cites BASE-MAIL-001

**Requirement.** Deliver itemized USD rent statements/invoices and payment receipts with due dates, lease charges, pending funds, fees, credits and current balance. Residents can download accessible PDF/CSV and inspect the source transaction; delivery failures create a follow-up. The owner delivers a statement a resident asked for to that household’s currently eligible email, with exact frozen financial content and fresh sender authority; each send reserves one attempt and keeps accepted, failed, uncertain and delivered outcomes apart, and household membership alone grants no other resident’s private document, payment or consent authority. Its exact terms are in [docs/contract/terms/rent.md](docs/contract/terms/rent.md#pay-010--issue-resident-statements-and-receipts).

**Acceptance.**
1. Generate a monthly statement, pay part of it, receive a delivered receipt, fail the statement email and inspect the resident portal’s matching balance and delivery task.

**Evidence.** `tests/payer-accounting.test.mjs`; `tests/resident-statements.mjs`; `tests/resident-statements-browser.mjs`; `tests/resident-statements-live.mjs`
**Gap.** Provider acceptance alone is never delivery.

#### PAY-011 — Work delinquencies to a recorded outcome

Core · target · **partial** · Register R-7

**Requirement.** Use aging by property/owner/resident, contact consent, approved message sequences, promises-to-pay, payment plans and actual receipts. Stop obsolete messages after payment, honor disputes/holds and escalate broken promises; notices, concessions, write-offs and eviction require authorized people. Pay-or-quit and lease-violation notices use the pack's notice period and are served and evidenced through PORTAL-009.

**Acceptance.**
1. Run a sequence for three late households, receive a reply and payment plan, settle one balance and break another promise; verify stopped messages, next actions and human notice approval, and serve the approved pay-or-quit notice with recorded posting evidence and its expiry date computed from service.
2. REPORT-002 applies before this ships: add active and broken payment plans, notices and collection outcomes, including its active-plan delinquency acceptance to the as-of report with dated source drills and no inferred settlement or resolution.

**Evidence.** `src/terrace/tenancies.ts`; `src/terrace/ledger.ts`; `tests/terrace.test.mjs`
**Gap.** Arrears totals and approved drafts exist; delivered sequences, plans, replies and resolution tracking are absent.

#### PAY-012 — Reconcile processor fees and settlements

Core · target · **missing**

**Requirement.** Match gross receipts, processing fees, refunds, reserves, payout batches and housing-authority HAP deposits (PAY-013) to bank deposits and the owner/property/tenant ledger. Replay or reorder callbacks safely; unexplained settlement differences remain exceptions and never become fabricated cash.

**Acceptance.**
1. Collect several rents into one net payout with a refund and fee, import its bank line and reconcile gross-to-net; replay callbacks and leave an intentionally short payout unresolved.
2. Reconcile an online deposit payout against the deposit bank account and the rent payout against the trust account separately.

**Evidence.** None.
**Gap.** Processor settlements and bank-to-subledger matching are absent.

#### PAY-013 — Split voucher rent between resident and housing authority

Core · target · **done** · Rules D-4

**Requirement.** For market-rate leases with Housing Choice Voucher (Section 8) or other tenant-based rental assistance, record the HAP contract and the public housing authority (PHA) as a separate payer with its own receivable, and the tenant and HAP portions with effective dates. Each rent run posts both charges; one PHA ACH or check covering many households is allocated across leases, properties and owners from the PHA remittance detail, with any unmatched remainder held as an exception. A recertification that changes the split posts retroactive adjustments to both receivables from its effective date with the PHA notice attached. HAP abatement after a failed inspection suspends or reverses the PHA charge for the abated period and never shifts it to the resident. Resident, owner and delinquency views show tenant and PHA balances separately, and a late HAP payment never triggers a resident late fee.

**Acceptance.**
1. Set up two voucher leases under different owners, post tenant and HAP portions, receive one PHA ACH covering both and allocate it, apply a HAP change effective three months back and one month's abatement; show tenant, PHA and owner balances, a delinquency report separating tenant arrears from PHA arrears and no late fee on PHA arrears.
2. PORT-005 applies before this ships: each HAP contract, split and effective revision names its signed version and source clauses, with reviewed amendments before posting.
3. REPORT-007 applies before this ships: actual tenant/PHA portions and payer outcomes source cash forecasts separately without shifting HAP arrears to residents.
4. REPORT-002 applies before this ships: add tenant versus housing-authority arrears, including its unpaid-HAP delinquency acceptance to the as-of report with dated source drills and no inferred settlement or resolution.

**Evidence.** `tests/hap.mjs`; `tests/hap-cadences.mjs`; `tests/hap-remittances.mjs`; `tests/hap-changes.mjs`; `tests/hap-portals.mjs`; `tests/hap-scenarios.mjs`; `tests/hap-erasure.mjs`; `tests/leases.mjs`; `tests/payer-accounting.test.mjs`; `tests/hap-browser.mjs`; `verification.json`
**Gap.** None.

### Trust accounting and owner finance

#### ACCT-001 — Maintain a balanced property ledger

Core · target · **partial** · Rules D-4

**Requirement.** Provide a double-entry USD general ledger and owner, property, tenant, vendor and security-deposit subledgers with a configurable chart of accounts, opening balances and source links. Each posting balances, each correction reverses rather than rewrites, and no owner’s funds cover another owner’s obligations. A duplicate receipt is corrected by a reversing entry, and its resident, property and owner subledger postings trace together to that reversal. Its exact terms are in [docs/contract/terms/accounting.md](docs/contract/terms/accounting.md#acct-001--maintain-a-balanced-property-ledger).

**Acceptance.**
1. Post rent, deposit, vendor expense and owner contribution across two properties, attempt an unbalanced entry and inspect the trial balance and each subledger back to source.
2. Post a receipt twice, reverse the duplicate and trace its resident, property and owner ledger entries to the reversal with the original entry left in place.

**Evidence.** `tests/journal.mjs`; `tests/terrace.test.mjs`; `tests/journal-browser.mjs`; `migrations/core/0056_journal.sql`; `src/terrace/journal.ts`
**Gap.** The owner-contribution entry is posted but never read back; the rent, deposit and vendor-expense postings, the refused unbalanced entry, the trial balance, the subledger traces and the duplicate reversal are asserted.

#### ACCT-002 — Separate operating trust and deposit accounts

Core · target · **partial** · Rules D-3

**Requirement.** Map legal entities and properties to authorized operating, rent-trust and deposit bank accounts. Enforce designated-fund separation, beneficiary balances, allowed transfers and reserves, with human approval and bank references for any transfer. Every outbound ACH file or provider batch (ACCT-018) and every check run (ACCT-017) draws on exactly one bank account. Trace commingling exceptions before money can move. Designated operating, trust and deposit accounts stay separate, and a recorded transfer moves only between accounts for the same beneficiary, property and purpose, against an explicit dated reserve and a current independent approval; recorded external facts neither move money at the bank nor verify statement balances. Its exact terms are in [docs/contract/terms/accounting.md](docs/contract/terms/accounting.md#acct-002--separate-operating-trust-and-deposit-accounts).

**Acceptance.**
1. Receive rent and deposits into distinct accounts, attempt an owner payout from deposit funds and an inter-owner transfer, and verify blocked execution and separately reconciled beneficiary balances.

**Evidence.** `tests/trust.mjs`; `tests/terrace.test.mjs`; `tests/trust-browser.mjs`; `migrations/core/0059_trust_accounts.sql`; `src/terrace/trust.ts`; `docs/trust-accounts.md`
**Gap.** No bank money movement or statement verification is claimed.

#### ACCT-003 — Receive hold and accrue security deposits

Core · target · **missing** · Register R-7

**Requirement.** Track deposit obligations, collections, permitted installment plans, bank custody, per-resident ownership, deposit caps, separate-account and receipt rules and applicable interest from the property's PORT-008 state and local pack. Give required receipts and records; deposits remain liabilities rather than rent income and owner transfers preserve custody obligations. Where the management agreement and the pack allow it, a deposit can be recorded as owner-held: Terrace tracks the liability, receipt, holder, any pack-required disclosure and the disposition deadline with no manager bank custody, and the ACCT-004 disposition directs the owner to refund the balance or records the owner funding the refund through the manager.

**Acceptance.**
1. Collect a deposit in installments, accrue reviewed interest and transfer ownership; inspect bank, beneficiary and tenant balances and receipts without recognizing rent revenue.
2. Record a second deposit as owner-held and show its liability and deadline tracked with no balance in the manager's deposit account, then complete its disposition with the owner's refund recorded.
3. PORT-005 applies before this ships: deposit obligations and amendments retain the signed version, effective dates and source clauses.
4. REPORT-007 applies before this ships: deposit actuals replace explicitly labeled held/receipt/refund assumptions without mixing liabilities with operating cash.

**Evidence.** None.
**Gap.** Security-deposit liabilities, custody, receipts and interest rules are absent.

#### ACCT-004 — Complete deposit disposition and refunds

Core · target · **missing** · Register R-7

**Requirement.** At move-out, compare entry/exit condition and unpaid obligations, prepare evidenced itemized deductions and a balance refund, and track the PORT-008 pack's deadline and required delivery method. The disposition goes out through PORTAL-009 mail, certified mail or recorded service (or electronic delivery only where the pack allows it), and the refund pays by ACH (ACCT-018) or by check to the forwarding address (ACCT-017). Managers approve deductions and money movement separately; disputes retain original evidence and unresolved liability.

**Acceptance.**
1. Prepare a move-out with damage and normal wear, approve only supported deductions, deliver the disposition and execute the approved refund; verify deadline, proof and remaining deposit liability.
2. In a Florida property send the claim notice by certified mail and show the 30-day deadline met against the mailing date, then refund the balance by printed check to the forwarding address.

**Evidence.** None.
**Gap.** Deposit dispositions, deadlines, deductions and refunds are absent.

#### ACCT-005 — Connect Plaid bank feeds

Core · target · **missing**

**Requirement.** Connect US bank accounts through Plaid-authorized consent, map each feed to the correct books, import stable transactions and surface pending-to-posted changes, missing periods and reauthorization. No bank password lives in Terrace; manual statement import remains a first-class documented input.

**Acceptance.**
1. Connect two bank accounts through the provider boundary, import duplicate and pending-to-posted lines, expire consent and reconnect; verify no duplicate bank transaction and a visible freshness gap.

**Evidence.** None.
**Gap.** Plaid bank feeds and consent/freshness management are absent.

#### ACCT-006 — Match statements and perform three-way reconciliation

Core · target · **done**

**Requirement.** Import bank CSV, OFX/QFX and statement PDFs with reviewed extracted lines, match settlements and ledger entries, match cleared checks by number and amount (ACCT-017), match transmitted ACH files and entries by trace number, batch total or entry amount (ACCT-018), record outstanding checks/deposits and prove bank balance equals adjusted book balance and beneficiary subledger totals. Unmatched amounts block a clean close. Its exact terms are in [docs/contract/terms/accounting.md](docs/contract/terms/accounting.md#acct-006--match-statements-and-perform-three-way-reconciliation).

**Acceptance.**
1. Reconcile a month with batched rent, fee, outstanding check, a cleared owner ACH batch and missing deposit; resolve one exception and show the remaining difference prevents a balanced three-way sign-off.

**Evidence.** `tests/reconcile.mjs`; `tests/reconcile-browser.mjs`; `docs/bank-reconciliation.md`
**Gap.** None.

#### ACCT-007 — Capture and approve vendor bills

Core · target · **done** · Rules D-3

**Requirement.** Capture PDF/image/email invoices, supplier, invoice number, date, coding, line items, tax and attachments. Check duplicates, allocate shared costs to properties/owners and require approval against work, budgets and management authority before payment. Recurring payables (owner mortgages, HOA dues, insurance premiums, utilities) are set up once with payee, amount, schedule, end date and property/owner allocation; each period generates one bill under the same approval rules, and a changed template amount or payee needs new approval. A residential owner’s HOA dues are such a recurring payable, with the association as payee, never association dues or association accounting (BOUND-004). Its exact terms are in [docs/contract/terms/accounting.md](docs/contract/terms/accounting.md#acct-007--capture-and-approve-vendor-bills).

**Acceptance.**
1. Upload the same invoice twice, split an approved landscaping bill across properties, exceed an owner’s limit and inspect the held bill, approval route and resulting payable.
2. Set up a monthly HOA-dues recurring bill for a residential owner, generate two months and replay the run, and show exactly one bill per month, each posted as a payable to the association and not as association dues (BOUND-004).
3. PORT-003 applies before this ships: each approved bill on a property is allocated to its owners by the share set in force on the bill date, so an expense before a transfer stays with the seller.

**Evidence.** `migrations/core/0041_bills.sql`; `src/terrace/bills.ts`; `src/terrace/bills-input.ts`; `src/terrace/bills-authority.ts`; `src/terrace/bills-templates.ts`; `src/terrace/bills-attachments.ts`; `src/terrace/bills-retention.ts`; `src/terrace/bills-view.ts`; `src/terrace/owners.ts`; `tests/bills.mjs`; `tests/terrace.test.mjs`
**Gap.** None.

#### ACCT-008 — Pay vendors and reconcile payment outcomes

Core · target · **missing** · Rules D-3, D-4

**Requirement.** Prepare vendor ACH payments executed through ACCT-018 (a NACHA file per paying bank account at the manager’s bank, or the Modern Treasury payment-order API), or checks that Terrace prints or sends through Lob (ACCT-017), validate verified payees and available owner funds, and execute only human-approved batches. Track sent, settled, failed, returned and voided results with bank/check references and cleared payables. ROLE-001 applies before this ships: only the owner and roles the capability table grants payment preparation reach these doors, within their portfolios; leasing staff, maintenance coordinators, accountants and members are refused (403).

**Acceptance.**
1. Approve a vendor batch, change one bank destination and hold it, execute the unchanged items in the paying account’s ACCT-018 NACHA file and import an R01 return from the bank’s return file; show one payment per bill, a remittance notice per vendor and the reopened returned payable.
2. Pay a check-only vendor in the same batch by printed check and show its register entry.
3. Leasing staff attempting this payout are refused (403), and a bookkeeper outside the paying property’s portfolios gets 404.
4. ROLE-003 applies before this ships: the person who prepared a vendor payment never approves it (a sole operator’s approval is labeled “self-approved: no second person”), and a changed amount or payee after approval needs a new approval of the exact inputs before execution.

**Evidence.** None.
**Gap.** Vendor payment rails, payee controls and reconciliation are absent.

#### ACCT-009 — Calculate management fees and owner reserves

Core · target · **done**

**Requirement.** Configure effective management fees, leasing/renewal fees, minimums, markups, tax treatment and reserve floors by agreement. Show each calculation’s source, prevent charging twice and respect available owner cash before distributions; overrides need explicit authority. Its exact terms are in [docs/contract/terms/accounting.md](docs/contract/terms/accounting.md#acct-009--calculate-management-fees-and-owner-reserves).

**Acceptance.**
1. Post rent and a lease renewal under a dated fee schedule, calculate fees/reserve, replay the run and inspect the owner statement with the exact agreement references.

**Evidence.** `migrations/core/0037_fees.sql`; `src/terrace/fees.ts`; `src/terrace/owners.ts`; `src/terrace/owner-view.ts`; `src/terrace/api.ts`; `tests/terrace.test.mjs`
**Gap.** None.

#### ACCT-010 — Disburse owner funds by ACH or check

Core · target · **missing** · Rules D-3, D-4

**Requirement.** Prepare distributions from cleared beneficiary cash less reserves, unpaid obligations and approved fees; handle ownership shares and contributions. Owners choose ACH, executed through ACCT-018 (a NACHA file per trust bank account, or the Modern Treasury payment-order API), or check (printed or mailed through ACCT-017); each owner receives a remittance notice with the distribution statement. A human approves exact bank destination or check payee/address and amount before execution; pending receipts never fund an owner payout. Reconcile returns and replacements without duplicate distributions. ROLE-001 applies before this ships: only the owner and roles the capability table grants payment preparation reach these doors, within their portfolios; leasing staff, maintenance coordinators, accountants and members are refused (403).

**Acceptance.**
1. Prepare a joint-owner distribution with a pending ACH receipt and unpaid repair, approve cleared funds only, execute it in the trust account’s ACCT-018 NACHA file and import an R01 return for one share from the bank’s return file; show corrected cash and one replacement requiring new approval.
2. Leasing staff attempting this payout are refused (403), and a bookkeeper outside the paying property’s portfolios gets 404.
3. ROLE-003 applies before this ships: the person who prepared a owner distribution never approves it (a sole operator’s approval is labeled “self-approved: no second person”), and a changed amount or payee after approval needs a new approval of the exact inputs before execution.
4. REPORT-007 applies before this ships: actual distributions and returns source its forecasts without treating a planned payout as executed.

**Evidence.** None.
**Gap.** Owner distributions, ACH/check execution and return accounting are absent.

#### ACCT-011 — Close periods without rewriting history

Core · target · **done** · Rules D-4

**Requirement.** Use month-end checklists, reconciliation sign-offs, exception queues and locked accounting periods. Authorized accountants propose adjustments; reopening a period requires owner/bookkeeper authority, a reason and a new close version, with affected statements marked superseded. ROLE-001 applies before this ships: accountants propose close corrections as prepared proposals that an authorized bookkeeper or manager approves; accountants post nothing. Its exact terms are in [docs/contract/terms/accounting.md](docs/contract/terms/accounting.md#acct-011--close-periods-without-rewriting-history).

**Acceptance.**
1. Close a reconciled month, attempt a backdated posting, approve a period reopening and adjustment, then compare old/new statements with the reopening reason and unchanged original entries.
2. An accountant’s close correction stays a proposal until an authorized person approves it.
3. SAFE-002 applies before this ships: each close, lock and controlled reopening is a history row with its approver and reason.

**Evidence.** `migrations/core/0036_periods.sql`; `src/terrace/periods.ts`; `src/terrace/periods-view.ts`; `src/terrace/core.ts`; `src/terrace/api.ts`; `tests/terrace.test.mjs`
**Gap.** None.

#### ACCT-012 — Publish complete owner statements

Core · target · **partial**

**Requirement.** Produce owner/property statements showing opening cash, income, expenses, management fees, deposits separately, reserves, contributions, distributions, liabilities and closing cash. Drill to bills, settlement and bank reconciliation; publish corrected versions explicitly and deliver on schedule. Each statement itemizes the management fee, repairs and other expenses, reserve movement and net to owner, and is delivered with its source receipts and bills attached. An owner reads an exact approved invoice original only while its whole historical allocation belongs to that owner; an original that would disclose another beneficiary is withheld until an audience-safe release exists, without withholding the owner’s own ledger facts, and an approval change or revoked grant ends that access at once.

**Acceptance.**
1. Publish a monthly owner statement with rent, a paid bill and distribution, reconcile its closing cash to books/bank and download the source invoice from the owner portal.
2. Confirm the delivered statement shows the management fee, a repair, other expenses, the reserve and net to owner, and carries the receipt and invoice attachments for its lines.
3. PORT-003 applies before this ships: income, expenses, fees and reserve shares on each side of a dated ownership transfer appear on the seller’s and the buyer’s statements respectively.
4. REPORT-007 applies before this ships: statement actuals source its rent, payable, fee, reserve and distribution comparisons, keeping forecasts distinct.

**Evidence.** `tests/statements.mjs`; `tests/terrace.test.mjs`; `tests/statements-browser.mjs`
**Gap.** Complete paid-bill and distribution sources, corrected immutable publication, scheduled delivery, receipt and invoice bundles, bank tie-out and REPORT-007 actuals remain unproved. Joint-owner originals are held. No new payment, send, bank-change or approval authority.

#### ACCT-013 — Report cash and accrual financials

Core · target · **done**

**Requirement.** Offer cash- and accrual-basis income statements, balance sheet, trial balance, general ledger, receivables and payables aging and cash flow by property, owner and entity. Every total drills to postings; changing basis never modifies the underlying ledger. Its exact terms are in [docs/contract/terms/accounting.md](docs/contract/terms/accounting.md#acct-013--report-cash-and-accrual-financials).

**Acceptance.**
1. Record earned unpaid rent and an unpaid bill, compare cash and accrual P&L and balance sheet, and drill each difference to its original transaction.

**Evidence.** `tests/financial-reports.mjs`; `tests/terrace.test.mjs`; `tests/financial-reports-browser.mjs`; `src/terrace/financial-reports.ts`; `docs/financial-reports.md`
**Gap.** None.

#### ACCT-014 — Prepare and file owner and vendor 1099s

Core · target · **missing**

**Requirement.** Collect restricted W-9/TIN information, validate payer/payee classifications and thresholds for the applicable tax year, reconcile reportable payments, including migrated year-to-date balance-forwards (MOVE-010) so a mid-year switch files one form per payee for the whole year, and support corrected forms. Integrate Nelco for human-reviewed 1099-MISC/NEC e-filing, recipient delivery and acceptance/rejection tracking; tax advice remains with the buyer’s accountant. The prior tax year’s payee set, reportable totals and exceptions are complete and ready for accountant review in the first week of January, before the year’s earliest filing deadline.

**Acceptance.**
1. Prepare owner/vendor forms from reconciled payments, correct an invalid TIN, approve a Nelco submission and process accepted/rejected/corrected outcomes without duplicate filings.
2. On the first business day of January show the prior year’s owner and vendor 1099 data complete, reconciled to payments, with exceptions listed.

**Evidence.** None.
**Gap.** W-9, reportable payment calculation, Nelco filing and correction workflows are absent.

#### ACCT-015 — Sync QuickBooks Online without losing trust truth

Core · target · **missing**

**Requirement.** Connect QuickBooks Online via authorized OAuth, map accounts, tax codes and entities and sync approved journals/bills/payments with stable identities and conflict reports. Terrace retains residential beneficiary/deposit detail; an aggregate accounting export never counts as subledger reconciliation.

**Acceptance.**
1. Sync a property close to a QuickBooks sandbox, replay it, change an account mapping and reconcile resulting totals and a visible conflict back to Terrace’s owner/deposit subledgers.

**Evidence.** None.
**Gap.** QuickBooks Online mapping and reconciled sync are absent.

#### ACCT-016 — Account for utility recoveries and ancillary income

Core · target · **done**

**Requirement.** Allocate actual utility bills, RUBS/submeter readings and lease-authorized reimbursements with reviewed formulas, caps and source invoices; handle sales/use tax where applicable through configured accountant-reviewed rules. Include parking, storage and other permitted charges in resident and owner books. Its exact terms are in [docs/contract/terms/accounting.md](docs/contract/terms/accounting.md#acct-016--account-for-utility-recoveries-and-ancillary-income).

**Acceptance.**
1. Allocate one water invoice by a reviewed occupancy formula, post parking and taxable ancillary charges and verify source-linked tenant allocations equal the approved recoverable total.

**Evidence.** `migrations/core/0038_recoveries.sql`; `src/terrace/recoveries.ts`; `src/terrace/tax.ts`; `src/terrace/recovery-view.ts`; `src/terrace/charge-run.ts`; `src/terrace/api.ts`; `tests/terrace.test.mjs`
**Gap.** None.

#### ACCT-017 — Print mail and register trust checks

Core · target · **missing** · Rules D-3, D-4

**Requirement.** Print MICR checks on blank check stock from the paying operating, trust or deposit bank account (routing, account and check number in E-13B MICR), or send them through Lob’s check print-and-mail service with tracking, for vendor bills, owner distributions and deposit or credit refunds. Each bank account keeps an unbroken check-number register in which every number is issued, voided or spoiled, never skipped or reused, and a duplicate number is refused. A void reverses the payment and reopens the payable or refund; a reissue needs new approval and a new number. Checks outstanding past the owner-set stale date (default 180 days) create a follow-up and, if unclaimed, an unclaimed-property review. Positive-pay issue files export in the bank’s format with acknowledgments recorded, and cleared checks match from the bank feed (ACCT-006).

**Acceptance.**
1. Print a deposit-refund check from the deposit bank account and a vendor check batch from the operating trust account, void and reissue one check with new approval, refuse a duplicate check number and export positive-pay for the batch; clear one check against the bank feed and leave one outstanding past its stale date with a follow-up.

**Evidence.** None.
**Gap.** MICR check printing, Lob check mailing, check-number register, void/reissue, stale checks and positive pay are absent.

#### ACCT-018 — Originate trust ACH payments through NACHA files

Core · target · **missing** · Rules D-3, D-4

**Requirement.** Terrace executes approved owner distributions (ACCT-010), vendor payments (ACCT-008) and ACH refunds (PAY-009, ACCT-004) over a named outbound rail chosen per bank account. ROLE-001 applies before this ships: only the owner and roles the capability table grants payment preparation reach these doors, within their portfolios; leasing staff, maintenance coordinators, accountants and members are refused (403). SAFE-001 applies before this ships: adding or changing a payee bank account or applying a notification of change needs the fresh email-link proof as well as ROLE-003’s independent verification. Its exact terms are in [docs/contract/terms/accounting.md](docs/contract/terms/accounting.md#acct-018--originate-trust-ach-payments-through-nacha-files).

**Acceptance.**
1. Approve a 90-owner distribution drawn on one trust account and a vendor batch drawn on a second trust account. Generate one NACHA file per account, pass both through a NACHA format validator (record lengths, blocking, batch and file control totals, entry hash), and match each entry's amount and destination to the approved batch exactly.
2. Regenerate both and get the same file IDs and trace numbers with no second batch.
3. Record the bank upload reference.
4. Send a prenote for a new vendor and hold its first live payment until the prenote window passes.
5. Import an R01 return on one owner's entry and a C01 NOC on another: the returned distribution reopens for new approval, the NOC's account change is held for independent verification, and the settled entries clear against imported bank-feed lines in the three-way reconciliation.
6. Pay one vendor through the Modern Treasury sandbox and process its return webhook once.
7. Leasing staff attempting this payout are refused (403), and a bookkeeper outside the paying property’s portfolios gets 404. A payee bank change without a fresh email-link proof is refused (403).
8. SAFE-002 applies before this ships: each generated file, upload reference and bank instruction is a history row with its approver.

**Evidence.** None.
**Gap.** NACHA file generation per bank account, upload references, Modern Treasury payment orders, prenotes, return and NOC import and payee remittance notices are absent.

### Resident owner and vendor service portals

#### PORTAL-001 — Give residents a complete account portal

Core · target · **missing** · Rules D-6

**Requirement.** Residents see current and future charges, settled/pending payments, deposits, lease documents, receipts and household obligations, can authorize/pay rent and update allowed contact preferences. Accessible responsive views keep private guarantor, screening and other household data protected. ROLE-001 applies before this ships: its staff screens and doors check the capability table and portfolio scope (out of scope 404, out of role 403). SAFE-001 applies before this ships: a staff change to a resident’s bank details needs the fresh email-link proof.

**Acceptance.**
1. Sign in as a resident with two leases, inspect an itemized balance, pay rent, download a receipt and update contact preferences; direct access to an unrelated household is denied.
2. A staff user outside the property’s portfolios gets 404, and one whose ROLE-001 role lacks the action gets 403, on this clause’s staff screens and doors.
3. A staff bank-detail change without a fresh email-link proof is refused (403).

**Evidence.** None.
**Gap.** Resident portal and self-service account workflows are absent.

#### PORTAL-002 — Give owners their financial and property portal

Core · target · **partial** · Rules D-6

**Requirement.** Owners see owned-property occupancy, rent, maintenance approvals, reserves, statements, source bills, distribution status and documents for authorized ownership periods. They can contribute funds, approve requested spend and communicate without gaining resident screening or other owners’ records. ROLE-001 applies before this ships: its staff screens and doors check the capability table and portfolio scope (out of scope 404, out of role 403). SAFE-001 applies before this ships: a staff change to an owner’s distribution bank details needs the fresh email-link proof. Owner portal access to invoice originals follows ACCT-012’s original-disclosure rule.

**Acceptance.**
1. Joint owners inspect different ownership periods, approve an over-limit repair, contribute funds and download a statement/invoice; access another owner’s report and screening file is denied.
2. A staff user outside the property’s portfolios gets 404, and one whose ROLE-001 role lacks the action gets 403, on this clause’s staff screens and doors.
3. A staff bank-detail change without a fresh email-link proof is refused (403).

**Evidence.** `tests/statements.mjs`; `tests/terrace.test.mjs`; `tests/statements-browser.mjs`
**Gap.** Occupancy and rent detail, complete distribution status and documents, owner contributions, communication, over-limit repair decisions with PORTAL-007 riders, joint-owner original disclosure and staff bank-change fresh-proof assertions remain unproved. No new payment, send, bank-change or approval authority.

#### PORTAL-003 — Give vendors a work and invoice portal

Core · target · **partial** · Rules D-6

**Requirement.** Vendors accept or decline assigned work, verify qualifications, propose appointments, submit estimates, completion photos and invoices and see their payment status. Access codes and resident contact details are limited to approved jobs and time windows. ROLE-001 applies before this ships: its staff screens and doors check the capability table and portfolio scope (out of scope 404, out of role 403). SAFE-001 applies before this ships: a staff change to a vendor’s bank details needs the fresh email-link proof. A current assigned, qualified vendor proposes availability and submits estimates and original invoices for staff review only, and confirms or cancels an existing staff-booked appointment; none of these books work, grants resident permission or entry, sends a notice, approves a payable or pays. Staff prepare and independently verify a vendor’s external bank reference, each with fresh proof; a replacement holds the earlier verification, and no full bank details reach a portal. Its exact terms are in [docs/contract/terms/portals.md](docs/contract/terms/portals.md#portal-003--give-vendors-a-work-and-invoice-portal).

**Acceptance.**
1. Invite a plumber to one job, accept an appointment, upload evidence and an invoice and read payment state; after reassignment revoke the access details and deny every other vendor job.
2. A staff user outside the property’s portfolios gets 404, and one whose ROLE-001 role lacks the action gets 403, on this clause’s staff screens and doors.
3. A staff bank-detail change without a fresh email-link proof is refused (403).

**Evidence.** `tests/portal.mjs`; `tests/documents-browser.mjs`; `tests/vendor-proposals-browser.mjs`
**Gap.** The remaining vendor portal actions are open. Vendor-origin completion originals integrated with WORK-007 and WORK-008; authorized access-detail disclosure and time-window enforcement; independent exact-SHA runtime acceptance outside the builder.

#### PORTAL-004 — Receive resident maintenance requests

Core · target · **done** · Cites BASE-INPUT-003

**Requirement.** Residents report unit issues with photos and video, category, access consent, pets, preferred times and urgency from web or mobile. Give a tracking number, safe acknowledgment and visible status; duplicate reports can be linked without losing each resident’s original concern. ROLE-001 applies before this ships: its staff screens and doors check the capability table and portfolio scope (out of scope 404, out of role 403). Its exact terms are in [docs/contract/terms/portals.md](docs/contract/terms/portals.md#portal-004--receive-resident-maintenance-requests).

**Acceptance.**
1. Submit a leaking-tap request with photo and access restrictions, add another household report and follow the tracking link through scheduled work and resident-confirmed resolution.
2. A staff user outside the property’s portfolios gets 404, and one whose ROLE-001 role lacks the action gets 403, on this clause’s staff screens and doors.
3. WORK-001 applies before this ships: a resident’s safety or emergency report opens the same WORK-001 case, shows the resident the approved guidance version and alerts on call as staff intake does.

**Evidence.** `tests/portal-requests.mjs`; `tests/portal.mjs`; `tests/terrace.test.mjs`; `tests/portal-requests-browser.mjs`
**Gap.** None.

#### PORTAL-005 — Deliver two-way email and SMS

Core · target · **partial** · Cites BASE-MAIL-001 · Rules D-5 · Register R-15

**Requirement.** Use Resend for authorized email and Twilio for SMS with verified sender setup, consent, opt-out and quiet-hours handling. Route replies to the right property/household/job, retain delivery/failure evidence and prevent duplicate messages; unsent drafts remain visibly unsent. Recipients without email or SMS consent, and notices whose pack requires mail, use PORTAL-009 postal delivery in the same thread. ROLE-001 applies before this ships: its staff screens and doors check the capability table and portfolio scope (out of scope 404, out of role 403). The installation owner and in-scope portfolio managers manage repair communications with fresh sign-in proof; each channel needs recorded channel consent, a person sends each approved message once, an inbound reply binds only to an authenticated recipient and the exact message it answers, and phone contact keeps the recipient’s own quiet hours and any STOP. Its exact terms are in [docs/contract/terms/portals.md](docs/contract/terms/portals.md#portal-005--deliver-two-way-email-and-sms).

**Acceptance.**
1. Approve a repair message, deliver email and SMS at provider boundaries, receive a reply and opt-out, replay callbacks and show failed delivery and suppressed future SMS in the shared thread.
2. A staff user outside the property’s portfolios gets 404, and one whose ROLE-001 role lacks the action gets 403, on this clause’s staff screens and doors.
3. SAFE-005 applies before this ships: its sent and received messages with their delivery records appear in the readable export and come back with a restore into a fresh installation.
4. DEMO-001 applies before this ships: its demo flow retains the effect guard and adds a public-door no-egress assertion; no real payment, message or webhook is sent from a demo.
5. WORK-001 applies before this ships: its SMS/voice door pages the on-call person and backup of an open emergency with timed automatic escalation, records each provider outcome without claiming a person was reached, and keeps the email alert.

**Evidence.** `tests/terrace.test.mjs`; `tests/messages.mjs`; `tests/demo.test.mjs`; `tests/messages-browser.mjs`
**Gap.** Real paging and timed escalation inherited from WORK-001 remain unproved; TEST request acceptance and signed webhook fixtures establish neither real delivery nor real inbound routing. Inbound email routing, postal fallback, real paging, timed escalation and real delivery and inbound-origin proof remain gaps; no existing implementation gap is closed.

#### PORTAL-006 — Keep shared threads and notices accountable

Core · target · **partial** · Cites BASE-MAIL-001 · Rules D-5

**Requirement.** Provide searchable staff/resident/owner/vendor conversations, assignments, internal notes, attachments, unread state and service deadlines. Bulk announcements scope recipients by property and retain each result; legal notices require exact human approval and named service evidence recorded through PORTAL-009 or the delivering provider. ROLE-001 applies before this ships: its staff screens and doors check the capability table and portfolio scope (out of scope 404, out of role 403). Search returns only threads and notices on tenancies in the searcher’s portfolios. Owners and in-scope portfolio managers act with fresh email-link proof; a required notice records its reviewed service authority, every recipient read, reply and publication rechecks current authority, and portal publication, recorded physical service, provider acceptance, delivery and legally sufficient service stay distinct.

**Acceptance.**
1. Assign a resident conversation, add a private note, broadcast a water shutoff to one building and inspect delivered/failed recipients; verify the resident cannot see the note or another building’s messages.
2. A staff user outside the property’s portfolios gets 404, and one whose ROLE-001 role lacks the action gets 403, on this clause’s staff screens and doors.
3. A search by a scoped staff user returns nothing from another portfolio.
4. SAFE-005 applies before this ships: its threads, notices and their service records appear in the readable export and come back with a restore into a fresh installation.

**Evidence.** `tests/terrace.test.mjs`; `tests/portal-threads.mjs`; `tests/portal-threads-browser.mjs`
**Gap.** Provider-verified broadcast delivery, uncertain-send reconciliation and exhaustive ownership and assignment boundaries remain unfinished. Service of legal notices waits on PORTAL-009.

#### PORTAL-007 — Track requests documents and approvals to completion

Core · target · **partial**

**Requirement.** Owners and residents sign, upload requested documents, acknowledge permitted notices and approve quotes through scoped expiring links. Staff see missing items, reminders, expiry and who completed each action; an opened email never substitutes for approval or signature. ROLE-001 applies before this ships: its staff screens and doors check the capability table and portfolio scope (out of scope 404, out of role 403). The installation owner and in-scope portfolio managers prepare, send, replace, expire, remind and validate requests with fresh email-link proof; a request grants no access, and each action rechecks the named recipient’s live rights, household dates and ownership dates.

**Acceptance.**
1. Request insurance evidence and owner quote approval, expire one link and complete a replacement; show reminders stop only after validated completion and the exact signer and approver is recorded.
2. A staff user outside the property’s portfolios gets 404, and one whose ROLE-001 role lacks the action gets 403, on this clause’s staff screens and doors.

**Evidence.** `tests/terrace.test.mjs`; `tests/action-requests.mjs`; `tests/action-requests-browser.mjs`
**Gap.** Assertions of the approved request policy remain unproved. Qualification map: PORTAL-007 entry 7 and ROLE-001 entry 11, ROLE-002 entry 12, PORT-004 entry 4, PORT-001 entry 1 require before, on and after household and property-local ownership dates (including UTC and local-day disagreement) and refusal after authority changes; SAFE-001 entry 1 and ROLE-001 entry 11 require stale-proof refusal for every command, prohibited roles and credentials, and authority changes between review and mutation; SAFE-002 entry 2 and PORT-007 entry 7 require durable affirmative-consent wording or version and refusal of substituted document bytes; WORK-003 entry 3, ROLE-003 entry 13 and future PORTAL-002 entry 2 require visible decline, stopped reminders, changed-term decisions and preserved spend and independence controls; ROLE-002 entry 12 requires actual seven-day expiry, replacement refusal on reads and submissions, missing-item history and expiry distinct from cancellation; future PORTAL-005 entry 5 and PORTAL-006 entry 6 require send uncertainty and claim-interruption refusal, side-effect-free opens and lost-response once-only completion; SAFE-004 entry 4 and SAFE-005 entry 5 require subject-scoped access, retention and holds, eligible evidence and original erasure and later-journal restore fences; SAFE-005 entry 5 and ROLE-002 entry 12 require original bytes, hashes and attribution in backup and readable export and inert restored open requests until fresh invitations and preparation. LEASE-011 entry 11 and PORTAL-009 entry 9 still require their own legal-execution and statutory-delivery journeys. Future PORTAL-001 entry 1, PORTAL-002 entry 2, PORTAL-003 entry 3 and PORTAL-008 entry 8 inherit applicable identity, scope, consent, revocation and custody duties. PORT-007 remains the separate document clause. No permanent withdrawal state is commissioned; any future such capability belongs to the next free PORTAL-011, initially missing in both documents.

#### PORTAL-008 — Support mobile and accessible everyday work

Core · target · **partial** · Cites BASE-ACCESSIBILITY-001, BASE-PUBLIC-003 · Register R-8, R-9, R-10

**Requirement.** Everyday journeys work at desktop and phone sizes with clear validation and safe resume after connectivity loss, at Base’s one accessibility bar. Native iOS/Android apps support resident payments/requests and staff field work with permissioned push notifications and device session revocation. ROLE-001 applies before this ships: its staff screens and doors check the capability table and portfolio scope (out of scope 404, out of role 403).

**Acceptance.**
1. Use 1440- and 390-pixel screens and assistive navigation to pay, submit a request and approve work; suspend/resume native sessions and revoke a lost device without exposing cached private data.
2. A staff user outside the property’s portfolios gets 404, and one whose ROLE-001 role lacks the action gets 403, on this clause’s staff screens and doors.

**Evidence.** `src/terrace/view.ts`; `src/terrace/work-view.ts`
**Gap.** Responsive web forms exist; full accessible mobile journeys, native apps and push/device controls are absent.

#### PORTAL-009 — Print mail and record service of notices

Core · target · **missing** · Rules D-5 · Register R-7

**Requirement.** Merge approved letters and notices (pay-or-quit, lease violation, entry, nonrenewal, deposit disposition, owner letters) into a batch PDF for office printing, or send them through Lob with first-class, certified and certified return-receipt options. Retain the exact approved PDF, provider IDs, USPS tracking numbers and delivery events (mailed, in transit, delivered, returned). Staff record physical service (posted on the door, hand-delivered, mailed by the office with a certified tracking number) with server, date and time, method and photo. Deadlines from the PORT-008 pack run from the recorded service or mailing date, including any mailing extension the pack declares; a draft or a printed page never counts as service. ROLE-001 applies before this ships: its staff screens and doors check the capability table and portfolio scope (out of scope 404, out of role 403). Its exact terms are in [docs/contract/terms/portals.md](docs/contract/terms/portals.md#portal-009--print-mail-and-record-service-of-notices).

**Acceptance.**
1. Approve a Florida deposit-claim notice and send it certified through the Lob test boundary, or record a certified tracking number for office mail; show the 30-day deadline met against the mailing date and a late mailing flagged as missed; serve a pay-or-quit notice by posting with recorded photo and server; return one mailed letter as undeliverable and see a follow-up.
2. A staff user outside the property’s portfolios gets 404, and one whose ROLE-001 role lacks the action gets 403, on this clause’s staff screens and doors.
3. SAFE-002 applies before this ships: each notice merged, mailed and recorded as served is a history row with its source.

**Evidence.** None.
**Gap.** Batch letter PDFs, Lob first-class/certified mail, tracking and recorded physical service are absent.

#### PORTAL-010 — Tell owners what was fixed, at what cost, with photos

Core · target · **missing** · Rules D-5

**Requirement.** When a repair on an owner’s property is confirmed complete by the resident, or closed by authorized staff with a recorded reason (WORK-008), the owner for that ownership period receives a notice by email and in the owner portal naming the unit and the repair, the final matched cost (WORK-009) and the actual completion photos, and pointing to the statement period in which the cost appears (ACCT-012). A job that is only vendor-closed, or whose resident has reported it unresolved, produces no “fixed” notice; owners of other properties and prior ownership periods receive nothing; a replay never sends a second notice and a failed delivery creates a follow-up. ROLE-001 applies before this ships: its staff screens and doors check the capability table and portfolio scope (out of scope 404, out of role 403).

**Acceptance.**
1. Complete a repair as a vendor and have the resident report it still leaking: no owner notice is sent.
2. After a return visit and resident confirmation, show one owner email and portal notice with the matched cost and two completion photos, find the same job and cost on that month’s owner statement, replay the event for no second notice, bounce the email for a follow-up, and show a second owner and a former owner of the property receive nothing.
3. A staff user outside the property’s portfolios gets 404, and one whose ROLE-001 role lacks the action gets 403, on this clause’s staff screens and doors.

**Evidence.** None.
**Gap.** Owner completion notices are absent; no owner portal, repair completion or invoiced cost exists to notify from.

### Maintenance from request to reconciled bill

#### WORK-001 — Triage safety and emergency requests

Core · target · **partial** · Rules D-5 · Register R-11

**Requirement.** Classify intake by property, asset, habitability risk and emergency policy, give approved safe guidance and alert the human on-call service with acknowledged escalation. Tell residents when to call 911 or utilities for immediate danger; an emergency is never diagnosed or closed by inference. Timed automatic escalation runs only from a finite plan that the owner or an in-scope portfolio manager approves for one open emergency, with fresh proof; it stops on a named person’s acknowledgement, resolution, cancellation or expiry, and urgency gives no consent or quiet-hours exemption. Its exact terms are in [docs/contract/terms/maintenance.md](docs/contract/terms/maintenance.md#work-001--triage-safety-and-emergency-requests).

**Acceptance.**
1. Submit a gas-smell request outside office hours, show approved emergency guidance and escalate to an acknowledged human; an unanswered alert remains urgent and open.
2. REPORT-004 applies before this ships: the service report counts open emergencies and their age until a human acknowledges and resolves them.

**Evidence.** `tests/emergencies.mjs`; `tests/portal-requests.mjs`; `tests/messages.mjs`; `tests/messages-browser.mjs`
**Gap.** Real paging and timed automatic escalation remain gaps. Real SMS and voice paging with timed automatic escalation remains unproved. Twilio TEST accepts requests without a real call, handset delivery or provider-origin callbacks. Timed automatic escalation remains required and unproved. All existing implementation and provider gaps remain.

#### WORK-002 — Maintain property asset and warranty history

Core · target · **done**

**Requirement.** Track installed equipment, model/serial, location, service history, warranties, manuals and replacement plans. Link requests and costs to assets, flag warranty coverage and keep old assets after replacement for historical cost and failure analysis. Its exact terms are in [docs/contract/terms/maintenance.md](docs/contract/terms/maintenance.md#work-002--maintain-property-asset-and-warranty-history).

**Acceptance.**
1. Add an HVAC asset and warranty, open a repair, replace the asset and inspect both service histories with warranty and owner-cost attribution.

**Evidence.** `migrations/core/0019_assets.sql`; `src/terrace/assets.ts`; `src/terrace/asset-view.ts`; `src/terrace/work.ts`; `tests/terrace.test.mjs`
**Gap.** None.

#### WORK-003 — Estimate work and obtain owner approval

Core · target · **done** · Rules D-3

**Requirement.** Collect comparable vendor quotes, scope, availability, tax and proposed spend against owner limits and property budgets. A manager approves within authority; over-limit work needs the owner’s exact approval. Scope, vendor or price changes reopen authorization. Its exact terms are in [docs/contract/terms/maintenance.md](docs/contract/terms/maintenance.md#work-003--estimate-work-and-obtain-owner-approval).

**Acceptance.**
1. Compare two repair quotes, request an owner decision above the spending limit, then change the approved scope and verify dispatch remains blocked until the new terms are approved.

**Evidence.** `migrations/core/0028_quotes.sql`; `src/terrace/quotes.ts`; `src/terrace/quote-view.ts`; `src/terrace/work.ts`; `tests/terrace.test.mjs`
**Gap.** None.

#### WORK-004 — Qualify and assign vendors

Core · target · **done**

**Requirement.** Maintain vendor specialties, service areas, W-9 status, insurance/license expirations, availability, rates and preferred/blocked status. Assign only qualified vendors for the job and expose qualification exceptions to authorized staff. Its exact terms are in [docs/contract/terms/maintenance.md](docs/contract/terms/maintenance.md#work-004--qualify-and-assign-vendors).

**Acceptance.**
1. Select a plumber by area and insurance status, expire their coverage and attempt reassignment; verify qualification hold and a documented human exception rather than silent dispatch.

**Evidence.** `migrations/core/0020_vendors.sql`; `src/terrace/vendors.ts`; `src/terrace/vendor-view.ts`; `src/terrace/work.ts`; `tests/terrace.test.mjs`
**Gap.** None.

#### WORK-005 — Book appointments and resident access

Core · target · **partial** · Register R-12

**Requirement.** Coordinate vendor availability with resident permission, entry notice, keys/access windows and staff calendars. Confirm both parties, handle cancellations/no-shows, timezones and reassignment, and record the next appointment instead of treating a due date as a booking. The resident receives an arrival-window message by SMS or email with a simple reply (for example Y) that confirms the visit, and the reply is routed to the appointment. A signed reply confirms the resident’s side only when PORTAL-005 authenticates it and binds it to one unambiguous current arrival invitation for the exact appointment and approved work, after the vendor’s own confirmation; any other reply goes to staff review and grants no permission, notice or entry. Its exact terms are in [docs/contract/terms/maintenance.md](docs/contract/terms/maintenance.md#work-005--book-appointments-and-resident-access).

**Acceptance.**
1. Book a repair, receive resident confirmation, cancel from the vendor portal and reschedule with a new permitted access window; notify both parties and preserve appointment history.
2. Send an arrival-window text, reply Y and show the appointment confirmed by that reply; an unanswered window stays unconfirmed.
3. REPORT-004 applies before this ships: the service report shows booking time from preparation to the first confirmed appointment.

**Evidence.** `tests/appointments.mjs`; `tests/portal.mjs`; `tests/messages.mjs`; `tests/messages-browser.mjs`
**Gap.** Resident permission and confirmation remain separate, and resident messaging, Y-reply routing and notifications remain open. Actual arrival-text delivery and resident-origin reply remain unproved under TEST-only authorization; signed fixtures prove native routing only. Notifications require separate exact-content human approval; no automatic notification is authorized. Actual delivery, resident-origin reply proof, separately approved notifications and independent runtime and browser evidence remain gaps.

#### WORK-006 — Dispatch and track technician progress

Core · target · **done** · Rules D-5

**Requirement.** Deliver approved work orders to vendors or in-house technicians with task checklist, scope, authorized spend, permitted contacts and due/appointment times. Capture acceptance, en route, started, blocked, parts needed and completion states, with human escalation for missed service commitments. Its exact terms are in [docs/contract/terms/maintenance.md](docs/contract/terms/maintenance.md#work-006--dispatch-and-track-technician-progress).

**Acceptance.**
1. Dispatch an approved order, receive vendor acceptance and a parts hold, miss its appointment and reassign it; inspect notifications, state history and a still-open resident issue.

**Evidence.** `migrations/core/0049_dispatch.sql`; `src/terrace/dispatch.ts`; `src/terrace/dispatch-mail.ts`; `src/terrace/dispatch-view.ts`; `tests/dispatch.mjs`; `tests/dispatch-browser.mjs`; `tests/terrace.test.mjs`
**Gap.** None.

#### WORK-007 — Capture field labor materials and completion evidence

Core · target · **partial**

**Requirement.** Technicians record labor/time, parts, notes, before/after photos and video, resident access outcome and checklist completion on mobile. Support offline capture with conflict review and original evidence provenance; a closed vendor status alone cannot prove repair. Current owners and portfolio managers capture their own field evidence without any new vendor grant; a private-device draft needs consent and is discarded on revocation or restore, a scope change voids the approval and needs fresh approval and handoff, and reconciliation against the current scope is manual and audited. Its exact terms are in [docs/contract/terms/maintenance.md](docs/contract/terms/maintenance.md#work-007--capture-field-labor-materials-and-completion-evidence).

**Acceptance.**
1. Lose connectivity during work, capture time and photos, reconnect with a conflicting scope change and reconcile the conflict before submitting complete evidence for review.

**Evidence.** `tests/field-capture.test.mjs`; `tests/technician-capture.mjs`; `tests/technician-capture-browser.mjs`; `tests/field-evidence.mjs`; `tests/field-evidence-browser.mjs`; `src/terrace/field-evidence.ts`; `src/terrace/completions.ts`; `migrations/core/0072_field_scope.sql`
**Gap.** Direct authenticated operator capture now includes labor, materials, notes, access, current approved tasks and before/after original photos and video, with once-only submission, offline drafts and manual scope reconciliation. Existing sourced staff evidence remains available. Resident resolution stays a separate check.

#### WORK-008 — Verify repair with the resident

Core · target · **done**

**Requirement.** Ask the resident whether the original issue is resolved after evidence submission, distinguish no response from confirmation and reopen recurring or incomplete work. Track warranty callbacks, satisfaction and unresolved safety concerns; only authorized staff can close without resident confirmation with a recorded reason. Its exact terms are in [docs/contract/terms/maintenance.md](docs/contract/terms/maintenance.md#work-008--verify-repair-with-the-resident).

**Acceptance.**
1. Vendor submits completion, resident reports the tap still leaks and the job reopens; after a return visit obtain confirmation and retain both attempts and the final resolution.

**Evidence.** `migrations/core/0029_completion_checks.sql`; `src/terrace/completions.ts`; `src/terrace/completion-view.ts`; `tests/terrace.test.mjs`
**Gap.** None.

#### WORK-009 — Match invoice work and owner charge

Core · target · **missing**

**Requirement.** Extract invoice lines with source locations, match vendor, approved estimate, labor and materials, completion and duplicate history, then propose an owner/property allocation. Differences, unapproved extras and incomplete work hold the bill; human approval posts it and links the later settlement.

**Acceptance.**
1. Submit a completed repair invoice exceeding its quote, flag the unmatched line, approve a corrected invoice and trace work, payable, payment and owner statement without double entry.
2. REPORT-004 applies before this ships: the service report’s asset cost and budget variance use the matched invoice amount once a job’s invoice is approved, labeled as invoiced.

**Evidence.** `src/terrace/bills.ts`; `src/terrace/bills-input.ts`; `src/terrace/bills-authority.ts`; `src/terrace/owners.ts`; `tests/bills.mjs`; `tests/terrace.test.mjs`
**Gap.** Staff-entered bills match supplier, approved work and cumulative estimate, hold excess spend, and post approved owner allocations. Invoice extraction and source locations, labor and material and completion matching, settlement linkage and invoiced maintenance-report costs are absent. It cannot advance until ACCT-008 and ACCT-012 ship.

#### WORK-010 — Schedule preventive and recurring maintenance

Core · target · **done**

**Requirement.** Generate dated work from asset intervals, seasonal tasks and inspection findings, with budgets, owner permissions, vendor schedules and recurrence history. Track missed occurrences and equipment changes without creating duplicate work orders on scheduler replay. Its exact terms are in [docs/contract/terms/maintenance.md](docs/contract/terms/maintenance.md#work-010--schedule-preventive-and-recurring-maintenance).

**Acceptance.**
1. Schedule annual HVAC service and quarterly safety work, replay a scheduler run, defer one occurrence and replace an asset; inspect exactly one order per due occurrence and an explicit overdue exception.

**Evidence.** `migrations/core/0021_schedules.sql`; `src/terrace/schedules.ts`; `src/terrace/schedule-view.ts`; `src/terrace/job-writes.ts`; `tests/terrace.test.mjs`
**Gap.** None.

#### WORK-011 — Complete mobile move-in and move-out inspections

Core · target · **partial**

**Requirement.** Use configurable room/asset checklists, dated original photos and video, notes, readings and resident acknowledgment. Compare entry and exit condition side by side, retain disagreements and propose evidenced work or deposit deductions for a person to approve. Owners and portfolio managers in scope write inspections; consented private-device drafts are discarded on revocation or restore, staff-sourced acknowledgements are labelled as such and are never a resident signature, disputes are immutable and resolutions attributable, and an inspection decision itself moves no money, creates no work and sends nothing. Its exact terms are in [docs/contract/terms/maintenance.md](docs/contract/terms/maintenance.md#work-011--complete-mobile-move-in-and-move-out-inspections).

**Acceptance.**
1. Inspect on a phone offline, sync photos, compare move-out damage to the entry record and reject an unsupported deduction while retaining the resident’s disputed finding.

**Evidence.** `tests/field-capture.test.mjs`; `tests/mobile-inspections.mjs`; `tests/mobile-inspections-browser.mjs`; `src/terrace/field-evidence-inspections.ts`; `migrations/core/0071_mobile_inspections.sql`
**Gap.** Structured room/asset checklists, original media, readings, sourced acknowledgement/disputes, completed inspections, entry/exit comparison and evidence-gated human work/deduction proposals ship.

#### WORK-012 — Integrate HappyCo inspection evidence

Core · target · **missing**

**Requirement.** Connect authorized HappyCo accounts, map properties/units and import inspection findings, media, timestamps and author identity through supported interfaces or reviewed provider exports. Preserve source IDs and compare versions; a vendor closed status does not overwrite resident resolution.

**Acceptance.**
1. Bring a HappyCo inspection into the correct unit, replay it and update one finding, then create approved repair work with original media/provenance and a visible unmapped-unit exception.

**Evidence.** None.
**Gap.** HappyCo adapter and provider inspection reconciliation are absent.

#### WORK-013 — Run make-ready and turnover boards

Core · target · **done**

**Requirement.** From notice/vacancy create dependent inspection, deposit, cleaning, repair, utility and listing tasks with owners, durations, quotes and target ready date. Show blockers and vacancy-day impact; a unit becomes ready only after authorized completion checks, not merely after task submission. Its exact terms are in [docs/contract/terms/maintenance.md](docs/contract/terms/maintenance.md#work-013--run-make-ready-and-turnover-boards).

**Acceptance.**
1. Move out a resident, delay a repair dependent on inspection, revise the ready date and show cleaning/listing effects; complete checks and publish the true available date.

**Evidence.** `migrations/core/0024_turnovers.sql`; `src/terrace/turnovers.ts`; `src/terrace/turnover-view.ts`; `tests/terrace.test.mjs`
**Gap.** None.

#### WORK-014 — Control maintenance budgets inventory and chargebacks

Core · target · **done** · Rules D-3

**Requirement.** Track property/asset spend versus approved operating/capital budgets, in-house stock use and purchasing, and authorized resident/owner/insurance chargebacks. Record approvals and tax treatment so a cost is never recovered twice or assigned to the wrong beneficiary. Its exact terms are in [docs/contract/terms/maintenance.md](docs/contract/terms/maintenance.md#work-014--control-maintenance-budgets-inventory-and-chargebacks).

**Acceptance.**
1. Consume a stocked part on a repair, cross a budget limit, propose a resident chargeback and approve one allocation; reconcile stock, payable, receivable and owner cost.

**Evidence.** `tests/work-budgets.mjs`; `tests/bills.mjs`; `tests/work-budgets-browser.mjs`
**Gap.** None.

#### WORK-015 — Chargeback notices, disputes and collection

Core · target · **missing**

**Requirement.** Future chargeback notice, dispute and collection workflows inherit WORK-014’s no-notice, no-dispute and no-collection boundary.

**Acceptance.**
1. Accounting allocations alone establish no legal liability, delivery or money movement.

**Evidence.** None.
**Gap.** No chargeback notices, dispute workflow or collection exists. This future clause inherits WORK-014’s explicit boundary; recorded accounting allocations establish no legal liability, communication delivery or money movement.

### Reports and portfolio performance

#### REPORT-001 — Explain the complete rent roll

Core · target · **done**

**Requirement.** Report every unit, resident, lease dates, market/contract rent, concessions, recurring charges, deposit obligations and occupancy state as of a chosen date, including vacant and future leases. Totals drill to effective terms and export to CSV/XLSX/PDF. A collection view of the same rent roll for a period shows, per unit and in total, rent collected against rent billed, the share of leases paid in full and each lease’s payment state (paid by ACH, card or cash, partial or unpaid) from settled receipts, with pending funds shown separately. Its exact terms are in [docs/contract/terms/reports.md](docs/contract/terms/reports.md#report-001--explain-the-complete-rent-roll).

**Acceptance.**
1. Run an as-of rent roll before and after a scheduled renewal and move-in, reconcile occupied/vacant unit counts and effective rents and download the same filtered data.
2. For one month, show collected of billed and leases paid for the portfolio and, per unit, the ACH, card, cash, partial and unpaid states, reconciling every total to resident-ledger receipts.

**Evidence.** `migrations/core/0026_rent_roll.sql`; `src/terrace/rent-roll.ts`; `src/terrace/rent-roll-view.ts`; `src/terrace/exports.ts`; `tests/terrace.test.mjs`
**Gap.** None.

#### REPORT-002 — Report delinquency and collection performance

Core · target · **partial**

**Requirement.** Show current/past-due aging with tenant arrears separate from housing-authority arrears (PAY-013), pending payments, broken promises, payment plans, notices and collection outcomes by household/property/owner. Separate settled cash from attempted collection and permit authorized drilldown/export without exposing screening reports. Its exact terms are in [docs/contract/terms/reports.md](docs/contract/terms/reports.md#report-002--report-delinquency-and-collection-performance).

**Acceptance.**
1. Filter delinquency to one owner, include a returned ACH, an active plan and a voucher lease with unpaid HAP, reconcile aging to resident balances and show follow-up owner and next permitted action for each overdue household.

**Evidence.** `migrations/core/0045_delinquency.sql`; `src/terrace/delinquency-math.ts`; `src/terrace/delinquency-report.ts`; `src/terrace/delinquency-view.ts`; `src/terrace/api.ts`; `src/terrace/retention.ts`; `src/terrace/erasure.ts`; `src/terrace/imports-target.ts`; `tests/delinquency.mjs`; `tests/terrace.test.mjs`
**Gap.** Returned ACH and payment plans do not exist yet (PAY-008, PAY-011) and the report shows them as not recorded; the unpaid-HAP aging case is asserted in `tests/hap.mjs`, which this clause does not cite. Owner filtering, aging reconciliation, the follow-up owner and the next action are asserted.

#### REPORT-003 — Measure vacancy leasing and renewal performance

Core · target · **done**

**Requirement.** Show occupancy, economic vacancy, days vacant, days to lease, lead source conversion, showing/application drop-off and renewal retention with explicit date windows and formulas. Distinguish stale listings from ready units and explain forecast assumptions separately from actuals. Its exact terms are in [docs/contract/terms/reports.md](docs/contract/terms/reports.md#report-003--measure-vacancy-leasing-and-renewal-performance).

**Acceptance.**
1. Follow a vacant unit through showing, lease and move-in, compare source conversion and vacancy days and drill the metric to dated source events.

**Evidence.** `src/terrace/leasing-report.ts`; `src/terrace/leasing-metrics.ts`; `src/terrace/leasing-view.ts`; `src/terrace/api.ts`; `tests/leasing-report.mjs`; `tests/terrace.test.mjs`
**Gap.** None.

#### REPORT-004 — Report maintenance service and cost

Core · target · **done**

**Requirement.** Report request age, response/booking/resolution time, repeat repairs, open emergencies, vendor performance, asset cost and budget variance. Use confirmed outcomes and disclose missing timestamps; vendor closure alone cannot improve resolution metrics. Its exact terms are in [docs/contract/terms/reports.md](docs/contract/terms/reports.md#report-004--report-maintenance-service-and-cost).

**Acceptance.**
1. Run a service report for a reopened repair and an unconfirmed completion, trace durations and owner cost to evidence and export the filtered unresolved queue.

**Evidence.** `migrations/core/0033_service_report.sql`; `src/terrace/service-report.ts`; `src/terrace/service-view.ts`; `src/terrace/api.ts`; `tests/terrace.test.mjs`
**Gap.** None.

#### REPORT-005 — Build governed custom reports and fields

Core · target · **done**

**Requirement.** Managers define typed custom fields, validated values, document merge fields and saved reports with formulas, grouping and role-aware filters. Show source lineage and schema changes; templates cannot leak hidden fields or silently change prior generated documents. Its exact terms are in [docs/contract/terms/reports.md](docs/contract/terms/reports.md#report-005--build-governed-custom-reports-and-fields).

**Acceptance.**
1. Add a unit inspection field, use it in a saved report and document template, hide a sensitive owner field from leasing staff and verify their export/merge cannot reveal it.

**Evidence.** `migrations/core/0048_custom_reports.sql`; `src/terrace/custom-commands.ts`; `src/terrace/custom-reports.ts`; `src/terrace/custom-documents.ts`; `src/terrace/custom-view.ts`; `tests/custom-reports.mjs`; `tests/custom-browser.mjs`; `tests/terrace.test.mjs`
**Gap.** None.

#### REPORT-006 — Schedule delivered operating reports

Core · target · **partial** · Rules D-5

**Requirement.** Schedule rent roll, delinquency, vacancy, maintenance and owner and financial reports by recipient scope, timezone and close status, completing the full owner batch within the SAFE-009 bound. Retain generation version, secure delivery link, delivery failures and next action; retry transport safely without emailing duplicates or stale permissions. Each send needs the installation owner’s explicit approval, uses only existing owner portal fields and rechecks the recipient’s live grant; frozen statements are source-verified, snapshots stay installation-only until the owner deletes them through an audited path that legal and accountant holds block, nothing sends unattended and an uncertain outcome is never retried automatically. Its exact terms are in [docs/contract/terms/reports.md](docs/contract/terms/reports.md#report-006--schedule-delivered-operating-reports).

**Acceptance.**
1. Schedule an owner report across a timezone boundary, revoke an owner before delivery and bounce another recipient; verify scope recheck, one authorized delivery and a failed-delivery task.

**Evidence.** `tests/report-schedules.mjs`; `tests/terrace.test.mjs`; `tests/report-schedules-browser.mjs`; `src/terrace/report-deliveries.ts`; `src/terrace/report-custody.ts`; `migrations/core/0076_report_snapshot_custody.sql`; `docs/report-schedules.md`
**Gap.** Recipient-scope delivery for rent roll, delinquency, vacancy, maintenance and staff financial reports, plus the SAFE-009 reference-deployment 150-owner batch timing proof, remain unproved. Owner allocation statement links are the reviewed delivery slice. No unattended send or uncertain-send retry is authorized.

#### REPORT-007 — Expose cash and vacancy trade-offs

Core · target · **done**

**Requirement.** Project rent, renewals, deposits held, payables, capital work, reserves and owner distributions under explicit scenarios. Show confidence, assumptions and vacancy-day/cash differences; projections never post ledger entries or approve lease pricing on their own. Its exact terms are in [docs/contract/terms/reports.md](docs/contract/terms/reports.md#report-007--expose-cash-and-vacancy-trade-offs).

**Acceptance.**
1. Compare repairing before listing versus immediate marketing with a rent concession, change the vacancy assumption and inspect the recalculated cash/ready dates while actual books remain unchanged.

**Evidence.** `src/terrace/scenarios.ts`; `src/terrace/scenario-view.ts`; `public/app/scenarios.css`; `src/terrace/api.ts`; `tests/scenarios.mjs`; `tests/terrace.test.mjs`
**Gap.** None.

### Integrations and persistent operating automation

#### OPS-001 — Expose a scoped property operations API

Core · target · **done** · Cites BASE-ROLE-001, BASE-INPUT-001, BASE-OPS-003

**Requirement.** Provide documented versioned APIs for properties, households, leases, resident and owner ledgers, documents, work and reports with scoped revocable credentials, pagination, validation and idempotent writes. A credential carries read or prepare scope, and no credential call is ever recorded as a person’s approval. ROLE-001 applies before this ships: each credential acts with one staff role’s capabilities and portfolios, rechecked in D1 on every call; out-of-scope records answer 404 and out-of-role actions 403. SAFE-001 applies before this ships: minting, rotating or revoking a credential needs the fresh email-link proof, and a credential never satisfies a second factor for a person. Its exact terms are in [docs/contract/terms/integrations.md](docs/contract/terms/integrations.md#ops-001--expose-a-scoped-property-operations-api).

**Acceptance.**
1. Connect a read-only accountant credential and an agent credential granted prepare scope only, traverse paginated records, retry an idempotent work proposal and refuse approval, payout or cross-property reads outside each credential’s granted scope.
2. Each credential is also refused (403) any action its ROLE-001 role lacks and answers 404 for records outside its portfolios.
3. Minting a credential without a fresh email-link proof is refused (403).

**Evidence.** `tests/credentials.mjs`; `tests/terrace.test.mjs`; `tests/credentials-browser.mjs`; `src/terrace/credentials.ts`; `src/terrace/api.ts`; `API.md`
**Gap.** None.

#### OPS-002 — Publish dependable events and automation hooks

Core · target · **missing** · Cites BASE-OPS-003, BASE-DATA-004

**Requirement.** Emit signed versioned events for lease, payment, work, document and ledger changes with delivery history, deduplication, replay and disabled-subscription controls. Connect Zapier and Crank without granting them broader rights than their credentials.

**Acceptance.**
1. Subscribe to work completion and rent settlement, fail then replay delivery, process a duplicate and revoke the subscription; show exactly one downstream effect and no later delivery.
2. DEMO-001 applies before this ships: its demo flow retains the effect guard and adds a public-door no-egress assertion; no real payment, message or webhook is sent from a demo.

**Evidence.** None.
**Gap.** Signed webhooks, replay controls and Zapier/Crank connections are absent.

#### OPS-003 — Run persistent workflow templates

Core · target · **partial** · Cites BASE-OPS-004

**Requirement.** Configure leasing, renewals, rent, delinquency and unit-turn workflows with triggers, conditions, steps, assignees, due times and escalation. Preserve the next action, attempt, reply, external reference and completion evidence through restarts; pause on stale authority, contact limits or uncertain results. Its exact terms are in [docs/contract/terms/integrations.md](docs/contract/terms/integrations.md#ops-003--run-persistent-workflow-templates).

**Acceptance.**
1. Start a renewal and unit-turn workflow, restart between steps, receive a reply and exhaust a contact limit; inspect durable next actions and a human escalation rather than a false completed state.

**Evidence.** `tests/workflows.mjs`; `tests/terrace.test.mjs`; `tests/workflows-browser.mjs`; `migrations/core/0055_workflow_ticks.sql`; `src/terrace/workflow-scheduler.ts`; `src/terrace/workflow-mail.ts`; `src/server.ts`; `deploy.json`; `wrangler.jsonc`; `tests/workflow-cadence.mjs`
**Gap.** Cloudflare hosted Cron cadence not measured.

#### OPS-004 — Operate integrations with visible health and cost

Core · target · **missing** · Cites BASE-SECRET-001, BASE-OPS-004

**Requirement.** Show each provider’s configured permissions, entitlements, last successful exchange, freshness, failures and billable operation estimate. Validate setup with real provider checks; bounded transient retries never conceal missing credentials, denied access or semantic errors. ROLE-001 applies before this ships: only the owner configures integrations.

**Acceptance.**
1. Connect a valid provider and one with denied scope, expire a token and simulate transport failure; inspect distinct actionable states, bounded retries and cost/usage records with secrets redacted.
2. A non-owner operator’s integration change is refused (403).
3. SAFE-005 applies before this ships: each connected provider appears in the readable export’s reconnect list, and a restore imports no provider session or token.

**Evidence.** None.
**Gap.** Unified provider setup, health, entitlement and cost controls are absent.

#### OPS-005 — Link insurance coverage through MSI

Core · target · **missing**

**Requirement.** Use MSI or an authorized insurance partner for renter quotes/enrollment, policy proof, effective dates, expirations and claims handoff; also record externally purchased coverage. Show coverage gaps without inventing approval or acting as insurer, and restrict policy details.

**Acceptance.**
1. Resident submits external proof and another enrolls through the partner boundary; expire a policy, request renewed evidence and hand a claim to the insurer with status/reference retained.

**Evidence.** None.
**Gap.** MSI integration, external coverage proof and expiry follow-up are absent.

#### OPS-006 — Connect finance signing and trade siblings

Core · target · **missing**

**Requirement.** Use Pantry for company-level accounting handoff, Inkwell for signature envelopes, Glove for a contractor’s field-service job and Gasket for an owner’s maintenance asset system where selected. Explicit mappings join external IDs and outcomes without merging their separate products into Terrace.

**Acceptance.**
1. Send an approved repair to a Glove boundary, receive completion and invoice references, sign a lease through Inkwell and reconcile a Pantry journal; verify each external identity and permission remains distinct.
2. SAFE-005 applies before this ships: its signed envelopes and their signed files appear in the readable export and come back with a restore into a fresh installation.

**Evidence.** None.
**Gap.** Named sibling adapters and reconciled handoff workflows are absent.

#### OPS-007 — Respect adjacent property product boundaries

Core · target · **partial** · Cites BASE-DATA-004

**Requirement.** Terrace owns long-term residential operations and its full trust ledger. Cabin owns vacation-rental reservations/channel management; general business file sync belongs to Chest and sales CRM to Orbit. Link records through permissioned APIs instead of building booking engines, generic drives or sales pipelines here. Its exact terms are in [docs/contract/terms/integrations.md](docs/contract/terms/integrations.md#ops-007--respect-adjacent-property-product-boundaries).

**Acceptance.**
1. Link a mixed owner’s residential property to its Cabin record and a Chest document, navigate the authorized references and confirm residential ledger exports remain complete without short-stay reservation duplication.

**Evidence.** `migrations/core/0047_sibling_links.sql`; `src/terrace/siblings.ts`; `src/terrace/sibling-view.ts`; `tests/siblings.mjs`; `tests/terrace.test.mjs`
**Gap.** Base egress door. Confirming a linked record’s existence and title/status with the owner-configured installation credential needs Base’s egress door for owner-entered origins.

### Incumbent migration and reversible cutover

#### MOVE-001 — Reconcile complete migration before cutover

Core · target · **partial** · Cites BASE-DATA-001

**Requirement.** Guide managers through inventory, field mapping, original file custody, source counts, validation, duplicates, dry run and exact human-approved apply. Migrate properties, owners, households, leases, documents, deposits, opening trial/subledger balances, unpaid charges/bills, active work, future schedules, the vendor directory, year-to-date 1099 and owner-income balance-forwards and current residents’ ledger history (MOVE-010) with an exceptions report. Every importer holds commercial lease and association records as exceptions rather than loading them as residential tenancies (BOUND-004). Never declare a complete switch with unexplained money or missing records. Opening balances tie out by account to the incumbent’s trial balance, and the tie-out report is retained with the manifest.

**Acceptance.**
1. Load a multi-property source with a missing deposit, duplicate household, vendor without a W-9 and a commercial lease held as an exception (BOUND-004), preview without writes, reconcile counts and balances, resolve exceptions and approve the exact migration manifest.
2. Show each opening account balance, source against Terrace, with a zero difference or a named exception.

**Evidence.** `src/terrace/imports.ts`; `src/terrace/imports-source.ts`; `tests/terrace.test.mjs`
**Gap.** Reviewed tenancy-only CSV custody exists; full record, document, opening-balance and active-work migration is absent.

#### MOVE-002 — Move in from AppFolio

Core · target · **missing** · Register R-1

**Requirement.** Accept owner-captured CSV and Excel reports, report PDFs and authorized downloaded statements/shared documents; where entitled, capture supported Stack API JSON with a completeness manifest. Map property/unit/owner/lease IDs, deposits, ledgers and active work, plus the vendor directory, 1099 and owner-income year-to-date totals and tenant-ledger history for MOVE-010, retaining source references and exceptions. API tier and accessible files are verified per account. Its exact terms are in [docs/contract/terms/migration.md](docs/contract/terms/migration.md#move-002--move-in-from-appfolio).

**Acceptance.**
1. Use redacted AppFolio exports in AppFolio’s documented formats and approved API capture where available; preview, import and compare rent roll, deposits, opening trial balance and document counts to the source, holding every unmapped record.

**Evidence.** None.
**Gap.** AppFolio adapter and reconciled export fixtures are absent.

#### MOVE-003 — Move in from Buildium

Core · target · **missing** · Register R-2

**Requirement.** Accept category XLSX exports for Rentals, Accounting, Tasks and Communication, report CSV/XLSX/PDF, downloaded files and entitled Premium Open API JSON/file downloads. Category exports alone do not contain all ledger financials: require supplemental trial balance, bank/deposit and opening-balance reports before cutover, and the vendor, 1099 and tenant-ledger reports MOVE-010 needs. Its exact terms are in [docs/contract/terms/migration.md](docs/contract/terms/migration.md#move-003--move-in-from-buildium).

**Acceptance.**
1. Import redacted Buildium files in Buildium’s documented formats plus an authorized Open API capture, detect omitted ledger financials, reconcile beneficiary/deposit totals and migrate active work and files before permitting cutover.

**Evidence.** None.
**Gap.** Buildium file/API importer and completeness reconciliation are absent.

#### MOVE-004 — Move in from Rent Manager

Core · target · **missing** · Register R-3

**Requirement.** Accept Rent Manager/Express Excel report exports, separately downloaded original documents and authorized Rent Manager Online Web API JSON. Inspect the actual workbook format and source fields, include vendor, 1099, owner-income and tenant-ledger reports for MOVE-010, preserve source identifiers and require account-specific export coverage rather than assuming a universal bulk-document ZIP. Its exact terms are in [docs/contract/terms/migration.md](docs/contract/terms/migration.md#move-004--move-in-from-rent-manager).

**Acceptance.**
1. Import redacted Excel reports in Rent Manager’s documented formats and entitled API data, map units/owners/leases/work orders, reconcile deposits and receivable/payable openings and identify missing original documents before approval.

**Evidence.** None.
**Gap.** Rent Manager reports/API importer is absent.

#### MOVE-005 — Move in from Yardi Breeze

Core · target · **missing** · Register R-4

**Requirement.** Accept Breeze/Breeze Premier report-packet PDFs and Premier Excel/PDF custom reports with separately downloaded lease and operating files. Review PDF extraction and workbook columns against source totals; do not assume Voyager APIs apply to Breeze. Obtain account-specific supplemental reports for deposits, balances, work, vendors, 1099 totals, owner income and tenant ledgers (MOVE-010). Its exact terms are in [docs/contract/terms/migration.md](docs/contract/terms/migration.md#move-005--move-in-from-yardi-breeze).

**Acceptance.**
1. Import redacted Breeze reports in Yardi Breeze’s documented formats and original documents, inspect extracted row provenance, reconcile rent roll/deposits/openings and hold missing ownership or active-work coverage visibly.

**Evidence.** None.
**Gap.** Yardi Breeze/Premier importer and reviewed report extraction are absent.

#### MOVE-006 — Move in from DoorLoop

Core · target · **missing** · Register R-5

**Requirement.** Accept Reporting V2 CSV/Excel/PDF, existing XLSX exports, executed lease PDFs and lease-statement ZIPs, plus authorized Premium REST JSON capture when available. A statement ZIP is not a complete account document export; reconcile file coverage, owner/deposit balances, active work and the vendor, 1099, owner-income and tenant-ledger data MOVE-010 needs explicitly. Its exact terms are in [docs/contract/terms/migration.md](docs/contract/terms/migration.md#move-006--move-in-from-doorloop).

**Acceptance.**
1. Import redacted DoorLoop reports in DoorLoop’s documented formats, lease PDFs, statement ZIP and entitled API capture; reconcile openings, lease terms and documents, then identify unexported records before approval.

**Evidence.** None.
**Gap.** DoorLoop importer and source-completeness fixtures are absent.

#### MOVE-007 — Move in from TurboTenant

Core · target · **missing** · Register R-6

**Requirement.** Accept rent charge/payment/deposit, expense and rent-roll CSV, Finances P&L Excel and executed lease PDFs. Completed deposit exports omit in-transit payments and rent roll omits draft/upcoming leases: collect those exceptions and future leases separately, with vendor and year-to-date totals for MOVE-010. Preserve histories and never treat a missing public API as permission to omit data. Its exact terms are in [docs/contract/terms/migration.md](docs/contract/terms/migration.md#move-007--move-in-from-turbotenant).

**Acceptance.**
1. Import redacted TurboTenant files in TurboTenant’s documented formats with one pending payment and future lease, reconcile completed deposits and income/expenses, and require reviewed supplemental inputs for omitted states before cutover.

**Evidence.** None.
**Gap.** TurboTenant importer and supplemental pending/future-state reconciliation are absent.

#### MOVE-008 — Shadow run and control payment cutover

Core · target · **missing** · Rules D-4

**Requirement.** Run rent, fees, statements, bank matching and future schedules in shadow against the incumbent before the owner selects a cutover date. Record which system collects each period, re-authorize nonportable mandates through the processor, stop old scheduled collection and prevent double rent/deposit/payout execution.

**Acceptance.**
1. Shadow a rent cycle against source statements, hold a difference, approve a corrected cutover and demonstrate a retained old autopay cannot create a second Terrace collection; show every mandate’s reauthorization state.

**Evidence.** None.
**Gap.** Shadow financial comparison and payment-authority cutover are absent.

#### MOVE-009 — Undo untouched imports and protect later operations

Core · target · **partial** · Rules D-4

**Requirement.** Apply approved migrations idempotently with originals, target mappings and a journal. Undo an untouched batch; after collections, signatures, work or ledger postings, show conflicts and require reviewed compensating actions. Export source and target records so a failed transition is recoverable without deleting later activity. Its exact terms are in [docs/contract/terms/migration.md](docs/contract/terms/migration.md#move-009--undo-untouched-imports-and-protect-later-operations).

**Acceptance.**
1. Replay a migration apply, undo an untouched property and refuse silent undo after a settled receipt or signed lease; inspect the conflict report and approved compensation preserving later work.

**Evidence.** `src/terrace/imports.ts`; `src/terrace/imports-target.ts`; `src/terrace/imports-compensation.ts`; `src/terrace/imports-dependencies.ts`; `migrations/core/0053_import_compensation.sql`; `tests/terrace.test.mjs`
**Gap.** Tenancy CSV refuse-before-reverse undo and reviewed owner compensation ship for new preserve-conflicts jobs. Existing strict imports await reviewed reversal-policy conversion in Base; compensation for incumbent financial/provider migrations (MOVE-002 to MOVE-008 and MOVE-010) remains absent.

#### MOVE-010 — Carry vendors year-to-date tax and resident ledger history

Core · target · **missing**

**Requirement.** Migrate the vendor directory (legal name, DBA, restricted W-9/TIN status, 1099 eligibility and box, insurance and license expiry, payment method and remit address), year-to-date reportable-payment balance-forwards for every vendor and owner, year-to-date owner income and expense by property, and each current resident’s transaction history for at least the previous 24 months (charges, receipts, credits, returned payments and deposit transactions) as source-referenced read-only historical lines. Balance-forwards and history reconcile to the incumbent’s 1099 summary, owner statements and tenant ledgers before cutover. Historical lines appear in the resident ledger, resident statements, eviction ledger export and deposit disposition and never re-post as new cash.

**Acceptance.**
1. Import an AppFolio vendor directory and year-to-date 1099 totals with a 30 June cutover, pay the same vendor in Terrace and produce one 1099 whose total equals pre-cutover plus post-cutover payments; show a migrated resident’s pre-cutover ledger lines in the resident ledger, on the eviction ledger export and on the deposit disposition statement, with the opening balance equal to the history’s closing balance.

**Evidence.** None.
**Gap.** Vendor directory, year-to-date 1099/owner-income balance-forwards and resident ledger-history migration are absent.

#### MOVE-011 — Replace AppFolio, Buildium or Rent Manager end to end

Core · target · **missing** · Register R-1, R-2, R-3

**Requirement.** A manager running on AppFolio, Buildium or Rent Manager can switch to Terrace and keep doing every daily job those products do: leasing and applications (LEASE-001 through LEASE-011), rent collection by ACH, card and retail cash with autopay and late fees (PAY-001 through PAY-007), trust, deposit and owner accounting with bank reconciliation, owner payouts and 1099s (ACCT-001 through ACCT-018), resident, owner and vendor portals (PORTAL-001 through PORTAL-003), maintenance from request to matched invoice (WORK-001 through WORK-009) and the rent roll, delinquency and owner reports (REPORT-001, REPORT-002), after the reviewed move-in of MOVE-001 through MOVE-004 and MOVE-010 and the payment cutover of MOVE-008. Terrace publishes a function-by-function switch checklist for each of the three incumbents, built from the incumbent’s own public documentation; each line names the Terrace clause that replaces it and shows that clause’s status in this contract, and a line reads as covered only when that clause’s acceptance has passed. A function the incumbent offers and Terrace does not is listed as a gap, never omitted.

**Acceptance.**
1. Take the redacted books of a 50-unit portfolio from each of AppFolio, Buildium and Rent Manager, import them, shadow a rent cycle and cut over; then run one full month (lease a vacant unit through screening and e-signature, collect rent by ACH, card and cash, take a repair from request to matched invoice, pay the owners by ACH, publish the owner statements and reconcile the bank three ways) and show each checklist line the month relied on passed.
2. Show that a function the incumbent offers and Terrace lacks appears as a named gap.

**Evidence.** None.
**Gap.** No incumbent switch journey exists: only the Terrace tenancy CSV move-in ships, and the incumbent importers, shadow run and the collection, accounting and portal clauses a switch relies on are absent.

### Security privacy ownership and recovery

#### SAFE-001 — Enforce authenticated least-privilege doors

Core · target · **done** · Cites BASE-ACCESS-002, BASE-ACCESS-004, BASE-ROLE-001, BASE-SIGNIN-001, BASE-SIGNIN-002

**Requirement.** Require step-up authentication for bank and access changes, and offer staff a second factor of Terrace’s own beside the organization’s identity provider. Its exact terms are in [docs/contract/terms/security.md](docs/contract/terms/security.md#safe-001--enforce-authenticated-least-privilege-doors).

**Acceptance.**
1. Crawl all private doors signed out and with each restricted role, replay a revoked session and attempt a cross-site payout or bank change without step-up; deny all unauthorized reads and writes.

**Evidence.** `migrations/core/0032_second_factor.sql`; `src/terrace/second-factor.ts`; `src/terrace/security-view.ts`; `src/terrace/api.ts`; `src/terrace/core.ts`; `src/auth.server.ts`; `tests/terrace.test.mjs`
**Gap.** None.

#### SAFE-002 — Keep attributable immutable operating history

Core · target · **partial** · Cites BASE-AUDIT-001, BASE-OPS-005

**Requirement.** Retain who prepared, approved, changed and executed each lease, notice, payment, bank instruction, work order, import and close, with original source, timestamps, policy version and outcome. Reads and exports of sensitive records are themselves recorded. Its exact terms are in [docs/contract/terms/security.md](docs/contract/terms/security.md#safe-002--keep-attributable-immutable-operating-history).

**Acceptance.**
1. Change a lease, approve work, export a screening file and reverse a payment; inspect actor/source-linked history via an authorized audit view and refuse edits or deletion of accounting history.

**Evidence.** `migrations/core/0035_history.sql`; `src/terrace/history.ts`; `src/terrace/core.ts`; `src/terrace/api.ts`; `tests/terrace.test.mjs`
**Gap.** No screening file or payment reversal exists yet (LEASE-009, PAY-007, PAY-008), so their history rows are unasserted; lease, work and correction history, the authorized audit view and the refused edits and deletes are asserted.

#### SAFE-003 — Protect sensitive documents and provider secrets

Core · target · **partial** · Cites BASE-SECRET-001, BASE-INPUT-003

**Requirement.** Encrypt transport and stored sensitive records, use private storage and expiring authorized downloads, and collect bank/card details only through provider-hosted flows. Restrict and redact TIN, screening and identity data; scan attachments and show access scope.

**Acceptance.**
1. Upload a restricted report, inspect its private download headers and expiry, request it with a revoked role and inspect logs/export/browser output for secrets, PAN and TIN leakage.

**Evidence.** `src/terrace/api.ts`; `src/terrace/work.ts`; `src/modules/operator-auth/routes.mjs`
**Gap.** Authenticated no-store downloads exist; expanded encryption/redaction, scanning and credential/tokenization coverage need implementation.

#### SAFE-004 — Apply reviewed retention holds and erasure

Core · target · **partial** · Cites BASE-DATA-002, BASE-DATA-003, BASE-DATA-006

**Requirement.** Set US lease, accounting, screening and communication retention from the PORT-008 pack and reviewed policy, and take scoped resident access and erasure requests. Delete eligible copies, search, media and provider artifacts and keep a minimal non-resurrecting fence; never erase ledger evidence merely to hide a discrepancy. Its exact terms are in [docs/contract/terms/security.md](docs/contract/terms/security.md#safe-004--apply-reviewed-retention-holds-and-erasure).

**Acceptance.**
1. Request erasure with an accounting hold, review retained obligations, erase eligible documents, release a later hold and verify provider/search/media deletion plus blocked resurrection on restore.

**Evidence.** `migrations/core/0039_retention.sql`; `src/terrace/retention.ts`; `src/terrace/erasure.ts`; `src/terrace/retention-view.ts`; `src/terrace/imports-target.ts`; `src/terrace/archive-policy.mjs`; `tests/retention.mjs`; `tests/terrace.test.mjs`
**Gap.** No external provider artifact exists yet, so provider deletion is unasserted; the held and released erasure, document, media and search deletion and the restore fence are asserted.

#### SAFE-005 — Leave with complete usable operating data

Core · target · **partial** · Cites BASE-DATA-001, BASE-BACKUP-001

**Requirement.** Export all target records, immutable postings, signatures, media, conversations, approvals, source documents, provider references and migration custody in documented machine-readable formats plus original files. Restore to an independent installation with referential integrity and destination identities; list provider secrets/mandates that must be reconnected. Its exact terms are in [docs/contract/terms/security.md](docs/contract/terms/security.md#safe-005--leave-with-complete-usable-operating-data).

**Acceptance.**
1. Export a complete leased/paid/repaired property, restore to a fresh installation and compare balances, signed files, communications and work evidence; reconnect providers without importing sessions or repeating money movement.

**Evidence.** `src/terrace/readable-export.ts`; `src/terrace/data.ts`; `src/terrace/exports.ts`; `src/terrace/archive-policy.mjs`; `tests/terrace.test.mjs`
**Gap.** Its cited test compares tenancies, ledger and photographs and refuses restored sessions; signed files, communications, the reconnect list and the no-repeated-money check are not asserted in `tests/terrace.test.mjs` (signed lease originals are asserted in `tests/leases.mjs`, which this clause does not cite).

#### SAFE-006 — Recover durable jobs and reconcile uncertain outcomes

Core · target · **missing** · Cites BASE-OPS-003, BASE-OPS-004, BASE-BACKUP-001

**Requirement.** Recover scheduled and provider-backed actions after Worker restart, timeout, database failure or backup restore using stable operation IDs and provider lookup before any resend. Display uncertain payment/dispatch states and require resolution; backups and recovery drills demonstrate the declared recovery objectives using measured results: a recovery point of at most 15 minutes (D1 point-in-time restore plus versioned R2 objects) and a recovery time of at most 4 hours for the SAFE-009 portfolio on the reference deployment.

**Acceptance.**
1. Interrupt a payment and dispatch after external acceptance but before local acknowledgment, restart and reconcile by external ID; restore an archive and prove old jobs cannot send or pay again.
2. Restore the SAFE-009 dataset to a point 15 minutes before a recorded change and record the measured data loss and restore time against both objectives.

**Evidence.** `src/terrace/dispatch.ts`; `src/terrace/dispatch-mail.ts`; `src/terrace/dispatch-view.ts`; `tests/dispatch.mjs`; `tests/dispatch-browser.mjs`; `tests/terrace.test.mjs`
**Gap.** Persisted dispatch claims expose uncertain outcomes and prevent duplicate sends, including accepted dispatches after restore. Provider-lookup reconciliation after restart/timeout/database failure, scheduled and payment recovery and measured 15-minute recovery-point/4-hour recovery-time objectives are absent. Dispatch claim fencing alone does not satisfy the complete recovery journey.

#### SAFE-007 — Run an owned installation with honest diagnostics

Core · target · **done** · Cites BASE-INSTALL-001, BASE-OPS-001, BASE-OPS-002, BASE-DATA-005

**Requirement.** Support documented local launch, install, deployment, upgrades, backups and provider setup in the buyer’s own infrastructure with source ownership. Fresh installs contain no sample portfolio. Show actionable, redacted health and permission errors and preserve owner modifications across reviewed upgrades. Its exact terms are in [docs/contract/terms/security.md](docs/contract/terms/security.md#safe-007--run-an-owned-installation-with-honest-diagnostics).

**Acceptance.**
1. Launch a clean checkout with rer dev, complete setup, enter a real tenancy, export it, apply a documented upgrade in a separate installation and inspect useful redacted diagnostics.

**Evidence.** `README.md`; `docs/upgrades.md`; `src/site/docs.ts`; `rer-project.json`; `src/base/setup-state.ts`; `tests/owned-installation.mjs`; `tests/owned-process.mjs`; `tests/email-link.mjs`; `tests/runtime.mjs`; `verification.json`
**Gap.** None.

#### SAFE-008 — Make configuration limits and costs visible

Core · target · **partial**

**Requirement.** Explain provider onboarding, banking/screening agreements, marketplace entitlements, insurance/tax partner scope and native distribution requirements in setup. Show the capacity measured under SAFE-009, attachment limits, storage and external fees; distinguish measured limits and estimates. An unavailable contract or credential is a visible engineering/setup gap, never a simulated success.

**Acceptance.**
1. Attempt activation without a required provider agreement, inspect the blocked setup and cost disclosures, then connect the provider and complete a real operation, and read the SAFE-009 measurements in setup.

**Evidence.** `src/terrace/work.ts`; `src/terrace/data.ts`; `README.md`
**Gap.** Current upload/archive limits are enforced; target provider agreements, SAFE-009 capacity results in setup and cost/fee setup are absent.

#### SAFE-009 — Meet the first buyer's portfolio scale

Core · target · **partial**

**Requirement.** Capacity is measured on the reference deployment (one Cloudflare Worker with D1 and R2 as `rer deploy` provisions it) with a test-suite portfolio at the top of the first-buyer range: 500 units in 60 properties, 600 leases including past and future, 150 owners, 1,200 residents, 250 vendors and 24 months of history. Bounds: the monthly rent-posting run for every lease within 60 seconds; an as-of rent roll for all units within 5 seconds; auto-matching one bank account’s month of about 1,500 lines within 30 seconds, with the three-way reconciliation view within 5 seconds; the full 150-owner statement batch within 10 minutes; the delinquency report within 5 seconds; and interactive staff and portal pages under 1.5 seconds at p95. Each run records date, commit and dataset counts, the latest results are shown in setup and docs (SAFE-008), and a result past a bound fails the capacity check.

**Acceptance.**
1. Load the 500-unit set on the reference deployment, run the rent-posting run, as-of rent roll, one month’s bank reconciliation, owner-statement batch and delinquency report, and record each measured time against its bound with commit and dataset counts.

**Evidence.** `tests/capacity-fixture.mjs`; `tests/capacity.mjs`
**Gap.** Local readiness fixture and measurement journey ship. Cloudflare reference measurements remain unproved; ACCT-006 bank matching and three-way reconciliation and ACCT-012 complete statement batching are unbuilt. Staff and portal p95 and setup results are unproved. No local result qualifies as reference capacity.

### Service boundaries and specialist partners

#### BOUND-001 — Use regulated rails without becoming the custodian

Core · target · **missing**

**Requirement.** Terrace owns the complete residential ledger and orchestrates collection, trust-account reconciliation, approved vendor/owner payments and deposit refunds through contracted banks and processors. Banks hold funds; providers perform payment-network functions, identity verification and required onboarding. For outbound ACH the manager’s bank remains the originating bank: Terrace prepares and reconciles the NACHA files (ACCT-018) and never holds funds. This boundary does not exclude online collection or trust accounting.

**Acceptance.**
1. Onboard a manager’s processor and bank account, collect rent, reconcile trust subledgers and execute an approved payout; show funds remain at the bank/provider and Terrace records authoritative reconciled outcomes.

**Evidence.** None.
**Gap.** Regulated provider onboarding and the full reconciled money lifecycle are absent.

#### BOUND-002 — Keep housing legal tax and insurance decisions human

Core · target · **missing** · Register R-7

**Requirement.** TransUnion supplies reports; a manager decides applicants. Counsel approves jurisdiction-specific lease/notice/deposit rule packs and eviction/service actions; accountants review taxes and filings; MSI/other insurers issue policies. Track all referrals and responses in Terrace without claiming to be a bureau, lawyer, CPA or insurer.

**Acceptance.**
1. Hold a disputed screening result, uncertain notice rule and rejected tax filing; refer each to its authorized professional, record the response and resume only the explicitly approved action.

**Evidence.** None.
**Gap.** Professional referral/response tracking and reviewed jurisdiction/provider rule activation are absent.

#### BOUND-003 — Coordinate emergency and physical work with people

Core · target · **done** · Cites BASE-MAIL-001

**Requirement.** Local licensed vendors, the manager’s on-call service, emergency responders and utilities perform field work and emergency response. Terrace delivers urgent instructions/escalations, acknowledges handoff and checks subsequent resolution; it never presents an unattended bot or successful notification as physical emergency assistance. Its exact terms are in [docs/contract/terms/boundaries.md](docs/contract/terms/boundaries.md#bound-003--coordinate-emergency-and-physical-work-with-people).

**Acceptance.**
1. Receive a safety request, provide reviewed 911/utility guidance, obtain a human on-call acknowledgment and keep the case open until authorized resolution evidence and resident follow-up are recorded.

**Evidence.** `migrations/core/0043_emergencies.sql`; `src/terrace/emergencies.ts`; `src/terrace/emergency-alert.ts`; `tests/emergencies.mjs`; `tests/terrace.test.mjs`
**Gap.** None.

#### BOUND-004 — Stay residential: no commercial leases, CAM or HOA dues

Core · target · **done**

**Requirement.** Terrace manages residential rentals only. It has no commercial lease type, no CAM reconciliation and no homeowners’-association dues, assessments or association accounting, and says so in setup (the app’s first-run portfolio setup, which is the empty Tenancies page after Finish setup, and the Move in screen), the documentation and its public pages, so a buyer with commercial or association work learns the limit before importing. Commercial CAM recoveries and project-based affordable housing remain with specialist systems through OPS-008, and a residential owner’s own HOA dues remain an ordinary recurring vendor bill (ACCT-007), not association accounting; ACCT-007 carries that acceptance, because vendor bills ship with it. An import that carries commercial lease records holds them as exceptions rather than loading them as residential tenancies. Its exact terms are in [docs/contract/terms/boundaries.md](docs/contract/terms/boundaries.md#bound-004--stay-residential-no-commercial-leases-cam-or-hoa-dues).

**Acceptance.**
1. Search the app, API and setup for any commercial-lease, CAM or association-dues feature and find none; read the stated limit in setup and the docs; import a source file containing a commercial lease and show it held as an exception.

**Evidence.** `README.md`; `src/site/landing/home.ts`; `src/terrace/imports-source.ts`; `src/terrace/imports-view.ts`; `src/terrace/tenancy-view.ts`; `docs/getting-started.md`; `docs/move-in.md`; `tests/terrace.test.mjs`; `tests/app-journey.mjs`; `tests/site/assert-run-site.mjs`
**Gap.** None.

### Open source and hosted demo

#### OPEN-001 — Free and open source under the MIT license, run by one command

Core · target · **done** · Cites BASE-INSTALL-001, BASE-DATA-005

**Requirement.** Terrace is free and open source under the MIT license: the repository’s LICENSE and rer-project.json declare MIT, and anyone may run, modify and redistribute it. Every capability in this contract ships in the open-source product with no license key, unit, seat or owner cap, per-payment fee, paid gate or upgrade prompt from Terrace’s authors. Paid third-party services a manager connects (payment processors, banks, Plaid, TransUnion, Zillow and Apartments.com, Lob, Twilio, Resend, Nelco, MSI and hosting) bill their own fees, and Terrace names the provider and links its pricing before the connection is enabled (SAFE-008). The run site and README show the one command `npx -y @runeditrun/rer dev just-every/run-terrace`, which starts a local, empty installation owned by the person who ran it (SAFE-007). Its exact terms are in [docs/contract/terms/open-source.md](docs/contract/terms/open-source.md#open-001--free-and-open-source-under-the-mit-license-run-by-one-command).

**Acceptance.**
1. Read LICENSE and the project metadata and find MIT; build the run site and read the command on /run; run that command in a clean directory and reach setup with an empty portfolio; search the installed source and app for license keys, caps and upgrade prompts and find none; start a provider connection and see its provider and pricing named before it is enabled.

**Evidence.** `LICENSE`; `rer-project.json`; `scripts/installer/provider-costs.mjs`; `tests/app-journey.mjs`; `tests/site/assert-run-site.mjs`; `tests/site/provider-costs.mjs`; `tests/open-installation.mjs`; `tests/email-link.mjs`; `verification.json`
**Gap.** None.

#### DEMO-001 — Hosted demo portfolio that sends nothing

Core · target · **done**

**Requirement.** The homepage’s “Try the demo” link opens a hosted demo of the current release at https://demo.run-terrace.com/, built from this repository’s main branch in Base demo mode. It holds a lived-in sample portfolio seeded once after its owner exists: tenancies, rent history, renewal and arrears proposals awaiting a person, photographed inspections and maintenance in each state. A visitor signs in with one click to an isolated demo as owner, manager or preparer and can approve the prepared drafts; email, SMS, payments, webhooks and other provider writes return simulated success, so no request reaches a real provider or person and no mail is delivered. As target journeys ship they appear in the demo with the same rule. Demo data and simulated providers exist only under demo mode: a production build or deploy refuses `RER_DEMO`, and an ordinary installation starts empty. Its exact terms are in [docs/contract/terms/open-source.md](docs/contract/terms/open-source.md#demo-001--hosted-demo-portfolio-that-sends-nothing).

**Acceptance.**
1. Open the homepage link and reach the hosted demo signed out; sign in as the owner and as a preparer in separate browsers and approve a renewal and a maintenance handoff in one; confirm the other visitor sees none of those changes; observe that no outbound email, SMS or payment request leaves the demo; run a production build with `RER_DEMO` set and see it refused; start a fresh installation and find it empty.

**Evidence.** `src/demo.ts`; `src/server.ts`; `src/mail.server.mjs`; `tests/demo.test.mjs`; `tests/demo-hosted.mjs`; `tests/demo-hosted-support.mjs`; `src/modules/demo/effects.mjs`
**Gap.** None.

### Accountable portfolio agents

#### AGENT-001 — Run repair intake through owner-statement resolution

Core · push-further · **partial** · Rules D-8

**Requirement.** A portfolio agent joins resident intake, asset history, access constraints, vendor qualifications, quotes, approved spend, appointment, completion evidence, resident reply, invoice and owner ledger. It books within the approved work’s authority, chases blocked work and confirms repair with the resident, then matches the bill and reconciles its statement effect. Choosing a vendor, changing spend and paying carry the commitment and money classes, which the company’s policy decides; emergencies escalate immediately.

**Acceptance.**
1. Give the agent a leaking tap, approved vendor/spend envelope and resident availability; interrupt booking, change the invoice and receive a failed completion check.
2. It resumes safely, reopens the repair, holds the mismatch and closes only after confirmed repair and reconciled owner cost.

**Evidence.** `src/terrace/work.ts`; `tests/terrace.test.mjs`
**Gap.** Trade estimate, exact approval and external handoff exist; agent booking, resident checks, bill matching and ledger closure are absent.

#### AGENT-002 — Plan vacancy recovery with cash trade-offs

Core · push-further · **missing** · Rules D-8

**Requirement.** An agent combines lease ends, condition evidence, make-ready dependencies, vendor quotes, lead funnel and explicitly dated market assumptions to compare repair, listing and offer plans by vacancy days and cash impact. It follows the approved plan to signed lease and move-in, revising forecasts as facts change. Capital work, pricing, offers, legal terms and applicant decisions carry the money and commitment classes, which the company’s policy decides.

**Acceptance.**
1. Present two turnover plans with source-linked cost and vacancy assumptions, approve one, delay a vendor and recalculate; follow the revised plan to an approved applicant and executed lease, comparing actual vacancy and cash with forecast.

**Evidence.** `src/terrace/scenarios.ts`; `src/terrace/scenario-view.ts`; `tests/scenarios.mjs`; `tests/terrace.test.mjs`
**Gap.** Read-only repair-versus-marketing cash and vacancy comparison with sourced assumptions and recalculation ships. A continuing agent joining turnover dependencies and lead funnel, approved-plan execution, delayed-vendor reforecast, applicant/signature/move-in and forecast-versus-actual follow-through is absent. The read-only comparison does not satisfy continuing agent execution.

#### AGENT-003 — Investigate deposit and close exceptions

Core · push-further · **missing** · Rules D-8

**Requirement.** An agent joins lease deposit obligations, processor settlements, bank feeds and beneficiary subledgers to find missing deposits, duplicates, owner misallocations and stale outstanding items. It assembles source-linked correction proposals and pursues missing evidence before close. Corrections carry the money class, and deposit deductions, transfers and payouts each carry their own money call; the company’s policy decides each.

**Acceptance.**
1. Introduce a duplicate receipt, missing deposit and repair charged to the wrong owner; have the agent explain each difference from source evidence, propose corrections and reconcile only the corrections that ran under the company’s policy while unresolved differences block close.

**Evidence.** None.
**Gap.** Deposit/bank exception investigation and source-linked correction agent are absent.

#### AGENT-004 — Pursue arrears to a permitted resolution

Core · push-further · **partial** · Rules D-8

**Requirement.** An agent tracks consented attempts, replies, promised payments, plans and actual settled receipts, proposes the next permitted contact and follows through until paid, a plan is met or an accountable professional accepts handoff. It pauses on dispute, accommodation, contact limits or changed balance. Concessions, notices and money movement carry the money, commitment and external classes, which the company’s policy decides; counsel controls legal escalation.

**Acceptance.**
1. Work late rent with a promise that fails, a later returned payment and a disputed fee; show permitted next actions and holds, run each step under the company’s policy, then verify settled resolution rather than treating a promise or submitted debit as payment.

**Evidence.** `src/terrace/tenancies.ts`; `src/terrace/ledger.ts`; `tests/terrace.test.mjs`
**Gap.** Dated arrears proposals and receipt balances exist; continuing agent contacts/replies/plans and verified financial resolution are absent.

#### AGENT-005 — Steward renewals through executed future rent

Core · push-further · **partial** · Rules D-8

**Requirement.** An agent reads lease dates, current terms, communication history, condition and approved vacancy and cash assumptions, prepares sourced renewal alternatives and follows approved offers, replies, signatures and future charge setup. It surfaces retention/concession trade-offs and pauses if terms or authority change; pricing, legal terms and notices carry the commitment and external classes, which the company’s policy decides.

**Acceptance.**
1. Prepare renewal options, approve one, receive a counteroffer that voids the approved offer and decide the revised offer again; collect all signatures, verify future charges match the executed terms and escalate an unanswered offer before the deadline.

**Evidence.** `tests/renewals.mjs`; `tests/terrace.test.mjs`; `tests/renewals-browser.mjs`; `src/terrace/agent-workloads.ts`; `src/terrace/renewal-stewardship.ts`; `src/terrace/renewals.ts`; `src/terrace/lease-versions.ts`
**Gap.** **Remaining AGENT-005 scope and proof:** Continuing agent follow-through after preparation remains unimplemented or unproved: reading and refreshing the underlying lease, condition, communication and approved economic sources; tracking approved offers and replies; coordinating complete signatures through LEASE-011; and verifying the executed future charge setup with accountable recovery. The original acceptance sentence remains open for agent-led signature collection and continuing stewardship, despite the asserted human-operated renewal path. Renewal-specific proof of complete attributable audit fields, roster-change invalidation and renewal-workload revocation during execution remains incomplete. Provider-verified electronic execution remains LEASE-011; broader workload coverage remains AGENT-008; measured hosted scheduling remains OPS-003.

#### AGENT-006 — Compare inspection evidence without inventing damage

Core · push-further · **partial** · Rules D-8

**Requirement.** An agent compares dated original entry/exit/repair photos, video, checklist notes and asset history to highlight possible changes with exact source locations and uncertainty. It proposes inspection follow-up, repair or deposit-review items; deciding condition, wear, liability and deductions is a commitment the company’s policy decides. Insufficient or contradictory evidence remains visible.

**Acceptance.**
1. Compare an unchanged fixture, documented damage and ambiguous low-light image; inspect source-linked findings, reject an unsupported deduction and carry an approved repair into work with original media retained.

**Evidence.** `src/terrace/work.ts`; `tests/terrace.test.mjs`
**Gap.** Original photo custody exists; the agent’s comparison, its stated uncertainty and the finding workflow are absent.

#### AGENT-007 — Learn operating risks from verified outcomes

Core · push-further · **missing** · Rules D-8

**Requirement.** An agent analyzes vacancy, repeat repairs, resident-confirmed outcomes, collections, cash, reconciliation exceptions and vendor reliability to suggest preventive tasks, staffing and workflow changes. It separates hypotheses from measured outcomes and forecasts cost/benefit. Activating a changed vendor, budget, fee, contact or workflow carries its own class, which the company’s policy decides.

**Acceptance.**
1. Detect repeated HVAC callbacks and a leasing bottleneck, show source cases and quantified assumptions, approve one preventive plan and compare later actual outcomes without silently modifying the other workflow.

**Evidence.** None.
**Gap.** Cross-portfolio risk learning and reviewed improvement proposals are absent.

#### AGENT-008 — Keep agent authority and evidence inspectable

Core · push-further · **partial** · Cites BASE-AGENT-005, BASE-AGENT-008, BASE-AGENT-009, BASE-AGENT-011 · Rules D-8

**Requirement.** Every agent workload exposes purpose, permitted data/actions, approvals, next step, due time, attempts, replies, costs and outcome evidence. People can pause, cancel or reassign; revocation stops queued execution. The owner manages workloads through an audited path with explicit structured inputs; a workload’s credential evidence stays scoped, its fingerprinted document text is discarded, and recording an appointment keeps the existing work and resident-access checks.

**Acceptance.**
1. Embed a payment instruction in an invoice, revoke the agent during a queued booking and cancel a follow-up.
2. Show ignored document instructions, stopped execution and a complete human-readable action history with no self-approval.

**Evidence.** `tests/agent-workloads.mjs`; `tests/terrace.test.mjs`; `tests/agent-workloads-browser.mjs`; `src/terrace/agent-workloads.ts`; `src/terrace/core.ts`; `migrations/core/0069_agent_workloads.sql`
**Gap.** Queued maintenance and arrears proposals have scoped controls and retained evidence. Other credential preparation doors still lack workload integration.

#### AGENT-009 — Weigh each arrears case in cash and vacant days

Core · push-further · **missing** · Rules D-8

**Requirement.** For each delinquent household an agent compares a payment plan with a pay-or-quit notice (and waiting) by expected cash and vacant days: rent at risk, plan receipts by date weighted by the household’s payment history, the notice period and eventual turnover timeline from the property’s PORT-008 pack, expected vacant days at the unit’s rent, make-ready and leasing cost, and the resulting expected loss for each option. It shows its dated assumptions, sources and confidence and drafts the preferred plan or notice; sending it carries the external and commitment classes, which the company’s policy decides (PAY-011, PORTAL-009). It pauses on dispute, accommodation or contact limits (AGENT-004) and later compares the chosen option’s actual cash and vacancy with its forecast.

**Acceptance.**
1. Take one household with a plausible plan and one that has missed a plan; show each case’s plan-versus-notice comparison in cash and vacant days with its assumptions, change the vacancy assumption and watch the recommendation recalculate; under the held policy, approve and send the plan for one and the notice for the other as a person, and show nothing was sent before approval and the forecast compared with the actual outcome afterwards.

**Evidence.** None.
**Gap.** Cross-household arrears comparison of payment plans and notices by cash and vacancy impact is absent; only dated arrears drafts and receipt balances exist.

## Agent surface

### Agent surface

#### SURFACE-001 — The registry equals this table and the Base harness passes

Agent surface · target · **missing** · From new · Cites BASE-AGENT-001, BASE-AGENT-002, BASE-AGENT-003, BASE-AGENT-013

**Requirement.** Terrace serves the Base MCP door at `/mcp` with the tools, resources, events and prompts in this section, each tool calling the same server action as the app, and the existing scoped API reads answer there under the same role and portfolio checks.

**Acceptance.**
1. `tools/list` names exactly the tools in the table, each with its declared classes in `_meta`, and their Core clause ids plus the not-a-tool reasons cover every Core clause.
2. The Base conformance harness runs BASE-AGENT-001 to BASE-AGENT-013 on Terrace’s seeded portfolio under the all-autonomous and the held policies, and passes.
3. On the shared fixture, each tool and its app action give the same record state and the same history row type.
4. `resources/templates/list` names the resources above, and a ledger read for a leasing-staff sponsor returns exactly what leasing staff see in the app, with no receipts, statements or bank data.
5. A draft, preview or prepared proposal carries standard, and the same call through the app and the tool changes the same record.
6. `/docs/agents` lists every tool, class, resource, event type and prompt in this section.

**Evidence.** None.
**Gap.** Terrace serves no MCP door yet: the registry, the resources, the docs page and the harness run are unbuilt.

#### SURFACE-002 — Rent, payment and payout calls carry money with their amount and counterparty

Agent surface · target · **missing** · From new · Cites BASE-AGENT-006, BASE-AGENT-007

**Requirement.** Every call that posts, collects, refunds or pays money, or changes what a resident, owner or vendor is charged or paid, carries the money class with facts the server computes from the leases, ledgers, bills and destinations on record.

**Acceptance.**
1. A charge run carries money with its total in USD and its lease count; a receipt or reduction carries its amount and resident.
2. A vendor payment or owner distribution carries money with its amount, payee count and counterparty, new for a destination never paid before.
3. Approving work spend or a lease version carries money with the approved amount or the changed charge per period.
4. An argument or invoice text claiming a payment is internal, small or already approved leaves the computed class and facts unchanged.
5. Under “money autonomous up to $500, approval up to $10,000, blocked above”, a $385 repair approval runs, a $2,400 owner distribution waits with no effect and a $25,000 payout batch is refused.

**Evidence.** None.
**Gap.** Terrace serves no MCP door yet: no tool declares or computes the money class.

#### SURFACE-003 — Messages, listings, notices and filings carry external and commitment

Agent surface · target · **missing** · From new · Cites BASE-AGENT-006, BASE-AGENT-008

**Requirement.** Every send, publication, binding decision and filing carries the external or commitment class, and every one an agent completes is attributed to the agent acting for its sponsor.

**Acceptance.**
1. A repair message, statement send or request link carries external with its recipient count and counterparty.
2. Publishing a listing carries external with the counterparty public.
3. Serving a notice, sending a renewal offer, recording an applicant decision, closing a month and filing a 1099 each carry commitment with its value and counterparty.
4. An act an agent completes reads “<agent> for <person>” in history, on the tenancy and in exports; after a person approves an agent’s prepared work, the record shows the person as approver and the agent as preparer.
5. Mail an agent sends to a resident, owner or vendor names “<agent> for <person>” as its sender.

**Evidence.** None.
**Gap.** Terrace serves no MCP door yet: no tool declares or computes the external or commitment class.

#### SURFACE-004 — Sensitive reads and destructive erasure, undo and restore

Agent surface · target · **missing** · From new · Cites BASE-AGENT-003, BASE-AGENT-006

**Requirement.** Reads and exports of screening, application, tax and bank records carry the sensitive class, and erasure, import undo and restore carry destructive, with facts computed from the records touched.

**Acceptance.**
1. Reading or exporting a screening report, tax document, bank reference or full archive carries sensitive with its record count and kind; a masked ledger read is standard.
2. A grant for a leasing-staff sponsor cannot read what leasing staff cannot see in the app, whatever the policy decides for the class, and another portfolio’s record reads as not found.
3. Erasing a tenancy, undoing an import and restoring an archive each carry destructive with its item count.
4. Resident and vendor text in a request, document or invoice carries the untrusted marker and changes no call’s class.

**Evidence.** None.
**Gap.** Terrace serves no MCP door yet: no tool declares or computes the sensitive or destructive class.

#### SURFACE-005 — Access, security, policy setup, Pause and audit

Agent surface · target · **missing** · From new · Cites BASE-AGENT-004, BASE-AGENT-005, BASE-AGENT-007, BASE-AGENT-009, BASE-AGENT-011

**Requirement.** Staff, portal, credential and workload changes carry access and protective settings carry security; the company answers every Terrace class before agents act, and every agent call is audited with its classes and decision.

**Acceptance.**
1. Inviting staff, changing a role or portfolio, inviting or revoking a portal person and minting a credential carry access with the direction and people count; an agent widening its own grant returns `self_escalation`.
2. Changing spending limits, second-factor rules or a bank account mapping carries security.
3. Before setup is answered, an agent call returns `policy_unset` with the setup link, and setup lists every class Terrace uses with no answer pre-selected.
4. Pause agents stops the next Terrace call within 60 seconds, and an agent token cannot resume.
5. The Agents page’s counts by class and decision equal the history rows for the seeded week.

**Evidence.** None.
**Gap.** Terrace serves no MCP door yet: no class, policy decision, Pause control or Agents page exists.

#### SURFACE-006 — Provider accounts and gated steps

Agent surface · target · **missing** · From new · Cites BASE-AGENT-006, BASE-AGENT-008

**Requirement.** Connecting an outside account carries the accounts class, and steps an outside service keeps for a person are gated before they run, so they go to the named person instead of stalling an agent mid-task.

**Acceptance.**
1. Connecting a bank feed or a provider account carries accounts with its provider.
2. Card entry at the hosted checkout, a resident’s bank authorization, an applicant’s consent at the screening provider and a signer’s signature at the e-signature provider are gated with provider and step; the tool returns the step for the named person, and no agent call completes it.
3. A provider answer that requires a person makes the call gated before any effect.

**Evidence.** None.
**Gap.** Terrace serves no MCP door yet: no tool declares or computes the accounts or gated class.

#### SURFACE-007 — A property-management week under two company policies

Agent surface · target · **missing** · From new · Cites BASE-AGENT-013 · Rules D-8

**Requirement.** A stranger agent runs a seeded week of a residential portfolio through MCP alone, for a named sponsor with the portfolio-manager role, under two company policies.

**Acceptance.**
1. Given only the seed URL, the agent connects through MCP for the sponsor and lists the Terrace tools.
2. Under the all-autonomous policy it posts the month’s rent, records receipts, takes a leaking-tap report through quote, approval, dispatch and resident confirmation, matches the bill and prepares arrears follow-ups with no person involved: nothing waits for approval, nothing is refused by policy and the review feed is empty.
3. Under the held policy (standard reviewed, every other class approved by the test person), the same week waits at each money, external and commitment call, and each runs once approved.
4. Under the held policy with money blocked, the charge run and the work approval return `policy_blocked` and the rest of the week completes.
5. In both runs every record the agent changed names “<agent> for <person>”, and any approval names the test person.
6. Under both policies an agent sponsored by leasing staff reads another portfolio’s tenancy as not found.

**Evidence.** None.
**Gap.** Terrace serves no MCP door yet: the specialist journey has no door to run through.

## Later

### Integrations and persistent operating automation

#### OPS-008 — Handle commercial CAM and specialist housing through adapters

Later · target · **missing**

**Requirement.** For mixed portfolios, integrate specialist systems for commercial CAM recoveries and project-based affordable compliance regimes (HUD project-based Section 8 certifications, LIHTC compliance and their regulatory reporting) with explicit source-of-truth mappings and reconciled residential impacts. Tenant-based vouchers on ordinary leases are core receivables in PAY-013, not adapter work. Specialist regimes remain separate; missing provider agreements are tracked implementation work.

**Acceptance.**
1. Import a specialist CAM allocation and a project-based subsidy receipt through authorized provider boundaries, reconcile the residential owner/tenant effects and expose unsupported mappings as held exceptions for a person.

**Evidence.** None.
**Gap.** Specialist housing/CAM interfaces and reconciled impacts are absent.

## Field proof register

| ID | Proof | Clauses | State | Date | Receipt |
| --- | --- | --- | --- | --- | --- |
| R-1 | A real redacted export from a live AppFolio account imports and reconciles to its source totals. | MOVE-002, MOVE-011 | not run | | |
| R-2 | A real redacted export from a live Buildium account imports and reconciles to its source totals. | MOVE-003, MOVE-011 | not run | | |
| R-3 | A real redacted export from a live Rent Manager account imports and reconciles to its source totals. | MOVE-004, MOVE-011 | not run | | |
| R-4 | A real redacted report set from a live Yardi Breeze account imports and reconciles to its source totals. | MOVE-005 | not run | | |
| R-5 | A real redacted export from a live DoorLoop account imports and reconciles to its source totals. | MOVE-006 | not run | | |
| R-6 | A real redacted export from a live TurboTenant account imports and reconciles to its source totals. | MOVE-007 | not run | | |
| R-7 | An engaged firm’s counsel review of each state and local rule pack, lease template and notice template is recorded with reviewer, firm and date. | PORT-008, LEASE-010, PAY-006, PAY-011, ACCT-003, ACCT-004, PORTAL-009, BOUND-002 | not run | | |
| R-8 | Native iOS and Android apps are approved and listed in the App Store and Google Play. | PORTAL-008 | not run | | |
| R-9 | A human screen-reader pass of the operator app and the portals. | PORTAL-008 | not run | | |
| R-10 | A published VPAT for the operator app and the portals. | PORTAL-008 | not run | | |
| R-11 | Live SMS and voice pages reach the named on-call person’s handset, with provider-origin callbacks. | WORK-001 | not run | | |
| R-12 | A real resident receives an arrival-window text and replies from their own phone. | WORK-005 | not run | | |
| R-13 | A live hosted card payment by a resident settles into the mapped deposit and trust bank accounts. | PAY-003 | not run | | |
| R-14 | A consented, limited live retail-cash payment where the network offers no sandbox. | PAY-007 | not run | | |
| R-15 | Live email and SMS through the owner’s provider accounts reach a real recipient and route the reply back. | PORTAL-005 | not run | | |
