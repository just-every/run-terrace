CREATE TABLE tt_payment_recovery (
 payment_id TEXT PRIMARY KEY REFERENCES tt_card_payments(payment_id),
 outcome TEXT NOT NULL CHECK(outcome IN ('unknown','awaiting_event','conflicting','resolved')),
 session_id TEXT,
 event_id TEXT,
 assigned_to TEXT NOT NULL,
 next_action TEXT NOT NULL CHECK(next_action IN ('inspect_provider','obtain_event','resolve_conflict','complete')),
 updated_at TEXT NOT NULL
);
INSERT INTO tt_payment_recovery
 SELECT payment_id,CASE WHEN state IN ('paid','expired') THEN 'resolved' ELSE 'unknown' END,
 checkout_id,last_event_id,CASE WHEN initiated_by LIKE 'portal:%' THEN COALESCE((SELECT id FROM oa_operators WHERE role='owner' AND status='active' LIMIT 1),initiated_by) ELSE initiated_by END,
 CASE WHEN state IN ('paid','expired') THEN 'complete' ELSE 'inspect_provider' END,consented_at
 FROM tt_card_payments;
INSERT INTO tt_role_actions(role,action) SELECT role,'payment.card.lookup' FROM tt_role_actions WHERE action='payment.card.reconcile';
INSERT INTO tt_role_actions(role,action) SELECT role,'payment.card.review' FROM tt_role_actions WHERE action='payment.card.reconcile';
