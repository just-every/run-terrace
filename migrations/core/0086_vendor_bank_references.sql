-- PORTAL-003 / ROLE-003: staff-only external bank references, never payment authority.
-- Actor IDs are opaque accounting evidence, not foreign keys to restored operators.
CREATE TABLE tt_vendor_bank_references (
 id TEXT PRIMARY KEY,
 vendor_id TEXT NOT NULL REFERENCES tt_vendors(id),
 version INTEGER NOT NULL CHECK(version>0),
 vendor_version INTEGER NOT NULL CHECK(vendor_version>0),
 bank_name TEXT NOT NULL,
 last4 TEXT NOT NULL CHECK(length(last4)=4 AND last4 NOT GLOB '*[^0-9]*'),
 account_reference TEXT NOT NULL,
 source TEXT NOT NULL,
 reason TEXT NOT NULL,
 prepared_by TEXT NOT NULL,
 prepared_at TEXT NOT NULL,
 UNIQUE(vendor_id,version)
);
CREATE TABLE tt_vendor_bank_verifications (
 candidate_id TEXT PRIMARY KEY REFERENCES tt_vendor_bank_references(id),
 verified_by TEXT NOT NULL,
 verified_at TEXT NOT NULL,
 verification_reference TEXT NOT NULL,
 consent TEXT NOT NULL CHECK(consent='VERIFIED')
);
CREATE TRIGGER tt_vendor_bank_reference_immutable BEFORE UPDATE ON tt_vendor_bank_references BEGIN SELECT RAISE(ABORT,'Bank reference evidence is never edited'); END;
CREATE TRIGGER tt_vendor_bank_reference_kept BEFORE DELETE ON tt_vendor_bank_references BEGIN SELECT RAISE(ABORT,'Bank reference evidence is never deleted'); END;
CREATE TRIGGER tt_vendor_bank_verification_immutable BEFORE UPDATE ON tt_vendor_bank_verifications BEGIN SELECT RAISE(ABORT,'Bank verification evidence is never edited'); END;
CREATE TRIGGER tt_vendor_bank_verification_kept BEFORE DELETE ON tt_vendor_bank_verifications BEGIN SELECT RAISE(ABORT,'Bank verification evidence is never deleted'); END;
CREATE TRIGGER tt_vendor_bank_independent BEFORE INSERT ON tt_vendor_bank_verifications WHEN NOT EXISTS (
 SELECT 1 FROM tt_vendor_bank_references r WHERE r.id=NEW.candidate_id AND r.prepared_by<>NEW.verified_by
 AND r.version=(SELECT MAX(latest.version) FROM tt_vendor_bank_references latest WHERE latest.vendor_id=r.vendor_id)
) BEGIN SELECT RAISE(ABORT,'Bank verification requires an independent actor and the latest candidate'); END;
INSERT INTO tt_role_actions(role,action) VALUES ('portfolio_manager','vendor.bank.verify'),('portfolio_manager','vendor.bank.read');
