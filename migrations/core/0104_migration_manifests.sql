-- MOVE-001: reviewed migration custody. Source records never grant execution authority.
CREATE TABLE tt_migrations (
 id TEXT PRIMARY KEY, namespace TEXT NOT NULL UNIQUE, fingerprint TEXT NOT NULL UNIQUE,
 cutover_day TEXT NOT NULL, original TEXT, report TEXT NOT NULL,
 approved_by TEXT NOT NULL, approved_at TEXT NOT NULL, retired_at TEXT
);
CREATE TABLE tt_migration_records (
 migration_id TEXT NOT NULL REFERENCES tt_migrations(id), kind TEXT NOT NULL, ref TEXT NOT NULL,
 target_id TEXT, tenancy_id TEXT REFERENCES tt_tenancies(id), disposition TEXT NOT NULL,
 record TEXT, PRIMARY KEY(migration_id,kind,ref)
);
CREATE INDEX tt_migration_record_tenancy ON tt_migration_records(tenancy_id);
CREATE TABLE tt_migration_lease_openings (
 tenancy_id TEXT PRIMARY KEY REFERENCES tt_tenancies(id), migration_id TEXT NOT NULL REFERENCES tt_migrations(id),
 history_from TEXT NOT NULL, opening_cents INTEGER NOT NULL, cutover_day TEXT NOT NULL
);
CREATE TABLE tt_migration_history (
 id TEXT PRIMARY KEY, migration_id TEXT NOT NULL REFERENCES tt_migrations(id),
 tenancy_id TEXT NOT NULL REFERENCES tt_tenancies(id), day TEXT NOT NULL, kind TEXT NOT NULL,
 amount_cents INTEGER NOT NULL, delta_cents INTEGER NOT NULL, reference TEXT NOT NULL,
 source_ref TEXT NOT NULL, UNIQUE(migration_id,source_ref)
);
CREATE TABLE tt_migration_vendor_details (
 vendor_id TEXT PRIMARY KEY REFERENCES tt_vendors(id), migration_id TEXT NOT NULL REFERENCES tt_migrations(id),
 dba TEXT NOT NULL, tin_status TEXT NOT NULL, eligible_1099 INTEGER NOT NULL CHECK(eligible_1099 IN (0,1)),
 box TEXT NOT NULL, payment_method TEXT NOT NULL, remit_address TEXT NOT NULL
);
CREATE TABLE tt_migration_forwards (
 id TEXT PRIMARY KEY, migration_id TEXT NOT NULL REFERENCES tt_migrations(id), kind TEXT NOT NULL,
 property_id TEXT REFERENCES tt_properties(id), owner_id TEXT REFERENCES tt_owners(id),
 vendor_id TEXT REFERENCES tt_vendors(id), year INTEGER NOT NULL, income_cents INTEGER NOT NULL,
 expense_cents INTEGER NOT NULL, reportable_cents INTEGER NOT NULL, reference TEXT NOT NULL
);
CREATE TABLE tt_migration_bill_openings (
 bill_id TEXT NOT NULL REFERENCES tt_bills(id), property_id TEXT NOT NULL REFERENCES tt_properties(id),
 owner_id TEXT NOT NULL REFERENCES tt_owners(id), amount_cents INTEGER NOT NULL CHECK(amount_cents>=0),
 migration_id TEXT NOT NULL REFERENCES tt_migrations(id), PRIMARY KEY(bill_id,owner_id)
);
-- A native payable approval must not recognize the imported liability twice.
CREATE TRIGGER tt_migration_bill_clearance AFTER INSERT ON tt_bill_approvals BEGIN
 INSERT INTO tt_journal(id,day,property_id,owner_key,vendor_id,fund,source_kind,source_id,reference,lines,recorded_by,recorded_at)
 SELECT 'migration-bill:'||o.bill_id||':'||o.owner_id,b.day,o.property_id,o.owner_id,b.vendor_id,'operating','migration_bill_clearance',o.bill_id,o.bill_id,
 json_array(json_object('account','payable','debit',o.amount_cents,'credit',0),json_object('account','expense','debit',0,'credit',o.amount_cents)),NEW.approved_by,NEW.approved_at
 FROM tt_migration_bill_openings o JOIN tt_bills b ON b.id=o.bill_id
 WHERE o.bill_id=NEW.bill_id AND o.amount_cents>0 AND NOT EXISTS(SELECT 1 FROM tt_journal j WHERE j.source_kind='migration_bill_clearance' AND j.source_id=o.bill_id AND j.owner_key=o.owner_id);
END;
