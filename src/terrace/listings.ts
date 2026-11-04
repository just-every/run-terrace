// LEASE-001: only an installation owner publishes an exact frozen own-site revision.
// Publication and preview authority stay in this installation; history remains portable.
import {all,commit,date,guard,id,insist,one,sha256,sql,text,type Context,type Row} from './core'
import {localDate} from './zones'
import {submitListingEnquiry} from './listing-enquiries'

export const LISTING_COMMANDS=['listing.save','listing.preview','listing.publish','listing.withdraw']
const owner=(c:Context)=>insist(c.actor.role==='owner'&&!c.actor.credential,'forbidden','Only the signed-in installation owner can manage publication.',403)
const hash=(v:unknown)=>sha256(new TextEncoder().encode(JSON.stringify(v)))
const amount=(value:unknown,positive=false)=>{
 const raw=text(String(value??''),'Advertised amount',16)
 insist(/^\d+(\.\d{1,2})?$/.test(raw),'invalid_money','Use exact cents with at most two decimal places; amounts are never rounded.')
 const [whole,fraction='']=raw.split('.'),n=Number(whole)*100+Number(fraction.padEnd(2,'0'))
 insist(Number.isSafeInteger(n)&&n>=(positive?1:0)&&n<=100000000,'invalid_money','Enter an advertised amount from zero to 1,000,000.00; rent must be positive.')
 return n
}

/** The property's local day and recorded occupancy, with no resident or private contact fields. */
async function inventory(c:Context,unitId:string){
 const unit=await one(c,'SELECT u.*,p.name AS property_name,p.address,p.time_zone,p.portfolio_id FROM tt_units u JOIN tt_properties p ON p.id=u.property_id WHERE u.id=?',unitId)
 insist(unit,'not_found','Unit not found.',404)
 const today=localDate(c.now,unit.time_zone)
 const leases=await all(c,'SELECT id,start_date,end_date,ended_on,version FROM tt_tenancies WHERE unit_id=? AND COALESCE(ended_on,end_date)>=? ORDER BY id',unitId,today)
 const available=unit.rentable===1&&leases.length===0
 const source={unitId:unit.id,version:unit.version,propertyId:unit.property_id,property:unit.property_name,address:unit.address,timeZone:unit.time_zone,unit:unit.identifier,bedrooms:unit.bedrooms,bathrooms:unit.bathrooms,amenities:JSON.parse(unit.amenities),rentable:unit.rentable,leases}
 return {unit,today,available,reason:unit.rentable!==1?'Unit is not rentable.':leases.length?'Unit has a current or future lease.':'Vacant with no current or future lease.',source,fingerprint:await hash(source)}
}
const liveGuard=(c:Context,i:Awaited<ReturnType<typeof inventory>>)=>guard(c,"EXISTS(SELECT 1 FROM tt_units u JOIN tt_properties p ON p.id=u.property_id WHERE u.id=? AND u.version=? AND u.rentable=1 AND p.name=? AND p.address=? AND p.time_zone=? AND NOT EXISTS(SELECT 1 FROM tt_tenancies t WHERE t.unit_id=u.id AND COALESCE(t.ended_on,t.end_date)>=?))",i.unit.id,i.unit.version,i.unit.property_name,i.unit.address,i.unit.time_zone,i.today)
const listingGuard=(c:Context,l:Row)=>guard(c,'EXISTS(SELECT 1 FROM tt_listings WHERE id=? AND version=? AND draft_revision_id=?)',l.id,l.version,l.draft_revision_id)
const publicationEvent=(c:Context,l:Row,revisionId:string,kind:string,detail:Row={})=>sql(c,'INSERT INTO tt_listing_events(id,listing_id,revision_id,kind,at,actor,detail) VALUES(?,?,?,?,?,?,?)',id(),l.id,revisionId,kind,c.now,c.actor.id,JSON.stringify(detail))
async function listing(c:Context,value:unknown){
 const row=await one(c,'SELECT * FROM tt_listings WHERE id=?',text(value,'Listing',100))
 insist(row,'not_found','Listing not found.',404);return row
}
async function revision(c:Context,revisionId:string):Promise<Row>{
 const r=await one(c,'SELECT * FROM tt_listing_revisions WHERE id=?',revisionId)
 insist(r,'not_found','Listing revision not found.',404);return {...r,snapshot:JSON.parse(r.snapshot)}
}

/** Live reads suppress changed or unavailable inventory exactly once, without publishing anything. */
export async function refreshListings(c:Context){
 for(const p of await all(c,'SELECT p.*,l.unit_id,r.source_fingerprint FROM tt_listing_publications p JOIN tt_listings l ON l.id=p.listing_id JOIN tt_listing_revisions r ON r.id=p.revision_id')){
  const current=await inventory(c,p.unit_id)
  if(current.available&&current.fingerprint===p.source_fingerprint)continue
  await c.db.batch([
   sql(c,"INSERT INTO tt_listing_events(id,listing_id,revision_id,kind,at,actor,detail) SELECT ?,listing_id,revision_id,'unavailable',?,'inventory',? FROM tt_listing_publications WHERE listing_id=? AND revision_id=?",id(),c.now,JSON.stringify({reason:'Inventory or property source changed; owner preview and publication required.'}),p.listing_id,p.revision_id),
   sql(c,'UPDATE tt_listings SET version=version+1 WHERE id=? AND EXISTS(SELECT 1 FROM tt_listing_publications WHERE listing_id=? AND revision_id=?)',p.listing_id,p.listing_id,p.revision_id),
   sql(c,'DELETE FROM tt_listing_previews WHERE listing_id=? AND EXISTS(SELECT 1 FROM tt_listing_publications WHERE listing_id=? AND revision_id=?)',p.listing_id,p.listing_id,p.revision_id),
   sql(c,'DELETE FROM tt_listing_publications WHERE listing_id=? AND revision_id=?',p.listing_id,p.revision_id),
  ])
 }
}

export async function listingCommand(c:Context,command:string,p:Row):Promise<Row|undefined>{
 if(!LISTING_COMMANDS.includes(command))return
 owner(c)
 if(command==='listing.save'){
  const existing=p.listingId?await listing(c,p.listingId):await one(c,'SELECT * FROM tt_listings WHERE unit_id=?',text(p.unitId,'Unit',100))
  const unitId=existing?.unit_id??text(p.unitId,'Unit',100),current=await inventory(c,unitId)
  if(existing)insist(Number(p.version)===existing.version,'conflict','Reload the current listing before saving a new revision.',409)
  const key=existing?.id??id(),revisionId=id(),sequence=existing?Number((await one(c,'SELECT MAX(sequence) AS n FROM tt_listing_revisions WHERE listing_id=?',key))?.n??0)+1:1
  const availableOn=date(p.availableOn,'Advertised available date')
  insist(availableOn>=current.today,'invalid_date','Advertised availability must be today or a future property-local day.')
  const {source}=current
  const snapshot={title:text(p.title,'Listing title',150),description:text(p.description,'Listing description',5000),rentCents:amount(p.rent,true),feesCents:amount(p.fees),depositCents:amount(p.deposit),currency:'USD',availableOn,propertyId:source.propertyId,property:source.property,address:source.address,unitId:source.unitId,unit:source.unit,identifier:source.unit,bedrooms:source.bedrooms,bathrooms:source.bathrooms,amenities:source.amenities}
  const statements=existing?[listingGuard(c,existing),sql(c,'UPDATE tt_listings SET version=version+1,draft_revision_id=? WHERE id=?',revisionId,key)]:[sql(c,'INSERT INTO tt_listings(id,unit_id,draft_revision_id,created_at) VALUES(?,?,?,?)',key,unitId,revisionId,c.now)]
  await commit(c,[...statements,sql(c,'INSERT INTO tt_listing_revisions(id,listing_id,sequence,snapshot,source_fingerprint,created_by,created_at) VALUES(?,?,?,?,?,?,?)',revisionId,key,sequence,JSON.stringify(snapshot),current.fingerprint,c.actor.id,c.now),sql(c,'DELETE FROM tt_listing_previews WHERE listing_id=?',key)],command,key)
  return {id:key,listingId:key,revisionId,version:(existing?.version??0)+1,tab:'listings',notice:'Frozen listing revision saved. Preview this exact revision before publication.'}
 }
 const l=await listing(c,p.listingId)
 insist(Number(p.version)===l.version,'conflict','Reload the current listing.',409)
 const r=await revision(c,l.draft_revision_id),current=await inventory(c,l.unit_id)
 if(command==='listing.withdraw'){
  const publication=await one(c,'SELECT * FROM tt_listing_publications WHERE listing_id=?',l.id)
  insist(publication,'listing_state','This listing is not published.',409)
  await commit(c,[listingGuard(c,l),publicationEvent(c,l,publication.revision_id,'withdrawn',{reason:'Owner withdrew the own-site publication.'}),sql(c,'DELETE FROM tt_listing_publications WHERE listing_id=?',l.id),sql(c,'DELETE FROM tt_listing_previews WHERE listing_id=?',l.id),sql(c,'UPDATE tt_listings SET version=version+1 WHERE id=?',l.id)],command,l.id)
  return {id:l.id,version:l.version+1,tab:'listings',notice:'Own-site listing withdrawn. Its publication history remains.'}
 }
 insist(current.available,'unit_unavailable',current.reason,409)
 insist(current.fingerprint===r.source_fingerprint,'stale_listing','The unit or property changed. Save a new revision and preview it.',409)
 const fingerprint=await hash({listingId:l.id,version:l.version,revisionId:r.id,source:current.fingerprint,owner:c.actor.id})
 if(command==='listing.preview'){
  await commit(c,[listingGuard(c,l),liveGuard(c,current),sql(c,'INSERT INTO tt_listing_previews(listing_id,revision_id,version,fingerprint,owner_id,created_at) VALUES(?,?,?,?,?,?) ON CONFLICT(listing_id) DO UPDATE SET revision_id=excluded.revision_id,version=excluded.version,fingerprint=excluded.fingerprint,owner_id=excluded.owner_id,created_at=excluded.created_at',l.id,r.id,l.version,fingerprint,c.actor.id,c.now)],command,l.id)
  return {id:l.id,listingId:l.id,version:l.version,revisionId:r.id,fingerprint,listing:r.snapshot,tab:'listings',notice:'Preview ready. Publishing requires this exact revision and advertised amounts.'}
 }
 insist(p.confirm==='PUBLISH','confirmation','Confirm PUBLISH to publish the exact preview.')
 insist(p.revisionId===r.id&&p.fingerprint===fingerprint,'stale_preview','Preview the current revision before publishing.',409)
 const publication=await one(c,'SELECT * FROM tt_listing_publications WHERE listing_id=?',l.id)
 insist(publication?.revision_id!==r.id,'listing_state','This exact revision is already published.',409)
 await commit(c,[listingGuard(c,l),liveGuard(c,current),guard(c,'EXISTS(SELECT 1 FROM tt_listing_previews WHERE listing_id=? AND revision_id=? AND version=? AND fingerprint=? AND owner_id=?)',l.id,r.id,l.version,fingerprint,c.actor.id),publicationEvent(c,l,r.id,publication?'changed':'published',{channel:'own_site',previousRevisionId:publication?.revision_id??null}),sql(c,'INSERT INTO tt_listing_publications(listing_id,revision_id,published_at) VALUES(?,?,?) ON CONFLICT(listing_id) DO UPDATE SET revision_id=excluded.revision_id,published_at=excluded.published_at',l.id,r.id,c.now),sql(c,'DELETE FROM tt_listing_previews WHERE listing_id=?',l.id),sql(c,'UPDATE tt_listings SET version=version+1 WHERE id=?',l.id)],command,l.id)
 return {id:l.id,listingId:l.id,revisionId:r.id,version:l.version+1,tab:'listings',notice:'Exact own-site listing published. Partner channels remain unconfigured.'}
}

export async function listingData(c:Context){
 owner(c);await refreshListings(c)
 const units=[]
 for(const u of await all(c,'SELECT u.id,u.identifier,p.name AS property_name FROM tt_units u JOIN tt_properties p ON p.id=u.property_id ORDER BY p.name,u.identifier')){
  const current=await inventory(c,u.id);units.push({...u,available:current.available,availabilityReason:current.reason})
 }
 const listings=[]
 for(const l of await all(c,'SELECT * FROM tt_listings ORDER BY created_at,id')){
  const draft=await revision(c,l.draft_revision_id),p=await one(c,'SELECT * FROM tt_listing_publications WHERE listing_id=?',l.id),preview=await one(c,'SELECT * FROM tt_listing_previews WHERE listing_id=?',l.id),current=await inventory(c,l.unit_id)
  const published=p?await revision(c,p.revision_id):null
  const revisions=(await all(c,'SELECT id,sequence,snapshot,created_at FROM tt_listing_revisions WHERE listing_id=? ORDER BY sequence',l.id)).map(row=>({...row,snapshot:JSON.parse(row.snapshot)}))
  listings.push({...l,revisions,draft:{...draft.snapshot,revisionId:draft.id,sequence:draft.sequence},published:published?{...published.snapshot,revisionId:published.id,publishedAt:p!.published_at}:null,preview:preview&&preview.version===l.version&&draft.source_fingerprint===current.fingerprint?{fingerprint:preview.fingerprint,revisionId:preview.revision_id,version:preview.version,listing:draft.snapshot}:null,available:current.available,availabilityReason:current.reason,stale:draft.source_fingerprint!==current.fingerprint,events:await all(c,'SELECT kind,revision_id,at,detail FROM tt_listing_events WHERE listing_id=? ORDER BY at,rowid',l.id)})
 }
 return {listings,units,partners:'Zillow and Apartments.com are unconfigured; no submission, synchronization or provider acknowledgement is established.'}
}

export async function publicListings(c:Context,listingId?:string){
 await refreshListings(c)
 const listings=[]
 const rows=await all(c,'SELECT l.id,p.revision_id,p.published_at,r.snapshot FROM tt_listing_publications p JOIN tt_listings l ON l.id=p.listing_id JOIN tt_listing_revisions r ON r.id=p.revision_id'+(listingId?' WHERE l.id=?':''),...(listingId?[listingId]:[]))
 for(const row of rows)listings.push({...JSON.parse(row.snapshot),id:row.id,revisionId:row.revision_id,publishedAt:row.published_at})
 if(listingId)insist(listings.length,'not_found','Listing not found.',404)
 return {listings}
}
export const submitEnquiry=submitListingEnquiry
