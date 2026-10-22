-- PORT-008 ct 22 Oct: all portfolio operators read; managers propose; the owner confirms.
INSERT INTO tt_role_actions(role,action) VALUES('portfolio_manager','rules.read'),('leasing','rules.read'),('bookkeeper','rules.read'),('accountant','rules.read'),('maintenance_coordinator','rules.read'),('member','rules.read');
INSERT INTO tt_role_actions(role,action) VALUES('portfolio_manager','property.rules.propose');
CREATE TABLE tt_property_rule_proposals(
 id TEXT PRIMARY KEY,
 property_id TEXT NOT NULL REFERENCES tt_properties(id),
 state_code TEXT NOT NULL,
 overlays TEXT NOT NULL CHECK(json_valid(overlays)),
 base_version INTEGER NOT NULL,
 reference TEXT NOT NULL,
 proposed_by TEXT NOT NULL,
 proposed_at TEXT NOT NULL
);
CREATE TABLE tt_property_rule_confirmations(
 proposal_id TEXT PRIMARY KEY REFERENCES tt_property_rule_proposals(id),
 version INTEGER NOT NULL,
 reference TEXT NOT NULL,
 confirmed_by TEXT NOT NULL,
 confirmed_at TEXT NOT NULL
);
CREATE TRIGGER tt_property_rule_proposal_immutable BEFORE UPDATE ON tt_property_rule_proposals BEGIN SELECT RAISE(ABORT,'Propose a new jurisdiction revision'); END;
CREATE TRIGGER tt_property_rule_proposal_kept BEFORE DELETE ON tt_property_rule_proposals BEGIN SELECT RAISE(ABORT,'Jurisdiction proposals are retained'); END;
CREATE TRIGGER tt_property_rule_confirmation_immutable BEFORE UPDATE ON tt_property_rule_confirmations BEGIN SELECT RAISE(ABORT,'Jurisdiction confirmation is immutable'); END;
CREATE TRIGGER tt_property_rule_confirmation_kept BEFORE DELETE ON tt_property_rule_confirmations BEGIN SELECT RAISE(ABORT,'Jurisdiction confirmations are retained'); END;
