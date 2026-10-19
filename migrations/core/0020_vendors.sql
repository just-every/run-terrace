-- WORK-004: the vendor directory, the qualification each maintenance assignment met or missed, and the
-- documented human exceptions that let held work proceed.
CREATE TABLE tt_vendors (
 id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL, phone TEXT NOT NULL,
 specialties TEXT NOT NULL, service_areas TEXT NOT NULL,
 w9 TEXT NOT NULL CHECK(w9 IN ('received','missing')), insurance_expires TEXT NOT NULL,
 license_number TEXT, license_expires TEXT, availability TEXT NOT NULL,
 rate_cents INTEGER CHECK(rate_cents IS NULL OR rate_cents>0), currency TEXT NOT NULL CHECK(currency='USD'),
 standing TEXT NOT NULL CHECK(standing IN ('preferred','approved','blocked')),
 version INTEGER NOT NULL DEFAULT 1, updated_by TEXT NOT NULL, updated_at TEXT NOT NULL,
 CHECK((license_number IS NULL) = (license_expires IS NULL))
);
-- Jobs prepared before WORK-004 keep vendor_id, trade and qualification NULL (an unlisted vendor).
ALTER TABLE tt_maintenance_jobs ADD COLUMN vendor_id TEXT REFERENCES tt_vendors(id) ON DELETE SET NULL;
ALTER TABLE tt_maintenance_jobs ADD COLUMN trade TEXT;
ALTER TABLE tt_maintenance_jobs ADD COLUMN qualification TEXT;
CREATE TABLE tt_vendor_assignments (
 id TEXT PRIMARY KEY, job_id TEXT NOT NULL REFERENCES tt_maintenance_jobs(id) ON DELETE CASCADE,
 vendor_id TEXT, trade_name TEXT NOT NULL, trade TEXT, issues TEXT NOT NULL, assigned_by TEXT NOT NULL, assigned_at TEXT NOT NULL
);
CREATE INDEX tt_vendor_assignment_job ON tt_vendor_assignments(job_id,assigned_at);
CREATE TABLE tt_vendor_exceptions (
 id TEXT PRIMARY KEY, job_id TEXT NOT NULL REFERENCES tt_maintenance_jobs(id) ON DELETE CASCADE,
 vendor_id TEXT, issues TEXT NOT NULL, reason TEXT NOT NULL,
 approved_by TEXT NOT NULL, approved_role TEXT NOT NULL CHECK(approved_role IN ('owner','admin')), approved_at TEXT NOT NULL
);
CREATE INDEX tt_vendor_exception_job ON tt_vendor_exceptions(job_id);
CREATE TRIGGER tt_vendor_exception_immutable BEFORE UPDATE ON tt_vendor_exceptions
BEGIN SELECT RAISE(ABORT,'A qualification exception is never edited'); END;
