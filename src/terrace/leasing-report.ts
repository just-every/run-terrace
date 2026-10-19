// REPORT-003: read-only performance from recorded inventory, lease intervals, external receipts,
// staff-recorded prospect stages and approved renewal history. No delivery, signature or bank settlement is inferred.
import { all, allow, can, date, insist, reaches, reachesPortfolio, text, type Context, type Row } from './core'
import { localDate } from './zones'
import { turnoverData } from './turnovers'
import { dayDistance, economicMetrics, funnelMetrics, marketPotential, occupancyMetrics, percent, renewalMetrics } from './leasing-metrics'

export async function leasingReport(c: Context, q: Row) {
 allow(c, 'reports.read')
 const from = date(q.from, 'From'), to = date(q.to, 'To')
 insist(to >= from && dayDistance(from, to) < 732, 'invalid_window', 'Choose an inclusive window of 1 to 732 days, with To on or after From.')
 const propertyId = q.propertyId ? text(q.propertyId, 'Property', 100) : null
 const unitId = q.unitId ? text(q.unitId, 'Unit', 100) : null
 const [propertyRows, unitRows, leaseRows, historyRows, proposalRows, prospectRows, events, receipts, boards] = await Promise.all([
  all(c, 'SELECT id,portfolio_id,name,time_zone FROM tt_properties ORDER BY name,id'),
  all(c, 'SELECT id,property_id,identifier,rentable,market_rent_cents,created_at,version,available_on FROM tt_units ORDER BY identifier,id'),
  all(c, 'SELECT id,unit_id,start_date,end_date,ended_on,created_at,currency,currency_confirmed FROM tt_tenancies WHERE unit_id IS NOT NULL ORDER BY start_date,id'),
  all(c, 'SELECT id,tenancy_id,start_date,end_date,proposal_id,confirmed_at FROM tt_lease_history ORDER BY confirmed_at,id'),
  all(c, "SELECT id,tenancy_id,payload,state,prepared_at,approved_at FROM tt_proposals WHERE kind='renewal' ORDER BY prepared_at,id"),
  all(c, 'SELECT id,property_id,first_source,first_reference,review,merged_into,created_at FROM tt_prospects ORDER BY created_at,id'),
  all(c, "SELECT id,prospect_id,kind,detail,reference,recorded_at FROM tt_prospect_events WHERE kind='stage' ORDER BY recorded_at,rowid"),
  all(c, `SELECT r.id,r.charge_id,r.amount_cents,r.received_date,r.reference,r.created_at,r.currency,r.method,
   q.tenancy_id,q.due_date,q.currency AS charge_currency,q.term_id,term.kind AS charge_kind,
   t.unit_id,t.currency AS tenancy_currency,t.currency_confirmed
   FROM tt_receipts r JOIN tt_charges q ON q.id=r.charge_id JOIN tt_tenancies t ON t.id=q.tenancy_id
   LEFT JOIN tt_lease_terms term ON term.id=q.term_id WHERE r.received_date>=? AND r.received_date<=?
   ORDER BY r.received_date,r.id`, from, to),
  turnoverData(c),
 ])
 const visibleProperties = propertyRows.filter(p => reachesPortfolio(c, p.portfolio_id))
 insist(!propertyId || visibleProperties.some(p => p.id === propertyId), 'not_found', 'Property not found.', 404)
 const visibleIds = new Set(visibleProperties.map(p => p.id))
 const scopedUnits = unitRows.filter(u => visibleIds.has(u.property_id) && reaches(c, u.id) && (!propertyId || u.property_id === propertyId))
 insist(!unitId || scopedUnits.some(u => u.id === unitId), 'not_found', 'Unit not found.', 404)
 const selected = scopedUnits.filter(u => !unitId || u.id === unitId)
 const selectedProperties = visibleProperties.filter(p => (!propertyId || p.id === propertyId) && (!unitId || selected.some(u => u.property_id === p.id)))
 for (const p of selectedProperties) insist(to <= localDate(c.now, p.time_zone), 'invalid_window', 'To cannot be after today in any selected property’s time zone. Future move-ins and make-ready dates are shown separately as schedules.')
 if (!selectedProperties.length) insist(to <= localDate(c.now, c.zone!), 'invalid_window', 'To cannot be after today in the office time zone when no property is selected.')
 const propertyMap = new Map(selectedProperties.map(p => [p.id, p]))
 const inventory: Row[] = selected.map(u => ({ ...u, time_zone: propertyMap.get(u.property_id)!.time_zone }))
 const unitMap = new Map(inventory.map(u => [u.id, u])), ids = new Set(inventory.map(u => u.id))
 const leases = leaseRows.filter(t => ids.has(t.unit_id)), tenancyIds = new Set(leases.map(t => t.id))
 const history = historyRows.filter(h => tenancyIds.has(h.tenancy_id)), proposals = proposalRows.filter(p => tenancyIds.has(p.tenancy_id))
 const gaps: Row[] = [], sources: Row[] = []
 let totalPotential = 0n, totalReceipts = 0, economicUnits = 0
 const units = inventory.map(u => {
  const rentable = u.rentable === 1
  const occupied = occupancyMetrics(u, leases, from, to)
  const counted = rentable ? occupied : { ...occupied, rentableDays: 0, occupiedDays: 0, vacantDays: 0, occupancyPercent: null }
  if (!rentable) gaps.push({ code: 'unit_not_rentable', unitId: u.id, message: 'Current nonrentable units are excluded from occupancy and economic totals.' })
  if (u.rentable === 1) gaps.push({ code: 'inventory_snapshot', unitId: u.id, date: c.now, message: 'Rentable status is the current snapshot; historical changes to rentable status are not recorded.' })
  sources.push({ kind: 'unit', unitId: u.id, propertyId: u.property_id, date: occupied.inventoryFrom, recordedAt: u.created_at, version: u.version })
  for (const t of occupied.tenancies) sources.push({ kind: 'tenancy', unitId: u.id, ...t })
  const eligible = rentable && occupied.rentableDays > 0 && u.market_rent_cents !== null
  if (rentable && u.market_rent_cents === null) gaps.push({ code: 'market_rent_missing', unitId: u.id, message: 'No current market rent; both potential rent and this unit’s receipts are excluded from economic vacancy.' })
  const potential = eligible ? marketPotential(u.market_rent_cents, occupied.daily.map(d => d.date)) : 0n
  if (eligible) {
   totalPotential += potential; economicUnits++
   sources.push({ kind: 'market_rent_snapshot', unitId: u.id, date: c.now, monthlyCents: u.market_rent_cents, currency: 'USD', assumption: true, version: u.version })
  }
  const paid: Row[] = [], excludedReceipts: Row[] = []
  for (const r of receipts.filter(r => r.unit_id === u.id)) {
   const receipt: Row = { receiptId: r.id, chargeId: r.charge_id, tenancyId: r.tenancy_id, unitId: u.id, date: r.received_date,
    amountCents: r.amount_cents, reference: r.reference, recordedAt: r.created_at, chargeDueDate: r.due_date, termId: r.term_id,
    chargeKind: r.charge_kind, currency: r.currency, method: r.method ?? 'not_recorded' }
   const reason = !eligible ? 'unit_excluded_from_economic_comparison' : r.received_date < occupied.inventoryFrom ? 'before_recorded_inventory' :
    r.currency_confirmed === 0 ? 'currency_unconfirmed' : [r.currency, r.charge_currency, r.tenancy_currency].some(k => k !== 'USD') ? 'non_usd' :
    !r.charge_kind ? 'charge_kind_not_recorded' : r.charge_kind !== 'rent' ? 'non_rent_charge' : null
   if (reason) {
    excludedReceipts.push({ ...receipt, reason })
    if (reason !== 'non_rent_charge') gaps.push({ code: reason, unitId: u.id, receiptId: r.id, chargeId: r.charge_id, date: r.received_date })
   } else paid.push(receipt)
  }
  const rentReceiptsCents = paid.reduce((n, r) => n + r.amountCents, 0)
  totalReceipts += rentReceiptsCents
  sources.push(...paid.map(r => ({ kind: 'rent_receipt', ...r })), ...excludedReceipts.map(r => ({ kind: 'excluded_receipt', ...r })))
  const turnovers = boards.filter(b => b.unit_id === u.id).map(b => {
   const recordedByEnd = localDate(b.created_at, u.time_zone) <= to
   const publishedByEnd = !!b.published_at && localDate(b.published_at, u.time_zone) <= to
   return { turnoverId: b.id, state: publishedByEnd ? b.state : 'open', moveOut: b.move_out, availableOn: publishedByEnd ? b.available_on : null,
    publishedAt: publishedByEnd ? b.published_at : null, forecastReadyDate: b.readyDate, forecastAsOf: c.now, recordedByWindowEnd: recordedByEnd,
    readyByWindowEnd: publishedByEnd && b.available_on <= to, taskIds: b.tasks.map((t: Row) => t.id), listingFreshness: 'unknown' }
  })
  sources.push(...turnovers.map(t => ({ kind: 'turnover', unitId: u.id, ...t })))
  gaps.push({ code: 'listing_freshness_unknown', unitId: u.id, message: 'LEASE-001 listing publication and freshness are not recorded; ready does not mean listed or fresh.' })
  const economic = eligible ? economicMetrics(potential, rentReceiptsCents) : { potentialRentCents: null, potentialRentExact: null, rentReceiptsCents: null, economicVacancyCents: null, economicVacancyPercent: null }
  return { unitId: u.id, propertyId: u.property_id, property: propertyMap.get(u.property_id)!.name, timeZone: u.time_zone, identifier: u.identifier,
   rentable, ...counted, marketRentCents: u.market_rent_cents, marketRentAsOf: c.now, ...economic, economicIncluded: eligible,
   economicCoverage: excludedReceipts.some(r => r.reason !== 'non_rent_charge') ? 'partial' : eligible ? 'recorded_rent_receipts_only' : 'excluded',
   receipts: paid, excludedReceipts, turnovers, listingFreshness: 'unknown' }
 })
 const eligibleUnits = units.filter(u => u.rentable), rentableDays = eligibleUnits.reduce((n, u) => n + u.rentableDays, 0)
 const occupiedDays = eligibleUnits.reduce((n, u) => n + u.occupiedDays, 0)
 const scopedProspects = prospectRows.filter(p => propertyMap.has(p.property_id))
 const acquisition = unitId ? { funnel: [], excludedProspects: [], reviewedSeparate: [] } : funnelMetrics(scopedProspects, events, propertyMap, from, to)
 if (unitId) gaps.push({ code: 'prospect_unit_attribution_missing', unitId, message: 'Prospects are attributed to properties, not units; unit drill-down excludes the acquisition funnel.' })
 const renewals = renewalMetrics(leases, history, proposals, unitMap, from, to)
 sources.push(...renewals.flatMap(r => [{ kind: 'lease_expiry', tenancyId: r.tenancyId, unitId: r.unitId, date: r.leaseEnd, leaseHistoryId: r.leaseHistoryId },
  ...r.sources.map(p => ({ kind: 'renewal_proposal', tenancyId: r.tenancyId, unitId: r.unitId, ...p }))]))
 const hasProspectRead = can(c, 'prospect.read')
 if (hasProspectRead) sources.push(...acquisition.funnel.flatMap(f => f.prospects.flatMap(p => [{ kind: 'prospect_first_contact', prospectId: p.prospectId, propertyId: p.propertyId, date: p.createdOn, source: f.source, reference: p.firstReference }, ...p.events.map(e => ({ kind: 'prospect_stage', prospectId: p.prospectId, ...e }))])))
 const accepted = renewals.filter(r => r.status === 'accepted').length
 const sum = (field: 'leads' | 'showing' | 'applied' | 'leased') => acquisition.funnel.reduce((n, f) => n + f[field], 0)
 return {
  from, to, asOf: c.now, propertyId, unitId, units, sources, renewals,
  properties: selectedProperties.map(p => ({ propertyId: p.id, name: p.name, timeZone: p.time_zone })),
  funnel: acquisition.funnel.map(f => ({ ...f, prospects: hasProspectRead ? f.prospects : [] })),
  excludedProspects: hasProspectRead ? acquisition.excludedProspects : [], reviewedSeparate: hasProspectRead ? acquisition.reviewedSeparate : [],
  prospectAccess: hasProspectRead ? 'ids_and_source_references' : 'aggregate_only',
  summary: { rentableUnits: eligibleUnits.length, rentableDays, occupiedDays, vacantDays: rentableDays - occupiedDays, occupancyPercent: percent(occupiedDays, rentableDays),
   ...(economicUnits ? economicMetrics(totalPotential, totalReceipts) : { potentialRentCents: null, potentialRentExact: null, rentReceiptsCents: null, economicVacancyCents: null, economicVacancyPercent: null }),
   economicUnits, economicExcludedUnits: eligibleUnits.length - economicUnits, economicCoverage: gaps.some(g => ['market_rent_missing', 'charge_kind_not_recorded', 'currency_unconfirmed', 'non_usd', 'before_recorded_inventory'].includes(g.code)) ? 'partial' : economicUnits ? 'recorded_rent_receipts_only' : 'excluded',
   leads: sum('leads'), showing: sum('showing'), applied: sum('applied'), leased: sum('leased'), sourceConversionPercent: percent(sum('leased'), sum('leads')),
   excludedMerged: acquisition.excludedProspects.filter(p => p.reason === 'merged').length, excludedHeld: acquisition.excludedProspects.filter(p => p.reason === 'duplicate_held').length,
   reviewedSeparate: acquisition.reviewedSeparate.length, renewalCohort: renewals.length, renewalAccepted: accepted,
   renewalPending: renewals.filter(r => r.status === 'pending').length, renewalRejected: renewals.filter(r => r.status === 'rejected').length,
   renewalNonrenewed: renewals.filter(r => r.status === 'nonrenewed').length, renewalRetentionPercent: percent(accepted, renewals.length) },
  formulas: {
   dates: 'Inclusive property-local dates, at most 732 days, ending no later than property-local today. Inventory begins on the unit’s recorded local creation day.',
   occupancy: 'Occupied rentable unit-days / rentable unit-days × 100. A tenancy covers start_date through ended_on or end_date, inclusive. Current rentable status is a snapshot, not historical inventory evidence.',
   vacancy: 'Vacant days are rentable unit-days without a tenancy. Spells are contiguous unoccupied days since recorded inventory or the prior tenancy’s inclusive last occupancy day plus one. Window counts are clipped; future move-ins remain schedules.',
   daysToLease: 'max(0, next tenancy created_at local date − vacancy start). Recording before vacancy is preleased. This is not days to move-in or evidence of signature; unknown when no next tenancy was recorded by To.',
   economicVacancy: '(estimated potential rent − recorded external rent receipts received in the window) / estimated potential rent × 100; may be negative. Current monthly USD market rent / actual days in each calendar month, summed as exact rational daily cents and rounded half up once. Summary rounds once across all units.',
   economicAssumptions: `Current market rent and rentable status are snapshots taken at ${c.now}; historical market rents are not recorded. Missing-market units are excluded from both potential and receipts. Only term-classified rent charges and confirmed USD receipts qualify; unclassified, unconfirmed and other-currency receipts are excluded and surfaced. Adjustments reduce receivables, never external cash receipts. This is recorded cash collection, not bank settlement, accrual vacancy or a reconciliation.`,
   leadConversion: 'Leased / leads × 100 in first-source cohorts created within the inclusive window. Merged and held duplicate rows are excluded; reviewed separate leads remain distinct. Only stage events with effective and recorded local dates on or before To count. Stages are staff-recorded, not independently verified; skipped stages are never fabricated.',
   dropoff: 'Showing drop-off counts leads with a shown event but no applied event; application drop-off counts leads with an applied event but no leased event. Percentages divide by shown and applied leads respectively; no inferred intermediate events.',
   retention: 'Accepted approved recorded renewals / original lease-term expiries in the window × 100. Prior ends come from tt_lease_history and current/ended tenancies. Approval must be recorded locally on or before To and linked to the original term history. Pending, rejected and nonrenewed are separate. No delivered offer or electronic signature is inferred.',
   turnover: 'availableOn is the published actual availability record; forecastReadyDate is the current task plan as of the report instant. Ready-by-window-end also requires publication and availability by To. Listing publication and freshness are unknown (LEASE-001).',
  }, gaps,
 }
}
