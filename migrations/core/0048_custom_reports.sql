-- REPORT-005: versioned schema, attributable values and immutable generated documents.
CREATE TABLE tt_custom_fields (
 id TEXT PRIMARY KEY, portfolio_id TEXT NOT NULL REFERENCES tt_portfolios(id),
 entity TEXT NOT NULL CHECK(entity IN ('unit','property','owner')), key TEXT NOT NULL,
 version INTEGER NOT NULL CHECK(version>0), definition TEXT NOT NULL,
 updated_by TEXT NOT NULL, updated_at TEXT NOT NULL,
 UNIQUE(portfolio_id,entity,key)
);
CREATE TABLE tt_custom_field_versions (
 field_id TEXT NOT NULL REFERENCES tt_custom_fields(id), version INTEGER NOT NULL,
 definition TEXT NOT NULL, reason TEXT NOT NULL, changed_by TEXT NOT NULL, changed_at TEXT NOT NULL,
 PRIMARY KEY(field_id,version)
);
CREATE TABLE tt_custom_values (
 field_id TEXT NOT NULL REFERENCES tt_custom_fields(id), entity_id TEXT NOT NULL,
 version INTEGER NOT NULL CHECK(version>0), value TEXT NOT NULL, source TEXT NOT NULL,
 updated_by TEXT NOT NULL, updated_at TEXT NOT NULL, PRIMARY KEY(field_id,entity_id)
);
CREATE TABLE tt_custom_value_versions (
 field_id TEXT NOT NULL REFERENCES tt_custom_fields(id), entity_id TEXT NOT NULL, version INTEGER NOT NULL,
 schema_version INTEGER NOT NULL, value TEXT NOT NULL, source TEXT NOT NULL,
 changed_by TEXT NOT NULL, changed_at TEXT NOT NULL, PRIMARY KEY(field_id,entity_id,version)
);
CREATE TABLE tt_custom_definitions (
 id TEXT PRIMARY KEY, portfolio_id TEXT NOT NULL REFERENCES tt_portfolios(id),
 kind TEXT NOT NULL CHECK(kind IN ('report','template')), entity TEXT NOT NULL CHECK(entity IN ('unit','property','owner')),
 name TEXT NOT NULL, version INTEGER NOT NULL CHECK(version>0), definition TEXT NOT NULL,
 updated_by TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE tt_custom_definition_versions (
 definition_id TEXT NOT NULL REFERENCES tt_custom_definitions(id), version INTEGER NOT NULL,
 name TEXT NOT NULL, definition TEXT NOT NULL, reason TEXT NOT NULL, changed_by TEXT NOT NULL, changed_at TEXT NOT NULL,
 PRIMARY KEY(definition_id,version)
);
CREATE TABLE tt_custom_documents (
 id TEXT PRIMARY KEY, template_id TEXT NOT NULL REFERENCES tt_custom_definitions(id),
 template_version INTEGER NOT NULL, portfolio_id TEXT NOT NULL REFERENCES tt_portfolios(id), entity TEXT NOT NULL, entity_id TEXT NOT NULL,
 content TEXT NOT NULL, lineage TEXT NOT NULL, read_roles TEXT NOT NULL,
 generated_by TEXT NOT NULL, generated_at TEXT NOT NULL
);
CREATE TRIGGER tt_custom_field_version_immutable BEFORE UPDATE ON tt_custom_field_versions BEGIN SELECT RAISE(ABORT,'Schema versions are immutable'); END;
CREATE TRIGGER tt_custom_value_version_immutable BEFORE UPDATE ON tt_custom_value_versions BEGIN SELECT RAISE(ABORT,'Value versions are immutable'); END;
CREATE TRIGGER tt_custom_definition_version_immutable BEFORE UPDATE ON tt_custom_definition_versions BEGIN SELECT RAISE(ABORT,'Definition versions are immutable'); END;
CREATE TRIGGER tt_custom_document_immutable BEFORE UPDATE ON tt_custom_documents BEGIN SELECT RAISE(ABORT,'Generated documents are immutable'); END;
-- Aliases inherit the existing ROLE-001 capability rows, without expanding responsibilities.
INSERT INTO tt_role_actions(role,action)
 SELECT role,'custom.document.generate' FROM tt_role_actions WHERE action='work.read';
INSERT INTO tt_role_actions(role,action) SELECT role,'custom.field.define' FROM tt_role_actions WHERE action='property.add';
INSERT INTO tt_role_actions(role,action) SELECT role,'custom.field.revise' FROM tt_role_actions WHERE action='property.add';
INSERT INTO tt_role_actions(role,action) SELECT role,'custom.value.set' FROM tt_role_actions WHERE action='property.add';
INSERT INTO tt_role_actions(role,action) SELECT role,'custom.report.save' FROM tt_role_actions WHERE action='property.add';
INSERT INTO tt_role_actions(role,action) SELECT role,'custom.report.revise' FROM tt_role_actions WHERE action='property.add';
INSERT INTO tt_role_actions(role,action) SELECT role,'custom.template.save' FROM tt_role_actions WHERE action='property.add';
INSERT INTO tt_role_actions(role,action) SELECT role,'custom.template.revise' FROM tt_role_actions WHERE action='property.add';
