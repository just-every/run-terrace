import assert from 'node:assert/strict'
import {installation} from './api/harness.mjs'
export async function journey({assets=false,inspect}={}){
 const h=await installation({assets})
 try{
  const portfolio=await h.command('portfolio.add',{name:'Reconciliation portfolio'}),property=await h.command('property.add',{portfolioId:portfolio.id,name:'Alder House',address:'1 Alder Lane, Oakland, CA',kind:'duplex',timeZone:'America/Los_Angeles'}),owner=await h.command('owner.add',{kind:'individual',legalName:'Synthetic Owner',email:'owner-statement@example.test',mailingAddress:'1 Alder Lane'})
  await h.command('ownership.set',{propertyId:property.id,effectiveFrom:'2025-01-01',reason:'synthetic-terrace-1',shares:[{ownerId:owner.id,percent:'100'}]})
  await h.command('agreement.set',{propertyId:property.id,starts:'2025-01-01',feePercent:'0',reserve:'100.00',reference:'synthetic-terrace-2'})
  await h.command('company.save',{name:'Synthetic Terrace',timeZone:'America/Los_Angeles',officeEmail:'office@example.test',officePhone:'510-555-0101',officeAddress:'1 Alder Lane'})
  await h.stepUp()
  const entity=await h.command('entity.add',{legalName:'Synthetic Terrace LLC',ein:'12-3456789'}),bank=await h.command('trust.account.add',{entityId:entity.id,name:'Alder rent trust',purpose:'rent_trust',bankName:'Synthetic Bank',last4:'1020'})
  await h.command('trust.map',{propertyId:property.id,bankId:bank.id,fund:'operating',primary:true,reference:'synthetic-terrace-3'})
  const post=async(n,reference,day='2026-09-10',account='contribution')=>{const r=await h.command('journal.post',{propertyId:property.id,ownerId:owner.id,fund:'operating',kind:'journal',day,reference,lines:[{account:'cash',debit:n>0?n:0,credit:n<0?-n:0},{account,debit:n<0?-n:0,credit:n>0?n:0}]});return'journal:'+r.id}
  const opening=await post(100000,'synthetic-terrace-4 opening'),rent=[await post(60000,'synthetic-terrace-5 rent A','2026-09-10','lease_income'),await post(60000,'synthetic-terrace-6 rent B','2026-09-10','lease_income')],fee=await post(-10000,'synthetic-terrace-7 management fee','2026-09-10','fee_expense'),ach=[await post(-10000,'synthetic-terrace-8 ACH batch owner A'),await post(-10000,'synthetic-terrace-9 ACH batch owner B')],cleared=await post(-4000,'synthetic-terrace-10 check 401'),out=await post(-5000,'synthetic-terrace-11 check 402'),deposit=await post(3000,'synthetic-terrace-12 deposit in transit')
  const csv='id,date,amount,description,checkNumber,traceNumber\nopening,2026-09-10,1000.00,Opening contribution,,\nrent,2026-09-10,1200.00,"Batched rent, two receipts",,\nfee,2026-09-10,-100.00,Management fee,,\nach,2026-09-10,-200.00,Owner ACH batch,,synthetic-terrace-13\ncheck,2026-09-10,-40.00,Cleared check,401,\nmissing,2026-09-10,70.00,Missing book deposit,,\n'
  const input={bankId:bank.id,from:'2026-09-01',to:'2026-09-30',opening:'0',closing:'1930',format:'csv',reviewed:'on',reference:'synthetic-terrace-14 reviewed September',file:new File([csv],'bank.csv')}
  await h.formCommand('reconcile.import',{...input,reviewed:''},{status:400})
  const imported=await h.formCommand('reconcile.import',input),statementId=imported.statementId
  assert.equal((await h.formCommand('reconcile.import',input)).statementId,statementId)
  await h.formCommand('reconcile.import',{...input,closing:'1931'},{status:409})
  await h.formCommand('reconcile.import',{...input,file:new File([csv+'\n'],'overlap.csv')},{status:409})
  const get=async()=>{const r=await h.request('/api/reconcile?statementId='+statementId);assert.equal(r.status,200,await r.clone().text());return(await r.json()).selected}
  const match=(bankKey,sources,method='amount',extra={},opts={})=>h.command('reconcile.match',{statementId,bankKey,sources,method,reference:'synthetic-terrace-15 reviewed sources',...extra},opts)
  await match('opening',[opening]);await match('rent',rent,'settlement')
  await match('ach',[...ach,fee],'ach_batch',{}, {status:409})
  await match('ach',ach,'ach_trace',{identifier:'wrong'},{status:409})
  await match('ach',ach,'ach_batch')
  await match('check',[cleared],'check',{identifier:'402'},{status:409})
  await match('check',[cleared],'check',{identifier:'401'})
  await match('fee',[opening],'amount',{}, {status:409})
  await h.command('reconcile.outstanding',{statementId,sourceKey:out,kind:'deposit',reference:'synthetic-terrace-16'},{status:400})
  await h.command('reconcile.outstanding',{statementId,sourceKey:out,kind:'check',reference:'synthetic-terrace-16 follow up check 402'})
  await h.command('reconcile.outstanding',{statementId,sourceKey:deposit,kind:'deposit',reference:'synthetic-terrace-17 deposit in transit'})
  assert.equal((await get()).differenceCents,7000)
  await h.command('reconcile.signoff',{statementId},{status:409})
  if(inspect)await inspect({phase:'exceptions',h,statementId,fee})
  if(!(await get()).lines.find(l=>l.key==='fee').match)await match('fee',[fee])
  const unresolved=await get();assert.equal(unresolved.unmatchedCount,1);assert.equal(unresolved.differenceCents,7000);assert.equal(unresolved.clean,false)
  await h.command('reconcile.signoff',{statementId},{status:409})
  for(const item of ['receipts','deposits','exceptions'])await h.command('period.signoff',{month:'2026-09',item,note:'synthetic-terrace-18'})
  await h.command('period.close',{month:'2026-09'},{status:409})
  const found=await post(7000,'synthetic-terrace-19 located deposit');await match('missing',[found])
  const balanced=await get();assert.equal(balanced.adjustedBankCents,191000);assert.equal(balanced.bookCents,191000);assert.equal(balanced.beneficiaryCents,191000);assert.equal(balanced.outstandingCents,-2000);assert.equal(balanced.adjustedBookCents,193000);assert.equal(balanced.clean,true)
  if(inspect)await inspect({phase:'balanced',h,statementId})
  await h.command('reconcile.signoff',{statementId});assert.ok((await get()).currentSignoff)
  assert.equal((await h.command('reconcile.signoff',{statementId})).replayed,true)
  const extra=await post(100,'synthetic-terrace-20 later book change');assert.equal((await get()).currentSignoff,null)
  await h.command('period.close',{month:'2026-09'},{status:409})
  await h.command('reconcile.outstanding',{statementId,sourceKey:extra,kind:'deposit',reference:'synthetic-terrace-21 new deposit in transit'})
  await h.command('reconcile.signoff',{statementId});assert.equal((await get()).signoffs.length,2)
  await h.command('period.close',{month:'2026-09'});await post(10,'closed month').then(()=>assert.fail('Closed books cannot change'),e=>assert.match(e.message,/period_closed/))
  const member=await h.invite('member','member@example.test')
  for(const path of ['/api/reconcile','/api/reconcile?statementId='+statementId,'/api/reconcile-original?statementId='+statementId,'/app?tab=reconcile'])assert.equal((await h.request(path,{as:member})).status,403)
  for(const command of ['reconcile.import','reconcile.match','reconcile.outstanding','reconcile.signoff'])await h.command(command,{}, {as:member,status:403})
  const other=await h.command('portfolio.add',{name:'Other portfolio'})
  await h.command('operator.invite',{displayName:'Other books',email:'other-books@example.test',role:'bookkeeper',portfolioIds:[other.id]})
  const scoped=await h.accept('other-books@example.test');assert.equal((await(await h.request('/api/reconcile',{as:scoped})).json()).statements.length,0)
  assert.equal((await h.request('/api/reconcile?statementId='+statementId,{as:scoped})).status,404);assert.equal((await h.request('/api/reconcile-original?statementId='+statementId,{as:scoped})).status,404)
  await h.command('reconcile.match',{statementId},{as:scoped,status:404})
  const original=await h.request('/api/reconcile-original?statementId='+statementId);assert.equal(await original.text(),csv);assert.equal(original.headers.get('cache-control'),'no-store')
  // Import real OFX syntax and QFX syntax with stable bank ids; review a PDF's extracted rows locally.
  for(const [format,start,end]of [['ofx','01','02'],['qfx','03','04']]){
   const body=`OFXHEADER:100\n<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><CURDEF>USD<BANKTRANLIST><STMTTRN><DTPOSTED>202610${start}120000<TRNAMT>1.00<FITID>synthetic-terrace-${format}<REFNUM>synthetic-terrace-trace-${format}<NAME>Deposit</STMTTRN></BANKTRANLIST><LEDGERBAL><BALAMT>1.00<DTASOF>202610${end}</LEDGERBAL></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`
   const r=await h.formCommand('reconcile.import',{...input,from:'2026-10-'+start,to:'2026-10-'+end,closing:'1',format,file:new File([body],'bank.'+format)});const d=await(await h.request('/api/reconcile?statementId='+r.statementId)).json();assert.equal(d.selected.lines[0].amountCents,100);const source=await post(100,'synthetic-terrace-trace-'+format,'2026-10-'+start);await h.command('reconcile.match',{statementId:r.statementId,bankKey:'synthetic-terrace-'+format,sources:[source],method:'ach_trace',identifier:'synthetic-terrace-trace-'+format,reference:'synthetic-terrace-24 trace review'})
  }
  const pdf='%PDF-1.4\nsynthetic-terrace-22 reviewed local extraction\n%%EOF',pdfInput={...input,from:'2026-10-05',to:'2026-10-06',format:'pdf',closing:'2',lines:'id,date,amount,description\npdf-1,2026-10-05,2.00,Reviewed deposit',file:new File([pdf],'bank.pdf')}
  const pdfResult=await h.formCommand('reconcile.import',pdfInput);assert.equal((await(await h.request('/api/reconcile?statementId='+pdfResult.statementId)).json()).selected.lines[0].amountCents,200)
  await h.formCommand('reconcile.import',{...pdfInput,lines:pdfInput.lines.replace('2.00','3.00')},{status:409})
  const before=await get();await h.restart();assert.deepEqual(await get(),before)
  const archive=await(await h.request('/api/backup')).text(),fresh=await installation()
  try{await fresh.formCommand('data.restore',{confirm:'RESTORE',backup:new File([archive],'reconcile.rer')});const restored=await(await fresh.request('/api/reconcile?statementId='+statementId)).json();assert.deepEqual(restored.selected,before);assert.equal(await(await fresh.request('/api/reconcile-original?statementId='+statementId)).text(),csv)}finally{await fresh.close()}
  if(inspect)await inspect({phase:'signed',h,statementId})
 }finally{await h.close()}
}
