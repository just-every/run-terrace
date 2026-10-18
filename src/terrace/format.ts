// US display formats for the app's ISO dates (YYYY-MM-DD or ISO timestamps, read as UTC days).
const day = (iso: string) => new Date(String(iso).slice(0, 10) + 'T00:00:00Z')
const fmt = (iso: unknown, options: Intl.DateTimeFormatOptions) => {
 const d = day(String(iso ?? ''))
 return Number.isNaN(d.getTime()) ? String(iso ?? '') : new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', ...options }).format(d)
}
/** Oct 1, 2026 */
export const usDate = (iso: unknown) => fmt(iso, { month: 'short', day: 'numeric', year: 'numeric' })
/** Oct 1 */
export const shortDate = (iso: unknown) => fmt(iso, { month: 'short', day: 'numeric' })
/** October */
export const monthName = (iso: unknown) => fmt(iso, { month: 'long' })
/** OCT 19 · MONDAY */
export const eyebrowDate = (iso: unknown) => `${shortDate(iso)} · ${fmt(iso, { weekday: 'long' })}`.toUpperCase()
/** Whole days from a to b. */
export const daysBetween = (a: string, b: string) => Math.round((day(b).getTime() - day(a).getTime()) / 86400000)
/** "Unit 2B, 1840 Alder Street, Oakland, CA 94610" -> unit "2B" and property "1840 Alder Street, Oakland, CA 94610". */
export function place(address: string) {
 const m = /^(unit|apt\.?|apartment|suite|ste\.?|#)\s*([^,]+),\s*(.+)$/i.exec(address.trim())
 // "Unit" is implied ("2B"); any other prefix stays ("Apt 6").
 return m ? { unit: (/^unit$/i.test(m[1]) ? '' : m[1] + ' ') + m[2].trim(), property: m[3].trim() } : { unit: '', property: address.trim() }
}
/** Up to two initials: "Maya Chen" -> "MC". */
export const initials = (name: string) => name.trim().split(/\s+/).filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase() || '?'
/** One of six avatar tints, fixed per name. */
export const tint = (name: string) => [...name].reduce((s, ch) => (s * 31 + ch.charCodeAt(0)) >>> 0, 7) % 6
