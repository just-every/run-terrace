-- PORT-009: immutable record attachments; bounded chunks avoid a single oversized D1 value.
CREATE TABLE tt_record_media (
 id TEXT PRIMARY KEY, attachment_id TEXT NOT NULL, version INTEGER NOT NULL CHECK(version>0),
 inspection_id TEXT REFERENCES tt_inspections(id) ON DELETE CASCADE,
 job_id TEXT REFERENCES tt_maintenance_jobs(id) ON DELETE CASCADE,
 bill_id TEXT REFERENCES tt_bills(id) ON DELETE CASCADE,
 name TEXT NOT NULL, media_type TEXT NOT NULL, size INTEGER NOT NULL CHECK(size>0 AND size<=26214400),
 sha256 TEXT NOT NULL, source TEXT NOT NULL, captured_at TEXT NOT NULL,
 uploaded_by TEXT NOT NULL, uploaded_at TEXT NOT NULL,
 state TEXT NOT NULL DEFAULT 'uploading' CHECK(state IN ('uploading','ready')),
 CHECK((inspection_id IS NOT NULL)+(job_id IS NOT NULL)+(bill_id IS NOT NULL)=1)
);
CREATE UNIQUE INDEX tt_record_media_version ON tt_record_media(attachment_id,version) WHERE state='ready';
CREATE TABLE tt_record_media_chunks (
 id TEXT PRIMARY KEY, media_id TEXT NOT NULL REFERENCES tt_record_media(id) ON DELETE CASCADE,
 position INTEGER NOT NULL CHECK(position>=0 AND position<100),
 sha256 TEXT NOT NULL, bytes BLOB NOT NULL CHECK(length(bytes)>0 AND length(bytes)<=262144),
 UNIQUE(media_id,position)
);
CREATE TRIGGER tt_media_kept BEFORE UPDATE ON tt_record_media WHEN OLD.state='ready' BEGIN SELECT RAISE(ABORT,'Original media is immutable'); END;
CREATE TRIGGER tt_media_chunk_kept BEFORE UPDATE ON tt_record_media_chunks BEGIN SELECT RAISE(ABORT,'Original chunk is immutable'); END;
CREATE TABLE tt_erased_media_files(sha256 TEXT PRIMARY KEY);
-- Same role boundary as existing work capture and bill attachment commands, narrowed again by target.
INSERT INTO tt_role_actions(role,action) SELECT role,action FROM
 (SELECT 'portfolio_manager' AS role UNION SELECT 'maintenance_coordinator' UNION SELECT 'bookkeeper') CROSS JOIN
 (SELECT 'media.begin' AS action UNION SELECT 'media.chunk' UNION SELECT 'media.finish' UNION SELECT 'media.abort');
-- Eligible accounting redaction retires invoice evidence in the same existing transaction.
CREATE TRIGGER tt_media_bill_erasure AFTER DELETE ON tt_bill_attachments BEGIN
 INSERT OR IGNORE INTO tt_erased_media_files SELECT sha256 FROM tt_record_media WHERE bill_id=OLD.bill_id;
 DELETE FROM tt_record_media WHERE bill_id=OLD.bill_id;
END;
CREATE TRIGGER tt_media_inspection_erasure BEFORE DELETE ON tt_inspections BEGIN
 INSERT OR IGNORE INTO tt_erased_media_files SELECT sha256 FROM tt_record_media WHERE inspection_id=OLD.id;
END;
CREATE TRIGGER tt_media_job_erasure BEFORE DELETE ON tt_maintenance_jobs BEGIN
 INSERT OR IGNORE INTO tt_erased_media_files SELECT sha256 FROM tt_record_media WHERE job_id=OLD.id;
END;
