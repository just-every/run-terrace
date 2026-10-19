// PORT-003 on the Properties page: the owner directory with W-9 status and allocation statements, and each
// property's ownership shares, transfer history and management agreement.
import { escape as e, money, type Row } from './core'
import { usDate } from './format'
import { agreementOn, sharesOn } from './owners'

const hidden = (name: string, value: unknown) => `<input type="hidden" name="${e(name)}" value="${e(value)}">`
const form = (command: string, body: string) => `<form method="post" action="/app/command">${hidden('command', command)}${hidden('tab', 'properties')}${body}</form>`
const field = (label: string, name: string, type = 'text', extra = '') => `<label>${e(label)}<input name="${e(name)}" type="${type}" ${extra}></label>`
const pct = (bp: number) => `${(bp / 100).toFixed(2).replace(/\.00$/, '')}%`
const w9 = (o: Row) => o.w9_status === 'received' ? `W-9 received ${usDate(o.w9_date)} · kept at ${e(o.w9_location)}` : o.w9_status === 'requested' ? `W-9 requested ${usDate(o.w9_date)}` : 'W-9 not requested'

/** The directory: shown to the owner and all-portfolio staff (directory is null otherwise). edit: may add owners and record W-9 status; reports: may download statements. */
export function ownerDirectory(directory: Row[] | null, edit: boolean, reports: boolean) {
 if (!directory) return ''
 const list = directory.length ? `<ul>${directory.map(o => `<li><strong>${e(o.legal_name)}</strong> · ${o.kind} · ${e(o.email)} · ${w9(o)}${edit ? `<details><summary>Record W-9</summary>${form('owner.w9', hidden('ownerId', o.id) + '<label>Status<select name="status"><option value="requested">Requested</option><option value="received">Received</option></select></label>' + field('Date', 'date', 'date', 'required') + field('Where the signed W-9 is kept (if received)', 'location') + '<button type="submit">Record W-9</button>')}</details>` : ''}</li>`).join('')}</ul>` : '<p class="muted">No owners yet.</p>'
 const add = edit ? `<details><summary>Add an owner</summary>${form('owner.add', '<label>Kind<select name="kind"><option value="individual">Individual</option><option value="entity">Entity</option></select></label>' + field('Legal name', 'legalName', 'text', 'required') + field('Email', 'email', 'email', 'required') + field('Mailing address', 'mailingAddress', 'text', 'required') + '<button type="submit">Add owner</button>')}</details>` : ''
 const statement = reports && directory.length ? `<form method="get" action="/api/owner-statement"><label>Owner<select name="ownerId">${directory.map(o => `<option value="${e(o.id)}">${e(o.legal_name)}</option>`).join('')}</select></label>${field('Period start', 'from', 'date', 'required')}${field('Period end', 'to', 'date', 'required')}<input type="hidden" name="format" value="csv"><button type="submit">Download allocation statement</button></form>` : ''
 return `<section class="owners"><h2>Owners</h2><p class="muted">W-9 status is recorded by staff. Terrace stores no taxpayer identification number and has not validated one.</p>${list}${add}${statement}</section>`
}

/** One property's owners: the share set in force today, earlier and later sets, and the agreement in force. */
export function propertyOwners(p: Row, data: Row | undefined, directory: Row[] | null, edit: boolean) {
 const now = sharesOn(data, p.today), agreement = agreementOn(data, p.today)
 const set = (s: Row) => `${s.shares.map((h: Row) => `${e(h.legal_name)} ${pct(h.share_bp)}`).join(', ')} from ${usDate(s.effective_from)} (${e(s.reason)})`
 const history = (data?.sets ?? []).length > 1 || (data?.sets ?? []).some((s: Row) => s !== now) ? `<details><summary>Ownership history</summary><ol>${data!.sets.map((s: Row) => `<li>${set(s)}</li>`).join('')}</ol></details>` : ''
 const terms = agreement ? `Management fee ${pct(agreement.fee_bp)} of collected rent · reserve requirement ${money(agreement.reserve_cents, 'USD')} · from ${usDate(agreement.starts)} (${e(agreement.reference)})` : 'No management agreement recorded.'
 const forms = edit && directory?.length ? `<details><summary>Change ownership</summary>${form('ownership.set', hidden('propertyId', p.id) + field('Effective from', 'effectiveFrom', 'date', 'required') + field('Reason or transfer reference', 'reason', 'text', 'required') + directory.map(o => field(`${o.legal_name} share (%)`, 'share:' + o.id, 'number', 'min="0" max="100" step="0.01"')).join('') + '<button type="submit">Record ownership</button>')}</details><details><summary>Record management agreement</summary>${form('agreement.set', hidden('propertyId', p.id) + field('Starts', 'starts', 'date', 'required') + field('Management fee (% of collected rent)', 'feePercent', 'number', 'min="0" max="100" step="0.01" required') + field('Reserve requirement (USD)', 'reserve', 'number', 'min="0" step="0.01" required') + field('Agreement reference', 'reference', 'text', 'required') + '<button type="submit">Record agreement</button>')}</details>` : ''
 return `<div class="property-owners"><p><strong>Owners:</strong> ${now ? set(now) : 'none recorded'}</p><p class="muted">${terms}</p>${history}${forms}</div>`
}
