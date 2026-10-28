-- Owner-reviewed resident access binds the exact original, never later revisions.
-- Sharing authority stays in this installation; originals remain portable.
CREATE TABLE tt_resident_document_shares(
 tenancy_id TEXT NOT NULL REFERENCES tt_tenancies(id),
 source TEXT NOT NULL CHECK(source IN ('document','signed')),
 version_id TEXT NOT NULL,
 sha256 TEXT NOT NULL,
 shared_by TEXT NOT NULL,
 shared_at TEXT NOT NULL,
 PRIMARY KEY(source,version_id)
);
