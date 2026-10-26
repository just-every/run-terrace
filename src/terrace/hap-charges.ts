/** PAY-013: effective signed HAP splits, with exact cents and separate PHA custody. */
import { all, insist, one, shown, sql, type Context, type Row } from './core'
const day=(s:string)=>Date.parse(s+'T00:00:00Z')/86400000
const prorate=(n:number,covered:number,length:number)=>Math.floor((2*n*covered+length)/(2*length))
export async function hapLines(c:Context,t:Row,line:Row,proposed?:Row) {
 if(!line.leaseVersionId)return [line]
 const v=proposed?.id===line.leaseVersionId?proposed:await one(c,'SELECT id,payload FROM tt_lease_versions WHERE id=? AND approved_at IS NOT NULL',line.leaseVersionId)
 insist(v,'hap_source','The rent term needs its approved signed version.',409)
 const payload=typeof v.payload==='string'?JSON.parse(v.payload):v.payload
 const recorded=payload.obligations.filter((o:Row)=>o.kind==='hap'&&o.housingAuthority)
 if(!recorded.length)return [line]
 const haps=recorded.filter((o:Row)=>o.starts<=line.coveredTo&&(!o.ends||o.ends>=line.coveredFrom))
 insist(haps.length===1&&haps[0].starts<=line.coveredFrom&&(!haps[0].ends||haps[0].ends>=line.coveredTo),'hap_coverage','HAP coverage must match a complete effective rent segment. Split the signed rent schedule at the HAP boundary.',409)
 const correction=await one(c,"SELECT * FROM tt_hap_changes WHERE tenancy_id=? AND kind='split' AND approved_at IS NOT NULL AND effective_from<=? ORDER BY approved_at DESC,rowid DESC LIMIT 1",t.id,line.coveredFrom)
 const hap=correction?{...haps[0],tenantPortionCents:correction.resident_cents,hapPortionCents:correction.pha_cents}:haps[0],term=payload.terms.find((x:Row)=>x.id===line.termId)
 insist(shown(t)==='USD'&&t.cadence==='monthly','hap_currency','HAP posting currently requires confirmed USD monthly rent.',409)
 insist(term&&hap.tenantPortionCents+hap.hapPortionCents===term.amountCents,'hap_split','Signed resident and PHA portions must equal the full rent in exact cents.',409)
 const resident=prorate(hap.tenantPortionCents,day(line.coveredTo)-day(line.coveredFrom)+1,line.periodDays)
 // Keep the already-rounded gross exactly: any prorating remainder belongs to the PHA portion.
 const pha=line.amountCents-resident
 const common={...line,payerName:hap.housingAuthority,hapReference:hap.reference,hapClause:hap.sourceClause}
 const out:Row[]=[]
 if(resident)out.push({...common,amountCents:resident,payerKind:'resident'})
 if(pha){const reference=line.reference+'-HAP';out.push({...common,kind:'hap',amountCents:pha,reference,payerKind:'housing_authority',posted:!!await one(c,'SELECT 1 FROM tt_hap_charges WHERE tenancy_id=? AND reference=?',t.id,reference)})}
 return out
}
export const hapData=(c:Context,tenancyId:string)=>all(c,'SELECT * FROM tt_hap_charges WHERE tenancy_id=? ORDER BY due_date,id',tenancyId)
export function hapInsert(c:Context,key:string,l:Row){return sql(c,'INSERT INTO tt_hap_charges(id,tenancy_id,lease_version_id,term_id,payer,contract_reference,source_clause,period_start,period_end,due_date,amount_cents,currency,reference,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(tenancy_id,reference) DO NOTHING',key,l.tenancyId,l.leaseVersionId,l.termId,l.payerName,l.hapReference,l.hapClause,l.periodStart,l.periodEnd,l.dueDate,l.amountCents,l.currency,l.reference,c.now)}
