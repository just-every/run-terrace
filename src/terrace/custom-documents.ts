import { allow, commit, id, insist, recordRead, text, type Context, type Row } from './core'
import { definition, readsRoles, referenced, scope, subject, visible } from './custom-access'
import * as store from './custom-store'
/** Source and value versions are copied into a generated document; later source edits never regenerate it. */
export async function valuesSnapshot(c: Context, fields: Row[], entityId: string) {
 const records=await Promise.all(fields.map(f=>store.findValue(c,f.id,entityId))),values: Row={},lineage: Row[]=[]
 fields.forEach((f,i)=>{
  const v=records[i],value=v?JSON.parse(v.value):null
  values[f.key]=value
  lineage.push({fieldId:f.id,key:f.key,schemaVersion:f.version,label:f.definition.label,type:f.definition.type,valueVersion:v?.version ?? 0,value,source:v?.source ?? null,recordedAt:v?.updated_at ?? null})
 })
 return {values,lineage,records}
}
export async function generateDocument(c: Context, p: Row) {
 allow(c,'work.read')
 const d=await definition(c,p.templateId,'template')
 insist(Number(p.version)===d.version,'conflict','Review the current template version before generating.',409)
 const fields=await referenced(c,d),s=await subject(c,d.entity,d.portfolio_id,p.entityId),snapshot=await valuesSnapshot(c,fields,s.id)
 for(const f of fields)insist(snapshot.values[f.key]!==null,'missing_merge_value','Every merge field must have a recorded value.')
 const content=d.definition.body.replace(/\{\{([^{}]+)\}\}/g,(_:string,k:string)=>String(snapshot.values[k]))
 const row={id:id(),template_id:d.id,template_version:d.version,portfolio_id:d.portfolio_id,entity:d.entity,entity_id:s.id,content,lineage:snapshot.lineage,readRoles:d.definition.readRoles}
 await commit(c,[store.revisionGuard(c,'definition',d),...fields.map((f,i)=>store.revisionGuard(c,'field',f)),...fields.map((f,i)=>store.valueGuard(c,f.id,s.id,snapshot.records[i]?.version ?? 0)),store.writeDocument(c,row)],'custom.document.generate',row.id)
 return {id:row.id,documentId:row.id,version:d.version,tab:'custom',notice:'Document generated and frozen with its template, schema and value versions.'}
}
export async function customDocument(c: Context, value: unknown) {
 allow(c,'work.read')
 const row=await store.findDocument(c,text(value,'Document',100));insist(row,'not_found','Document not found.',404)
 scope(c,row);insist(readsRoles(c,JSON.parse(row.read_roles)),'forbidden','This document is hidden from your role.',403)
 const current=await definition(c,row.template_id,'template')
 visible(c,current)
 const lineage: Row[]=JSON.parse(row.lineage)
 // Recheck every historical dependency, not just the current template's placeholders.
 await referenced(c,{...current,definition:{fields:lineage.map(x=>({id:x.fieldId,version:x.schemaVersion}))}},false)
 await subject(c,row.entity,row.portfolio_id,row.entity_id)
 await recordRead(c,'read:custom-document',row.id)
 return {id:row.id,templateId:row.template_id,templateVersion:row.template_version,entity:row.entity,entityId:row.entity_id,content:row.content,lineage,generatedAt:row.generated_at}
}
