import {all,commit,date,guard,id,insist,one,recordRead,sha256,sql,tenancy,tenancyGuard,text,type Context,type Row} from './core'
import {canonicalJson} from '../modules/import-kit/src/d1/index.ts'
import {statement} from './ledger'
import {journalProperty} from './journal'
import {noCredential} from './credentials'

export const SHADOW_COMMANDS=['shadow.capture','shadow.action','shadow.review']
export const SHADOW_FIELDS=['openingCents','chargesCents','receiptsCents','reductionsCents','closingCents'] as const
const NOTICE='Documentary comparison only. No cutover, collection, mandate, schedule or payout is authorized. Owner-entered source values are not independently authenticated incumbent evidence.'
const digest=(s:string)=>sha256(new TextEncoder().encode(s))
function owner(c:Context){noCredential(c,'use shadow rent evidence');insist(c.actor.role==='owner','forbidden','Only the installation owner can compare shadow rent.',403)}
function mapped(value:unknown){
 if(typeof value==='string')try{value=JSON.parse(value)}catch{insist(false,'shadow_rows','Source rows must be a JSON array.')}
 insist(Array.isArray(value)&&value.length>0&&value.length<=2000,'shadow_rows','Supply up to 2000 explicitly transcribed source rows.')
 return value.map((r:Row)=>{
  insist(r&&typeof r==='object','shadow_rows','Each source row must be an object.')
  const out:Row={sourceRef:text(r.sourceRef,'Original source row reference',200),tenancyId:r.tenancyId?text(r.tenancyId,'Mapped lease',100):null,currency:text(r.currency,'Source currency',20)}
  insist(/^[A-Z]{3}$/.test(out.currency),'shadow_currency','Use the source row currency code; currencies are never converted.')
  for(const k of SHADOW_FIELDS){insist(Number.isSafeInteger(r[k])&&Math.abs(r[k])<=100_000_000&&(['openingCents','closingCents'].includes(k)||r[k]>=0),'shadow_cents','Source values must be exact integer cents. Charges, receipts and reductions cannot be negative.');out[k]=r[k]}
  return out
 })
}
async function native(c:Context,propertyId:string,from:string,to:string){
 const p=await journalProperty(c,propertyId),leases:Row[]=[],subjects:Row[]=[]
 for(const t of await all(c,'SELECT t.* FROM tt_tenancies t JOIN tt_units u ON u.id=t.unit_id WHERE u.property_id=? AND t.erased_at IS NULL AND t.custody_retired_at IS NULL ORDER BY t.id',p.id)){
  subjects.push(t)
  const s=await statement(c,t.id,from,to)
  if(t.start_date>to||((t.ended_on??t.end_date)<from&&!s.openingCents&&!s.events.length))continue
  leases.push({tenancyId:t.id,household:t.tenant_name,address:t.address,currency:s.currency,timeZone:s.timeZone,startsAt:s.startsAt,endsBefore:s.endsBefore,openingCents:s.openingCents,chargesCents:s.events.reduce((n,e)=>n+e.chargeCents,0),receiptsCents:s.events.reduce((n,e)=>n+e.receiptCents,0),reductionsCents:s.events.reduce((n,e)=>n+e.adjustmentCents,0),closingCents:s.closingCents,events:s.events})
 }
 return{snapshot:{propertyId:p.id,property:p.name,timeZone:p.time_zone,from,to,leases},subjects}
}
function comparison(rows:Row[],snapshot:Row){
 const issues:Row[]=[],add=(key:string,message:string)=>issues.push({key,message}),leases:Row[]=snapshot.leases
 const lines=rows.map((r,i)=>{
  const n=leases.find(x=>x.tenancyId===r.tenancyId),prefix='row:'+i
  if(!r.tenancyId)add(prefix+':unmapped','Source row '+r.sourceRef+' has no mapped native lease.')
  else if(!n)add(prefix+':missing','Source row '+r.sourceRef+' has no native statement in this property and period.')
  if(rows.filter(x=>x.sourceRef===r.sourceRef).length>1)add(prefix+':duplicate-source','Source row reference '+r.sourceRef+' occurs more than once.')
  if(r.tenancyId&&rows.filter(x=>x.tenancyId===r.tenancyId).length>1)add(prefix+':duplicate-lease','More than one source row maps to the same native lease: '+r.sourceRef+'.')
  if(n&&r.currency!==n.currency)add(prefix+':currency','Source and native currencies differ or native currency is unconfirmed. No conversion or netting is allowed.')
  if(r.closingCents!==r.openingCents+r.chargesCents-r.receiptsCents-r.reductionsCents)add(prefix+':arithmetic','Source row '+r.sourceRef+' does not explain its closing receivable.')
  const differences:Row={}
  for(const k of SHADOW_FIELDS){differences[k]=n&&n.currency===r.currency?n[k]-r[k]:null;if(differences[k]!==null&&differences[k]!==0)add(prefix+':'+k,r.sourceRef+' '+k+': native minus source differs by '+differences[k]+' exact cents.')}
  return{source:r,native:n??null,differences}
 })
 for(const n of leases)if(!rows.some(r=>r.tenancyId===n.tenancyId))add('lease:'+n.tenancyId,'Missing source row for '+n.household+' at '+n.address+'.')
 return{lines,issues,matched:issues.length===0}
}
async function run(c:Context,value:unknown){
 owner(c)
 const r=await one(c,'SELECT * FROM tt_shadow_runs WHERE id=?',text(value,'Comparison',100))
 insist(r,'not_found','Comparison not found.',404)
 for(const s of await all(c,'SELECT tenancy_id FROM tt_shadow_subjects WHERE run_id=?',r.id)){const t=await tenancy(c,s.tenancy_id);insist(!t.custody_retired_at,'not_found','Comparison custody retired.',404)}
 return r
}
async function view(c:Context,r:Row){
 const snapshot=JSON.parse(r.snapshot),rows=JSON.parse(r.mapped_rows),report=comparison(rows,snapshot),latest=(await one(c,'SELECT MAX(revision) AS n FROM tt_shadow_runs WHERE series_id=?',r.series_id))!.n
 const live=await native(c,r.property_id,r.from_day,r.to_day),sourceCurrent=latest===r.revision,nativeCurrent=canonicalJson(live.snapshot)===r.snapshot,inert=r.installation!==await digest(c.secret??'')
 const actions=await all(c,'SELECT a.* FROM tt_shadow_actions a WHERE run_id=? AND rowid=(SELECT MAX(b.rowid) FROM tt_shadow_actions b WHERE b.run_id=a.run_id AND b.issue_key=a.issue_key) ORDER BY issue_key',r.id)
 const review=await one(c,'SELECT * FROM tt_shadow_reviews WHERE run_id=?',r.id),actionsCurrent=!review||canonicalJson(actions)===review.actions_snapshot
 const current=sourceCurrent&&nativeCurrent&&!inert&&actionsCurrent
 return{id:r.id,seriesId:r.series_id,revision:r.revision,propertyId:r.property_id,from:r.from_day,to:r.to_day,sourceName:r.source_name,sourceReference:r.source_reference,sourceSha256:r.sha256,synthetic:!!r.synthetic,recordedAt:r.recorded_at,fingerprint:r.fingerprint,snapshot,...report,actions,review,sourceCurrent,nativeCurrent,inert,current,status:!sourceCurrent?'source_replaced':!nativeCurrent?'native_changed':inert?'restored_evidence':!actionsCurrent?'actions_changed':review?(report.matched?'reviewed_match':'reviewed_held'):'needs_review',notice:NOTICE}
}
export async function shadowData(c:Context){
 owner(c)
 const runs=[]
 for(const r of await all(c,'SELECT * FROM tt_shadow_runs ORDER BY recorded_at DESC,series_id,revision DESC')){
  if(await one(c,'SELECT 1 FROM tt_shadow_subjects s JOIN tt_tenancies t ON t.id=s.tenancy_id WHERE s.run_id=? AND (t.erased_at IS NOT NULL OR t.custody_retired_at IS NOT NULL)',r.id))continue
  runs.push(await view(c,r))
 }
 const properties=await all(c,'SELECT id,name,time_zone FROM tt_properties ORDER BY name'),tenancies=await all(c,'SELECT t.id,t.tenant_name,u.property_id FROM tt_tenancies t JOIN tt_units u ON u.id=t.unit_id WHERE t.erased_at IS NULL AND t.custody_retired_at IS NULL ORDER BY t.tenant_name'),people=await all(c,"SELECT id,display_name FROM oa_operators WHERE status='active' AND role='owner' ORDER BY display_name")
 return{runs,properties,tenancies,people,notice:NOTICE}
}
export async function shadowCommand(c:Context,command:string,p:Row):Promise<Row|undefined>{
 if(!SHADOW_COMMANDS.includes(command))return
 owner(c)
 if(command==='shadow.capture'){
  const propertyId=text(p.propertyId,'Property',100),from=date(p.from,'Period start'),to=date(p.to,'Period end')
  insist(to>=from,'period','Period end must follow its start.')
  const {snapshot,subjects}=await native(c,propertyId,from,to),rows=mapped(p.rows),key=id()
  const valid=new Set(subjects.map(t=>t.id))
  insist(rows.every(r=>!r.tenancyId||valid.has(r.tenancyId)),'shadow_mapping','Every mapped lease must belong to this property and have current custody.',404)
  insist(subjects.length,'shadow_property','Choose a property with native leases.')
  const file=p.file
  insist(file instanceof File&&file.size>0&&file.size<=5*1024*1024,'shadow_file','Choose the source-statement original, up to 5 MB.')
  const bytes=new Uint8Array(await file.arrayBuffer()),hash=await sha256(bytes),reference=text(p.reference,'Source statement reference',500)
  insist(!await one(c,'SELECT 1 FROM tt_erased_document_files WHERE sha256=?',hash),'erased_original','This original was erased and cannot be recaptured.',409)
  const existing=await one(c,'SELECT id FROM tt_shadow_runs WHERE property_id=? AND from_day=? AND to_day=? LIMIT 1',propertyId,from,to)
  insist(!existing||p.replacesId,'shadow_revision','Select the latest comparison to revise this property and period; previous reviews remain retained.',409)
  const previous=p.replacesId?await run(c,p.replacesId):null
  if(previous)insist(previous.property_id===propertyId&&previous.from_day===from&&previous.to_day===to,'shadow_period','A source revision must retain the exact property and period.',409)
  const series=previous?.series_id??key,revision=previous?previous.revision+1:1
  if(previous)insist((await one(c,'SELECT MAX(revision) AS n FROM tt_shadow_runs WHERE series_id=?',series))!.n===previous.revision,'source_changed','Revise the latest source capture.',409)
  const fingerprint=await digest(canonicalJson({hash,rows,snapshot,reference,synthetic:p.synthetic==='yes'}))
  await commit(c,[...subjects.map(t=>tenancyGuard(c,t)),sql(c,'INSERT INTO tt_shadow_runs(id,series_id,revision,property_id,from_day,to_day,source_name,media_type,original,sha256,source_reference,synthetic,mapped_rows,snapshot,fingerprint,installation,recorded_by,recorded_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',key,series,revision,propertyId,from,to,text(file.name,'Original filename',200),file.type||'application/octet-stream',bytes,hash,reference,p.synthetic==='yes'?1:0,canonicalJson(rows),canonicalJson(snapshot),fingerprint,await digest(c.secret??''),c.actor.id,c.now),...subjects.map(t=>sql(c,'INSERT INTO tt_shadow_subjects(run_id,tenancy_id) VALUES(?,?)',key,t.id))],command,key)
  return{id:key,tab:'shadow',notice:'Source bytes, explicit mappings and native statement events captured. '+NOTICE}
 }
 const r=await run(c,p.runId),v=await view(c,r)
 insist(!v.inert,'restore_hold','Restored comparisons are evidence only. Capture a new comparison before any review or follow-up.',409)
 insist(v.sourceCurrent&&v.nativeCurrent,'shadow_stale','Source or native statement events changed. Capture a new comparison; prior evidence remains retained.',409)
 const writes=(await all(c,'SELECT t.* FROM tt_tenancies t JOIN tt_shadow_subjects s ON s.tenancy_id=t.id WHERE s.run_id=?',r.id)).map(t=>tenancyGuard(c,t))
 writes.push(guard(c,'(SELECT MAX(revision) FROM tt_shadow_runs WHERE series_id=?)=?',r.series_id,r.revision))
 if(command==='shadow.action'){
  const issueKey=text(p.issueKey,'Difference or mapping issue',200)
  insist(v.issues.some(i=>i.key===issueKey),'shadow_issue','Choose an open difference or mapping issue.')
  const responsible=await one(c,"SELECT id,display_name FROM oa_operators WHERE id=? AND role='owner' AND status='active'",text(p.responsibleId,'Responsible owner',100))
  insist(responsible,'shadow_responsible','Choose the current installation owner.',403)
  await commit(c,[...writes,sql(c,'INSERT INTO tt_shadow_actions(id,run_id,issue_key,responsible_id,responsible_name,due_on,next_action,recorded_by,recorded_at) VALUES(?,?,?,?,?,?,?,?,?)',id(),r.id,issueKey,responsible.id,responsible.display_name,date(p.dueOn,'Next action due'),text(p.nextAction,'Accountable next action',1000),c.actor.id,c.now)],command,r.id)
  return{id:r.id,tab:'shadow',notice:'Next action recorded. The difference remains held; an earlier review requires a new comparison.'}
 }
 insist(p.fingerprint===r.fingerprint,'review_changed','Review the exact captured source, mappings and native comparison.',409)
 insist(p.consent==='RECORD ONLY','record_only','Type RECORD ONLY. This review grants no cutover or collection authority.')
 insist(v.issues.every(i=>v.actions.some(a=>a.issue_key===i.key)),'shadow_unassigned','Assign a responsible owner, due date and next action to every difference or missing mapping.',409)
 insist(!v.review,'already_reviewed','This exact comparison already has its retained review. Capture a separate comparison for another review.',409)
 await commit(c,[...writes,sql(c,'INSERT INTO tt_shadow_reviews(id,run_id,fingerprint,actions_snapshot,result,reference,reviewed_by,reviewed_at) VALUES(?,?,?,?,?,?,?,?)',id(),r.id,r.fingerprint,canonicalJson(v.actions),v.matched?'matched':'held',text(p.reference,'Review reference',500),c.actor.id,c.now)],command,r.id)
 return{id:r.id,tab:'shadow',notice:v.matched?'Exact documentary match reviewed. '+NOTICE:'Differences remain held with accountable next actions. '+NOTICE}
}
export async function shadowOriginal(c:Context,value:unknown){
 const r=await run(c,value);await recordRead(c,'export:shadow-original',r.id)
 return new Response(new Uint8Array(r.original),{headers:{'content-type':'application/octet-stream','content-disposition':'attachment; filename="'+r.source_name.replace(/[^a-zA-Z0-9._-]/g,'_')+'"','cache-control':'private, no-store','x-content-type-options':'nosniff','x-source-sha256':r.sha256,'content-security-policy':"default-src 'none'; sandbox"}})
}
