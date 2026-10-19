# Terrace commands

All reads and writes authenticate a current Base operator session. Send the session cookie privately, never in a URL. Mutations require `Origin` equal to the installation origin, including command-line requests. Revoking an operator or changing their sign-in tier invalidates their sessions. There is no anonymous or implicit agent authority.

ROLE-001: the Authority column lists the roles whose rows in the capability table (`tt_role_actions`, migration 0030) grant each command; the owner holds every command. Staff with assigned portfolios reach only tenancies on units in those portfolios: any other record answers `404`, and a command outside their role answers `403` before any record is read. Company, legal entity, operating account and portfolio changes and tenancies without a unit need all-portfolio scope. `operator.invite` (displayName, email, role, allPortfolios or `portfolio:<id>` fields), `operator.role` (operatorId, role, scope as for invite) and `operator.status` (operatorId, status) are the owner's alone and recorded.

ROLE-003: `maintenance.approve` and `proposal.approve` answer `403 preparer_cannot_approve` to whoever prepared the terms (a revision, quote selection or reassignment makes that person a preparer), unless no other active operator who did not prepare them can approve; that approval is labelled `self-approved: no second person` (`approval_label`, and `approvalLabel` in the approval snapshot). Above the owner's quote requirement, approval needs that many quotes (`409 quotes_required`).

SAFE-001: `entity.add`, `account.add`, `operator.invite`, `operator.role`, `operator.status`, `factor.require` and `factor.reset` also need Base's fresh email-link proof: the sign-in link that created the session, or `POST /auth/step-up` with `{"action":"credentials:mint"}` and then that link opened in the same browser, within 10 minutes; otherwise `403 step_up_required`. A person with a confirmed authenticator, or anyone signing in by email link while the owner requires a second factor, gets `403 second_factor_required` on every other door until `factor.verify` passes for that sign-in (or, if not enrolled, `factor.start` and `factor.confirm`). Identity-provider (OIDC) sign-ins count as passed.

`GET /api/commands` lists commands. `GET /api/state` lists the company, legal entities, operating accounts and tenancies (each with its `currency` and `time_zone`); `GET /api/state?tenancy=ID` adds its rent, household, proposals, inspections and maintenance. `POST /api/commands` accepts JSON `{ "command": "name", ...fields }` and returns `{ "ok": true, "result": ... }`, or a non-200 `{ "ok": false, "error", "message" }`. Uploads use multipart form data to the same URL.

| Command | Fields | Authority |
| --- | --- | --- |
| `tenancy.create` | address (or unitId: the unit's address and property zone are used), ownerName, ownerEmail, tenantName, tenantEmail, startDate, endDate, rent, cadence, optional timeZone (a US IANA zone; default the office zone). Always USD. | Owner, portfolio manager, leasing |
| `portfolio.add` | name | Owner, portfolio manager |
| `property.add` | portfolioId, name, address, kind (single_family/duplex/multifamily/townhouse/condo), timeZone | Owner, portfolio manager |
| `unit.add`, `unit.update` | propertyId, identifier (add) or unitId, version (update); bedrooms, bathrooms, amenities, rentable | Owner, portfolio manager |
| `tenancy.end` | tenancyId, moveOut, reason; the lease is kept | Owner, portfolio manager, leasing |
| `tenancy.transfer` | tenancyId, unitId, moveIn, optional endDate and rent | Owner, portfolio manager, leasing |
| `turnover.open` | unitId, moveOut (the unit must be vacant the next day) | Owner, portfolio manager, leasing, maintenance coordinator |
| `turnover.task.update` | taskId, optional assignee, durationDays, delayDays, quote | Owner, portfolio manager, leasing, maintenance coordinator |
| `turnover.task.submit` | taskId | Owner, portfolio manager, leasing, maintenance coordinator, member |
| `turnover.task.check` | taskId; its dependencies must be checked | Owner, portfolio manager, leasing, maintenance coordinator |
| `turnover.publish` | turnoverId; every task checked | Owner, portfolio manager, leasing, maintenance coordinator |
| `household.add` | tenancyId, role (co_tenant/guarantor/occupant/emergency_contact/authorized_contact), name, optional email, phone, contactBy, joined | Owner, portfolio manager, leasing |
| `household.leave` | memberId, left | Owner, portfolio manager, leasing |
| `household.move` | memberId, toTenancyId, date | Owner, portfolio manager, leasing |
| `tenancy.timezone` | tenancyId, timeZone (US IANA zone); recorded dates and currency do not change | Owner, portfolio manager |
| `company.save` | name, officeAddress, officeEmail, officePhone, timeZone (office, US IANA zone). Country US, currency USD | Owner, portfolio manager |
| `entity.add` | legalName, ein (nine digits; format checked, not verified with the IRS); needs a saved company | Owner, portfolio manager, bookkeeper |
| `account.add` | entityId, name, bankName, last4. A USD reference; no full account number; no money moves | Owner, portfolio manager, bookkeeper |
| `renewal.prepare` | tenancyId, endDate, rent, source | Owner, portfolio manager, leasing, member |
| `arrears.prepare` | tenancyId, message, followUpDate | Owner, portfolio manager, bookkeeper, member |
| `proposal.approve`, `proposal.reject` | proposalId | Owner, portfolio manager; current tenancy version required by saved proposal |
| `rent.charge` | tenancyId, dueDate, amount, description, reference | Owner, portfolio manager, bookkeeper |
| `rent.receipt` | chargeId, amount, receivedDate, reference, optional method (ach/card/cash/check/other) | Owner, portfolio manager, bookkeeper |
| `rent.adjust` | chargeId, amount, reason | Owner, portfolio manager, bookkeeper |
| `term.add` | tenancyId, kind (rent/utility/pet/parking/concession), description, amount per period, starts, optional ends | Owner, portfolio manager, bookkeeper |
| `term.amend` | termId, effective (after the term's last posted period), amount | Owner, portfolio manager, bookkeeper |
| `charges.preview` | month (YYYY-MM); returns lines, missing terms and the fingerprint | Owner, portfolio manager, bookkeeper |
| `charges.post` | month, fingerprint from the preview | Owner, portfolio manager, bookkeeper |
| `inspection.create` | tenancyId, date, notes | Owner, portfolio manager, maintenance coordinator |
| `inspection.photo` | inspectionId, version, file (multipart JPEG/PNG) | Owner, portfolio manager, maintenance coordinator |
| `inspection.complete` | inspectionId, version, notes | Owner, portfolio manager, maintenance coordinator |
| `maintenance.prepare` | tenancyId, title, vendorId and trade (a directory vendor) or tradeName and tradeEmail (an unlisted vendor, held), dueDate, estimate, optional assetId (an in-service asset of the tenancy). Returns the qualification `issues` | Owner, portfolio manager, maintenance coordinator, member |
| `vendor.add`, `vendor.update` | name, email, phone, specialties, serviceAreas, w9 (received/missing), insuranceExpires, optional licenseNumber with licenseExpires, availability, rate, standing (preferred/approved/blocked); update adds vendorId, version | Owner, portfolio manager, maintenance coordinator |
| `maintenance.reassign` | jobId, vendorId, optional trade, version; prepared work only | Owner, portfolio manager, maintenance coordinator |
| `schedule.add` | tenancyId, title, trade, vendorId, optional assetId or inspectionId, intervalMonths, firstDue, budget, optional leadDays (default 30) | Owner, portfolio manager, maintenance coordinator |
| `schedule.defer` | scheduleId, dueDate (an occurrence without an order), deferTo, reason | Owner, portfolio manager, maintenance coordinator |
| `schedule.run` | none; returns created and existing order counts | Owner, portfolio manager, maintenance coordinator |
| `maintenance.exception` | jobId, reason; records a documented exception for the job's current qualification issues | Owner, portfolio manager |
| `asset.add` | tenancyId, kind, location, make, model, serial, installedDate, optional warrantyProvider with warrantyEnds, manual, replaceBy, replacementCost | Owner, portfolio manager, maintenance coordinator |
| `asset.replace` | assetId plus the replacement's asset.add fields; installedDate is the replacement date | Owner, portfolio manager, maintenance coordinator |
| `maintenance.approve` | jobId, version | Owner, portfolio manager |
| `maintenance.sent` | jobId, version, reference | Owner, portfolio manager, maintenance coordinator, after external handoff |
| `work.limits` | optional quotesNeeded (2 to 10) and quotesAbove (estimate amount) for the owner's quote requirement (ROLE-003); tenancyId, limit, budget? | Owner, portfolio manager; the owner's per-job limit and yearly budget, recorded by staff for the owner (WORK-003) |
| `quote.add` | jobId, vendorId or vendorName + vendorEmail, scope, availableDate, amount, tax? | Owner, portfolio manager, maintenance coordinator, member, before handoff |
| `quote.select` | jobId, version, quoteId | Owner, portfolio manager, maintenance coordinator, member; reopens approval |
| `maintenance.revise` | jobId, version, scope?, title?, estimate?, dueDate? | Owner, portfolio manager, maintenance coordinator, member; reopens approval |
| `maintenance.owner` | jobId, version, decision (approved/declined), source (email/document/call), reference | Owner, portfolio manager, only above the limit or budget; recorded by staff for the owner |
| `owner.add` | kind (individual/entity), legalName, email, mailingAddress (PORT-003) | Owner, portfolio manager; all portfolios |
| `owner.w9` | ownerId, status (requested/received), date, location (where the signed W-9 is kept; required when received). Recorded by staff; no TIN is stored or validated | Owner, portfolio manager; all portfolios |
| `ownership.set` | propertyId, effectiveFrom, reason, and `share:<ownerId>` percents (or `shares`: [{ownerId, percent}]) totalling exactly 100; starts after the latest set | Owner, portfolio manager; all portfolios |
| `agreement.set` | propertyId, starts, feePercent (of collected rent), reserve (USD requirement), reference; starts after the latest agreement | Owner, portfolio manager; all portfolios |
| `factor.start` | none. Returns a new authenticator key once (`secret`, `uri`) for the signed-in person (SAFE-001) | Everyone, for themselves |
| `factor.confirm` | code (6 digits from the authenticator). Returns ten single-use recovery codes once | Everyone, for themselves |
| `factor.verify` | code (6 digits) or one unused recovery code; passes the second factor for this sign-in | Everyone, for themselves |
| `factor.require` | required (on/off); needs the owner's own authenticator passed this sign-in and a fresh email-link proof | Owner |
| `factor.reset` | operatorId; needs a fresh email-link proof | Owner |
| `currency.confirm` | currency (AUD/USD) | Owner, once per installation (PORT-001 legacy currency) |
| `completion.record` | jobId, completedDate, summary, reference, callback (warranty/billable, return visits) | Owner, portfolio manager, maintenance coordinator, member, after handoff; the vendor's report recorded by staff (WORK-008) |
| `completion.check` | jobId, outcome (confirmed/unresolved/no_response), note, satisfaction?, safetyConcern? | Owner, portfolio manager, maintenance coordinator, member; the resident's answer recorded by staff, resident not contacted by Terrace |
| `completion.close` | jobId, reason | Owner, portfolio manager; closes without the resident's confirmation |
| `import.preview`, `import.apply`, `import.journal`, `import.undo` | See [move-in contract](docs/move-in.md) | Owner |
| `tenancy.erase` | tenancyId, confirm (exact tenant email) | Owner |
| `data.restore` | backup file, optional journal file, confirm=RESTORE (multipart) | Owner, empty product destination |
| `period.signoff` | month (YYYY-MM, ended in the office time zone), item (receipts, deposits or exceptions), optional note | Owner, bookkeeper (all portfolios) |
| `period.close` | month; needs all three sign-offs and no pending correction | Owner, bookkeeper (all portfolios) |
| `period.reopen` | month, reason | Owner, bookkeeper (all portfolios) |
| `correction.prepare` | tenancyId, kind (charge: dueDate, amount, description, reference; receipt: chargeId, amount, receivedDate, reference, optional method), reason | Owner, portfolio manager, bookkeeper, accountant |
| `correction.approve` / `correction.reject` | correctionId (reject: optional reason); the preparer never approves, and approval is refused while the month is closed | Owner, portfolio manager, bookkeeper |
| `fees.run` | propertyId, month (YYYY-MM, this month or earlier); returns the lines the month calls for, how many were posted and any skipped receipts | Owner, portfolio manager, bookkeeper |
| `fee.override` | feeId, amount (the owner's fee for that source; 0 waives), reason | Owner |
| `recovery.authorize` | tenancyId, utility (water, sewer, trash, gas or electric), reference (the lease clause) | Owner, portfolio manager, bookkeeper |
| `utility.prepare` | propertyId, utility, vendor, invoiceReference, periodStart, periodEnd, dueDate, amount, formula (occupants, bedrooms, equal or submeter; submeter takes reading:<unitId> fields), optional recoverablePercent and cap; returns the allocation and its fingerprint | Owner, portfolio manager, bookkeeper |
| `utility.approve` | billId, fingerprint (from the reviewed allocation); never by its preparer | Owner, portfolio manager, bookkeeper |
| `ancillary.charge` | tenancyId, kind (parking, storage or other), description, amount, dueDate, reference; adds the reviewed tax charge when a rule applies | Owner, portfolio manager, bookkeeper |
| `tax.prepare` | propertyId, kind (utility, parking, storage or other), ratePercent, label, starts | Owner, portfolio manager, bookkeeper |
| `tax.review` | ruleId; the rule applies from then on | Owner, accountant |

Amounts are decimal strings with at most two decimal places in the tenancy's stored currency (USD for new tenancies; records entered before PORT-001 are shown as “currency unconfirmed” until the installation owner confirms AUD or USD with `currency.confirm` {currency}, which converts nothing); dates are YYYY-MM-DD property-local days. Charges and receipt references are unique; duplicate retries are refused without duplicating money. Current versions are returned in `/api/state`; stale approvals and changes fail. A prepared proposal has no effect until approval. Agents use member accounts to prepare, then hand the proposal/job ID to a person. Approval records the actual authenticated actor and time; sending a `role` field cannot grant authority.

Reports: `GET /api/rent-roll?asOf=YYYY-MM-DD&propertyId=ID&occupancy=occupied|vacant&format=json|csv|xlsx|pdf` and `GET /api/collections?month=YYYY-MM` (owner, portfolio managers, bookkeepers and accountants, limited to their portfolios). SAFE-002: `GET /api/history?from=YYYY-MM-DD&to=YYYY-MM-DD&actor=ID&action=PREFIX&tenancyId=ID&limit=N&before=ISO&format=json|csv` lists history newest first (owner; portfolio managers and accountants within their portfolios; CSV export for the owner and accountants, recorded). Each row: at, actor, role, policy (role and version), action, subject, tenancyId, source, outcome (recorded, read or exported). ACCT-009: `GET /api/owner-statement` also returns `fees` (each recorded fee line with kind, source, base, rate, fee, tax, agreement reference and override reason) and `cash` (the owner's USD share of receipts less fees, tax on fees and the reserve floor). `agreement.set` takes optional leasingFee, renewalFee, minimumFee (USD), feeTaxPercent and markupPercent. ACCT-011: `GET /api/period-close?month=YYYY-MM` returns the month's state, checklist, exception queue, corrections and every close version with its statement lines, totals per currency, reopening reason and the entries added and removed since the version before; `&version=N&format=csv` downloads one version's statement (recorded read). Owner, portfolio managers, bookkeepers and accountants; lines are limited to their portfolios. SAFE-005: `GET /api/readable-export` (owner) returns a zip: `README.md`, `manifest.json`, `tables/<table>.csv` per archived table and `files/<table>/<id>.<ext>` original files, built from the same archive as `/api/backup`. REPORT-004: `GET /api/maintenance-report?from=YYYY-MM-DD&to=YYYY-MM-DD&propertyId=ID&status=unresolved|<status>&format=json|csv` reports each job's status, age, response, handoff and resolution hours (resolution only from the resident's current confirmation), return visits, vendor performance, asset cost and budget variance over approved estimates, with missing timestamps listed (owner, portfolio managers, maintenance coordinators, bookkeepers and accountants, limited to their portfolios). PORT-003: `GET /api/owner-statement?ownerId=ID&from=YYYY-MM-DD&to=YYYY-MM-DD&format=json|csv` allocates each recorded receipt on the owner's properties by the shares in force on its received date, with the agreement fee and the owner's reserve-requirement share per stretch of the period (same readers). Downloads: `GET /api/statement?tenancyId=ID&from=YYYY-MM-DD&to=YYYY-MM-DD` (owner/admin CSV), `/api/inspections/photos/ID` (authenticated image), `/api/maintenance/ID/packet` (approved `.eml`), `/api/backup` (owner-only archive). Downloads are private and not cacheable. An `.eml` is an unsent packet; its download is not delivery evidence.

Auth is Base's ordinary API: owner `POST /auth/invite` with email, displayName and role; invitee confirms the mailed link. `/auth/operator/status` changes active/inactive state and `/auth/operator/role` changes role. Use the app's **Data & access** forms for these jobs without crafting HTTP.

### SAFE-004 resident retention

Owner only: `privacy.request` takes tenancyId, kind (access/erase), source; `privacy.review` takes tenancyId/requestId and returns retained classes, reasons and fingerprint; `privacy.hold` takes tenancyId/class (lease/accounting/screening/communications/all)/reason; `privacy.release` takes tenancyId/holdId/reason. `tenancy.erase` now requires requestId, the current reviewed fingerprint and exact resident email in confirm. Holds and period changes invalidate the review. `GET /api/resident-access?tenancyId=...` downloads that primary resident’s private access JSON. Erasure retains amounts/dates/links and close evidence and redacts identity only after the reviewed periods and holds permit it. Download a new backup for the restore fence.

### WORK-005 staff appointments (partial)

`appointment.book` takes jobId, startsAt/endsAt, accessStartsAt/accessEndsAt (YYYY-MM-DDTHH:mm±HH:mm matching the property zone), permission=granted, permissionReference, noticeReference/noticeAt, keysAccess, availabilityReference and staffId (defaults to actor). Rescheduling also takes previousId/reason. `appointment.confirm` takes appointmentId/version/party (vendor/resident)/outcome (confirmed/no_response)/reference. `appointment.cancel` and `appointment.no-show` take appointmentId/version/party/reference; no-show requires the arrival window to have begun. `appointment.reassign` takes a cancelled/no-show appointmentId/version, vendorId/reference and reopens exact work approval. Managers/coordinators record these; no send or resident contact is claimed. State work includes appointments, appointmentEvents and scoped appointmentCalendar; maintenance reports include firstConfirmedAppointmentAt and bookingHours.

### ACCT-007 private vendor bills

`GET /api/bills` and `/app?tab=bills` list bills/authority/revisions/payables and monthly recurring templates. The Properties page links Vendor bills. `GET /api/bill-attachment?id=...` downloads a scoped private original. `bill.create` takes vendorId, invoiceNumber, date, lines [{description,code,amount,tax}], allocations [{propertyId,amount,jobId?}] and original {name,type,base64}, or a multipart invoice File. Amount/tax are USD strings in exact cents. Forms use lineItems (one description | code | amount | tax per line) and allocation:PROPERTY/job:PROPERTY fields. `bill.revise` takes billId/version plus full terms, `bill.attach` billId/version plus attachment or invoice File, `bill.owner` billId/version/decision/source/reference, `bill.approve` billId/version. Changed revisions reopen approval. `bill-template.create/revise` use the same terms plus purpose/starts/endDate/dayOfMonth; revise/approve/run take templateId/version, and run takes month. Template approval and each generated bill approval are separate; one bill per template/month, including replay after a template change. No payment or extraction occurs. Originals are private to authorized staff/accountants across every historical allocation; owner/PM independently approve. Work-linked invoices inherit SAFE-004 retention and erasure with shared holds and erased-byte suppression.

### Signed lease versions (PORT-005)

`lease.prepare` accepts tenancyId, effective, signedDate, signers, reference, source (PDF file in multipart or `{name,type,base64}`), terms and obligations. The HTML forms also accept `chargeLines` and `obligationLines` in the displayed pipe-delimited formats. Each term names kind, description, exact amount, starts/ends and sourceClause; obligations record deposit, pet, utility, parking, insurance, addendum and hap (explicit none when absent). A HAP obligation names housingAuthority, reference, tenantPortion and hapPortion. It records terms without posting payer splits.

`lease.preview` accepts leaseId and month and returns the exact future charge lines and fingerprint. `lease.approve` accepts those three values and independently approves that unchanged snapshot. The existing `charges.preview`/`charges.post` run then posts the reviewed amounts once. Only owners/portfolio managers prepare, preview or approve. Owners, in-scope portfolio managers, bookkeepers and accountants read `leaseVersions` on `/api/state?tenancy=ID` and retrieve private original PDFs at `/api/lease-source?id=LEASE_VERSION_ID`. Leasing staff receive only nonfinancial version and obligation metadata, never original downloads or charge/HAP amounts. Signed originals and versions are included in backup, restore and readable export.
