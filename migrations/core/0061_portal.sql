-- ROLE-002: external portal identities (residents, owners, vendors) apart from staff operators. An identity holds record-scoped
-- grants: a tenancy, an owner record or a vendor record. Every portal request re-reads the live session, identity and grant.
-- Links and sessions carry only hashes of their secrets and are never archived.
CREATE TABLE tt_portal_identities (
 id TEXT PRIMARY KEY,
 kind TEXT NOT NULL CHECK(kind IN ('resident','owner','vendor')),
 email TEXT NOT NULL,
 display_name TEXT NOT NULL,
 status TEXT NOT NULL CHECK(status IN ('invited','active','revoked')),
 invited_by TEXT NOT NULL,
 invited_at TEXT NOT NULL,
 activated_at TEXT,
 revoked_by TEXT,
 revoked_at TEXT,
 UNIQUE(kind,email)
);
CREATE TABLE tt_portal_grants (
 id TEXT PRIMARY KEY,
 identity_id TEXT NOT NULL REFERENCES tt_portal_identities(id),
 access TEXT NOT NULL CHECK(access IN ('resident','delegate','owner','vendor')),
 tenancy_id TEXT REFERENCES tt_tenancies(id),
 owner_id TEXT REFERENCES tt_owners(id),
 vendor_id TEXT REFERENCES tt_vendors(id),
 source TEXT NOT NULL,
 granted_by TEXT NOT NULL,
 granted_at TEXT NOT NULL,
 revoked_by TEXT,
 revoked_at TEXT,
 revoke_reason TEXT,
 CHECK((tenancy_id IS NOT NULL)+(owner_id IS NOT NULL)+(vendor_id IS NOT NULL)=1)
);
CREATE UNIQUE INDEX tt_portal_grant_live ON tt_portal_grants(identity_id,COALESCE(tenancy_id,''),COALESCE(owner_id,''),COALESCE(vendor_id,'')) WHERE revoked_at IS NULL;
CREATE INDEX tt_portal_grant_tenancy ON tt_portal_grants(tenancy_id);
CREATE TABLE tt_portal_links (
 token_hash TEXT PRIMARY KEY,
 identity_id TEXT NOT NULL REFERENCES tt_portal_identities(id),
 purpose TEXT NOT NULL CHECK(purpose IN ('invite','signin')),
 created_at TEXT NOT NULL,
 expires_at TEXT NOT NULL,
 used_at TEXT
);
CREATE TABLE tt_portal_sessions (
 hash TEXT PRIMARY KEY,
 identity_id TEXT NOT NULL REFERENCES tt_portal_identities(id),
 created_at TEXT NOT NULL,
 expires_at TEXT NOT NULL,
 revoked_at TEXT
);
INSERT INTO tt_role_actions(role,action) VALUES ('portfolio_manager','portal.invite'),('portfolio_manager','portal.revoke');
