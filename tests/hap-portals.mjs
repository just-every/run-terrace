import assert from 'node:assert/strict'
export async function hapPortalFlow(h,leases,{inspect}={}){
 const first=leases[0],residentEmail='synthetic-terrace-920@example.test',ownerEmail='synthetic-terrace-921@example.test'
 await h.stepUp()
 await h.command('portal.invite',{kind:'resident',tenancyId:first.t.id,email:residentEmail,displayName:'synthetic-terrace-920',source:'synthetic-terrace-922'})
 await h.command('portal.invite',{kind:'owner',ownerId:first.o.id,email:ownerEmail,displayName:'synthetic-terrace-921',source:'synthetic-terrace-923'})
 const residentCookie=await h.portalSignIn(residentEmail),ownerCookie=await h.portalSignIn(ownerEmail),ledger=(await h.state(first.t.id)).ledger
 const r=await h.request('/portal/api/resident?tenancyId='+first.t.id,{as:residentCookie}),resident=await r.json();assert.equal(r.status,200)
 assert.equal(resident.balanceCents,ledger.balanceCents);assert.equal(resident.housingAuthority.balanceCents,ledger.hapBalanceCents);assert.equal(resident.housingAuthority.creditCents,ledger.hapCreditCents)
 assert.equal(resident.payerCorrections.length,ledger.hapEffects.length);assert.ok(!JSON.stringify(resident).includes(leases[1].t.id),'resident sees no other household remittance detail')
 assert.equal((await h.request('/portal/api/resident?tenancyId='+leases[1].t.id,{as:residentCookie})).status,404)
 const monthly=await h.request('/portal/statement?tenancyId='+first.t.id+'&month=2026-10&format=json',{as:residentCookie}),statement=await monthly.json();assert.equal(monthly.status,200);assert.equal(statement.closingCents,ledger.balanceCents);assert.equal(statement.lines.filter(l=>l.kind==='PHA-notice resident entitlement correction').length,3);assert.ok(!statement.lines.some(l=>l.receivableDeltaCents===-80000),'abatement never enters a resident statement')
 const transactionId=statement.lines.find(l=>l.id.startsWith('hap-correction:')).id;assert.equal((await h.request('/portal/transaction?tenancyId='+first.t.id+'&id='+transactionId+'&format=json',{as:residentCookie})).status,200)
 const o=await h.request('/portal/api/owner',{as:ownerCookie}),owner=await o.json();assert.equal(o.status,200)
 const property=owner.properties.find(p=>p.id===first.p.id);assert.ok(property.payerBalances);assert.equal(property.payerBalances.totalCents,property.payerBalances.residentCents+property.payerBalances.phaCents)
 assert.ok(!owner.properties.some(p=>p.id===leases[1].p.id))
 const csv=await(await h.request('/portal/statement?tenancyId='+first.t.id,{as:residentCookie})).text();assert.ok(csv.includes('Separate PHA balance'))
 if(inspect)await inspect({h,leases,phase:'payer-portals',residentCookie,ownerCookie,transactionId})
 return {residentCookie,ownerCookie}
}
