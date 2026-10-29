import {all,guard,type Context} from './core'
// A retained follow-up and its explicitly linked original work share lease-evidence holds.
const heldEvidence=`SELECT 1 FROM tt_move_followups f
 JOIN tt_move_followup_revisions r ON r.followup_id=f.id
 JOIN json_each(r.evidence) e
 JOIN tt_maintenance_jobs j ON j.id=json_extract(e.value,'$.id')
 JOIN tt_legal_holds h ON h.tenancy_id IN (f.tenancy_id,j.tenancy_id)
 WHERE ? IN (f.tenancy_id,j.tenancy_id) AND h.released_at IS NULL
 AND h.class IN ('all','lease')`
export async function moveFollowupSharedHolds(c:Context,tenancyId:string){
 const held=await all(c,`${heldEvidence} AND h.tenancy_id<>? LIMIT 1`,tenancyId,tenancyId)
 return held.map(()=>({class:'lease',reason:'Shared move-out repair evidence is under a legal hold'}))
}
export const moveFollowupErasureGuard=(c:Context,tenancyId:string)=>guard(c,`NOT EXISTS(${heldEvidence})`,tenancyId)
