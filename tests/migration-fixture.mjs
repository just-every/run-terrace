import {Buffer} from 'node:buffer'
const ref=n=>'synthetic-terrace-'+n
const address=n=>ref(n)+String.fromCharCode(64)+'example.test'
export function migrationFixture(){
 const records=[],add=(kind,n,data)=>records.push({kind,ref:ref(n),data})
 for(const [owner,property,household,lease,charge,deposit,history,doc,balance,security]of [[1,3,5,7,9,11,13,17,12000,50000],[2,4,6,8,10,12,15,18,2500,20000]]){
  add('owner',owner,{name:'Synthetic owner '+owner,email:address(owner),kind:'individual',mailingAddress:owner+' Synthetic Road',w9:'received'})
  add('property',property,{name:'Synthetic homes '+property,address:property+' Synthetic Road',kind:'duplex',timeZone:'America/Los_Angeles',ownershipFrom:'2024-01-01',owners:[{ownerRef:ref(owner),shareBp:10000}]})
  add('household',household,{identity:ref(household),sourceNote:household===6?'Synthetic unrelated source note':'Synthetic subject source note',name:'Synthetic resident '+household,email:address(household),members:[{role:'occupant',name:'Synthetic occupant '+household,joined:'2024-01-01'}]})
  add('unit',lease+25,{propertyRef:ref(property),identifier:'A',bedrooms:2,bathrooms:1,rentable:true,amenities:['Porch']})
  add('lease',lease,{propertyRef:ref(property),ownerRef:ref(owner),householdRef:ref(household),unitRef:ref(lease+25),starts:'2024-01-01',ends:'2027-12-31',rentCents:100000,cadence:'monthly',leaseType:'residential',depositCents:security,historyFrom:'2024-06-30',historyOpeningCents:0})
  add('charge',charge,{leaseRef:ref(lease),day:'2026-06-01',amountCents:balance,description:'Unpaid source rent',reference:ref(charge)})
  add('deposit',deposit,{leaseRef:ref(lease),day:'2024-01-01',amountCents:security,reference:ref(deposit)})
  add('history',history,{leaseRef:ref(lease),day:'2024-07-01',type:'charge',amountCents:balance*2,deltaCents:balance*2,reference:ref(history)})
  add('history',history+1,{leaseRef:ref(lease),day:'2026-06-01',type:'receipt',amountCents:balance,deltaCents:-balance,reference:ref(history+1)})
  add('document',doc,{leaseRef:ref(lease),title:'Source lease '+lease,documentKind:'lease',artifactRef:ref(doc)})
 }
 add('history',35,{leaseRef:ref(7),day:'2025-01-01',type:'credit',amountCents:500,deltaCents:-500,reference:ref(35)})
 add('history',36,{leaseRef:ref(7),day:'2025-02-01',type:'returned_payment',amountCents:500,deltaCents:500,reference:ref(36)})
 add('history',37,{leaseRef:ref(7),day:'2025-03-01',type:'deposit',amountCents:50000,deltaCents:0,reference:ref(37)})
 add('unit',34,{propertyRef:ref(3),identifier:'B',bedrooms:3,bathrooms:2,rentable:true,amenities:[]})
 add('vendor',19,{name:'Synthetic vendor',email:address(19),phone:'510-555-0100',specialties:'general',serviceAreas:'Synthetic',w9:'missing',standing:'approved',insuranceExpires:'2028-12-31',availability:'Weekdays',dba:'Synthetic trade',tinStatus:'missing',eligible1099:true,box:'1',paymentMethod:'check',remitAddress:'19 Synthetic Road'})
 add('bill',20,{propertyRef:ref(3),vendorRef:ref(19),day:'2026-06-15',amountCents:5000,description:'Unpaid source repair',invoiceNumber:ref(20),reference:ref(20),artifactRef:ref(20)})
 add('work',21,{leaseRef:ref(7),vendorRef:ref(19),dueDate:'2026-07-10',amountCents:15000,description:'Source active repair',trade:'general',sourceState:'In progress in source'})
 add('schedule',22,{leaseRef:ref(8),vendorRef:ref(19),dueDate:'2026-09-01',amountCents:9000,description:'Future gutter service',trade:'general',intervalMonths:6})
 add('vendor_ytd',23,{vendorRef:ref(19),reportableCents:120000,reference:ref(23)})
 for(const [n,property,owner]of [[24,3,1],[25,4,2]])add('owner_ytd',n,{propertyRef:ref(property),ownerRef:ref(owner),incomeCents:1000000,expenseCents:120000,reference:ref(n)})
 add('opening',26,{propertyRef:ref(3),ownerRef:ref(1),fund:'operating',lines:[{account:'cash',debit:30000,credit:0},{account:'receivable',debit:12000,credit:0},{account:'payable',debit:0,credit:5000},{account:'opening_equity',debit:0,credit:37000}]})
 add('opening',27,{propertyRef:ref(3),ownerRef:ref(1),fund:'deposit',lines:[{account:'cash',debit:50000,credit:0},{account:'deposit_liability',debit:0,credit:50000}]})
 add('opening',28,{propertyRef:ref(4),ownerRef:ref(2),fund:'operating',lines:[{account:'cash',debit:10000,credit:0},{account:'receivable',debit:2500,credit:0},{account:'opening_equity',debit:0,credit:12500}]})
 add('opening',29,{propertyRef:ref(4),ownerRef:ref(2),fund:'deposit',lines:[{account:'cash',debit:20000,credit:0},{account:'deposit_liability',debit:0,credit:20000}]})
 for(const r of records.filter(r=>r.kind==='property')){r.data.sourceStreet=r.data.address;delete r.data.address}
 const inventory={};for(const r of records)inventory[r.kind]=(inventory[r.kind]??0)+1
 return {format:'terrace-migration-v1',namespace:ref(100),cutoverDate:'2026-07-01',inventory,records,fieldMap:{property:{address:'sourceStreet'}},artifacts:[17,18,20].map(n=>({ref:ref(n),name:ref(n)+'.txt',type:'text/plain',base64:Buffer.from('Synthetic retained original '+n).toString('base64')})),resolutions:[{key:'w9:vendor:'+ref(19),action:'hold',reason:'Missing W-9 retained; current vendor qualification and payment holds continue.'}],trialBalance:records.filter(r=>r.kind==='opening').flatMap(r=>r.data.lines.map(l=>({propertyRef:r.data.propertyRef,ownerRef:r.data.ownerRef,fund:r.data.fund,account:l.account,balanceCents:l.debit-l.credit})))}
}
export function recount(m){for(const kind of ['owner','property','unit','household','lease','vendor','document','deposit','charge','bill','work','schedule','vendor_ytd','owner_ytd','history','opening'])m.inventory[kind]=m.records.filter(r=>r.kind===kind).length;return m}
