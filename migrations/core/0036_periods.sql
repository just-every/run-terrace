-- ACCT-011. Month close on the recorded rent ledger. A month is closed while it has a close version that is not
-- superseded; the database then refuses any charge due, or receipt received, on a day in that month. Each close keeps
-- the checklist sign-offs it was closed on and a statement of every posting dated in the month; a reopening (owner or
-- bookkeeper, with a reason) supersedes that version without editing it, and the next close is a new version.
-- Accountants' close corrections are proposals that another bookkeeper, portfolio manager or the owner approves.
CREATE TABLE tt_period_closes (
 id TEXT PRIMARY KEY,
 month TEXT NOT NULL CHECK(month GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]'),
 version INTEGER NOT NULL CHECK(version>0),
 closed_by TEXT NOT NULL, closed_at TEXT NOT NULL,
 statement TEXT NOT NULL,
 reopened_by TEXT, reopened_at TEXT, reopen_reason TEXT,
 UNIQUE(month,version)
);
CREATE UNIQUE INDEX tt_period_open_close ON tt_period_closes(month) WHERE reopened_at IS NULL;
CREATE TABLE tt_close_signoffs (
 month TEXT NOT NULL, version INTEGER NOT NULL,
 item TEXT NOT NULL CHECK(item IN ('receipts','deposits','exceptions')),
 signed_by TEXT NOT NULL, signed_at TEXT NOT NULL, note TEXT,
 PRIMARY KEY(month,version,item)
);
CREATE TABLE tt_close_corrections (
 id TEXT PRIMARY KEY,
 month TEXT NOT NULL,
 tenancy_id TEXT NOT NULL REFERENCES tt_tenancies(id) ON DELETE CASCADE,
 kind TEXT NOT NULL CHECK(kind IN ('charge','receipt')),
 payload TEXT NOT NULL,
 reason TEXT NOT NULL,
 state TEXT NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','approved','rejected')),
 prepared_by TEXT NOT NULL, prepared_at TEXT NOT NULL,
 decided_by TEXT, decided_at TEXT, approval_label TEXT, posted_id TEXT
);
CREATE TRIGGER tt_close_kept BEFORE DELETE ON tt_period_closes BEGIN SELECT RAISE(ABORT,'A close is never deleted'); END;
-- The one change a close takes is its reopening, once; its month, version, closer and statement never change.
CREATE TRIGGER tt_close_immutable BEFORE UPDATE ON tt_period_closes WHEN OLD.reopened_at IS NOT NULL OR NEW.reopened_at IS NULL OR NEW.month<>OLD.month OR NEW.version<>OLD.version OR NEW.closed_by<>OLD.closed_by OR NEW.closed_at<>OLD.closed_at OR NEW.statement<>OLD.statement BEGIN SELECT RAISE(ABORT,'A close is never edited'); END;
CREATE TRIGGER tt_signoff_immutable BEFORE UPDATE ON tt_close_signoffs BEGIN SELECT RAISE(ABORT,'A sign-off is never edited'); END;
CREATE TRIGGER tt_signoff_kept BEFORE DELETE ON tt_close_signoffs BEGIN SELECT RAISE(ABORT,'A sign-off is never deleted'); END;
CREATE TRIGGER tt_charge_period BEFORE INSERT ON tt_charges WHEN EXISTS(SELECT 1 FROM tt_period_closes WHERE month=substr(NEW.due_date,1,7) AND reopened_at IS NULL) BEGIN SELECT RAISE(ABORT,'period_closed'); END;
CREATE TRIGGER tt_receipt_period BEFORE INSERT ON tt_receipts WHEN EXISTS(SELECT 1 FROM tt_period_closes WHERE month=substr(NEW.received_date,1,7) AND reopened_at IS NULL) BEGIN SELECT RAISE(ABORT,'period_closed'); END;
INSERT INTO tt_role_actions(role,action) VALUES
('bookkeeper','period.signoff'),('bookkeeper','period.close'),('bookkeeper','period.reopen'),
('bookkeeper','correction.prepare'),('bookkeeper','correction.approve'),('bookkeeper','correction.reject'),
('accountant','correction.prepare'),
('portfolio_manager','correction.prepare'),('portfolio_manager','correction.approve'),('portfolio_manager','correction.reject');
