-- WORK-011: checklist configuration, immutable field captures, sourced acknowledgements and reviewed proposals.
ALTER TABLE tt_inspections ADD COLUMN kind TEXT NOT NULL DEFAULT 'routine' CHECK(kind IN ('routine','move_in','move_out'));
ALTER TABLE tt_inspections ADD COLUMN entry_id TEXT REFERENCES tt_inspections(id);
ALTER TABLE tt_inspections ADD COLUMN checklist TEXT;
CREATE TABLE tt_inspection_captures (
 id TEXT PRIMARY KEY, inspection_id TEXT NOT NULL REFERENCES tt_inspections(id) ON DELETE CASCADE,
 client_id TEXT NOT NULL UNIQUE, payload_hash TEXT NOT NULL, inspection_version INTEGER NOT NULL,
 items TEXT NOT NULL, device_consent_at TEXT, reconciliation TEXT, source TEXT NOT NULL, captured_at TEXT NOT NULL, recorded_by TEXT NOT NULL, recorded_at TEXT NOT NULL
);
CREATE TABLE tt_inspection_acknowledgements (
 id TEXT PRIMARY KEY, capture_id TEXT NOT NULL REFERENCES tt_inspection_captures(id) ON DELETE CASCADE,
 item_key TEXT NOT NULL, outcome TEXT NOT NULL CHECK(outcome IN ('acknowledged','disputed')),
 note TEXT NOT NULL, source TEXT NOT NULL, recorded_by TEXT NOT NULL, recorded_at TEXT NOT NULL
);
CREATE TABLE tt_inspection_proposals (
 id TEXT PRIMARY KEY, capture_id TEXT NOT NULL REFERENCES tt_inspection_captures(id) ON DELETE CASCADE,
 entry_capture_id TEXT REFERENCES tt_inspection_captures(id), item_key TEXT NOT NULL,
 kind TEXT NOT NULL CHECK(kind IN ('work','deduction')), amount_cents INTEGER, reason TEXT NOT NULL,
 prepared_by TEXT NOT NULL, prepared_at TEXT NOT NULL,
 decision TEXT CHECK(decision IS NULL OR decision IN ('approved','rejected')),
 decision_reason TEXT, decided_by TEXT, decided_at TEXT
);
CREATE TRIGGER tt_inspection_capture_kept BEFORE UPDATE ON tt_inspection_captures BEGIN SELECT RAISE(ABORT,'Inspection capture is immutable'); END;
CREATE TRIGGER tt_inspection_ack_kept BEFORE UPDATE ON tt_inspection_acknowledgements BEGIN SELECT RAISE(ABORT,'Resident acknowledgement is immutable'); END;
INSERT INTO tt_role_actions(role,action) SELECT role,action FROM
 (SELECT 'portfolio_manager' AS role) CROSS JOIN
 (SELECT 'inspection.configure' AS action UNION SELECT 'inspection.capture' UNION SELECT 'inspection.acknowledge' UNION SELECT 'inspection.propose');
INSERT INTO tt_role_actions(role,action) VALUES ('portfolio_manager','inspection.decide');
