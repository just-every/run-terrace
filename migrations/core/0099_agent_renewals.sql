-- Preserve existing workloads and evidence while admitting structured renewal preparation.
DROP TRIGGER tt_agent_credential_stop;
DROP TRIGGER tt_agent_tenancy_erasure;
CREATE TABLE tt_agent_workloads_next (
 id TEXT PRIMARY KEY, tenancy_id TEXT NOT NULL REFERENCES tt_tenancies(id),
 credential_id TEXT NOT NULL, credential_version INTEGER NOT NULL,
 command TEXT NOT NULL CHECK(command IN ('maintenance.prepare','arrears.prepare','appointment.book','renewal.prepare')),
 payload TEXT NOT NULL, purpose TEXT NOT NULL, next_step TEXT NOT NULL, due_at TEXT NOT NULL,
 document_sha256 TEXT, state TEXT NOT NULL DEFAULT 'queued' CHECK(state IN ('queued','running','paused','cancelled','prepared','recorded')),
 version INTEGER NOT NULL DEFAULT 1, attempts INTEGER NOT NULL DEFAULT 0,
 result_subject TEXT, created_by TEXT NOT NULL, created_at TEXT NOT NULL
);
INSERT INTO tt_agent_workloads_next SELECT * FROM tt_agent_workloads;
CREATE TABLE tt_agent_workload_events_saved AS SELECT * FROM tt_agent_workload_events;
DROP TABLE tt_agent_workload_events;
DROP TABLE tt_agent_workloads;
ALTER TABLE tt_agent_workloads_next RENAME TO tt_agent_workloads;
CREATE TABLE tt_agent_workload_events (
 id INTEGER PRIMARY KEY AUTOINCREMENT, workload_id TEXT NOT NULL REFERENCES tt_agent_workloads(id),
 kind TEXT NOT NULL, actor TEXT NOT NULL, at TEXT NOT NULL, detail TEXT NOT NULL
);
INSERT INTO tt_agent_workload_events SELECT * FROM tt_agent_workload_events_saved;
DROP TABLE tt_agent_workload_events_saved;
CREATE INDEX tt_agent_workloads_credential ON tt_agent_workloads(credential_id,state);
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

-- Durable campaign order survives equal timestamps and native archive reconstruction.
ALTER TABLE tt_proposals ADD COLUMN renewal_sequence INTEGER;
UPDATE tt_proposals AS p SET renewal_sequence=(SELECT COUNT(*) FROM tt_proposals q WHERE q.kind='renewal' AND json_extract(q.payload,'$.renewalId')=json_extract(p.payload,'$.renewalId') AND (q.prepared_at<p.prepared_at OR (q.prepared_at=p.prepared_at AND q.id<=p.id))) WHERE kind='renewal' AND json_extract(payload,'$.renewalId') IS NOT NULL;
CREATE UNIQUE INDEX tt_renewal_offer_sequence ON tt_proposals(json_extract(payload,'$.renewalId'),renewal_sequence) WHERE renewal_sequence IS NOT NULL;
ALTER TABLE tt_renewal_events ADD COLUMN sequence INTEGER;
UPDATE tt_renewal_events AS e SET sequence=(SELECT COUNT(*) FROM tt_renewal_events q WHERE q.renewal_id=e.renewal_id AND q.rowid<=e.rowid);
CREATE UNIQUE INDEX tt_renewal_event_sequence ON tt_renewal_events(renewal_id,sequence);
