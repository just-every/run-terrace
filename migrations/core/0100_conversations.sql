CREATE TABLE tt_conversations (
 tenancy_id TEXT PRIMARY KEY REFERENCES tt_tenancies(id) ON DELETE CASCADE,
 assignee_id TEXT NOT NULL, assignee_name TEXT NOT NULL,
 version INTEGER NOT NULL DEFAULT 1, assigned_by TEXT NOT NULL, assigned_at TEXT NOT NULL
);
CREATE TABLE tt_conversation_events (
 id TEXT PRIMARY KEY, tenancy_id TEXT NOT NULL REFERENCES tt_tenancies(id) ON DELETE CASCADE,
 sequence INTEGER NOT NULL,
 kind TEXT NOT NULL CHECK(kind IN ('assigned','private_note')),
 body TEXT NOT NULL, actor TEXT NOT NULL, actor_name TEXT NOT NULL, at TEXT NOT NULL,
 UNIQUE(tenancy_id,sequence)
);
CREATE INDEX tt_conversation_events_tenancy ON tt_conversation_events(tenancy_id,at);
CREATE TRIGGER tt_conversation_events_immutable BEFORE UPDATE ON tt_conversation_events
 BEGIN SELECT RAISE(ABORT,'Conversation evidence is immutable'); END;
INSERT INTO tt_role_actions(role,action)
 SELECT 'portfolio_manager',value FROM json_each('["conversation.read","conversation.assign","conversation.note"]');
CREATE TABLE tt_building_notices (
 id TEXT PRIMARY KEY, property_id TEXT NOT NULL REFERENCES tt_properties(id),
 created_by TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE TABLE tt_building_notice_recipients (
 notice_id TEXT NOT NULL REFERENCES tt_building_notices(id),
 message_id TEXT PRIMARY KEY REFERENCES tt_messages(id) ON DELETE CASCADE,
 tenancy_id TEXT NOT NULL REFERENCES tt_tenancies(id) ON DELETE CASCADE
);
INSERT INTO tt_role_actions(role,action) VALUES('portfolio_manager','conversation.broadcast');
