-- ACCT-009. Fee terms on each dated management agreement (leasing and renewal fees, a monthly minimum management
-- fee, the tax rate on fees and the markup for vendor bills), and the fee lines a property's monthly fee run records:
-- one line per owner and source, never edited. A rerun posts only the difference from what is already recorded,
-- and an owner's override is a new line with its reason that later runs leave alone.
ALTER TABLE tt_management_agreements ADD COLUMN leasing_fee_cents INTEGER NOT NULL DEFAULT 0 CHECK(leasing_fee_cents>=0);
ALTER TABLE tt_management_agreements ADD COLUMN renewal_fee_cents INTEGER NOT NULL DEFAULT 0 CHECK(renewal_fee_cents>=0);
ALTER TABLE tt_management_agreements ADD COLUMN minimum_fee_cents INTEGER NOT NULL DEFAULT 0 CHECK(minimum_fee_cents>=0);
ALTER TABLE tt_management_agreements ADD COLUMN fee_tax_bp INTEGER NOT NULL DEFAULT 0 CHECK(fee_tax_bp BETWEEN 0 AND 10000);
ALTER TABLE tt_management_agreements ADD COLUMN markup_bp INTEGER NOT NULL DEFAULT 0 CHECK(markup_bp BETWEEN 0 AND 10000);
CREATE TABLE tt_fees (
 id TEXT PRIMARY KEY,
 property_id TEXT NOT NULL REFERENCES tt_properties(id),
 owner_id TEXT NOT NULL REFERENCES tt_owners(id),
 month TEXT NOT NULL,
 day TEXT NOT NULL,
 kind TEXT NOT NULL CHECK(kind IN ('management','minimum','leasing','renewal')),
 source TEXT NOT NULL,
 source_label TEXT NOT NULL,
 base_cents INTEGER NOT NULL,
 rate_bp INTEGER,
 amount_cents INTEGER NOT NULL,
 tax_bp INTEGER NOT NULL,
 tax_cents INTEGER NOT NULL,
 agreement_id TEXT NOT NULL REFERENCES tt_management_agreements(id),
 override_reason TEXT,
 run_id TEXT NOT NULL,
 created_by TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE INDEX tt_fees_property_month ON tt_fees(property_id,month);
CREATE INDEX tt_fees_owner ON tt_fees(owner_id,month);
CREATE TRIGGER tt_fee_immutable BEFORE UPDATE ON tt_fees BEGIN SELECT RAISE(ABORT,'A fee line is never edited'); END;
CREATE TRIGGER tt_fee_kept BEFORE DELETE ON tt_fees BEGIN SELECT RAISE(ABORT,'A fee line is never deleted'); END;
INSERT INTO tt_role_actions(role,action) VALUES ('portfolio_manager','fees.run'),('bookkeeper','fees.run');
