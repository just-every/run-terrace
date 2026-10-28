import { all, one, type Context, type Row } from './core'
export async function migrationHistory(c: Context, tenancyId: string) {
 const opening=await one(c,'SELECT * FROM tt_migration_lease_openings WHERE tenancy_id=?',tenancyId)
 const rows=await all(c,'SELECT * FROM tt_migration_history WHERE tenancy_id=? ORDER BY day,id',tenancyId)
 return {opening,rows}
}
/** Historical lines replace the opening charge's statement event, never its collectible native balance. */
export function migrationEvents(data: Row): Row[] {
 const history=data.migrationHistory
 if(!history?.opening)return []
 const {opening,rows}=history
 return [...(opening.opening_cents?[{id:'migration-opening:'+opening.tenancy_id,date:opening.history_from,kind:'Migrated history opening',description:'Read-only source opening',amountCents:Math.abs(opening.opening_cents),receivableDeltaCents:opening.opening_cents,reference:'Source opening',historical:true}]:[]),...rows.map((r:Row)=>({id:'migration-history:'+r.id,date:r.day,kind:'Migrated '+r.kind,description:'Read-only source '+r.kind,amountCents:r.amount_cents,receivableDeltaCents:r.delta_cents,reference:r.reference,sourceRef:r.source_ref,historical:true}))]
}
