-- PORTAL-003: a vendor response acknowledges exact approved work; it grants no dispatch or payment authority.
CREATE TABLE tt_vendor_work_responses (
 id TEXT PRIMARY KEY,
 job_id TEXT NOT NULL REFERENCES tt_maintenance_jobs(id) ON DELETE CASCADE,
 vendor_id TEXT NOT NULL REFERENCES tt_vendors(id),
 job_version INTEGER NOT NULL,
 approval_sha256 TEXT NOT NULL,
 outcome TEXT NOT NULL CHECK(outcome IN ('accepted','declined')),
 consent_version INTEGER NOT NULL,
 responded_by TEXT NOT NULL,
 responded_at TEXT NOT NULL,
 UNIQUE(job_id,vendor_id,job_version)
);
CREATE TRIGGER tt_vendor_response_immutable BEFORE UPDATE ON tt_vendor_work_responses BEGIN SELECT RAISE(ABORT,'Vendor response evidence is never edited'); END;
