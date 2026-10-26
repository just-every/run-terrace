import { all, insist, reaches, type Context, type Row } from './core'
import { localDate } from './zones'

const total = (rows: Row[], key = 'amountCents') => rows.reduce((n, r) => {
 const value = n + r[key]
 insist(Number.isSafeInteger(value), 'scenario_actuals', 'Recorded payer amounts exceed exact integer cents.', 409)
 return value
}, 0)

/** PAY-013 activity inside the comparison horizon, reconstructed from dated records known now. */
export async function hapActuals(c: Context, t: Row, from: string, to: string) {
 const today = localDate(c.now, t.time_zone), through = to < today ? to : today
 const inside = (day: string) => day >= from && day <= through
 const [charges, receipts, adjustments, phaCharges, changes, effects, payments, events, remittances, allocations, leases] = await Promise.all([
  all(c, 'SELECT q.*,l.lease_version_id,l.source_clause FROM tt_charges q LEFT JOIN tt_lease_terms l ON l.id=q.term_id WHERE q.tenancy_id=? ORDER BY q.due_date,q.id', t.id),
  all(c, 'SELECT r.* FROM tt_net_receipts r JOIN tt_charges q ON q.id=r.charge_id WHERE q.tenancy_id=? ORDER BY r.received_date,r.id', t.id),
  all(c, 'SELECT a.* FROM tt_adjustments a JOIN tt_charges q ON q.id=a.charge_id WHERE q.tenancy_id=? ORDER BY a.at,a.id', t.id),
  all(c, 'SELECT * FROM tt_hap_charges WHERE tenancy_id=? ORDER BY due_date,id', t.id),
  all(c, 'SELECT * FROM tt_hap_changes WHERE tenancy_id=? AND approved_at IS NOT NULL', t.id),
  all(c, 'SELECT * FROM tt_hap_effects WHERE tenancy_id=? ORDER BY posting_day,id', t.id),
  all(c, 'SELECT * FROM tt_payments WHERE tenancy_id=? ORDER BY received_date,id', t.id),
  all(c, 'SELECT e.* FROM tt_payment_events e JOIN tt_payments p ON p.id=e.payment_id WHERE p.tenancy_id=? ORDER BY e.on_day,e.recorded_at,CASE e.state WHEN \'pending\' THEN 0 ELSE 1 END,e.id', t.id),
  all(c, 'SELECT DISTINCT r.* FROM tt_hap_remittances r LEFT JOIN tt_hap_allocations a ON a.remittance_id=r.id LEFT JOIN tt_hap_charges q ON q.id=a.charge_id WHERE r.source_tenancy_id=? OR q.tenancy_id=? ORDER BY r.received_date,r.id', t.id, t.id),
  all(c, 'SELECT a.*,q.tenancy_id FROM tt_hap_allocations a JOIN tt_hap_charges q ON q.id=a.charge_id WHERE a.remittance_id IN (SELECT id FROM tt_hap_remittances WHERE source_tenancy_id=? UNION SELECT a.remittance_id FROM tt_hap_allocations a JOIN tt_hap_charges q ON q.id=a.charge_id WHERE q.tenancy_id=?)', t.id, t.id),
  all(c, 'SELECT id,unit_id,erased_at FROM tt_tenancies'),
 ])
 const source = (kind: string, r: Row, day: string, amountCents: number, more: Row = {}): Row => {
  insist(r.currency === undefined || r.currency === t.currency, 'scenario_currency', 'A payer source uses another currency. No conversion is performed.', 409)
  return { kind, id: r.id, date: day, amountCents, currency: t.currency, reference: r.reference ?? r.id, ...more }
 }
 const residentCharges = charges.filter(q => inside(q.due_date)).map(q => source('charge', q, q.due_date, q.amount_cents, { chargeId: q.id, leaseVersionId: q.lease_version_id, sourceClause: q.source_clause, periodStart: q.period_start, periodEnd: q.period_end }))
 const residentReceipts = receipts.filter(r => inside(r.received_date)).map(r => source(r.reversal_of ? 'receipt_reversal' : 'external_receipt', r, r.received_date, r.amount_cents, { chargeId: r.charge_id, reversalOf: r.reversal_of }))
 const residentAdjustments = adjustments.map(a => ({ ...a, day: a.posting_day ?? localDate(a.at, t.time_zone) })).filter(a => inside(a.day)).map(a => source('adjustment', a, a.day, -a.amount_cents, { chargeId: a.charge_id, reason: a.reason }))
 const residentOutcomes: Row[] = residentReceipts.map(r => ({ ...r, state: r.reversalOf ? 'reversed_or_refunded' : 'recorded_external' })), residentPending: Row[] = [], residentHeld: Row[] = []
 for (const p of payments) {
  const dated = events.filter(e => e.payment_id === p.id && e.on_day <= through), last = dated.at(-1)
  for (const e of dated.filter(e => inside(e.on_day))) residentOutcomes.push(source('payment_outcome', e, e.on_day, p.amount_cents, { paymentId: p.id, state: e.state }))
  if (!last) continue
  if (last.state === 'pending' && inside(p.received_date)) residentPending.push(source('pending_payment', p, p.received_date, p.amount_cents, { state: 'pending' }))
  if (last.state === 'settled' && inside(last.on_day) && p.credit_cents) residentHeld.push(source('unapplied_credit', p, last.on_day, p.credit_cents, { state: 'recorded_external', basis: 'Separate unapplied resident credit; excluded from rent receipts' }))
 }
 const authorityCharges = phaCharges.filter(q => inside(q.due_date)).map(q => source('charge', q, q.due_date, q.amount_cents, { chargeId: q.id, leaseVersionId: q.lease_version_id, sourceClause: q.source_clause, contractReference: q.contract_reference, periodStart: q.period_start, periodEnd: q.period_end }))
 const effectSources = effects.filter(x => inside(x.posting_day)).map(x => {
  const change = changes.find(r => r.id === x.change_id)
  insist(change, 'scenario_actuals', 'A payer correction needs its approved PHA notice source.', 409)
  return source(change.kind === 'abatement' ? 'abatement' : 'split_adjustment', { ...x, reference: change.reference }, x.posting_day, x.pha_delta, { changeId: change.id, chargeId: x.hap_charge_id, residentChargeId: x.resident_charge_id, residentDeltaCents: x.resident_delta, effectiveFrom: x.effective_from, effectiveTo: x.effective_to, reason: change.reason, noticeVersionId: change.notice_version_id })
 })
 const authorityReceipts: Row[] = [], authorityPending: Row[] = [], authorityHeld: Row[] = [], authorityOutcomes: Row[] = []
 for (const r of remittances) {
  const allAllocations = allocations.filter(a => a.remittance_id === r.id)
  const visible = [r.source_tenancy_id, ...allAllocations.map(a => a.tenancy_id)].every(key => {
   const lease = leases.find(l => l.id === key)
   return lease && !lease.erased_at && reaches(c, lease.unit_id)
  })
  const metadata = visible ? { reference: r.reference, outcomeReference: r.outcome_date && r.outcome_date <= through ? r.outcome_reference : null, noticeVersionId: r.source_document_version_id } : { reference: r.id, sourceRestricted: true }
  const state = r.outcome_date && r.outcome_date <= through ? r.state : 'pending'
  const outcomeDay = state === 'pending' ? r.received_date : r.outcome_date
  if (inside(outcomeDay)) {
   const own = allAllocations.filter(a => a.tenancy_id === t.id)
   for (const a of own) {
    const row = source('remittance_allocation', a, outcomeDay, a.amount_cents, { remittanceId: r.id, chargeId: a.charge_id, state, recordedAt: a.recorded_at, ...metadata })
    authorityOutcomes.push(row)
    if (state === 'received') authorityReceipts.push(row)
    if (state === 'pending') authorityPending.push(row)
   }
  }
  // Shared held amounts are shown once as a remittance exception, never as this tenancy's income.
  if (visible && state !== 'failed' && inside(r.received_date)) {
   const held = r.amount_cents - total(allAllocations.map(a => ({ amountCents: a.amount_cents })))
   if (held) authorityHeld.push(source('unmatched_remittance', r, r.received_date, held, { remittanceId: r.id, state, ...metadata, basis: 'Shared remittance remainder; no tenancy or owner allocation' }))
  }
 }
 const group = (payer: string, billed: Row[], received: Row[], adjusted: Row[], pending: Row[], held: Row[], outcomes: Row[]) => ({ payer, charges: billed, receipts: received, adjustments: adjusted, pending, held, outcomes, chargedCents: total(billed), receivedCents: total(received), adjustmentCents: total(adjusted), pendingCents: total(pending), heldCents: total(held), actualsRecorded: [...billed, ...received, ...adjusted, ...pending, ...held, ...outcomes].length > 0 })
 return {
  from, to, through, recordedAt: c.now, currency: t.currency,
  resident: group('Resident', residentCharges, residentReceipts, [...residentAdjustments, ...effectSources.filter(x => x.residentDeltaCents).map(x => ({ ...x, amountCents: x.residentDeltaCents, chargeId: x.residentChargeId, basis: 'Signed resident receivable correction; no cash receipt' }))], residentPending, residentHeld, residentOutcomes),
  housingAuthority: { ...group('Housing authority', authorityCharges, authorityReceipts, effectSources, authorityPending, authorityHeld, authorityOutcomes), abatementCents: -total(effectSources.filter(x => x.kind === 'abatement')) },
  forecastBasis: 'Future rent and collection remain explicit plan assumptions. Recorded payer portions and outcomes are separate horizon activity, never opening cash or a predicted payer split. Missing actuals mean not recorded, never confirmed zero. Historical shared charges retain their recorded resident ledger identity without an inferred HAP split.',
  boundary: 'Effective dates reconstructed from records known now, limited to the horizon through property-local today. These are activity totals, not opening or closing balances. Receipts are recorded externally; pending funds and shared held remainders prove neither bank settlement nor future collection. Outcome rows describe the same receipts and are never added a second time. Source details spanning inaccessible tenancies are restricted. No payer actual changes forecast cash arithmetic.',
 }
}
