import { date, insist, text, type Row } from './core'
import { ROLES } from './roles'
export const ENTITIES = ['unit','property','owner']
export const TYPES = ['text','number','boolean','date','select']
export const roleNames = ROLES.map(r => r[0])
export function parsed(v: unknown, label: string): any {
 if (typeof v !== 'string') return v
 try { return JSON.parse(v) } catch { insist(false,'invalid_input',`${label} must be valid JSON.`) }
}
export function roles(v: unknown): string[] {
 const r = parsed(v,'Read roles')
 insist(Array.isArray(r) && r.every(x => typeof x === 'string' && roleNames.includes(x)), 'invalid_roles','Choose the staff roles allowed to read this field or definition. The owner always has access.')
 return [...new Set(r)].sort()
}
export function key(v: unknown) { const k=text(v,'Field key',60); insist(/^[a-z][a-z0-9_]*$/.test(k),'invalid_key','Use a lowercase key starting with a letter.'); return k }
export function fieldInput(p: Row) {
 const type=String(p.type), options=parsed(p.options ?? [],'Options')
 insist(TYPES.includes(type),'invalid_type','Choose text, number, boolean, date or select.')
 insist(Array.isArray(options) && options.length <= 100 && options.every(v => typeof v==='string' && v.trim()===v && v.length>0 && v.length<=120) && new Set(options).size===options.length,'invalid_options','Options must be unique nonempty text values.')
 insist(type!=='select' || options.length>0,'invalid_options','A select field needs options.')
 const min=p.min === '' || p.min === undefined || p.min === null ? null : Number(p.min), max=p.max === '' || p.max === undefined || p.max === null ? null : Number(p.max)
 insist((min===null || Number.isFinite(min)) && (max===null || Number.isFinite(max)) && (min===null || max===null || min<=max),'invalid_range','Give a valid numeric range.')
 return { label:text(p.label,'Field label',120),type,options:type==='select'?options:[],min,max,required:p.required===true||p.required==='on',readRoles:roles(p.readRoles) }
}
export function valueInput(d: Row, v: any) {
 if(v===null || v==='') { insist(!d.required,'required_field','This field requires a value.'); return null }
 if(d.type==='text') return text(v,'Value',2000)
 if(d.type==='date') return date(v,'Value')
 if(d.type==='boolean') { insist(v===true || v===false || v==='true' || v==='false','invalid_value','Use true or false.'); return v===true || v==='true' }
 if(d.type==='select') { insist(d.options.includes(v),'invalid_value','Choose one of the field’s recorded options.'); return v }
 insist((typeof v==='number' || typeof v==='string' && /^-?(?:\d+)(?:\.\d+)?$/.test(v)) && Number.isFinite(Number(v)) && Math.abs(Number(v))<=1e12,'invalid_value','Use a finite decimal number no larger than 1 trillion.')
 const n=Number(v);insist((d.min===null || n>=d.min) && (d.max===null || n<=d.max),'invalid_value','Value is outside the field’s range.');return n
}
export function version(v: unknown) { const n=Number(v);insist(v!==undefined && Number.isInteger(n) && n>=0,'conflict','Provide the version you reviewed.',409);return n }
