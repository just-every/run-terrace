-- Collection evidence is separate from ledger entries and from provider settlement.
CREATE TABLE tt_arrears_cases (
 tenancy_id TEXT PRIMARY KEY REFERENCES tt_tenancies(id), version INTEGER NOT NULL DEFAULT 1,
 email_consent INTEGER NOT NULL, contact_limit INTEGER NOT NULL, hold TEXT NOT NULL,
 reference TEXT NOT NULL, installation TEXT NOT NULL, actor TEXT NOT NULL, at TEXT NOT NULL
);
CREATE TABLE tt_arrears_events (
 id TEXT PRIMARY KEY, tenancy_id TEXT NOT NULL REFERENCES tt_tenancies(id), kind TEXT NOT NULL,
 detail TEXT NOT NULL, reference TEXT NOT NULL, on_day TEXT NOT NULL, actor TEXT NOT NULL, at TEXT NOT NULL
);
CREATE TABLE tt_arrears_plans (
 id TEXT PRIMARY KEY, tenancy_id TEXT NOT NULL REFERENCES tt_tenancies(id), installments TEXT NOT NULL,
 baseline TEXT NOT NULL, reference TEXT NOT NULL, created_by TEXT NOT NULL, created_at TEXT NOT NULL,
 approved_by TEXT, approved_at TEXT
);
CREATE TABLE tt_arrears_actions (
 id TEXT PRIMARY KEY, tenancy_id TEXT NOT NULL REFERENCES tt_tenancies(id), kind TEXT NOT NULL,
 body TEXT NOT NULL, snapshot TEXT NOT NULL, due_on TEXT NOT NULL, forecast_id TEXT,
 state TEXT NOT NULL DEFAULT 'draft', version INTEGER NOT NULL DEFAULT 1,
 created_by TEXT NOT NULL, created_at TEXT NOT NULL, approved_by TEXT, approved_at TEXT,
 claimed_at TEXT, provider_id TEXT, provider TEXT, installation TEXT NOT NULL
);
CREATE TABLE tt_arrears_service (
 action_id TEXT PRIMARY KEY REFERENCES tt_arrears_actions(id) ON DELETE CASCADE,
 served_at TEXT NOT NULL, method TEXT NOT NULL, server TEXT NOT NULL, reference TEXT NOT NULL,
 photo BLOB NOT NULL, media_type TEXT NOT NULL, sha256 TEXT NOT NULL, expires_on TEXT NOT NULL,
 actor TEXT NOT NULL, at TEXT NOT NULL
);
CREATE TABLE tt_arrears_forecasts (
 id TEXT PRIMARY KEY, tenancy_id TEXT NOT NULL REFERENCES tt_tenancies(id), assumptions TEXT NOT NULL,
 comparison TEXT NOT NULL, baseline TEXT NOT NULL, actor TEXT NOT NULL, at TEXT NOT NULL
);
CREATE INDEX tt_arrears_action_tenancy ON tt_arrears_actions(tenancy_id,created_at);
CREATE TRIGGER tt_arrears_action_content BEFORE UPDATE OF tenancy_id,kind,body,snapshot,due_on,forecast_id,created_by,created_at,installation ON tt_arrears_actions
 BEGIN SELECT RAISE(ABORT,'Prepare a new collection action for changed content'); END;
CREATE TRIGGER tt_arrears_plan_content BEFORE UPDATE OF tenancy_id,installments,baseline,reference,created_by,created_at ON tt_arrears_plans
 BEGIN SELECT RAISE(ABORT,'Prepare a new payment plan for changed terms'); END;
CREATE TRIGGER tt_arrears_event_immutable BEFORE UPDATE ON tt_arrears_events
 BEGIN SELECT RAISE(ABORT,'Collection history is append only'); END;
INSERT INTO tt_role_actions(role,action) VALUES
 ('portfolio_manager','arrears.reply'),
 ('portfolio_manager','arrears.plan'),
 ('portfolio_manager','arrears.plan-approve'),
 ('portfolio_manager','arrears.draft'),
 ('portfolio_manager','arrears.approve'),
 ('portfolio_manager','arrears.send'),
 ('portfolio_manager','arrears.service'),
 ('portfolio_manager','arrears.outcome'),
 ('portfolio_manager','arrears.compare');
INSERT INTO tt_role_actions(role,action) SELECT DISTINCT role,'arrears.compare' FROM tt_role_actions WHERE action='arrears.prepare' AND role<>'portfolio_manager';
INSERT INTO tt_role_actions(role,action) SELECT DISTINCT role,'arrears.draft' FROM tt_role_actions WHERE action='arrears.prepare' AND role<>'portfolio_manager';
CREATE TRIGGER tt_arrears_charge_changed AFTER INSERT ON tt_charges BEGIN
 UPDATE tt_arrears_cases SET version=version+1 WHERE tenancy_id=NEW.tenancy_id;
 UPDATE tt_arrears_actions SET state='stopped',version=version+1 WHERE tenancy_id=NEW.tenancy_id AND state IN ('draft','approved'); END;
CREATE TRIGGER tt_arrears_receipt_changed AFTER INSERT ON tt_receipts BEGIN
 UPDATE tt_arrears_cases SET version=version+1 WHERE tenancy_id=(SELECT tenancy_id FROM tt_charges WHERE id=NEW.charge_id);
 UPDATE tt_arrears_actions SET state='stopped',version=version+1 WHERE tenancy_id=(SELECT tenancy_id FROM tt_charges WHERE id=NEW.charge_id) AND state IN ('draft','approved'); END;
CREATE TRIGGER tt_arrears_reduction_changed AFTER INSERT ON tt_adjustments BEGIN
 UPDATE tt_arrears_cases SET version=version+1 WHERE tenancy_id=(SELECT tenancy_id FROM tt_charges WHERE id=NEW.charge_id);
 UPDATE tt_arrears_actions SET state='stopped',version=version+1 WHERE tenancy_id=(SELECT tenancy_id FROM tt_charges WHERE id=NEW.charge_id) AND state IN ('draft','approved'); END;
CREATE TRIGGER tt_arrears_reversal_changed AFTER INSERT ON tt_receipt_reversals BEGIN
 UPDATE tt_arrears_cases SET version=version+1 WHERE tenancy_id=(SELECT q.tenancy_id FROM tt_receipts r JOIN tt_charges q ON q.id=r.charge_id WHERE r.id=NEW.receipt_id);
 UPDATE tt_arrears_actions SET state='stopped',version=version+1 WHERE tenancy_id=(SELECT q.tenancy_id FROM tt_receipts r JOIN tt_charges q ON q.id=r.charge_id WHERE r.id=NEW.receipt_id) AND state IN ('draft','approved'); END;
CREATE TRIGGER tt_arrears_hap_changed AFTER INSERT ON tt_hap_effects BEGIN
 UPDATE tt_arrears_cases SET version=version+1 WHERE tenancy_id=NEW.tenancy_id;
 UPDATE tt_arrears_actions SET state='stopped',version=version+1 WHERE tenancy_id=NEW.tenancy_id AND state IN ('draft','approved'); END;

CREATE TRIGGER tt_arrears_mail_custody_fence BEFORE INSERT ON rer_mail_event_receipts
WHEN NEW.event_namespace='terrace-arrears' AND NOT EXISTS(
 SELECT 1 FROM tt_arrears_actions a JOIN tt_tenancies t ON t.id=a.tenancy_id
 WHERE t.erased_at IS NULL AND t.custody_retired_at IS NULL AND a.provider=NEW.provider
 AND json_extract(a.snapshot,'$.recipient')=json_extract(NEW.event_json,'$.recipients[0]')
 AND a.provider_id=json_extract(NEW.event_json,'$.providerMessageId')
)
BEGIN SELECT RAISE(ABORT,'arrears_delivery_erased'); END;
