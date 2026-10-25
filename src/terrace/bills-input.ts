import {costClass} from './work-budgets'
import { all, cents, date, guard, insist, one, reachesPortfolio, sha256, sql, text, type Context, type Row } from './core'
export const BILL_COMMANDS = ['bill.create','bill.revise','bill.attach','bill.owner','bill.approve','bill-template.create','bill-template.revise','bill-template.approve','bill-template.run']
export const digest = (v: unknown) => sha256(new TextEncoder().encode(JSON.stringify(v)))
export const zero = (v: unknown) => !v || /^0(\.0{1,2})?$/.test(String(v)) ? 0 : cents(v)
export function array(v: unknown, label: string): Row[] {
 if (typeof v === 'string') { try { v = JSON.parse(v) } catch { insist(false,'invalid_input',`${label} must be a JSON array.`) } }
 insist(Array.isArray(v) && v.length > 0 && v.length <= 50 && v.every(x=>x && typeof x==='object' && !Array.isArray(x)),'invalid_input',`Give 1 to 50 ${label}.`)
 return v
}
export async function scopes(c: Context, terms: Row) {
 const rows = await all(c,'SELECT id,portfolio_id,name FROM tt_properties')
 for (const a of terms.allocations) insist(rows.some(p => p.id === a.propertyId && reachesPortfolio(c,p.portfolio_id)),'not_found','Property not found.',404)
}
export async function bill(c: Context, value: unknown) {
 const b = await one(c,'SELECT b.*,r.terms,r.sha256,v.name AS vendor_name FROM tt_bills b JOIN tt_bill_revisions r ON r.bill_id=b.id AND r.version=b.version JOIN tt_vendors v ON v.id=b.vendor_id WHERE b.id=?',text(value,'Bill',100))
 insist(b,'not_found','Bill not found.',404); b.parsed = JSON.parse(b.terms); await scopes(c,b.parsed);
 for(const r of await all(c,'SELECT terms FROM tt_bill_revisions WHERE bill_id=?',b.id))await scopes(c,JSON.parse(r.terms));
 return b
}
export const billGuard = (c: Context, b: Row) => guard(c,'EXISTS(SELECT 1 FROM tt_bills WHERE id=? AND version=? AND state=?)',b.id,b.version,b.state)
export async function input(c: Context, p: Row, template = false) {
 const v = await one(c,'SELECT id,name FROM tt_vendors WHERE id=?',text(p.vendorId,'Supplier',100))
 insist(v,'not_found','Supplier not found. Add the supplier to Vendors first.',404)
 const sourceLines = p.lines ?? (String(p.lineItems ?? '').split('\n').filter(Boolean).map(s => { const [description,code,amount,tax] = s.split('|').map(x => x.trim()); return {description,code,amount,tax} }))
 const lines = array(sourceLines,'line items').map(l => ({description:text(l.description,'Line description',500),code:text(l.code,'Expense coding',100),amountCents:cents(l.amount),taxCents:zero(l.tax)}))
 const totalCents = lines.reduce((s,l) => s+l.amountCents+l.taxCents,0)
 insist(Number.isSafeInteger(totalCents) && totalCents <= 100000000,'invalid_money','Bill total must be at most 1,000,000.00.')
 const source = p.allocations ?? Object.keys(p).filter(k => k.startsWith('allocation:') && zero(p[k]) > 0).map(k => ({propertyId:k.slice(11),amount:p[k],jobId:p['job:'+k.slice(11)] || null,costClass:p['costClass:'+k.slice(11)],assetId:p['asset:'+k.slice(11)]||null}))
 const allocations = array(source,'property allocations').map(a => ({propertyId:text(a.propertyId,'Property',100),amountCents:cents(a.amount),jobId:a.jobId ? text(a.jobId,'Work order',100):null,costClass:costClass(a.costClass),assetId:a.assetId?text(a.assetId,'Asset',100):null}))
 insist(new Set(allocations.map(a => a.propertyId)).size===allocations.length && allocations.reduce((s,a) => s+a.amountCents,0)===totalCents,'allocation_total','Each property appears once and allocated amounts must total the invoice including tax.')
 const terms: Row = {vendorId:v.id,supplier:v.name,invoiceNumber:text(p.invoiceNumber,'Invoice number or recurring reference prefix',100),day:date(p.date ?? p.starts,'Invoice date'),lines,allocations,totalCents,currency:'USD'}
 await scopes(c,terms)
 for(const a of allocations)if(a.assetId){
  const asset=await one(c,'SELECT a.id FROM tt_assets a JOIN tt_units u ON u.id=a.unit_id WHERE a.id=? AND u.property_id=?',a.assetId,a.propertyId)
  insist(asset,'not_found','Asset not found for this property.',404)
 }
 if(template){ terms.starts=date(p.starts,'First bill date');terms.endDate=date(p.endDate,'Last bill date');insist(terms.endDate>=terms.starts,'invalid_date','End date must follow the first bill date.');terms.schedule='monthly';terms.dayOfMonth=Number(p.dayOfMonth ?? terms.starts.slice(8));insist(Number.isInteger(terms.dayOfMonth)&&terms.dayOfMonth>=1&&terms.dayOfMonth<=31,'invalid_input','Monthly bill day is 1 to 31.');terms.purpose=text(p.purpose,'Recurring payable purpose',200) }
 return terms
}
export async function unique(c: Context, terms: Row, except = '') {
 insist(!(await one(c,"SELECT 1 FROM tt_bill_revisions WHERE json_extract(terms,'$.vendorId')=? AND lower(json_extract(terms,'$.invoiceNumber'))=? AND bill_id<>?",terms.vendorId,terms.invoiceNumber.toLowerCase(),except)),'duplicate_invoice','This supplier and invoice number are already recorded.',409)
}
export function revision(c: Context, key: string, version: number, terms: Row, sha: string) {
 return sql(c,'INSERT INTO tt_bill_revisions(bill_id,version,terms,sha256,prepared_by,prepared_at) VALUES(?,?,?,?,?,?)',key,version,JSON.stringify(terms),sha,c.actor.id,c.now)
}
