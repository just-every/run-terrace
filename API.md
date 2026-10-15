# Terrace commands

All reads and writes authenticate a current Base operator session. Send the session cookie privately, never in a URL. Mutations require `Origin` equal to the installation origin, including command-line requests. Revoking an operator or changing their role invalidates their sessions. There is no anonymous or implicit agent authority.

`GET /api/commands` lists commands. `GET /api/state` lists tenancies; `GET /api/state?tenancy=ID` adds its rent, proposals, inspections and maintenance. `POST /api/commands` accepts JSON `{ "command": "name", ...fields }` and returns `{ "ok": true, "result": ... }`, or a non-200 `{ "ok": false, "error", "message" }`. Uploads use multipart form data to the same URL.

| Command | Fields | Authority |
| --- | --- | --- |
| `tenancy.create` | address, ownerName, ownerEmail, tenantName, tenantEmail, startDate, endDate, rent, cadence | Owner/admin |
| `renewal.prepare` | tenancyId, endDate, rent, source | Any operator |
| `arrears.prepare` | tenancyId, message, followUpDate | Any operator |
| `proposal.approve`, `proposal.reject` | proposalId | Owner/admin; current tenancy version required by saved proposal |
| `rent.charge` | tenancyId, dueDate, amount, description, reference | Owner/admin |
| `rent.receipt` | chargeId, amount, receivedDate, reference | Owner/admin |
| `rent.adjust` | chargeId, amount, reason | Owner/admin |
| `inspection.create` | tenancyId, date, notes | Owner/admin |
| `inspection.photo` | inspectionId, version, file (multipart JPEG/PNG) | Owner/admin |
| `inspection.complete` | inspectionId, version, notes | Owner/admin |
| `maintenance.prepare` | tenancyId, title, tradeName, tradeEmail, dueDate, estimate | Any operator |
| `maintenance.approve` | jobId, version | Owner/admin |
| `maintenance.sent` | jobId, version, reference | Owner/admin, after external handoff |
| `import.preview`, `import.apply`, `import.journal`, `import.undo` | See [move-in contract](docs/move-in.md) | Owner |
| `tenancy.erase` | tenancyId, confirm (exact tenant email) | Owner |
| `data.restore` | backup file, optional journal file, confirm=RESTORE (multipart) | Owner, empty product destination |

Amounts are AUD decimal strings, dates YYYY-MM-DD. Charges and receipt references are unique; duplicate retries are refused without duplicating money. Current versions are returned in `/api/state`; stale approvals and changes fail. A prepared proposal has no effect until approval. Agents use member accounts to prepare, then hand the proposal/job ID to a person. Approval records the actual authenticated actor and time; sending a `role` field cannot grant authority.

Downloads: `GET /api/statement?tenancyId=ID&from=YYYY-MM-DD&to=YYYY-MM-DD` (owner/admin CSV), `/api/inspections/photos/ID` (authenticated image), `/api/maintenance/ID/packet` (approved `.eml`), `/api/backup` (owner-only archive). Downloads are private and not cacheable. An `.eml` is an unsent packet; its download is not delivery evidence.

Auth is Base's ordinary API: owner `POST /auth/invite` with email, displayName and role; invitee confirms the mailed link. `/auth/operator/status` changes active/inactive state and `/auth/operator/role` changes role. Use the app's **Data & access** forms for these jobs without crafting HTTP.
