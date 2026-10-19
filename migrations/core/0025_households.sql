-- PORT-004: the people of a lease's household beyond its primary resident (the tenancy's tenant). Each row
-- belongs to one lease, so a person on two leases has two rows with distinct rights; erasing a tenancy erases
-- its household.
CREATE TABLE tt_household_members (
 id TEXT PRIMARY KEY, tenancy_id TEXT NOT NULL REFERENCES tt_tenancies(id) ON DELETE CASCADE,
 role TEXT NOT NULL CHECK(role IN ('co_tenant','guarantor','occupant','emergency_contact','authorized_contact')),
 name TEXT NOT NULL, email TEXT, phone TEXT, contact_by TEXT NOT NULL CHECK(contact_by IN ('email','phone','mail','none')),
 joined TEXT NOT NULL, left_on TEXT, moved_to TEXT, version INTEGER NOT NULL DEFAULT 1,
 created_by TEXT NOT NULL, created_at TEXT NOT NULL, CHECK(left_on IS NULL OR left_on >= joined)
);
CREATE INDEX tt_household_tenancy ON tt_household_members(tenancy_id);
