import {all,guard,one,sql,type Context} from './core'
const shared=`SELECT 1 FROM tt_shadow_subjects own JOIN tt_shadow_subjects peer ON peer.run_id=own.run_id JOIN tt_legal_holds h ON h.tenancy_id=peer.tenancy_id WHERE own.tenancy_id=? AND h.released_at IS NULL AND h.class IN ('all','accounting')`
export async function shadowSharedHolds(c:Context,tenancyId:string){return await one(c,shared+' AND peer.tenancy_id<>?',tenancyId,tenancyId)?[{class:'accounting',reason:'Shared shadow statement original is under a legal hold'}]:[]}
export async function shadowRetentionDay(c:Context,tenancyId:string){return (await one(c,'SELECT MAX(day) AS day FROM (SELECT r.recorded_at AS day FROM tt_shadow_runs r JOIN tt_shadow_subjects s ON s.run_id=r.id WHERE s.tenancy_id=? UNION ALL SELECT v.reviewed_at FROM tt_shadow_reviews v JOIN tt_shadow_subjects s ON s.run_id=v.run_id WHERE s.tenancy_id=? UNION ALL SELECT a.recorded_at FROM tt_shadow_actions a JOIN tt_shadow_subjects s ON s.run_id=a.run_id WHERE s.tenancy_id=?)',tenancyId,tenancyId,tenancyId))?.day?.slice(0,10)}
export async function shadowErasure(c:Context,tenancyId:string){
 const runs=await all(c,'SELECT r.id,r.sha256 FROM tt_shadow_runs r JOIN tt_shadow_subjects s ON s.run_id=r.id WHERE s.tenancy_id=?',tenancyId)
 return[guard(c,'NOT EXISTS('+shared+')',tenancyId),...runs.flatMap(r=>[sql(c,'INSERT OR IGNORE INTO tt_erased_document_files(sha256) VALUES(?)',r.sha256),sql(c,"UPDATE tt_audit SET source=NULL,subject='Retired shadow comparison' WHERE subject=?",r.id),sql(c,'DELETE FROM tt_shadow_runs WHERE id=?',r.id)])]
}
