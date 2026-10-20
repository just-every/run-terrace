-- WORK-007: optional structured evidence on the existing immutable staff-recorded completion report.
ALTER TABLE tt_completion_attempts ADD COLUMN field_evidence TEXT CHECK(field_evidence IS NULL OR json_valid(field_evidence));
