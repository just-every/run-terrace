# Terrace rulings

Every ct or owner ruling that shapes a clause in [CONTRACT.md](CONTRACT.md). A clause states the outcome; its ruling states why. RL-1 to RL-11 moved here from the contract in the 28 October 2026 cleanup, verbatim; RL-101 and above are ct’s ruling pass of 28 October 2026.

### RL-1 — Tenancy documents, record media and portal isolation

**Date:** 22 October 2026 (18:00Z), applied 23 October 2026 · **Ruled by:** ct · **Clauses governed:** PORT-007, PORT-009, PORT-010, ROLE-002.

Carved from PORT-007 by ct on 22 October 2026, which keeps leases, applications and notices; this clause carries the original sentence verbatim for inspection photos and video, work documents and invoices: “Attach and version leases, applications, notices, inspection photos and video, work documents and invoices on their records.”

Carved from PORT-007 by ct on 22 October 2026: the malware-verdict leg of “scan uploads”; PORT-007 keeps its static screen.

Revised 23 October 2026: PORT-007 and ROLE-002 are done under ct’s ruling of 22 October 2026 18:00Z. ROLE-002’s adopted defaults stand with ct’s five riders: links work once and expire within 7 days; a revocation, a new ownership share set and a changed vendor on a job or bill end the touched people’s portal sessions in the same batch as the change; the resident revokes a delegated contact at `/portal/delegate/revoke`; a sold owner reads only the periods they owned; a restore carries no portal person, grant, link or session. PORT-007 is the tenancy-document scope (leases, applications, notices, screening reports and tax documents, at most 5 MB, no video): application documents are readable by leasing staff in scope (`document.application`) and tax documents by accountants in scope (`document.tax`, read and download only), screening by the owner and portfolio managers. Restricted kinds are decided by the document’s kind; the stored restriction column names its sensitivity class, so application documents keep `screening` there and nothing in the archived schema changed. Inspection photos and video, work documents and invoices are carved to PORT-009 and the malware verdict to PORT-010 (both missing). Portal people are not operators: `/portal` has its own cookie, which reaches no staff door, and each grant names one tenancy, owner or vendor record. PORTAL-001/002/003 inherit the portal door, its live per-request checks, session ending and the ownership-period statement; LEASE-009 inherits the screening retention class and restricted documents; PORTAL-005/006 inherit the notice retention class; PORT-005 signed originals appear in document search but keep their own door and rights.

### RL-2 — Vendor appointment responses and estimate submissions

**Date:** 25 October 2026 · **Ruled by:** ct · **Clauses governed:** PORTAL-003, WORK-005.

**CT ruling, 25 October 2026 — approved with riders:** A live assigned vendor may explicitly confirm or cancel only an existing staff-booked appointment tied to the current approved work, in approved or sent state. The displayed appointment revision, version-1 affirmative declaration, response reason, attributable actor and actual recording time are retained in immutable history. Identical retries return stored evidence; conflicting replies to the same revision are refused. Confirmation applies WORK-004’s current qualification hold and documented-exception rules through the later of the work due date and property-local appointment end date. Cancellation may withdraw the visit under a qualification hold; it grants no replacement visit or entry authority. Vendor confirmation is separate from resident permission and resident confirmation. Staff retain booking, rescheduling, entry-notice and access authority. These response doors send no notification and disclose no keys, access codes or resident contacts. An appointment confirmation is not permission to enter, proof of legally sufficient notice, dispatch, completion or payment.

A live assigned vendor may submit quoted scope, available-from date, exact pre-tax amount and tax for staff comparison while the work is approved; the current estimate-submission door does not accept sent work. Version-1 affirmative consent states: “I submit this estimate for staff review only. It does not authorize work or change approved spend.” Identical normalized submissions for the same mailbox and approved job revision return one stored quote; changed submissions create separate comparison evidence. Submission neither selects the quote nor changes approved work. Authorized staff selection follows WORK-003 and ROLE-003, reopening exact work approval and any required owner decision before execution. Qualification holds and documented exceptions remain WORK-004’s recorded operational controls, without certification of licensing, insurance or legal compliance.

CT approved the assigned-vendor appointment-response default with riders on 25 October 2026.

### RL-3 — Repair communication authority, consent and inbound replies

**Date:** 26 October 2026 · **Ruled by:** ct · **Clauses governed:** PORTAL-005.

CT PORTAL-005, 26 October 2026 — APPROVE WITH RIDERS. The installation owner and portfolio managers currently in scope may manage repair communications using native sign-in proof fresh within ten minutes. API credentials and other roles gain no communication-management authority. Each channel requires an attributable recipient identity, exact destination and explicit channel-specific consent evidence; permission to enter, a portal grant, an available telephone number or an earlier message is not channel consent. Unknown consent denies. The present slice permits the current primary resident, currently assigned approved-work vendors and named active emergency responders only; it does not remove the broader recipient, shared-thread or notice obligations already assigned to PORT-004, PORTAL-006 and PORTAL-009.

Preparation and approval freeze the exact recipient, destination, channel, content and relevant source revisions. A person explicitly sends each approved current message once, with live authority, consent and source checks at execution. Changed inputs require new review and approval. The durable claim precedes the provider attempt and survives interruption. An uncertain outcome remains visibly uncertain pending manual provider lookup and reconciliation; neither a lost response nor a callback starts another send. Failed, suppressed, unconfigured, accepted and delivered outcomes remain distinct, and unsent drafts remain unsent. Provider acceptance is not delivery; delivery or call completion is not human acknowledgement, resident confirmation or permission to enter. Only the separately approved future WORK-001 emergency plan may delegate timed steps.

Authenticate inbound provider events against the configured account, installation destination and exact external callback URL, validating the full signed event and current provider authority. Then bind the sender through its recorded recipient and channel association to the authorized tenancy and exact message or invitation revision; a provider signature alone grants no household identity, portal session or action authority. Unknown, shared, changed or otherwise ambiguous identity and unrelated, stale or conflicting replies cannot change an appointment or another household’s thread and require authorized staff review. Preserve attributable permitted evidence without disclosing unrelated records. Inbound email routing remains a Gap; neither an ordinary email nor a test fixture supplies verified production reply authority. Duplicate provider events and duplicate affirmative replies have one effect; late progress cannot regress a terminal provider outcome. No automatic webhook reply is authorized.

Phone contact requires the recipient’s recorded timezone and is suppressed outside 8 a.m. to 8 p.m. there, including emergency pages. Unknown timezone denies phone contact. Evaluate the recipient’s actual local time at execution, including daylight-saving transitions; the property’s appointment timezone does not substitute for the recipient’s. The current manual default schedules no later send. An authenticated STOP applies durable hashed phone suppression independently of appointment matching, including when an arrival invitation is stale or ambiguous; it blocks future text and voice attempts, and staff cannot override it by editing consent. STOP is processed without requiring staff to guess which appointment it concerned and sends no automatic response. Preserve the three-year communication retention period, applicable longer reviewed requirements and holds; eligible erasure removes content and eligible copies, search and provider artifacts while retaining the minimal hashed suppression and non-resurrection fence. Consent revisions, exact approval, attempts, replies and provider evidence inherit SAFE-002, SAFE-004, SAFE-005 and SAFE-006. Native backup and readable export carry evidence, but restoration carries no credentials, sessions, send authority, timer authority or authority to accept archived provider events. Demo commands and callbacks refuse before provider egress. Postal fallback, statutory service and future shared threads retain their original clauses and cannot be claimed from a suppressed digital message.

### RL-4 — Shared threads and notices

**Date:** 27 October 2026 · **Ruled by:** ct · **Clauses governed:** PORTAL-006.

CT policy ruling, 27 October 2026: APPROVE WITH RIDERS; PORTAL-006 remains PARTIAL. Native installation owners and currently scoped portfolio managers use fresh email-link proof for each staff mutation. Explicit recipient permission evidence is separate from exact approval of the named recipient, content, original, deadline and revision. For a required notice, the evidence records the professionally reviewed service authority rather than inventing optional consent or certifying legal sufficiency. The current native slice permits current primary residents, current owners and vendors assigned approved work; this is not the complete household or post-tenancy communication target. PORT-004 obligation before wider shared notices ship: preserve its dated co-tenant, guarantor and authorized-contact recipient rights and preferences, without granting blanket conversation, document or other-household access. Every applicable recipient read, reply, attachment and new publication rechecks current native authority and the original grant; retained history or a replacement grant supplies no former authority. Portal publication, staff-recorded physical service, provider acceptance, provider delivery and legally sufficient service remain distinct. These doors perform no automatic or provider send. Failed and uncertain outcomes remain open with an accountable next action and never authorize automatic retry. PORTAL-003 vendor responses supply no resident permission, entry authority or shared-message sending authority. AGENT-005 approval supplies no unattended thread approval or send authority. SAFE-002, SAFE-004 and SAFE-005 apply to attributable history, restricted originals, retention, holds, disposal, readable export and inert restoration.

Remaining PORTAL-006 proof: complete provider-verified building broadcast delivery and uncertain-send reconciliation; missing-permission refusal; before, on and after property-local recipient and authority boundaries; ownership and vendor reassignment, changed resident identity and ended-tenancy cases; the full PORT-004 recipient extension with appropriate reviewed authority; complete attributable audit; and actual legal approval, service-recording, owner and vendor screen interactions. Preserve every original acceptance sentence. Record the clause’s own screens at 1440 and 390 on the landed SHA; each UI acceptance test need assert its points at only one width. Honest provider and legal boundaries establish no completion.

### RL-5 — Scoped request links

**Date:** 25 October 2026 · **Ruled by:** ct · **Clauses governed:** PORTAL-007.

PORTAL-007 binding replacement default: Ct approved with changes on 25 October 2026: the installation owner and currently scoped portfolio managers may prepare, disclose, explicitly send, replace, expire, remind and validate requests using the existing email-link proof fresh within ten minutes. Other staff roles and API credentials have no request-management authority. A request grants no access: check current staff role and portfolio, named recipient identity, live grant and session, household membership dates, property-local ownership dates and expiry on each action; scope failures return 404 and prohibited staff actions 403. Insurance recipients are the named full resident or current property owner for their authorized lease or property; uploads stay submitted until staff review the exact stored original and fingerprint, and static screening is no malware verdict. Attestations require current rights to the exact selected lease document version and retain affirmative consent, identity, time and frozen fingerprint; they execute or activate no lease or renewal (LEASE-011). Notice acknowledgements require established permission, hold on uncertainty and record receipt only; a staff checkbox is an assertion, never legal validation, service, waiver, signature or satisfaction of statutory deadlines (PORT-008, PORTAL-006 and PORTAL-009). Owner decisions require the named current owner with established property and spend authority and pin the exact job revision, vendor, scope, checklist, price, currency and dates; decline completes the decision without approval, and neither outcome supplies joint-owner consent, staff approval, dispatch or payment authority. Opening an email completes nothing. Staff send authorization and recipient consent are separate attributable evidence tied to exact content; changed obligations require newly prepared requests and replacement links cannot substitute terms. Disclosure is limited to the selected action and content, excluding general search, screening, tax, bank and other people’s records; delegated resident contacts retain balance and charge scope, and vendors retain approved or sent assigned work and their own invoices. Each authorized send issues a link for at most seven days and revokes older links. Expiry withdraws links but leaves an open missing item that staff can replace; it is never completion or permanent cancellation. Upload reminders stop after validation and decision reminders stop after a recorded decline. Invalid authority, absent consent, stale terms or content and revoked or expired links refuse without a completion claim. Claimed or uncertain sends never trigger automatic sends or retries; lost submission responses require stored-state inspection. Provider acceptance proves neither delivery nor completion; communication permissions still apply. Authority changes take effect on the next request and end affected sessions; historical statements remain available only for authorized ownership periods. Communication evidence follows SAFE-004’s three-year period inclusive in the property timezone, preserving longer lease and work duties and holds. Eligible erasure removes personal content, originals, search, media and provider artifacts while keeping permitted audit, financial evidence and minimal non-resurrection fences. Backup and readable export retain operating proof and originals but exclude action links, portal identities, grants, sessions and credentials; restored requests gain no authority automatically.

Remaining qualification: PARTIAL: policy is approved with changes, but assertions remain unproved. Qualification map: PORTAL-007 entry 7 and ROLE-001 entry 11, ROLE-002 entry 12, PORT-004 entry 4, PORT-001 entry 1 require before, on and after household and property-local ownership dates (including UTC and local-day disagreement) and refusal after authority changes; SAFE-001 entry 1 and ROLE-001 entry 11 require stale-proof refusal for every command, prohibited roles and credentials, and authority changes between review and mutation; SAFE-002 entry 2 and PORT-007 entry 7 require durable affirmative-consent wording or version and refusal of substituted document bytes; WORK-003 entry 3, ROLE-003 entry 13 and future PORTAL-002 entry 2 require visible decline, stopped reminders, changed-term decisions and preserved spend and independence controls; ROLE-002 entry 12 requires actual seven-day expiry, replacement refusal on reads and submissions, missing-item history and expiry distinct from cancellation; future PORTAL-005 entry 5 and PORTAL-006 entry 6 require send uncertainty and claim-interruption refusal, side-effect-free opens and lost-response once-only completion; SAFE-004 entry 4 and SAFE-005 entry 5 require subject-scoped access, retention and holds, eligible evidence and original erasure and later-journal restore fences; SAFE-005 entry 5 and ROLE-002 entry 12 require original bytes, hashes and attribution in backup and readable export and inert restored open requests until fresh invitations and preparation. LEASE-011 entry 11 and PORTAL-009 entry 9 still require their own legal-execution and statutory-delivery journeys. Future PORTAL-001 entry 1, PORTAL-002 entry 2, PORTAL-003 entry 3 and PORTAL-008 entry 8 inherit applicable identity, scope, consent, revocation and custody duties. PORT-007 remains the separate document clause. No permanent withdrawal state is commissioned; any future such capability belongs to the next free PORTAL-011, initially missing in both documents.

### RL-6 — Emergency escalation plans

**Date:** 26 October 2026 · **Ruled by:** ct · **Clauses governed:** WORK-001.

CT WORK-001, 26 October 2026 — APPROVE WITH RIDERS. Current operation retains installation email, the urgent queue and explicitly reviewed manual phone pages. Before manually paging a backup, authorized emergency staff record the escalation and its reason on the case. The communication send itself requires PORTAL-005 authority and fresh proof; this does not remove existing coordinator authority to record a reasoned manual email escalation. Pages contain no case details and cannot acknowledge or resolve the case.

Future timed automatic escalation remains required. The installation owner or a portfolio manager in the case’s scope may, with native proof fresh within ten minutes, expressly approve a finite escalation plan for that exact open emergency. Approval freezes the case and plan revisions, named on-call and backup recipients, each channel and exact message, the recorded activation instant, positive elapsed delays, maximum attempts, expiry, escalation reason and stop conditions. This approval delegates only the listed timed steps; it does not extend a sign-in session or grant a general sending credential. Changed recipients, content, authority or case terms invalidate affected remaining steps and require new exact approval. Execution rechecks the approver’s live role and scope, the case’s named active responders, current channel consent, STOP suppression and recipient-local quiet hours before each once-only effect. A valid named human acknowledgement, resolution, cancellation, expiry or loss of authority stops unexecuted pages. Provider acceptance, delivery status or voice-call completion does not acknowledge the case and cannot stop escalation as if a person had responded. An uncertain provider attempt holds dependent steps for manual reconciliation; no timer loop or unapproved retry is permitted. Durable plan and attempt identities prevent duplicates after replay or restart, and restored plans have no execution authority.

Emergency urgency supplies no consent or quiet-hours exemption. A phone step with unknown timezone, missing consent, STOP or a quiet-hours conflict is suppressed and recorded with an accountable human next action; no substitute channel or later attempt is silently scheduled. The existing on-call email and urgent queue remain, and the case stays urgent and open. Preserve all approved guidance, 911 and applicable utility instructions, named-human acknowledgement, authorized resolution, field-work evidence, resident follow-up and REPORT-004 obligations. No agent diagnoses danger, treats notification as physical assistance or closes by inference. Gap: real SMS and voice paging, real responder reach, durable timed escalation and interruption and provider-reconciliation evidence remain unproved; approval of this policy is not implementation or provider acceptance.

### RL-7 — Arrival-window replies

**Date:** 26 October 2026 · **Ruled by:** ct · **Clauses governed:** WORK-005.

CT WORK-005, 26 October 2026 — APPROVE WITH RIDERS. A production affirmative arrival reply may record resident confirmation only when PORTAL-005 authenticates the provider event and its current recipient-channel association, and binds it to one unambiguous current arrival invitation for the exact appointment and approved work revisions. Existing resident access permission, restrictions, entry-notice evidence or documented exception, permitted window, current vendor assignment and WORK-004 qualification remain prerequisites. The vendor’s separate current confirmation must already cover that appointment revision before automatic Y confirmation; otherwise the window stays unconfirmed and the reply requires staff review. A signed Y grants no new permission, general access, legally sufficient notice, changed work approval or vendor confirmation. Resident and vendor confirmations are separate evidence; full appointment confirmation requires both. Provider acceptance, an unanswered invitation and a completed call cannot substitute for either confirmation.

A bare Y after any previous arrival invitation in the thread requires staff review and cannot select the newest window by inference. An explicitly bound reply may apply only to its still-current invitation; ambiguity, a changed recipient, cancelled, ended, superseded or stale windows and changed work refuse automatic confirmation. Conflicting replies require staff review, while duplicates retain one confirmation and its original evidence. Staff review does not revive old permission or backdate a resident response: use a newly reviewed invitation or retain a sourced staff-recorded confirmation under its existing honest label and actual recording time. A STOP suppresses phone contact even when the appointment reply itself cannot be matched; it does not itself grant access, confirm attendance or supply appointment-cancellation evidence.

Appointment instants continue using explicit offsets valid for the property’s IANA timezone, refusing skipped times and wrong seasonal offsets and distinguishing repeated times by offset. Message quiet hours use the recipient’s timezone separately. Preserve calendar conflicts, both parties’ confirmation requirements, cancellation and no-show history, new permitted windows on rescheduling, reassignment and changed-work reapproval, and REPORT-004’s actual preparation-to-first-dual-confirmation measure. Cancellation and rescheduling notifications to both parties require separate exact-content human approval and explicit sends; this ruling authorizes no automatic notification. The prior PORTAL-003 vendor response policy remains separate from resident confirmation and entry permission. Gap: actual arrival-message delivery, resident-origin reply identity and binding, notifications, and independent runtime and browser evidence remain unproved. TEST acceptance and signed fixtures prove neither delivery nor resident contact.

### RL-8 — Maintenance budgets, stock and chargebacks

**Date:** 25 October 2026 (19:38Z) · **Ruled by:** ct · **Clauses governed:** WORK-014, WORK-015.

Historical ct ruling, 25 October 2026 19:38Z (verbatim): Terrace WORK-014: approved PARTIAL as proposed (existing bill preparers propose; independent owner or scoped portfolio-manager approvers approve; current rights, exact recipient and source, authorization declaration and version, source tax included, atomic recovery limits, no new readers, no legal determination, notices or money movement), carrying the exact 25 Oct 16:36 ruling; new missing row Chargeback notices, disputes and collection. Each lists its DONE assertions in Acceptance.

### RL-9 — Communication clauses approved as product policy

**Date:** 26 October 2026 · **Ruled by:** ct · **Clauses governed:** WORK-001, PORTAL-005, WORK-005.

CT ruling, 26 October 2026, reviewed pin aaf775ee9c190e3a338292648b7ab36975d3791b: WORK-001, PORTAL-005 and WORK-005 are APPROVE WITH RIDERS as product policy only. This dated ruling supersedes their pending-CT policy characterization, not their implementation gaps or original acceptance journeys. Current sends remain explicitly approved manual once-only attempts. The future timer authorization below is limited to emergency escalation and does not authorize automatic resident messages, cancellation notices, general retries or agent self-approval. All three clauses remain PARTIAL; this ruling yields zero DONE and no status-count change. The 25 October PORTAL-003 ruling remains in force without extension or re-adjudication.

### RL-10 — Prepare-only renewal workloads

**Date:** 26 October 2026 · **Ruled by:** ct · **Clauses governed:** AGENT-005.

**CT ruling, 26 October 2026 — APPROVE WITH RIDERS; AGENT-005 remains PARTIAL.** The current default permits owner-configured, audited, prepare-only renewal workloads using explicit structured lease, condition, communication and approved vacancy and cash inputs. The scoped credential may prepare sourced alternatives and concession comparisons, retain its next human action and stop when the pinned terms, history or authority change. People independently approve exact pricing, legal terms and notices and explicitly perform sends. A counteroffer invalidates the former offer’s authority until a revised offer is separately approved. The owner supplies the required-signer roster from reviewed legal terms; checking recorded names establishes roster completeness only, never verified identity, legally sufficient signatures or provider execution. Staff-recorded originals and exact reviewed future charges retain PORT-005 and LEASE-012 controls; LEASE-011 retains electronic-signature execution. Pre-deadline escalation is an accountable in-app owner next action, not a delivered alert. This workload grants no unattended execution, outbound authority, model call, payment or self-approval and does not withdraw separately approved OPS-003 workflow behavior. Continuing agent stewardship through replies, signatures and verified future rent remains required. This ruling accepts no completion.

### RL-11 — Scheduled report delivery and snapshot custody

**Date:** 24 October 2026 · **Ruled by:** ct · **Clauses governed:** REPORT-006.

Ct approved delivery and installation-only snapshot custody on 24 October 2026: explicit installation-owner approval for each send; existing owner portal fields only, with no new recipient data fields; live recipient grants checked at send; source-verified frozen statements; snapshots excluded from archives; no unattended sends; uncertain outcomes are visible and never retried automatically. Retention default ADOPTED: snapshots remain until the owner explicitly deletes them through an audited path; legal and accountant holds block deletion until released.

### RL-101 — Trust-account designation and recorded transfers

**Date:** 2026-10-28 · **Ruled by:** ct · **Clauses governed:** ACCT-002.

**Question:** May scoped staff prepare and record approved same-beneficiary transfers under owner-designated bank/reserve rules?

**Adopted/proposed default:** Owner-only configuration; scoped preparation/recording; ROLE-003 approval, fresh proof, same property/beneficiary/purpose and dated source-bank reserve.

**Outcome: adopt with rider.** Adopt the designated operating/trust/deposit separation and same-beneficiary/property/purpose transfer fence, with explicit dated reserve and current independent approval; recorded external facts neither initiate bank movement nor verify statement balances.

**Why:** Buildium recommends separate operating/trust accounts and beneficiary ledgers; AppFolio exposes property reserves to owners. Exact role/step-up/reserve implementation is not a common published norm, so the safest default preserves this conservative boundary. The 22 October 10:53Z lane response only said ADOPTED-not-endorsed (lanes/sx/INBOX.md:1990); this is the requested ct approval with the existing ROLE-003 riders.

**Sources:**
- [Buildium recommends segregated accounts and separate owner ledgers.](https://www.buildium.com/blog/property-management-accounting-best-practices/)
- [AppFolio shares owner statements/documents according to property-manager publication.](https://www.appfolio.com/help/owner)

**Placement:** State designated-purpose/reserve checks once in ACCT-002's transfer point; cite ROLE-001 scope, ROLE-003 independent approval and SAFE-001 fresh-proof door rules.

**Current-main evidence:** CONTRACT.md:147 (clause), :595 (Status row); `6b59564aaa1715aafb654ff8d64e5ad9ab9a1fd9`.

**Engineering/proof boundary:** No new bank transfer, bank statement verification or legal trust-account certification. Actual bank movement/reconciliation and local counsel-reviewed deposit rules remain owed.

### RL-102 — Original invoice disclosure follows exact owner entitlement

**Date:** 2026-10-28 · **Ruled by:** ct · **Clauses governed:** ACCT-012, PORTAL-002.

**Question:** May an owner read an exact approved invoice original only when its complete historical allocation belongs to that owner?

**Adopted/proposed default:** Current owner grant; exact approved bytes; every historical allocation wholly belongs to that owner on invoice date; joint-beneficiary originals await staff review.

**Outcome: adopt with rider.** Adopt live ownership-period and exact-original authorization; withhold a whole original that would disclose another beneficiary's information until a reviewed audience-safe release or extract exists, without withholding the entitled owner's scoped ledger facts. Approval changes or revoked grants end access immediately.

**Why:** AppFolio publishes selected owner packets/documents and limits active-property views by ownership. No common norm determines how to disclose a mixed-beneficiary original; the safest default withholds unredacted cross-owner bytes while retaining the full joint-owner disclosure target as unfinished work.

**Sources:**
- [AppFolio shares owner statements/documents according to property-manager publication.](https://www.appfolio.com/help/owner)

**Placement:** Use one original-disclosure door rule in ACCT-012, cited by PORTAL-002; keep source allocation dates and current original revision in that rule, not copied into both clauses.

**Current-main evidence:** CONTRACT.md:167 (clause), :605 (Status row); `6b59564aaa1715aafb654ff8d64e5ad9ab9a1fd9`.

**Engineering/proof boundary:** Shared-beneficiary original review/extract workflow remains owed, alongside complete statements, publication corrections, distribution sources, delivery, bundles, bank tie-out and REPORT-007. No new send/payment/bank-change authority.

### RL-103 — Bounded workload evidence and current authority

**Date:** 2026-10-28 · **Ruled by:** ct · **Clauses governed:** AGENT-008.

**Question:** May owner-managed prepare-only workloads retain inspectable scoped evidence without granting new execution authority?

**Adopted/proposed default:** Owner-only audited workload management; explicit structured inputs; current implementation prepares only, with existing work and resident-access approvals.

**Outcome: adopt with rider.** Carry forward the 23 October 13:05Z approved slice: owner-managed audited workloads, scoped credential evidence, structured arguments, fingerprinted document text discarded, and existing work/resident-access checks on appointment recording; this slice grants no unattended, outbound, model, money or approval execution.

**Why:** AppFolio presents Realm-X as property-manager-enabled assistance; it does not establish a universal tool disposition. The lane already approved this bounded slice (lanes/sx/INBOX.md:2725). Preserve those riders, while the standard's company policy and fixed role/no-self-expansion rules govern future agent tools; no implementation limit narrows the complete target.

**Sources:**
- [AppFolio makes Realm-X services available at the property manager's discretion.](https://www.appfolio.com/terms/homeowner_tenant_portal)

**Placement:** Record the existing slice once in AGENT-008's own point and cite ROLE-002/ROLE-003 authority; express future tools under the standard's Base agent policy model, without duplicating a product-wide approval preset.

**Current-main evidence:** CONTRACT.md:389 (clause), :685 (Status row); `6b59564aaa1715aafb654ff8d64e5ad9ab9a1fd9`.

**Engineering/proof boundary:** Other credential/workload families remain unintegrated. This entry records prior lane approval, not an extension of agent autonomy or execution. Preserve all fixed controls and pending implementation/proof.

### RL-104 — Explicit card consent with zero payer surcharge

**Date:** 2026-10-28 · **Ruled by:** ct · **Clauses governed:** PAY-003.

**Question:** May an eligible resident or scoped receipt staff explicitly initiate a single hosted card payment with the property absorbing fees?

**Adopted/proposed default:** Current full resident or receipt staff explicitly consents; no delegates/keys, saved method or mandate; zero payer fee; verified canonical provider event posts once.

**Outcome: adopt with rider.** Adopt exact one-payment hosted authorization and zero payer surcharge; staff actions require both current receipt authority and recorded payer authorization, not ownership alone. Provider receipts bind the reserved amount/currency/mode/intent, and settlement into designated banks remains a separate verified fact.

**Why:** AppFolio and Buildium expose payer-chosen card payments; fee policies vary, so there is no common norm mandating a surcharge. The safest lawful default is no payer surcharge and explicit consent, while rejecting the inference that a redirect, owner attestation or provider fee means money settled in a bank.

**Sources:**
- [AppFolio residents manage payments, maintenance and shared documents in their portal.](https://www.appfolio.com/help/online-portal)
- [Buildium residents select payment methods and manage scheduled payments.](https://www.buildium.com/resident-site-help-center/resident-site-help-center/)

**Placement:** Put consent/eligibility in PAY-003's own payment point; cite PAY-005's shared admission/reservation gate, ACCT-002 bank mapping and PORTAL-001 receipt boundary once.

**Current-main evidence:** CONTRACT.md:119 (clause), :583 (Status row); `6b59564aaa1715aafb654ff8d64e5ad9ab9a1fd9`.

**Engineering/proof boundary:** Actual live ledger receipt, decline/authentication/replay, deposit rules and settlement remain unproved; test-only remains. A production charge, launch or spend still requires the owner's actual authorization.

### RL-105 — Lease-policy admission and explicit credit use

**Date:** 2026-10-28 · **Ruled by:** ct · **Clauses governed:** PAY-005.

**Question:** May owner-configured partial-payment policy coexist with existing receipt-recorder authority and human credit decisions?

**Adopted/proposed default:** Owner configures policy; current receipt recorders keep recording/outcome rights; no automatic credit use or outbound instruction.

**Outcome: adopt with rider.** Carry forward the 23 October 11:07Z approval: owner-only policy configuration; policy/source disclosure only to owner and in-scope portfolio managers; existing ROLE-001 receipt recorders retain their authority; credit is used only by an explicit recorded human decision.

**Why:** AppFolio/Buildium resident payment products leave collection policy to property management; neither creates payment authority from a credit balance. The lane already approved this precise boundary (lanes/sx/INBOX.md:2562); the remaining pending marker is stale, not grounds for a new policy.

**Sources:**
- [AppFolio residents manage payments, maintenance and shared documents in their portal.](https://www.appfolio.com/help/online-portal)
- [Buildium documents manager-controlled payment policies and scheduled resident payments.](https://www.buildium.com/resident-site-help-center/resident-site-help-center/)

**Placement:** State admission/reservation and credit-use rules once in PAY-005, cited by PAY-002/003/004 and PAY-013; retain ROLE-001 role/scope enforcement as a shared door rule.

**Current-main evidence:** CONTRACT.md:123 (clause), :585 (Status row); `6b59564aaa1715aafb654ff8d64e5ad9ab9a1fd9`.

**Engineering/proof boundary:** Online collection doors must inherit the same policy. Existing PAY-013 completion does not prove the remaining doors; preserve receipt recording versus actual collection/settlement boundaries and all partial status.

### RL-106 — Reviewed late-fee calculation and correcting entries

**Date:** 2026-10-28 · **Ruled by:** ct · **Clauses governed:** PAY-006.

**Question:** May owner-configured fees be posted/waived manually while counsel-reviewed local content remains unproved?

**Adopted/proposed default:** Owner fee configuration; exact reviewed manual posting and reasoned waivers; no automatic collection, notices or paid-fee reversal.

**Outcome: adopt with rider.** Carry forward the 23 October 11:07Z approval: owner-configured exact-revision reviewed posting, attributable retained waivers, no automatic collection/notice/late-fee posting, and a paid-fee change only by a new dated correcting entry under the existing finance gates.

**Why:** Buildium says the property manager determines late-fee policy; that is not a legal validation of a formula. The lane approved this slice with PORT-008 counsel content expressly left open (lanes/sx/INBOX.md:2563). No common norm replaces applicable lease and jurisdictional limits.

**Sources:**
- [Buildium states that property managers determine resident late-fee policy.](https://www.buildium.com/resident-site-help-center/resident-site-help-center/)
- [AppFolio residents manage payments, maintenance and shared documents in their portal.](https://www.appfolio.com/help/online-portal)

**Placement:** Keep the review/waiver/correction condition in PAY-006's own point, citing PORT-008 policy content and PAY-009's correcting-money controls once.

**Current-main evidence:** CONTRACT.md:125 (clause), :586 (Status row); `6b59564aaa1715aafb654ff8d64e5ad9ab9a1fd9`.

**Engineering/proof boundary:** Synthetic owner-reviewed packs are not counsel-reviewed rules. Other bases, legal pack contents and provider execution stay open; this ruling signs off no state/local fee law.

### RL-107 — Independent approval of recorded financial actions

**Date:** 2026-10-28 · **Ruled by:** ct · **Clauses governed:** PAY-009.

**Question:** May current scoped staff record exact approved external refunds/credits/write-offs without claiming provider execution?

**Adopted/proposed default:** Owner/in-scope portfolio-manager preparation; ROLE-003 independence; fresh proof; immutable audited revisions; no outbound instruction.

**Outcome: adopt with rider.** Carry forward the 23 October 11:07Z approval: exact revision and independent approver, fresh email-link proof for execution recording, explicit owner-recorded external facts, original receipts/owner allocations preserved, no bank/provider instruction from this slice.

**Why:** Buildium grants refunds through explicit accounting permissions and source/account facts; AppFolio distinguishes portal payment operations. No common norm makes manually entered confirmation a processor receipt. The lane already imposed these safeguards (lanes/sx/INBOX.md:2564), including ROLE-003's existing explicitly labelled sole-operator condition rather than a new exception.

**Sources:**
- [Buildium refund operations require accounting permissions and explicit source bank/payee facts.](https://developer.buildium.com/)
- [AppFolio portal payment terms distinguish authorized payment operations and in-process transactions.](https://www.appfolio.com/terms/owner_portal)

**Placement:** Keep exact independent approval/recorded-fact boundary once in PAY-009, with ROLE-003 and SAFE-001 citations; ACCT-017/018 inherit it before their rails ship.

**Current-main evidence:** CONTRACT.md:131 (clause), :589 (Status row); `6b59564aaa1715aafb654ff8d64e5ad9ab9a1fd9`.

**Engineering/proof boundary:** Provider refunds/reconciliation, negotiable checks, ACH and clearance remain unbuilt/unproved. A check draft or staff external issuance entry proves no rail completion. No status changes.

### RL-108 — Resident-requested financial delivery and live audience custody

**Date:** 2026-10-28 · **Ruled by:** ct · **Clauses governed:** PAY-010.

**Question:** May the owner explicitly deliver a resident-requested statement to its currently eligible household email with fresh proof?

**Adopted/proposed default:** Owner-only fresh-proof delivery, affirmative resident request, current household eligibility and protected financial-document custody.

**Outcome: adopt with rider.** Adopt explicit requested delivery with current recipient/document entitlement, exact frozen financial content and fresh sender authority; send claims reserve one attempt and distinguish accepted, failed, uncertain and actual delivery. Household membership alone grants no other resident's private document, payment or consent authority.

**Why:** AppFolio provides resident portal documents and payment history under authenticated access. No common norm prescribes this exact owner-only email process; safest default binds the request, current audience and financial original while retaining accessible resident self-service and full delivery/follow-up target.

**Sources:**
- [AppFolio residents manage payments, maintenance and shared documents in their portal.](https://www.appfolio.com/help/online-portal)

**Placement:** State requested financial-copy delivery once as PAY-010's door rule, citing ROLE-001/SAFE-001 sender scope and SAFE-004/005 custody; portal readers use the existing document entitlement rule.

**Current-main evidence:** CONTRACT.md:133 (clause), :590 (Status row); `6b59564aaa1715aafb654ff8d64e5ad9ab9a1fd9`.

**Engineering/proof boundary:** Provider acceptance is not delivery. Keep actual delivery/failure follow-up and complete PDF/CSV/source-transaction evidence owed; owner-only is the current sending slice, not removal of resident downloads.

### RL-109 — Vendor proposals and independently verified bank references

**Date:** 2026-10-28 · **Ruled by:** ct · **Clauses governed:** PORTAL-003.

**Question:** May assigned qualified vendors submit availability/invoice originals while staff keep booking/payment decisions and independent bank-reference verification?

**Adopted/proposed default:** Vendor submissions for staff review only; owner prepares external bank references; another scoped person verifies exact revision with fresh proof.

**Outcome: adopt with rider.** Adopt current assigned/qualified vendor proposals and original-invoice intake with no implied booking, resident permission, notice, payable approval or payment; bank-reference preparation and independent exact-revision verification both require fresh proof, replacement holds prior verification and no full bank details reach portals.

**Why:** AppFolio vendors propose work/invoices and distinguish under-review, approved and sent payment states; payment setup uses extra verification. Preserve the 25 October PORTAL-003 appointment/estimate ruling as recorded on main and lanes/sx/INBOX.md:4689. No common norm fixes Terrace's reference-only independent-review scheme; the safest default prevents submitted evidence from becoming money authority.

**Sources:**
- [AppFolio scopes vendors to assigned work; submitted invoices await customer review.](https://www.appfolio.com/help/vendor-portal)

**Placement:** Keep vendor submission authority once in PORTAL-003's own point; cite ROLE-001/003 and SAFE-001 bank-change door rule. ACCT-008/018 retain verified destination and actual payment execution.

**Current-main evidence:** CONTRACT.md:187 (clause), :614 (Status row); `6b59564aaa1715aafb654ff8d64e5ad9ab9a1fd9`.

**Engineering/proof boundary:** Vendor-origin completion originals, access-detail time windows and independent runtime proof remain. This approves only the new availability/invoice/reference defaults, without re-adjudicating the older vendor response ruling.

### RL-110 — Attributed field capture and private offline drafts

**Date:** 2026-10-28 · **Ruled by:** ct · **Clauses governed:** WORK-007.

**Question:** May owner/portfolio-manager direct capture use explicit-consent local drafts and manual reconciliation without creating a vendor grant?

**Adopted/proposed default:** Existing owner/PM identities only; consented credential-free drafts; explicit sync/deletion; scope changes reopen approval; resident resolution separate.

**Outcome: adopt with rider.** Carry forward the 23 October 10:14Z approval: current scoped operators capture their own evidence, no new vendor grant; private-device drafts require consent and are discarded on revocation/restore, scope changes void approval and need fresh approval/handoff, and reconciliation against current scope is manual and audited.

**Why:** AppFolio supports mobile offline inspection photos/notes, but publishes no common exact draft-custody protocol with Buildium. The safest default keeps truthful authorship and explicit device custody. The lane already ruled the capture/scope boundary (lanes/sx/INBOX.md:2534); preserve every rider and the separate resident-resolution check. Compared with AppFolio's built-in offline capture, Buildium uses HappyCo and later synchronization; neither source specifies Terrace's consent/revocation custody protocol.

**Sources:**
- [AppFolio documents offline mobile capture of inspection photos and notes.](https://www.appfolio.com/articles/2021-year-in-review)
- [AppFolio scopes vendors to assigned work; submitted invoices await customer review.](https://www.appfolio.com/help/vendor-portal)
- [Buildium uses HappyCo for offline inspection capture and later synchronization.](https://www.buildium.com/features/mobile-property-inspection-app/)

**Placement:** Put offline custody and scope-reconciliation once in WORK-007's own point, cite SAFE-004/005 and ROLE-002; WORK-008 owns resident resolution.

**Current-main evidence:** CONTRACT.md:255 (clause), :628 (Status row); `6b59564aaa1715aafb654ff8d64e5ad9ab9a1fd9`.

**Engineering/proof boundary:** Vendor/technician portal capture remains a named obligation, not excluded by owner/PM current authority. Prove revocation/restore draft disposal and all original evidence/provenance points; no status promotion.

### RL-111 — Inspection acknowledgements keep their real source

**Date:** 2026-10-28 · **Ruled by:** ct · **Clauses governed:** WORK-011.

**Question:** May scoped staff record sourced resident acknowledgement and consented offline originals without claiming resident authentication or signatures?

**Adopted/proposed default:** Owner/PM current writes; consented private-device drafts; staff-sourced acknowledgement/disputes; human proposals with no financial/work/send effect.

**Outcome: adopt with rider.** Carry forward the 23 October 10:14Z approval: ROLE-001-scoped owner/PM writes, consented private drafts discarded on revocation/restore, no credentials beyond the device session, sourced staff acknowledgement labelled as such, immutable disputes and attributable human resolutions; inspection decisions themselves execute no money, work or outbound action.

**Why:** AppFolio supports offline inspections and separately shares inspection reports with owners. No common norm makes a staff-entered statement a resident signature or a condition comparison a deposit charge. The lane already imposed these source/custody riders (lanes/sx/INBOX.md:2533), which stay binding. Compared with AppFolio's built-in offline capture, Buildium uses HappyCo and later synchronization; neither source specifies Terrace's consent/revocation custody protocol.

**Sources:**
- [AppFolio documents offline mobile inspection capture.](https://www.appfolio.com/articles/2021-year-in-review)
- [AppFolio shares owner statements/documents according to property-manager publication.](https://www.appfolio.com/help/owner)
- [Buildium uses HappyCo for offline inspection capture and later synchronization.](https://www.buildium.com/features/mobile-property-inspection-app/)

**Placement:** Keep acknowledgement provenance/offline custody in WORK-011's own point, cite ROLE-001/003 and SAFE-004/005; financial deductions follow their existing separate approval door.

**Current-main evidence:** CONTRACT.md:263 (clause), :632 (Status row); `6b59564aaa1715aafb654ff8d64e5ad9ab9a1fd9`.

**Engineering/proof boundary:** Resident self-acknowledgement and vendor/technician inspection authority stay named gaps. Retain every media, comparison, dispute and evidence-gated proposal obligation and partial status.
