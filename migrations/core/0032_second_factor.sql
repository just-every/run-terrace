-- SAFE-001. Terrace's own second factor: one sealed TOTP secret per operator (confirmed once a code matches, with
-- the last accepted step so a code is never accepted twice), single-use recovery codes stored as SHA-256 hashes,
-- the sign-in sessions that passed it, wrong-code attempts for the lockout, and the owner's switch requiring a second
-- factor for everyone signing in by email link. None of these except the switch is archived.
CREATE TABLE tt_totp (operator_id TEXT PRIMARY KEY, secret_sealed TEXT NOT NULL, confirmed_at TEXT, last_step INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL);
CREATE TABLE tt_recovery_codes (operator_id TEXT NOT NULL, code_hash TEXT NOT NULL, used_at TEXT, PRIMARY KEY(operator_id,code_hash));
CREATE TABLE tt_factor_sessions (session_hash TEXT PRIMARY KEY, operator_id TEXT NOT NULL, method TEXT NOT NULL CHECK(method IN ('totp','recovery')), verified_at TEXT NOT NULL);
CREATE TABLE tt_factor_failures (id TEXT PRIMARY KEY, operator_id TEXT NOT NULL, at TEXT NOT NULL);
CREATE INDEX tt_factor_failure_operator ON tt_factor_failures(operator_id,at);
CREATE TABLE tt_security (singleton INTEGER PRIMARY KEY CHECK(singleton=1), required INTEGER NOT NULL CHECK(required IN (0,1)), set_by TEXT NOT NULL, set_at TEXT NOT NULL);
INSERT INTO tt_role_actions(role,action) VALUES
('portfolio_manager','factor.start'),
('portfolio_manager','factor.confirm'),
('portfolio_manager','factor.verify'),
('leasing','factor.start'),
('leasing','factor.confirm'),
('leasing','factor.verify'),
('bookkeeper','factor.start'),
('bookkeeper','factor.confirm'),
('bookkeeper','factor.verify'),
('accountant','factor.start'),
('accountant','factor.confirm'),
('accountant','factor.verify'),
('maintenance_coordinator','factor.start'),
('maintenance_coordinator','factor.confirm'),
('maintenance_coordinator','factor.verify'),
('member','factor.start'),
('member','factor.confirm'),
('member','factor.verify');
