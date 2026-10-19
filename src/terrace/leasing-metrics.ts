import { type Row } from './core'
import { localDate } from './zones'
import { occupiedTo } from './properties'

const DAY = 86400000
export const shiftDay = (d: string, n: number) => new Date(Date.parse(d + 'T00:00:00Z') + n * DAY).toISOString().slice(0, 10)
export const dayDistance = (a: string, b: string) => Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / DAY)
export const percent = (n: number, d: number) => d ? Math.round(n / d * 10000) / 100 : null
export const daysIn = (a: string, b: string) => Math.max(0, dayDistance(a, b) + 1)
const later = (a: string, b: string) => a > b ? a : b
const earlier = (a: string, b: string) => a < b ? a : b

/** Inventory starts when the unit was recorded; lease intervals include the move-out day. */
export function occupancyMetrics(unit: Row, leases: Row[], from: string, to: string) {
 const inventoryFrom = localDate(unit.created_at, unit.time_zone), start = later(from, inventoryFrom)
 const mine = leases.filter(t => t.unit_id === unit.id).sort((a, b) => a.start_date.localeCompare(b.start_date))
 const daily: Row[] = []
 for (let day = start; day <= to; day = shiftDay(day, 1)) {
  const tenancyIds = mine.filter(t => t.start_date <= day && occupiedTo(t) >= day).map(t => t.id)
  daily.push({ date: day, occupied: tenancyIds.length > 0, tenancyIds })
 }
 // Build full contiguous gaps first, then intersect them with the requested window. This preserves a
 // vacancy's true recorded start when the report begins partway through the spell.
 const vacancySpells: Row[] = []
 let cursor = inventoryFrom, previous: Row | undefined
 const gap = (end: string, next?: Row) => {
  if (cursor > end || cursor > to || end < start) return
  const a = later(cursor, start), b = earlier(end, to), recorded = next ? localDate(next.created_at, unit.time_zone) : null
  const known = recorded !== null && recorded <= to
  vacancySpells.push({ from: cursor, to: earlier(end, to), days: daysIn(cursor, earlier(end, to)), windowFrom: a, windowTo: b,
   daysInWindow: daysIn(a, b), previousTenancyId: previous?.id ?? null, nextTenancyId: next?.id ?? null,
   nextMoveIn: next?.start_date ?? null, scheduledVacancyEnd: next ? shiftDay(next.start_date, -1) : null,
   leaseRecordedOn: known ? recorded : null, daysToLease: known ? Math.max(0, dayDistance(cursor, recorded!)) : null,
   preleased: known ? recorded! < cursor : false, signedStatus: 'not_known', leaseEvent: known ? 'tenancy.created_at' : 'not_recorded_by_window_end' })
 }
 for (const t of mine) {
  if (occupiedTo(t) < inventoryFrom) { previous = t; continue }
  if (t.start_date > cursor) gap(shiftDay(t.start_date, -1), t)
  const after = shiftDay(occupiedTo(t), 1)
  if (after > cursor) { cursor = after; previous = t }
 }
 if (cursor <= to) gap(to)
 const occupiedDays = daily.filter(d => d.occupied).length
 return { inventoryFrom, windowFrom: start <= to ? start : null, windowTo: start <= to ? to : null,
  rentableDays: daily.length, occupiedDays, vacantDays: daily.length - occupiedDays,
  occupancyPercent: percent(occupiedDays, daily.length), daily, vacancySpells,
  tenancies: mine.map(t => ({ tenancyId: t.id, startDate: t.start_date, endDate: t.end_date, occupiedTo: occupiedTo(t), createdAt: t.created_at, createdOn: localDate(t.created_at, unit.time_zone) })) }
}

// The common multiple of all possible calendar-month lengths allows exact integer accumulation.
export const RENT_DENOMINATOR = 377580n
export const roundedPotential = (n: bigint) => Number((n + RENT_DENOMINATOR / 2n) / RENT_DENOMINATOR)
export function marketPotential(monthlyCents: number, dates: string[]) {
 return dates.reduce((total, d) => {
  const [year, month] = d.split('-').map(Number), length = new Date(Date.UTC(year, month, 0)).getUTCDate()
  return total + BigInt(monthlyCents) * (RENT_DENOMINATOR / BigInt(length))
 }, 0n)
}
export function economicMetrics(potential: bigint, receipts: number) {
 const cents = roundedPotential(potential), loss = potential - BigInt(receipts) * RENT_DENOMINATOR
 return { potentialRentCents: cents, potentialRentExact: { numerator: potential.toString(), denominator: RENT_DENOMINATOR.toString() },
  rentReceiptsCents: receipts, economicVacancyCents: cents - receipts,
  economicVacancyPercent: potential ? Math.round(Number(loss) / Number(potential) * 10000) / 100 : null }
}

/** First-contact cohorts; only recorded stage evidence is counted, with no inferred intermediate stages. */
export function funnelMetrics(prospects: Row[], events: Row[], properties: Map<string, Row>, from: string, to: string) {
 const cohort = prospects.filter(p => {
  const on = localDate(p.created_at, properties.get(p.property_id)!.time_zone)
  return on >= from && on <= to
 })
 const excluded = cohort.filter(p => p.merged_into || p.review === 'possible_duplicate').map(p => ({ prospectId: p.id, propertyId: p.property_id, reason: p.merged_into ? 'merged' : 'duplicate_held', mergedInto: p.merged_into ?? null }))
 const accepted = cohort.filter(p => !p.merged_into && p.review !== 'possible_duplicate')
 const funnel = [...new Set(accepted.map(p => p.first_source))].sort().map(source => {
  const rows = accepted.filter(p => p.first_source === source).map(p => {
   const zone = properties.get(p.property_id)!.time_zone
   const history = events.filter(e => e.prospect_id === p.id && e.kind === 'stage' && localDate(e.recorded_at, zone) <= to).map(e => {
    const detail = JSON.parse(e.detail)
    return { eventId: e.id, date: detail.on, recordedAt: e.recorded_at, recordedOn: localDate(e.recorded_at, zone), stage: detail.to, reference: e.reference }
   }).filter(e => typeof e.date === 'string' && e.date <= to)
   const latest = [...history].sort((a, b) => a.recordedAt.localeCompare(b.recordedAt)).at(-1)
   return { prospectId: p.id, propertyId: p.property_id, createdOn: localDate(p.created_at, zone), firstReference: p.first_reference,
    review: p.review, stage: latest?.stage ?? 'enquiry', events: history,
    showing: history.some(e => e.stage === 'shown'), applied: history.some(e => e.stage === 'applied'), leased: history.some(e => e.stage === 'leased') }
  })
  const showing = rows.filter(p => p.showing).length, applied = rows.filter(p => p.applied).length, leased = rows.filter(p => p.leased).length
  // Intersection-based drop-off also handles a legal forward stage jump without inventing a showing.
  const showingWithoutApplication = rows.filter(p => p.showing && !p.applied).length
  const applicationsWithoutLease = rows.filter(p => p.applied && !p.leased).length
  return { source, leads: rows.length, showing, applied, leased, conversionPercent: percent(leased, rows.length),
   showingToApplicationDropoff: showingWithoutApplication, showingToApplicationDropoffPercent: percent(showingWithoutApplication, showing),
   applicationToLeaseDropoff: applicationsWithoutLease, applicationToLeaseDropoffPercent: percent(applicationsWithoutLease, applied), prospects: rows }
 })
 return { funnel, excludedProspects: excluded, reviewedSeparate: accepted.filter(p => p.review === 'kept_separate').map(p => p.id) }
}

/** Each original term expiry stays in its cohort after an approved renewal extends the current end. */
export function renewalMetrics(leases: Row[], history: Row[], proposals: Row[], units: Map<string, Row>, from: string, to: string) {
 return leases.flatMap(t => {
  const u = units.get(t.unit_id), zone = u!.time_zone
  const past = history.filter(h => h.tenancy_id === t.id).sort((a, b) => a.confirmed_at.localeCompare(b.confirmed_at))
  const expires = [...past.map(h => ({ leaseEnd: h.end_date, history: h })), { leaseEnd: t.end_date, history: null as Row | null }]
  return expires.filter(e => e.leaseEnd >= from && e.leaseEnd <= to).map(e => {
   const candidates = proposals.filter(p => {
    if (p.tenancy_id !== t.id || localDate(p.prepared_at, zone) > to) return false
    const originalEnd = past.find(h => h.confirmed_at >= p.prepared_at)?.end_date ?? t.end_date
    return originalEnd === e.leaseEnd || e.history?.proposal_id === p.id
   }).map(p => ({ proposalId: p.id, preparedOn: localDate(p.prepared_at, zone), preparedAt: p.prepared_at,
    decisionOn: p.approved_at ? localDate(p.approved_at, zone) : null, state: p.approved_at && localDate(p.approved_at, zone) <= to ? p.state : 'pending',
    source: JSON.parse(p.payload).source, proposedEnd: JSON.parse(p.payload).endDate }))
   const approved = candidates.find(p => p.state === 'approved' && past.some(h => h.proposal_id === p.proposalId && h.end_date === e.leaseEnd && localDate(h.confirmed_at, zone) <= to))
   const status = approved ? 'accepted' : candidates.some(p => p.state === 'pending') ? 'pending' : candidates.some(p => p.state === 'rejected') ? 'rejected' : 'nonrenewed'
   return { tenancyId: t.id, unitId: t.unit_id, propertyId: u!.property_id, leaseEnd: e.leaseEnd, leaseHistoryId: e.history?.id ?? null,
    status, proposalId: approved?.proposalId ?? candidates.at(-1)?.proposalId ?? null, approvedOn: approved?.decisionOn ?? null,
    signedStatus: 'not_known', endedOn: t.ended_on ?? null, sources: candidates }
  })
 })
}
