-- Preserve native actors and record the originating company agent separately.
ALTER TABLE tt_audit ADD COLUMN agent_id TEXT;
ALTER TABLE tt_audit ADD COLUMN agent_name TEXT;
ALTER TABLE tt_audit ADD COLUMN sponsor_id TEXT;
ALTER TABLE tt_audit ADD COLUMN agent_label TEXT;
ALTER TABLE tt_audit ADD COLUMN operation_id TEXT;
ALTER TABLE tt_audit ADD COLUMN consent TEXT;
ALTER TABLE tt_audit ADD COLUMN client_id TEXT;
ALTER TABLE tt_audit ADD COLUMN approvers TEXT;
CREATE INDEX tt_audit_agent_operation ON tt_audit(operation_id) WHERE operation_id IS NOT NULL;
