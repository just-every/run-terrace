import { cents, date, id, insist, text, type Row } from './core'

export const LEASE_COMMANDS = ['lease.prepare', 'lease.preview', 'lease.approve']
export const TERM_KINDS = ['rent', 'utility', 'pet', 'parking', 'concession']
export const OBLIGATION_KINDS = ['deposit', 'pet', 'utility', 'parking', 'insurance', 'addendum', 'hap']
export const leaseDigestInput = (v: unknown) => new TextEncoder().encode(JSON.stringify(v))
const amount = (v: Row, key = 'amountCents', decimal = 'amount', zero = false) => {
 const n = v[key] === undefined ? (zero && /^0(?:\.0{1,2})?$/.test(String(v[decimal])) ? 0 : cents(v[decimal])) : v[key]
 insist(Number.isSafeInteger(n) && n >= (zero ? 0 : 1) && n <= 100_000_000, 'invalid_money', 'Amounts must be exact integer cents, at most 1,000,000.00.')
 return n as number
}
function rows(value: unknown, lines: unknown, obligation: boolean): Row[] {
 if (value === undefined) value = String(lines ?? '').split(/\r?\n/).filter(s => s.trim()).map(s => {
  const columns = s.split('|').map(x => x.trim())
  insist(columns.length >= (obligation ? 5 : 6) && columns.length <= 6, 'invalid_input', 'Each lease line must supply every required field separated by |.')
  if (obligation) { const [kind, starts, ends, sourceClause, details, amount] = columns; return {kind, starts, ends, sourceClause, details, ...(amount ? {amount} : {})} }
  const [kind, description, amount, starts, ends, sourceClause] = columns
  return {kind, description, amount, starts, ends, sourceClause}
 })
 if (typeof value === 'string') { try { value = JSON.parse(value) } catch { insist(false, 'invalid_input', 'Lease terms and obligations must be JSON arrays or use the line fields.') } }
 insist(Array.isArray(value) && value.length > 0 && value.length <= 50 && value.every(x => x && typeof x === 'object' && !Array.isArray(x)), 'invalid_input', 'Supply 1 to 50 complete lease terms and obligations.')
 return value
}
function interval(v: Row, effective: string, end: string) {
 const starts = date(v.starts, 'Starts'), ends = v.ends ? date(v.ends, 'Ends') : null
 insist(starts >= effective && starts <= end && (!ends || ends >= starts && ends <= end), 'invalid_term', 'Every obligation starts within this version and ends within the tenancy, on or after its start.')
 return {starts, ends}
}
export function leaseInput(p: Row, t: Row) {
 const effective = date(p.effective, 'Effective date'), signedDate = date(p.signedDate, 'Signed date'), end = t.ended_on ?? t.end_date
 insist(effective >= t.start_date && effective <= end, 'invalid_effective', 'The effective date must fall within the tenancy.')
 let signers = p.signers
 if (typeof signers === 'string') {
  if (signers.trim().startsWith('[')) { try { signers = JSON.parse(signers) } catch { insist(false, 'invalid_input', 'Signers must be names or a JSON array.') } }
  else signers = signers.split(/[\n;,]/).filter((s: string) => s.trim())
 }
 insist(Array.isArray(signers) && signers.length > 0 && signers.length <= 30, 'invalid_signers', 'Record the signed document’s signers.')
 signers = signers.map((s: unknown) => typeof s === 'string' ? {name: text(s, 'Signer', 200)} : {name: text((s as Row)?.name, 'Signer', 200), ...((s as Row)?.capacity ? {capacity: text((s as Row).capacity, 'Signer capacity', 200)} : {})})
 const terms = rows(p.terms, p.chargeLines, false).map(v => {
  insist(TERM_KINDS.includes(v.kind), 'invalid_kind', 'Choose rent, utility, pet, parking or concession.')
  insist(v.currency === undefined || v.currency === t.currency, 'currency_mismatch', 'Lease terms must use the tenancy’s currency.')
  return {id: id(), kind: v.kind as string, description: text(v.description, 'Description', 200), amountCents: amount(v), currency: t.currency as string, ...interval(v, effective, end), sourceClause: text(v.sourceClause, 'Source clause', 1000)}
 })
 const rent = terms.filter(v => v.kind === 'rent').sort((a,b) => a.starts.localeCompare(b.starts))
 insist(rent.length && rent[0].starts === effective && (rent[rent.length - 1].ends ?? end) === end, 'rent_required', 'Supply a complete rent schedule from the effective date through the tenancy end.')
 for (let i = 1; i < rent.length; i++) {
  const previousEnd = rent[i-1].ends ?? end
  insist(new Date(Date.parse(previousEnd + 'T00:00:00Z') + 86400000).toISOString().slice(0,10) === rent[i].starts, 'rent_schedule', 'Rent schedules must meet without gaps or overlapping days.')
 }
 const obligations = rows(p.obligations, p.obligationLines, true).map(v => {
  insist(OBLIGATION_KINDS.includes(v.kind), 'invalid_kind', 'Choose deposit, pet, utility, parking, insurance, addendum or hap.')
  const details = text(v.details, 'Obligation details (explicitly state none when absent)', 4000)
  const out: Row = {kind: v.kind, ...interval(v, effective, end), sourceClause: text(v.sourceClause, 'Source clause', 1000), details}
  if (v.amountCents !== undefined || v.amount !== undefined) out.amountCents = amount(v, 'amountCents', 'amount', true)
  if (v.kind === 'hap' && details.toLowerCase() !== 'none') {
   let hap = {...v,...(p.hapAuthority?{housingAuthority:p.hapAuthority,reference:p.hapReference,tenantPortion:p.hapTenantPortion,hapPortion:p.hapPortion}:{})}
   if (details.startsWith('{')) { try { hap = {...v, ...JSON.parse(details)} } catch { insist(false, 'invalid_hap', 'HAP details must be valid JSON when using the line form.') } }
   out.housingAuthority = text(hap.housingAuthority, 'Housing authority', 300)
   out.reference = text(hap.reference, 'HAP contract reference', 300)
   out.tenantPortionCents = amount(hap, 'tenantPortionCents', 'tenantPortion', true)
   out.hapPortionCents = amount(hap, 'hapPortionCents', 'hapPortion', true)
  }
  return out
 })
 insist(OBLIGATION_KINDS.every(kind => obligations.some(v => v.kind === kind)), 'obligations_incomplete', 'Explicitly record deposit, pet, utility, parking, insurance, addendum and HAP obligations; use details “none” when absent.')
 return {effective, signedDate, signers, reference: text(p.reference, 'Signed document reference', 500), terms, obligations}
}
