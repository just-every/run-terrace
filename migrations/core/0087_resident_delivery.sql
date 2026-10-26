CREATE TABLE tt_resident_deliveries (
 id TEXT PRIMARY KEY, tenancy_id TEXT NOT NULL REFERENCES tt_tenancies(id),
 grant_id TEXT NOT NULL, identity_id TEXT NOT NULL, recipient TEXT NOT NULL,
 kind TEXT NOT NULL CHECK(kind IN ('statement','receipt')), month TEXT NOT NULL,
 transaction_id TEXT, snapshot TEXT NOT NULL, fingerprint TEXT NOT NULL,
 prepared_by TEXT NOT NULL, prepared_at TEXT NOT NULL,
 consent_reference TEXT NOT NULL, consent_version TEXT NOT NULL,
 state TEXT NOT NULL DEFAULT 'prepared', version INTEGER NOT NULL DEFAULT 1,
 provider TEXT, provider_id TEXT, installation TEXT NOT NULL,
 next_action TEXT NOT NULL, task_open INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE tt_resident_delivery_events (
 id TEXT PRIMARY KEY, delivery_id TEXT NOT NULL REFERENCES tt_resident_deliveries(id) ON DELETE CASCADE,
 kind TEXT NOT NULL, reference TEXT NOT NULL, actor TEXT NOT NULL, at TEXT NOT NULL
);
CREATE INDEX tt_resident_delivery_tenancy ON tt_resident_deliveries(tenancy_id);
