import assert from 'node:assert/strict'
import {tenancyInput} from './api/harness.mjs'
import {leaseFields} from './leases.mjs'
/** The signed portions follow the same cadence and rounding as their gross rent. */
export async function hapCadenceFlow(h,leases,manager){
 for(const [i,cadence]of ['weekly','fortnightly'].entries()){
  const u=await h.command('unit.add',{propertyId:leases[1].p.id,identifier:'HAP-'+cadence,bedrooms:1,bathrooms:1}),t=await h.command('tenancy.create',{...tenancyInput,unitId:u.id,tenantEmail:'synthetic-terrace-'+(940+i)+'@example.test',cadence,rent:'1000.01',startDate:'2026-07-01',endDate:'2027-06-30'}),signed=leaseFields(t.id,'2026-07-01','1000.01','0','0','synthetic-terrace-'+(950+i))
  signed.terms=signed.terms.filter(x=>x.kind==='rent');Object.assign(signed.obligations.find(x=>x.kind==='hap'),{details:'Tenant-based rental assistance',housingAuthority:'Synthetic Housing Authority',reference:'synthetic-terrace-'+(960+i),tenantPortion:'300.01',hapPortion:'700.00'})
  const v=await h.command('lease.prepare',signed),preview=await h.command('lease.preview',{leaseId:v.leaseId,month:'2026-07'})
  assert.ok(preview.lines.length>2);assert.ok(preview.lines.every(l=>l.amountCents===(l.payerKind==='resident'?30001:70000)))
  await h.command('lease.approve',{leaseId:v.leaseId,month:'2026-07',fingerprint:preview.fingerprint},{as:manager})
  const run=await h.command('charges.preview',{month:'2026-07'});await h.command('charges.post',{month:'2026-07',fingerprint:run.fingerprint})
  const ledger=(await h.state(t.id)).ledger;assert.equal(ledger.charges.length,ledger.hapCharges.length);assert.equal(ledger.balanceCents+ledger.hapBalanceCents,100001*ledger.charges.length)
 }
}
