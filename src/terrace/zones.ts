// PORT-001: property-local calendar days. Stored dates (due, received, lease and follow-up dates) are
// property-local calendar days; recorded instants (c.now, adjustment times) are UTC and are read as the
// property-local day they fall on.
import { Fault, insist, text } from './core'

export const US_ZONES = [['America/New_York','Eastern'],['America/Chicago','Central'],['America/Denver','Mountain'],['America/Phoenix','Arizona (no daylight saving)'],['America/Los_Angeles','Pacific'],['America/Anchorage','Alaska'],['Pacific/Honolulu','Hawaii']] as const
/** The office zone until the company sets one, and the default for a new property. */
export const DEFAULT_ZONE = 'America/New_York'

/** A US property or office zone (new records). */
export function usZone(v: unknown) {
 const s = text(v, 'Time zone', 64)
 insist(US_ZONES.some(([z]) => z === s), 'invalid_time_zone', `Choose a US time zone: ${US_ZONES.map(([z]) => z).join(', ')}.`)
 return s
}
/** Any IANA zone, for an imported historical tenancy. */
export function anyZone(v: unknown) {
 const s = text(v, 'Time zone', 64)
 try { new Intl.DateTimeFormat('en-US', { timeZone: s }) } catch { throw new Fault('invalid_time_zone', `${s.slice(0, 64)} is not an IANA time zone.`) }
 return s
}
const parts = (instant: number, zone: string) => Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: zone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(new Date(instant)).map(p => [p.type, p.value]))
/** The property-local calendar day (YYYY-MM-DD) an ISO instant falls on. */
export function localDate(iso: string, zone: string) { const p = parts(Date.parse(iso), zone); return `${p.year}-${p.month}-${p.day}` }
/** Minutes the zone is ahead of UTC at an instant. */
function offset(instant: number, zone: string) { const p = parts(instant, zone); return (Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - Math.floor(instant / 1000) * 1000) / 60000 }
export const nextDay = (day: string) => new Date(Date.parse(day + 'T00:00:00Z') + 86400000).toISOString().slice(0, 10)
/** The instant a property-local day begins, with that day's UTC offset: "2026-11-01T00:00:00-04:00". */
export function dayStart(day: string, zone: string) {
 const midnight = Date.parse(day + 'T00:00:00Z')
 let off = offset(midnight, zone)
 off = offset(midnight - off * 60000, zone)
 const a = Math.abs(off)
 return `${day}T00:00:00${off < 0 ? '-' : '+'}${String(Math.floor(a / 60)).padStart(2, '0')}:${String(a % 60).padStart(2, '0')}`
}
