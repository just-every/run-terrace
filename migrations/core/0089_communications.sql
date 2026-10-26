CREATE TABLE tt_message_contacts (
 id TEXT PRIMARY KEY, tenancy_id TEXT NOT NULL REFERENCES tt_tenancies(id) ON DELETE CASCADE,
 kind TEXT NOT NULL CHECK(kind IN ('resident','vendor','responder')), subject_id TEXT NOT NULL,
 name TEXT NOT NULL, email TEXT NOT NULL, phone TEXT NOT NULL, time_zone TEXT NOT NULL,
 email_consent INTEGER NOT NULL, sms_consent INTEGER NOT NULL, voice_consent INTEGER NOT NULL,
 consent_reference TEXT NOT NULL, stopped INTEGER NOT NULL DEFAULT 0,
 version INTEGER NOT NULL DEFAULT 1, installation TEXT NOT NULL,
 recorded_by TEXT NOT NULL, recorded_at TEXT NOT NULL,
 UNIQUE(tenancy_id,kind,subject_id)
);
CREATE TABLE tt_messages (
 id TEXT PRIMARY KEY, tenancy_id TEXT NOT NULL REFERENCES tt_tenancies(id) ON DELETE CASCADE,
 contact_id TEXT NOT NULL REFERENCES tt_message_contacts(id), contact_version INTEGER NOT NULL,
 channel TEXT NOT NULL CHECK(channel IN ('email','sms','voice')),
 purpose TEXT NOT NULL CHECK(purpose IN ('repair','arrival','page')),
 body TEXT NOT NULL, snapshot TEXT NOT NULL, appointment_id TEXT, emergency_id TEXT,
 state TEXT NOT NULL DEFAULT 'prepared', version INTEGER NOT NULL DEFAULT 1,
 prepared_by TEXT NOT NULL, prepared_at TEXT NOT NULL, approved_by TEXT, approved_at TEXT,
 claimed_at TEXT, provider_id TEXT, error_code TEXT, installation TEXT NOT NULL
);
CREATE UNIQUE INDEX tt_messages_provider ON tt_messages(provider_id) WHERE provider_id IS NOT NULL;
CREATE TABLE tt_message_events (
 id TEXT PRIMARY KEY, message_id TEXT NOT NULL REFERENCES tt_messages(id) ON DELETE CASCADE,
 kind TEXT NOT NULL, body TEXT NOT NULL, actor TEXT NOT NULL, at TEXT NOT NULL
);
CREATE TABLE tt_message_suppressions (
 phone_hash TEXT PRIMARY KEY, stopped_at TEXT NOT NULL
);
INSERT INTO tt_role_actions(role,action)
 SELECT 'portfolio_manager',value FROM json_each('["message.read","message.contact","message.prepare","message.approve","message.send"]');
CREATE TABLE tt_message_contact_versions (
 contact_id TEXT NOT NULL REFERENCES tt_message_contacts(id) ON DELETE CASCADE,
 version INTEGER NOT NULL, evidence TEXT NOT NULL, recorded_by TEXT NOT NULL, recorded_at TEXT NOT NULL,
 PRIMARY KEY(contact_id,version)
);
CREATE TRIGGER tt_message_contact_evidence_immutable BEFORE UPDATE ON tt_message_contact_versions BEGIN SELECT RAISE(ABORT,'Communication consent evidence is immutable'); END;
CREATE TRIGGER tt_message_event_immutable BEFORE UPDATE ON tt_message_events BEGIN SELECT RAISE(ABORT,'Message history is immutable'); END;
CREATE TRIGGER tt_message_content_immutable BEFORE UPDATE OF tenancy_id,contact_id,contact_version,channel,purpose,body,snapshot,appointment_id,emergency_id,prepared_by,prepared_at,installation ON tt_messages BEGIN SELECT RAISE(ABORT,'Prepare a new message to change its content'); END;
CREATE INDEX tt_message_tenancy ON tt_messages(tenancy_id,prepared_at);
CREATE INDEX tt_message_event_history ON tt_message_events(message_id,at);
CREATE TABLE tt_message_webhooks (id TEXT PRIMARY KEY, received_at TEXT NOT NULL);
