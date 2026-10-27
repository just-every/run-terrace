CREATE TABLE tt_thread_events (
 id TEXT PRIMARY KEY, thread_id TEXT NOT NULL REFERENCES tt_threads(id) ON DELETE CASCADE,
 action TEXT NOT NULL, actor TEXT NOT NULL, at TEXT NOT NULL, policy TEXT NOT NULL,
 source TEXT NOT NULL, reason TEXT NOT NULL, before_revision INTEGER NOT NULL,
 after_revision INTEGER NOT NULL, fingerprint TEXT NOT NULL
);
CREATE INDEX tt_thread_events_thread ON tt_thread_events(thread_id,at,id);
CREATE TRIGGER tt_thread_events_no_update BEFORE UPDATE ON tt_thread_events
BEGIN SELECT RAISE(ABORT,'Thread action history is immutable'); END;
