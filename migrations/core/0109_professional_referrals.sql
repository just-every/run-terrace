-- BOUND-002: documentary referrals never grant legal or execution authority.
ALTER TABLE tt_documents ADD COLUMN referral_original INTEGER NOT NULL DEFAULT 0 CHECK(referral_original IN (0,1));
CREATE TABLE tt_rule_decision_sources(
 decision_id TEXT PRIMARY KEY REFERENCES tt_rule_decisions(id),
 revision TEXT NOT NULL,
 snapshot TEXT NOT NULL CHECK(json_valid(snapshot))
);
CREATE TABLE tt_professional_referrals(
 id TEXT PRIMARY KEY,
 tenancy_id TEXT NOT NULL REFERENCES tt_tenancies(id),
 decision_id TEXT NOT NULL REFERENCES tt_rule_decisions(id),
 source_revision TEXT NOT NULL,
 professional TEXT NOT NULL,
 reference TEXT NOT NULL,
 responsible_id TEXT NOT NULL,
 responsible_name TEXT NOT NULL,
 due_on TEXT NOT NULL,
 recorded_by TEXT NOT NULL,
 recorded_at TEXT NOT NULL
);
CREATE INDEX tt_referral_tenancy ON tt_professional_referrals(tenancy_id);
CREATE TABLE tt_professional_responses(
 id TEXT PRIMARY KEY,
 referral_id TEXT NOT NULL REFERENCES tt_professional_referrals(id) ON DELETE CASCADE,
 sequence INTEGER NOT NULL,
 outcome TEXT NOT NULL CHECK(outcome IN ('received','rejected','needs_information')),
 version_id TEXT NOT NULL REFERENCES tt_document_versions(id),
 reference TEXT NOT NULL,
 recorded_by TEXT NOT NULL,
 recorded_at TEXT NOT NULL,
 UNIQUE(referral_id,sequence)
);
CREATE TABLE tt_professional_reviews(
 id TEXT PRIMARY KEY,
 response_id TEXT NOT NULL REFERENCES tt_professional_responses(id) ON DELETE CASCADE,
 next_action TEXT NOT NULL,
 reference TEXT NOT NULL,
 reviewed_by TEXT NOT NULL,
 reviewed_at TEXT NOT NULL,
 UNIQUE(response_id)
);
CREATE TRIGGER tt_referral_immutable BEFORE UPDATE ON tt_professional_referrals BEGIN SELECT RAISE(ABORT,'Record a new referral for changed facts'); END;
CREATE TRIGGER tt_professional_response_immutable BEFORE UPDATE ON tt_professional_responses BEGIN SELECT RAISE(ABORT,'Record another original response'); END;
CREATE TRIGGER tt_professional_review_immutable BEFORE UPDATE ON tt_professional_reviews BEGIN SELECT RAISE(ABORT,'A recorded review is retained'); END;
CREATE TRIGGER tt_rule_source_immutable BEFORE UPDATE ON tt_rule_decision_sources BEGIN SELECT RAISE(ABORT,'A preview source is retained'); END;
INSERT INTO tt_role_actions(role,action) VALUES
 ('portfolio_manager','referral.read'),('portfolio_manager','referral.create'),
 ('portfolio_manager','referral.response'),('portfolio_manager','referral.review');
