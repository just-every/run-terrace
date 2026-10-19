-- PORT-002: portfolios, properties (buildings) and units, independent of tenancies. A tenancy may sit on a unit;
-- tenancies recorded before this rule keep only their address.
CREATE TABLE tt_portfolios (id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE, created_by TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE tt_properties (
 id TEXT PRIMARY KEY, portfolio_id TEXT NOT NULL REFERENCES tt_portfolios(id), name TEXT NOT NULL, address TEXT NOT NULL,
 kind TEXT NOT NULL CHECK(kind IN ('single_family','duplex','multifamily','townhouse','condo')), time_zone TEXT NOT NULL,
 created_by TEXT NOT NULL, created_at TEXT NOT NULL, UNIQUE(portfolio_id,name)
);
CREATE TABLE tt_units (
 id TEXT PRIMARY KEY, property_id TEXT NOT NULL REFERENCES tt_properties(id), identifier TEXT NOT NULL,
 bedrooms INTEGER NOT NULL CHECK(bedrooms BETWEEN 0 AND 20), bathrooms REAL NOT NULL CHECK(bathrooms BETWEEN 0 AND 20),
 amenities TEXT NOT NULL, rentable INTEGER NOT NULL CHECK(rentable IN (0,1)),
 version INTEGER NOT NULL DEFAULT 1, created_by TEXT NOT NULL, created_at TEXT NOT NULL, UNIQUE(property_id,identifier)
);
ALTER TABLE tt_tenancies ADD COLUMN unit_id TEXT REFERENCES tt_units(id);
-- A lease ended before its end date keeps that end date; ended_on is the move-out day.
ALTER TABLE tt_tenancies ADD COLUMN ended_on TEXT;
ALTER TABLE tt_tenancies ADD COLUMN end_reason TEXT;
ALTER TABLE tt_tenancies ADD COLUMN transferred_from TEXT;
CREATE INDEX tt_tenancy_unit ON tt_tenancies(unit_id,start_date);
-- Equipment recorded on a unit's tenancy is also the unit's (WORK-002).
ALTER TABLE tt_assets ADD COLUMN unit_id TEXT REFERENCES tt_units(id);
