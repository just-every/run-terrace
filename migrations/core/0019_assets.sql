-- WORK-002: installed equipment per tenancy (a property's unit until PORT-002 adds property records),
-- its warranty, manual reference and replacement plan. A replaced asset is kept, linked both ways.
CREATE TABLE tt_assets (
 id TEXT PRIMARY KEY, tenancy_id TEXT NOT NULL REFERENCES tt_tenancies(id) ON DELETE CASCADE,
 kind TEXT NOT NULL, location TEXT NOT NULL, make TEXT NOT NULL, model TEXT NOT NULL, serial TEXT NOT NULL,
 installed_date TEXT NOT NULL, warranty_provider TEXT, warranty_ends TEXT, manual TEXT,
 replace_by TEXT, replacement_cents INTEGER CHECK(replacement_cents IS NULL OR replacement_cents>0),
 currency TEXT NOT NULL CHECK(currency IN ('USD','AUD')),
 state TEXT NOT NULL DEFAULT 'in_service' CHECK(state IN ('in_service','replaced')),
 replaces TEXT, replaced_by TEXT, replaced_date TEXT,
 version INTEGER NOT NULL DEFAULT 1, created_by TEXT NOT NULL, created_at TEXT NOT NULL,
 CHECK((warranty_provider IS NULL) = (warranty_ends IS NULL)),
 CHECK((state='replaced') = (replaced_by IS NOT NULL AND replaced_date IS NOT NULL))
);
CREATE INDEX tt_asset_tenancy ON tt_assets(tenancy_id,state);
-- A repair request names the asset it is for; its approved estimate is that asset's cost.
ALTER TABLE tt_maintenance_jobs ADD COLUMN asset_id TEXT REFERENCES tt_assets(id) ON DELETE SET NULL;
