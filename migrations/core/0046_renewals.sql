-- LEASE-012: renewal campaign work, one item per tenancy and current lease end. Offers are TER-003 proposals with the
-- campaign comparison; sends, replies and outcomes are dated events that are never edited. Signatures are staff-recorded
-- signed originals (PORT-005 lease versions), not e-signature evidence (LEASE-011).
CREATE TABLE tt_renewals (
 id TEXT PRIMARY KEY, tenancy_id TEXT NOT NULL REFERENCES tt_tenancies(id) ON DELETE CASCADE,
 lease_end TEXT NOT NULL, window_from TEXT NOT NULL, window_to TEXT NOT NULL,
 state TEXT NOT NULL DEFAULT 'open' CHECK(state IN ('open','accepted','declined','countered','no_response','nonrenewal','month_to_month','executed')),
 proposal_id TEXT, lease_version_id TEXT, version INTEGER NOT NULL DEFAULT 1,
 created_by TEXT NOT NULL, created_at TEXT NOT NULL, UNIQUE(tenancy_id,lease_end)
);
CREATE TABLE tt_renewal_events (
 id TEXT PRIMARY KEY, renewal_id TEXT NOT NULL REFERENCES tt_renewals(id) ON DELETE CASCADE,
 tenancy_id TEXT NOT NULL REFERENCES tt_tenancies(id) ON DELETE CASCADE,
 kind TEXT NOT NULL CHECK(kind IN ('scheduled','send','send_result','reply','outcome','executed')),
 happened_on TEXT NOT NULL, detail TEXT NOT NULL, reference TEXT NOT NULL, label TEXT NOT NULL,
 recorded_by TEXT NOT NULL, recorded_at TEXT NOT NULL
);
CREATE INDEX tt_renewal_event_history ON tt_renewal_events(renewal_id,recorded_at);
CREATE TRIGGER tt_renewal_event_immutable BEFORE UPDATE ON tt_renewal_events BEGIN SELECT RAISE(ABORT,'Renewal history is never edited'); END;
ALTER TABLE tt_lease_versions ADD COLUMN renewal_id TEXT;
INSERT INTO tt_role_actions(role,action) SELECT role,'renewal.schedule' FROM tt_role_actions WHERE action='renewal.prepare';
INSERT INTO tt_role_actions(role,action) SELECT role,a.action FROM tt_role_actions, (SELECT 'renewal.send' AS action UNION ALL SELECT 'renewal.reply' UNION ALL SELECT 'renewal.close') a
 WHERE tt_role_actions.action='renewal.prepare' AND role IN ('portfolio_manager','leasing');
