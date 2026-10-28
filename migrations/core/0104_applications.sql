-- LEASE-007: each adult owns their answers; submitted revisions are append-only.
CREATE TABLE tt_applications (
 id TEXT PRIMARY KEY,
 prospect_id TEXT NOT NULL UNIQUE REFERENCES tt_prospects(id),
 property_id TEXT NOT NULL REFERENCES tt_properties(id),
 portfolio_id TEXT NOT NULL,
 disclosures TEXT NOT NULL,
 fee_cents INTEGER NOT NULL CHECK(fee_cents>0),
 hold_reference TEXT,
 created_by TEXT NOT NULL,
 created_at TEXT NOT NULL,
 last_activity_at TEXT NOT NULL
);
CREATE TABLE tt_application_adults (
 id TEXT PRIMARY KEY,
 application_id TEXT NOT NULL REFERENCES tt_applications(id) ON DELETE CASCADE,
 name TEXT NOT NULL,
 email TEXT NOT NULL,
 state TEXT NOT NULL DEFAULT 'draft' CHECK(state IN ('draft','submitted','changes_requested')),
 version INTEGER NOT NULL DEFAULT 1,
 answers TEXT NOT NULL DEFAULT '{}',
 submitted_at TEXT,
 revoked_at TEXT,
 UNIQUE(application_id,email)
);
CREATE TABLE tt_application_revisions (
 adult_id TEXT NOT NULL REFERENCES tt_application_adults(id) ON DELETE CASCADE,
 version INTEGER NOT NULL,
 state TEXT NOT NULL,
 answers TEXT NOT NULL,
 files TEXT NOT NULL,
 actor TEXT NOT NULL,
 at TEXT NOT NULL,
 reason TEXT NOT NULL,
 PRIMARY KEY(adult_id,version)
);
CREATE TABLE tt_application_requests (
 id TEXT PRIMARY KEY,
 adult_id TEXT NOT NULL REFERENCES tt_application_adults(id) ON DELETE CASCADE,
 message TEXT NOT NULL,
 requested_by TEXT NOT NULL,
 requested_at TEXT NOT NULL,
 resolved_at TEXT,
 file_id TEXT
);
CREATE TABLE tt_application_files (
 id TEXT PRIMARY KEY,
 adult_id TEXT NOT NULL REFERENCES tt_application_adults(id) ON DELETE CASCADE,
 request_id TEXT REFERENCES tt_application_requests(id),
 name TEXT NOT NULL,
 type TEXT NOT NULL,
 purpose TEXT NOT NULL CHECK(purpose IN ('income','identity','rental','reference','requested')),
 bytes BLOB NOT NULL,
 sha256 TEXT NOT NULL,
 scan TEXT NOT NULL,
 at TEXT NOT NULL
);
-- Credentials and active Checkout destinations never leave their installation.
CREATE TABLE tt_application_links (
 hash TEXT PRIMARY KEY,
 adult_id TEXT NOT NULL REFERENCES tt_application_adults(id) ON DELETE CASCADE,
 created_at TEXT NOT NULL,
 expires_at TEXT NOT NULL,
 used_at TEXT,
 outcome TEXT NOT NULL DEFAULT 'claimed'
);
CREATE TABLE tt_application_sessions (
 hash TEXT PRIMARY KEY,
 adult_id TEXT NOT NULL REFERENCES tt_application_adults(id) ON DELETE CASCADE,
 created_at TEXT NOT NULL,
 expires_at TEXT NOT NULL,
 revoked_at TEXT
);
INSERT INTO tt_role_actions(role,action) VALUES
 ('portfolio_manager','application.read'),('portfolio_manager','application.request');
-- LEASE-007: one household application fee, separate from rent and bank settlement.
CREATE TABLE tt_application_fees (
 id TEXT PRIMARY KEY,
 application_id TEXT NOT NULL REFERENCES tt_applications(id) ON DELETE CASCADE,
 adult_id TEXT NOT NULL REFERENCES tt_application_adults(id) ON DELETE CASCADE,
 request_key TEXT NOT NULL,
 amount_cents INTEGER NOT NULL CHECK(amount_cents>=50),
 currency TEXT NOT NULL CHECK(currency='usd'),
 state TEXT NOT NULL CHECK(state IN ('reserved','checkout','paid','expired','rejected')),
 consent_version TEXT NOT NULL,
 consent_text TEXT NOT NULL,
 consented_at TEXT NOT NULL,
 checkout_id TEXT,
 intent_id TEXT,
 charge_id TEXT,
 last_event_id TEXT,
 UNIQUE(application_id,request_key)
);
CREATE UNIQUE INDEX tt_application_fee_active ON tt_application_fees(application_id) WHERE state IN ('reserved','checkout','paid');
CREATE TABLE tt_application_fee_links (
 fee_id TEXT PRIMARY KEY REFERENCES tt_application_fees(id) ON DELETE CASCADE,
 checkout_url TEXT
);
CREATE TABLE tt_application_fee_events (
 id TEXT PRIMARY KEY,
 fee_id TEXT NOT NULL REFERENCES tt_application_fees(id) ON DELETE CASCADE,
 kind TEXT NOT NULL,
 object_id TEXT NOT NULL,
 provider_created INTEGER NOT NULL,
 verified_at TEXT NOT NULL
);

INSERT INTO tt_role_actions(role,action) VALUES ('portfolio_manager','application.fee.reconcile');
