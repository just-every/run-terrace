-- AGENT-008: explicit owner-configured workloads, with no unattended or outbound execution.
CREATE TABLE tt_agent_workloads (
 id TEXT PRIMARY KEY, tenancy_id TEXT NOT NULL REFERENCES tt_tenancies(id),
 credential_id TEXT NOT NULL, credential_version INTEGER NOT NULL,
 command TEXT NOT NULL CHECK(command IN ('maintenance.prepare','arrears.prepare','appointment.book')),
 payload TEXT NOT NULL, purpose TEXT NOT NULL, next_step TEXT NOT NULL, due_at TEXT NOT NULL,
 document_sha256 TEXT, state TEXT NOT NULL DEFAULT 'queued' CHECK(state IN ('queued','running','paused','cancelled','prepared','recorded')),
 version INTEGER NOT NULL DEFAULT 1, attempts INTEGER NOT NULL DEFAULT 0,
 result_subject TEXT, created_by TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE TABLE tt_agent_workload_events (
 id INTEGER PRIMARY KEY AUTOINCREMENT, workload_id TEXT NOT NULL REFERENCES tt_agent_workloads(id),
 kind TEXT NOT NULL, actor TEXT NOT NULL, at TEXT NOT NULL, detail TEXT NOT NULL
);
CREATE INDEX tt_agent_workloads_credential ON tt_agent_workloads(credential_id,state);
INSERT INTO tt_role_actions(role,action) SELECT DISTINCT role,'agent.execute' FROM tt_role_actions WHERE action IN ('maintenance.prepare','arrears.prepare','appointment.book');
-- Rotation and revocation atomically stop queued work, including an attempt already claimed by a Worker.
CREATE TRIGGER tt_agent_credential_stop AFTER UPDATE OF version,revoked_at ON tt_api_credentials
WHEN NEW.version<>OLD.version OR NEW.revoked_at IS NOT OLD.revoked_at
BEGIN
 INSERT INTO tt_agent_workload_events(workload_id,kind,actor,at,detail)
 SELECT id,'stopped',COALESCE(NEW.revoked_by,'credential:'||NEW.id),strftime('%Y-%m-%dT%H:%M:%fZ','now'),'Credential revoked or rotated; review and reassign before resuming.' FROM tt_agent_workloads WHERE credential_id=NEW.id AND state IN ('queued','running');
 UPDATE tt_agent_workloads SET state='paused',version=version+1 WHERE credential_id=NEW.id AND state IN ('queued','running');
END;
-- An eligible tenancy erasure removes free text while retaining the stopped workload's opaque history.
CREATE TRIGGER tt_agent_tenancy_erasure AFTER UPDATE OF erased_at ON tt_tenancies
WHEN NEW.erased_at IS NOT NULL AND OLD.erased_at IS NULL
BEGIN
 UPDATE tt_agent_workload_events SET detail='Retained workload event' WHERE workload_id IN (SELECT id FROM tt_agent_workloads WHERE tenancy_id=NEW.id);
 UPDATE tt_agent_workloads SET payload='{}',purpose='Retained workload',next_step='No further execution',document_sha256=NULL,state=CASE WHEN state IN ('prepared','recorded') THEN state ELSE 'cancelled' END,version=version+1 WHERE tenancy_id=NEW.id;
END;
