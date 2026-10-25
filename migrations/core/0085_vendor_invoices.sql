-- PORTAL-003: immutable vendor custody evidence for an ACCT-007 pending bill.
-- Job identifiers remain as evidence if resident work is later retired. No portal credentials
-- or identity or grant foreign keys: accounting evidence survives credential-free native restore.
CREATE TABLE tt_vendor_invoices (
 id TEXT PRIMARY KEY,
 fingerprint TEXT NOT NULL UNIQUE,
 bill_id TEXT NOT NULL UNIQUE REFERENCES tt_bills(id),
 job_id TEXT NOT NULL,
 vendor_id TEXT NOT NULL REFERENCES tt_vendors(id),
 job_version INTEGER NOT NULL CHECK(job_version > 0),
 approval_sha256 TEXT NOT NULL,
 original_sha256 TEXT NOT NULL,
 mailbox_hash TEXT NOT NULL,
 consent_version INTEGER NOT NULL CHECK(consent_version = 1),
 declaration TEXT NOT NULL,
 recorded_by TEXT NOT NULL,
 recorded_at TEXT NOT NULL
);
CREATE INDEX tt_vendor_invoices_job ON tt_vendor_invoices(job_id,recorded_at);
CREATE TRIGGER tt_vendor_invoice_immutable BEFORE UPDATE ON tt_vendor_invoices BEGIN SELECT RAISE(ABORT,'Vendor invoice evidence is never edited'); END;
