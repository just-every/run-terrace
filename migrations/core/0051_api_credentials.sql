-- OPS-001: scoped, revocable API credentials. A credential acts with one staff role's capabilities over fixed
-- portfolios; its scope (read or prepare) is narrower still and never includes an approval. Only the SHA-256 of
-- the token is stored, and the token is shown once. Credentials, their hashes and idempotency records are
-- installation configuration: they are never archived (archive-policy.mjs).
CREATE TABLE tt_api_credentials (
 id TEXT PRIMARY KEY, label TEXT NOT NULL, role TEXT NOT NULL, scope TEXT NOT NULL CHECK(scope IN ('read','prepare')),
 all_portfolios INTEGER NOT NULL CHECK(all_portfolios IN (0,1)), token_hash TEXT NOT NULL UNIQUE,
 version INTEGER NOT NULL DEFAULT 1, created_by TEXT NOT NULL, created_at TEXT NOT NULL,
 rotated_at TEXT, revoked_at TEXT, revoked_by TEXT, last_used_at TEXT
);
CREATE TABLE tt_api_credential_portfolios (
 credential_id TEXT NOT NULL REFERENCES tt_api_credentials(id), portfolio_id TEXT NOT NULL REFERENCES tt_portfolios(id),
 PRIMARY KEY(credential_id,portfolio_id)
);
CREATE TABLE tt_api_idempotency (
 credential_id TEXT NOT NULL REFERENCES tt_api_credentials(id), key TEXT NOT NULL, request_sha256 TEXT NOT NULL,
 state TEXT NOT NULL CHECK(state IN ('pending','done')), response TEXT, created_at TEXT NOT NULL,
 PRIMARY KEY(credential_id,key)
);
