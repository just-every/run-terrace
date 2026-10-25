CREATE TABLE tt_card_payments (
 payment_id TEXT PRIMARY KEY REFERENCES tt_payments(id),
 request_key TEXT NOT NULL,
 initiated_by TEXT NOT NULL,
 checkout_id TEXT UNIQUE,
 intent_id TEXT UNIQUE,
 charge_id TEXT UNIQUE,
 state TEXT NOT NULL CHECK(state IN ('reserved','checkout','paid','expired')),
 payer_fee_cents INTEGER NOT NULL DEFAULT 0 CHECK(payer_fee_cents=0),
 provider_fee_cents INTEGER,
 provider_net_cents INTEGER,
 last_event_id TEXT,
 UNIQUE(initiated_by,request_key)
);
CREATE TABLE tt_card_events (
 id TEXT PRIMARY KEY,
 payment_id TEXT NOT NULL REFERENCES tt_card_payments(payment_id),
 kind TEXT NOT NULL,
 object_id TEXT NOT NULL,
 provider_created INTEGER NOT NULL,
 verified_at TEXT NOT NULL
);

CREATE TABLE tt_card_checkout_links (payment_id TEXT PRIMARY KEY REFERENCES tt_card_payments(payment_id),checkout_url TEXT NOT NULL);
INSERT INTO tt_role_actions(role,action) SELECT role,'payment.card' FROM tt_role_actions WHERE action='payment.record';
INSERT INTO tt_role_actions(role,action) SELECT role,'payment.card.reconcile' FROM tt_role_actions WHERE action='payment.record';
