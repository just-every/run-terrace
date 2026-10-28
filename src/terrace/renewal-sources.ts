// Owner-selected native references are evidence, never instructions or execution authority.
import {all,guard,insist,one,reaches,sha256,text,type Context,type Row} from './core'
import {mayRead} from './documents'
import {redactSensitive} from './sensitive-metadata'

export const SOURCE_PURPOSES=['condition','communication','cash'] as const
export const SOURCE_REVIEW='Owner selects current authorized document versions in a new workload and reviews a new offer; no automatic replacement'
export const sourceInstallation=(c:Context)=>sha256(new TextEncoder().encode(JSON.stringify(c.secret)))
const portfolio=(c:Context,t:Row)=>one(c,'SELECT p.portfolio_id FROM tt_units u JOIN tt_properties p ON p.id=u.property_id WHERE u.id=?',t.unit_id??'')

/** Load the assigned credential's present document rights without retaining or using its token. */
export async function sourceReader(c:Context,key:string):Promise<Context|null>{
 const k=await one(c,'SELECT * FROM tt_api_credentials WHERE id=? AND revoked_at IS NULL',key)
 if(!k)return null
 const actions=await all(c,'SELECT action FROM tt_role_actions WHERE role=?',k.role)
 const units=await all(c,'SELECT u.id FROM tt_units u JOIN tt_properties p ON p.id=u.property_id JOIN tt_api_credential_portfolios a ON a.portfolio_id=p.portfolio_id WHERE a.credential_id=?',k.id)
 return {...c,actor:{id:k.id,role:'member',displayName:k.label,version:k.version,credential:{scope:k.scope,label:k.label},staff:{role:k.role,all:!!k.all_portfolios,version:k.version,actions:actions.map(a=>a.action),portfolios:[],units:new Set(units.map(u=>u.id))}}}
}

async function currentSource(c:Context,t:Row,pin:Row){
 // Select metadata only: neither bytes nor indexed document text enter renewal preparation.
 const v=await one(c,'SELECT d.id AS document_id,d.tenancy_id,d.kind,d.referral_original,d.restriction,d.version AS current_version,v.id AS version_id,v.version,v.sha256,d.title,t.unit_id FROM tt_documents d JOIN tt_document_versions v ON v.document_id=d.id AND v.version=d.version JOIN tt_tenancies t ON t.id=d.tenancy_id WHERE d.id=? AND t.erased_at IS NULL',pin.documentId)
 if(!v||!mayRead(c,v.kind,v.referral_original)||!reaches(c,v.unit_id))return null
 const a=await portfolio(c,t),b=await portfolio(c,v)
 return v.tenancy_id===t.id||a&&b&&a.portfolio_id===b.portfolio_id?v:null
}

/** The owner supplies exact current version IDs and hashes through the command door. */
export async function pinRenewalSources(c:Context,t:Row,input:unknown,reader?:Context|null){
 insist(c.actor.role==='owner'&&!c.actor.credential,'forbidden','Only the owner selects renewal document evidence.',403)
 const values=input as Row
 insist(values&&typeof values==='object'&&!Array.isArray(values)&&Object.keys(values).length===3&&SOURCE_PURPOSES.every(p=>values[p]),'renewal_sources','Select condition, communication and cash document versions.')
 const pins:Row={}
 for(const purpose of SOURCE_PURPOSES){
  const selected=values[purpose],versionId=text(selected?.versionId,'Document version',100),digest=text(selected?.sha256,'Document hash',64)
  const v=await one(c,'SELECT document_id FROM tt_document_versions WHERE id=?',versionId)
  insist(v,'not_found','Renewal source not found.',404)
  const pin={documentId:v.document_id,versionId,sha256:digest},live=await currentSource(c,t,pin),permitted=reader===undefined?live:reader&&await currentSource(reader,t,pin)
  insist(live&&permitted,'not_found','Renewal source not found in the authorized portfolio and document kinds.',404)
  insist(live.version_id===versionId&&live.sha256===digest,'renewal_sources_changed',SOURCE_REVIEW,409)
  pins[purpose]={...pin,version:live.version}
 }
 return pins
}

/** Preserve old opaque pins while showing current provenance only to a presently authorized reader. */
export async function renewalSourceState(c:Context,t:Row,pins:Row|undefined,installation:unknown){
 if(!pins)return null
 const restored=installation!==await sourceInstallation(c),sources=[]
 for(const purpose of SOURCE_PURPOSES){
  const pin=pins[purpose],live=pin?await currentSource(c,t,pin):null
  const state=restored?'restored':!live?'unavailable':live.version_id===pin.versionId&&live.sha256===pin.sha256?'current':'changed'
  sources.push({purpose,pinned:pin??null,current:live?{versionId:live.version_id,version:live.version,sha256:live.sha256,title:redactSensitive(live.title)}:null,state})
 }
 const stale=sources.some(s=>s.state!=='current')
 return {stale,sources,nextStep:stale?SOURCE_REVIEW:'Pinned evidence is current. A person still approves pricing, legal terms and notices.'}
}

/** Recheck exact sources and present rights in the proposal's atomic write batch. */
export function renewalSourceGuards(c:Context,t:Row,pins:Row|undefined){
 if(!pins)return []
 return SOURCE_PURPOSES.map(purpose=>{
  const pin=pins[purpose]
  const permission=c.actor.role==='owner'?'1':`EXISTS(SELECT 1 FROM tt_role_actions a WHERE a.role=? AND a.action=CASE WHEN d.referral_original=1 THEN 'referral.read' WHEN d.kind='application' THEN 'document.application' WHEN d.kind='screening' THEN 'document.screening' WHEN d.kind='tax' THEN 'document.tax' WHEN d.kind='professional' THEN 'referral.read' ELSE 'document.read' END)`
  const scope=c.actor.role==='owner'?'1':c.actor.credential?`EXISTS(SELECT 1 FROM tt_api_credentials k WHERE k.id=? AND k.revoked_at IS NULL AND k.version=? AND (k.all_portfolios=1 OR EXISTS(SELECT 1 FROM tt_api_credential_portfolios a WHERE a.credential_id=k.id AND a.portfolio_id=sp.portfolio_id)))`:`EXISTS(SELECT 1 FROM tt_staff_roles r WHERE r.operator_id=? AND (r.all_portfolios=1 OR EXISTS(SELECT 1 FROM tt_role_portfolios a WHERE a.operator_id=r.operator_id AND a.portfolio_id=sp.portfolio_id)))`
  return guard(c,`EXISTS(SELECT 1 FROM tt_document_versions v JOIN tt_documents d ON d.id=v.document_id JOIN tt_tenancies st ON st.id=d.tenancy_id LEFT JOIN tt_units su ON su.id=st.unit_id LEFT JOIN tt_properties sp ON sp.id=su.property_id JOIN tt_tenancies target ON target.id=? LEFT JOIN tt_units tu ON tu.id=target.unit_id LEFT JOIN tt_properties tp ON tp.id=tu.property_id WHERE v.id=? AND d.id=? AND v.version=d.version AND v.sha256=? AND st.erased_at IS NULL AND target.erased_at IS NULL AND (st.id=target.id OR sp.portfolio_id=tp.portfolio_id) AND ${permission} AND ${scope}${c.actor.credential?" AND d.kind NOT IN ('application','screening','tax','professional') AND COALESCE(d.referral_original,0)=0":''})`,t.id,pin.versionId,pin.documentId,pin.sha256,...(c.actor.role==='owner'?[]:[c.actor.staff!.role]),...(c.actor.role==='owner'?[]:c.actor.credential?[c.actor.id,c.actor.version]:[c.actor.id]))
 })
}
