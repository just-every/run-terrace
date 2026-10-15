export type Row = Record<string, any>
export type Actor = { id: string; role: 'owner' | 'admin' | 'member'; displayName: string; version?: number }
export type Context = { db: D1Database; actor: Actor; now: string }
export class Fault extends Error { constructor(public code: string, message: string, public status = 400) { super(message) } }
export function insist(ok: unknown, code: string, message: string, status = 400): asserts ok { if (!ok) throw new Fault(code, message, status) }
export const text = (v: unknown, label: string, max = 500) => { insist(typeof v === 'string' && v.trim().length > 0 && v.trim().length <= max, 'invalid_input', `${label} is required (up to ${max} characters).`); return v.trim() }
export function date(v: unknown, label = 'Date') { const s = text(v, label, 10); insist(/^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s)) && new Date(s).toISOString().slice(0,10) === s, 'invalid_date', `${label} must be a real YYYY-MM-DD date.`); return s }
export function cents(v: unknown) { const s = text(String(v ?? ''), 'Amount', 16); insist(/^\d+(\.\d{1,2})?$/.test(s), 'invalid_money', 'Enter a positive AUD amount with at most two decimal places.'); const [a,b=''] = s.split('.'); const n = Number(a)*100 + Number(b.padEnd(2,'0')); insist(Number.isSafeInteger(n) && n > 0 && n <= 100_000_000, 'invalid_money','Amount must be positive and at most A$1,000,000.'); return n }
export function email(v: unknown) { const s=text(v,'Email',254).toLowerCase(); insist(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s), 'invalid_email','Enter a valid email address.'); return s }
export const id = () => crypto.randomUUID()
export const sql = (c: Context, query: string, ...values: any[]) => c.db.prepare(query).bind(...values)
export const one = <T = Row>(c: Context, query: string, ...values: any[]) => sql(c,query,...values).first<T>()
export const all = async <T = Row>(c: Context, query: string, ...values: any[]) => (await sql(c,query,...values).all<T>()).results
export function manager(c: Context) { insist(['owner','admin'].includes(c.actor.role), 'forbidden', 'An owner or manager must approve this action.',403) }
export function owner(c: Context) { insist(c.actor.role==='owner','forbidden','Only the installation owner can do this.',403) }
export const guard = (c: Context, condition: string, ...params: any[]) => sql(c,`INSERT INTO tt_guard(ok) VALUES(CASE WHEN ${condition} THEN 1 ELSE 0 END)`,...params)
export const audit = (c: Context, action: string, subject: string) => sql(c,'INSERT INTO tt_audit(id,actor,action,subject,at) VALUES(?,?,?,?,?)',id(),c.actor.id,action,subject,c.now)
export async function commit(c: Context, statements: D1PreparedStatement[], action: string, subject: string) { try { await c.db.batch([guard(c,"EXISTS(SELECT 1 FROM oa_operators WHERE id=? AND status='active' AND role=? AND version=?)",c.actor.id,c.actor.role,c.actor.version ?? 1),...statements,audit(c,action,subject)]); } catch(e) { if(String(e).includes('CHECK constraint')) throw new Fault('conflict','The record or your access changed. Reload and review again.',409); throw e } }
export async function tenancy(c: Context, value: unknown) { const row = await one(c,'SELECT * FROM tt_tenancies WHERE id=?',text(value,'Tenancy',100)); insist(row,'not_found','Tenancy not found.',404); return row }
export const money = (n: number) => new Intl.NumberFormat('en-AU',{style:'currency',currency:'AUD'}).format(n/100)
export const escape = (v: unknown) => String(v ?? '').replace(/[&<>"']/g, x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]!))
export const sha256 = async (bytes: Uint8Array) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new Uint8Array(bytes).buffer))).map(x=>x.toString(16).padStart(2,'0')).join('')
