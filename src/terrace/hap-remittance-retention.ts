import { all, sql, type Context } from './core'
import { localDate } from './zones'

const shared=`WITH remittances AS (SELECT r.id,r.source_tenancy_id FROM tt_hap_remittances r WHERE r.source_tenancy_id=? OR EXISTS(SELECT 1 FROM tt_hap_allocations a JOIN tt_hap_charges q ON q.id=a.charge_id WHERE a.remittance_id=r.id AND q.tenancy_id=?)), linked AS (SELECT source_tenancy_id AS tenancy_id FROM remittances UNION SELECT q.tenancy_id FROM remittances r JOIN tt_hap_allocations a ON a.remittance_id=r.id JOIN tt_hap_charges q ON q.id=a.charge_id)`
/** A hold on any household's shared accounting source keeps that source for all. */
export const hapRemittanceSharedHolds=(c:Context,tenancyId:string)=>all(c,`${shared} SELECT DISTINCT h.* FROM tt_legal_holds h JOIN linked l ON l.tenancy_id=h.tenancy_id WHERE h.tenancy_id<>? AND h.class IN ('all','accounting') AND h.released_at IS NULL`,tenancyId,tenancyId,tenancyId)
export async function hapRemittanceRetentionDay(c:Context,tenancyId:string) {
 const rows=await all(c,`${shared} SELECT r.received_date,r.outcome_date,r.recorded_at,r.outcome_recorded_at,(SELECT MAX(a.recorded_at) FROM tt_hap_allocations a WHERE a.remittance_id=r.id) AS allocated_at,(SELECT v.uploaded_at FROM tt_document_versions v WHERE v.id=r.source_document_version_id) AS uploaded_at,t.time_zone FROM tt_hap_remittances r JOIN remittances x ON x.id=r.id JOIN tt_tenancies t ON t.id=?`,tenancyId,tenancyId,tenancyId)
 return rows.flatMap(r=>[r.received_date,r.outcome_date,...[r.recorded_at,r.outcome_recorded_at,r.allocated_at,r.uploaded_at].filter(Boolean).map(s=>localDate(s,r.time_zone))]).filter(Boolean).sort().at(-1)??null
}
/** Shared accounting references survive until every linked tenancy is erased. */
export function hapRemittanceErasureStatements(c:Context,tenancyId:string) {
 const eligible=`SELECT r.id FROM tt_hap_remittances r WHERE (r.source_tenancy_id=? OR EXISTS(SELECT 1 FROM tt_hap_allocations a JOIN tt_hap_charges q ON q.id=a.charge_id WHERE a.remittance_id=r.id AND q.tenancy_id=?)) AND NOT EXISTS(SELECT 1 FROM tt_tenancies t WHERE t.erased_at IS NULL AND t.id<>? AND (t.id=r.source_tenancy_id OR EXISTS(SELECT 1 FROM tt_hap_allocations a JOIN tt_hap_charges q ON q.id=a.charge_id WHERE a.remittance_id=r.id AND q.tenancy_id=t.id)))`
 return [sql(c,`UPDATE tt_hap_allocation_batches SET reference=id WHERE remittance_id IN (${eligible})`,tenancyId,tenancyId,tenancyId),sql(c,`UPDATE tt_hap_remittances SET payer_name='Retained housing authority',reference=id,outcome_reference=CASE WHEN outcome_reference IS NULL THEN NULL ELSE id END WHERE id IN (${eligible})`,tenancyId,tenancyId,tenancyId)]
}
