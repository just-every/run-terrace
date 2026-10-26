/** PAY-013: documentary external receipts; no provider call or bank verification. */
import { all, allow, cents, commit, date, guard, id, insist, one, reaches, shown, sql, tenancy, tenancyGuard, text, type Context, type Row } from './core'
import { localDate } from './zones'
export { hapRemittanceErasureStatements, hapRemittanceSharedHolds, hapRemittanceRetentionDay } from './hap-remittance-retention'

export const HAP_REMITTANCE_COMMANDS = ['hap.remittance.record','hap.remittance.outcome','hap.remittance.allocate']
/** Correlated to a HAP charge named q. Pending allocations only reserve capacity. */
export const HAP_RECEIVED = `COALESCE((SELECT SUM(a.amount_cents) FROM tt_hap_allocations a JOIN tt_hap_remittances r ON r.id=a.remittance_id WHERE a.charge_id=q.id AND r.state='received'),0)`
const committed = `COALESCE((SELECT SUM(a.amount_cents) FROM tt_hap_allocations a JOIN tt_hap_remittances r ON r.id=a.remittance_id WHERE a.charge_id=q.id AND r.state<>'failed'),0)`
const effective = `q.amount_cents+COALESCE((SELECT SUM(e.pha_delta) FROM tt_hap_effects e WHERE e.hap_charge_id=q.id),0)`
const remaining = `${effective}-${committed}`
const versionOf = (p:Row,r:Row) => insist(Number.isSafeInteger(Number(p.version)) && Number(p.version)===r.version,'conflict','Review the current remittance version.',409)

async function linked(c:Context,r:Row) {
 const rows=await all(c,`SELECT DISTINCT t.* FROM tt_tenancies t WHERE t.id=? OR t.id IN (SELECT q.tenancy_id FROM tt_hap_allocations a JOIN tt_hap_charges q ON q.id=a.charge_id WHERE a.remittance_id=?)`,r.source_tenancy_id,r.id)
 insist(rows.length && rows.every(t=>!t.erased_at&&reaches(c,t.unit_id)),'not_found','Remittance not found.',404)
 return rows
}
async function remittance(c:Context,value:unknown) {
 const r=await one(c,'SELECT * FROM tt_hap_remittances WHERE id=?',text(value,'Remittance',100))
 insist(r,'not_found','Remittance not found.',404)
 const tenancies=await linked(c,r);c.tenancyId=r.source_tenancy_id
 return {r,tenancies}
}
const reviewed = (c:Context,r:Row) => guard(c,'EXISTS(SELECT 1 FROM tt_hap_remittances WHERE id=? AND version=? AND state=?)',r.id,r.version,r.state)
const result = async(c:Context,key:string) => {
 const r=await one(c,'SELECT id,version,state,amount_cents-COALESCE((SELECT SUM(amount_cents) FROM tt_hap_allocations WHERE remittance_id=r.id),0) AS heldCents FROM tt_hap_remittances r WHERE id=?',key)
 return {...r,notice:r?.state==='pending'?'External outcome pending. Allocations reserve PHA balances; no cash or settled receipt is recorded.':r?.state==='failed'?'External failure recorded. No cash or settled receipt is recorded.':'Externally received funds recorded. Unmatched funds remain held; this is not bank verification.'}
}

export async function hapRemittanceCommand(c:Context,name:string,p:Row):Promise<Row|undefined> {
 if(!HAP_REMITTANCE_COMMANDS.includes(name))return
 allow(c,'rent.receipt')
 if(name==='hap.remittance.record') {
  const source=text(p.sourceDocumentVersionId,'Stored accounting document version',100)
  const d=await one(c,'SELECT d.tenancy_id,d.kind,d.retention_class,v.id FROM tt_document_versions v JOIN tt_documents d ON d.id=v.document_id WHERE v.id=?',source)
  insist(d,'not_found','Stored accounting document version not found.',404)
  const t=await tenancy(c,d.tenancy_id)
  insist(d.kind==='hap'&&d.retention_class==='accounting','hap_document','Use a native stored PHA accounting document version for the remittance detail.',409)
  insist(!p.tenancyId||p.tenancyId===t.id,'hap_document','The source document belongs to another tenancy.',409)
  const currency=p.currency===undefined?'USD':text(p.currency,'Currency',3)
  insist(currency==='USD'&&shown(t)==='USD','hap_currency','HAP remittances require confirmed USD; currencies are never converted.',409)
  const method=text(p.method,'External receipt method',20)
  insist(['ach','check'].includes(method),'invalid_method','A PHA remittance records an external ACH or check.')
  const state=text(p.state,'External outcome',20)
  insist(['pending','received'].includes(state),'hap_state','Record pending or externally received funds.')
  const received=date(p.receivedDate,'Received date'),payer=text(p.payerName,'Housing authority payer',200),reference=text(p.reference,'Unique external remittance reference',150),amount=cents(p.amount)
  insist(received<=localDate(c.now,t.time_zone),'future_receipt','The external remittance date cannot be later than property-local today.')
  insist(!await one(c,'SELECT 1 FROM tt_hap_remittances WHERE (payer_name=? COLLATE NOCASE AND currency=? AND reference=?) OR source_document_version_id=?',payer,currency,reference,source),'duplicate_remittance','This external reference or source document was already recorded.',409)
  const key=id()
  await commit(c,[tenancyGuard(c,t),guard(c,"EXISTS(SELECT 1 FROM tt_document_versions v JOIN tt_documents d ON d.id=v.document_id WHERE v.id=? AND d.tenancy_id=? AND d.kind='hap' AND d.retention_class='accounting')",source,t.id),guard(c,'NOT EXISTS(SELECT 1 FROM tt_hap_remittances WHERE (payer_name=? COLLATE NOCASE AND currency=? AND reference=?) OR source_document_version_id=?)',payer,currency,reference,source),sql(c,'INSERT INTO tt_hap_remittances(id,source_tenancy_id,source_document_version_id,payer_name,method,currency,amount_cents,received_date,reference,state,outcome_date,outcome_reference,outcome_recorded_at,recorded_by,recorded_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',key,t.id,source,payer,method,currency,amount,received,reference,state,state==='received'?received:null,state==='received'?reference:null,state==='received'?c.now:null,c.actor.id,c.now)],name,key)
  return result(c,key)
 }
 const {r,tenancies}=await remittance(c,p.remittanceId)
 versionOf(p,r)
 const writes:D1PreparedStatement[]=[...tenancies.map(t=>tenancyGuard(c,t)),reviewed(c,r)]
 if(name==='hap.remittance.outcome') {
  insist(r.state==='pending','hap_state','Only pending remittances can receive one external outcome.',409)
  const state=text(p.state,'External outcome',20),on=date(p.on,'Outcome date'),reference=text(p.reference,'External outcome reference',150)
  insist(['received','failed'].includes(state),'hap_state','Record an explicit received or failed external outcome.')
  insist(tenancies.every(t=>on>=r.received_date&&on<=localDate(c.now,t.time_zone)),'invalid_date','Outcome date must be between the remittance date and property-local today for every linked tenancy.')
  writes.push(sql(c,'UPDATE tt_hap_remittances SET state=?,version=version+1,outcome_date=?,outcome_reference=?,outcome_recorded_at=? WHERE id=?',state,on,reference,c.now,r.id))
 } else {
  insist(r.state!=='failed','hap_state','Failed remittances cannot be allocated.',409)
  insist(Array.isArray(p.allocations)&&p.allocations.length>0&&p.allocations.length<=100,'hap_allocations','Name between 1 and 100 explicit charge allocations.')
  const allocations=p.allocations.map((a:Row)=>({chargeId:text(a?.chargeId,'HAP charge',100),amount:cents(a?.amount)}))
  insist(new Set(allocations.map((a:Row)=>a.chargeId)).size===allocations.length,'duplicate_allocation','Name each HAP charge once.',409)
  const reference=text(p.reference,'Unique allocation detail reference',150)
  insist(!await one(c,'SELECT 1 FROM tt_hap_allocation_batches WHERE remittance_id=? AND reference=?',r.id,reference),'duplicate_allocation','This remittance detail was already allocated.',409)
  const used=await one(c,'SELECT COALESCE(SUM(amount_cents),0) AS amount FROM tt_hap_allocations WHERE remittance_id=?',r.id),total=allocations.reduce((n:number,a:Row)=>n+a.amount,0)
  insist(total<=r.amount_cents-used!.amount,'exceeds_remittance','Allocations exceed the remittance held remainder.',409)
  const batch=id()
  writes.push(guard(c,'NOT EXISTS(SELECT 1 FROM tt_hap_allocation_batches WHERE remittance_id=? AND reference=?)',r.id,reference),guard(c,'(SELECT amount_cents FROM tt_hap_remittances WHERE id=?)-COALESCE((SELECT SUM(amount_cents) FROM tt_hap_allocations WHERE remittance_id=?),0)>=?',r.id,r.id,total),sql(c,'INSERT INTO tt_hap_allocation_batches(id,remittance_id,reference,recorded_by,recorded_at) VALUES(?,?,?,?,?)',batch,r.id,reference,c.actor.id,c.now))
  for(const a of allocations) {
   const q=await one(c,`SELECT q.*,${remaining} AS remaining_cents FROM tt_hap_charges q WHERE q.id=?`,a.chargeId)
   insist(q,'not_found','HAP charge not found.',404)
   const t=await tenancy(c,q.tenancy_id)
   insist(q.payer.toLowerCase()===r.payer_name.toLowerCase(),'hap_payer','The allocation must name the same housing authority payer.',409)
   insist(q.currency===r.currency&&shown(t)===r.currency,'hap_currency','The allocation must retain the remittance currency.',409)
   insist(!await one(c,'SELECT 1 FROM tt_hap_allocations WHERE remittance_id=? AND charge_id=?',r.id,q.id),'duplicate_allocation','This remittance already names that HAP charge.',409)
   insist(a.amount<=q.remaining_cents,'exceeds_balance','Amount exceeds the unreserved PHA balance.',409)
   if(r.state==='received')insist(r.outcome_date<=localDate(c.now,t.time_zone),'future_receipt','The receipt date cannot be later than property-local today.')
   writes.push(tenancyGuard(c,t),guard(c,`EXISTS(SELECT 1 FROM tt_hap_charges q WHERE q.id=? AND q.payer=? COLLATE NOCASE AND q.currency=? AND ${remaining}>=?)`,q.id,r.payer_name,r.currency,a.amount),guard(c,'NOT EXISTS(SELECT 1 FROM tt_hap_allocations WHERE remittance_id=? AND charge_id=?)',r.id,q.id),sql(c,'INSERT INTO tt_hap_allocations(id,batch_id,remittance_id,charge_id,amount_cents,recorded_at) VALUES(?,?,?,?,?,?)',id(),batch,r.id,q.id,a.amount,c.now))
  }
  writes.push(sql(c,'UPDATE tt_hap_remittances SET version=version+1 WHERE id=?',r.id))
 }
 await commit(c,writes,name,r.id)
 return result(c,r.id)
}

/** A lump sum's identity and remainder require scope over every linked tenancy. */
export async function hapRemittanceData(c:Context,tenancyId?:string) {
 allow(c,'ledger.read')
 if(tenancyId)await tenancy(c,tenancyId)
 const rows=await all(c,`SELECT r.* FROM tt_hap_remittances r ${tenancyId?'WHERE r.source_tenancy_id=? OR EXISTS(SELECT 1 FROM tt_hap_allocations a JOIN tt_hap_charges q ON q.id=a.charge_id WHERE a.remittance_id=r.id AND q.tenancy_id=?)':''} ORDER BY r.received_date,r.id`,...(tenancyId?[tenancyId,tenancyId]:[])),remittances:Row[]=[]
 for(const r of rows) {
  const ts=await all(c,'SELECT t.id,t.unit_id,t.erased_at FROM tt_tenancies t WHERE t.id=? OR t.id IN (SELECT q.tenancy_id FROM tt_hap_allocations a JOIN tt_hap_charges q ON q.id=a.charge_id WHERE a.remittance_id=?)',r.source_tenancy_id,r.id)
  if(!ts.every(t=>!t.erased_at&&reaches(c,t.unit_id)))continue
  const allocations=await all(c,'SELECT a.*,q.tenancy_id,q.due_date,t.address FROM tt_hap_allocations a JOIN tt_hap_charges q ON q.id=a.charge_id JOIN tt_tenancies t ON t.id=q.tenancy_id WHERE a.remittance_id=? ORDER BY a.recorded_at,a.id',r.id),batches=await all(c,'SELECT * FROM tt_hap_allocation_batches WHERE remittance_id=? ORDER BY recorded_at,id',r.id),held=r.amount_cents-allocations.reduce((n,a)=>n+a.amount_cents,0)
  remittances.push({...r,allocations,batches,held_cents:held,heldCents:held})
 }
 return {remittances}
}

