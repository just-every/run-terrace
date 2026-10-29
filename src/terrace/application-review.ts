import { all, allow, date, insist, one, recordRead, sha256, text, type Context, type Row } from './core'
import { applicationRecord } from './applications'

/** Staff-supplied facts only. Document text and applicant prose are never interpreted. */
export function applicationReviewer(c: Context) {
 allow(c, 'application.read')
 insist(!c.actor.credential && (c.actor.role === 'owner' || c.actor.staff?.role === 'portfolio_manager'), 'forbidden', 'Use an authorized owner or portfolio-manager sign-in.', 403)
}
function amount(value: unknown, label: string) {
 const s = String(value ?? '').trim()
 insist(/^\d{1,10}(\.\d{1,2})?$/.test(s), 'invalid_money', `${label} must use exact cents, without rounding.`)
 const [whole, fraction = ''] = s.split('.')
 const n = Number(whole) * 100 + Number(fraction.padEnd(2, '0'))
 insist(Number.isSafeInteger(n) && n >= 0 && n <= 100_000_000_000, 'invalid_money', `${label} is outside the supported exact-cent range.`)
 return n
}
export async function applicationReview(c: Context, p: Row) {
 applicationReviewer(c)
 const multiple = text(p.multiple, 'Monthly income multiple', 16)
 insist(/^\d{1,3}(\.\d{1,6})?$/.test(multiple), 'invalid_criterion', 'Supply one positive income multiple with at most six decimal places.')
 const [whole, fraction = ''] = multiple.split('.'), denominator = 10n ** BigInt(fraction.length), numerator = BigInt(whole + fraction)
 insist(numerator > 0n, 'invalid_criterion', 'The income multiple must be positive.')
 const criterionReference = text(p.criterionReference, 'Previously disclosed criterion reference', 1000)
 insist(p.disclosed === 'PREVIOUSLY DISCLOSED', 'disclosure_required', 'Confirm this exact multiple was disclosed to both applicants before submission.', 409)
 const rows: Row[] = []
 for (const slot of ['first', 'second']) {
  const app = await applicationRecord(c, p[slot + 'ApplicationId'])
  const adult = await one(c, 'SELECT * FROM tt_application_adults WHERE id=? AND application_id=?', text(p[slot + 'AdultId'], 'Applicant', 100), app.id)
  insist(adult && !adult.revoked_at, 'not_found', 'Submitted source not available.', 404)
  insist(adult.state === 'submitted' && adult.version === Number(p[slot + 'Version']), 'stale_source', 'Reload and select the current submitted revision before recomputing.', 409)
  const revision = await one(c, "SELECT * FROM tt_application_revisions WHERE adult_id=? AND version=? AND state='submitted'", adult.id, adult.version)
  insist(revision, 'stale_source', 'The submitted revision is unavailable.', 409)
  const disclosureHash = await sha256(new TextEncoder().encode(app.disclosures)), answers = JSON.parse(revision.answers)
  insist(p[slot + 'DisclosureHash'] === disclosureHash && answers.disclosureConsent?.hash === disclosureHash, 'stale_source', 'The acknowledged disclosure source changed. Reload before reviewing.', 409)
  const disclosure = JSON.parse(app.disclosures).find((d: Row) => d.packId === p[slot + 'DisclosurePackId'])
  insist(disclosure, 'disclosure_required', 'Select an acknowledged disclosure source for each applicant.', 409)
  const files: Row[] = JSON.parse(revision.files), originals = []
  for (const f of files) {
   const current = await one(c, 'SELECT id,name,purpose,sha256,bytes FROM tt_application_files WHERE id=? AND adult_id=?', f.id, adult.id)
   insist(current && current.sha256 === f.sha256 && await sha256(new Uint8Array(current.bytes)) === f.sha256, 'stale_source', 'An original is unavailable or changed. Reload and obtain current evidence.', 409)
   originals.push({id: current.id, name: current.name, purpose: current.purpose, sha256: current.sha256})
  }
  const rentCents = amount(p[slot + 'Rent'], 'Monthly rent')
  insist(rentCents > 0, 'invalid_money', 'Monthly rent must be positive.')
  const income = String(p[slot + 'Income'] ?? '').trim(), incomeCents = income ? amount(income, 'Verified monthly income') : null
  const evidence = originals.find(f => f.id === p[slot + 'FileId'] && ['income', 'requested'].includes(f.purpose))
  if (p[slot + 'FileId']) insist(evidence && evidence.sha256 === p[slot + 'FileHash'], 'stale_source', 'Select the current submitted income original and its exact hash.', 409)
  const state = String(p[slot + 'EvidenceState'] ?? 'missing')
  insist(['verified', 'unverified', 'contested', 'missing'].includes(state), 'invalid_evidence', 'Choose the income evidence state.')
  const verification = { assertion: String(p[slot + 'Verification'] ?? '').trim(), on: String(p[slot + 'VerifiedOn'] ?? '').trim(), reference: String(p[slot + 'VerificationReference'] ?? '').trim(), actor: c.actor.id, name: c.actor.displayName }
  insist(verification.assertion.length <= 200 && verification.reference.length <= 1000, 'invalid_evidence', 'Verification details are too long.')
  if (verification.on) insist(date(verification.on) <= c.now.slice(0, 10), 'invalid_date', 'Verification cannot be future-dated.')
  const holds = []
  if (!evidence) holds.push('Missing submitted income original')
  if (incomeCents === null) holds.push('Missing staff-entered monthly income')
  if (state !== 'verified') holds.push(state === 'contested' ? 'Contested evidence: authorized human review required' : 'Income evidence is not verified')
  if (verification.assertion !== 'I VERIFIED INCOME' || !verification.on || !verification.reference) holds.push('Staff verification assertion, date and reference required')
  const requiredNumerator = BigInt(rentCents) * numerator, minimumIncomeCents = Number((requiredNumerator + denominator - 1n) / denominator)
  const result = holds.length ? 'held' : BigInt(incomeCents!) * denominator >= requiredNumerator ? 'meets_criterion' : 'below_criterion'
  rows.push({applicationId: app.id, adultId: adult.id, name: adult.name, version: adult.version, submittedAt: adult.submitted_at, currency: 'USD', rentCents, incomeCents, minimumIncomeCents, requiredNumerator: String(requiredNumerator), denominator: String(denominator), result, holds, evidenceState: state, verification, disclosure: {...disclosure, hash: disclosureHash, acknowledgedAt: answers.disclosureConsent.at}, originals, incomeFileId: evidence?.id ?? null})
 }
 insist(rows[0].adultId !== rows[1].adultId, 'distinct_applicants', 'Select two different submitted applicants.')
 // Retain only attributable read events, never supplied income, criterion or a decision.
 for (const row of rows) await recordRead(c, 'application.income-review', row.adultId)
 return {multiple, criterionReference, computedAt: c.now, rows, notice: 'Read-only income criterion. This is not an applicant decision or a verified screening report.'}
}

export async function applicationReviewChoices(c: Context) {
 applicationReviewer(c)
 const apps = await all(c, 'SELECT * FROM tt_applications ORDER BY created_at,id'), choices = []
 for (const app of apps) {
  // Use the existing source door; filter the list without disclosing other portfolios.
  if (c.actor.role !== 'owner' && !c.actor.staff?.all && !c.actor.staff?.portfolios.includes(app.portfolio_id)) continue
  const adults = await all(c, "SELECT id,name,version,answers FROM tt_application_adults WHERE application_id=? AND state='submitted' AND revoked_at IS NULL ORDER BY rowid", app.id)
  const disclosures = JSON.parse(app.disclosures), disclosureHash = await sha256(new TextEncoder().encode(app.disclosures))
  for (const adult of adults) choices.push({...adult, applicationId: app.id, disclosures, disclosureHash, files: await all(c, 'SELECT id,name,purpose,sha256 FROM tt_application_files WHERE adult_id=? ORDER BY at,id', adult.id)})
 }
 return choices
}
