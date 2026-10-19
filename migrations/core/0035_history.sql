-- SAFE-002. Attributable, immutable operating history. Each history row keeps the actor's role and role version
-- at the time (the policy they acted under), the tenancy it concerns, the source the person gave (a lease reference,
-- receipt or handoff reference, or reason) and its outcome; sensitive reads and exports are rows too. History,
-- charges, receipts and corrections are never edited; a charge, receipt or correction is deleted only with its
-- tenancy (owner erasure or a move-in undo), and history rows never.
ALTER TABLE tt_audit ADD COLUMN role TEXT;
ALTER TABLE tt_audit ADD COLUMN policy TEXT;
ALTER TABLE tt_audit ADD COLUMN tenancy_id TEXT;
ALTER TABLE tt_audit ADD COLUMN source TEXT;
ALTER TABLE tt_audit ADD COLUMN outcome TEXT;
CREATE INDEX tt_audit_at ON tt_audit(at);
CREATE TRIGGER tt_audit_immutable BEFORE UPDATE ON tt_audit BEGIN SELECT RAISE(ABORT,'History is never edited'); END;
CREATE TRIGGER tt_audit_kept BEFORE DELETE ON tt_audit BEGIN SELECT RAISE(ABORT,'History is never deleted'); END;
-- The one change allowed is PORT-001's one-time relabel of an unconfirmed tenancy's money from AUD to USD (no amount changes).
CREATE TRIGGER tt_charge_immutable BEFORE UPDATE OF id,tenancy_id,due_date,amount_cents,description,reference,created_at,term_id,period_start,period_end ON tt_charges BEGIN SELECT RAISE(ABORT,'Accounting history is never edited'); END;
CREATE TRIGGER tt_receipt_immutable BEFORE UPDATE OF id,charge_id,amount_cents,received_date,reference,created_at,method ON tt_receipts BEGIN SELECT RAISE(ABORT,'Accounting history is never edited'); END;
CREATE TRIGGER tt_adjustment_immutable BEFORE UPDATE OF id,charge_id,amount_cents,reason,at,reference ON tt_adjustments BEGIN SELECT RAISE(ABORT,'Accounting history is never edited'); END;
CREATE TRIGGER tt_charge_relabel BEFORE UPDATE OF currency ON tt_charges WHEN NOT (OLD.currency='AUD' AND NEW.currency='USD' AND EXISTS(SELECT 1 FROM tt_tenancies WHERE id=OLD.tenancy_id AND currency_confirmed=0)) BEGIN SELECT RAISE(ABORT,'Accounting history is never edited'); END;
CREATE TRIGGER tt_receipt_relabel BEFORE UPDATE OF currency ON tt_receipts WHEN NOT (OLD.currency='AUD' AND NEW.currency='USD' AND EXISTS(SELECT 1 FROM tt_charges q JOIN tt_tenancies t ON t.id=q.tenancy_id WHERE q.id=OLD.charge_id AND t.currency_confirmed=0)) BEGIN SELECT RAISE(ABORT,'Accounting history is never edited'); END;
CREATE TRIGGER tt_adjustment_relabel BEFORE UPDATE OF currency ON tt_adjustments WHEN NOT (OLD.currency='AUD' AND NEW.currency='USD' AND EXISTS(SELECT 1 FROM tt_charges q JOIN tt_tenancies t ON t.id=q.tenancy_id WHERE q.id=OLD.charge_id AND t.currency_confirmed=0)) BEGIN SELECT RAISE(ABORT,'Accounting history is never edited'); END;
CREATE TRIGGER tt_charge_kept BEFORE DELETE ON tt_charges WHEN EXISTS(SELECT 1 FROM tt_tenancies WHERE id=OLD.tenancy_id) BEGIN SELECT RAISE(ABORT,'Accounting history is never deleted'); END;
CREATE TRIGGER tt_receipt_kept BEFORE DELETE ON tt_receipts WHEN EXISTS(SELECT 1 FROM tt_charges WHERE id=OLD.charge_id) BEGIN SELECT RAISE(ABORT,'Accounting history is never deleted'); END;
CREATE TRIGGER tt_adjustment_kept BEFORE DELETE ON tt_adjustments WHEN EXISTS(SELECT 1 FROM tt_charges WHERE id=OLD.charge_id) BEGIN SELECT RAISE(ABORT,'Accounting history is never deleted'); END;
INSERT INTO tt_role_actions(role,action) VALUES ('portfolio_manager','history.read'),('accountant','history.read'),('accountant','history.export');
