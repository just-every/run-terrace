import { allow, commit, guard, id, insist, text, type Context, type Row } from './core'
import { fieldInput, key, roles, valueInput, version } from './custom-input'
import { definition, entity, field, ownerRights, portfolio, readable, subject, unpack } from './custom-access'
import { reportInput, templateInput } from './custom-expressions'
import * as store from './custom-store'
import { generateDocument } from './custom-documents'
export const CUSTOM_COMMANDS=['custom.field.define','custom.field.revise','custom.value.set','custom.report.save','custom.report.revise','custom.template.save','custom.template.revise','custom.document.generate']
export async function customCommand(c: Context, command: string, p: Row): Promise<Row|undefined> {
 if(!CUSTOM_COMMANDS.includes(command))return
 allow(c,command)
 // Aliases inherit the existing ROLE-001 capability lists in migration 0048.
 if(command==='custom.document.generate')return generateDocument(c,p)
 allow(c,'property.add')
 if(command==='custom.field.define' || command==='custom.field.revise') {
  const old=command.endsWith('revise')?await field(c,p.fieldId):null
  const portfolioId=old?.portfolio_id ?? await portfolio(c,p.portfolioId), e=old?.entity ?? entity(p.entity)
  ownerRights(c,e)
  const d=fieldInput(p),v=old?version(p.version):0,reason=text(p.reason,'Schema change reason',500)
  insist(!old || old.version===v,'conflict','Reload the current field schema.',409)
  const existing=old?await store.valuesFor(c,old.id):[]
  // A schema revision never coerces a prior value into a different type or invalidates recorded values.
  for(const val of existing)insist(JSON.stringify(valueInput(d,JSON.parse(val.value)))===val.value,'schema_values','The new schema would invalidate recorded values. Use a new field.',409)
  const row={id:old?.id ?? id(),portfolio_id:portfolioId,entity:e,key:old?.key ?? key(p.key),version:v+1,definition:d}
  const writes=[...(old?[store.revisionGuard(c,'field',old)]:[]),...existing.map(x=>store.valueGuard(c,old!.id,x.entity_id,x.version)),...store.writeField(c,row,!old,reason)]
  // Prevent a concurrent new value from escaping schema validation.
  if(old)writes.unshift(guard(c,'(SELECT COUNT(*) FROM tt_custom_values WHERE field_id=?)=?',old.id,existing.length))
  c.source=reason;await commit(c,writes,command,row.id)
  return {id:row.id,version:row.version,tab:'custom',notice:'Field schema recorded. Saved definitions must be reviewed after schema changes.'}
 }
 if(command==='custom.value.set') {
  const f=await field(c,p.fieldId),s=await subject(c,f.entity,f.portfolio_id,p.entityId),previous=await store.findValue(c,f.id,s.id),v=version(p.version)
  insist(v===(previous?.version ?? 0),'conflict','Reload the current field value.',409)
  const value=valueInput(f.definition,p.value),source=text(p.source,'Value source',500)
  c.source=source;await commit(c,[store.revisionGuard(c,'field',f),store.valueGuard(c,f.id,s.id,v),...store.writeValue(c,f,s.id,v+1,value,source)],command,f.id)
  return {id:f.id,entityId:s.id,version:v+1,tab:'custom',notice:'Validated value recorded with its source.'}
 }
 const kind=command.startsWith('custom.report.')?'report':'template',old=command.endsWith('revise')?await definition(c,p.definitionId,kind):null
 const portfolioId=old?.portfolio_id ?? await portfolio(c,p.portfolioId),e=old?.entity ?? entity(p.entity)
 ownerRights(c,e)
 const fields=(await store.fieldsIn(c,portfolioId,e)).map(unpack).filter(f=>readable(c,f)),byKey=new Map<string,Row>(fields.map(f=>[f.key,f])),deps=new Set<string>()
 const spec=kind==='report'?reportInput(p.spec,byKey,deps):templateInput(p.body,byKey,deps),readRoles=roles(p.readRoles),v=old?version(p.version):0
 insist(!old || old.version===v,'conflict','Reload the saved definition.',409)
 const pins=[...deps].sort().map(k=>{const f=byKey.get(k)!;return {id:f.id,key:f.key,version:f.version}})
 const row={id:old?.id ?? id(),portfolio_id:portfolioId,entity:e,kind,name:text(p.name,'Name',120),version:v+1,definition:{...spec,readRoles,fields:pins}},reason=text(p.reason,'Definition change reason',500)
 c.source=reason;await commit(c,[...(old?[store.revisionGuard(c,'definition',old)]:[]),...pins.map(pin=>store.revisionGuard(c,'field',byKey.get(pin.key)!)),...store.writeDefinition(c,row,!old,reason)],command,row.id)
 return {id:row.id,version:row.version,tab:'custom',notice:`Saved ${kind} version ${row.version}. Previously generated documents are unchanged.`}
}
