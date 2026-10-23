-- Preserve TER-004/ROLE-001 receipt-posting authority when a lease adopts PAY-005.
-- Policy configuration remains owner-only. API credentials remain prepare/read only.
INSERT INTO tt_role_actions(role,action) SELECT role,'payment.record' FROM tt_role_actions WHERE action='rent.receipt';
INSERT INTO tt_role_actions(role,action) SELECT role,'payment.settle' FROM tt_role_actions WHERE action='rent.receipt';
INSERT INTO tt_role_actions(role,action) SELECT role,'payment.fail' FROM tt_role_actions WHERE action='rent.receipt';
