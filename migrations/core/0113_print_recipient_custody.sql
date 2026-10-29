ALTER TABLE tt_print_batches ADD COLUMN retired_at TEXT;
DROP TRIGGER tt_print_batches_no_update;
-- Erasure can discard aggregate originals once, while preserving exact hashes
-- and the approval receipt for recipient originals still under custody.
CREATE TRIGGER tt_print_batches_no_update BEFORE UPDATE ON tt_print_batches
WHEN NOT (
 OLD.retired_at IS NULL AND NEW.retired_at IS NOT NULL
 AND NEW.manifest = '' AND length(NEW.pdf_bytes) = 0
 AND NEW.id IS OLD.id AND NEW.manifest_sha256 IS OLD.manifest_sha256
 AND NEW.pdf_sha256 IS OLD.pdf_sha256 AND NEW.installation IS OLD.installation
 AND NEW.prepared_by IS OLD.prepared_by AND NEW.prepared_at IS OLD.prepared_at
)
BEGIN SELECT RAISE(ABORT,'Prepared print bytes are immutable'); END;
