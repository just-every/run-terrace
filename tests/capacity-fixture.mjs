// SAFE-009 deterministic synthetic portfolio, loaded only through the application's public command door.
export const counts={units:500,properties:60,leases:600,owners:150,residents:1200,vendors:250,historyMonths:24}
export async function seedCapacity(command,progress=()=>{}){
 const f=await command('portfolio.add',{name:'synthetic-terrace-capacity-35'}),units=[],owners=[],leases=[]
 for(let i=0;i<counts.owners;i++)owners.push(await command('owner.add',{kind:'individual',legalName:'synthetic-terrace-owner-'+i,email:`owner-${i}@example.test`,mailingAddress:'35 Synthetic Road, Oakland, CA'}))
 let ownerIndex=0
 for(let i=0;i<counts.properties;i++){
  const p=await command('property.add',{portfolioId:f.id,name:'synthetic-terrace-property-'+i,address:`${i+1} Synthetic Road, Oakland, CA`,kind:'multifamily',timeZone:'America/Los_Angeles'})
  const n=i<30?3:2,shares=[]
  for(let j=0;j<n;j++)shares.push({ownerId:owners[ownerIndex++].id,percent:n===2?'50':j===0?'33.34':'33.33'})
  await command('ownership.set',{propertyId:p.id,effectiveFrom:'2023-01-01',reason:'synthetic-terrace-35 ownership fixture',shares})
  for(let j=0;j<(i<20?9:8);j++)units.push(await command('unit.add',{propertyId:p.id,identifier:String(j+1),bedrooms:2,bathrooms:1,marketRent:'1500'}))
 }
 for(let i=0;i<counts.leases;i++){
  const past=i>=500&&i<550,future=i>=550,start=past?'2023-10-01':future?'2027-10-01':'2024-10-01',end=past?'2024-09-30':future?'2028-09-30':'2027-09-30'
  const t=await command('tenancy.create',{unitId:units[i%500].id,ownerName:'Synthetic recorded owner',ownerEmail:'recorded-owner@example.test',tenantName:'synthetic-terrace-resident-'+i,tenantEmail:`resident-${i}@example.test`,startDate:start,endDate:end,rent:'1500',cadence:'monthly'})
  await command('term.add',{tenancyId:t.id,kind:'rent',description:'Synthetic monthly rent',amount:'1500',starts:start,ends:end})
  await command('household.add',{tenancyId:t.id,role:'co_tenant',name:'synthetic-terrace-co-resident-'+i,email:`co-resident-${i}@example.test`,joined:start})
  leases.push(t)
  if(i%100===99)progress('leases '+(i+1))
 }
 for(let i=0;i<counts.vendors;i++)await command('vendor.add',{name:'synthetic-terrace-vendor-'+i,email:`vendor-${i}@example.test`,phone:'510-555-0135',specialties:'general',serviceAreas:'Oakland',w9:'received',insuranceExpires:'2035-01-01',availability:'By appointment',rate:'75',standing:'approved'})
 for(let i=0;i<counts.historyMonths;i++){
  const month=new Date(Date.UTC(2024,9+i,1)).toISOString().slice(0,7),run=await command('charges.preview',{month})
  const posted=await command('charges.post',{month,fingerprint:run.fingerprint})
  if(posted.posted!==500)throw Error('History fixture did not post exactly 500 rent charges for '+month)
  progress('history '+month)
 }
 return {counts:{...counts},owners,leases,portfolioId:f.id}
}
