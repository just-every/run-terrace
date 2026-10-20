import { insist, recordRead, type Context, type Row } from './core'
import { definition, readDoor, referenced } from './custom-access'
import { evaluate, matches } from './custom-expressions'
import { valuesSnapshot } from './custom-documents'
import * as store from './custom-store'
export async function customReport(c: Context, value: unknown) {
 readDoor(c)
 const saved=await definition(c,value,'report'),fields=await referenced(c,saved),spec=saved.definition,subjects=await store.subjects(c,saved.entity,saved.portfolio_id),rows: Row[]=[]
 // Dependencies used only by filters, formulas or grouping receive the same gate as visible columns.
 for(const subject of subjects) {
  const snapshot=await valuesSnapshot(c,fields,subject.id)
  if(!spec.filters.every((q:Row)=>matches(snapshot.values,q)))continue
  const cells: Row={}
  for(const col of spec.columns)cells[col.key]=col.field?snapshot.values[col.field]:evaluate(col.formula,snapshot.values)
  rows.push({entityId:subject.id,label:subject.label,cells,lineage:snapshot.lineage})
 }
 const buckets=new Map<string,Row>()
 for(const row of rows) {
  const by=Object.fromEntries(spec.groupBy.map((k:string)=>[k,row.cells[k]])),key=JSON.stringify(by)
  if(!buckets.has(key))buckets.set(key,{by,rows:[]})
  buckets.get(key)!.rows.push(row)
 }
 const groups=[...buckets.values()].map(group=>{
  const aggregates: Row={}
  for(const a of spec.aggregates) {
   if(a.op==='count'){aggregates[a.key]=group.rows.length;continue}
   const values=group.rows.map((r:Row)=>r.cells[a.column]).filter((v:any)=>v!==null)
   insist(values.every((v:any)=>typeof v==='number'),'invalid_aggregate','Numeric aggregation requires numeric columns.')
   const sum=values.reduce((n:number,v:number)=>n+v,0)
   const result=!values.length?null:a.op==='sum'?sum:a.op==='average'?sum/values.length:a.op==='min'?Math.min(...values):Math.max(...values)
   insist(result===null || Number.isFinite(result) && Math.abs(result)<=1e15,'invalid_aggregate','Aggregate result exceeds the supported numeric range.')
   aggregates[a.key]=result
  }
  return {by:group.by,count:group.rows.length,aggregates}
 })
 await recordRead(c,'read:custom-report',saved.id)
 return {id:saved.id,name:saved.name,version:saved.version,entity:saved.entity,portfolioId:saved.portfolio_id,columns:spec.columns,filters:spec.filters,groupBy:spec.groupBy,aggregateDefinitions:spec.aggregates,rows,groups,schema:fields.map(f=>({id:f.id,key:f.key,version:f.version,...f.definition})),numericSemantics:'Finite decimal numbers use IEEE-754 arithmetic, without monetary rounding; missing operands yield null. Numeric aggregates ignore null; count counts rows. Division by zero is refused.'}
}
export function customReportTable(data: Row): (string|number)[][] {
 return [['Subject ID','Subject',...data.columns.map((c:Row)=>c.label),'Source lineage'],...data.rows.map((r:Row)=>[r.entityId,r.label,...data.columns.map((c:Row)=>r.cells[c.key]===null?'':typeof r.cells[c.key]==='number'?r.cells[c.key]:String(r.cells[c.key])),JSON.stringify(r.lineage)]),[],['Groups',...data.groupBy,...data.aggregateDefinitions.map((a:Row)=>a.key)],...data.groups.map((g:Row)=>['',...data.groupBy.map((k:string)=>g.by[k]===null?'':String(g.by[k])),...data.aggregateDefinitions.map((a:Row)=>g.aggregates[a.key]??'')])]
}
