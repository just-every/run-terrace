-- ROLE-003. Dual control: who prepared a maintenance job's current terms (a revision, quote selection or
-- reassignment makes that person a preparer too), the label kept when the only person who could approve is the
-- one who prepared, and the owner's quote requirement (how many quotes above which estimate) beside the limits.
ALTER TABLE tt_maintenance_jobs ADD COLUMN revised_by TEXT;
ALTER TABLE tt_maintenance_approvals ADD COLUMN approval_label TEXT;
ALTER TABLE tt_proposals ADD COLUMN approval_label TEXT;
ALTER TABLE tt_work_limits ADD COLUMN quotes_needed INTEGER CHECK(quotes_needed IS NULL OR quotes_needed BETWEEN 2 AND 10);
ALTER TABLE tt_work_limits ADD COLUMN quotes_above_cents INTEGER CHECK(quotes_above_cents IS NULL OR quotes_above_cents>=0);
