-- OPS-007: links from a residential property to its record in a sibling product (Cabin reservations, Chest files).
-- Terrace keeps only the owner-entered sibling origin and the record's address there; the sibling's own sign-in
-- decides access. No reservation, guest, booking or file data is stored or fetched here.
CREATE TABLE tt_sibling_origins (
 product TEXT PRIMARY KEY CHECK(product IN ('cabin','chest')), origin TEXT NOT NULL, set_by TEXT NOT NULL, set_at TEXT NOT NULL
);
CREATE TABLE tt_sibling_links (
 id TEXT PRIMARY KEY, property_id TEXT NOT NULL REFERENCES tt_properties(id),
 product TEXT NOT NULL CHECK(product IN ('cabin','chest')), url TEXT NOT NULL, label TEXT NOT NULL,
 created_by TEXT NOT NULL, created_at TEXT NOT NULL, UNIQUE(property_id,product,url)
);
INSERT INTO tt_role_actions(role,action) VALUES ('portfolio_manager','sibling.link'),('portfolio_manager','sibling.unlink');
