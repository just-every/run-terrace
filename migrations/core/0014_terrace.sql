CREATE TABLE tt_guard (ok INTEGER NOT NULL CHECK(ok=1));
CREATE TRIGGER tt_guard_clean AFTER INSERT ON tt_guard BEGIN DELETE FROM tt_guard; END;
CREATE TABLE tt_tenancies (
 id TEXT PRIMARY KEY, address TEXT NOT NULL, owner_name TEXT NOT NULL, owner_email TEXT NOT NULL,
 tenant_name TEXT NOT NULL, tenant_email TEXT NOT NULL, start_date TEXT NOT NULL, end_date TEXT NOT NULL,
 rent_cents INTEGER NOT NULL CHECK(rent_cents>0), cadence TEXT NOT NULL CHECK(cadence IN ('weekly','fortnightly','monthly')),
 version INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL
);
CREATE TABLE tt_charges (id TEXT PRIMARY KEY, tenancy_id TEXT NOT NULL REFERENCES tt_tenancies(id) ON DELETE CASCADE, due_date TEXT NOT NULL, amount_cents INTEGER NOT NULL CHECK(amount_cents>0), description TEXT NOT NULL, reference TEXT NOT NULL, created_at TEXT NOT NULL, UNIQUE(tenancy_id,reference));
CREATE INDEX tt_charge_tenancy ON tt_charges(tenancy_id);
CREATE TABLE tt_receipts (id TEXT PRIMARY KEY, charge_id TEXT NOT NULL REFERENCES tt_charges(id) ON DELETE CASCADE, amount_cents INTEGER NOT NULL CHECK(amount_cents>0), received_date TEXT NOT NULL, reference TEXT NOT NULL UNIQUE, created_at TEXT NOT NULL);
CREATE INDEX tt_receipt_charge ON tt_receipts(charge_id);
CREATE TABLE tt_adjustments (id TEXT PRIMARY KEY, charge_id TEXT NOT NULL REFERENCES tt_charges(id) ON DELETE CASCADE, amount_cents INTEGER NOT NULL CHECK(amount_cents>0), reason TEXT NOT NULL, at TEXT NOT NULL);
CREATE INDEX tt_adjustment_charge ON tt_adjustments(charge_id);
CREATE TABLE tt_proposals (id TEXT PRIMARY KEY, tenancy_id TEXT NOT NULL REFERENCES tt_tenancies(id) ON DELETE CASCADE, kind TEXT NOT NULL, payload TEXT NOT NULL, tenancy_version INTEGER NOT NULL, state TEXT NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','approved','rejected')), prepared_by TEXT NOT NULL, prepared_at TEXT NOT NULL, approved_by TEXT, approved_at TEXT);
CREATE TABLE tt_audit (id TEXT PRIMARY KEY, actor TEXT NOT NULL, action TEXT NOT NULL, subject TEXT NOT NULL, at TEXT NOT NULL);
CREATE TABLE tt_erasures (subject TEXT PRIMARY KEY, erased_at TEXT NOT NULL);
CREATE TABLE tt_lease_history (id TEXT PRIMARY KEY, tenancy_id TEXT NOT NULL REFERENCES tt_tenancies(id) ON DELETE CASCADE, start_date TEXT NOT NULL, end_date TEXT NOT NULL, rent_cents INTEGER NOT NULL, proposal_id TEXT NOT NULL, confirmed_by TEXT NOT NULL, confirmed_at TEXT NOT NULL);
