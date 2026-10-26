-- Preserve existing document identities and originals while adding PHA accounting evidence.
PRAGMA defer_foreign_keys=ON;
CREATE TABLE tt_documents_hap(id TEXT PRIMARY KEY,tenancy_id TEXT NOT NULL REFERENCES tt_tenancies(id),kind TEXT NOT NULL CHECK(kind IN ('lease','application','screening','notice','inspection','work','invoice','tax','other','hap')),title TEXT NOT NULL,retention_class TEXT NOT NULL CHECK(retention_class IN ('lease','accounting','screening','communications')),restriction TEXT CHECK(restriction IS NULL OR restriction IN ('screening','tax')),version INTEGER NOT NULL CHECK(version>0),created_by TEXT NOT NULL,created_at TEXT NOT NULL);
INSERT INTO tt_documents_hap SELECT * FROM tt_documents;
DROP TABLE tt_documents;
ALTER TABLE tt_documents_hap RENAME TO tt_documents;
CREATE INDEX tt_documents_tenancy ON tt_documents(tenancy_id);
PRAGMA defer_foreign_keys=OFF;
-- Reviewed PHA notices correct payer entitlements without rewriting signed originals.
CREATE TABLE tt_hap_changes(id TEXT PRIMARY KEY,tenancy_id TEXT NOT NULL REFERENCES tt_tenancies(id),kind TEXT NOT NULL CHECK(kind IN ('split','abatement')),effective_from TEXT NOT NULL,effective_to TEXT NOT NULL,resident_cents INTEGER,pha_cents INTEGER,payer TEXT NOT NULL,notice_version_id TEXT,reason TEXT NOT NULL,reference TEXT NOT NULL,base_version INTEGER NOT NULL,prepared_by TEXT NOT NULL,prepared_at TEXT NOT NULL,approved_by TEXT,approved_at TEXT,approval_label TEXT,UNIQUE(tenancy_id,reference));
CREATE TABLE tt_hap_effects(id TEXT PRIMARY KEY,change_id TEXT NOT NULL REFERENCES tt_hap_changes(id),tenancy_id TEXT NOT NULL REFERENCES tt_tenancies(id),resident_charge_id TEXT REFERENCES tt_charges(id),hap_charge_id TEXT NOT NULL REFERENCES tt_hap_charges(id),resident_delta INTEGER NOT NULL,pha_delta INTEGER NOT NULL,posting_day TEXT NOT NULL,effective_from TEXT NOT NULL,effective_to TEXT NOT NULL,created_at TEXT NOT NULL,UNIQUE(change_id,hap_charge_id));
CREATE TRIGGER tt_hap_effect_fixed BEFORE UPDATE ON tt_hap_effects BEGIN SELECT RAISE(ABORT,'HAP effects are immutable'); END;
CREATE TRIGGER tt_hap_effect_kept BEFORE DELETE ON tt_hap_effects BEGIN SELECT RAISE(ABORT,'HAP effects are never deleted'); END;
CREATE TRIGGER tt_hap_change_fixed BEFORE UPDATE ON tt_hap_changes WHEN OLD.approved_at IS NOT NULL AND NOT(EXISTS(SELECT 1 FROM tt_erasure_work WHERE tenancy_id=OLD.tenancy_id) AND NEW.payer='Retained housing authority' AND NEW.reference=OLD.id AND NEW.reason='Retained accounting record' AND NEW.notice_version_id IS NULL) BEGIN SELECT RAISE(ABORT,'Approved HAP changes are immutable'); END;
CREATE TRIGGER tt_hap_change_kept BEFORE DELETE ON tt_hap_changes WHEN OLD.approved_at IS NOT NULL BEGIN SELECT RAISE(ABORT,'Approved HAP changes are retained'); END;
INSERT INTO tt_role_actions(role,action) SELECT role,'hap.change.prepare' FROM tt_role_actions WHERE action='lease.prepare';
INSERT INTO tt_role_actions(role,action) SELECT role,'hap.change.preview' FROM tt_role_actions WHERE action='lease.approve';
INSERT INTO tt_role_actions(role,action) SELECT role,'hap.change.approve' FROM tt_role_actions WHERE action='lease.approve';
