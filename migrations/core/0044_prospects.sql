-- LEASE-005: prospect records recorded by staff. Terrace contacts no prospect; responses are staff-recorded.
CREATE TABLE tt_prospects (
 id TEXT PRIMARY KEY, property_id TEXT NOT NULL REFERENCES tt_properties(id), portfolio_id TEXT NOT NULL,
 name TEXT NOT NULL, email TEXT, phone TEXT, first_source TEXT NOT NULL, first_reference TEXT NOT NULL,
 stage TEXT NOT NULL DEFAULT 'enquiry' CHECK(stage IN ('enquiry','showing_scheduled','shown','applied','offer','leased','lost')),
 lost_reason TEXT, lost_note TEXT, assigned_to TEXT, preferences TEXT NOT NULL, consent TEXT NOT NULL,
 review TEXT NOT NULL DEFAULT 'clear' CHECK(review IN ('clear','possible_duplicate','kept_separate')),
 duplicate_of TEXT REFERENCES tt_prospects(id), merged_into TEXT REFERENCES tt_prospects(id),
 version INTEGER NOT NULL DEFAULT 1, created_by TEXT NOT NULL, created_at TEXT NOT NULL, last_activity_at TEXT NOT NULL,
 CHECK(email IS NOT NULL OR phone IS NOT NULL), CHECK(stage<>'lost' OR lost_reason IS NOT NULL)
);
CREATE INDEX tt_prospect_email ON tt_prospects(portfolio_id,email);
CREATE INDEX tt_prospect_phone ON tt_prospects(portfolio_id,phone);
CREATE TABLE tt_prospect_events (
 id TEXT PRIMARY KEY, prospect_id TEXT NOT NULL REFERENCES tt_prospects(id) ON DELETE CASCADE,
 kind TEXT NOT NULL, detail TEXT NOT NULL, reference TEXT NOT NULL, label TEXT NOT NULL,
 recorded_by TEXT NOT NULL, recorded_at TEXT NOT NULL
);
CREATE INDEX tt_prospect_event_history ON tt_prospect_events(prospect_id,recorded_at);
CREATE TRIGGER tt_prospect_source_immutable BEFORE UPDATE OF first_source,first_reference,created_by,created_at ON tt_prospects BEGIN SELECT RAISE(ABORT,'First-contact attribution is never edited'); END;
CREATE TRIGGER tt_prospect_event_immutable BEFORE UPDATE OF kind,detail,reference,label,recorded_by,recorded_at ON tt_prospect_events BEGIN SELECT RAISE(ABORT,'Prospect history is never edited'); END;
INSERT INTO tt_role_actions(role,action) VALUES
('portfolio_manager','prospect.read'),('portfolio_manager','prospect.add'),('portfolio_manager','prospect.review'),('portfolio_manager','prospect.assign'),('portfolio_manager','prospect.respond'),('portfolio_manager','prospect.stage'),('portfolio_manager','prospect.consent'),('portfolio_manager','prospect.email'),
('leasing','prospect.read'),('leasing','prospect.add'),('leasing','prospect.review'),('leasing','prospect.assign'),('leasing','prospect.respond'),('leasing','prospect.stage'),('leasing','prospect.consent'),('leasing','prospect.email'),
('member','prospect.read');
