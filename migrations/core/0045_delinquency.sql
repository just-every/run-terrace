-- REPORT-002: operational follow-up responsibility; this grants no financial approval or sending authority.
CREATE TABLE tt_delinquency_assignments (
 tenancy_id TEXT PRIMARY KEY REFERENCES tt_tenancies(id) ON DELETE CASCADE,
 assigned_to TEXT NOT NULL, reference TEXT NOT NULL, version INTEGER NOT NULL CHECK(version>0),
 assigned_by TEXT NOT NULL, assigned_at TEXT NOT NULL
);
CREATE TABLE tt_delinquency_assignment_events (
 id TEXT PRIMARY KEY, tenancy_id TEXT NOT NULL REFERENCES tt_tenancies(id) ON DELETE CASCADE,
 assigned_to TEXT NOT NULL, reference TEXT NOT NULL, version INTEGER NOT NULL CHECK(version>0),
 assigned_by TEXT NOT NULL, assigned_at TEXT NOT NULL, UNIQUE(tenancy_id,version)
);
CREATE TRIGGER tt_delinquency_assignment_event_immutable BEFORE UPDATE ON tt_delinquency_assignment_events
 BEGIN SELECT RAISE(ABORT,'Follow-up assignment history is never edited'); END;
INSERT INTO tt_role_actions(role,action)
 SELECT role,'delinquency.assign' FROM tt_role_actions
 WHERE action='arrears.prepare' AND role IN ('portfolio_manager','bookkeeper');
