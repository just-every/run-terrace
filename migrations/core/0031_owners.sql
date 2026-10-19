-- PORT-003. Property owners (individuals or entities) apart from a tenancy's recorded owner contact, their W-9
-- collection status as staff record it (no TIN is stored), dated ownership share sets per property, and dated
-- management agreements with the fee percent and reserve requirement. Share sets and agreements are never edited:
-- a transfer or a new agreement is a new dated row.
CREATE TABLE tt_owners (
 id TEXT PRIMARY KEY, kind TEXT NOT NULL CHECK(kind IN ('individual','entity')), legal_name TEXT NOT NULL, email TEXT NOT NULL,
 mailing_address TEXT NOT NULL,
 w9_status TEXT NOT NULL DEFAULT 'not_requested' CHECK(w9_status IN ('not_requested','requested','received')), w9_date TEXT, w9_location TEXT,
 version INTEGER NOT NULL DEFAULT 1, created_by TEXT NOT NULL, created_at TEXT NOT NULL, UNIQUE(legal_name,email)
);
CREATE TABLE tt_w9_events (
 id TEXT PRIMARY KEY, owner_id TEXT NOT NULL REFERENCES tt_owners(id), status TEXT NOT NULL CHECK(status IN ('requested','received')),
 on_date TEXT NOT NULL, location TEXT, recorded_by TEXT NOT NULL, recorded_at TEXT NOT NULL
);
CREATE TABLE tt_ownership_sets (
 id TEXT PRIMARY KEY, property_id TEXT NOT NULL REFERENCES tt_properties(id), effective_from TEXT NOT NULL, reason TEXT NOT NULL,
 created_by TEXT NOT NULL, created_at TEXT NOT NULL, UNIQUE(property_id,effective_from)
);
CREATE TABLE tt_ownership_shares (
 set_id TEXT NOT NULL REFERENCES tt_ownership_sets(id), owner_id TEXT NOT NULL REFERENCES tt_owners(id),
 share_bp INTEGER NOT NULL CHECK(share_bp BETWEEN 1 AND 10000), position INTEGER NOT NULL, PRIMARY KEY(set_id,owner_id)
);
CREATE TABLE tt_management_agreements (
 id TEXT PRIMARY KEY, property_id TEXT NOT NULL REFERENCES tt_properties(id), starts TEXT NOT NULL,
 fee_bp INTEGER NOT NULL CHECK(fee_bp BETWEEN 0 AND 10000), reserve_cents INTEGER NOT NULL CHECK(reserve_cents>=0), reference TEXT NOT NULL,
 created_by TEXT NOT NULL, created_at TEXT NOT NULL, UNIQUE(property_id,starts)
);
CREATE TRIGGER tt_w9_event_immutable BEFORE UPDATE ON tt_w9_events BEGIN SELECT RAISE(ABORT,'A W-9 record is never edited'); END;
CREATE TRIGGER tt_ownership_set_immutable BEFORE UPDATE ON tt_ownership_sets BEGIN SELECT RAISE(ABORT,'Ownership history is never edited'); END;
CREATE TRIGGER tt_ownership_share_immutable BEFORE UPDATE ON tt_ownership_shares BEGIN SELECT RAISE(ABORT,'Ownership history is never edited'); END;
CREATE TRIGGER tt_agreement_immutable BEFORE UPDATE ON tt_management_agreements BEGIN SELECT RAISE(ABORT,'An agreement is never edited'); END;
INSERT INTO tt_role_actions(role,action) VALUES
('portfolio_manager','owner.add'),('portfolio_manager','owner.w9'),('portfolio_manager','ownership.set'),('portfolio_manager','agreement.set');
