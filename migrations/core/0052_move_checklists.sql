-- PORT-006: sourced operational handover snapshots; corrections append a revision.
-- These are lease evidence under SAFE-004 and follow the existing move-out role capability.
CREATE TABLE tt_move_checklists (
 id TEXT PRIMARY KEY,
 tenancy_id TEXT NOT NULL REFERENCES tt_tenancies(id),
 kind TEXT NOT NULL CHECK(kind IN ('move_in','move_out')),
 move_date TEXT NOT NULL,
 version INTEGER NOT NULL CHECK(version > 0),
 items TEXT NOT NULL,
 reference TEXT NOT NULL,
 recorded_by TEXT NOT NULL,
 recorded_at TEXT NOT NULL,
 UNIQUE(tenancy_id,kind,version)
);
CREATE TRIGGER tt_move_checklist_immutable BEFORE UPDATE ON tt_move_checklists BEGIN SELECT RAISE(ABORT,'A handover correction appends a revision'); END;
INSERT INTO tt_role_actions(role,action) SELECT role,'move.checklist' FROM tt_role_actions WHERE action='tenancy.end';
