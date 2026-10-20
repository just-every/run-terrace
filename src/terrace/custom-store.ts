// All REPORT-005 persistence and subject joins live here. Callers authorize before returning rows.
import { all, guard, one, sql, type Context, type Row } from './core'
export const fieldsIn = (c: Context, portfolio: string, entity: string) => all(c,'SELECT * FROM tt_custom_fields WHERE portfolio_id=? AND entity=? ORDER BY key',portfolio,entity)
export const findField = (c: Context, id: string) => one(c,'SELECT * FROM tt_custom_fields WHERE id=?',id)
export const findDefinition = (c: Context, id: string) => one(c,'SELECT * FROM tt_custom_definitions WHERE id=?',id)
export const findDocument = (c: Context, id: string) => one(c,'SELECT * FROM tt_custom_documents WHERE id=?',id)
export const portfolios = (c: Context) => all(c,'SELECT id,name FROM tt_portfolios ORDER BY name')
export const definitions = (c: Context) => all(c,'SELECT * FROM tt_custom_definitions ORDER BY name,id')
export const allFields = (c: Context) => all(c,'SELECT * FROM tt_custom_fields ORDER BY portfolio_id,entity,key')
export const fieldHistory = (c: Context, id: string) => all(c,'SELECT * FROM tt_custom_field_versions WHERE field_id=? ORDER BY version',id)
export const definitionHistory = (c: Context, id: string) => all(c,'SELECT * FROM tt_custom_definition_versions WHERE definition_id=? ORDER BY version',id)
export const valuesFor = (c: Context, field: string) => all(c,'SELECT * FROM tt_custom_values WHERE field_id=? ORDER BY entity_id',field)
export const findValue = (c: Context, field: string, entity: string) => one(c,'SELECT * FROM tt_custom_values WHERE field_id=? AND entity_id=?',field,entity)
export const documents = (c: Context) => all(c,'SELECT id,template_id,template_version,portfolio_id,entity,entity_id,read_roles,generated_at FROM tt_custom_documents ORDER BY generated_at DESC,id')
export const portfolioExists = (c: Context, id: string) => one(c,'SELECT id FROM tt_portfolios WHERE id=?',id)
export function subjects(c: Context, entity: string, portfolio: string): Promise<Row[]> {
 if(entity==='unit') return all(c,`SELECT u.id,p.name || ' · ' || u.identifier AS label,u.property_id FROM tt_units u JOIN tt_properties p ON p.id=u.property_id WHERE p.portfolio_id=? ORDER BY p.name,u.identifier,u.id`,portfolio)
 if(entity==='property') return all(c,'SELECT id,name AS label,id AS property_id FROM tt_properties WHERE portfolio_id=? ORDER BY name,id',portfolio)
 return all(c,'SELECT DISTINCT o.id,o.legal_name AS label,NULL AS property_id FROM tt_owners o JOIN tt_ownership_shares s ON s.owner_id=o.id JOIN tt_ownership_sets h ON h.id=s.set_id JOIN tt_properties p ON p.id=h.property_id WHERE p.portfolio_id=? ORDER BY o.legal_name,o.id',portfolio)
}
export const revisionGuard = (c: Context, kind: 'field'|'definition', row: Row) => guard(c,`EXISTS(SELECT 1 FROM tt_custom_${kind==='field'?'fields':'definitions'} WHERE id=? AND version=?)`,row.id,row.version)
export const valueGuard = (c: Context, field: string, entity: string, version: number) => guard(c,'COALESCE((SELECT version FROM tt_custom_values WHERE field_id=? AND entity_id=?),0)=?',field,entity,version)
export function writeField(c: Context, row: Row, fresh: boolean, reason: string) {
 const d=JSON.stringify(row.definition)
 return [fresh ? sql(c,'INSERT INTO tt_custom_fields(id,portfolio_id,entity,key,version,definition,updated_by,updated_at) VALUES(?,?,?,?,?,?,?,?)',row.id,row.portfolio_id,row.entity,row.key,row.version,d,c.actor.id,c.now) : sql(c,'UPDATE tt_custom_fields SET version=?,definition=?,updated_by=?,updated_at=? WHERE id=?',row.version,d,c.actor.id,c.now,row.id),sql(c,'INSERT INTO tt_custom_field_versions(field_id,version,definition,reason,changed_by,changed_at) VALUES(?,?,?,?,?,?)',row.id,row.version,d,reason,c.actor.id,c.now)]
}
export function writeValue(c: Context, field: Row, subject: string, version: number, value: any, source: string) {
 const v=JSON.stringify(value)
 return [sql(c,'INSERT INTO tt_custom_values(field_id,entity_id,version,value,source,updated_by,updated_at) VALUES(?,?,?,?,?,?,?) ON CONFLICT(field_id,entity_id) DO UPDATE SET version=excluded.version,value=excluded.value,source=excluded.source,updated_by=excluded.updated_by,updated_at=excluded.updated_at',field.id,subject,version,v,source,c.actor.id,c.now),sql(c,'INSERT INTO tt_custom_value_versions(field_id,entity_id,version,schema_version,value,source,changed_by,changed_at) VALUES(?,?,?,?,?,?,?,?)',field.id,subject,version,field.version,v,source,c.actor.id,c.now)]
}
export function writeDefinition(c: Context, row: Row, fresh: boolean, reason: string) {
 const d=JSON.stringify(row.definition)
 return [fresh ? sql(c,'INSERT INTO tt_custom_definitions(id,portfolio_id,kind,entity,name,version,definition,updated_by,updated_at) VALUES(?,?,?,?,?,?,?,?,?)',row.id,row.portfolio_id,row.kind,row.entity,row.name,row.version,d,c.actor.id,c.now) : sql(c,'UPDATE tt_custom_definitions SET name=?,version=?,definition=?,updated_by=?,updated_at=? WHERE id=?',row.name,row.version,d,c.actor.id,c.now,row.id),sql(c,'INSERT INTO tt_custom_definition_versions(definition_id,version,name,definition,reason,changed_by,changed_at) VALUES(?,?,?,?,?,?,?)',row.id,row.version,row.name,d,reason,c.actor.id,c.now)]
}
export function writeDocument(c: Context, row: Row) {return sql(c,'INSERT INTO tt_custom_documents(id,template_id,template_version,portfolio_id,entity,entity_id,content,lineage,read_roles,generated_by,generated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)',row.id,row.template_id,row.template_version,row.portfolio_id,row.entity,row.entity_id,row.content,JSON.stringify(row.lineage),JSON.stringify(row.readRoles),c.actor.id,c.now)}
