CREATE TABLE tt_threads (
 id TEXT PRIMARY KEY, tenancy_id TEXT NOT NULL REFERENCES tt_tenancies(id),
 grant_id TEXT NOT NULL, identity_id TEXT NOT NULL, recipient_name TEXT NOT NULL,
 recipient_kind TEXT NOT NULL, recipient_key TEXT NOT NULL, consent_reference TEXT NOT NULL,
 subject TEXT NOT NULL, kind TEXT NOT NULL CHECK(kind IN ('conversation','broadcast','legal')),
 batch_id TEXT, assigned_to TEXT, deadline TEXT, version INTEGER NOT NULL DEFAULT 1,
 fingerprint TEXT NOT NULL, approved_by TEXT, approved_at TEXT, created_by TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE INDEX tt_threads_tenancy ON tt_threads(tenancy_id);
CREATE TABLE tt_thread_entries (
 id TEXT PRIMARY KEY, thread_id TEXT NOT NULL REFERENCES tt_threads(id) ON DELETE CASCADE,
 sequence INTEGER NOT NULL, private INTEGER NOT NULL CHECK(private IN (0,1)),
 body TEXT NOT NULL, actor TEXT NOT NULL, at TEXT NOT NULL,
 filename TEXT, media_type TEXT, sha256 TEXT, bytes BLOB, UNIQUE(thread_id,sequence)
);
CREATE TABLE tt_thread_reads (
 thread_id TEXT NOT NULL REFERENCES tt_threads(id) ON DELETE CASCADE,
 actor TEXT NOT NULL, sequence INTEGER NOT NULL, PRIMARY KEY(thread_id,actor)
);
CREATE TABLE tt_thread_service (
 thread_id TEXT PRIMARY KEY REFERENCES tt_threads(id) ON DELETE CASCADE,
 outcome TEXT NOT NULL CHECK(outcome IN ('delivered','failed','uncertain')),
 method TEXT NOT NULL, reference TEXT NOT NULL, served_at TEXT NOT NULL,
 actor TEXT NOT NULL, recorded_at TEXT NOT NULL, fingerprint TEXT NOT NULL
);
INSERT INTO tt_role_actions(role,action) VALUES
 ('portfolio_manager','thread.read'),('portfolio_manager','thread.create'),
 ('portfolio_manager','thread.reply'),('portfolio_manager','thread.assign'),
 ('portfolio_manager','thread.approve'),('portfolio_manager','thread.service'),
 ('portfolio_manager','thread.readmark');
