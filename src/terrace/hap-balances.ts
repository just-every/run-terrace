import { all, type Context, type Row } from './core'
export const RESIDENT_EFFECT = 'COALESCE((SELECT SUM(resident_delta) FROM tt_hap_effects WHERE resident_charge_id=q.id),0)'
export const PHA_EFFECT = 'COALESCE((SELECT SUM(pha_delta) FROM tt_hap_effects WHERE hap_charge_id=q.id),0)'
/** Dated corrections retain their original entitlement periods and actual approval day. */
export async function hapEffects(c:Context,tenancyId:string){return all(c,'SELECT e.*,v.kind,v.reason,v.reference,v.notice_version_id,v.payer FROM tt_hap_effects e JOIN tt_hap_changes v ON v.id=e.change_id WHERE e.tenancy_id=? ORDER BY e.posting_day,e.id',tenancyId)}
export function effectiveCharges(charges:Row[],effects:Row[],asOf:string,payer:'resident'|'pha'){
 const key=payer==='resident'?'resident_charge_id':'hap_charge_id',delta=payer==='resident'?'resident_delta':'pha_delta'
 return charges.map(q=>({...q,original_amount_cents:q.amount_cents,amount_cents:q.amount_cents+effects.filter(e=>e[key]===q.id&&e.posting_day<=asOf).reduce((n,e)=>n+e[delta],0)}))
}
