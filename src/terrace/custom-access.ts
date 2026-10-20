import { allow, can, everywhere, insist, reachesPortfolio, text, type Context, type Row } from './core'
import { ENTITIES } from './custom-input'
import * as store from './custom-store'
export const unpack = (row: Row): Row => ({...row,definition:JSON.parse(row.definition)})
export const readsRoles = (c: Context, roles: string[]) => c.actor.role==='owner' || roles.includes(c.actor.staff?.role ?? '')
export function ownerRights(c: Context, entity: string) {
 if(entity!=='owner')return
 everywhere(c);insist(c.actor.role==='owner' || can(c,'owner.add') || can(c,'reports.read'),'forbidden','Your role cannot read the owner directory.',403)
}
export function scope(c: Context, row: Row) {insist(reachesPortfolio(c,row.portfolio_id),'not_found','Custom record not found.',404);ownerRights(c,row.entity)}
export function visible(c: Context, row: Row) {scope(c,row);insist(readsRoles(c,row.definition.readRoles),'forbidden','A field or definition required for this operation is hidden from your role.',403)}
export async function portfolio(c: Context, value: unknown) {const p=text(value,'Portfolio',100);insist(reachesPortfolio(c,p) && await store.portfolioExists(c,p),'not_found','Portfolio not found.',404);return p}
export function entity(value: unknown) {const e=String(value);insist(ENTITIES.includes(e),'invalid_entity','Choose unit, property or owner.');return e}
export async function field(c: Context, value: unknown) {const r=await store.findField(c,text(value,'Field',100));insist(r,'not_found','Field not found.',404);const f=unpack(r);visible(c,f);return f}
export async function definition(c: Context, value: unknown, kind?: string) {const r=await store.findDefinition(c,text(value,'Definition',100));insist(r && (!kind || r.kind===kind),'not_found','Definition not found.',404);const d=unpack(r);visible(c,d);return d}
export async function subject(c: Context, e: string, p: string, value: unknown) {ownerRights(c,e);const r=(await store.subjects(c,e,p)).find(r=>r.id===text(value,'Subject',100));insist(r,'not_found','Subject not found.',404);return r}
export async function referenced(c: Context, row: Row, pinned = true): Promise<Row[]> {
 const all=await store.fieldsIn(c,row.portfolio_id,row.entity), fields: Row[]=[]
 for(const pin of row.definition.fields) {
  const f=all.find(f=>f.id===pin.id);insist(f,'schema_changed','A required field no longer exists. Revise the saved definition.',409)
  const current=unpack(f);visible(c,current)
  insist(!pinned || current.version===pin.version,'schema_changed','Field schema changed. Review and revise the saved definition before running it.',409);fields.push(current)
 }
 return fields
}
export function readable(c: Context, row: Row) {
 try {visible(c,row);return true}catch{return false}
}
export function readDoor(c: Context) {allow(c,'work.read')}
