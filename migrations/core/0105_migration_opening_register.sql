-- MOVE-001: retain every reviewed opening bucket, even when its native adjustment is zero.
CREATE TABLE tt_migration_openings (
 id TEXT PRIMARY KEY, migration_id TEXT NOT NULL REFERENCES tt_migrations(id),
 property_id TEXT NOT NULL REFERENCES tt_properties(id), owner_id TEXT NOT NULL REFERENCES tt_owners(id),
 fund TEXT NOT NULL CHECK(fund IN ('operating','deposit')), lines TEXT NOT NULL CHECK(json_valid(lines))
);
