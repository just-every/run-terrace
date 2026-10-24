import {all,commit,guard,id,insist,one,sql,text,type Context,type Row} from './core'
export const REPORT_CUSTODY_COMMANDS=['report.delivery.hold','report.delivery.release','report.delivery.delete']
const clear="NOT EXISTS(SELECT 1 FROM tt_report_delivery_holds WHERE delivery_id=? AND released_at IS NULL) AND NOT EXISTS(SELECT 1 FROM tt_legal_holds h JOIN tt_tenancies t ON t.id=h.tenancy_id JOIN tt_units u ON u.id=t.unit_id WHERE u.property_id=? AND h.released_at IS NULL AND h.class IN ('accounting','all'))"
export async function reportCustody(c:Context,name:string,p:Row,d:Row){
 if(!REPORT_CUSTODY_COMMANDS.includes(name))return
 insist(!d.deleted_at,'report_deleted','This snapshot was deleted.',409)
 const reference=text(p.reference,'Custody reference',500),version=guard(c,'EXISTS(SELECT 1 FROM tt_report_deliveries WHERE id=? AND version=? AND deleted_at IS NULL)',d.id,d.version)
 let notice=''
 const changes=[]
 if(name==='report.delivery.hold'){
  insist(['legal','accountant'].includes(p.kind),'hold_kind','Choose a legal or accountant hold.')
  changes.push(sql(c,'INSERT INTO tt_report_delivery_holds(id,delivery_id,kind,reference,placed_by,placed_at) VALUES(?,?,?,?,?,?)',id(),d.id,p.kind,reference,c.actor.id,c.now));notice='Snapshot hold placed. Deletion is blocked until released.'
 }else if(name==='report.delivery.release'){
  const h=await one(c,'SELECT id FROM tt_report_delivery_holds WHERE id=? AND delivery_id=? AND released_at IS NULL',text(p.holdId,'Hold',100),d.id)
  insist(h,'not_found','Active hold not found.',404)
  changes.push(sql(c,'UPDATE tt_report_delivery_holds SET released_by=?,released_at=?,release_reference=? WHERE id=?',c.actor.id,c.now,reference,h.id));notice='Snapshot hold released. Other active holds still block deletion.'
 }else{
  insist(p.consent==='DELETE SNAPSHOT','consent_required','Confirm DELETE SNAPSHOT.')
  insist(await one(c,'SELECT 1 AS ok WHERE '+clear,d.id,d.property_id),'snapshot_held','Release every legal and accountant hold before deleting this statement.',409)
  changes.push(guard(c,clear,d.id,d.property_id),sql(c,"UPDATE tt_report_deliveries SET snapshot='',deleted_at=?,state='deleted',next_action='Snapshot deleted by the installation owner; this delivery cannot be sent again' WHERE id=?",c.now,d.id));notice='Snapshot deleted. The audit and send identity remain; the report link is unavailable.'
 }
 await commit(c,[version,...changes,sql(c,'UPDATE tt_report_deliveries SET version=version+1 WHERE id=?',d.id),sql(c,'INSERT INTO tt_report_delivery_events(id,delivery_id,kind,reference,actor,at) VALUES(?,?,?,?,?,?)',id(),d.id,name,reference,c.actor.id,c.now)],name,d.id)
 return{tab:'report-schedules',notice}
}
export async function deliveryHolds(c:Context){return all(c,'SELECT * FROM tt_report_delivery_holds ORDER BY placed_at,id')}
