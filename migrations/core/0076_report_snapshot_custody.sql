-- Snapshot custody is local to this installation. Deletion retains the send identity to prevent replay.
ALTER TABLE tt_report_deliveries ADD COLUMN deleted_at TEXT;
CREATE TABLE tt_report_delivery_holds(id TEXT PRIMARY KEY,delivery_id TEXT NOT NULL REFERENCES tt_report_deliveries(id),kind TEXT NOT NULL CHECK(kind IN ('legal','accountant')),reference TEXT NOT NULL,placed_by TEXT NOT NULL,placed_at TEXT NOT NULL,released_by TEXT,released_at TEXT,release_reference TEXT);
DROP TRIGGER tt_report_delivery_fixed;
CREATE TRIGGER tt_report_delivery_fixed BEFORE UPDATE OF generation_id,grant_id,identity_id,owner_id,property_id,recipient,fingerprint,scope_fingerprint,prepared_by,prepared_at ON tt_report_deliveries BEGIN SELECT RAISE(ABORT,'Report delivery evidence is immutable'); END;
CREATE TRIGGER tt_report_snapshot_fixed BEFORE UPDATE OF snapshot ON tt_report_deliveries WHEN NOT (OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL AND NEW.snapshot='' AND NEW.state='deleted') BEGIN SELECT RAISE(ABORT,'Report snapshot is immutable except explicit deletion'); END;
CREATE TRIGGER tt_report_snapshot_deleted BEFORE UPDATE OF deleted_at ON tt_report_deliveries WHEN OLD.deleted_at IS NOT NULL OR NEW.deleted_at IS NULL OR NEW.snapshot<>'' OR NEW.state<>'deleted' BEGIN SELECT RAISE(ABORT,'Snapshot deletion cannot be reversed'); END;
