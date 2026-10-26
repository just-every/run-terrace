import {all,type Context} from './core'
/** The portal already authorizes this owner identity; expose only their frozen journal share. */
export async function ownerPayerBalances(c:Context,ownerId:string,propertyId:string){
 const rows=await all(c,"SELECT source_kind,lines FROM tt_journal WHERE owner_key=? AND property_id=? AND source_kind IN ('charge','receipt','reduction','hap_charge','hap_receipt','hap_pha_effect','hap_resident_effect')",ownerId,propertyId)
 if(!rows.some(r=>r.source_kind==='hap_charge'))return null
 let residentCents=0,phaCents=0
 for(const row of rows)for(const line of JSON.parse(row.lines))if(line.account==='receivable'){
  if(['hap_charge','hap_receipt','hap_pha_effect'].includes(row.source_kind))phaCents+=line.debit-line.credit
  else residentCents+=line.debit-line.credit
 }
 return {currency:'USD',residentCents,phaCents,totalCents:residentCents+phaCents,boundary:'Your recorded beneficial share only. PHA debt is separate from resident debt. External receipts do not verify bank settlement or authorize a distribution.'}
}
