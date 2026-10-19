-- PORT-005: immutable complete signed lease versions and private PDF custody.
CREATE TABLE tt_lease_versions (
 id TEXT PRIMARY KEY, tenancy_id TEXT NOT NULL REFERENCES tt_tenancies(id) ON DELETE CASCADE,
 effective TEXT NOT NULL, signed_date TEXT NOT NULL, signers TEXT NOT NULL, reference TEXT NOT NULL,
 payload TEXT NOT NULL, payload_sha256 TEXT NOT NULL, source_sha256 TEXT NOT NULL,
 source_name TEXT NOT NULL, source_size INTEGER NOT NULL CHECK(source_size>0 AND source_size<=5242880),
 base_version INTEGER NOT NULL, prior_id TEXT, prepared_by TEXT NOT NULL, prepared_at TEXT NOT NULL,
 approved_by TEXT, approved_at TEXT, approval_label TEXT, approval_month TEXT, approval_fingerprint TEXT,
 CHECK((approved_by IS NULL)=(approved_at IS NULL))
);
CREATE INDEX tt_lease_versions_tenancy ON tt_lease_versions(tenancy_id,effective);
CREATE UNIQUE INDEX tt_lease_approved_effective ON tt_lease_versions(tenancy_id,effective) WHERE approved_at IS NOT NULL;
CREATE TABLE tt_lease_sources (
 lease_version_id TEXT PRIMARY KEY REFERENCES tt_lease_versions(id) ON DELETE CASCADE,
 name TEXT NOT NULL, media_type TEXT NOT NULL CHECK(media_type='application/pdf'), bytes BLOB NOT NULL, sha256 TEXT NOT NULL
);
CREATE TABLE tt_erased_lease_files(sha256 TEXT PRIMARY KEY);
ALTER TABLE tt_lease_terms ADD COLUMN lease_version_id TEXT;
ALTER TABLE tt_lease_terms ADD COLUMN source_clause TEXT;
ALTER TABLE tt_lease_terms ADD COLUMN superseded_by TEXT;
CREATE TRIGGER tt_lease_version_kept BEFORE UPDATE ON tt_lease_versions WHEN
 OLD.approved_at IS NOT NULL OR NEW.id IS NOT OLD.id OR NEW.tenancy_id IS NOT OLD.tenancy_id OR
 NEW.effective IS NOT OLD.effective OR NEW.signed_date IS NOT OLD.signed_date OR NEW.signers IS NOT OLD.signers OR
 NEW.reference IS NOT OLD.reference OR NEW.payload IS NOT OLD.payload OR NEW.payload_sha256 IS NOT OLD.payload_sha256 OR
 NEW.source_sha256 IS NOT OLD.source_sha256 OR NEW.source_name IS NOT OLD.source_name OR NEW.source_size IS NOT OLD.source_size OR
 NEW.base_version IS NOT OLD.base_version OR NEW.prior_id IS NOT OLD.prior_id OR
 NEW.prepared_by IS NOT OLD.prepared_by OR NEW.prepared_at IS NOT OLD.prepared_at OR NEW.approved_at IS NULL
 BEGIN SELECT RAISE(ABORT,'A signed lease version is immutable'); END;
CREATE TRIGGER tt_lease_source_kept BEFORE UPDATE ON tt_lease_sources BEGIN SELECT RAISE(ABORT,'A signed lease source is immutable'); END;
INSERT INTO tt_role_actions(role,action) VALUES
 ('portfolio_manager','lease.prepare'),('portfolio_manager','lease.preview'),('portfolio_manager','lease.approve'),
 ('portfolio_manager','lease.read'),('portfolio_manager','lease.source'),
 ('leasing','lease.metadata'),('bookkeeper','lease.read'),('bookkeeper','lease.source'),('accountant','lease.read'),('accountant','lease.source');
