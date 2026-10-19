-- ACCT-016. Utility recovery and taxable ancillary charges. A utility bill is recorded per property with its source
-- invoice, the recoverable share, an allocation formula and an optional per-lease cap; a second person approves the
-- exact allocation, which posts one charge per lease that authorizes recovery of that utility. Tax rules per
-- property and charge kind take effect only once an accountant (or the owner) has reviewed them; a tax charge names
-- its rule and is never owner income.
CREATE TABLE tt_recovery_authorizations (
 tenancy_id TEXT NOT NULL REFERENCES tt_tenancies(id) ON DELETE CASCADE,
 utility TEXT NOT NULL CHECK(utility IN ('water','sewer','trash','gas','electric')),
 reference TEXT NOT NULL, recorded_by TEXT NOT NULL, recorded_at TEXT NOT NULL,
 PRIMARY KEY(tenancy_id,utility)
);
CREATE TABLE tt_utility_bills (
 id TEXT PRIMARY KEY,
 property_id TEXT NOT NULL REFERENCES tt_properties(id),
 utility TEXT NOT NULL CHECK(utility IN ('water','sewer','trash','gas','electric')),
 vendor TEXT NOT NULL, invoice_reference TEXT NOT NULL,
 period_start TEXT NOT NULL, period_end TEXT NOT NULL, due_date TEXT NOT NULL,
 amount_cents INTEGER NOT NULL CHECK(amount_cents>0),
 recoverable_bp INTEGER NOT NULL CHECK(recoverable_bp BETWEEN 0 AND 10000),
 formula TEXT NOT NULL CHECK(formula IN ('occupants','bedrooms','equal','submeter')),
 readings TEXT, cap_cents INTEGER CHECK(cap_cents IS NULL OR cap_cents>0),
 state TEXT NOT NULL DEFAULT 'prepared' CHECK(state IN ('prepared','approved')),
 fingerprint TEXT, prepared_by TEXT NOT NULL, prepared_at TEXT NOT NULL,
 approved_by TEXT, approved_at TEXT, approval_label TEXT,
 UNIQUE(property_id,invoice_reference)
);
CREATE TABLE tt_utility_allocations (
 bill_id TEXT NOT NULL REFERENCES tt_utility_bills(id),
 tenancy_id TEXT NOT NULL REFERENCES tt_tenancies(id) ON DELETE CASCADE,
 basis INTEGER NOT NULL, basis_label TEXT NOT NULL,
 amount_cents INTEGER NOT NULL, capped INTEGER NOT NULL,
 charge_id TEXT NOT NULL,
 PRIMARY KEY(bill_id,tenancy_id)
);
CREATE TABLE tt_tax_rules (
 id TEXT PRIMARY KEY,
 property_id TEXT NOT NULL REFERENCES tt_properties(id),
 kind TEXT NOT NULL CHECK(kind IN ('utility','parking','storage','other')),
 rate_bp INTEGER NOT NULL CHECK(rate_bp BETWEEN 1 AND 10000),
 label TEXT NOT NULL, starts TEXT NOT NULL,
 prepared_by TEXT NOT NULL, prepared_at TEXT NOT NULL,
 reviewed_by TEXT, reviewed_at TEXT,
 UNIQUE(property_id,kind,starts)
);
ALTER TABLE tt_charges ADD COLUMN tax_rule_id TEXT;
CREATE TRIGGER tt_allocation_immutable BEFORE UPDATE ON tt_utility_allocations BEGIN SELECT RAISE(ABORT,'An allocation is never edited'); END;
CREATE TRIGGER tt_tax_rule_immutable BEFORE UPDATE ON tt_tax_rules WHEN OLD.reviewed_at IS NOT NULL OR NEW.kind<>OLD.kind OR NEW.rate_bp<>OLD.rate_bp OR NEW.starts<>OLD.starts OR NEW.property_id<>OLD.property_id OR NEW.label<>OLD.label BEGIN SELECT RAISE(ABORT,'A tax rule is never edited'); END;
INSERT INTO tt_role_actions(role,action) VALUES
('portfolio_manager','recovery.authorize'),('bookkeeper','recovery.authorize'),
('portfolio_manager','utility.prepare'),('bookkeeper','utility.prepare'),
('portfolio_manager','utility.approve'),('bookkeeper','utility.approve'),
('portfolio_manager','ancillary.charge'),('bookkeeper','ancillary.charge'),
('portfolio_manager','tax.prepare'),('bookkeeper','tax.prepare'),
('accountant','tax.review');
