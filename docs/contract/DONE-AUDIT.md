# Carried-done audit at 6b59564aaa1715aafb654ff8d64e5ad9ab9a1fd9

Every acceptance point of every clause that was done at `6b59564aaa1715aafb654ff8d64e5ad9ab9a1fd9`, one row per outcome the point names, with the line of the assertion in a file the clause’s Evidence cell lists. A `none` row makes its clause partial, and the clause’s Gap names the unasserted outcome. No clause done at that commit was split, so each audited clause is its own only part.

Words that only restated a Base duty left two points and are not audited here: “with no unsolicited outbound telemetry” (SAFE-007) and “and no outbound telemetry” (OPEN-001), both BASE-DATA-005.

| Clause | Point | Outcome | Asserting test | Result |
| --- | --- | --- | --- | --- |
| `TER-001` | 1 | ordinary invitation and sign-in | `tests/terrace.test.mjs:91` | asserted |
| `TER-001` | 1 | protected commands as a preparer are refused | `tests/terrace.test.mjs:54` | asserted |
| `TER-001` | 1 | a cross-origin command is refused | `tests/terrace.test.mjs:53` | asserted |
| `TER-001` | 1 | a revoked manager’s old session is refused | `tests/terrace.test.mjs:68` | asserted |
| `TER-001` | 1 | forbidden requests make no changes (representative: the refused creates leave one tenancy) | `tests/terrace.test.mjs:473` | asserted |
| `TER-002` | 1 | a tenancy is created through the command door | `tests/terrace.test.mjs:60` | asserted |
| `TER-002` | 1 | its linked row opens in the app | `tests/terrace.test.mjs:62` | asserted |
| `TER-002` | 1 | detail forms address that tenancy | `tests/terrace.test.mjs:63` | asserted |
| `TER-002` | 1 | detail shows its saved terms (rent and cadence) | `tests/terrace.test.mjs:641` | asserted |
| `TER-003` | 1 | two renewals are prepared as a member | `tests/terrace.test.mjs:256` | asserted |
| `TER-003` | 1 | member approval is refused | `tests/terrace.test.mjs:255` | asserted |
| `TER-003` | 1 | one is approved by a person with approval rights | `tests/terrace.test.mjs:258` | asserted |
| `TER-003` | 1 | the second is stale | `tests/terrace.test.mjs:256` | asserted |
| `TER-003` | 1 | prior terms remain until the renewed period starts | `tests/terrace.test.mjs:814` | asserted |
| `TER-003` | 1 | the approver is retained | `tests/terrace.test.mjs:258` | asserted |
| `TER-004` | 1 | a charge and a partial receipt are posted | `tests/terrace.test.mjs:207` | asserted |
| `TER-004` | 1 | a replayed reference is refused | `tests/terrace.test.mjs:201` | asserted |
| `TER-004` | 1 | two racing receipts: one posts, one is refused | `tests/terrace.test.mjs:203` | asserted |
| `TER-004` | 1 | a reduction with a reason | `tests/terrace.test.mjs:205` | asserted |
| `TER-004` | 1 | the resulting balance through the state door | `tests/terrace.test.mjs:205` | asserted |
| `TER-005` | 1 | a member prepares an arrears follow-up | none | none |
| `TER-005` | 1 | the owner approves it | none | none |
| `TER-005` | 1 | its saved message is read back through the tenancy state | none | none |
| `TER-005` | 1 | its due date is read back | none | none |
| `TER-005` | 1 | its approval is read back | none | none |
| `TER-006` | 1 | a statement spanning the charge and receipts downloads | `tests/terrace.test.mjs:207` | asserted |
| `TER-006` | 1 | opening plus movements reconcile to closing (representative period statement) | `tests/terrace.test.mjs:627` | asserted |
| `TER-006` | 1 | receipt references are in it | `tests/terrace.test.mjs:207` | asserted |
| `TER-006` | 1 | the same download is refused to a member | `tests/terrace.test.mjs:208` | asserted |
| `TER-007` | 1 | an empty completion is refused | `tests/terrace.test.mjs:267` | asserted |
| `TER-007` | 1 | an invalid image is refused | `tests/terrace.test.mjs:268` | asserted |
| `TER-007` | 1 | a photo uploads through the multipart door | `tests/terrace.test.mjs:270` | asserted |
| `TER-007` | 1 | identical bytes are retrieved | `tests/terrace.test.mjs:271` | asserted |
| `TER-007` | 1 | the inspection completes with notes | `tests/terrace.test.mjs:278` | asserted |
| `TER-008` | 1 | packet retrieval before approval is refused | `tests/terrace.test.mjs:274` | asserted |
| `TER-008` | 1 | the current job is approved once | `tests/terrace.test.mjs:275` | asserted |
| `TER-008` | 1 | the packet is addressed to the trade | `tests/terrace.test.mjs:276` | asserted |
| `TER-008` | 1 | the external Sent-folder reference is recorded | `tests/terrace.test.mjs:278` | asserted |
| `TER-008` | 1 | the approval fingerprint is retained | `tests/terrace.test.mjs:278` | asserted |
| `TER-009` | 1 | the published CSV previews and its reviewed preview applies | `tests/terrace.test.mjs:476` | asserted |
| `TER-009` | 1 | an incorrect fingerprint is rejected | `tests/terrace.test.mjs:474` | asserted |
| `TER-009` | 1 | originals and journal are inspected | `tests/terrace.test.mjs:477` | asserted |
| `TER-009` | 1 | an untouched batch is undone | `tests/terrace.test.mjs:479` | asserted |
| `TER-009` | 1 | undo after later work is refused | `tests/terrace.test.mjs:487` | asserted |
| `TER-010` | 1 | the backup restores into a fresh installation | `tests/terrace.test.mjs:541` | asserted |
| `TER-010` | 1 | tenancy and ledger compare equal | `tests/terrace.test.mjs:541` | asserted |
| `TER-010` | 1 | photo bytes compare equal | `tests/terrace.test.mjs:542` | asserted |
| `TER-010` | 1 | retained import undo works after restore | `tests/terrace.test.mjs:544` | asserted |
| `TER-010` | 1 | a second restore into occupied data is refused | `tests/terrace.test.mjs:545` | asserted |
| `TER-011` | 1 | an incorrect confirmation is rejected | none | none |
| `TER-011` | 1 | the tenancy is erased | none | none |
| `TER-011` | 1 | absent state and photo 404 | none | none |
| `TER-011` | 1 | the later journal exports | none | none |
| `TER-011` | 1 | an older archive plus that journal is refused in a clean destination | none | none |
| `PORT-001` | 1 | a US company is created | `tests/terrace.test.mjs:610` | asserted |
| `PORT-001` | 1 | two property time zones | `tests/terrace.test.mjs:619` | asserted |
| `PORT-001` | 1 | USD rent is entered in exact cents | `tests/terrace.test.mjs:619` | asserted |
| `PORT-001` | 1 | a daylight-saving boundary is crossed | `tests/terrace.test.mjs:627` | asserted |
| `PORT-001` | 1 | an AUD historical tenancy imports as AUD | `tests/terrace.test.mjs:635` | asserted |
| `PORT-001` | 1 | currency boundaries are shown without conversion | `tests/terrace.test.mjs:637` | asserted |
| `PORT-001` | 1 | period boundaries are shown with their offsets | `tests/terrace.test.mjs:639` | asserted |
| `PORT-001` | 1 | old balances are never relabelled | `tests/terrace.test.mjs:681` | asserted |
| `PORT-002` | 1 | a duplex with two units | `tests/terrace.test.mjs:727` | asserted |
| `PORT-002` | 1 | one lease ends | `tests/terrace.test.mjs:724` | asserted |
| `PORT-002` | 1 | a resident moves to the other unit | `tests/terrace.test.mjs:724` | asserted |
| `PORT-002` | 1 | each unit’s dated occupancy | `tests/terrace.test.mjs:722` | asserted |
| `PORT-002` | 1 | each unit’s lease history | `tests/terrace.test.mjs:723` | asserted |
| `PORT-003` | 1 | two owners with shares | `tests/terrace.test.mjs:755` | asserted |
| `PORT-003` | 1 | ownership changes on a dated transfer | `tests/terrace.test.mjs:755` | asserted |
| `PORT-003` | 1 | income allocation on each side of the date | `tests/terrace.test.mjs:746` | asserted |
| `PORT-003` | 1 | reserve allocation on each side of the date | `tests/terrace.test.mjs:750` | asserted |
| `PORT-003` | 1 | statement allocation on each side of the date | `tests/terrace.test.mjs:747` | asserted |
| `PAY-001` | 1 | preview with a concession and a mid-month move-in | `tests/terrace.test.mjs:690` | asserted |
| `PAY-001` | 1 | the run posts | `tests/terrace.test.mjs:695` | asserted |
| `PAY-001` | 1 | a replayed run posts nothing | `tests/terrace.test.mjs:696` | asserted |
| `PAY-001` | 1 | future rent is amended | `tests/terrace.test.mjs:702` | asserted |
| `PAY-001` | 1 | each period posts once | `tests/terrace.test.mjs:707` | asserted |
| `PAY-001` | 1 | posted history is preserved | `tests/terrace.test.mjs:705` | asserted |
| `REPORT-001` | 1 | as-of roll before and after a scheduled move-in | `tests/terrace.test.mjs:813` | asserted |
| `REPORT-001` | 1 | as-of roll before and after a scheduled renewal | `tests/terrace.test.mjs:814` | asserted |
| `REPORT-001` | 1 | occupied and vacant unit counts reconcile | `tests/terrace.test.mjs:811` | asserted |
| `REPORT-001` | 1 | effective rents reconcile | `tests/terrace.test.mjs:813` | asserted |
| `REPORT-001` | 1 | the same filtered data downloads | `tests/terrace.test.mjs:818` | asserted |
| `REPORT-001` | 2 | collected of billed for the portfolio | `tests/terrace.test.mjs:833` | asserted |
| `REPORT-001` | 2 | leases paid in full | `tests/terrace.test.mjs:833` | asserted |
| `REPORT-001` | 2 | per-lease ACH, card, cash, partial and unpaid states | `tests/terrace.test.mjs:830` | asserted |
| `REPORT-001` | 2 | every total reconciles to resident-ledger receipts | `tests/terrace.test.mjs:831` | asserted |
| `ACCT-009` | 1 | rent posted under a dated fee schedule | `tests/terrace.test.mjs:844` | asserted |
| `ACCT-009` | 1 | a lease renewal’s fee | `tests/terrace.test.mjs:847` | asserted |
| `ACCT-009` | 1 | fees are calculated | `tests/terrace.test.mjs:843` | asserted |
| `ACCT-009` | 1 | the reserve is calculated | `tests/terrace.test.mjs:858` | asserted |
| `ACCT-009` | 1 | a replayed run charges nothing twice | `tests/terrace.test.mjs:845` | asserted |
| `ACCT-009` | 1 | the owner statement names the exact agreement | `tests/terrace.test.mjs:856` | asserted |
| `ACCT-016` | 1 | one water invoice allocates by an occupancy formula | `tests/terrace.test.mjs:866` | asserted |
| `ACCT-016` | 1 | the allocation is reviewed before it posts | `tests/terrace.test.mjs:874` | asserted |
| `ACCT-016` | 1 | parking is posted | `tests/terrace.test.mjs:880` | asserted |
| `ACCT-016` | 1 | taxable ancillary charges carry the reviewed tax | `tests/terrace.test.mjs:882` | asserted |
| `ACCT-016` | 1 | source-linked allocations equal the approved recoverable total | `tests/terrace.test.mjs:875` | asserted |
| `WORK-013` | 1 | a resident moves out and the board opens | `tests/terrace.test.mjs:763` | asserted |
| `WORK-013` | 1 | a repair dependent on inspection is delayed | `tests/terrace.test.mjs:770` | asserted |
| `WORK-013` | 1 | the ready date is revised | `tests/terrace.test.mjs:770` | asserted |
| `WORK-013` | 1 | cleaning and listing move with it | `tests/terrace.test.mjs:770` | asserted |
| `WORK-013` | 1 | checks complete in dependency order | `tests/terrace.test.mjs:772` | asserted |
| `WORK-013` | 1 | the true available date is published | `tests/terrace.test.mjs:778` | asserted |
| `PORT-004` | 1 | co-tenants and a guarantor are added | `tests/terrace.test.mjs:798` | asserted |
| `PORT-004` | 1 | one person transfers between leases | `tests/terrace.test.mjs:799` | asserted |
| `PORT-004` | 1 | balances stay with each household | `tests/terrace.test.mjs:795` | asserted |
| `PORT-004` | 1 | recipients stay with each household | `tests/terrace.test.mjs:799` | asserted |
| `PORT-004` | 1 | document rights stay with each household | `tests/terrace.test.mjs:796` | asserted |
| `WORK-002` | 1 | an HVAC asset with its warranty | `tests/terrace.test.mjs:375` | asserted |
| `WORK-002` | 1 | a repair is opened on it | `tests/terrace.test.mjs:372` | asserted |
| `WORK-002` | 1 | the asset is replaced | `tests/terrace.test.mjs:371` | asserted |
| `WORK-002` | 1 | both service histories | `tests/terrace.test.mjs:373` | asserted |
| `WORK-002` | 1 | warranty attribution | `tests/terrace.test.mjs:372` | asserted |
| `WORK-002` | 1 | owner-cost attribution | `tests/terrace.test.mjs:373` | asserted |
| `WORK-003` | 1 | two repair quotes compare | `tests/terrace.test.mjs:307` | asserted |
| `WORK-003` | 1 | an owner decision is needed above the spending limit | `tests/terrace.test.mjs:310` | asserted |
| `WORK-003` | 1 | the approved scope changes | `tests/terrace.test.mjs:319` | asserted |
| `WORK-003` | 1 | dispatch stays blocked until the new terms are approved | `tests/terrace.test.mjs:320` | asserted |
| `WORK-004` | 1 | a plumber is selected by area and insurance | `tests/terrace.test.mjs:282` | asserted |
| `WORK-004` | 1 | expired coverage on reassignment | `tests/terrace.test.mjs:286` | asserted |
| `WORK-004` | 1 | the qualification hold | `tests/terrace.test.mjs:287` | asserted |
| `WORK-004` | 1 | a documented exception | `tests/terrace.test.mjs:292` | asserted |
| `WORK-004` | 1 | no silent dispatch | `tests/terrace.test.mjs:294` | asserted |
| `WORK-008` | 1 | the vendor’s completion is recorded | `tests/terrace.test.mjs:338` | asserted |
| `WORK-008` | 1 | the resident reports it still leaks and the job reopens | `tests/terrace.test.mjs:341` | asserted |
| `WORK-008` | 1 | a return visit | `tests/terrace.test.mjs:347` | asserted |
| `WORK-008` | 1 | confirmation is obtained | `tests/terrace.test.mjs:345` | asserted |
| `WORK-008` | 1 | both attempts are retained | `tests/terrace.test.mjs:347` | asserted |
| `WORK-008` | 1 | the final resolution is retained | `tests/terrace.test.mjs:349` | asserted |
| `WORK-010` | 1 | annual HVAC and quarterly safety schedules order their due occurrences | `tests/terrace.test.mjs:391` | asserted |
| `WORK-010` | 1 | a replayed scheduler run creates nothing | `tests/terrace.test.mjs:386` | asserted |
| `WORK-010` | 1 | one occurrence is deferred | `tests/terrace.test.mjs:390` | asserted |
| `WORK-010` | 1 | the asset is replaced and the schedule follows it | `tests/terrace.test.mjs:398` | asserted |
| `WORK-010` | 1 | exactly one order per due occurrence | `tests/terrace.test.mjs:388` | asserted |
| `WORK-010` | 1 | an explicit overdue exception | `tests/terrace.test.mjs:401` | asserted |
| `REPORT-004` | 1 | a reopened repair is not resolved | `tests/terrace.test.mjs:407` | asserted |
| `REPORT-004` | 1 | an unconfirmed completion is not resolved | `tests/terrace.test.mjs:409` | asserted |
| `REPORT-004` | 1 | durations trace to the records | `tests/terrace.test.mjs:410` | asserted |
| `REPORT-004` | 1 | owner cost traces to approved estimates | `tests/terrace.test.mjs:411` | asserted |
| `REPORT-004` | 1 | the filtered unresolved queue exports | `tests/terrace.test.mjs:421` | asserted |
| `ROLE-003` | 1 | an over-limit repair escalates | `tests/terrace.test.mjs:431` | asserted |
| `ROLE-003` | 1 | an over-limit owner distribution | none | none |
| `ROLE-003` | 1 | the payee changes after approval | `tests/terrace.test.mjs:436` | asserted |
| `ROLE-003` | 1 | approval escalates again | `tests/terrace.test.mjs:437` | asserted |
| `ROLE-003` | 1 | execution is refused | `tests/terrace.test.mjs:435` | asserted |
| `ROLE-003` | 1 | an independent person approves the exact new inputs | `tests/terrace.test.mjs:441` | asserted |
| `ROLE-003` | 2 | a bank or entity change without fresh email-link proof is refused (403; representative: the entity step of the same fresh-proof rule) | `tests/terrace.test.mjs:77` | asserted |
| `SAFE-001` | 1 | every private door refuses a signed-out request | `tests/terrace.test.mjs:166` | asserted |
| `SAFE-001` | 1 | each restricted role is refused out of scope and out of role | `tests/terrace.test.mjs:93` | asserted |
| `SAFE-001` | 1 | a revoked session is refused | `tests/terrace.test.mjs:68` | asserted |
| `SAFE-001` | 1 | a cross-site write to a fresh-proof step is refused | `tests/terrace.test.mjs:78` | asserted |
| `SAFE-001` | 1 | the same step without step-up is refused | `tests/terrace.test.mjs:77` | asserted |
| `SAFE-001` | 1 | unauthorized writes are denied | `tests/terrace.test.mjs:124` | asserted |
| `SAFE-002` | 1 | a lease change leaves attributable history | `tests/terrace.test.mjs:151` | asserted |
| `SAFE-002` | 1 | approved work leaves history | `tests/terrace.test.mjs:154` | asserted |
| `SAFE-002` | 1 | a screening-file export leaves history | none | none |
| `SAFE-002` | 1 | a payment reversal leaves history | none | none |
| `SAFE-002` | 1 | an authorized audit view shows actor and source | `tests/terrace.test.mjs:151` | asserted |
| `SAFE-002` | 1 | edits and deletion of accounting history are refused | `tests/terrace.test.mjs:162` | asserted |
| `ACCT-011` | 1 | a reconciled month closes | `tests/terrace.test.mjs:223` | asserted |
| `ACCT-011` | 1 | a backdated posting is refused | `tests/terrace.test.mjs:224` | asserted |
| `ACCT-011` | 1 | a reopening and adjustment are approved | `tests/terrace.test.mjs:242` | asserted |
| `ACCT-011` | 1 | old and new statements compare | `tests/terrace.test.mjs:241` | asserted |
| `ACCT-011` | 1 | the reopening reason is kept | `tests/terrace.test.mjs:240` | asserted |
| `ACCT-011` | 1 | original entries are unchanged | `tests/terrace.test.mjs:243` | asserted |
| `ACCT-011` | 2 | an accountant’s correction stays a proposal | `tests/terrace.test.mjs:221` | asserted |
| `ACCT-011` | 2 | it posts only when an authorized person approves it | `tests/terrace.test.mjs:242` | asserted |
| `ACCT-011` | 3 | a close is a history row with its approver | `tests/terrace.test.mjs:249` | asserted |
| `ACCT-011` | 3 | a reopening is a history row with its reason | `tests/terrace.test.mjs:248` | asserted |
| `ROLE-001` | 1 | each role works across its two assigned portfolios | `tests/terrace.test.mjs:91` | asserted |
| `ROLE-001` | 1 | another property’s API read and download answer 404 | `tests/terrace.test.mjs:99` | asserted |
| `ROLE-001` | 1 | a payout attempted as leasing staff is refused | none | none |
| `ROLE-001` | 1 | an access change as bookkeeper is refused | `tests/terrace.test.mjs:127` | asserted |
| `ROLE-001` | 1 | every other unauthorized path is denied | `tests/terrace.test.mjs:124` | asserted |
| `ROLE-001` | 2 | leasing staff posting an external receipt is refused | `tests/terrace.test.mjs:122` | asserted |
| `ROLE-001` | 2 | leasing staff running the charge run is refused | `tests/terrace.test.mjs:123` | asserted |
| `SAFE-005` | 1 | a complete property exports and restores into a fresh installation | `tests/terrace.test.mjs:541` | asserted |
| `SAFE-005` | 1 | balances compare equal | `tests/terrace.test.mjs:541` | asserted |
| `SAFE-005` | 1 | signed files compare equal | none | none |
| `SAFE-005` | 1 | communications compare equal | none | none |
| `SAFE-005` | 1 | work evidence compares equal | `tests/terrace.test.mjs:542` | asserted |
| `SAFE-005` | 1 | providers to reconnect are listed | none | none |
| `SAFE-005` | 1 | sessions are not imported | `tests/terrace.test.mjs:547` | asserted |
| `SAFE-005` | 1 | no money movement repeats | none | none |
| `LEASE-005` | 1 | a listing enquiry is received | `tests/prospects.mjs:20` | asserted |
| `LEASE-005` | 1 | a duplicate email is held for review | `tests/prospects.mjs:23` | asserted |
| `LEASE-005` | 1 | the match is reviewed | `tests/prospects.mjs:29` | asserted |
| `LEASE-005` | 1 | a leasing person is assigned | `tests/prospects.mjs:37` | asserted |
| `LEASE-005` | 1 | the prospect is answered | `tests/prospects.mjs:39` | asserted |
| `LEASE-005` | 1 | it follows through showing and application | `tests/prospects.mjs:57` | asserted |
| `LEASE-005` | 1 | source attribution stays intact | `tests/prospects.mjs:31` | asserted |
| `LEASE-005` | 2 | leasing staff work a prospect in their portfolio | `tests/prospects.mjs:54` | asserted |
| `LEASE-005` | 2 | another portfolio’s prospect answers 404 | `tests/prospects.mjs:27` | asserted |
| `LEASE-012` | 1 | a renewal window is scheduled | `tests/renewals.mjs:27` | asserted |
| `LEASE-012` | 1 | an accepted offer | `tests/renewals.mjs:176` | asserted |
| `LEASE-012` | 1 | a declined offer | `tests/renewals.mjs:177` | asserted |
| `LEASE-012` | 1 | an unanswered offer stays open | `tests/renewals.mjs:177` | asserted |
| `LEASE-012` | 1 | approved delivery is traced | `tests/renewals.mjs:95` | asserted |
| `LEASE-012` | 1 | executed future terms are traced | `tests/renewals.mjs:147` | asserted |
| `LEASE-012` | 1 | the unresolved household stays in the follow-up queue | `tests/renewals.mjs:170` | asserted |
| `LEASE-012` | 2 | the percentage increase is shown before approval | `tests/renewals.mjs:78` | asserted |
| `LEASE-012` | 2 | against the dated market rent | `tests/renewals.mjs:78` | asserted |
| `LEASE-012` | 2 | with the estimated turnover cost | `tests/renewals.mjs:78` | asserted |
| `LEASE-012` | 3 | signed renewal documents are in the readable export | `tests/renewals.mjs:259` | asserted |
| `LEASE-012` | 3 | they come back with a restore | `tests/renewals.mjs:267` | asserted |
| `LEASE-012` | 4 | executed terms activate the reviewed versioned schedule | `tests/renewals.mjs:158` | asserted |
| `LEASE-012` | 4 | with its signed source | `tests/renewals.mjs:149` | asserted |
| `LEASE-012` | 4 | prior versions are retained | none | none |
| `LEASE-012` | 5 | actual approved renewals source the cash comparison with dated terms | `tests/renewals.mjs:187` | asserted |
| `LEASE-012` | 5 | proposed alternatives stay labelled assumptions | `tests/renewals.mjs:190` | asserted |
| `LEASE-012` | 6 | campaign, reply and executed outcomes are dated sources in the leasing report | `tests/renewals.mjs:179` | asserted |
| `LEASE-012` | 6 | no signature is inferred | `tests/renewals.mjs:176` | asserted |
| `LEASE-012` | 6 | no delivery is inferred | none | none |
| `PORT-005` | 1 | a lease with a concession and a pet charge is entered | `tests/leases.mjs:33` | asserted |
| `PORT-005` | 1 | a mid-month amendment is approved | `tests/leases.mjs:80` | asserted |
| `PORT-005` | 1 | previewed charges reconcile to the resident ledger | `tests/leases.mjs:77` | asserted |
| `PORT-005` | 1 | source clauses reconcile to the resident ledger | `tests/leases.mjs:77` | asserted |
| `PORT-005` | 1 | the signed prior version is retained | `tests/leases.mjs:83` | asserted |
| `ROLE-002` | 1 | a resident is invited | `tests/portal.mjs:55` | asserted |
| `ROLE-002` | 1 | joint owners are invited | `tests/portal.mjs:102` | asserted |
| `ROLE-002` | 1 | a vendor is invited | `tests/portal.mjs:92` | asserted |
| `ROLE-002` | 1 | an assignment changes | `tests/portal.mjs:283` | asserted |
| `ROLE-002` | 1 | an ownership date changes | `tests/portal.mjs:110` | asserted |
| `ROLE-002` | 1 | the crawl of pages, downloads and APIs before revocation shows nothing private to others | `tests/portal.mjs:77` | asserted |
| `ROLE-002` | 1 | the same crawl after revocation is closed | `tests/portal.mjs:317` | asserted |
| `PORT-007` | 1 | an amended lease uploads as a new version | `tests/documents.mjs:34` | asserted |
| `PORT-007` | 1 | a restricted screening PDF uploads | `tests/documents.mjs:110` | asserted |
| `PORT-007` | 1 | the current version is found from its unit | `tests/documents.mjs:48` | asserted |
| `PORT-007` | 1 | the prior lease is recovered | `tests/documents.mjs:52` | asserted |
| `PORT-007` | 1 | a vendor and an unrelated resident are denied | `tests/portal.mjs:94` | asserted |
| `PORT-007` | 2 | another portfolio’s document answers 404 to search and direct download | `tests/documents.mjs:117` | asserted |
| `PORT-007` | 3 | each document is an original file with its SHA-256 in the readable export | `tests/documents.mjs:144` | asserted |
| `PORT-007` | 3 | it restores with the backup | `tests/documents.mjs:135` | asserted |
| `PORT-007` | 4 | PORT-005 signed originals stay reachable | `tests/documents.mjs:64` | asserted |
| `PORT-007` | 4 | PORT-005 versions stay intact | `tests/leases.mjs:83` | asserted |
| `PORT-007` | 4 | PORT-005 source clauses stay intact | `tests/leases.mjs:77` | asserted |
| `PORT-007` | 4 | PORT-005 retention stays intact | `tests/leases.mjs:128` | asserted |
| `PORT-009` | 1 | a video uploads to an inspection | `tests/record-media.mjs:48` | asserted |
| `PORT-009` | 2 | each photo or video is an original file with its SHA-256 in the readable export | `tests/record-media.mjs:78` | asserted |
| `PORT-009` | 2 | it restores with the backup | `tests/record-media.mjs:73` | asserted |
| `PAY-013` | 1 | two voucher leases under different owners post tenant and HAP portions | `tests/hap.mjs:35` | asserted |
| `PAY-013` | 1 | one PHA ACH covering both is allocated | `tests/hap-remittances.mjs:42` | asserted |
| `PAY-013` | 1 | a HAP change effective three months back | `tests/hap-changes.mjs:21` | asserted |
| `PAY-013` | 1 | one month’s abatement | `tests/hap-changes.mjs:32` | asserted |
| `PAY-013` | 1 | tenant, PHA and owner balances | `tests/hap-changes.mjs:41` | asserted |
| `PAY-013` | 1 | the delinquency report separates tenant from PHA arrears | `tests/hap.mjs:41` | asserted |
| `PAY-013` | 1 | no late fee on PHA arrears | `tests/hap-changes.mjs:56` | asserted |
| `PAY-013` | 2 | each HAP contract and split names its signed version and source clause | `tests/hap.mjs:35` | asserted |
| `PAY-013` | 2 | each effective revision names its source | `tests/hap-changes.mjs:51` | asserted |
| `PAY-013` | 2 | amendments are reviewed before posting | `tests/hap-changes.mjs:14` | asserted |
| `PAY-013` | 3 | actual tenant and PHA portions source the forecast separately | `tests/hap-scenarios.mjs:39` | asserted |
| `PAY-013` | 3 | payer outcomes source the forecast | `tests/hap-scenarios.mjs:48` | asserted |
| `PAY-013` | 3 | HAP arrears never shift to residents | `tests/hap-scenarios.mjs:64` | asserted |
| `PAY-013` | 4 | tenant versus housing-authority arrears in the as-of report | `tests/hap.mjs:41` | asserted |
| `PAY-013` | 4 | the unpaid-HAP delinquency case | `tests/hap-changes.mjs:52` | asserted |
| `PAY-013` | 4 | dated source drills | `tests/hap.mjs:42` | asserted |
| `PAY-013` | 4 | no inferred settlement or resolution | `tests/hap.mjs:41` | asserted |
| `ACCT-001` | 1 | rent posts across two properties | `tests/journal.mjs:78` | asserted |
| `ACCT-001` | 1 | a deposit posts | `tests/journal.mjs:86` | asserted |
| `ACCT-001` | 1 | a vendor expense posts | `tests/journal.mjs:87` | asserted |
| `ACCT-001` | 1 | an owner contribution posts | none | none |
| `ACCT-001` | 1 | an unbalanced entry is refused | `tests/journal.mjs:64` | asserted |
| `ACCT-001` | 1 | the trial balance is inspected | `tests/journal.mjs:86` | asserted |
| `ACCT-001` | 1 | each subledger traces back to source | `tests/journal.mjs:81` | asserted |
| `ACCT-001` | 2 | a receipt posted twice | `tests/journal.mjs:78` | asserted |
| `ACCT-001` | 2 | the duplicate is reversed | `tests/journal.mjs:78` | asserted |
| `ACCT-001` | 2 | resident, property and owner entries trace to the reversal | `tests/journal.mjs:81` | asserted |
| `ACCT-001` | 2 | the original entry stays in place | `tests/journal.mjs:82` | asserted |
| `ACCT-006` | 1 | batched rent matches | `tests/reconcile.mjs:38` | asserted |
| `ACCT-006` | 1 | the fee matches | `tests/reconcile.mjs:38` | asserted |
| `ACCT-006` | 1 | an outstanding check is carried | `tests/reconcile.mjs:43` | asserted |
| `ACCT-006` | 1 | a cleared owner ACH batch matches | `tests/reconcile.mjs:38` | asserted |
| `ACCT-006` | 1 | a missing deposit leaves a difference | `tests/reconcile.mjs:34` | asserted |
| `ACCT-006` | 1 | one exception is resolved | `tests/reconcile.mjs:38` | asserted |
| `ACCT-006` | 1 | the remaining difference prevents a balanced three-way sign-off | `tests/reconcile.mjs:39` | asserted |
| `ACCT-007` | 1 | the same invoice twice is refused | `tests/bills.mjs:27` | asserted |
| `ACCT-007` | 1 | an approved landscaping bill splits across properties | `tests/bills.mjs:51` | asserted |
| `ACCT-007` | 1 | exceeding an owner’s limit holds the bill | `tests/bills.mjs:108` | asserted |
| `ACCT-007` | 1 | the approval route | `tests/bills.mjs:112` | asserted |
| `ACCT-007` | 1 | the resulting payable | `tests/bills.mjs:112` | asserted |
| `ACCT-007` | 2 | a monthly HOA-dues bill for a residential owner generates two months | `tests/bills.mjs:128` | asserted |
| `ACCT-007` | 2 | a replayed run generates nothing | `tests/bills.mjs:123` | asserted |
| `ACCT-007` | 2 | exactly one bill per month | `tests/bills.mjs:128` | asserted |
| `ACCT-007` | 2 | each is a payable to the association | `tests/bills.mjs:128` | asserted |
| `ACCT-007` | 2 | no association-dues door exists | `tests/terrace.test.mjs:578` | asserted |
| `ACCT-007` | 3 | an expense before a transfer stays with the seller | `tests/bills.mjs:51` | asserted |
| `ACCT-007` | 3 | an expense after the transfer belongs to the buyer | `tests/bills.mjs:57` | asserted |
| `ACCT-013` | 1 | earned unpaid rent and an unpaid bill are recorded | `tests/financial-reports.mjs:24` | asserted |
| `ACCT-013` | 1 | cash and accrual P&L compare | `tests/financial-reports.mjs:25` | asserted |
| `ACCT-013` | 1 | cash and accrual balance sheets compare | `tests/financial-reports.mjs:27` | asserted |
| `ACCT-013` | 1 | each difference drills to its original transaction | `tests/financial-reports.mjs:34` | asserted |
| `PORTAL-004` | 1 | a leaking-tap request with a photo | `tests/portal-requests.mjs:26` | asserted |
| `PORTAL-004` | 1 | its access restrictions | `tests/portal-requests.mjs:24` | asserted |
| `PORTAL-004` | 1 | another household’s report stays separate | `tests/portal-requests.mjs:73` | asserted |
| `PORTAL-004` | 1 | the tracking link follows scheduled work | `tests/portal-requests.mjs:62` | asserted |
| `PORTAL-004` | 1 | and the resident-confirmed resolution | `tests/portal-requests.mjs:72` | asserted |
| `PORTAL-004` | 2 | staff outside the property’s portfolios get 404 | `tests/portal-requests.mjs:31` | asserted |
| `PORTAL-004` | 2 | staff whose role lacks the action get 403 | `tests/portal-requests.mjs:31` | asserted |
| `PORTAL-004` | 3 | a resident safety report opens the WORK-001 case | `tests/portal-requests.mjs:42` | asserted |
| `PORTAL-004` | 3 | it shows the approved guidance version | `tests/portal-requests.mjs:41` | asserted |
| `PORTAL-004` | 3 | it alerts on call | `tests/portal-requests.mjs:43` | asserted |
| `WORK-006` | 1 | an approved order is dispatched | `tests/dispatch.mjs:34` | asserted |
| `WORK-006` | 1 | vendor acceptance | `tests/dispatch.mjs:63` | asserted |
| `WORK-006` | 1 | a parts hold | `tests/dispatch.mjs:63` | asserted |
| `WORK-006` | 1 | a missed appointment | `tests/dispatch.mjs:64` | asserted |
| `WORK-006` | 1 | reassignment | `tests/dispatch.mjs:64` | asserted |
| `WORK-006` | 1 | notifications | `tests/dispatch.mjs:57` | asserted |
| `WORK-006` | 1 | state history | `tests/dispatch.mjs:63` | asserted |
| `WORK-006` | 1 | the resident issue stays open | `tests/dispatch.mjs:62` | asserted |
| `WORK-014` | 1 | a stocked part is consumed on a repair | `tests/work-budgets.mjs:79` | asserted |
| `WORK-014` | 1 | a budget limit is crossed | `tests/work-budgets.mjs:28` | asserted |
| `WORK-014` | 1 | a resident chargeback is proposed | `tests/work-budgets.mjs:106` | asserted |
| `WORK-014` | 1 | one allocation is approved | `tests/work-budgets.mjs:116` | asserted |
| `WORK-014` | 1 | stock reconciles | `tests/work-budgets.mjs:84` | asserted |
| `WORK-014` | 1 | the payable reconciles | `tests/work-budgets.mjs:131` | asserted |
| `WORK-014` | 1 | the receivable reconciles | `tests/work-budgets.mjs:129` | asserted |
| `WORK-014` | 1 | owner cost reconciles | `tests/work-budgets.mjs:116` | asserted |
| `REPORT-002` | 1 | delinquency filters to one owner | `tests/delinquency.mjs:35` | asserted |
| `REPORT-002` | 1 | a returned ACH is included | none | none |
| `REPORT-002` | 1 | an active plan is included | none | none |
| `REPORT-002` | 1 | a voucher lease with unpaid HAP is included | none | none |
| `REPORT-002` | 1 | aging reconciles to resident balances | `tests/delinquency.mjs:32` | asserted |
| `REPORT-002` | 1 | the follow-up owner is shown | `tests/delinquency.mjs:54` | asserted |
| `REPORT-002` | 1 | the next permitted action is shown | `tests/delinquency.mjs:54` | asserted |
| `REPORT-003` | 1 | a vacant unit is followed through showing, lease and move-in | `tests/leasing-report.mjs:48` | asserted |
| `REPORT-003` | 1 | source conversion | `tests/leasing-report.mjs:56` | asserted |
| `REPORT-003` | 1 | vacancy days | `tests/leasing-report.mjs:47` | asserted |
| `REPORT-003` | 1 | the metric drills to dated source events | `tests/leasing-report.mjs:56` | asserted |
| `REPORT-005` | 1 | a unit inspection field is added | `tests/custom-reports.mjs:35` | asserted |
| `REPORT-005` | 1 | it is used in a saved report | `tests/custom-reports.mjs:34` | asserted |
| `REPORT-005` | 1 | it is used in a document template | `tests/custom-reports.mjs:51` | asserted |
| `REPORT-005` | 1 | a sensitive owner field is hidden from leasing staff | `tests/custom-reports.mjs:81` | asserted |
| `REPORT-005` | 1 | their export and merge cannot reveal it | `tests/custom-reports.mjs:79` | asserted |
| `REPORT-007` | 1 | repair before listing compares with immediate marketing with a concession | `tests/scenarios.mjs:49` | asserted |
| `REPORT-007` | 1 | a changed vacancy assumption recalculates cash and ready dates | `tests/scenarios.mjs:53` | asserted |
| `REPORT-007` | 1 | actual books stay unchanged | `tests/scenarios.mjs:63` | asserted |
| `OPS-001` | 1 | a read-only accountant credential connects | `tests/credentials.mjs:32` | asserted |
| `OPS-001` | 1 | an agent credential granted prepare scope connects | `tests/credentials.mjs:73` | asserted |
| `OPS-001` | 1 | paginated records are traversed | `tests/credentials.mjs:47` | asserted |
| `OPS-001` | 1 | an idempotent work proposal is retried once | `tests/credentials.mjs:73` | asserted |
| `OPS-001` | 1 | approval is refused | `tests/credentials.mjs:76` | asserted |
| `OPS-001` | 1 | money commands are refused (representative of payouts under the same scope rule) | `tests/credentials.mjs:78` | asserted |
| `OPS-001` | 1 | cross-property reads are refused | `tests/credentials.mjs:71` | asserted |
| `OPS-001` | 2 | a credential is refused an action its role lacks (403) | `tests/credentials.mjs:79` | asserted |
| `OPS-001` | 2 | a record outside its portfolios answers 404 | `tests/credentials.mjs:71` | asserted |
| `OPS-001` | 3 | minting without fresh email-link proof is refused (403) | `tests/credentials.mjs:25` | asserted |
| `SAFE-004` | 1 | erasure is requested under an accounting hold | `tests/retention.mjs:48` | asserted |
| `SAFE-004` | 1 | retained obligations are reviewed | `tests/retention.mjs:55` | asserted |
| `SAFE-004` | 1 | eligible documents are erased | `tests/retention.mjs:62` | asserted |
| `SAFE-004` | 1 | a later hold is released | `tests/retention.mjs:72` | asserted |
| `SAFE-004` | 1 | provider artifacts are deleted | none | none |
| `SAFE-004` | 1 | search copies are deleted | `tests/retention.mjs:68` | asserted |
| `SAFE-004` | 1 | media is deleted | `tests/retention.mjs:61` | asserted |
| `SAFE-004` | 1 | resurrection is blocked on restore | `tests/retention.mjs:77` | asserted |
| `SAFE-007` | 1 | a clean checkout launches with rer dev | `tests/owned-installation.mjs:33` | asserted |
| `SAFE-007` | 1 | setup completes with no sample portfolio | `tests/owned-installation.mjs:38` | asserted |
| `SAFE-007` | 1 | a real tenancy is entered | `tests/owned-installation.mjs:54` | asserted |
| `SAFE-007` | 1 | it exports | `tests/owned-installation.mjs:66` | asserted |
| `SAFE-007` | 1 | a documented upgrade applies in a separate installation | `tests/owned-installation.mjs:103` | asserted |
| `SAFE-007` | 1 | useful redacted diagnostics | `tests/owned-installation.mjs:128` | asserted |
| `BOUND-003` | 1 | a safety request is received | `tests/emergencies.mjs:39` | asserted |
| `BOUND-003` | 1 | reviewed 911 and utility guidance is given | `tests/emergencies.mjs:34` | asserted |
| `BOUND-003` | 1 | a named on-call person acknowledges | `tests/emergencies.mjs:59` | asserted |
| `BOUND-003` | 1 | the case stays open until authorized resolution | `tests/emergencies.mjs:60` | asserted |
| `BOUND-003` | 1 | resolution needs field-work evidence and resident follow-up | `tests/emergencies.mjs:65` | asserted |
| `BOUND-004` | 1 | the app offers no commercial, CAM or association field | `tests/terrace.test.mjs:581` | asserted |
| `BOUND-004` | 1 | the API offers no such command | `tests/terrace.test.mjs:578` | asserted |
| `BOUND-004` | 1 | setup states the limit | `tests/terrace.test.mjs:585` | asserted |
| `BOUND-004` | 1 | the docs state the limit | `tests/site/assert-run-site.mjs:32` | asserted |
| `BOUND-004` | 1 | a commercial lease in an import is held as an exception | `tests/terrace.test.mjs:592` | asserted |
| `OPEN-001` | 1 | LICENSE is MIT | `tests/site/assert-run-site.mjs:26` | asserted |
| `OPEN-001` | 1 | the project metadata is MIT | `tests/site/assert-run-site.mjs:24` | asserted |
| `OPEN-001` | 1 | the run site shows the one command | `tests/site/assert-run-site.mjs:23` | asserted |
| `OPEN-001` | 1 | the command reaches setup with an empty portfolio | `tests/open-installation.mjs:29` | asserted |
| `OPEN-001` | 1 | no license keys, caps or upgrade prompts | `tests/site/assert-run-site.mjs:30` | asserted |
| `OPEN-001` | 1 | a provider and its pricing are named before connection | `tests/site/provider-costs.mjs:14` | asserted |
| `DEMO-001` | 1 | the homepage link reaches the hosted demo signed out | `tests/demo-hosted.mjs:24` | asserted |
| `DEMO-001` | 1 | an owner and a preparer sign in separately | `tests/demo-hosted.mjs:51` | asserted |
| `DEMO-001` | 1 | a renewal is approved | `tests/demo-hosted.mjs:62` | asserted |
| `DEMO-001` | 1 | a maintenance handoff is approved | `tests/demo-hosted.mjs:80` | asserted |
| `DEMO-001` | 1 | the other visitor sees none of it | `tests/demo-hosted.mjs:84` | asserted |
| `DEMO-001` | 1 | no outbound email, SMS or payment leaves the demo | `tests/demo.test.mjs:93` | asserted |
| `DEMO-001` | 1 | a production build with RER_DEMO is refused | `tests/demo.test.mjs:19` | asserted |
| `DEMO-001` | 1 | a fresh installation is empty | `tests/demo.test.mjs:30` | asserted |
| `TER-012` | 1 | the built site opens / | `tests/app-journey.mjs:35` | asserted |
| `TER-012` | 1 | it opens /run | `tests/app-journey.mjs:38` | asserted |
| `TER-012` | 1 | it opens /docs | `tests/app-journey.mjs:39` | asserted |
| `TER-012` | 1 | a missing path is a real 404 | `tests/app-journey.mjs:42` | asserted |
| `TER-012` | 1 | linked tenancy actions in the signed-in app | `tests/app-journey.mjs:78` | asserted |
| `TER-012` | 1 | the rent ledger at 1440 pixels with real records | `tests/app-journey.mjs:93` | asserted |
| `TER-012` | 1 | the rent ledger at 390 pixels | `tests/app-journey.mjs:98` | asserted |

58 clauses, 392 rows: 367 asserted, 25 none, 0 moved. Demoted to partial: TER-005, TER-011, ROLE-003, SAFE-002, ROLE-001, SAFE-005, LEASE-012, ACCT-001, REPORT-002, SAFE-004.
