import { can, reachesPortfolio, type Context, type Row } from './core'
import { readsRoles, readable, readDoor, unpack } from './custom-access'
import * as store from './custom-store'
export async function customCatalog(c: Context) {
 readDoor(c)
 const [portfolios,allFields,allDefinitions]=await Promise.all([store.portfolios(c),store.allFields(c),store.definitions(c)])
 const fields: Row[]=await Promise.all(allFields.map(unpack).filter(f=>readable(c,f)).map(async f=>({
  ...f,history:(await store.fieldHistory(c,f.id)).map(h=>({...h,definition:JSON.parse(h.definition)})).filter(h=>readsRoles(c,h.definition.readRoles)),
  values:await store.valuesFor(c,f.id),subjects:await store.subjects(c,f.entity,f.portfolio_id),
 })))
 const definitions: Row[]=[]
 for(const d of allDefinitions.map(unpack).filter(d=>readable(c,d))) {
  // Do not expose a template body, formula, filter literal or old version involving a currently hidden field.
  const required=d.definition.fields.map((pin:Row)=>fields.find(f=>f.id===pin.id))
  if(required.some((f:any)=>!f))continue
  const history: Row[]=[]
  for(const h of await store.definitionHistory(c,d.id)) {
   const hd=JSON.parse(h.definition)
   if(readsRoles(c,hd.readRoles) && hd.fields.every((pin:Row)=>fields.some(f=>f.id===pin.id)))history.push({...h,definition:hd})
  }
  definitions.push({...d,history,schemaChanged:required.some((f:Row|undefined,i:number)=>f!.version!==d.definition.fields[i].version),subjects:await store.subjects(c,d.entity,d.portfolio_id)})
 }
 // Listing a document observes the same historical dependency gate as its download.
 const documents: Row[]=[]
 for(const d of await store.documents(c)) {
  if(!reachesPortfolio(c,d.portfolio_id) || !readsRoles(c,JSON.parse(d.read_roles)))continue
  const t=definitions.find(t=>t.id===d.template_id)
  if(!t)continue
  const full=await store.findDocument(c,d.id)
  const lineage: Row[]=JSON.parse(full!.lineage)
  if(!lineage.every(l=>fields.some(f=>f.id===l.fieldId)))continue
  documents.push({id:d.id,templateId:d.template_id,templateVersion:d.template_version,entityId:d.entity_id,generatedAt:d.generated_at})
 }
 return {portfolios:portfolios.filter(p=>reachesPortfolio(c,p.id)),fields,definitions,documents,manage:can(c,'property.add'),generate:can(c,'custom.document.generate')}
}
