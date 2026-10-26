import assert from 'node:assert/strict'

const sum = rows => rows.reduce((n, r) => n + r.amountCents, 0)
function comparison(tenancyId, from, to) {
 const q = { tenancyId, from, to, assumptionsDate: '2026-10-26', reference: 'synthetic-terrace-701', confidence: 'Synthetic planning assumptions; collection is unverified' }
 for (const key of ['repair', 'market']) Object.assign(q, {
  [key+'Rent']: '1000.01', [key+'RenewalDate']: 'none', [key+'RenewalRent']: '0', [key+'VacancyDays']: '0', [key+'MakeReadyDays']: '0', [key+'Concession']: '0',
  [key+'DepositsHeld']: '0', [key+'NewDeposits']: '0', [key+'DepositRefunds']: '0', [key+'Capital']: '0', [key+'Distributions']: '0', [key+'OpeningCash']: '100',
  [key+'CollectionPercent']: '50', [key+'Source']: 'synthetic-terrace-702: explicit future rent and collection estimate; opening operating cash excludes all recorded horizon receipts',
 })
 return q
}

/** REPORT-007 inherited payer sourcing, through the same GET used by the native comparison. */
export async function hapScenarioFlow(h, leases) {
 const reports = []
 for (const [index, x] of leases.entries()) {
  await h.command('agreement.set', { propertyId: x.p.id, starts: '2026-01-01', feePercent: '0', reserve: '0', reference: 'synthetic-terrace-'+(710+index) })
  const before = (await h.state(x.t.id)).ledger
  const read = async q => {
   const response = await h.request('/api/cash-scenario?'+new URLSearchParams(q))
   assert.equal(response.status, 200, await response.clone().text())
   assert.equal(response.headers.get('cache-control'), 'no-store')
   return response.json()
  }
  const q = comparison(x.t.id, '2026-07-01', '2026-10-26'), r = await read(q), a = r.facts.payerActuals
  for (const payer of [a.resident, a.housingAuthority]) {
   assert.equal(payer.chargedCents, sum(payer.charges))
   assert.equal(payer.receivedCents, sum(payer.receipts))
   assert.equal(payer.adjustmentCents, sum(payer.adjustments))
   assert.equal(payer.pendingCents, sum(payer.pending))
   assert.equal(payer.heldCents, sum(payer.held))
   for (const source of [...payer.charges, ...payer.receipts, ...payer.adjustments, ...payer.pending, ...payer.held, ...payer.outcomes]) {
    assert.ok(source.id && source.reference && source.date >= q.from && source.date <= a.through)
    assert.equal(source.currency, 'USD')
   }
  }
  assert.equal(a.resident.chargedCents, before.charges.filter(c => c.due_date >= q.from && c.due_date <= a.through).reduce((n, c) => n + c.amount_cents, 0))
  assert.equal(a.housingAuthority.chargedCents, before.hapCharges.filter(c => c.due_date >= q.from && c.due_date <= a.through).reduce((n, c) => n + c.amount_cents, 0))
  assert.equal(a.resident.receivedCents, before.receipts.filter(s => s.received_date >= q.from && s.received_date <= a.through).reduce((n, s) => n + s.amount_cents, 0))
  const remittanceResponse = await h.request('/api/hap-remittances?tenancyId='+x.t.id)
  assert.equal(remittanceResponse.status, 200)
  const { remittances } = await remittanceResponse.json()
  const receivedAllocations = remittances.filter(s => s.state === 'received' && s.outcome_date >= q.from && s.outcome_date <= a.through).flatMap(s => s.allocations.filter(v => v.tenancy_id === x.t.id))
  assert.equal(a.housingAuthority.receivedCents, receivedAllocations.reduce((n, s) => n + s.amount_cents, 0), 'PHA actuals reconcile to this tenancy’s external remittance allocations only')
  const effects = before.hapEffects.filter(s => s.posting_day >= q.from && s.posting_day <= a.through)
  assert.equal(a.housingAuthority.adjustmentCents, effects.reduce((n, s) => n + s.pha_delta, 0))
  assert.ok(a.resident.receipts.every(s => before.charges.some(c => c.id === s.chargeId)))
  assert.ok(a.housingAuthority.receipts.every(s => before.hapCharges.some(c => c.id === s.chargeId)))
  assert.ok(a.housingAuthority.receipts.every(s => s.state === 'received'))
  assert.ok(a.housingAuthority.pending.every(s => s.state === 'pending'))
  for (const change of a.housingAuthority.adjustments) {
   assert.ok(change.changeId && change.noticeVersionId && change.effectiveFrom && change.effectiveTo)
   if (change.kind === 'abatement') assert.ok(!a.resident.adjustments.some(s => s.id === change.id), 'PHA abatement never becomes a resident correction')
   else if (change.residentDeltaCents) assert.equal(a.resident.adjustments.find(s => s.id === change.id).amountCents, -change.amountCents)
  }
  for (const plan of r.plans) {
   assert.equal(plan.openingCashCents, 10000)
   assert.equal(plan.afterDistributionsCents, plan.openingCashCents + plan.collectedRentCents - plan.concessionCents - plan.payableCents - plan.capitalCents - plan.reserveRequirementCents - plan.distributionsCents, 'actual receipts, pending and held money are never added to assumed cash')
  }
  const historic = await read(comparison(x.t.id, '2026-07-01', '2026-07-31'))
  assert.ok(historic.facts.payerActuals.housingAuthority.adjustments.every(s => s.date <= '2026-07-31'), 'a retroactive effective period never backdates the correction posting')
  const futureQuery = comparison(x.t.id, '2027-01-01', '2027-01-31'), future = await read(futureQuery)
  assert.equal(future.facts.payerActuals.resident.actualsRecorded, false)
  assert.equal(future.facts.payerActuals.housingAuthority.actualsRecorded, false)
  assert.equal(future.plans[0].collectedRentCents, 50001, 'absent payer outcomes preserve the explicit collection assumption')
  const missing = { ...futureQuery }; delete missing.marketOpeningCash
  assert.equal((await h.request('/api/cash-scenario?'+new URLSearchParams(missing))).status, 400, 'payer actuals cannot replace a missing explicit opening cash assumption')
  const html = await (await h.request('/app?tab=tenancy&tenancy='+x.t.id+'&scenario=1&'+new URLSearchParams(q))).text()
  for (const source of [...a.resident.charges, ...a.housingAuthority.charges, ...a.housingAuthority.adjustments, ...a.housingAuthority.receipts]) assert.ok(html.includes(source.id), 'native source drills carry the same dated source identity')
  assert.deepEqual((await h.state(x.t.id)).ledger, before, 'comparisons never mutate payer books or external outcomes')
  reports.push({ q, report: r })
 }
 return reports
}
