# Incumbent migration and reversible cutover: exact terms

The exact terms of the clauses in the “Incumbent migration and reversible cutover” area of [CONTRACT.md](../../../CONTRACT.md). Each clause there is the requirement; the terms below define it.

## MOVE-002 — Move in from AppFolio

[Format evidence](https://www.appfolio.com/help/owner) and [API access](https://www.appfolio.com/stack/partners/api).

## MOVE-003 — Move in from Buildium

[Export evidence](https://help.buildium.com/hc/s/article/Export-data-from-Buildium-1557494404392) and [Open API](https://developer.buildium.com/).

## MOVE-004 — Move in from Rent Manager

[Report evidence](https://www.rentmanager.com/release-notes-jan/) and [Web API](https://www.rentmanager.com/software-customization/).

## MOVE-005 — Move in from Yardi Breeze

[Report formats](https://www.yardibreeze.com/blog/2025/07/custom-reports-ad-hoc/).

## MOVE-006 — Move in from DoorLoop

[Export formats](https://support.doorloop.com/en/articles/14489492-what-s-new-doorloop-reporting-v2-version-9-2-0) and [API](https://support.doorloop.com/en/articles/7902913-api-documentation-and-where-to-find-help).

## MOVE-007 — Move in from TurboTenant

[Payments export](https://support.turbotenant.com/en/articles/4802302-how-to-export-your-rent-payments-to-csv), [rent roll](https://support.turbotenant.com/en/articles/13862432-rent-roll), [lease PDFs](https://support.turbotenant.com/en/articles/14728527-how-do-i-download-or-print-a-lease-agreement).

## MOVE-009 — Undo untouched imports and protect later operations

Exact semantics: undo succeeds only when every record of the import reverses. It first reads each imported record's edits and every later-work record of every kind (receipts and charges, signed lease versions, renewals, inspections, maintenance, assets, schedules, household members, lease terms, delinquency, close corrections, recovery authorizations, utility allocations, holds, privacy requests, bills, emergencies, incoming transfers, and any record a later clause links to it). If any exists, it answers 409 with the conflict report and reverses nothing. A race that stops it partway is reported as stopped with counts, never as undone. Compensation is a separate owner-only operation through the same import door and authority: the owner reads a conflict report listing, per imported record, its proposed disposition (reverse if untouched, otherwise retain as edited or dependency) and every blocking record, then approves its exact fingerprint with a required reason. Each batch is fenced to that approved snapshot, and any change answers 409 and writes nothing. Untouched records reverse. Blocked records stay as ordinary native records, permanently outside that import's undo, with their provenance, source claims, mappings and originals intact. No later work, money, ledger line, signed document, history, tombstone or journal entry is changed, detached or deleted, and corrections are separate native operations. The outcome reads “compensated”, never “undone”, and its approval, reason, dispositions and counts appear in the journal, history, reconciliation, backup and readable export. Repeats and apply replays write nothing and never re-create reversed records; re-importing a reversed source row needs a new reviewed approval. Erasure redacts the reason and evidence and keeps the disposition. An import that cannot be fenced this way, including every import created with strict reversal, is refused (409) and left unchanged until a reviewed reversal-policy conversion exists. Incumbent importers (MOVE-002 to MOVE-007), MOVE-008 cutover and MOVE-010 history inherit this before they ship.
