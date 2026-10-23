import {all,allow,commit,date,guard,id,insist,one,sha256,sql,text,type Context,type Row} from './core'
import {bank,epoch,epochGuard,reconciliation,statement} from './reconcile-data'
import {bankLines,signedCents} from './reconcile-import'
export const RECONCILE_COMMANDS=['reconcile.import','reconcile.match','reconcile.outstanding','reconcile.signoff']
export async function reconcileCommand(c:Context,command:string,p:Row):Promise<Row|undefined>{
 if(!RECONCILE_COMMANDS.includes(command))return
 allow(c,command)
 const version=await epoch(c)
 if(command==='reconcile.import'){
  const account=await bank(c,p.bankId),from=date(p.from),to=date(p.to),format=String(p.format),opening=signedCents(p.opening),closing=signedCents(p.closing)
  insist(from<=to&&to<c.now.slice(0,10),'statement_dates','Import a completed statement ending before today.')
  insist(p.reviewed===true||p.reviewed==='on','statement_review','Review the account, dates, balances and every extracted line before importing.')
  insist(p.file instanceof File&&p.file.size>0&&p.file.size<=5*1024*1024,'statement_file','Choose a bank file up to 5 MB.')
  const original=new Uint8Array(await p.file.arrayBuffer()),source=new TextDecoder().decode(original)
  if(format==='pdf')insist(source.startsWith('%PDF-')&&!/\/JavaScript|\/JS\b|\/Launch|\/EmbeddedFile/i.test(source),'statement_pdf','Choose a plain PDF without active content. This static check is not a malware verdict.')
  const lines=bankLines(format,source,String(p.lines??''),from,to,closing),fingerprint=await sha256(original),key=id()
  const prior=await one(c,'SELECT id,from_day,to_day,opening_cents,closing_cents,lines FROM tt_reconcile_statements WHERE bank_id=? AND fingerprint=?',account.id,fingerprint)
  if(prior){insist(prior.from_day===from&&prior.to_day===to&&prior.opening_cents===opening&&prior.closing_cents===closing&&prior.lines===JSON.stringify(lines),'statement_changed','These original bytes were already imported with different reviewed terms.',409);return{statementId:prior.id,replayed:true,notice:'Existing reviewed statement. No duplicate imported.'}}
  insist(!await one(c,'SELECT id FROM tt_reconcile_statements WHERE bank_id=? AND from_day<=? AND to_day>=?',account.id,to,from),'statement_overlap','This account already has an overlapping statement. Preserve its evidence and resolve its exceptions.',409)
  const existing=await all(c,'SELECT lines FROM tt_reconcile_statements WHERE bank_id=?',account.id),keys=new Set(existing.flatMap(s=>JSON.parse(s.lines).map((l:Row)=>l.key)))
  insist(lines.every(l=>!keys.has(l.key)),'statement_duplicate','A bank transaction id is already in another statement.',409)
  await commit(c,[epochGuard(c,version),sql(c,'INSERT INTO tt_reconcile_statements(id,bank_id,from_day,to_day,opening_cents,closing_cents,format,reference,fingerprint,original,lines,created_by,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)',key,account.id,from,to,opening,closing,format,text(p.reference,'Reviewed source reference',500),fingerprint,original,JSON.stringify(lines),c.actor.id,c.now)],command,key)
  return{statementId:key,notice:'Reviewed bank statement imported. Exceptions must be resolved before sign-off.'}
 }
 const s=await statement(c,p.statementId),d=await reconciliation(c,s)
 insist(!await one(c,'SELECT 1 FROM tt_period_closes WHERE month>=? AND month<=? AND reopened_at IS NULL',s.from_day.slice(0,7),s.to_day.slice(0,7)),'period_closed','Reopen the accounting month before changing reconciliation.',409)
 const writes=[epochGuard(c,version)]
 if(command==='reconcile.match'){
  const line=d.lines.find(l=>l.key===p.bankKey);insist(line&&!line.match,'bank_line','Choose an unmatched bank line.',409)
  const keys=Array.isArray(p.sources)?p.sources:String(p.sources??'').split(/[\n,]+/).map(x=>x.trim()).filter(Boolean)
  insist(keys.length>0&&new Set(keys).size===keys.length,'match_sources','Choose distinct book sources.')
  const selected=keys.map(k=>d.sources.find(x=>x.key===k));insist(selected.every(x=>x&&!x.matched),'match_sources','Every source must be in this account and unmatched.',409)
  insist(selected.reduce((n,x)=>n+x!.amountCents,0)===line.amountCents,'match_amount','The selected book amounts must equal the bank line exactly.',409)
  const method=String(p.method??'amount'),reference=text(p.reference,'Reviewed matching reference',500)
  insist(['amount','settlement','check','ach_trace','ach_batch'].includes(method),'match_method','Choose a supported matching method.')
  if(method==='check')insist(selected.length===1&&line.amountCents<0&&line.checkNumber&&line.checkNumber===p.identifier&&selected[0]!.reference.split(/[^A-Za-z0-9_-]+/).includes(line.checkNumber),'check_number','A cleared check needs its exact number and amount.',409)
  if(method==='ach_trace')insist(line.traceNumber&&line.traceNumber===p.identifier&&selected.every(x=>x!.reference.split(/[^A-Za-z0-9_-]+/).includes(line.traceNumber)),'ach_trace','The ACH trace must equal the bank reference.',409)
  const key=id();writes.push(sql(c,'INSERT INTO tt_reconcile_matches(id,statement_id,bank_id,bank_key,method,reference,recorded_by,recorded_at) VALUES(?,?,?,?,?,?,?,?)',key,s.id,s.bank_id,line.key,method,reference,c.actor.id,c.now),...keys.map(k=>sql(c,'INSERT INTO tt_reconcile_sources(match_id,bank_id,source_key) VALUES(?,?,?)',key,s.bank_id,k)))
 }else if(command==='reconcile.outstanding'){
  const source=d.sources.find(x=>x.key===p.sourceKey),kind=String(p.kind)
  insist(source&&!source.matched&&!source.outstanding,'outstanding_source','Choose an unmatched book source.',409)
  insist(['check','deposit','other'].includes(kind)&&(kind!=='check'||source.amountCents<0)&&(kind!=='deposit'||source.amountCents>0),'outstanding_kind','Checks are outgoing amounts; deposits are incoming amounts.')
  writes.push(sql(c,'INSERT INTO tt_reconcile_outstanding(statement_id,source_key,kind,reference,recorded_by,recorded_at) VALUES(?,?,?,?,?,?)',s.id,source.key,kind,text(p.reference,'Outstanding source and follow-up',500),c.actor.id,c.now))
 }else{
  insist(d.clean,'unbalanced_reconciliation','Unmatched bank lines, unexplained book sources or a three-way difference prevent sign-off.',409)
  if(d.currentSignoff)return{statementId:s.id,notice:'This exact reconciliation is already signed.',replayed:true}
  writes.push(sql(c,'INSERT INTO tt_reconcile_signoffs(id,statement_id,fingerprint,snapshot,signed_by,signed_at) VALUES(?,?,?,?,?,?)',id(),s.id,d.fingerprint,JSON.stringify(d),c.actor.id,c.now))
 }
 await commit(c,writes,command,s.id)
 return{statementId:s.id,notice:command==='reconcile.signoff'?'Balanced three-way reconciliation signed. Later book changes require fresh review.':'Reviewed reconciliation evidence recorded.'}
}
