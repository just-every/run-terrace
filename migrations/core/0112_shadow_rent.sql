-- Documentary rent comparison, without payment or cutover authority.
CREATE TABLE tt_shadow_runs(
 id TEXT PRIMARY KEY,
 series_id TEXT NOT NULL,
 revision INTEGER NOT NULL,
 property_id TEXT NOT NULL REFERENCES tt_properties(id),
 from_day TEXT NOT NULL,
 to_day TEXT NOT NULL,
 source_name TEXT NOT NULL,
 media_type TEXT NOT NULL,
 original BLOB NOT NULL,
 sha256 TEXT NOT NULL,
 source_reference TEXT NOT NULL,
 synthetic INTEGER NOT NULL CHECK(synthetic IN (0,1)),
 mapped_rows TEXT NOT NULL CHECK(json_valid(mapped_rows)),
 snapshot TEXT NOT NULL CHECK(json_valid(snapshot)),
 fingerprint TEXT NOT NULL,
 installation TEXT NOT NULL,
 recorded_by TEXT NOT NULL,
 recorded_at TEXT NOT NULL,
 UNIQUE(series_id,revision)
);
CREATE TABLE tt_shadow_subjects(
 run_id TEXT NOT NULL REFERENCES tt_shadow_runs(id) ON DELETE CASCADE,
 tenancy_id TEXT NOT NULL REFERENCES tt_tenancies(id),
 PRIMARY KEY(run_id,tenancy_id)
);
CREATE INDEX tt_shadow_subject ON tt_shadow_subjects(tenancy_id);
CREATE TABLE tt_shadow_actions(
 id TEXT PRIMARY KEY,
 run_id TEXT NOT NULL REFERENCES tt_shadow_runs(id) ON DELETE CASCADE,
 issue_key TEXT NOT NULL,
 responsible_id TEXT NOT NULL,
 responsible_name TEXT NOT NULL,
 due_on TEXT NOT NULL,
 next_action TEXT NOT NULL,
 recorded_by TEXT NOT NULL,
 recorded_at TEXT NOT NULL
);
CREATE TABLE tt_shadow_reviews(
 id TEXT PRIMARY KEY,
 run_id TEXT NOT NULL UNIQUE REFERENCES tt_shadow_runs(id) ON DELETE CASCADE,
 fingerprint TEXT NOT NULL,
 actions_snapshot TEXT NOT NULL CHECK(json_valid(actions_snapshot)),
 result TEXT NOT NULL CHECK(result IN ('held','matched')),
 reference TEXT NOT NULL,
 reviewed_by TEXT NOT NULL,
 reviewed_at TEXT NOT NULL
);
CREATE TRIGGER tt_shadow_run_immutable BEFORE UPDATE ON tt_shadow_runs BEGIN SELECT RAISE(ABORT,'Capture another comparison for changed source facts'); END;
CREATE TRIGGER tt_shadow_action_immutable BEFORE UPDATE ON tt_shadow_actions BEGIN SELECT RAISE(ABORT,'Record another accountable next action'); END;
CREATE TRIGGER tt_shadow_review_immutable BEFORE UPDATE ON tt_shadow_reviews BEGIN SELECT RAISE(ABORT,'Retain the previous exact review'); END;
