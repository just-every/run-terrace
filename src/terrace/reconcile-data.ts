import {all,allow,can,guard,insist,one,reachesPortfolio,sha256,text,type Context,type Row} from './core'
export const epoch=async(c:Context)=>(await one(c,'SELECT version FROM tt_reconcile_clock WHERE id=1'))!.version as number
export const epochGuard=(c:Context,version:number)=>guard(c,'(SELECT version FROM tt_reconcile_clock WHERE id=1)=?',version)
export async function banks(c:Context){
 allow(c,'reconcile.read')
 const rows=await all(c,'SELECT id,name,purpose FROM tt_operating_accounts ORDER BY name,id'),maps=await all(c,'SELECT m.bank_id,p.portfolio_id FROM tt_trust_mappings m JOIN tt_properties p ON p.id=m.property_id')
 return rows.filter(b=>maps.some(m=>m.bank_id===b.id)&&maps.filter(m=>m.bank_id===b.id).every(m=>reachesPortfolio(c,m.portfolio_id)))
}
export async function bank(c:Context,value:unknown){const b=(await banks(c)).find(b=>b.id===text(value,'Bank account',100));insist(b,'not_found','Bank account not found.',404);return b}
export async function statement(c:Context,value:unknown){const s=await one(c,'SELECT id,bank_id,from_day,to_day,opening_cents,closing_cents,format,reference,fingerprint,lines,created_by,created_at FROM tt_reconcile_statements WHERE id=?',text(value,'Statement',100));insist(s,'not_found','Statement not found.',404);await bank(c,s.bank_id);return s}
export async function reconciliation(c:Context,s:Row){
 const [cash,matches,outstanding,unassigned,signoffs]=await Promise.all([
  all(c,"SELECT t.*,COALESCE(j.reference,r.bank_reference,'') AS reference FROM tt_trust_cash t LEFT JOIN tt_journal j ON t.source_kind='journal' AND j.id=t.source_id LEFT JOIN tt_trust_recordings r ON t.source_kind='transfer' AND r.transfer_id=t.source_id WHERE t.bank_id=? AND t.day<=? ORDER BY t.day,t.source_kind,t.source_id,t.property_id,t.owner_key",s.bank_id,s.to_day),
  all(c,'SELECT m.*,x.source_key,s.to_day FROM tt_reconcile_matches m JOIN tt_reconcile_sources x ON x.match_id=m.id JOIN tt_reconcile_statements s ON s.id=m.statement_id WHERE m.bank_id=? AND s.to_day<=? ORDER BY m.id,x.source_key',s.bank_id,s.to_day),
  all(c,'SELECT * FROM tt_reconcile_outstanding WHERE statement_id=? ORDER BY source_key',s.id),
  all(c,"SELECT j.id FROM tt_journal j WHERE j.day<=? AND EXISTS(SELECT 1 FROM tt_trust_mappings m WHERE m.bank_id=? AND m.property_id=j.property_id AND m.fund=j.fund) AND EXISTS(SELECT 1 FROM tt_journal_lines l JOIN tt_gl_chart g ON g.code=l.account WHERE l.id=j.id AND g.cash=1) AND NOT EXISTS(SELECT 1 FROM tt_trust_allocations a WHERE a.journal_id=j.id) ORDER BY j.id",s.to_day,s.bank_id),
  all(c,'SELECT id,fingerprint,signed_by,signed_at FROM tt_reconcile_signoffs WHERE statement_id=? ORDER BY signed_at,id',s.id)
 ])
 const grouped=new Map<string,Row>(),beneficiaries=new Map<string,Row>()
 for(const r of cash){const key=r.source_kind+':'+r.source_id,g=grouped.get(key)??{key,day:r.day,reference:r.reference,amountCents:0};g.amountCents+=r.amount_cents;grouped.set(key,g);const k=[r.property_id,r.owner_key,r.fund].join(':');const b=beneficiaries.get(k)??{propertyId:r.property_id,ownerId:r.owner_key,fund:r.fund,cents:0};b.cents+=r.amount_cents;beneficiaries.set(k,b)}
 const sources:Row[]=[...grouped.values()].map(x=>({...x,matched:matches.some(m=>m.source_key===x.key),outstanding:outstanding.find(o=>o.source_key===x.key)??null}))
 const lines:Row[]=JSON.parse(s.lines).map((l:Row)=>({...l,match:matches.find(m=>m.bank_key===l.key&&m.statement_id===s.id)??null}))
 const pending=sources.filter(x=>!x.matched),unresolved=pending.filter(x=>!x.outstanding),unmatched=lines.filter(l=>!l.match)
 const bookCents=cash.reduce((n,r)=>n+r.amount_cents,0),outstandingCents=pending.filter(x=>x.outstanding).reduce((n,r)=>n+r.amountCents,0),adjustedBookCents=bookCents-outstandingCents,beneficiaryCents=[...beneficiaries.values()].reduce((n,r)=>n+r.cents,0)
 const differenceCents=s.closing_cents-adjustedBookCents,statementDifferenceCents=s.closing_cents-s.opening_cents-lines.reduce((n,l)=>n+l.amountCents,0)
 const snapshot={statementId:s.id,statementFingerprint:s.fingerprint,lines,sources,beneficiaries:[...beneficiaries.values()],unassigned,bookCents,outstandingCents,adjustedBookCents,beneficiaryCents,bankCents:s.closing_cents,adjustedBankCents:s.closing_cents+outstandingCents,differenceCents,statementDifferenceCents}
 const fingerprint=await sha256(new TextEncoder().encode(JSON.stringify(snapshot))),clean=!differenceCents&&!statementDifferenceCents&&bookCents===beneficiaryCents&&!unmatched.length&&!unresolved.length&&!unassigned.length
 return{...snapshot,fingerprint,clean,unmatchedCount:unmatched.length,unresolvedCount:unresolved.length,signoffs,currentSignoff:clean?signoffs.find(x=>x.fingerprint===fingerprint)??null:null}
}
export async function reconcileData(c:Context,p:Row={}){
 const accounts=await banks(c),ids=new Set(accounts.map(b=>b.id)),statements=(await all(c,'SELECT id,bank_id,from_day,to_day,reference FROM tt_reconcile_statements ORDER BY to_day DESC,id')).filter(s=>ids.has(s.bank_id))
 const selected=p.statementId?await statement(c,p.statementId):null
 return{accounts,statements,selected: selected?{...selected,...await reconciliation(c,selected)}:null,mayImport:can(c,'reconcile.import'),mayMatch:can(c,'reconcile.match'),maySignoff:can(c,'reconcile.signoff')}
}
export async function requireBankSignoffs(c:Context,month:string){
 const version=await epoch(c),accounts=await banks(c),to=new Date(Date.UTC(Number(month.slice(0,4)),Number(month.slice(5)),0)).toISOString().slice(0,10)
 for(const a of accounts){const s=await one(c,'SELECT * FROM tt_reconcile_statements WHERE bank_id=? AND from_day=? AND to_day=?',a.id,month+'-01',to);insist(s,'bank_reconciliation','Every designated account needs a complete monthly bank reconciliation.',409);insist((await reconciliation(c,s)).currentSignoff,'bank_reconciliation','Bank exceptions or changed books require a fresh balanced sign-off.',409)}
 return epochGuard(c,version)
}
