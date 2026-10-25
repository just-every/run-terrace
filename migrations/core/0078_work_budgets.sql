-- Annual category and asset budgets extend the existing owner spending controls.
ALTER TABLE tt_maintenance_jobs ADD COLUMN cost_class TEXT NOT NULL DEFAULT 'operating' CHECK(cost_class IN ('operating','capital'));
CREATE TABLE tt_work_budgets(
 scope TEXT NOT NULL,year TEXT NOT NULL,kind TEXT NOT NULL CHECK(kind IN ('operating','capital')),
 asset_id TEXT NOT NULL DEFAULT '',amount_cents INTEGER NOT NULL CHECK(amount_cents>0),
 reference TEXT NOT NULL,version INTEGER NOT NULL DEFAULT 1,set_by TEXT NOT NULL,set_at TEXT NOT NULL,
 PRIMARY KEY(scope,year,kind,asset_id)
);
CREATE TABLE tt_budget_changes(id TEXT PRIMARY KEY,scope TEXT NOT NULL,year TEXT NOT NULL,kind TEXT NOT NULL,asset_id TEXT NOT NULL,amount_cents INTEGER NOT NULL,reference TEXT NOT NULL,version INTEGER NOT NULL,set_by TEXT NOT NULL,set_at TEXT NOT NULL);
CREATE TABLE tt_budget_clock(id INTEGER PRIMARY KEY CHECK(id=1),version INTEGER NOT NULL);
INSERT INTO tt_budget_clock VALUES(1,1);
CREATE TRIGGER tt_budget_job_insert AFTER INSERT ON tt_maintenance_jobs BEGIN UPDATE tt_budget_clock SET version=version+1; END;
CREATE TRIGGER tt_budget_job_update AFTER UPDATE ON tt_maintenance_jobs BEGIN UPDATE tt_budget_clock SET version=version+1; END;
CREATE TRIGGER tt_budget_bill_insert AFTER INSERT ON tt_bills BEGIN UPDATE tt_budget_clock SET version=version+1; END;
CREATE TRIGGER tt_budget_bill_update AFTER UPDATE ON tt_bills BEGIN UPDATE tt_budget_clock SET version=version+1; END;
CREATE TRIGGER tt_budget_set_insert AFTER INSERT ON tt_work_budgets BEGIN UPDATE tt_budget_clock SET version=version+1; END;
CREATE TRIGGER tt_budget_set_update AFTER UPDATE ON tt_work_budgets BEGIN UPDATE tt_budget_clock SET version=version+1; END;
INSERT INTO tt_role_actions(role,action) SELECT role,'work.budget' FROM tt_role_actions WHERE action='work.limits';
CREATE TRIGGER tt_budget_job_delete AFTER DELETE ON tt_maintenance_jobs BEGIN UPDATE tt_budget_clock SET version=version+1; END;
CREATE TRIGGER tt_budget_bill_delete AFTER DELETE ON tt_bills BEGIN UPDATE tt_budget_clock SET version=version+1; END;
