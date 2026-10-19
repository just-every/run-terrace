-- WORK-001 / BOUND-003: staff-recorded safety intake, owner-approved guidance per risk, portfolio on-call and backup,
-- recorded alerts with the provider's own outcome, human acknowledgement and human resolution. No SMS or voice paging.
CREATE TABLE tt_emergency_guidance (
 id TEXT PRIMARY KEY, risk TEXT NOT NULL CHECK(risk IN ('gas','fire','electric','water','habitability','other')),
 version INTEGER NOT NULL, immediate_danger INTEGER NOT NULL CHECK(immediate_danger IN (0,1)),
 guidance TEXT NOT NULL, call_instruction TEXT, approved_by TEXT NOT NULL, approved_role TEXT NOT NULL, approved_at TEXT NOT NULL,
 UNIQUE(risk,version), CHECK(immediate_danger=0 OR call_instruction IS NOT NULL)
);
CREATE TABLE tt_oncall (
 id TEXT PRIMARY KEY, portfolio_id TEXT NOT NULL REFERENCES tt_portfolios(id), primary_id TEXT NOT NULL, backup_id TEXT NOT NULL,
 set_by TEXT NOT NULL, set_at TEXT NOT NULL, CHECK(primary_id<>backup_id)
);
CREATE INDEX tt_oncall_current ON tt_oncall(portfolio_id,set_at);
CREATE TABLE tt_emergencies (
 id TEXT PRIMARY KEY, tenancy_id TEXT NOT NULL REFERENCES tt_tenancies(id), unit_id TEXT NOT NULL, portfolio_id TEXT NOT NULL,
 asset_id TEXT, channel TEXT NOT NULL CHECK(channel IN ('phone','email','in_person','staff_observed')), reporter TEXT NOT NULL,
 description TEXT NOT NULL, risk TEXT NOT NULL, emergency INTEGER NOT NULL CHECK(emergency IN (0,1)), reported_at TEXT NOT NULL,
 guidance_id TEXT REFERENCES tt_emergency_guidance(id), guidance_given TEXT NOT NULL,
 oncall_id TEXT REFERENCES tt_oncall(id), primary_id TEXT, backup_id TEXT,
 state TEXT NOT NULL DEFAULT 'open' CHECK(state IN ('open','acknowledged','resolved')),
 acknowledged_by TEXT, acknowledged_at TEXT, resolved_by TEXT, resolved_at TEXT, field_work TEXT, resident_followup TEXT,
 version INTEGER NOT NULL DEFAULT 1, recorded_by TEXT NOT NULL, recorded_at TEXT NOT NULL,
 CHECK(state<>'resolved' OR (acknowledged_at IS NOT NULL AND field_work IS NOT NULL AND resident_followup IS NOT NULL))
);
CREATE INDEX tt_emergency_open ON tt_emergencies(state,reported_at);
CREATE TABLE tt_emergency_events (
 id TEXT PRIMARY KEY, emergency_id TEXT NOT NULL REFERENCES tt_emergencies(id) ON DELETE CASCADE,
 kind TEXT NOT NULL CHECK(kind IN ('reported','alert','escalated','acknowledged','resolved')), recipient_id TEXT,
 outcome TEXT, reference TEXT NOT NULL, label TEXT NOT NULL, recorded_by TEXT NOT NULL, recorded_at TEXT NOT NULL
);
CREATE INDEX tt_emergency_event_history ON tt_emergency_events(emergency_id,recorded_at);
CREATE TRIGGER tt_emergency_guidance_immutable BEFORE UPDATE ON tt_emergency_guidance BEGIN SELECT RAISE(ABORT,'Approved guidance is never edited; approve a new version'); END;
CREATE TRIGGER tt_oncall_immutable BEFORE UPDATE ON tt_oncall BEGIN SELECT RAISE(ABORT,'On-call assignments are never edited; assign again'); END;
CREATE TRIGGER tt_emergency_intake_immutable BEFORE UPDATE OF tenancy_id,unit_id,portfolio_id,asset_id,channel,reporter,description,risk,emergency,reported_at,guidance_id,guidance_given,oncall_id,primary_id,backup_id,recorded_by,recorded_at ON tt_emergencies BEGIN SELECT RAISE(ABORT,'Emergency intake is never edited'); END;
CREATE TRIGGER tt_emergency_event_immutable BEFORE UPDATE ON tt_emergency_events BEGIN SELECT RAISE(ABORT,'Emergency history is never edited'); END;
INSERT INTO tt_role_actions(role,action) VALUES
('portfolio_manager','emergency.read'),('portfolio_manager','emergency.report'),('portfolio_manager','emergency.escalate'),('portfolio_manager','emergency.acknowledge'),('portfolio_manager','emergency.resolve'),('portfolio_manager','emergency.guidance'),('portfolio_manager','emergency.oncall'),
('maintenance_coordinator','emergency.read'),('maintenance_coordinator','emergency.report'),('maintenance_coordinator','emergency.escalate'),('maintenance_coordinator','emergency.acknowledge');
