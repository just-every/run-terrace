// Public enquiries are unverified visitor facts, never contact authority or an applicant identity.
import {audit,email,Fault,guard,id,insist,one,sha256,sql,text,type Context,type Row} from './core'
import {event} from './prospects'
import {refreshListings} from './listings'
import {localDate} from './zones'
const received=()=>({accepted:true,notice:'Enquiry received for staff review. This is an unverified visitor submission.'})
const replayError=()=>new Fault('enquiry_conflict','Reload the current listing and review your enquiry before submitting.',409)
const phoneOf=(value:unknown)=>{
 if(value===undefined||value===null||value==='')return null
 const digits=String(value).replace(/\D/g,'')
 insist(digits.length>=10&&digits.length<=15,'invalid_input','Enter a phone number with at least 10 digits.')
 return digits.length===11&&digits.startsWith('1')?digits.slice(1):digits
}
export async function submitListingEnquiry(c:Context,listingId:string,p:Row){
 const requestId=text(p.requestId,'Enquiry request',100),revisionId=text(p.revisionId,'Listing revision',100)
 insist(/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(requestId),'invalid_input','Reload the enquiry form before submitting.')
 const name=text(p.name,'Name',200),mail=p.email?email(p.email):null,phone=phoneOf(p.phone)
 insist(mail||phone,'invalid_input','Enter an email address or phone number.')
 const states=Object.fromEntries(['email','phone','text'].map(channel=>{
  const state=String(p['consent_'+channel]??'')
  insist(['granted','refused'].includes(state),'invalid_consent','Choose explicitly whether each contact channel is permitted.')
  insist(state!=='granted'||(channel==='email'?mail:phone),'invalid_consent','Provide the contact detail for each permitted channel.')
  return [channel,state]
 }))
 const payloadHash=await sha256(new TextEncoder().encode(JSON.stringify({listingId,revisionId,name,email:mail,phone,consent:states})))
 const existing=await one(c,'SELECT prospect_id,payload_hash,erased_at FROM tt_listing_enquiries WHERE id=?',requestId)
 if(existing){if(existing.prospect_id&&!existing.erased_at&&existing.payload_hash===payloadHash)return received();throw replayError()}
 await refreshListings(c)
 const published=await one(c,'SELECT l.id,l.version,l.unit_id,p.revision_id,r.snapshot,u.version AS unit_version,u.property_id,h.portfolio_id,h.name AS property_name,h.address,h.time_zone FROM tt_listing_publications p JOIN tt_listings l ON l.id=p.listing_id JOIN tt_listing_revisions r ON r.id=p.revision_id JOIN tt_units u ON u.id=l.unit_id JOIN tt_properties h ON h.id=u.property_id WHERE l.id=? AND p.revision_id=?',listingId,revisionId)
 insist(published,'not_found','Listing not found.',404)
 const today=localDate(c.now,published.time_zone),key=id(),reference=`Own-site listing ${listingId} revision ${revisionId}`
 const consent=Object.fromEntries(Object.entries(states).map(([channel,state])=>[channel,{state,at:c.now,source:reference,verification:'unverified visitor submission'}]))
 const duplicate="SELECT id FROM tt_prospects WHERE portfolio_id=? AND merged_into IS NULL AND stage NOT IN ('leased','lost') AND ((? IS NOT NULL AND email=?) OR (? IS NOT NULL AND phone=?)) ORDER BY created_at,id LIMIT 1"
 try{
  await c.db.batch([
   guard(c,'EXISTS(SELECT 1 FROM tt_listing_publications p JOIN tt_listings l ON l.id=p.listing_id JOIN tt_units u ON u.id=l.unit_id JOIN tt_properties h ON h.id=u.property_id WHERE l.id=? AND l.version=? AND p.revision_id=? AND u.version=? AND u.rentable=1 AND h.id=? AND h.name=? AND h.address=? AND h.time_zone=? AND NOT EXISTS(SELECT 1 FROM tt_tenancies t WHERE t.unit_id=u.id AND COALESCE(t.ended_on,t.end_date)>=?))',listingId,published.version,revisionId,published.unit_version,published.property_id,published.property_name,published.address,published.time_zone,today),
   sql(c,`INSERT INTO tt_prospects(id,property_id,portfolio_id,name,email,phone,first_source,first_reference,preferences,consent,review,duplicate_of,created_by,created_at,last_activity_at)
    VALUES(?,?,?,?,?,?,'own_site',?,?,?,CASE WHEN EXISTS(${duplicate}) THEN 'possible_duplicate' ELSE 'clear' END,(${duplicate}),'visitor:own-site',?,?)`,key,published.property_id,published.portfolio_id,name,mail,phone,reference,JSON.stringify({bedrooms:null,occupants:null,moveIn:null,budgetCents:null,pets:null,notes:null}),JSON.stringify(consent),published.portfolio_id,mail,mail,phone,phone,published.portfolio_id,mail,mail,phone,phone,c.now,c.now),
   event(c,key,'enquiry',{source:'own_site',propertyId:published.property_id,listingId,revisionId,verification:'unverified visitor submission'},reference,'unverified visitor submission; not an authenticated applicant'),
   sql(c,"INSERT INTO tt_prospect_events(id,prospect_id,kind,detail,reference,label,recorded_by,recorded_at) SELECT ?,id,'duplicate_held',json_object('duplicateOf',duplicate_of),?,'held for a person to review; not merged','visitor:own-site',? FROM tt_prospects WHERE id=? AND duplicate_of IS NOT NULL",id(),reference,c.now,key),
   sql(c,'INSERT INTO tt_listing_enquiries(id,listing_id,revision_id,prospect_id,payload_hash,created_at) VALUES(?,?,?,?,?,?)',requestId,listingId,revisionId,key,payloadHash,c.now),
   audit(c,'listing.enquiry',key),
  ])
 }catch(error){
  const won=await one(c,'SELECT prospect_id,payload_hash,erased_at FROM tt_listing_enquiries WHERE id=?',requestId)
  if(won?.prospect_id&&!won.erased_at&&won.payload_hash===payloadHash)return received()
  if(String(error).includes('constraint')||String(error).includes('UNIQUE'))throw replayError()
  throw error
 }
 return received()
}
