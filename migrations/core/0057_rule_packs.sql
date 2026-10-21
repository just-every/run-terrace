-- PORT-008: registry definitions are code; no fabricated counsel-reviewed values are seeded.
CREATE TABLE tt_rule_packs(id TEXT PRIMARY KEY,code TEXT NOT NULL,version INTEGER NOT NULL,effective_from TEXT NOT NULL,fields TEXT NOT NULL CHECK(json_valid(fields)),reviewer TEXT NOT NULL,review_reference TEXT NOT NULL,created_by TEXT NOT NULL,created_at TEXT NOT NULL,UNIQUE(code,version));
CREATE TABLE tt_rule_activations(pack_id TEXT PRIMARY KEY REFERENCES tt_rule_packs(id),activated_by TEXT NOT NULL,activated_at TEXT NOT NULL,consent TEXT NOT NULL);
CREATE TABLE tt_property_rules(property_id TEXT PRIMARY KEY REFERENCES tt_properties(id),state_code TEXT NOT NULL,overlays TEXT NOT NULL CHECK(json_valid(overlays)),version INTEGER NOT NULL,set_by TEXT NOT NULL,set_at TEXT NOT NULL);
CREATE TABLE tt_property_rule_events(id TEXT PRIMARY KEY,property_id TEXT NOT NULL,state_code TEXT NOT NULL,overlays TEXT NOT NULL,version INTEGER NOT NULL,reference TEXT NOT NULL,set_by TEXT NOT NULL,set_at TEXT NOT NULL);
CREATE TABLE tt_rule_decisions(id TEXT PRIMARY KEY,property_id TEXT NOT NULL REFERENCES tt_properties(id),action TEXT NOT NULL,on_day TEXT NOT NULL,input TEXT NOT NULL,result TEXT NOT NULL,recorded_by TEXT NOT NULL,recorded_at TEXT NOT NULL);
CREATE TRIGGER tt_rule_pack_immutable BEFORE UPDATE ON tt_rule_packs BEGIN SELECT RAISE(ABORT,'Publish a new dated pack version'); END;
CREATE TRIGGER tt_rule_pack_kept BEFORE DELETE ON tt_rule_packs BEGIN SELECT RAISE(ABORT,'Rule pack history is retained'); END;
CREATE TRIGGER tt_rule_activation_immutable BEFORE UPDATE ON tt_rule_activations BEGIN SELECT RAISE(ABORT,'Review activation is immutable'); END;
CREATE TRIGGER tt_rule_activation_kept BEFORE DELETE ON tt_rule_activations BEGIN SELECT RAISE(ABORT,'Review activation is retained'); END;
CREATE TRIGGER tt_rule_decision_immutable BEFORE UPDATE ON tt_rule_decisions BEGIN SELECT RAISE(ABORT,'Earlier decisions retain their rule version'); END;
CREATE TRIGGER tt_rule_decision_kept BEFORE DELETE ON tt_rule_decisions BEGIN SELECT RAISE(ABORT,'Earlier decisions retain their rule version'); END;
CREATE TRIGGER tt_property_rule_event_immutable BEFORE UPDATE ON tt_property_rule_events BEGIN SELECT RAISE(ABORT,'Property jurisdiction history is immutable'); END;
CREATE TRIGGER tt_property_rule_event_kept BEFORE DELETE ON tt_property_rule_events BEGIN SELECT RAISE(ABORT,'Property jurisdiction history is retained'); END;
