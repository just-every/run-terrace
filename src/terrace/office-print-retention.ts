import {all,guard,type Context} from './core'

// The combined PDF and its exact approval are immutable shared evidence.
const heldPrints=`SELECT 1 FROM tt_print_items own
 JOIN tt_threads subject ON subject.id=own.thread_id
 JOIN tt_print_items other ON other.batch_id=own.batch_id
 JOIN tt_threads recipient ON recipient.id=other.thread_id
 JOIN tt_legal_holds h ON h.tenancy_id=recipient.tenancy_id
 WHERE subject.tenancy_id=? AND h.released_at IS NULL
 AND h.class IN ('all','communications')`

/** Keep the shared original without revealing another subject or their hold reason. */
export async function printSharedHolds(c:Context,tenancyId:string){
 const holds=await all(c,`${heldPrints} AND recipient.tenancy_id<>? LIMIT 1`,tenancyId,tenancyId)
 return holds.map(()=>({class:'communications',reason:'Shared office print evidence is under a legal hold'}))
}

export const printErasureGuard=(c:Context,tenancyId:string)=>guard(c,`NOT EXISTS(${heldPrints})`,tenancyId)
