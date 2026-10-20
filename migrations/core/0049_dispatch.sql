-- WORK-006: approved dispatch snapshots and sourced staff-recorded technician replies.
ALTER TABLE tt_maintenance_jobs ADD COLUMN checklist TEXT NOT NULL DEFAULT '[]';
CREATE TABLE tt_dispatches (
 id TEXT PRIMARY KEY, job_id TEXT NOT NULL REFERENCES tt_maintenance_jobs(id) ON DELETE CASCADE,
 approval_id TEXT NOT NULL REFERENCES tt_maintenance_approvals(id), appointment_id TEXT REFERENCES tt_appointments(id) ON DELETE SET NULL,
 snapshot TEXT NOT NULL, outcome TEXT NOT NULL, provider_id TEXT, label TEXT NOT NULL,
 recorded_by TEXT NOT NULL, recorded_at TEXT NOT NULL, UNIQUE(approval_id)
);
CREATE TABLE tt_dispatch_events (
 id TEXT PRIMARY KEY, dispatch_id TEXT NOT NULL REFERENCES tt_dispatches(id) ON DELETE CASCADE,
 sequence INTEGER NOT NULL, kind TEXT NOT NULL, reference TEXT NOT NULL, checklist TEXT NOT NULL DEFAULT '[]',
 recorded_by TEXT NOT NULL, recorded_at TEXT NOT NULL, UNIQUE(dispatch_id,sequence)
);
CREATE INDEX tt_dispatch_history ON tt_dispatch_events(dispatch_id,recorded_at);
CREATE TRIGGER tt_dispatch_snapshot_immutable BEFORE UPDATE OF job_id,approval_id,appointment_id,snapshot,recorded_by,recorded_at ON tt_dispatches BEGIN SELECT RAISE(ABORT,'Dispatch evidence is never edited'); END;
CREATE TRIGGER tt_dispatch_event_immutable BEFORE UPDATE ON tt_dispatch_events BEGIN SELECT RAISE(ABORT,'Dispatch history is never edited'); END;
INSERT INTO tt_role_actions(role,action) SELECT role,'maintenance.dispatch' FROM tt_role_actions WHERE action='maintenance.sent';
INSERT INTO tt_role_actions(role,action) SELECT role,'maintenance.progress' FROM tt_role_actions WHERE action='maintenance.sent';
INSERT INTO tt_role_actions(role,action) SELECT role,'maintenance.escalate' FROM tt_role_actions WHERE action='maintenance.sent';
