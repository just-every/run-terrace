-- MOVE-009 / SAFE-002: immutable approvals accompany preserved reversal batches.
-- No session or reusable authorization is stored. SAFE-005 archives this table.
CREATE TABLE tt_import_compensations (
 id TEXT PRIMARY KEY, job_id TEXT NOT NULL REFERENCES ik_jobs(id),
 actor TEXT NOT NULL, at TEXT NOT NULL, role TEXT NOT NULL CHECK(role='owner'), role_version INTEGER NOT NULL,
 fingerprint TEXT NOT NULL, reason TEXT NOT NULL CHECK(length(trim(reason)) BETWEEN 1 AND 2000 OR reason=target_ids),
 target_ids TEXT NOT NULL, reverse_count INTEGER NOT NULL, retain_count INTEGER NOT NULL
);
CREATE INDEX tt_import_compensation_job ON tt_import_compensations(job_id);
CREATE TRIGGER tt_import_compensation_kept BEFORE DELETE ON tt_import_compensations BEGIN SELECT RAISE(ABORT,'Import approvals are retained'); END;
CREATE TRIGGER tt_import_compensation_immutable BEFORE UPDATE ON tt_import_compensations WHEN NOT (
 NEW.id=OLD.id AND NEW.job_id=OLD.job_id AND NEW.actor=OLD.actor AND NEW.at=OLD.at AND NEW.role=OLD.role AND NEW.role_version=OLD.role_version AND NEW.fingerprint=OLD.fingerprint AND NEW.target_ids=OLD.target_ids AND NEW.reverse_count=OLD.reverse_count AND NEW.retain_count=OLD.retain_count AND NEW.reason=OLD.target_ids
 AND EXISTS(SELECT 1 FROM json_each(OLD.target_ids) s JOIN tt_tenancies t ON t.id=s.value WHERE t.custody_retired_at IS NOT NULL)
) BEGIN SELECT RAISE(ABORT,'Import approvals are immutable'); END;
-- The existing erasure path retires import custody in the same native batch.
-- Redact free-text approval reasons there, including cross-row references.
CREATE TRIGGER tt_import_compensation_erasure AFTER UPDATE OF custody_retired_at ON tt_tenancies WHEN NEW.custody_retired_at IS NOT NULL BEGIN
 UPDATE tt_import_compensations SET reason=target_ids WHERE EXISTS(SELECT 1 FROM json_each(target_ids) WHERE value=NEW.id);
 UPDATE tt_audit SET source=NULL WHERE action='import.compensate' AND subject IN (SELECT job_id FROM tt_import_compensations a,json_each(a.target_ids) s WHERE s.value=NEW.id);
END;
DROP TRIGGER tt_audit_immutable;
CREATE TRIGGER tt_audit_immutable BEFORE UPDATE ON tt_audit WHEN NOT (
 NEW.id=OLD.id AND NEW.actor=OLD.actor AND NEW.action=OLD.action AND NEW.at=OLD.at AND NEW.role IS OLD.role AND NEW.policy IS OLD.policy AND NEW.tenancy_id IS OLD.tenancy_id AND NEW.outcome IS OLD.outcome AND NEW.source IS NULL AND (
  ((EXISTS(SELECT 1 FROM tt_erasure_work WHERE tenancy_id=OLD.tenancy_id) OR EXISTS(SELECT 1 FROM tt_bill_subjects s JOIN tt_erasure_work w ON w.tenancy_id=s.tenancy_id WHERE s.entity_id=OLD.subject AND ((s.kind='bill' AND OLD.action LIKE 'bill.%') OR (s.kind='template' AND OLD.action LIKE 'bill-template.%')))) AND (NEW.subject=OLD.tenancy_id OR (NEW.subject=OLD.subject AND EXISTS(SELECT 1 FROM tt_bill_subjects s JOIN tt_erasure_work w ON w.tenancy_id=s.tenancy_id WHERE s.entity_id=OLD.subject))))
  OR (OLD.action='import.compensate' AND NEW.subject=OLD.subject AND EXISTS(SELECT 1 FROM tt_import_compensations a,json_each(a.target_ids) s JOIN tt_tenancies t ON t.id=s.value WHERE a.job_id=OLD.subject AND t.custody_retired_at IS NOT NULL))
 )) BEGIN SELECT RAISE(ABORT,'History is never edited'); END;
