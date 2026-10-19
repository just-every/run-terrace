-- PORT-001 legacy currency. Terrace relabelled A$ as $ before it stored a currency
-- (commit 1d87bf4), so a tenancy that 0018 marked AUD may hold USD entered under
-- the $ label: its currency is unconfirmed. An imported tenancy that names its
-- time zone came from a PORT-001 CSV whose currency was explicit, so it stays
-- confirmed; a transfer follows the lease it came from.
ALTER TABLE tt_tenancies ADD COLUMN currency_confirmed INTEGER NOT NULL DEFAULT 1 CHECK(currency_confirmed IN (0,1));
UPDATE tt_tenancies SET currency_confirmed=0 WHERE currency='AUD' AND transferred_from IS NULL AND (import_revision IS NULL OR time_zone='UTC');
UPDATE tt_tenancies SET currency_confirmed=0 WHERE currency='AUD' AND id IN (WITH RECURSIVE chain(id) AS (SELECT id FROM tt_tenancies WHERE currency_confirmed=0 UNION SELECT t.id FROM tt_tenancies t JOIN chain ON t.transferred_from=chain.id) SELECT id FROM chain);
-- The owner confirms the label once per installation; no amount is converted.
CREATE TABLE tt_currency_confirmation (
 singleton INTEGER PRIMARY KEY CHECK(singleton=1), currency TEXT NOT NULL CHECK(currency IN ('USD','AUD')),
 tenancies INTEGER NOT NULL, confirmed_by TEXT NOT NULL, confirmed_at TEXT NOT NULL
);
-- A confirmed record's currency never changes; an unconfirmed one changes only with the owner's confirmation.
DROP TRIGGER tt_tenancy_currency_fixed;
CREATE TRIGGER tt_tenancy_currency_fixed BEFORE UPDATE OF currency ON tt_tenancies WHEN NEW.currency IS NOT OLD.currency AND OLD.currency_confirmed=1
BEGIN SELECT RAISE(ABORT,'Currency is never relabelled'); END;
CREATE TRIGGER tt_tenancy_confirmed_fixed BEFORE UPDATE OF currency_confirmed ON tt_tenancies WHEN OLD.currency_confirmed=1 AND NEW.currency_confirmed IS NOT 1
BEGIN SELECT RAISE(ABORT,'A confirmed currency stays confirmed'); END;
DROP TRIGGER tt_charge_currency_fixed;
CREATE TRIGGER tt_charge_currency_fixed BEFORE UPDATE OF currency ON tt_charges WHEN NEW.currency IS NOT OLD.currency AND NOT EXISTS(SELECT 1 FROM tt_tenancies WHERE id=OLD.tenancy_id AND currency_confirmed=0)
BEGIN SELECT RAISE(ABORT,'Currency is never relabelled'); END;
