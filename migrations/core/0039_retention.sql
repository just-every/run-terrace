-- SAFE-004: reviewed defaults and owner legal holds. Kept financial evidence has an opaque tenancy alias.
ALTER TABLE tt_tenancies ADD COLUMN erased_at TEXT;
ALTER TABLE tt_tenancies ADD COLUMN custody_retired_at TEXT;
CREATE TABLE tt_legal_holds (
 id TEXT PRIMARY KEY, tenancy_id TEXT NOT NULL REFERENCES tt_tenancies(id),
 class TEXT NOT NULL CHECK(class IN ('lease','accounting','screening','communications','all')),
 reason TEXT NOT NULL, placed_by TEXT NOT NULL, placed_at TEXT NOT NULL,
 released_by TEXT, released_at TEXT, release_reason TEXT
);
CREATE TABLE tt_privacy_requests (
 id TEXT PRIMARY KEY, tenancy_id TEXT NOT NULL REFERENCES tt_tenancies(id),
 kind TEXT NOT NULL CHECK(kind IN ('access','erase')), source TEXT NOT NULL,
 requested_by TEXT NOT NULL, requested_at TEXT NOT NULL,
 review TEXT, reviewed_at TEXT, completed_at TEXT
);
-- A transient authorization row exists only inside an owner erasure transaction.
CREATE TABLE tt_erasure_work (tenancy_id TEXT PRIMARY KEY REFERENCES tt_tenancies(id));
-- Keep PORT-001 one-time currency relabel separate from the text-only erasure exception.
DROP TRIGGER tt_charge_immutable;
CREATE TRIGGER tt_charge_immutable BEFORE UPDATE OF id,tenancy_id,due_date,amount_cents,description,reference,created_at,term_id,period_start,period_end,tax_rule_id ON tt_charges WHEN NOT (
 EXISTS(SELECT 1 FROM tt_erasure_work WHERE tenancy_id=OLD.tenancy_id)
 AND NEW.id=OLD.id AND NEW.tenancy_id=OLD.tenancy_id AND NEW.due_date=OLD.due_date
 AND NEW.amount_cents=OLD.amount_cents AND NEW.created_at=OLD.created_at AND NEW.currency=OLD.currency
 AND NEW.term_id IS OLD.term_id AND NEW.period_start IS OLD.period_start AND NEW.period_end IS OLD.period_end
 AND NEW.tax_rule_id IS OLD.tax_rule_id AND NEW.description='Retained accounting record' AND NEW.reference=OLD.id
) BEGIN SELECT RAISE(ABORT,'Accounting history is never edited'); END;
DROP TRIGGER tt_receipt_immutable;
CREATE TRIGGER tt_receipt_immutable BEFORE UPDATE OF id,charge_id,amount_cents,received_date,reference,created_at,method ON tt_receipts WHEN NOT (
 EXISTS(SELECT 1 FROM tt_erasure_work w JOIN tt_charges q ON q.tenancy_id=w.tenancy_id WHERE q.id=OLD.charge_id)
 AND NEW.id=OLD.id AND NEW.charge_id=OLD.charge_id AND NEW.amount_cents=OLD.amount_cents
 AND NEW.received_date=OLD.received_date AND NEW.created_at=OLD.created_at AND NEW.method IS OLD.method
 AND NEW.currency=OLD.currency AND NEW.reference=OLD.id
) BEGIN SELECT RAISE(ABORT,'Accounting history is never edited'); END;
DROP TRIGGER tt_adjustment_immutable;
CREATE TRIGGER tt_adjustment_immutable BEFORE UPDATE OF id,charge_id,amount_cents,reason,at,reference ON tt_adjustments WHEN NOT (
 EXISTS(SELECT 1 FROM tt_erasure_work w JOIN tt_charges q ON q.tenancy_id=w.tenancy_id WHERE q.id=OLD.charge_id)
 AND NEW.id=OLD.id AND NEW.charge_id=OLD.charge_id AND NEW.amount_cents=OLD.amount_cents
 AND NEW.at=OLD.at AND NEW.currency=OLD.currency AND NEW.reason='Retained accounting record' AND NEW.reference IS NULL
) BEGIN SELECT RAISE(ABORT,'Accounting history is never edited'); END;
DROP TRIGGER tt_audit_immutable;
CREATE TRIGGER tt_audit_immutable BEFORE UPDATE ON tt_audit WHEN NOT (
 EXISTS(SELECT 1 FROM tt_erasure_work WHERE tenancy_id=OLD.tenancy_id)
 AND NEW.id=OLD.id AND NEW.actor=OLD.actor AND NEW.action=OLD.action AND NEW.at=OLD.at
 AND NEW.role IS OLD.role AND NEW.policy IS OLD.policy AND NEW.tenancy_id IS OLD.tenancy_id
 AND NEW.outcome IS OLD.outcome AND NEW.subject=OLD.tenancy_id AND NEW.source IS NULL
) BEGIN SELECT RAISE(ABORT,'History is never edited'); END;
-- Financial rows cannot be deleted by any tenancy cascade, including erasure.
CREATE TRIGGER tt_tenancy_ledger_kept BEFORE DELETE ON tt_tenancies WHEN EXISTS(SELECT 1 FROM tt_charges WHERE tenancy_id=OLD.id) BEGIN SELECT RAISE(ABORT,'Retain accounting evidence'); END;
DROP TRIGGER tt_close_immutable;
CREATE TRIGGER tt_close_immutable BEFORE UPDATE ON tt_period_closes WHEN NOT (
 (OLD.reopened_at IS NULL AND NEW.reopened_at IS NOT NULL AND NEW.month=OLD.month AND NEW.version=OLD.version AND NEW.closed_by=OLD.closed_by AND NEW.closed_at=OLD.closed_at AND NEW.statement=OLD.statement)
 OR (EXISTS(SELECT 1 FROM tt_erasure_work) AND NEW.id=OLD.id AND NEW.month=OLD.month AND NEW.version=OLD.version AND NEW.closed_by=OLD.closed_by AND NEW.closed_at=OLD.closed_at AND NEW.reopened_by IS OLD.reopened_by AND NEW.reopened_at IS OLD.reopened_at AND NEW.reopen_reason IS OLD.reopen_reason
 AND json_array_length(NEW.statement)=json_array_length(OLD.statement)
 AND NOT EXISTS(SELECT 1 FROM json_each(OLD.statement) o LEFT JOIN json_each(NEW.statement) n ON n.key=o.key WHERE json_remove(o.value,'$.reference')<>json_remove(n.value,'$.reference') OR NOT (json_extract(n.value,'$.reference')=json_extract(o.value,'$.reference') OR (EXISTS(SELECT 1 FROM tt_erasure_work WHERE tenancy_id=json_extract(o.value,'$.tenancyId')) AND json_extract(n.value,'$.reference')=json_extract(o.value,'$.id')))))
) BEGIN SELECT RAISE(ABORT,'A close is never edited'); END;
DROP TRIGGER tt_fee_immutable;
CREATE TRIGGER tt_fee_immutable BEFORE UPDATE ON tt_fees WHEN NOT (
 EXISTS(SELECT 1 FROM tt_erasure_work w WHERE OLD.source='lease:'||w.tenancy_id OR OLD.source IN (SELECT 'receipt:'||r.id FROM tt_receipts r JOIN tt_charges q ON q.id=r.charge_id WHERE q.tenancy_id=w.tenancy_id) OR OLD.source IN (SELECT 'renewal:'||p.id FROM tt_proposals p WHERE p.tenancy_id=w.tenancy_id))
 AND NEW.source_label='Retained accounting record' AND NEW.override_reason IS NULL
 AND NEW.id=OLD.id AND NEW.property_id=OLD.property_id AND NEW.owner_id=OLD.owner_id AND NEW.month=OLD.month AND NEW.day=OLD.day AND NEW.kind=OLD.kind AND NEW.source=OLD.source AND NEW.base_cents=OLD.base_cents AND NEW.rate_bp IS OLD.rate_bp AND NEW.amount_cents=OLD.amount_cents AND NEW.tax_bp=OLD.tax_bp AND NEW.tax_cents=OLD.tax_cents AND NEW.agreement_id=OLD.agreement_id AND NEW.run_id=OLD.run_id AND NEW.created_by=OLD.created_by AND NEW.created_at=OLD.created_at
) BEGIN SELECT RAISE(ABORT,'A fee line is never edited'); END;
