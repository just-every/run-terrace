-- Resident intake keeps each original concern and access decision. Files remain private lease evidence.
CREATE TABLE tt_resident_requests (
 id TEXT PRIMARY KEY, tenancy_id TEXT NOT NULL REFERENCES tt_tenancies(id) ON DELETE CASCADE,
 submitted_by TEXT NOT NULL, submitted_name TEXT NOT NULL, submitted_at TEXT NOT NULL,
 description TEXT NOT NULL, category TEXT NOT NULL, urgency TEXT NOT NULL,
 access_consent TEXT NOT NULL CHECK(access_consent IN ('ask','no','yes')), access_notes TEXT NOT NULL,
 pets TEXT NOT NULL, preferred_times TEXT NOT NULL,
 job_id TEXT REFERENCES tt_maintenance_jobs(id) ON DELETE SET NULL, version INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX tt_resident_requests_tenancy ON tt_resident_requests(tenancy_id,submitted_at);
CREATE TABLE tt_request_photos (
 id TEXT PRIMARY KEY, request_id TEXT NOT NULL REFERENCES tt_resident_requests(id) ON DELETE CASCADE,
 name TEXT NOT NULL, media_type TEXT NOT NULL, bytes BLOB NOT NULL, sha256 TEXT NOT NULL
);
CREATE TABLE tt_request_links (
 id TEXT PRIMARY KEY, request_id TEXT NOT NULL REFERENCES tt_resident_requests(id) ON DELETE CASCADE,
 job_id TEXT NOT NULL, linked_by TEXT NOT NULL, linked_at TEXT NOT NULL, reference TEXT NOT NULL
);
CREATE TABLE tt_request_answers (
 id TEXT PRIMARY KEY, request_id TEXT NOT NULL REFERENCES tt_resident_requests(id) ON DELETE CASCADE,
 attempt_id TEXT NOT NULL, outcome TEXT NOT NULL CHECK(outcome IN ('confirmed','unresolved')),
 note TEXT NOT NULL, answered_by TEXT NOT NULL, answered_at TEXT NOT NULL,
 UNIQUE(request_id,attempt_id)
);
CREATE TRIGGER tt_request_intake_immutable BEFORE UPDATE OF tenancy_id,submitted_by,submitted_name,submitted_at,description,category,urgency,access_consent,access_notes,pets,preferred_times ON tt_resident_requests BEGIN SELECT RAISE(ABORT,'Resident intake is never edited'); END;
CREATE TRIGGER tt_request_photo_immutable BEFORE UPDATE ON tt_request_photos BEGIN SELECT RAISE(ABORT,'Original photos are never edited'); END;
CREATE TRIGGER tt_request_answer_immutable BEFORE UPDATE ON tt_request_answers BEGIN SELECT RAISE(ABORT,'Resident answers are never edited'); END;
INSERT INTO tt_role_actions(role,action) VALUES ('portfolio_manager','portal.request.link');
