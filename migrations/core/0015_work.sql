CREATE TABLE tt_inspections (
 id TEXT PRIMARY KEY, tenancy_id TEXT NOT NULL REFERENCES tt_tenancies(id) ON DELETE CASCADE,
 inspection_date TEXT NOT NULL, notes TEXT NOT NULL DEFAULT '',
 state TEXT NOT NULL DEFAULT 'draft' CHECK(state IN ('draft','completed')),
 version INTEGER NOT NULL DEFAULT 1, created_by TEXT NOT NULL, created_at TEXT NOT NULL,
 completed_by TEXT, completed_at TEXT
);
CREATE INDEX tt_inspection_tenancy ON tt_inspections(tenancy_id,inspection_date);
CREATE TABLE tt_inspection_photos (
 id TEXT PRIMARY KEY, inspection_id TEXT NOT NULL REFERENCES tt_inspections(id) ON DELETE CASCADE,
 filename TEXT NOT NULL, media_type TEXT NOT NULL CHECK(media_type IN ('image/jpeg','image/png')),
 size INTEGER NOT NULL CHECK(size>0 AND size<=1500000), sha256 TEXT NOT NULL, bytes BLOB NOT NULL,
 uploaded_by TEXT NOT NULL, uploaded_at TEXT NOT NULL
);
CREATE INDEX tt_photo_inspection ON tt_inspection_photos(inspection_id);
CREATE TABLE tt_maintenance_jobs (
 id TEXT PRIMARY KEY, tenancy_id TEXT NOT NULL REFERENCES tt_tenancies(id) ON DELETE CASCADE,
 proposal_id TEXT NOT NULL UNIQUE REFERENCES tt_proposals(id) ON DELETE CASCADE,
 title TEXT NOT NULL, trade_name TEXT NOT NULL, trade_email TEXT NOT NULL, due_date TEXT NOT NULL,
 estimate_cents INTEGER NOT NULL CHECK(estimate_cents>0),
 state TEXT NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','approved','sent')),
 version INTEGER NOT NULL DEFAULT 1, prepared_by TEXT NOT NULL, prepared_at TEXT NOT NULL,
 sent_by TEXT, sent_at TEXT, sent_reference TEXT,
 CHECK((state='sent' AND sent_by IS NOT NULL AND sent_at IS NOT NULL AND length(sent_reference)>0)
    OR (state!='sent' AND sent_by IS NULL AND sent_at IS NULL AND sent_reference IS NULL))
);
CREATE INDEX tt_maintenance_tenancy ON tt_maintenance_jobs(tenancy_id,prepared_at);
CREATE TABLE tt_maintenance_approvals (
 id TEXT PRIMARY KEY, job_id TEXT NOT NULL UNIQUE REFERENCES tt_maintenance_jobs(id) ON DELETE CASCADE,
 job_version INTEGER NOT NULL, snapshot TEXT NOT NULL, sha256 TEXT NOT NULL,
 approved_by TEXT NOT NULL, approved_role TEXT NOT NULL CHECK(approved_role IN ('owner','admin')),
 approved_at TEXT NOT NULL
);
-- An approval is never edited. Deletion through tenancy erasure remains possible.
CREATE TRIGGER tt_maintenance_approval_immutable BEFORE UPDATE ON tt_maintenance_approvals
BEGIN SELECT RAISE(ABORT,'Maintenance approval is immutable'); END;
