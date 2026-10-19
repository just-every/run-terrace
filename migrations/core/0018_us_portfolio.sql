-- PORT-001. Every money record stores its ISO 4217 currency. Rows recorded before
-- this migration were entered while Terrace labelled money A$ (AUD): they keep
-- AUD and are never relabelled or converted. New tenancies are USD.
ALTER TABLE tt_tenancies ADD COLUMN currency TEXT NOT NULL DEFAULT 'AUD' CHECK(currency IN ('USD','AUD'));
-- The property's IANA time zone. Earlier rows were dated as UTC days and keep
-- UTC until a manager sets the property's zone.
ALTER TABLE tt_tenancies ADD COLUMN time_zone TEXT NOT NULL DEFAULT 'UTC';
ALTER TABLE tt_charges ADD COLUMN currency TEXT NOT NULL DEFAULT 'AUD' CHECK(currency IN ('USD','AUD'));
ALTER TABLE tt_receipts ADD COLUMN currency TEXT NOT NULL DEFAULT 'AUD' CHECK(currency IN ('USD','AUD'));
ALTER TABLE tt_adjustments ADD COLUMN currency TEXT NOT NULL DEFAULT 'AUD' CHECK(currency IN ('USD','AUD'));
ALTER TABLE tt_lease_history ADD COLUMN currency TEXT NOT NULL DEFAULT 'AUD' CHECK(currency IN ('USD','AUD'));
ALTER TABLE tt_maintenance_jobs ADD COLUMN currency TEXT NOT NULL DEFAULT 'AUD' CHECK(currency IN ('USD','AUD'));
-- A record's currency never changes, and a child record carries its parent's.
CREATE TRIGGER tt_tenancy_currency_fixed BEFORE UPDATE OF currency ON tt_tenancies WHEN NEW.currency IS NOT OLD.currency
BEGIN SELECT RAISE(ABORT,'Currency is never relabelled'); END;
CREATE TRIGGER tt_charge_currency_fixed BEFORE UPDATE OF currency ON tt_charges WHEN NEW.currency IS NOT OLD.currency
BEGIN SELECT RAISE(ABORT,'Currency is never relabelled'); END;
CREATE TRIGGER tt_charge_currency BEFORE INSERT ON tt_charges WHEN EXISTS(SELECT 1 FROM tt_tenancies WHERE id=NEW.tenancy_id AND currency IS NOT NEW.currency)
BEGIN SELECT RAISE(ABORT,'Charge currency must match its tenancy'); END;
CREATE TRIGGER tt_receipt_currency BEFORE INSERT ON tt_receipts WHEN EXISTS(SELECT 1 FROM tt_charges WHERE id=NEW.charge_id AND currency IS NOT NEW.currency)
BEGIN SELECT RAISE(ABORT,'Receipt currency must match its charge'); END;
CREATE TRIGGER tt_adjustment_currency BEFORE INSERT ON tt_adjustments WHEN EXISTS(SELECT 1 FROM tt_charges WHERE id=NEW.charge_id AND currency IS NOT NEW.currency)
BEGIN SELECT RAISE(ABORT,'Adjustment currency must match its charge'); END;
CREATE TRIGGER tt_job_currency BEFORE INSERT ON tt_maintenance_jobs WHEN EXISTS(SELECT 1 FROM tt_tenancies WHERE id=NEW.tenancy_id AND currency IS NOT NEW.currency)
BEGIN SELECT RAISE(ABORT,'Estimate currency must match its tenancy'); END;
-- The US management company (one per installation), its legal entities and
-- their USD operating accounts. An EIN is a format-checked reference; an
-- account is a recorded reference (no full account or routing number).
CREATE TABLE tt_company (
 singleton INTEGER PRIMARY KEY CHECK(singleton=1), name TEXT NOT NULL,
 country TEXT NOT NULL CHECK(country='US'), currency TEXT NOT NULL CHECK(currency='USD'), time_zone TEXT NOT NULL,
 office_email TEXT NOT NULL, office_phone TEXT NOT NULL, office_address TEXT NOT NULL,
 version INTEGER NOT NULL DEFAULT 1, updated_by TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE tt_entities (
 id TEXT PRIMARY KEY, legal_name TEXT NOT NULL, ein TEXT NOT NULL UNIQUE CHECK(ein GLOB '[0-9][0-9]-[0-9][0-9][0-9][0-9][0-9][0-9][0-9]'),
 created_by TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE TABLE tt_operating_accounts (
 id TEXT PRIMARY KEY, entity_id TEXT NOT NULL REFERENCES tt_entities(id), name TEXT NOT NULL, bank_name TEXT NOT NULL,
 last4 TEXT NOT NULL CHECK(last4 GLOB '[0-9][0-9][0-9][0-9]'), currency TEXT NOT NULL CHECK(currency='USD'),
 created_by TEXT NOT NULL, created_at TEXT NOT NULL, UNIQUE(entity_id,name)
);
