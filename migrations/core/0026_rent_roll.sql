-- REPORT-001: a unit's market rent, and the method of a recorded external receipt. Receipts recorded before
-- this rule keep no method and are reported as "method not recorded".
ALTER TABLE tt_units ADD COLUMN market_rent_cents INTEGER CHECK(market_rent_cents IS NULL OR market_rent_cents>0);
ALTER TABLE tt_receipts ADD COLUMN method TEXT CHECK(method IS NULL OR method IN ('ach','card','cash','check','other'));
