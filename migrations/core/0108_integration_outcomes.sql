-- Keep fixed result categories after later successful exchanges; no remote error text is retained.
CREATE TABLE tt_integration_outcomes (
 provider TEXT NOT NULL,
 installation TEXT NOT NULL,
 operation TEXT NOT NULL,
 outcome TEXT NOT NULL CHECK(outcome IN ('success','missing_configuration','credential_expired','denied_scope','transient_failure','semantic_error','uncertain','suppressed')),
 operations INTEGER NOT NULL DEFAULT 0,
 last_observed TEXT NOT NULL,
 PRIMARY KEY(provider,installation,operation,outcome),
 FOREIGN KEY(provider,installation,operation) REFERENCES tt_integration_health(provider,installation,operation)
);
