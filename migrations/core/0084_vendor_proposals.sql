-- PORTAL-003: availability evidence for staff review only; never a booking or entry authority.
-- No portal identity, session or grant foreign keys: native evidence survives credential-free restore.
CREATE TABLE tt_vendor_appointment_proposals (
 id TEXT PRIMARY KEY,
 job_id TEXT NOT NULL REFERENCES tt_maintenance_jobs(id) ON DELETE CASCADE,
 vendor_id TEXT NOT NULL REFERENCES tt_vendors(id),
 job_version INTEGER NOT NULL CHECK(job_version > 0),
 approval_sha256 TEXT NOT NULL,
 starts_at TEXT NOT NULL,
 ends_at TEXT NOT NULL,
 time_zone TEXT NOT NULL,
 reason TEXT NOT NULL,
 consent_version INTEGER NOT NULL CHECK(consent_version = 1),
 declaration TEXT NOT NULL,
 proposed_by TEXT NOT NULL,
 proposed_at TEXT NOT NULL
);
CREATE INDEX tt_vendor_appointment_proposals_job ON tt_vendor_appointment_proposals(job_id,proposed_at);
CREATE TRIGGER tt_vendor_appointment_proposal_immutable BEFORE UPDATE ON tt_vendor_appointment_proposals BEGIN SELECT RAISE(ABORT,'Vendor appointment proposal evidence is never edited'); END;
