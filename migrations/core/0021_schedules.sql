-- WORK-010: recurring maintenance schedules, their dated occurrences and the one order each occurrence gets.
CREATE TABLE tt_schedules (
 id TEXT PRIMARY KEY, tenancy_id TEXT NOT NULL REFERENCES tt_tenancies(id) ON DELETE CASCADE,
 title TEXT NOT NULL, source TEXT NOT NULL CHECK(source IN ('asset','seasonal','inspection')),
 asset_id TEXT REFERENCES tt_assets(id) ON DELETE SET NULL, inspection_id TEXT REFERENCES tt_inspections(id) ON DELETE SET NULL,
 trade TEXT NOT NULL, vendor_id TEXT NOT NULL REFERENCES tt_vendors(id),
 interval_months INTEGER NOT NULL CHECK(interval_months BETWEEN 1 AND 60), first_due TEXT NOT NULL,
 lead_days INTEGER NOT NULL CHECK(lead_days BETWEEN 0 AND 90),
 budget_cents INTEGER NOT NULL CHECK(budget_cents>0), currency TEXT NOT NULL CHECK(currency IN ('USD','AUD')),
 version INTEGER NOT NULL DEFAULT 1, created_by TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE TABLE tt_schedule_occurrences (
 id TEXT PRIMARY KEY, schedule_id TEXT NOT NULL REFERENCES tt_schedules(id) ON DELETE CASCADE,
 due_date TEXT NOT NULL, deferred_to TEXT, defer_reason TEXT, deferred_by TEXT, asset_id TEXT,
 created_at TEXT NOT NULL, UNIQUE(schedule_id,due_date),
 CHECK((deferred_to IS NULL) = (defer_reason IS NULL))
);
ALTER TABLE tt_maintenance_jobs ADD COLUMN occurrence_id TEXT REFERENCES tt_schedule_occurrences(id) ON DELETE SET NULL;
-- At most one order per occurrence, however often the scheduler runs.
CREATE UNIQUE INDEX tt_job_occurrence ON tt_maintenance_jobs(occurrence_id) WHERE occurrence_id IS NOT NULL;
-- When an asset is replaced, its schedules follow the replacement.
CREATE TRIGGER tt_schedule_follows_asset AFTER UPDATE OF replaced_by ON tt_assets WHEN NEW.replaced_by IS NOT NULL
BEGIN UPDATE tt_schedules SET asset_id=NEW.replaced_by,version=version+1 WHERE asset_id=NEW.id; END;
