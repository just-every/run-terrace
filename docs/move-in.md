# Move into Terrace

## Complete portfolio manifest

**Complete portfolio migration** on Move in accepts `terrace-migration-v1` JSON.
It is a documented Terrace exchange format, not an incumbent export format or a
claim of provider access. The owner inventories every source record kind, maps
fields, preserves original bytes, previews exceptions and approves the exact
fingerprint. Preview writes nothing. Apply publishes the entire manifest in one
transaction, including the native records, approval, source mappings and retained
account tie-out. Replaying that exact approval writes nothing. A used namespace
cannot be repurposed for another source.

The manifest has these fields:

- `format`: `terrace-migration-v1`; `namespace`: stable source identifier;
  `cutoverDate`: the first native operating day, in `YYYY-MM-DD` form.
- `inventory`: independent source counts for every kind below, including zero.
  Excluded records remain in the source count and retained manifest.
- `records`: objects with `kind`, stable `ref` and a `data` object. References use
  letters, digits, dots, underscores and hyphens. Each kind and reference occurs
  once. Money uses integer USD cents, never floating point or currency conversion.
- `fieldMap`: optional per-kind objects mapping a canonical field name to its
  source column name. Original columns and original JSON are retained unchanged.
- `artifacts`: objects with `ref`, `name`, `type` and `base64` for exact originals.
  Documents and invoices reference them by `artifactRef`. Every original passes
  the existing static content check; that check is not a malware verdict.
- `trialBalance`: independent source rows with `propertyRef`, `ownerRef`, `fund`,
  `account` and signed `balanceCents` (debit less credit). A nonzero difference
  requires an explicit named `exception`; it prevents a complete-switch claim.
- `resolutions`: objects with an exact exception `key`, `action` and `reason`.
  Duplicate or commercial records can be `exclude`d, never silently loaded.
  A missing W-9 can be acknowledged with `hold`: the vendor stays missing its
  W-9 and existing work and payment qualification checks continue to apply.
  Missing deposits, invalid fields, unmapped references and incorrect counts
  require corrected source records and a new preview; reasons cannot waive them.

| Record kind | Canonical data fields |
| --- | --- |
| `owner` | `name`, `email`, `kind` (individual or entity), `mailingAddress`, `w9` (not_requested, requested or received) |
| `property` | `name`, `address`, residential `kind`, `timeZone`, `ownershipFrom`, `owners` with `ownerRef` and `shareBp` totaling 10,000 |
| `household` | stable `identity`, primary `name`, `email`, optional `members` with native `role`, `name`, optional `email` and `phone` |
| `lease` | `propertyRef`, `householdRef`, `ownerRef`, `unit`, `starts`, `ends`, `rentCents`, `cadence`, `leaseType`, `depositCents`, `historyFrom`, `historyOpeningCents` |
| `vendor` | `name`, `email`, `phone`, comma-separated `specialties` and `serviceAreas`, `w9`, `insuranceExpires`, optional paired `licenseNumber` and `licenseExpires`, `availability`, `dba`, `tinStatus`, `eligible1099`, `box`, `paymentMethod`, `remitAddress` |
| `document` | `leaseRef`, `title`, native `documentKind`, `artifactRef` |
| `deposit` | `leaseRef`, `day`, `amountCents`, `reference` |
| `charge` | `leaseRef`, `day`, unpaid `amountCents`, `description`, `reference` |
| `bill` | `propertyRef`, `vendorRef`, `day`, unpaid `amountCents`, `description`, `invoiceNumber`, `reference`, `artifactRef` |
| `work` | `leaseRef`, `vendorRef`, `dueDate`, `amountCents`, `description`, `trade`, `sourceState` |
| `schedule` | `leaseRef`, `vendorRef`, future `dueDate`, `amountCents`, `description`, `trade`, `intervalMonths` |
| `vendor_ytd` | `vendorRef`, `reportableCents`, `reference` |
| `owner_ytd` | `propertyRef`, `ownerRef`, `incomeCents`, `expenseCents`, `reference` |
| `history` | `leaseRef`, `day`, `type` (charge, receipt, credit, returned_payment or deposit), `amountCents`, signed `deltaCents`, `reference` |
| `opening` | `propertyRef`, `ownerRef`, `fund` (operating or deposit), balanced `lines` with native chart `account`, positive `debit` or `credit` cents |

Review at most 100 records and 1 MB of UTF-8 manifest per atomic migration.
Every property, owner and fund has one opening bucket. Opening receivables must
equal imported unpaid charges, payables must equal imported unpaid bills and
deposit liabilities must equal resident deposits. The account tie-out compares
those independently supplied opening lines with the incumbent trial. Native
charge and deposit journal projections are deducted from the opening adjustment
so balances are never recognized twice. Imported invoices retain their originals
as pending native bills: they import no approval or payment authority. Their
first native approval clears the carried opening liability exactly once.

Resident history covers the previous 24 months, or the whole lease if newer.
Its closing receivable equals the imported unpaid charges. Read-only history
appears separately from collectible opening charges and never posts new cash.
Vendor and owner balance-forwards retain their year and source reference; they
do not create payments or claim a tax filing. Incumbent-specific captures and
the complete MOVE-010 tax and disposition workflows remain separate clauses.

Commands use the ordinary owner-only `POST /api/commands` door:

```json
{"command":"migration.preview","manifest":"exact JSON text"}
{"command":"migration.apply","manifest":"same exact JSON text","fingerprint":"reviewed fingerprint"}
{"command":"migration.journal","migrationId":"retained migration id"}
```

The journal keeps the exact original, per-kind counts, record mappings, resolved
exceptions, approving person and timestamp, and each source and native opening
account with its difference and named exception. The browser transports original
text as `manifestBase64` to preserve line endings. Native imports never grant
portal access, staff approval, consent, signatures or outbound permission.
Erasing an affected resident withdraws shared source custody and approval replay;
other residents' native records remain. Financial amounts follow existing
retention and archive fences. Full-manifest undo is not offered; MOVE-009 owns
reviewed compensation for these broader migrations.

The first named kit is **Terrace tenancy CSV v1**. It is a documented Terrace
CSV contract, not a claim that an external property platform exports this shape.
No provider connection or external API is involved. The checked-in
[example CSV](../fixtures/terrace-tenancies.csv) contains two fictional tenancies using
`example.com` addresses. It is an import fixture, not seeded application data.

An installation owner opens **Move in**, pastes the CSV and selects a stable
source namespace. **Preview import** produces a read-only dry run: source row
references, normalized native tenancy values, rejections, counts and the exact
SHA-256 plan fingerprint. Nothing is written by preview. The owner reviews
that result and selects **Approve and import these tenancies**. Preparing a
preview never approves it; an agent must stop at preparation until the owner
explicitly approves the fingerprint.

## Bring your records in

1. Prepare a file in the [source shape](#source-shape) below. The example file
   shows the format; replace its fictional records with your own.
2. In **Move in**, paste the CSV and choose a stable **Source namespace**.
3. Select **Preview import**. Check every tenancy, rejection and the displayed
   fingerprint. Correct rejected records and preview again.
4. As owner, select **Approve and import these tenancies** only after reviewing
   the exact plan. Use **Continue approved import** if the job is still applying.
5. Under **Import history**, select **Inspect journal and original** to check
   progress and download the exact retained CSV.

**Undo import** removes unchanged imported tenancies. Later edits or dependent
records stop undo and are preserved. Repeating undo continues a partial reversal.
Keep a [backup](backup-and-restore.md) when the imported records are in order.

## Source shape

Use UTF-8 CSV with this header (column ordering may differ, but all columns are
required exactly once; an optional `lease_type` column may be added):

```csv
ref,address,owner_name,owner_email,tenant_name,tenant_email,start_date,end_date,rent,cadence,created_at
```

- `ref`: stable source tenancy reference, up to 100 characters, starting with a
  letter or digit and containing only letters, digits, dots, underscores or
  hyphens. Each reference occurs once in a file.
- `address`: property address, up to 500 characters.
- `owner_name`, `tenant_name`: names, up to 200 characters.
- `owner_email`, `tenant_email`: valid email addresses, normalized to lowercase.
- `start_date`, `end_date`: real `YYYY-MM-DD` dates; end must not precede start.
- `rent`: positive decimal with at most two decimal places, up to
  `1000000.00`, in the row's currency. It becomes integer `rent_cents`.
- `currency` (optional column): empty or `USD` for USD; `AUD` for a historical
  AUD tenancy, which stays AUD and is never converted. The dry run shows each
  row's currency before you approve it.
- `time_zone` (optional column): the property's IANA time zone, for example
  `America/Chicago`; empty uses the office time zone. The dry run shows it.
- `cadence`: `weekly`, `fortnightly` (every two weeks) or `monthly`.
- `lease_type` (optional column): empty or `residential`. Terrace manages
  residential rentals only, so any other value, such as `commercial`, is held as
  an exception in the dry run and never imported as a tenancy; remove that row to
  import the rest.
- `created_at`: the source tenancy record's creation time, expressed exactly as
  an ISO UTC timestamp such as `2026-01-15T00:00:00.000Z`. This preserves the
  complete native row without putting the time of preview into its fingerprint.

The parser accepts LF or CRLF, an optional UTF-8 BOM, quoted fields, escaped
quotes and quoted newlines. Malformed quoting, unexpected or missing columns,
duplicate references and inconsistent column counts are refused. Invalid row
values appear as rejected rows in the dry run; all rejected rows must be
corrected before apply. An upload contains 1–100 records and at most 256,000
UTF-8 bytes. Inputs are CSV text, so original custody means the exact UTF-8
encoding of the submitted text, including BOM, whitespace and line endings.
For a non-UTF-8 export, convert it deliberately before submitting.

Choose a namespace such as `legacy-office-2026`, using the same character rules
as `ref`. Keep it stable for that source system. A native tenancy ID is
`import-` followed by SHA-256 of canonical JSON `[namespace, ref]`. Existing
native tenancies are never overwritten by this kit. A changed source under the
same reference fails rather than silently replacing a tenancy. Preview and
apply must receive the same namespace and exact source; a changed fingerprint
requires another owner review. An erased tenant email cannot be imported again,
including under another namespace.

## Commands and review

All commands use the same owner-only handler behind
`POST /api/commands` with a JSON object:

```json
{"command":"import.preview","csv":"...","namespace":"legacy-office-2026"}
```

Preview returns `kit`, `namespace`, `csv`, `csvBase64`, `fingerprint`, `counts`,
`diagnostics`, `rows`, and `approvalRequired: true`. Each preview row names its
source reference/record number, target ID, normalized native value and rejection.
It is safe to inspect this response without creating a job.

After explicit owner approval, apply with:

```json
{"command":"import.apply","csv":"...","namespace":"legacy-office-2026","fingerprint":"the reviewed fingerprint"}
```

Apply refuses a fingerprint that does not match the newly computed plan. Its
operation key is derived from the fingerprint, so replaying the exact approval
returns the same job rather than creating duplicate tenancies. It returns
`{kit, job}`. Batches contain one tenancy and each request publishes at most ten
batches, subject to the kit's lower D1 request budget. A job can therefore
return `applying` with durable partial progress. Continue that approved job in
a new request without supplying the source again:

```json
{"command":"import.apply","jobId":"job id","fingerprint":"the retained reviewed fingerprint"}
```

The **Continue approved import** form does this. It uses the immutable retained
plan and checks the current fingerprint and current owner authority. Failed or
reversing jobs cannot be continued forward through this command.

Inspect custody or undo:

```json
{"command":"import.journal","jobId":"job id"}
{"command":"import.undo","jobId":"job id"}
```

Journal returns `job`, digest-checked `originals`, committed batch `journal`,
`provenance`, and the destination's `erasureJournal`. Owners can download the
exact retained CSV from the journal. Undo uses strict kit undo for completed
jobs and rollback for partial jobs; repeated calls continue its persisted
reversal. It removes only unchanged imported native tenancies. Every native
column is fenced, including edits that did not increment `version`. Added
charges, proposals, lease history, inspections (and their photos), or maintenance
jobs stop reversal and remain intact. No balance, lease approval, access grant,
message or external handoff is generated by an import. Source originals,
before-images and the journal remain after ordinary undo.

All HTML forms post to `/app/command` with `tab=import`. Approval forms transport
the reviewed source as `csvBase64`, decoded by the same handler, to preserve its
exact line endings through browser form handling. JSON callers use `csv`.

## Authority, archive restore and erasure

Every import entry point requires the installation owner. The kit's SQL
predicate consults the acting operator's durable `oa_operators` row: exact ID,
active status, owner role and current operator version. The kit checks this
again inside publication and read boundaries. Jobs are held by `role:owner`,
so a freshly established owner after archive restore can inspect, continue and
undo restored jobs without adopting the prior owner's operator ID.

`retireTenancy(context, tenancyRow, nativeStatements, checkpoint)` is the
integration seam for full tenancy erasure. The product supplies prepared native
deletes/redactions and portability's redaction checkpoint. Base's
`retireD1ImportCustody` converts them into one atomic D1 batch with import source
redaction, withdrawal of affected original CSV artifacts, permanent source and
target tombstones and an append-only erasure receipt. Mixed-file originals are
withdrawn in full when they contain an erased tenancy. Remaining peer plans and
native tenancies continue to work. A job header holding the exact erased tenancy
ID is retired instead; its receipt explains why it cannot resume or undo.
Erasure is scoped to the native tenancy, so another tenancy's source is not
severed merely because it shares an owner or tenant email. Native intake uses
`tt_erasures` to prevent the erased tenant email re-entering the installation.
The caller's portability checkpoint fences older archives; native row deletion
alone does not provide that guarantee.

Migration `0016_import_kit.sql` adds `tt_tenancies.import_revision` and the full
Base D1 import schema, including chunked originals/plans, provenance/history,
stream/staging/preparation custody, monotonic fences, erasure tombstones,
retirements and the append-only erasure journal. These tables belong in the
product's real archive and erasure inventories. They retain original personal
data until explicit erasure; exporting only `tt_tenancies` is insufficient.

## Source attribution

`src/modules/import-kit/src`, `schema`, `README.md`, `CONTRACT.md`,
`FIXTURES.md` and `extraction.json` are copied byte for byte from the supplied
[Base reference commit](https://github.com/runeditrun/base/tree/fc0e1041efa55771142bbb57c4ab4743147e264d/modules/import-kit),
`fc0e1041efa55771142bbb57c4ab4743147e264d`. Terrace imports the Worker-safe D1 entry point
`src/d1/index.ts`, not the synchronous SQLite entry point. The adapter and
role-based custody follow Base's real `default-seed` people importer at
`src/core/features/people/imports.server.ts`. Product-owned code in
`src/terrace/imports*.ts` supplies CSV parsing, validation, mapping, native D1
statements, owner authority and the review surface.

The migration incorporates Base default-seed migrations
`0018_import_kit.sql`, `0020_import_erasure_append_only.sql`,
`0021_import_preparation_steps.sql` and `0022_import_stream_sources.sql` as a
new Terrace migration, preserving existing Terrace migration history. The
native deletion integration uses Base erasure's `toD1Sql` conversion. No generic
substitute, external provider mock, silent fallback or external call is used.
