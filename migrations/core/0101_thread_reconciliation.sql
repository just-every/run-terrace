CREATE TABLE tt_thread_reconciliations (
 id TEXT PRIMARY KEY, thread_id TEXT NOT NULL REFERENCES tt_threads(id) ON DELETE CASCADE,
 revision INTEGER NOT NULL, outcome TEXT NOT NULL CHECK(outcome IN ('delivered','failed','uncertain')),
 assigned_to TEXT NOT NULL, next_action TEXT NOT NULL, due_on TEXT NOT NULL,
 reference TEXT NOT NULL, actor TEXT NOT NULL, at TEXT NOT NULL,
 fingerprint TEXT NOT NULL, UNIQUE(thread_id,revision)
);
INSERT INTO tt_role_actions(role,action) VALUES ('portfolio_manager','thread.reconcile');
