-- PAY-001: effective lease charge terms and the charges and concession reductions a run posts from them.
CREATE TABLE tt_lease_terms (
 id TEXT PRIMARY KEY, tenancy_id TEXT NOT NULL REFERENCES tt_tenancies(id) ON DELETE CASCADE,
 kind TEXT NOT NULL CHECK(kind IN ('rent','utility','pet','parking','concession')), description TEXT NOT NULL,
 amount_cents INTEGER NOT NULL CHECK(amount_cents>0), currency TEXT NOT NULL CHECK(currency IN ('USD','AUD')),
 starts TEXT NOT NULL, ends TEXT, replaces TEXT, version INTEGER NOT NULL DEFAULT 1,
 created_by TEXT NOT NULL, created_at TEXT NOT NULL, CHECK(ends IS NULL OR ends >= starts)
);
CREATE INDEX tt_lease_term_tenancy ON tt_lease_terms(tenancy_id,kind,starts);
-- A posted charge names the term and period it came from; its reference is unique per tenancy.
ALTER TABLE tt_charges ADD COLUMN term_id TEXT;
ALTER TABLE tt_charges ADD COLUMN period_start TEXT;
ALTER TABLE tt_charges ADD COLUMN period_end TEXT;
-- A concession posts as a reduction with a reference, at most once per charge.
ALTER TABLE tt_adjustments ADD COLUMN reference TEXT;
CREATE UNIQUE INDEX tt_adjustment_reference ON tt_adjustments(charge_id,reference) WHERE reference IS NOT NULL;
