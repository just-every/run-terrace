# State and local rule packs

The State & local rules screen is a review workspace. Terrace currently ships a registry of the 50 states, DC and the first five local overlays, **without active counsel-reviewed legal values**. Existing tenancy, renewal and money commands do not yet consume these previews. No preview sends a notice, changes a lease or moves money. PORT-008 remains partial.

The installation owner records a property’s state and applicable local overlays explicitly, with a source reference; the address is never used to guess applicability. Each required state and local version must be active and contain the fields the requested preview needs. A missing version, inactive review, future-effective field or missing required field holds the preview. A newer inactive draft holds actions from its effective day; an older active version is not substituted.

Every signed-in operator reads active pack values, citations, versions and held reasons for properties in their portfolio scope; a property outside that scope answers 404 on the API and page. Non-owner reads omit resident preview inputs/calculations and inactive draft contents. Only the owner publishes drafts, records counsel review, assigns or confirms jurisdiction, activates review and records previews. A portfolio manager proposes jurisdiction for an in-scope property; no assignment changes until the owner confirms the stored proposal against its unchanged base revision. Competing changes make it stale and confirmed proposals cannot replay. Proposals and confirmations are audited and archived. API credentials grant no access. This is the ct 22 October authority ruling. A review is the owner’s record of counsel’s review and its source; Terrace does not authenticate counsel, certify compliance or provide legal advice. No active legal values are supplied or inferred. A reviewer must address property-specific coverage and exemptions, CPI sources, local overlays and current law before actual use.

## Reviewed file format

Upload a UTF-8 JSON file up to 100 KB using **Record a counsel-sourced pack**. Its structure is:

```json
{
  "code": "CA",
  "version": 1,
  "effectiveFrom": "2026-01-01",
  "reviewer": "Counsel name recorded by the owner",
  "reviewReference": "Where the exact review is retained",
  "fields": {
    "depositRefund": {
      "citation": "The reviewed statute and subsection",
      "effectiveDate": "2026-01-01",
      "value": { "days": 21 }
    }
  }
}
```

This fragment is incomplete and cannot activate. All 19 fields require explicit values and citations: `depositCap`, `depositSeparateAccount`, `depositBankDisclosure`, `depositReceipt`, `depositInterest`, `depositRefund`, `depositItemization`, `dispositionDelivery`, `lateFee`, `partialPayments`, `payOrQuit`, `leaseViolation`, `rentIncreaseNotice`, `terminationNotice`, `rentCap`, `justCause`, `entryNotice`, `leaseDisclosures`, `retention`. Each field carries its own legal effective day. Explicitly record non-applicability where reviewed; an absent field never means “none.”

A new version is the next integer and cannot start before the previous version. It is initially inactive. After inspecting its exact source, type REVIEWED to activate the version. Activation proceeds CA, TX, FL, NY, GA, NC, AZ, IL, WA, CO, then the remaining states/DC; overlays require their state first. Review and jurisdiction changes are audited. Pack versions, activation records and saved decisions are immutable and survive restart and native archive restore.

## Supported calculations

Disposition needs `depositRefund.value.days` (or explicit `noClaimDays` for a no-claim case), `depositItemization.value.days`, and `dispositionDelivery.value.claim`/`refund` arrays and `address` text. Supported method names are `personal_delivery`, `first_class_mail`, `certified_mail`, `electronic_with_consent`; a preview does not establish delivery consent. Days are calendar days after the explicitly recorded surrender date. Other legal triggers and deadline adjustments are not implemented.

The late-fee calculator requires `fullUnpaidDays`, `basis: "monthly_rent"`, `smallStructureMaxUnits`, `smallStructureCapBp`, `largeStructureCapBp`. With two full unpaid days after the due day, the first fee day is due day + 3. The maximum fee is monthly rent × basis points, rounded down to the cent. Inputs are staff-recorded, not a verification that rent remained unpaid; no charge is posted.

Rent-cap preview requires explicit `applies`, `baseBp`, `absoluteBp` and staff-recorded CPI basis points with a dated source. It uses the lesser of base plus CPI and the absolute cap, rounding the maximum permitted rent down to the cent. It does not determine exemptions or prove notice. Just-cause preview compares staff-recorded occupancy months with the reviewed `occupancyMonths` threshold and holds without a recorded counsel-reviewed cause; it does not decide that the stated cause is legally sufficient.

Each preview snapshots every applicable pack id, version, source, reviewer and field value. Publishing a later version cannot change an earlier saved decision. Source fixtures in `tests/rule-packs.mjs` demonstrate the brief’s CA/TX/FL examples; they are synthetic test inputs and are not shipped legal packs.

## Authorship and counsel review

Authority (ct 22 Oct): the owner alone publishes, activates and records counsel review. Every operator in a property's portfolio scope reads that property's active pack values, citations, versions and held reasons. A portfolio manager may propose a property's jurisdiction, and it takes effect only on owner confirmation. Content: Terrace authors, under a counsel engagement recorded with reviewer, firm and date, the 19 fields plus state lease disclosures and addenda and notice templates (pay-or-quit, violation, entry, nonrenewal, deposit disposition) for every pack. Each ships inactive until Terrace's counsel review is recorded. An owner may instead activate their own counsel-reviewed pack or template, recorded as theirs. Terrace-researched drafts carry citations and a verified-on date, and they never drive an action while inactive.

The counsel engagement has not been executed. Terrace ships no counsel-reviewed contents or templates today. The synthetic packs used in tests are not shipped legal content, and owner uploads do not fulfill Terrace's authorship obligation.

## Still required

Counsel-reviewed complete state/local contents; actual legal-action enforcement on existing and future doors; complete interest, deposit-cap, notice/service, lease-disclosure and retention engines; legal applicability/exemptions and property-local triggers beyond these bounded previews. ACCT-003/004, PAY-006, LEASE-010/012, PORTAL-009, SAFE-004 and BOUND-002 inherit the version, missing-field and reviewed-policy gates before their pack-dependent actions ship.
