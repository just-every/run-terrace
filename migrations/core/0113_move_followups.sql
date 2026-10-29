-- Occupied-successor follow-ups are staff documentary evidence with append-only review history.
CREATE TABLE tt_move_followups(
 id TEXT PRIMARY KEY,
 tenancy_id TEXT NOT NULL UNIQUE REFERENCES tt_tenancies(id),
 unit_id TEXT NOT NULL REFERENCES tt_units(id),
 move_out TEXT NOT NULL,
 blocker_id TEXT NOT NULL,
 blocker_start TEXT NOT NULL,
 blocker_end TEXT NOT NULL,
 created_by TEXT NOT NULL,
 created_at TEXT NOT NULL
);
CREATE TABLE tt_move_followup_origins(
 followup_id TEXT PRIMARY KEY REFERENCES tt_move_followups(id) ON DELETE CASCADE
);
CREATE TABLE tt_move_followup_revisions(
 followup_id TEXT NOT NULL REFERENCES tt_move_followups(id) ON DELETE CASCADE,
 version INTEGER NOT NULL CHECK(version>0),
 state TEXT NOT NULL CHECK(state IN ('open','resolved','no_work')),
 responsible_id TEXT NOT NULL,
 responsible_name TEXT NOT NULL,
 due_on TEXT NOT NULL,
 next_action TEXT NOT NULL,
 evidence TEXT NOT NULL CHECK(json_valid(evidence) AND json_type(evidence)='array'),
 reason TEXT NOT NULL,
 recorded_by TEXT NOT NULL,
 recorded_at TEXT NOT NULL,
 PRIMARY KEY(followup_id,version)
);
CREATE TRIGGER tt_move_followup_immutable BEFORE UPDATE ON tt_move_followups BEGIN SELECT RAISE(ABORT,'Move-out source evidence is retained'); END;
CREATE TRIGGER tt_move_followup_revision_immutable BEFORE UPDATE ON tt_move_followup_revisions BEGIN SELECT RAISE(ABORT,'Append a follow-up revision'); END;
INSERT INTO tt_role_actions(role,action) SELECT role,'move.followup.read' FROM tt_role_actions WHERE action='tenancy.end';
INSERT INTO tt_role_actions(role,action) SELECT role,'move.followup.update' FROM tt_role_actions WHERE action='tenancy.end';
INSERT INTO tt_role_actions(role,action) SELECT role,'move.followup.resolve' FROM tt_role_actions WHERE action='tenancy.end';
