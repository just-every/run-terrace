-- Seed-owned diagnostics contain no credential, recipient, request, response or external session.
CREATE TABLE tt_integration_metadata (
 provider TEXT PRIMARY KEY CHECK(provider IN ('stripe','resend','sendgrid','cloudflare','rer')),
 declared_scope TEXT NOT NULL DEFAULT 'unknown' CHECK(declared_scope IN ('unknown','hosted_test_payments','transactional_mail')),
 entitlement TEXT NOT NULL DEFAULT 'unknown' CHECK(entitlement IN ('unknown','owner_reported_available','owner_reported_unavailable')),
 cents_per_thousand INTEGER CHECK(cents_per_thousand>=0),
 cost_as_of TEXT,
 updated_at TEXT NOT NULL
);
CREATE TABLE tt_integration_health (
 provider TEXT NOT NULL CHECK(provider IN ('stripe','resend','sendgrid','cloudflare','rer')),
 installation TEXT NOT NULL,
 operation TEXT NOT NULL CHECK(operation IN ('stripe_read','stripe_write','dispatch_mail','message_mail')),
 operations INTEGER NOT NULL DEFAULT 0,
 requests INTEGER NOT NULL DEFAULT 0,
 successes INTEGER NOT NULL DEFAULT 0,
 failures INTEGER NOT NULL DEFAULT 0,
 last_attempt TEXT NOT NULL,
 last_success TEXT,
 last_outcome TEXT NOT NULL CHECK(last_outcome IN ('success','missing_configuration','credential_expired','denied_scope','transient_failure','semantic_error','uncertain','suppressed')),
 PRIMARY KEY(provider,installation,operation)
);
