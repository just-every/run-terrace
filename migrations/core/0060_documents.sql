-- PORT-007: operating documents on tenancy records, versioned, with the original bytes, their SHA-256 and the upload check result.
-- A new version appends; the earlier version stays readable. Screening, application and tax documents carry a restriction that needs its own action.
CREATE TABLE tt_documents (
 id TEXT PRIMARY KEY,
 tenancy_id TEXT NOT NULL REFERENCES tt_tenancies(id),
 kind TEXT NOT NULL CHECK(kind IN ('lease','application','screening','notice','inspection','work','invoice','tax','other')),
 title TEXT NOT NULL,
 retention_class TEXT NOT NULL CHECK(retention_class IN ('lease','accounting','screening','communications')),
 restriction TEXT CHECK(restriction IS NULL OR restriction IN ('screening','tax')),
 version INTEGER NOT NULL CHECK(version > 0),
 created_by TEXT NOT NULL,
 created_at TEXT NOT NULL
);
CREATE INDEX tt_documents_tenancy ON tt_documents(tenancy_id);
CREATE TABLE tt_document_versions (
 id TEXT PRIMARY KEY,
 document_id TEXT NOT NULL REFERENCES tt_documents(id),
 version INTEGER NOT NULL CHECK(version > 0),
 name TEXT NOT NULL,
 media_type TEXT NOT NULL,
 size INTEGER NOT NULL CHECK(size > 0 AND size <= 5242880),
 sha256 TEXT NOT NULL,
 bytes BLOB NOT NULL,
 content_text TEXT,
 note TEXT NOT NULL,
 scan TEXT NOT NULL,
 uploaded_by TEXT NOT NULL,
 uploaded_at TEXT NOT NULL,
 UNIQUE(document_id,version)
);
CREATE TRIGGER tt_document_version_immutable BEFORE UPDATE ON tt_document_versions BEGIN SELECT RAISE(ABORT,'A document version is never edited; upload a new version'); END;
CREATE TABLE tt_erased_document_files(sha256 TEXT PRIMARY KEY);
INSERT INTO tt_role_actions(role,action) VALUES
('portfolio_manager','document.read'),('portfolio_manager','document.upload'),('portfolio_manager','document.revise'),('portfolio_manager','document.screening'),('portfolio_manager','document.tax'),
('leasing','document.read'),('leasing','document.upload'),('leasing','document.revise'),
('maintenance_coordinator','document.read'),('maintenance_coordinator','document.upload'),('maintenance_coordinator','document.revise');
