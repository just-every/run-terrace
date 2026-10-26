-- PAY-013: external documentary PHA remittances, explicit allocations and held remainder.
CREATE TABLE tt_hap_remittances(
 id TEXT PRIMARY KEY,
 source_tenancy_id TEXT NOT NULL REFERENCES tt_tenancies(id),
 source_document_version_id TEXT NOT NULL UNIQUE,
 payer_name TEXT NOT NULL COLLATE NOCASE,
 method TEXT NOT NULL CHECK(method IN ('ach','check')),
 currency TEXT NOT NULL CHECK(currency='USD'),
 amount_cents INTEGER NOT NULL CHECK(amount_cents>0 AND amount_cents<=100000000),
 received_date TEXT NOT NULL,
 reference TEXT NOT NULL,
 state TEXT NOT NULL CHECK(state IN ('pending','received','failed')),
 version INTEGER NOT NULL DEFAULT 1 CHECK(version>0),
 outcome_date TEXT,
 outcome_reference TEXT,
 outcome_recorded_at TEXT,
 recorded_by TEXT NOT NULL,
 recorded_at TEXT NOT NULL,
 UNIQUE(payer_name,currency,reference),
 CHECK((state='pending' AND outcome_date IS NULL AND outcome_reference IS NULL AND outcome_recorded_at IS NULL) OR (state<>'pending' AND outcome_date>=received_date AND outcome_reference IS NOT NULL AND outcome_recorded_at IS NOT NULL))
);
CREATE TABLE tt_hap_allocation_batches(
 id TEXT PRIMARY KEY,
 remittance_id TEXT NOT NULL REFERENCES tt_hap_remittances(id),
 reference TEXT NOT NULL,
 recorded_by TEXT NOT NULL,
 recorded_at TEXT NOT NULL,
 UNIQUE(remittance_id,reference)
);
CREATE TABLE tt_hap_allocations(
 id TEXT PRIMARY KEY,
 batch_id TEXT NOT NULL REFERENCES tt_hap_allocation_batches(id),
 remittance_id TEXT NOT NULL REFERENCES tt_hap_remittances(id),
 charge_id TEXT NOT NULL REFERENCES tt_hap_charges(id),
 amount_cents INTEGER NOT NULL CHECK(amount_cents>0 AND amount_cents<=100000000),
 recorded_at TEXT NOT NULL,
 UNIQUE(remittance_id,charge_id)
);
CREATE INDEX tt_hap_allocation_charge ON tt_hap_allocations(charge_id);
CREATE INDEX tt_hap_remittance_source ON tt_hap_remittances(source_tenancy_id);

-- Source charge journal beneficiaries stay frozen even after a dated ownership change.
-- Round against remaining frozen receivables so repeated penny partials cannot
-- overpay one beneficiary. PHA credits stay with the original beneficiary.
CREATE VIEW tt_hap_receipt_owner_balances AS
 SELECT q.id AS charge_id,j.property_id,j.owner_key,j.tenancy_id,j.fund,
 MAX(0,json_extract(j.lines,'$[0].debit')
 +COALESCE((SELECT SUM(l.debit_cents-l.credit_cents) FROM tt_journal_lines l JOIN tt_hap_effects e ON e.id=l.source_id WHERE l.source_kind='hap_pha_effect' AND e.hap_charge_id=q.id AND l.account='receivable' AND l.owner_key=j.owner_key),0)
 -COALESCE((SELECT SUM(l.debit_cents-l.credit_cents) FROM tt_journal_lines l JOIN tt_hap_allocations x ON x.id=l.source_id WHERE l.source_kind='hap_receipt' AND l.account='cash' AND x.charge_id=q.id AND l.owner_key=j.owner_key),0)) AS remaining_cents
 FROM tt_hap_charges q JOIN tt_journal j ON j.source_kind='hap_charge' AND j.source_id=q.id;
CREATE VIEW tt_hap_receipt_owner_targets AS
 WITH shares AS (
  SELECT a.id AS allocation_id,a.remittance_id,a.charge_id,a.amount_cents,MAX(a.recorded_at,r.outcome_recorded_at) AS recorded_at,r.outcome_date AS day,r.outcome_reference AS reference,j.property_id,j.owner_key,j.tenancy_id,j.fund,
  CAST(a.amount_cents*j.remaining_cents/(SELECT SUM(z.remaining_cents) FROM tt_hap_receipt_owner_balances z WHERE z.charge_id=a.charge_id) AS INTEGER) AS base_cents,
  ROW_NUMBER() OVER(PARTITION BY a.id ORDER BY (a.amount_cents*j.remaining_cents)%(SELECT SUM(z.remaining_cents) FROM tt_hap_receipt_owner_balances z WHERE z.charge_id=a.charge_id) DESC,j.owner_key) AS position
  FROM tt_hap_allocations a JOIN tt_hap_remittances r ON r.id=a.remittance_id JOIN tt_hap_receipt_owner_balances j ON j.charge_id=a.charge_id
  WHERE r.state='received' AND NOT EXISTS(SELECT 1 FROM tt_journal z WHERE z.source_kind='hap_receipt' AND z.source_id=a.id)
 ) SELECT allocation_id,remittance_id,charge_id,recorded_at,day,reference,property_id,owner_key,tenancy_id,fund,
 base_cents+CASE WHEN position<=amount_cents-SUM(base_cents) OVER(PARTITION BY allocation_id) THEN 1 ELSE 0 END AS allocated FROM shares;
CREATE VIEW tt_hap_receipt_journal AS
 SELECT 'native:hap_receipt:'||allocation_id||':'||owner_key AS id,day,property_id,owner_key,tenancy_id,fund,'hap_receipt' AS source_kind,allocation_id AS source_id,reference,
 json_array(json_object('account','cash','debit',allocated,'credit',0),json_object('account','receivable','debit',0,'credit',allocated)) AS lines,
 'native:hap_receipt' AS recorded_by,recorded_at
 FROM tt_hap_receipt_owner_targets WHERE allocated>0;

CREATE TRIGGER tt_hap_allocation_admit BEFORE INSERT ON tt_hap_allocations BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM tt_hap_remittances r JOIN tt_hap_charges q ON q.id=NEW.charge_id JOIN tt_hap_allocation_batches b ON b.id=NEW.batch_id WHERE r.id=NEW.remittance_id AND b.remittance_id=r.id AND r.state<>'failed' AND q.payer=r.payer_name COLLATE NOCASE AND q.currency=r.currency) THEN RAISE(ABORT,'invalid_hap_allocation') END;
 SELECT CASE WHEN NEW.amount_cents+COALESCE((SELECT SUM(amount_cents) FROM tt_hap_allocations WHERE remittance_id=NEW.remittance_id),0)>(SELECT amount_cents FROM tt_hap_remittances WHERE id=NEW.remittance_id) THEN RAISE(ABORT,'hap_remittance_overallocated') END;
 SELECT CASE WHEN NEW.amount_cents+COALESCE((SELECT SUM(a.amount_cents) FROM tt_hap_allocations a JOIN tt_hap_remittances r ON r.id=a.remittance_id WHERE a.charge_id=NEW.charge_id AND r.state<>'failed'),0)>(SELECT q.amount_cents+COALESCE((SELECT SUM(pha_delta) FROM tt_hap_effects WHERE hap_charge_id=q.id),0) FROM tt_hap_charges q WHERE q.id=NEW.charge_id) THEN RAISE(ABORT,'hap_charge_overallocated') END;
END;
CREATE TRIGGER tt_hap_allocation_journal AFTER INSERT ON tt_hap_allocations BEGIN
 INSERT INTO tt_journal(id,day,property_id,owner_key,tenancy_id,fund,source_kind,source_id,reference,lines,recorded_by,recorded_at)
 SELECT * FROM tt_hap_receipt_journal WHERE source_id=NEW.id;
END;
CREATE TRIGGER tt_hap_outcome_journal AFTER UPDATE OF state ON tt_hap_remittances WHEN OLD.state='pending' AND NEW.state='received' BEGIN
 INSERT INTO tt_journal(id,day,property_id,owner_key,tenancy_id,fund,source_kind,source_id,reference,lines,recorded_by,recorded_at)
 SELECT j.* FROM tt_hap_receipt_journal j JOIN tt_hap_allocations a ON a.id=j.source_id WHERE a.remittance_id=NEW.id;
END;

CREATE TRIGGER tt_hap_remittance_fixed BEFORE UPDATE ON tt_hap_remittances WHEN NOT(
 NEW.id=OLD.id AND NEW.source_tenancy_id=OLD.source_tenancy_id AND NEW.source_document_version_id=OLD.source_document_version_id AND NEW.method=OLD.method AND NEW.currency=OLD.currency AND NEW.amount_cents=OLD.amount_cents AND NEW.received_date=OLD.received_date AND NEW.recorded_by=OLD.recorded_by AND NEW.recorded_at=OLD.recorded_at AND (
  (NEW.payer_name=OLD.payer_name AND NEW.reference=OLD.reference AND NEW.version=OLD.version+1 AND (
   (NEW.state=OLD.state AND NEW.outcome_date IS OLD.outcome_date AND NEW.outcome_reference IS OLD.outcome_reference AND NEW.outcome_recorded_at IS OLD.outcome_recorded_at) OR
   (OLD.state='pending' AND NEW.state IN ('received','failed') AND NEW.outcome_date>=OLD.received_date AND NEW.outcome_reference IS NOT NULL AND NEW.outcome_recorded_at IS NOT NULL))) OR
  (NEW.payer_name='Retained housing authority' AND NEW.reference=OLD.id AND NEW.state=OLD.state AND NEW.version=OLD.version AND NEW.outcome_date IS OLD.outcome_date AND NEW.outcome_recorded_at IS OLD.outcome_recorded_at AND NEW.outcome_reference IS CASE WHEN OLD.outcome_reference IS NULL THEN NULL ELSE OLD.id END AND EXISTS(SELECT 1 FROM tt_erasure_work w WHERE w.tenancy_id=OLD.source_tenancy_id OR EXISTS(SELECT 1 FROM tt_hap_allocations a JOIN tt_hap_charges q ON q.id=a.charge_id WHERE a.remittance_id=OLD.id AND q.tenancy_id=w.tenancy_id)))
 )) BEGIN SELECT RAISE(ABORT,'HAP remittance source and outcomes are immutable'); END;
CREATE TRIGGER tt_hap_remittance_kept BEFORE DELETE ON tt_hap_remittances BEGIN SELECT RAISE(ABORT,'HAP remittances are never deleted'); END;
CREATE TRIGGER tt_hap_allocation_fixed BEFORE UPDATE ON tt_hap_allocations BEGIN SELECT RAISE(ABORT,'HAP allocations are immutable'); END;
CREATE TRIGGER tt_hap_allocation_kept BEFORE DELETE ON tt_hap_allocations BEGIN SELECT RAISE(ABORT,'HAP allocations are never deleted'); END;
CREATE TRIGGER tt_hap_batch_fixed BEFORE UPDATE ON tt_hap_allocation_batches WHEN NOT(
 NEW.id=OLD.id AND NEW.remittance_id=OLD.remittance_id AND NEW.reference=OLD.id AND NEW.recorded_by=OLD.recorded_by AND NEW.recorded_at=OLD.recorded_at AND EXISTS(SELECT 1 FROM tt_hap_remittances r JOIN tt_erasure_work w ON w.tenancy_id=r.source_tenancy_id OR EXISTS(SELECT 1 FROM tt_hap_allocations a JOIN tt_hap_charges q ON q.id=a.charge_id WHERE a.remittance_id=r.id AND q.tenancy_id=w.tenancy_id) WHERE r.id=OLD.remittance_id)
 ) BEGIN SELECT RAISE(ABORT,'HAP allocation details are immutable'); END;
CREATE TRIGGER tt_hap_batch_kept BEFORE DELETE ON tt_hap_allocation_batches BEGIN SELECT RAISE(ABORT,'HAP allocation details are never deleted'); END;

INSERT INTO tt_role_actions(role,action) SELECT role,'hap.remittance.record' FROM tt_role_actions WHERE action='rent.receipt';
INSERT INTO tt_role_actions(role,action) SELECT role,'hap.remittance.outcome' FROM tt_role_actions WHERE action='rent.receipt';
INSERT INTO tt_role_actions(role,action) SELECT role,'hap.remittance.allocate' FROM tt_role_actions WHERE action='rent.receipt';
