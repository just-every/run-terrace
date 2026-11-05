import type { Row } from './core'
import { nextDay } from './zones'

/** Renewal history stores the approved lease's cumulative dates. Resolve each
 * successive term from the day after the earlier end, including older records. */
export function leaseTermSchedule(t: Row, history: Row[]): Row[] {
 const previous = history.filter(h => h.tenancy_id === t.id).sort((a,b) => a.end_date.localeCompare(b.end_date))
 let start = t.start_date
 const terms = previous.map(h => {
  const term = {...h, start_date: start}
  start = nextDay(h.end_date)
  return term
 })
 return [...terms, {start_date: start, end_date: t.end_date, rent_cents: t.rent_cents, currency: t.currency}]
}

export function leaseTermsOn(t: Row, history: Row[], day: string): Row {
 const terms = leaseTermSchedule(t, history)
 return terms.find(term => term.start_date <= day && term.end_date >= day) ?? (day < t.start_date ? terms[0] : terms.at(-1)!)
}
