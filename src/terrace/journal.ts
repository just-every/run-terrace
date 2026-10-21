// ACCT-001: each journal entry belongs to one owner, property and fund and balances in exact USD cents.
import {all,allow,can,cents,commit,date,everywhere,guard,id,insist,one,reaches,reachesPortfolio,shown,sql,tenancy,text,type Context,type Row} from './core'
import {localDate} from './zones'
export const JOURNAL_COMMANDS=['chart.add','journal.post','journal.reverse','rent.reverse-receipt']
export async function journalProperty(c:Context,value:unknown){
 const p=await one(c,'SELECT * FROM tt_properties WHERE id=?',text(value,'Property',100))
 insist(p&&reachesPortfolio(c,p.portfolio_id),'not_found','Property not found.',404);return p
}
async function entry(c:Context,value:unknown){
 const j=await one(c,'SELECT * FROM tt_journal WHERE id=?',text(value,'Entry',250));insist(j,'not_found','Journal entry not found.',404)
 if(j.property_id)await journalProperty(c,j.property_id);else everywhere(c)
 return j
}
function lines(value:unknown){
 let rows=value
 if(typeof value==='string')try{rows=JSON.parse(value)}catch{throw Error('Lines must be a JSON array of account, debit and credit cents.')}
 insist(Array.isArray(rows)&&rows.length>=2&&rows.length<=100,'unbalanced_journal','An entry has 2 to 100 lines.')
 const out=rows.map((r:Row)=>{const account=text(r.account,'Account',40),debit=r.debit,credit=r.credit;insist(Number.isSafeInteger(debit)&&Number.isSafeInteger(credit)&&debit>=0&&credit>=0&&debit<=100_000_000&&credit<=100_000_000&&(debit===0)!==(credit===0),'unbalanced_journal','Each line is a positive debit or credit in integer cents.');return{account,debit,credit}})
 insist(out.reduce((s,r)=>s+r.debit-r.credit,0)===0,'unbalanced_journal','Total debits must equal total credits.');return out
}
export async function journalCommand(c:Context,command:string,p:Row):Promise<Row|undefined>{
 if(!JOURNAL_COMMANDS.includes(command))return
 allow(c,command)
 if(command==='chart.add'){
  everywhere(c);const code=text(p.code,'Account code',40);insist(/^[a-z][a-z0-9_]*$/.test(code),'invalid_account','Use a lowercase account code.')
  insist(['asset','liability','income','expense','equity'].includes(p.kind)&&['operating','deposit','both'].includes(p.fund),'invalid_account','Choose account type and fund.')
  await commit(c,[sql(c,'INSERT INTO tt_gl_accounts(code,name,kind,fund,cash,created_by,created_at) VALUES(?,?,?,?,0,?,?)',code,text(p.name,'Account name',150),p.kind,p.fund,c.actor.id,c.now)],command,code)
  return{code,notice:'Chart account added. Existing postings and account definitions stay unchanged.'}
 }
 if(command==='rent.reverse-receipt'){
  const r=await one(c,'SELECT r.*,q.tenancy_id FROM tt_receipts r JOIN tt_charges q ON q.id=r.charge_id WHERE r.id=?',text(p.receiptId,'Receipt',100));insist(r,'not_found','Receipt not found.',404)
  const t=await tenancy(c,r.tenancy_id);insist(shown(t)==='USD','currency','The general ledger accepts confirmed USD only.',409)
  const day=date(p.day),reference=text(p.reference,'Reversal reference',500),reason=text(p.reason,'Reversal reason',1000),key=id()
  insist(day>=r.received_date&&day<=localDate(c.now,t.time_zone),'invalid_date','Reverse on or after receipt and no later than today at the property.')
  insist(!await one(c,'SELECT 1 FROM tt_receipt_reversals WHERE receipt_id=?',r.id),'already_reversed','This receipt was already reversed.',409)
  await commit(c,[sql(c,'INSERT INTO tt_receipt_reversals(id,receipt_id,day,reference,reason,recorded_by,recorded_at) VALUES(?,?,?,?,?,?,?)',key,r.id,day,reference,reason,c.actor.id,c.now)],command,r.id)
  return{id:key,tenancyId:t.id,notice:'Receipt reversed in the resident, property and owner ledgers. The original remains unchanged.'}
 }
 const key=id(),day=date(p.day),reference=text(p.reference,'Source reference',500)
 if(command==='journal.reverse'){
  const j=await entry(c,p.entryId)
  insist(!j.reversal_of,'reversal','Reverse the original, not its reversal.',409)
  insist(!['charge','receipt','reduction','bill','fee'].includes(j.source_kind),'source_door','Correct this entry through its source door; receipts use Reverse receipt.',409)
  const zone=j.property_id?(await journalProperty(c,j.property_id)).time_zone:c.zone??'UTC'
  insist(day>=j.day&&day<=localDate(c.now,zone),'invalid_date','A reversal cannot predate its original or be later than today at the property.')
  const reverse=JSON.parse(j.lines).map((l:Row)=>({account:l.account,debit:l.credit,credit:l.debit}))
  await commit(c,[sql(c,'INSERT INTO tt_journal(id,day,property_id,owner_key,tenancy_id,vendor_id,fund,source_kind,source_id,reference,lines,reversal_of,recorded_by,recorded_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)',key,day,j.property_id,j.owner_key,j.tenancy_id,j.vendor_id,j.fund,'reversal',key,reference,JSON.stringify(reverse),j.id,c.actor.id,c.now)],command,j.id)
  return{id:key,notice:'Reversing entry recorded. The original remains unchanged.'}
 }
 const property=await journalProperty(c,p.propertyId),owner=text(p.ownerId,'Beneficiary owner',100),kind=String(p.kind??'journal'),fund=String(p.fund??'operating')
 insist(day<=localDate(c.now,property.time_zone),'future_posting','Record only activity that has already occurred at the property.')
 insist(['opening','deposit','contribution','vendor_expense','journal'].includes(kind)&&['operating','deposit'].includes(fund),'invalid_kind','Choose opening, deposit, contribution, vendor expense or journal and a fund.')
 const share=await one(c,'SELECT s.id FROM tt_ownership_sets s JOIN tt_ownership_shares h ON h.set_id=s.id WHERE s.property_id=? AND s.effective_from<=? AND h.owner_id=? ORDER BY s.effective_from DESC LIMIT 1',property.id,day,owner)
 const current=await one(c,'SELECT id FROM tt_ownership_sets WHERE property_id=? AND effective_from<=? ORDER BY effective_from DESC LIMIT 1',property.id,day)
 insist(share&&share.id===current?.id,'owner_scope','Choose an owner in the property’s ownership set on the posting day.',409)
 let t:Row|undefined
 if(p.tenancyId){t=await tenancy(c,p.tenancyId);const unit=await one(c,'SELECT property_id FROM tt_units WHERE id=?',t.unit_id);insist(unit?.property_id===property.id&&shown(t)==='USD','ledger_scope','The resident must belong to this property in confirmed USD.',409)}
 const vendor=p.vendorId?await one(c,'SELECT id FROM tt_vendors WHERE id=?',text(p.vendorId,'Vendor',100)):null
 insist(!p.vendorId||vendor,'not_found','Vendor not found.',404)
 insist(kind!=='deposit'||(t&&fund==='deposit'),'deposit_scope','Deposits need a resident and the deposit fund.')
 insist(kind!=='vendor_expense'||(vendor&&fund==='operating'),'vendor_scope','Vendor expenses need a vendor and operating funds.')
 insist(kind!=='contribution'||fund==='operating','fund','Owner contributions belong to operating funds.')
 const rows=lines(p.lines??Array.from({length:4},(_,i)=>({account:p['account'+i],debit:p['debit'+i]?cents(p['debit'+i]):0,credit:p['credit'+i]?cents(p['credit'+i]):0})).filter(l=>l.account))
 // Typed source records retain their business meaning; generic journal/opening records carry the full reviewed lines.
 if(['deposit','contribution','vendor_expense'].includes(kind)){
  const counterpart=kind==='deposit'?'deposit_liability':kind==='contribution'?'contribution':'expense'
  insist(rows.length===2&&rows.some(l=>l.account==='cash'&&(kind==='vendor_expense'?l.credit>0:l.debit>0))&&rows.some(l=>l.account===counterpart&&(kind==='vendor_expense'?l.debit>0:l.credit>0)),'posting_shape','Use the named cash and counterpart accounts for this source.')
 }
 await commit(c,[guard(c,'(SELECT id FROM tt_ownership_sets WHERE property_id=? AND effective_from<=? ORDER BY effective_from DESC LIMIT 1)=?',property.id,day,share.id),sql(c,'INSERT INTO tt_journal(id,day,property_id,owner_key,tenancy_id,vendor_id,fund,source_kind,source_id,reference,lines,recorded_by,recorded_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)',key,day,property.id,owner,t?.id??null,vendor?.id??null,fund,kind,key,reference,JSON.stringify(rows),c.actor.id,c.now)],command,key)
 return{id:key,notice:'Balanced USD entry recorded from your external source. No money moved.'}
}
export async function journalData(c:Context,p:Row={}){
 allow(c,'reports.read')
 if(p.propertyId)await journalProperty(c,p.propertyId)
 if(p.tenancyId)await tenancy(c,p.tenancyId)
 const [allEntries,accounts,properties,owners,vendors,tenancies,shares]=await Promise.all([all(c,"SELECT j.*,r.id AS reversed_by,t.time_zone AS source_zone,a.posting_day AS explicit_day FROM tt_journal j LEFT JOIN tt_journal r ON r.reversal_of=j.id LEFT JOIN tt_tenancies t ON t.id=j.tenancy_id LEFT JOIN tt_adjustments a ON j.source_kind='reduction' AND a.id=j.source_id ORDER BY j.day,j.recorded_at,j.id"),all(c,'SELECT * FROM tt_gl_chart ORDER BY code'),all(c,'SELECT id,name,portfolio_id FROM tt_properties ORDER BY name'),all(c,'SELECT id,legal_name FROM tt_owners ORDER BY legal_name'),all(c,'SELECT id,name FROM tt_vendors ORDER BY name'),all(c,'SELECT id,unit_id,tenant_name,address FROM tt_tenancies WHERE erased_at IS NULL ORDER BY address'),all(c,'SELECT h.owner_id,s.property_id FROM tt_ownership_shares h JOIN tt_ownership_sets s ON s.id=h.set_id')])
 const mine=properties.filter(x=>reachesPortfolio(c,x.portfolio_id)),ids=new Set(mine.map(x=>x.id))
 const dated:Row[]=allEntries.map(({source_zone,explicit_day,...j})=>({...j,day:j.source_kind==='reduction'&&!explicit_day&&source_zone?localDate(j.recorded_at,source_zone):j.day}))
 const rows:Row[]=dated.filter(j=>(j.property_id?ids.has(j.property_id):c.actor.role==='owner'||c.actor.staff?.all)&&(!p.propertyId||j.property_id===p.propertyId)&&(!p.ownerId||j.owner_key===p.ownerId)&&(!p.tenancyId||j.tenancy_id===p.tenancyId)&&(!p.vendorId||j.vendor_id===p.vendorId)&&(!p.fund||j.fund===p.fund)&&(!p.from||j.day>=date(p.from))&&(!p.to||j.day<=date(p.to))).map(j=>({...j,lines:JSON.parse(j.lines)}))
 const trial=accounts.map(a=>{const lines=rows.flatMap(j=>j.lines).filter(l=>l.account===a.code);return{...a,debitCents:lines.reduce((n,l)=>n+l.debit,0),creditCents:lines.reduce((n,l)=>n+l.credit,0)}})
 const ownerIds=new Set([...rows.map(j=>j.owner_key),...shares.filter(s=>ids.has(s.property_id)).map(s=>s.owner_id)])
 return{currency:'USD',entries:rows,trialBalance:trial,debitCents:trial.reduce((n,a)=>n+a.debitCents,0),creditCents:trial.reduce((n,a)=>n+a.creditCents,0),accounts,properties:mine,owners:owners.filter(o=>ownerIds.has(o.id)),tenancies:tenancies.filter(t=>reaches(c,t.unit_id)).map(t=>({...t,label:t.address+' · '+t.tenant_name})),vendors:vendors.filter(v=>c.actor.role==='owner'||c.actor.staff?.all||rows.some(j=>j.vendor_id===v.id)),mayPost:can(c,'journal.post'),mayChart:can(c,'chart.add'),mayReverse:can(c,'journal.reverse')}
}
