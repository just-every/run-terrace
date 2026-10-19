-- WORK-008. A vendor's completion report on handed-off work (recorded by staff: there is no vendor portal yet),
-- the resident's answer to "is the original issue resolved?" for each report (recorded by staff: Terrace does
-- not contact residents yet), and closure without the resident's confirmation. Every row is append-only.
ALTER TABLE tt_maintenance_jobs ADD COLUMN resolution TEXT CHECK(resolution IS NULL OR resolution IN ('awaiting_check','reopened','resolved','closed'));
CREATE TABLE tt_completion_attempts (
 id TEXT PRIMARY KEY, job_id TEXT NOT NULL REFERENCES tt_maintenance_jobs(id) ON DELETE CASCADE, attempt INTEGER NOT NULL CHECK(attempt>0),
 completed_date TEXT NOT NULL, summary TEXT NOT NULL, reference TEXT NOT NULL,
 callback TEXT CHECK((attempt=1 AND callback IS NULL) OR (attempt>1 AND callback IN ('warranty','billable'))),
 recorded_by TEXT NOT NULL, recorded_at TEXT NOT NULL, UNIQUE(job_id,attempt)
);
CREATE TABLE tt_resident_checks (
 id TEXT PRIMARY KEY, job_id TEXT NOT NULL REFERENCES tt_maintenance_jobs(id) ON DELETE CASCADE,
 attempt_id TEXT NOT NULL REFERENCES tt_completion_attempts(id) ON DELETE CASCADE,
 outcome TEXT NOT NULL CHECK(outcome IN ('confirmed','unresolved','no_response')), note TEXT NOT NULL,
 satisfaction INTEGER CHECK(satisfaction IS NULL OR (outcome='confirmed' AND satisfaction BETWEEN 1 AND 5)),
 safety_concern TEXT, label TEXT NOT NULL, recorded_by TEXT NOT NULL, recorded_at TEXT NOT NULL
);
CREATE TABLE tt_job_closures (
 id TEXT PRIMARY KEY, job_id TEXT NOT NULL REFERENCES tt_maintenance_jobs(id) ON DELETE CASCADE, reason TEXT NOT NULL,
 closed_by TEXT NOT NULL, closed_role TEXT NOT NULL CHECK(closed_role IN ('owner','admin')), closed_at TEXT NOT NULL
);
CREATE TRIGGER tt_completion_attempt_immutable BEFORE UPDATE ON tt_completion_attempts BEGIN SELECT RAISE(ABORT,'A completion report is never edited'); END;
CREATE TRIGGER tt_resident_check_immutable BEFORE UPDATE ON tt_resident_checks BEGIN SELECT RAISE(ABORT,'A resident check is never edited'); END;
CREATE TRIGGER tt_job_closure_immutable BEFORE UPDATE ON tt_job_closures BEGIN SELECT RAISE(ABORT,'A closure is never edited'); END;
