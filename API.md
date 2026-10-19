# Terrace commands

All reads and writes authenticate a current Base operator session. Send the session cookie privately, never in a URL. Mutations require `Origin` equal to the installation origin, including command-line requests. Revoking an operator or changing their role invalidates their sessions. There is no anonymous or implicit agent authority.

`GET /api/commands` lists commands. `GET /api/state` lists the company, legal entities, operating accounts and tenancies (each with its `currency` and `time_zone`); `GET /api/state?tenancy=ID` adds its rent, proposals, inspections and maintenance. `POST /api/commands` accepts JSON `{ "command": "name", ...fields }` and returns `{ "ok": true, "result": ... }`, or a non-200 `{ "ok": false, "error", "message" }`. Uploads use multipart form data to the same URL.

| Command | Fields | Authority |
| --- | --- | --- |
| `tenancy.create` | address (or unitId: the unit's address and property zone are used), ownerName, ownerEmail, tenantName, tenantEmail, startDate, endDate, rent, cadence, optional timeZone (a US IANA zone; default the office zone). Always USD. | Owner/admin |
| `portfolio.add` | name | Owner/admin |
| `property.add` | portfolioId, name, address, kind (single_family/duplex/multifamily/townhouse/condo), timeZone | Owner/admin |
| `unit.add`, `unit.update` | propertyId, identifier (add) or unitId, version (update); bedrooms, bathrooms, amenities, rentable | Owner/admin |
| `tenancy.end` | tenancyId, moveOut, reason; the lease is kept | Owner/admin |
| `tenancy.transfer` | tenancyId, unitId, moveIn, optional endDate and rent | Owner/admin |
| `tenancy.timezone` | tenancyId, timeZone (US IANA zone); recorded dates and currency do not change | Owner/admin |
| `company.save` | name, officeAddress, officeEmail, officePhone, timeZone (office, US IANA zone). Country US, currency USD | Owner/admin |
| `entity.add` | legalName, ein (nine digits; format checked, not verified with the IRS); needs a saved company | Owner/admin |
| `account.add` | entityId, name, bankName, last4. A USD reference; no full account number; no money moves | Owner/admin |
| `renewal.prepare` | tenancyId, endDate, rent, source | Any operator |
| `arrears.prepare` | tenancyId, message, followUpDate | Any operator |
| `proposal.approve`, `proposal.reject` | proposalId | Owner/admin; current tenancy version required by saved proposal |
| `rent.charge` | tenancyId, dueDate, amount, description, reference | Owner/admin |
| `rent.receipt` | chargeId, amount, receivedDate, reference | Owner/admin |
| `rent.adjust` | chargeId, amount, reason | Owner/admin |
| `term.add` | tenancyId, kind (rent/utility/pet/parking/concession), description, amount per period, starts, optional ends | Owner/admin |
| `term.amend` | termId, effective (after the term's last posted period), amount | Owner/admin |
| `charges.preview` | month (YYYY-MM); returns lines, missing terms and the fingerprint | Owner/admin |
| `charges.post` | month, fingerprint from the preview | Owner/admin |
| `inspection.create` | tenancyId, date, notes | Owner/admin |
| `inspection.photo` | inspectionId, version, file (multipart JPEG/PNG) | Owner/admin |
| `inspection.complete` | inspectionId, version, notes | Owner/admin |
| `maintenance.prepare` | tenancyId, title, vendorId and trade (a directory vendor) or tradeName and tradeEmail (an unlisted vendor, held), dueDate, estimate, optional assetId (an in-service asset of the tenancy). Returns the qualification `issues` | Any operator |
| `vendor.add`, `vendor.update` | name, email, phone, specialties, serviceAreas, w9 (received/missing), insuranceExpires, optional licenseNumber with licenseExpires, availability, rate, standing (preferred/approved/blocked); update adds vendorId, version | Owner/admin |
| `maintenance.reassign` | jobId, vendorId, optional trade, version; prepared work only | Owner/admin |
| `schedule.add` | tenancyId, title, trade, vendorId, optional assetId or inspectionId, intervalMonths, firstDue, budget, optional leadDays (default 30) | Owner/admin |
| `schedule.defer` | scheduleId, dueDate (an occurrence without an order), deferTo, reason | Owner/admin |
| `schedule.run` | none; returns created and existing order counts | Owner/admin |
| `maintenance.exception` | jobId, reason; records a documented exception for the job's current qualification issues | Owner/admin |
| `asset.add` | tenancyId, kind, location, make, model, serial, installedDate, optional warrantyProvider with warrantyEnds, manual, replaceBy, replacementCost | Owner/admin |
| `asset.replace` | assetId plus the replacement's asset.add fields; installedDate is the replacement date | Owner/admin |
| `maintenance.approve` | jobId, version | Owner/admin |
| `maintenance.sent` | jobId, version, reference | Owner/admin, after external handoff |
| `import.preview`, `import.apply`, `import.journal`, `import.undo` | See [move-in contract](docs/move-in.md) | Owner |
| `tenancy.erase` | tenancyId, confirm (exact tenant email) | Owner |
| `data.restore` | backup file, optional journal file, confirm=RESTORE (multipart) | Owner, empty product destination |

Amounts are decimal strings with at most two decimal places in the tenancy's stored currency (USD for new tenancies; AUD kept for records entered before PORT-001, never converted); dates are YYYY-MM-DD property-local days. Charges and receipt references are unique; duplicate retries are refused without duplicating money. Current versions are returned in `/api/state`; stale approvals and changes fail. A prepared proposal has no effect until approval. Agents use member accounts to prepare, then hand the proposal/job ID to a person. Approval records the actual authenticated actor and time; sending a `role` field cannot grant authority.

Downloads: `GET /api/statement?tenancyId=ID&from=YYYY-MM-DD&to=YYYY-MM-DD` (owner/admin CSV), `/api/inspections/photos/ID` (authenticated image), `/api/maintenance/ID/packet` (approved `.eml`), `/api/backup` (owner-only archive). Downloads are private and not cacheable. An `.eml` is an unsent packet; its download is not delivery evidence.

Auth is Base's ordinary API: owner `POST /auth/invite` with email, displayName and role; invitee confirms the mailed link. `/auth/operator/status` changes active/inactive state and `/auth/operator/role` changes role. Use the app's **Data & access** forms for these jobs without crafting HTTP.
