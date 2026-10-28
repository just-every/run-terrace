CREATE TABLE tt_print_batches (
 id TEXT PRIMARY KEY, manifest TEXT NOT NULL, manifest_sha256 TEXT NOT NULL,
 pdf_sha256 TEXT NOT NULL, pdf_bytes BLOB NOT NULL, installation TEXT NOT NULL,
 prepared_by TEXT NOT NULL, prepared_at TEXT NOT NULL
);
CREATE TABLE tt_print_items (
 id TEXT PRIMARY KEY, batch_id TEXT NOT NULL REFERENCES tt_print_batches(id) ON DELETE CASCADE,
 thread_id TEXT NOT NULL REFERENCES tt_threads(id) ON DELETE CASCADE, position INTEGER NOT NULL,
 snapshot TEXT NOT NULL, pdf_sha256 TEXT NOT NULL, pdf_bytes BLOB NOT NULL,
 UNIQUE(batch_id,position), UNIQUE(batch_id,thread_id)
);
CREATE TABLE tt_print_approvals (
 batch_id TEXT PRIMARY KEY REFERENCES tt_print_batches(id) ON DELETE CASCADE,
 manifest_sha256 TEXT NOT NULL, pdf_sha256 TEXT NOT NULL,
 actor TEXT NOT NULL, at TEXT NOT NULL, reference TEXT NOT NULL
);
CREATE TRIGGER tt_print_batches_no_update BEFORE UPDATE ON tt_print_batches
BEGIN SELECT RAISE(ABORT,'Prepared print bytes are immutable'); END;
CREATE TRIGGER tt_print_items_no_update BEFORE UPDATE ON tt_print_items
BEGIN SELECT RAISE(ABORT,'Prepared print originals are immutable'); END;
CREATE TRIGGER tt_print_approvals_no_update BEFORE UPDATE ON tt_print_approvals
BEGIN SELECT RAISE(ABORT,'Print approval is immutable'); END;
CREATE TABLE tt_thread_service_next (
 thread_id TEXT PRIMARY KEY REFERENCES tt_threads(id) ON DELETE CASCADE,
 outcome TEXT NOT NULL CHECK(outcome IN ('delivered','failed','uncertain','returned')),
 method TEXT NOT NULL, reference TEXT NOT NULL, served_at TEXT NOT NULL,
 actor TEXT NOT NULL, recorded_at TEXT NOT NULL, fingerprint TEXT NOT NULL,
 server_name TEXT, server_reference TEXT, occurred_at TEXT, tracking TEXT,
 photo_name TEXT, photo_type TEXT, photo_sha256 TEXT, photo_bytes BLOB,
 print_batch_id TEXT
);
INSERT INTO tt_thread_service_next(thread_id,outcome,method,reference,served_at,actor,recorded_at,fingerprint)
 SELECT thread_id,outcome,method,reference,served_at,actor,recorded_at,fingerprint FROM tt_thread_service;
DROP TABLE tt_thread_service;
ALTER TABLE tt_thread_service_next RENAME TO tt_thread_service;
CREATE TRIGGER tt_thread_service_no_update BEFORE UPDATE ON tt_thread_service
BEGIN SELECT RAISE(ABORT,'Recorded service is immutable'); END;
CREATE TABLE tt_thread_reconciliations_next (
 id TEXT PRIMARY KEY, thread_id TEXT NOT NULL REFERENCES tt_threads(id) ON DELETE CASCADE,
 revision INTEGER NOT NULL, outcome TEXT NOT NULL CHECK(outcome IN ('delivered','failed','uncertain','returned')),
 assigned_to TEXT NOT NULL, next_action TEXT NOT NULL, due_on TEXT NOT NULL,
 reference TEXT NOT NULL, actor TEXT NOT NULL, at TEXT NOT NULL,
 fingerprint TEXT NOT NULL, UNIQUE(thread_id,revision)
);
INSERT INTO tt_thread_reconciliations_next SELECT * FROM tt_thread_reconciliations;
DROP TABLE tt_thread_reconciliations;
ALTER TABLE tt_thread_reconciliations_next RENAME TO tt_thread_reconciliations;
CREATE TRIGGER tt_thread_reconciliations_no_update BEFORE UPDATE ON tt_thread_reconciliations
BEGIN SELECT RAISE(ABORT,'Service reconciliation is immutable'); END;
INSERT INTO tt_role_actions(role,action) VALUES
 ('portfolio_manager','thread.print.prepare'),('portfolio_manager','thread.print.approve');
