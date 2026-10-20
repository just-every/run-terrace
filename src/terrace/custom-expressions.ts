// A bounded expression tree, never JS or SQL. Every field dependency is authorized before evaluation.
import { insist, text, type Row } from './core'
import { key, parsed } from './custom-input'
export type Expression = { field: string } | { literal: number } | { op: string; args: Expression[] }
export function expression(v: any, fields: Map<string,Row>, deps: Set<string>, depth=0): Expression {
 insist(depth<=8 && v && typeof v==='object' && !Array.isArray(v),'invalid_formula','Use a formula tree up to eight levels deep.')
 if(Object.keys(v).length===1 && typeof v.field==='string') {const f=fields.get(v.field);insist(f && f.definition.type==='number','invalid_formula','Arithmetic requires numeric custom fields.');deps.add(f.key);return {field:f.key}}
 if(Object.keys(v).length===1 && typeof v.literal==='number') {insist(Number.isFinite(v.literal) && Math.abs(v.literal)<=1e12,'invalid_formula','Use a finite numeric constant.');return {literal:v.literal}}
 insist(Object.keys(v).length===2 && ['add','subtract','multiply','divide'].includes(v.op) && Array.isArray(v.args) && v.args.length===2,'invalid_formula','Use add, subtract, multiply or divide with exactly two args.')
 return {op:v.op,args:v.args.map((x:any)=>expression(x,fields,deps,depth+1))}
}
export function evaluate(expr: Expression, values: Row): number|null {
 if('field' in expr)return values[expr.field] ?? null
 if('literal' in expr)return expr.literal
 const a=evaluate(expr.args[0],values),b=evaluate(expr.args[1],values)
 if(a===null || b===null)return null
 insist(expr.op!=='divide' || b!==0,'invalid_formula','Formula division by zero. Correct the source or formula.')
 const n=expr.op==='add'?a+b:expr.op==='subtract'?a-b:expr.op==='multiply'?a*b:a/b
 insist(Number.isFinite(n) && Math.abs(n)<=1e15,'invalid_formula','Formula result is outside the supported numeric range.');return n
}
export function reportInput(input: unknown, fields: Map<string,Row>, deps: Set<string>) {
 const p=parsed(input,'Report specification');insist(p && Array.isArray(p.columns) && p.columns.length>0 && p.columns.length<=30,'invalid_report','Choose 1 to 30 columns.')
 const columns=p.columns.map((col:Row)=>{
  insist(col && typeof col==='object','invalid_report','Give each column a key and field or formula.')
  const k=key(col.key), label=text(col.label,'Column label',120)
  insist((col.field!==undefined)!==(col.formula!==undefined),'invalid_report','Each column needs one field or formula.')
  if(col.field!==undefined) {const f=fields.get(String(col.field));insist(f,'invalid_report','Unknown custom field.');deps.add(f.key);return {key:k,label,field:f.key}}
  return {key:k,label,formula:expression(col.formula,fields,deps)}
 })
 const names=columns.map((x:Row)=>x.key);insist(new Set(names).size===names.length,'invalid_report','Column keys must be unique.')
 const groupBy=p.groupBy ?? [];insist(Array.isArray(groupBy) && groupBy.length<=10 && groupBy.every((k:any)=>names.includes(k)) && new Set(groupBy).size===groupBy.length,'invalid_report','Group by selected column keys.')
 const aggregates=(p.aggregates ?? []).map((a:Row)=>{
  insist(a && ['count','sum','average','min','max'].includes(a.op) && (a.op==='count'||names.includes(a.column)),'invalid_report','Choose count, sum, average, min or max of a column.')
  if(a.op!=='count') {const col=columns.find((c:Row)=>c.key===a.column);insist(col.formula || fields.get(col.field)?.definition.type==='number','invalid_report','Numeric aggregation requires a numeric field or formula column.')}
  return {key:key(a.key),op:a.op,column:a.op==='count'?null:a.column}
 })
 insist(aggregates.length<=20 && new Set(aggregates.map((x:Row)=>x.key)).size===aggregates.length,'invalid_report','Use up to twenty uniquely named aggregates.')
 const filters=(p.filters ?? []).map((q:Row)=>{
  const f=fields.get(q.field);insist(f && ['eq','ne','gt','gte','lt','lte','contains'].includes(q.op),'invalid_filter','Use a known field and filter operator.')
  const type=f.definition.type;insist(!['gt','gte','lt','lte'].includes(q.op)||['number','date'].includes(type),'invalid_filter','Ordered filters require a number or date.');insist(q.op!=='contains'||type==='text','invalid_filter','Contains requires text.')
  insist(q.value!==undefined && (q.value===null || typeof q.value===(type==='number'?'number':type==='boolean'?'boolean':'string')),'invalid_filter','Filter value must match the field type.');deps.add(f.key);return {field:f.key,op:q.op,value:q.value}
 })
 insist(filters.length<=30,'invalid_filter','Use up to thirty filters.')
 return {columns,groupBy,aggregates,filters}
}
export function templateInput(input: unknown, fields: Map<string,Row>, deps: Set<string>) {
 const body=text(input,'Template body',20000), placeholders=[...body.matchAll(/\{\{([^{}]+)\}\}/g)].map(x=>x[1])
 insist(!/[{}]/.test(body.replace(/\{\{[^{}]+\}\}/g,'')),'invalid_template','Merge fields use {{field_key}}.')
 for(const k of placeholders){insist(fields.has(k),'invalid_template','Template contains an unknown custom field.');deps.add(k)}
 return {body}
}
export function matches(values: Row, q: Row) {
 const a=values[q.field] ?? null,b=q.value
 if(q.op==='eq')return a===b
 if(q.op==='ne')return a!==b
 if(a===null || b===null)return false
 return q.op==='contains'?String(a).includes(b):q.op==='gt'?a>b:q.op==='gte'?a>=b:q.op==='lt'?a<b:a<=b
}
