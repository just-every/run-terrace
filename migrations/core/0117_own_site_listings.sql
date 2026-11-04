-- LEASE-001: frozen own-site text revisions and separate, non-portable publication authority.
CREATE TABLE tt_listings (
 id TEXT PRIMARY KEY, unit_id TEXT NOT NULL UNIQUE REFERENCES tt_units(id), version INTEGER NOT NULL DEFAULT 1,
 draft_revision_id TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE TABLE tt_listing_revisions (
 id TEXT PRIMARY KEY, listing_id TEXT NOT NULL REFERENCES tt_listings(id), sequence INTEGER NOT NULL,
 snapshot TEXT NOT NULL, source_fingerprint TEXT NOT NULL, created_by TEXT NOT NULL, created_at TEXT NOT NULL,
 UNIQUE(listing_id,sequence)
);
CREATE TABLE tt_listing_publications (
 listing_id TEXT PRIMARY KEY REFERENCES tt_listings(id), revision_id TEXT NOT NULL REFERENCES tt_listing_revisions(id), published_at TEXT NOT NULL
);
CREATE TABLE tt_listing_previews (
 listing_id TEXT PRIMARY KEY REFERENCES tt_listings(id), revision_id TEXT NOT NULL REFERENCES tt_listing_revisions(id),
 version INTEGER NOT NULL, fingerprint TEXT NOT NULL, owner_id TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE TABLE tt_listing_events (
 id TEXT PRIMARY KEY, listing_id TEXT NOT NULL REFERENCES tt_listings(id), revision_id TEXT NOT NULL REFERENCES tt_listing_revisions(id),
 kind TEXT NOT NULL CHECK(kind IN ('published','changed','withdrawn','unavailable')), at TEXT NOT NULL, actor TEXT NOT NULL, detail TEXT NOT NULL
);
CREATE INDEX tt_listing_event_history ON tt_listing_events(listing_id,at);
CREATE TABLE tt_listing_enquiries (
 id TEXT PRIMARY KEY, listing_id TEXT NOT NULL REFERENCES tt_listings(id), revision_id TEXT NOT NULL REFERENCES tt_listing_revisions(id),
 prospect_id TEXT REFERENCES tt_prospects(id) ON DELETE SET NULL, payload_hash TEXT, created_at TEXT NOT NULL, erased_at TEXT
);
CREATE INDEX tt_listing_enquiry_prospect ON tt_listing_enquiries(prospect_id);
CREATE TRIGGER tt_listing_revision_immutable BEFORE UPDATE ON tt_listing_revisions BEGIN SELECT RAISE(ABORT,'Listing revisions are frozen'); END;
CREATE TRIGGER tt_listing_event_immutable BEFORE UPDATE ON tt_listing_events BEGIN SELECT RAISE(ABORT,'Listing publication history is immutable'); END;
CREATE TRIGGER tt_listing_lease_created AFTER INSERT ON tt_tenancies WHEN NEW.unit_id IS NOT NULL BEGIN

 INSERT INTO tt_listing_events(id,listing_id,revision_id,kind,at,actor,detail)
 SELECT lower(hex(randomblob(16))),l.id,p.revision_id,'unavailable',NEW.created_at,'inventory','{"reason":"Inventory changed; owner preview and publication required"}'
 FROM tt_listings l JOIN tt_listing_publications p ON p.listing_id=l.id WHERE l.unit_id=NEW.unit_id;
 DELETE FROM tt_listing_publications WHERE listing_id IN (SELECT l.id FROM tt_listings l WHERE l.unit_id=NEW.unit_id);
 DELETE FROM tt_listing_previews WHERE listing_id IN (SELECT l.id FROM tt_listings l WHERE l.unit_id=NEW.unit_id);
 UPDATE tt_listings SET version=version+1 WHERE id IN (SELECT l.id FROM tt_listings l WHERE l.unit_id=NEW.unit_id);
END;
CREATE TRIGGER tt_listing_lease_changed AFTER UPDATE OF unit_id,start_date,end_date,ended_on,erased_at ON tt_tenancies BEGIN

 INSERT INTO tt_listing_events(id,listing_id,revision_id,kind,at,actor,detail)
 SELECT lower(hex(randomblob(16))),l.id,p.revision_id,'unavailable',strftime('%Y-%m-%dT%H:%M:%fZ','now'),'inventory','{"reason":"Inventory changed; owner preview and publication required"}'
 FROM tt_listings l JOIN tt_listing_publications p ON p.listing_id=l.id WHERE l.unit_id=NEW.unit_id OR l.unit_id=OLD.unit_id;
 DELETE FROM tt_listing_publications WHERE listing_id IN (SELECT l.id FROM tt_listings l WHERE l.unit_id=NEW.unit_id OR l.unit_id=OLD.unit_id);
 DELETE FROM tt_listing_previews WHERE listing_id IN (SELECT l.id FROM tt_listings l WHERE l.unit_id=NEW.unit_id OR l.unit_id=OLD.unit_id);
 UPDATE tt_listings SET version=version+1 WHERE id IN (SELECT l.id FROM tt_listings l WHERE l.unit_id=NEW.unit_id OR l.unit_id=OLD.unit_id);
END;
CREATE TRIGGER tt_listing_unit_changed AFTER UPDATE OF bedrooms,bathrooms,amenities,rentable,market_rent_cents,identifier,property_id ON tt_units BEGIN

 INSERT INTO tt_listing_events(id,listing_id,revision_id,kind,at,actor,detail)
 SELECT lower(hex(randomblob(16))),l.id,p.revision_id,'unavailable',strftime('%Y-%m-%dT%H:%M:%fZ','now'),'inventory','{"reason":"Inventory changed; owner preview and publication required"}'
 FROM tt_listings l JOIN tt_listing_publications p ON p.listing_id=l.id WHERE l.unit_id=NEW.id;
 DELETE FROM tt_listing_publications WHERE listing_id IN (SELECT l.id FROM tt_listings l WHERE l.unit_id=NEW.id);
 DELETE FROM tt_listing_previews WHERE listing_id IN (SELECT l.id FROM tt_listings l WHERE l.unit_id=NEW.id);
 UPDATE tt_listings SET version=version+1 WHERE id IN (SELECT l.id FROM tt_listings l WHERE l.unit_id=NEW.id);
END;
