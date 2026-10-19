-- WORK-013: a make-ready board per vacated unit: dependent tasks, the planned ready date and the published
-- available date, which needs every task checked by an owner or admin.
CREATE TABLE tt_turnovers (
 id TEXT PRIMARY KEY, unit_id TEXT NOT NULL REFERENCES tt_units(id), move_out TEXT NOT NULL,
 state TEXT NOT NULL DEFAULT 'open' CHECK(state IN ('open','ready')), available_on TEXT,
 published_by TEXT, published_at TEXT, created_by TEXT NOT NULL, created_at TEXT NOT NULL,
 CHECK((state='ready') = (available_on IS NOT NULL AND published_by IS NOT NULL))
);
CREATE UNIQUE INDEX tt_turnover_open ON tt_turnovers(unit_id) WHERE state='open';
CREATE TABLE tt_turnover_tasks (
 id TEXT PRIMARY KEY, turnover_id TEXT NOT NULL REFERENCES tt_turnovers(id) ON DELETE CASCADE,
 kind TEXT NOT NULL CHECK(kind IN ('inspection','deposit','repair','cleaning','utility','listing')),
 title TEXT NOT NULL, assignee TEXT NOT NULL, duration_days INTEGER NOT NULL CHECK(duration_days BETWEEN 1 AND 60),
 delay_days INTEGER NOT NULL DEFAULT 0 CHECK(delay_days BETWEEN 0 AND 120), quote_cents INTEGER CHECK(quote_cents IS NULL OR quote_cents>0),
 depends_on TEXT NOT NULL, position INTEGER NOT NULL,
 state TEXT NOT NULL DEFAULT 'open' CHECK(state IN ('open','submitted','checked')),
 submitted_by TEXT, submitted_at TEXT, checked_by TEXT, checked_at TEXT, version INTEGER NOT NULL DEFAULT 1
);
ALTER TABLE tt_units ADD COLUMN available_on TEXT;
