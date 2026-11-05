-- Session-bound browser results keep previews and refusals at refreshable GET URLs.
-- Temporary display state is excluded from backups and expires after thirty minutes.
CREATE TABLE tt_command_results (
 id TEXT PRIMARY KEY,
 session_hash TEXT NOT NULL,
 actor_id TEXT NOT NULL,
 payload TEXT NOT NULL,
 expires_at TEXT NOT NULL
);
CREATE INDEX tt_command_results_expiry ON tt_command_results(expires_at);
