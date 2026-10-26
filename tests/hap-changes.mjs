import {syntheticPack} from './rule-packs.mjs'
import assert from 'node:assert/strict'

/** Native notice, independent exact approval, three prior months and inspection-only subsidy abatement. */
export async function hapChangeFlow(h,leases,manager,{inspect}={}){
 const first=leases[0],other=leases[1],t=first.t
 for(const month of ['2026-08','2026-09']){const run=await h.command('charges.preview',{month});await h.command('charges.post',{month,fingerprint:run.fingerprint})}
 const upload=async(n)=>h.command('document.upload',{tenancyId:t.id,kind:'hap',title:'PHA accounting notice '+n,source:'synthetic-terrace-'+n,file:{name:'synthetic-terrace-'+n+'.txt',type:'text/plain',base64:Buffer.from('PHA notice synthetic-terrace-'+n+' for tenant '+t.id).toString('base64')}})
 const source=await upload(210),input={tenancyId:t.id,kind:'split',effectiveFrom:'2026-07-01',effectiveTo:'2026-09-30',residentPortion:'200.01',phaPortion:'800.00',payer:'Synthetic Housing Authority',noticeVersionId:source.versionId,reason:'Three-month retroactive recertification per attached PHA notice',reference:'synthetic-terrace-211'}
 await h.command('hap.change.prepare',{...input,noticeVersionId:'unavailable'},{status:409})
 const before=(await h.state(t.id)).ledger,unaffected=(await h.state(other.t.id)).ledger
 const prepared=await h.command('hap.change.prepare',input),preview=await h.command('hap.change.preview',{changeId:prepared.changeId})
 assert.equal(preview.lines.length,3);assert.ok(preview.lines.every(l=>l.residentDelta===-10000&&l.phaDelta===10000))
 assert.deepEqual((await h.state(t.id)).ledger,before,'preparation and preview post nothing')
 await h.command('hap.change.approve',{changeId:prepared.changeId,fingerprint:'stale'},{as:manager,status:409})
 await h.command('hap.change.approve',{changeId:prepared.changeId,fingerprint:preview.fingerprint},{status:403})
 if(inspect)await inspect({h,leases,phase:'correction-review',preview})
 await h.command('hap.change.approve',{changeId:prepared.changeId,fingerprint:preview.fingerprint},{as:manager})
 await h.command('hap.change.approve',{changeId:prepared.changeId,fingerprint:preview.fingerprint},{as:manager,status:409})
 const corrected=(await h.state(t.id)).ledger
 assert.equal(corrected.balanceCents,before.balanceCents-30000);assert.equal(corrected.residentCreditCents,10000,'already paid resident entitlement becomes a separate credit, never PHA arrears')
 assert.equal(corrected.hapBalanceCents,before.hapBalanceCents+30000)
 assert.equal((await h.request('/api/document?id='+source.versionId)).status,200)
 assert.deepEqual((await h.state(other.t.id)).ledger,unaffected)
 const oldSource=await h.request('/api/lease-source?id='+first.v.leaseId);assert.equal(oldSource.status,200,'prior signed original survives the PHA correction')
 const stale=await h.command('hap.change.prepare',{...input,reference:'synthetic-terrace-212'}),stalePreview=await h.command('hap.change.preview',{changeId:stale.changeId})
 const abatementSource=await upload(213),abatement=await h.command('hap.change.prepare',{...input,kind:'abatement',effectiveFrom:'2026-08-01',effectiveTo:'2026-08-31',noticeVersionId:abatementSource.versionId,reason:'PHA inspection abatement for August only',reference:'synthetic-terrace-214'})
 const abatementPreview=await h.command('hap.change.preview',{changeId:abatement.changeId});assert.equal(abatementPreview.lines.length,1);assert.equal(abatementPreview.lines[0].residentDelta,0);assert.equal(abatementPreview.lines[0].phaDelta,-80000)
 await h.command('hap.change.approve',{changeId:abatement.changeId,fingerprint:abatementPreview.fingerprint},{as:manager})
 await h.command('hap.change.approve',{changeId:stale.changeId,fingerprint:stalePreview.fingerprint},{as:manager,status:409})
 const abated=(await h.state(t.id)).ledger
 assert.equal(abated.balanceCents,corrected.balanceCents);assert.equal(abated.hapBalanceCents,corrected.hapBalanceCents-80000)
 for(const q of abated.charges.filter(q=>q.balance_cents>0))await h.command('rent.receipt',{chargeId:q.id,amount:(q.balance_cents/100).toFixed(2),receivedDate:'2026-10-26',reference:'synthetic-terrace-215-'+q.id})
 const response=await h.request('/api/hap-reconciliation?tenancyId='+t.id),r=await response.json();assert.equal(response.status,200)
 assert.equal(r.resident.balanceCents,0);assert.equal(r.resident.creditCents,10000);assert.equal(r.differenceCents,0);assert.equal(r.ownerNetCents,r.residentNetCents+r.phaNetCents)
 assert.equal(r.pha.charges.find(q=>q.dueDate==='2026-08-01').outstandingCents,0)
 assert.equal(r.effects.length,4);assert.ok(r.effects.every(e=>e.notice_version_id&&e.posting_day==='2026-10-26'))
 const historical=await(await h.request('/api/hap-reconciliation?tenancyId='+t.id+'&asOf=2026-09-30')).json();assert.equal(historical.differenceCents,0);assert.equal(historical.resident.creditCents,0)
 const csv=await(await h.request('/api/hap-reconciliation?tenancyId='+t.id+'&format=csv')).text();assert.ok(csv.includes(source.versionId)&&csv.includes(abatementSource.versionId))
 const aging=await(await h.request('/api/delinquency?asOf=2026-10-26&tenancyId='+t.id)).json();assert.equal(aging.rows[0].balanceCents,0);assert.equal(aging.rows[0].creditCents,10000);assert.equal(aging.rows[0].phaAging.balanceCents,r.pha.balanceCents)
 const pack=syntheticPack('CA');pack.fields.lateFee={citation:'synthetic-terrace-217',effectiveDate:'2025-01-01',value:{fullUnpaidDays:4,basis:'monthly_rent',smallStructureMaxUnits:4,smallStructureCapBp:500,largeStructureCapBp:500,weekendRule:'calendar',holidays:[],pendingPolicy:'exclude_timely',reversalPolicy:'hold'}}
 await h.command('property.rules',{propertyId:first.p.id,stateCode:'CA',version:0,reference:'synthetic-terrace-218'});const saved=await h.command('rules.pack',pack);await h.command('rules.activate',{packId:saved.id,consent:'REVIEWED'})
 await h.command('latefee.policy',{tenancyId:t.id,chargeId:abated.charges[0].id,version:0,reference:'synthetic-terrace-219',terms:{fullUnpaidDays:4,feeCents:1000,capCents:1000,weekendRule:'calendar',excludeTimely:true}})
 const fees=await h.command('latefee.preview',{tenancyId:t.id,on:'2026-10-26'});assert.ok(fees.lines.every(l=>l.state==='not_due'&&l.feeCents===0),'unpaid PHA never creates a fee on timely paid resident rent');assert.equal(fees.lines.length,1)
 const next=await h.command('charges.preview',{month:'2026-10'});const nextPortions=next.lines.filter(l=>l.tenancyId===t.id);assert.deepEqual(nextPortions.map(l=>l.amountCents),[20001,80000],'new rent runs inherit the revised payer entitlement without repeating an abatement')
 const scoped=await h.invite('member','synthetic-terrace-216@example.test');await h.command('hap.change.prepare',input,{as:scoped,status:403})
 if(inspect)await inspect({h,leases,phase:'reconciled',reconciliation:r})
 return {source,abatementSource,reconciliation:r}
}
