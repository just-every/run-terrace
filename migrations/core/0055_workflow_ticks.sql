-- OPS-003: a tick and all its starts, escalations and WORK-010 orders commit together.
CREATE TABLE tt_workflow_ticks (
 id TEXT PRIMARY KEY,
 at TEXT NOT NULL,
 requested_by TEXT,
 actor TEXT NOT NULL CHECK(actor='scheduler:workflows'),
 detail TEXT NOT NULL
);
CREATE TRIGGER tt_workflow_tick_immutable BEFORE UPDATE ON tt_workflow_ticks BEGIN SELECT RAISE(ABORT,'Tick history is never edited'); END;
-- Only the owner and managers over every portfolio may request Run now.
DELETE FROM tt_role_actions WHERE action='workflow.sweep' AND role<>'portfolio_manager';
-- A send group is one workflow attempt, even when a renewal offer has several recipients.
CREATE TABLE tt_workflow_sends (
 run_id TEXT NOT NULL REFERENCES tt_workflow_runs(id) ON DELETE CASCADE,
 send_id TEXT NOT NULL,
 send_state TEXT NOT NULL,
 results TEXT,
 provider_results TEXT,
 PRIMARY KEY(run_id,send_id)
);
