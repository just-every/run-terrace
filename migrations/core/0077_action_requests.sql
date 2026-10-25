-- Scoped requests retain evidence separately from installation-only bearer links.
CREATE TABLE tt_action_requests (
 id TEXT PRIMARY KEY, tenancy_id TEXT NOT NULL REFERENCES tt_tenancies(id), grant_id TEXT NOT NULL,
 identity_id TEXT NOT NULL, recipient_name TEXT NOT NULL, recipient_email TEXT NOT NULL,
 action TEXT NOT NULL CHECK(action IN ('upload','sign','acknowledge','quote')),
 title TEXT NOT NULL, instructions TEXT NOT NULL, document_version_id TEXT, document_sha256 TEXT,
 job_id TEXT, job_version INTEGER, terms_sha256 TEXT, snapshot TEXT,
 state TEXT NOT NULL DEFAULT 'open' CHECK(state IN ('open','submitted','completed')),
 version INTEGER NOT NULL DEFAULT 1, created_by TEXT NOT NULL, created_at TEXT NOT NULL,
 submitted_by TEXT, submitted_at TEXT, result TEXT, completed_by TEXT, completed_at TEXT
);
CREATE TABLE tt_action_links (
 token_hash TEXT PRIMARY KEY, request_id TEXT NOT NULL REFERENCES tt_action_requests(id) ON DELETE CASCADE,
 created_at TEXT NOT NULL, expires_at TEXT NOT NULL, revoked_at TEXT
);
CREATE TABLE tt_action_events (
 id TEXT PRIMARY KEY, request_id TEXT NOT NULL REFERENCES tt_action_requests(id) ON DELETE CASCADE,
 kind TEXT NOT NULL, actor TEXT NOT NULL, at TEXT NOT NULL, detail TEXT NOT NULL
);
INSERT INTO tt_role_actions(role,action) VALUES
 ('portfolio_manager','request.read'),('portfolio_manager','request.create'),
 ('portfolio_manager','request.replace'),('portfolio_manager','request.expire'),
 ('portfolio_manager','request.remind'),('portfolio_manager','request.validate');
