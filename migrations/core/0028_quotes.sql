-- WORK-003. Comparable vendor quotes per job; the owner's per-job spending limit and annual maintenance
-- budget, recorded per property (per tenancy when it has no unit record); the owner's decision on work above
-- them, recorded by staff for the owner; and one approval per approved job version, because a change to
-- scope, vendor or price reopens authorization.
CREATE TABLE tt_job_quotes (
 id TEXT PRIMARY KEY, job_id TEXT NOT NULL REFERENCES tt_maintenance_jobs(id) ON DELETE CASCADE,
 vendor_id TEXT, vendor_name TEXT NOT NULL, vendor_email TEXT NOT NULL, scope TEXT NOT NULL, available_date TEXT NOT NULL,
 amount_cents INTEGER NOT NULL CHECK(amount_cents>0), tax_cents INTEGER NOT NULL CHECK(tax_cents>=0), currency TEXT NOT NULL,
 recorded_by TEXT NOT NULL, recorded_at TEXT NOT NULL
);
CREATE INDEX tt_job_quotes_job ON tt_job_quotes(job_id);
CREATE TABLE tt_work_limits (
 scope TEXT PRIMARY KEY, limit_cents INTEGER NOT NULL CHECK(limit_cents>0), budget_cents INTEGER CHECK(budget_cents IS NULL OR budget_cents>0),
 currency TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1, set_by TEXT NOT NULL, set_at TEXT NOT NULL
);
CREATE TABLE tt_owner_decisions (
 id TEXT PRIMARY KEY, job_id TEXT NOT NULL REFERENCES tt_maintenance_jobs(id) ON DELETE CASCADE, job_version INTEGER NOT NULL,
 terms_sha256 TEXT NOT NULL, decision TEXT NOT NULL CHECK(decision IN ('approved','declined')),
 source TEXT NOT NULL CHECK(source IN ('email','document','call')), reference TEXT NOT NULL,
 recorded_by TEXT NOT NULL, recorded_role TEXT NOT NULL CHECK(recorded_role IN ('owner','admin')), recorded_at TEXT NOT NULL,
 UNIQUE(job_id,job_version)
);
CREATE TRIGGER tt_owner_decision_immutable BEFORE UPDATE ON tt_owner_decisions
BEGIN SELECT RAISE(ABORT,'An owner decision is never edited'); END;
ALTER TABLE tt_maintenance_jobs ADD COLUMN scope TEXT;
ALTER TABLE tt_maintenance_jobs ADD COLUMN quote_id TEXT;
CREATE TABLE tt_maintenance_approvals_next (
 id TEXT PRIMARY KEY, job_id TEXT NOT NULL REFERENCES tt_maintenance_jobs(id) ON DELETE CASCADE,
 job_version INTEGER NOT NULL, snapshot TEXT NOT NULL, sha256 TEXT NOT NULL,
 approved_by TEXT NOT NULL, approved_role TEXT NOT NULL CHECK(approved_role IN ('owner','admin')),
 approved_at TEXT NOT NULL, UNIQUE(job_id,job_version)
);
INSERT INTO tt_maintenance_approvals_next SELECT id,job_id,job_version,snapshot,sha256,approved_by,approved_role,approved_at FROM tt_maintenance_approvals;
DROP TABLE tt_maintenance_approvals;
ALTER TABLE tt_maintenance_approvals_next RENAME TO tt_maintenance_approvals;
CREATE TRIGGER tt_maintenance_approval_immutable BEFORE UPDATE ON tt_maintenance_approvals
BEGIN SELECT RAISE(ABORT,'Maintenance approval is immutable'); END;
