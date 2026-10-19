# Changes

## 2026-10-20

- REPORT-003: add scoped leasing-performance reports with dated occupancy/vacancy sources, source conversion and drop-off, recorded renewal retention, market-rent assumptions and honest receipt/listing coverage.

## 2026-10-19

- State that Terrace is for residential rentals only (no commercial leases, CAM reconciliation or HOA dues) on the first-run Tenancies page, the Move in screen and the getting-started guide. Terrace tenancy CSV v1 accepts an optional `lease_type` column: empty or `residential` imports, any other value is held as an exception. Files without the column are unchanged.
- Carry the approved homepage look through the app: top tabs under the stepped-blocks lockup, heavy Geist titles with the violet stop, quiet 1 px fields with a violet focus ring, navy pill actions, US dates.
- Open Tenancies on the month: October's recorded rent against what is due with a dated month track, the renewals, follow-ups, maintenance and inspection drafts waiting on a person (approve or reject a renewal or follow-up from its card), and the rent roll grouped by property with each tenancy's standing this month.
- Show a tenancy's rent and work beside its decisions, operator names instead of ids, and the sign-in and setup frames in the same look. The app's styles are split into shell, controls, content, home and pages sheets.
- Seed the demo's rent on the 1st of each month and add Units 1C (renewal) and 5A (unpaid) and the 3A sink repair from the homepage's October.
- Lead "Waiting on a person" with the most pressing item of each kind (earliest lease end, follow-up, due date or draft). Show people's names on Inspections & maintenance. Let the phone tab strip run into an edge fade so Move in and Data & access read as there. Stack erase rows on phones. Give the empty state a display headline, example placeholders and the month by name. Demo ledger references use the unit ("4C-2026-10", "BANK-77122").

## 2026-10-18

- Build the owner-approved run site from the 17 Oct design desk: the dusk-building hero, one manager's October in ten sections, the closing rooftop, `/docs` and `/run` in the same look.
- Replace the mark with the stepped-blocks mark (three violet bars) as flat SVG, hand-tuned 16 and 32 px favicons with a dark variant, ICO, PNG icons, apple-touch icon and share image, in the site, Lobby, sign-in and app.
- Retheme the shared tokens to lavender, navy and violet with self-hosted Geist, Figtree and JetBrains Mono.
- Show US money and wording: USD amounts, "Every two weeks", vendor fields, and US sample tenancies in the demo and the CSV fixture.

## 2026-10-15

- Carry Terrace’s front-verandah design through the public run site, on-site Markdown guides, sign-in, setup, Lobby and app.
- Open the portfolio through linked tenancy rows and keep every existing form and command. Stack rent ledger rows on phones.
- Add the guarded run-site workflow with deployment off. Update the exact RER package pin to 0.2.19.
