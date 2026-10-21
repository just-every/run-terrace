-- OPS-003: persistent workflow templates and runs. A template version is immutable; a run keeps the version it started
-- under. Every transition appends a sequenced, never-edited event, and the run row keeps the durable next action, so a
-- restart resumes from D1 alone. Terrace performs no outbound contact: attempts and replies are staff-recorded.
CREATE TABLE tt_workflow_templates (
 id TEXT PRIMARY KEY,
 template_key TEXT NOT NULL,
 version INTEGER NOT NULL CHECK(version > 0),
 name TEXT NOT NULL,
 kind TEXT NOT NULL CHECK(kind IN ('leasing','renewal','rent','delinquency','unit_turn')),
 trigger TEXT NOT NULL,
 conditions TEXT NOT NULL,
 steps TEXT NOT NULL,
 contact_limit INTEGER NOT NULL CHECK(contact_limit BETWEEN 1 AND 10),
 escalate_to TEXT NOT NULL,
 reference TEXT NOT NULL,
 retired_at TEXT,
 retired_by TEXT,
 created_by TEXT NOT NULL,
 created_at TEXT NOT NULL,
 UNIQUE(template_key,version)
);
CREATE TRIGGER tt_workflow_template_immutable BEFORE UPDATE OF template_key,version,name,kind,trigger,conditions,steps,contact_limit,escalate_to,reference,created_by,created_at ON tt_workflow_templates BEGIN SELECT RAISE(ABORT,'A template change appends a version'); END;
CREATE TABLE tt_workflow_runs (
 id TEXT PRIMARY KEY,
 template_id TEXT NOT NULL REFERENCES tt_workflow_templates(id),
 template_key TEXT NOT NULL,
 kind TEXT NOT NULL,
 subject_kind TEXT NOT NULL CHECK(subject_kind IN ('prospect','renewal','tenancy','turnover')),
 subject_id TEXT NOT NULL,
 tenancy_id TEXT REFERENCES tt_tenancies(id) ON DELETE CASCADE,
 unit_id TEXT,
 portfolio_id TEXT,
 label TEXT NOT NULL,
 zone TEXT NOT NULL,
 state TEXT NOT NULL DEFAULT 'running' CHECK(state IN ('running','paused','escalated','completed','closed','cancelled')),
 step_index INTEGER NOT NULL DEFAULT 0,
 step_started_on TEXT NOT NULL,
 step_due_on TEXT NOT NULL,
 assignee TEXT,
 contacts INTEGER NOT NULL DEFAULT 0,
 awaiting INTEGER NOT NULL DEFAULT 0 CHECK(awaiting IN (0,1)),
 pause_reason TEXT,
 escalation_reason TEXT,
 escalated_to TEXT,
 next_action TEXT,
 authority_operator TEXT NOT NULL,
 authority_role TEXT NOT NULL,
 authority_version INTEGER NOT NULL,
 version INTEGER NOT NULL DEFAULT 1,
 started_by TEXT NOT NULL,
 started_at TEXT NOT NULL,
 ended_at TEXT,
 CHECK(state<>'paused' OR pause_reason IS NOT NULL),
 CHECK(state<>'escalated' OR (escalation_reason IS NOT NULL AND escalated_to IS NOT NULL)),
 CHECK(state IN ('completed','closed','cancelled') OR next_action IS NOT NULL),
 CHECK((state IN ('completed','closed','cancelled'))=(ended_at IS NOT NULL))
);
CREATE UNIQUE INDEX tt_workflow_live ON tt_workflow_runs(template_key,subject_kind,subject_id) WHERE state IN ('running','paused','escalated');
CREATE INDEX tt_workflow_subject ON tt_workflow_runs(subject_kind,subject_id);
CREATE INDEX tt_workflow_tenancy ON tt_workflow_runs(tenancy_id);
CREATE TABLE tt_workflow_events (
 id TEXT PRIMARY KEY,
 run_id TEXT NOT NULL REFERENCES tt_workflow_runs(id) ON DELETE CASCADE,
 tenancy_id TEXT REFERENCES tt_tenancies(id) ON DELETE CASCADE,
 sequence INTEGER NOT NULL,
 kind TEXT NOT NULL CHECK(kind IN ('started','step_done','attempt','reconciled','reply','paused','resumed','escalated','escalation_resolved','completed','cancelled')),
 step_index INTEGER NOT NULL,
 detail TEXT NOT NULL,
 reference TEXT NOT NULL,
 label TEXT NOT NULL,
 recorded_by TEXT NOT NULL,
 recorded_at TEXT NOT NULL,
 UNIQUE(run_id,sequence)
);
CREATE TRIGGER tt_workflow_event_immutable BEFORE UPDATE ON tt_workflow_events BEGIN SELECT RAISE(ABORT,'Workflow history is never edited'); END;
INSERT INTO tt_role_actions(role,action) VALUES
('portfolio_manager','workflow.template'),('portfolio_manager','workflow.retire'),('portfolio_manager','workflow.resume'),('portfolio_manager','workflow.resolve'),('portfolio_manager','workflow.cancel'),
('portfolio_manager','workflow.read'),('leasing','workflow.read'),('bookkeeper','workflow.read'),('maintenance_coordinator','workflow.read'),('member','workflow.read'),
('portfolio_manager','workflow.start'),('portfolio_manager','workflow.sweep'),('portfolio_manager','workflow.step'),('portfolio_manager','workflow.attempt'),('portfolio_manager','workflow.reply'),
('leasing','workflow.start'),('leasing','workflow.sweep'),('leasing','workflow.step'),('leasing','workflow.attempt'),('leasing','workflow.reply'),
('bookkeeper','workflow.start'),('bookkeeper','workflow.sweep'),('bookkeeper','workflow.step'),('bookkeeper','workflow.attempt'),('bookkeeper','workflow.reply'),
('maintenance_coordinator','workflow.start'),('maintenance_coordinator','workflow.sweep'),('maintenance_coordinator','workflow.step'),('maintenance_coordinator','workflow.attempt'),('maintenance_coordinator','workflow.reply');
