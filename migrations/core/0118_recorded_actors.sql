-- Portable attribution evidence, deliberately separate from authentication and grants.
CREATE TABLE tt_recorded_actors (
 id TEXT PRIMARY KEY,
 display_name TEXT NOT NULL,
 kind TEXT NOT NULL CHECK(kind IN ('operator','credential','scheduler'))
);

-- Retain known identities for existing history without populating an empty destination.
INSERT INTO tt_recorded_actors(id,display_name,kind)
 SELECT id,display_name,'operator' FROM oa_operators o
 WHERE display_name<>'' AND EXISTS(SELECT 1 FROM tt_audit a WHERE a.actor=o.id);
INSERT OR IGNORE INTO tt_recorded_actors(id,display_name,kind)
 SELECT id,label,'credential' FROM tt_api_credentials k
 WHERE EXISTS(SELECT 1 FROM tt_audit a WHERE a.actor=k.id);

-- Every audit writer (commands, sensitive reads and provider results) retains attribution
-- in the same transaction. Missing live identities during restore cannot erase evidence.
CREATE TRIGGER tt_audit_record_actor AFTER INSERT ON tt_audit BEGIN
 INSERT INTO tt_recorded_actors(id,display_name,kind)
  SELECT id,display_name,'operator' FROM oa_operators WHERE id=NEW.actor AND display_name<>''
  ON CONFLICT(id) DO UPDATE SET display_name=excluded.display_name,kind=excluded.kind;
 INSERT INTO tt_recorded_actors(id,display_name,kind)
  SELECT id,label,'credential' FROM tt_api_credentials WHERE id=NEW.actor
  ON CONFLICT(id) DO UPDATE SET display_name=excluded.display_name,kind=excluded.kind;
END;
