import { workflowSendClaim } from './workflow-mail'
// LEASE-005. Prospect records on a property, recorded by the owner, portfolio managers and leasing staff in that
// portfolio. A lead whose email or phone matches an open prospect in the same portfolio is held as a possible
// duplicate until a person merges it or keeps it separate; nothing merges by itself. First-contact source is fixed;
// later sources are added to the history. Terrace sends nothing to a prospect: each response is recorded by staff.
// Showings and applications are staff-recorded stages until LEASE-006 and LEASE-007 carry them. Staff email a prospect
// from the record through the installation's mail provider only with email consent granted (ct ruling 19:01Z);
// phone and text stay staff-recorded until PORTAL-005.
import { all, allow, cents, commit, date, email, guard, id, insist, one, reachesPortfolio, sql, text, type Context, type Row } from './core'

export const PROSPECT_COMMANDS = ['prospect.add', 'prospect.email', 'prospect.review', 'prospect.assign', 'prospect.respond', 'prospect.stage', 'prospect.consent', 'prospect.erase']
export const SOURCES: [string, string][] = [['own_site', 'Own site listing'], ['marketplace', 'Marketplace listing'], ['email', 'Email'], ['phone', 'Phone'], ['walk_in', 'Walk-in'], ['referral', 'Referral']]
export const STAGES = ['enquiry', 'showing_scheduled', 'shown', 'applied', 'offer', 'leased']
export const LOST: [string, string][] = [['chose_elsewhere', 'Chose another home'], ['price', 'Price'], ['unit_unavailable', 'Unit no longer available'], ['not_qualified', 'Did not qualify'], ['no_response', 'Stopped responding'], ['other', 'Other']]
export const CHANNELS = ['email', 'phone', 'text']
export const RECORDED = 'recorded by staff; Terrace did not contact the prospect'
export const PREPARED = 'email written in Terrace; the provider outcome follows'
const YEARS = 3
const RANK: Record<string, number> = { refused: 0, unknown: 1, granted: 2 }

const phoneOf = (v: unknown) => { if (v === undefined || v === null || v === '') return null; const d = String(v).replace(/\D/g, ''); insist(d.length >= 10 && d.length <= 15, 'invalid_input', 'Enter a phone number with at least 10 digits.'); return d.length === 11 && d.startsWith('1') ? d.slice(1) : d }
const emailOf = (v: unknown) => v === undefined || v === null || v === '' ? null : email(v)
const source = (v: unknown) => { const s = String(v ?? ''); insist(SOURCES.some(x => x[0] === s), 'invalid_input', 'Choose own site, marketplace, email, phone, walk-in or referral.'); return s }
const consentState = (v: unknown) => { const s = String(v ?? 'unknown'); insist(Object.hasOwn(RANK, s), 'invalid_input', 'Consent is granted, refused or unknown.'); return s }
export const event = (c: Context, prospectId: string, kind: string, detail: unknown, reference: string, label = RECORDED) => sql(c, 'INSERT INTO tt_prospect_events(id,prospect_id,kind,detail,reference,label,recorded_by,recorded_at) VALUES(?,?,?,?,?,?,?,?)', id(), prospectId, kind, JSON.stringify(detail), reference, label, c.actor.id, c.now)
/** The owner, or staff whose role may record prospects in that portfolio and who are active. */
const leasingScope = "o.status='active' AND (o.role='owner' OR EXISTS(SELECT 1 FROM tt_staff_roles r JOIN tt_role_actions k ON k.role=r.role WHERE r.operator_id=o.id AND k.action='prospect.add' AND (r.all_portfolios=1 OR EXISTS(SELECT 1 FROM tt_role_portfolios rp WHERE rp.operator_id=o.id AND rp.portfolio_id=?))))"

function preferences(p: Row) {
 const n = (v: unknown, label: string, max: number) => { if (v === undefined || v === null || v === '') return null; const x = Number(v); insist(Number.isInteger(x) && x >= 0 && x <= max, 'invalid_input', `${label} is a whole number from 0 to ${max}.`); return x }
 return { bedrooms: n(p.bedrooms, 'Bedrooms', 10), occupants: n(p.occupants, 'Occupants', 20), moveIn: p.moveIn ? date(p.moveIn, 'Move-in date') : null, budgetCents: p.budget ? cents(p.budget) : null, pets: p.pets ? text(p.pets, 'Pets', 200) : null, notes: p.notes ? text(p.notes, 'Notes', 2000) : null }
}
async function prospect(c: Context, v: unknown) {
 const r = await one(c, 'SELECT * FROM tt_prospects WHERE id=?', text(v, 'Prospect', 100))
 insist(r && reachesPortfolio(c, r.portfolio_id), 'not_found', 'Prospect not found.', 404)
 return r
}
const versionGuard = (c: Context, r: Row) => guard(c, 'EXISTS(SELECT 1 FROM tt_prospects WHERE id=? AND version=?)', r.id, r.version)
const touch = (c: Context, r: Row, set = '', ...values: unknown[]) => sql(c, `UPDATE tt_prospects SET ${set ? set + ',' : ''}version=version+1,last_activity_at=? WHERE id=?`, ...values, c.now, r.id)

export async function prospectCommand(c: Context, command: string, p: Row): Promise<Row | undefined> {
 if (!PROSPECT_COMMANDS.includes(command)) return
 allow(c, command)
 if (command === 'prospect.add') {
  const property = await one(c, 'SELECT id,portfolio_id,name FROM tt_properties WHERE id=?', text(p.propertyId, 'Property', 100))
  insist(property && reachesPortfolio(c, property.portfolio_id), 'not_found', 'Property not found.', 404)
  const mail = emailOf(p.email), phone = phoneOf(p.phone), from = source(p.source), reference = text(p.reference, 'Listing, message or call reference', 500)
  insist(mail || phone, 'invalid_input', 'Record an email or a phone number.')
  const consent = Object.fromEntries(CHANNELS.map(ch => [ch, { state: consentState(p[`consent_${ch}`]), at: c.now, source: reference }]))
  // Possible duplicate: an open, unmerged prospect in the same portfolio with the same email or phone.
  const match = await one(c, "SELECT id FROM tt_prospects WHERE portfolio_id=? AND merged_into IS NULL AND stage NOT IN ('leased','lost') AND ((? IS NOT NULL AND email=?) OR (? IS NOT NULL AND phone=?)) ORDER BY created_at LIMIT 1", property.portfolio_id, mail, mail, phone, phone)
  const key = id()
  c.source = reference
  await commit(c, [sql(c, 'INSERT INTO tt_prospects(id,property_id,portfolio_id,name,email,phone,first_source,first_reference,preferences,consent,review,duplicate_of,created_by,created_at,last_activity_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)', key, property.id, property.portfolio_id, text(p.name, 'Name', 200), mail, phone, from, reference, JSON.stringify(preferences(p)), JSON.stringify(consent), match ? 'possible_duplicate' : 'clear', match?.id ?? null, c.actor.id, c.now, c.now),
   event(c, key, 'enquiry', { source: from, propertyId: property.id }, reference), ...(match ? [event(c, key, 'duplicate_held', { duplicateOf: match.id }, reference, 'held for a person to review; not merged')] : [])], command, key)
  return { id: key, version: 1, review: match ? 'possible_duplicate' : 'clear', duplicateOf: match?.id ?? null, tab: 'prospects', notice: match ? 'Held as a possible duplicate of an open prospect. Review it before working it.' : 'Prospect recorded.' }
 }
 const r = await prospect(c, p.prospectId), version = Number(p.version)
 insist(Number.isInteger(version) && version === r.version, 'conflict', 'Reload the current prospect.', 409)
 insist(!r.merged_into, 'prospect_state', 'This lead was merged into another prospect.', 409)
 if (command === 'prospect.erase') {
  // SAFE-004 communications retention: the owner erases a prospect on request; history keeps an opaque alias.
  insist(c.actor.role === 'owner', 'forbidden', 'Only the installation owner can do this.', 403)
  text(p.reason, 'Erasure request reference', 500)
  insist(!await one(c,'SELECT 1 FROM tt_applications WHERE prospect_id=?',r.id),'application_retained','Review and erase the retained application before erasing its prospect.',409)
  c.source = 'prospect-' + r.id
  await commit(c, [versionGuard(c, r), sql(c, 'UPDATE tt_prospects SET duplicate_of=NULL WHERE duplicate_of IN (SELECT id FROM tt_prospects WHERE id=? OR merged_into=?)', r.id, r.id), sql(c, "DELETE FROM tt_workflow_events WHERE run_id IN (SELECT id FROM tt_workflow_runs WHERE subject_kind='prospect' AND subject_id IN (SELECT id FROM tt_prospects WHERE id=? OR merged_into=?))", r.id, r.id), sql(c, "DELETE FROM tt_workflow_runs WHERE subject_kind='prospect' AND subject_id IN (SELECT id FROM tt_prospects WHERE id=? OR merged_into=?)", r.id, r.id), sql(c, 'DELETE FROM tt_prospects WHERE merged_into=?', r.id), sql(c, 'DELETE FROM tt_prospects WHERE id=?', r.id)], command, 'prospect-' + r.id)
  return { id: r.id, tab: 'prospects', notice: 'Prospect erased. History keeps only an opaque alias.' }
 }
 if (command === 'prospect.review') {
  insist(r.review === 'possible_duplicate', 'prospect_state', 'Only a held possible duplicate is reviewed.', 409)
  const reference = text(p.reference, 'Review note', 500)
  if (p.decision === 'separate') {
   await commit(c, [versionGuard(c, r), touch(c, r, "review='kept_separate'"), event(c, r.id, 'kept_separate', { duplicateOf: r.duplicate_of }, reference, 'reviewed by a person: kept separate')], command, r.id)
   return { id: r.id, version: version + 1, tab: 'prospects', notice: 'Kept as a separate prospect.' }
  }
  insist(p.decision === 'merge', 'invalid_input', 'Choose merge or separate.')
  const target = await prospect(c, r.duplicate_of)
  insist(!target.merged_into && !['leased', 'lost'].includes(target.stage), 'prospect_state', 'The matching prospect is no longer open. Keep this lead separate.', 409)
  const a = JSON.parse(target.consent), b = JSON.parse(r.consent)
  const consent = Object.fromEntries(CHANNELS.map(ch => [ch, RANK[b[ch].state] < RANK[a[ch].state] ? b[ch] : a[ch]]))
  await commit(c, [versionGuard(c, r), guard(c, 'EXISTS(SELECT 1 FROM tt_prospects WHERE id=? AND version=?)', target.id, target.version),
   sql(c, 'UPDATE tt_prospect_events SET prospect_id=? WHERE prospect_id=?', target.id, r.id),
   sql(c, 'UPDATE tt_prospects SET consent=?,email=COALESCE(email,?),phone=COALESCE(phone,?),version=version+1,last_activity_at=? WHERE id=?', JSON.stringify(consent), r.email, r.phone, c.now, target.id),
   touch(c, r, "merged_into=?,review='clear'", target.id),
   event(c, target.id, 'source', { source: r.first_source, propertyId: r.property_id, preferences: JSON.parse(r.preferences) }, r.first_reference, 'later contact, merged by a person'),
   event(c, target.id, 'merged', { from: r.id }, reference, 'reviewed by a person: merged; consent kept most restrictive')], command, target.id)
  return { id: target.id, version: target.version + 1, tab: 'prospects', notice: 'Merged. Both sources and histories are kept on one prospect.' }
 }
 insist(r.review !== 'possible_duplicate', 'review_required', 'Review this possible duplicate first.', 409)
 insist(!['leased', 'lost'].includes(r.stage) || command === 'prospect.consent', 'prospect_state', 'This prospect is closed.', 409)
 if (command === 'prospect.assign') {
  const to = text(p.assignedTo, 'Leasing person', 100)
  insist((await one(c, `SELECT 1 AS ok FROM oa_operators o WHERE o.id=? AND ${leasingScope}`, to, r.portfolio_id))?.ok, 'not_eligible', 'Choose active leasing staff, a portfolio manager or the owner for this portfolio.', 409)
  await commit(c, [versionGuard(c, r), guard(c, `EXISTS(SELECT 1 FROM oa_operators o WHERE o.id=? AND ${leasingScope})`, to, r.portfolio_id), touch(c, r, 'assigned_to=?', to), event(c, r.id, 'assigned', { to }, 'assignment', 'assigned by staff')], command, r.id)
  return { id: r.id, version: version + 1, tab: 'prospects', notice: 'Assigned.' }
 }
 if (command === 'prospect.consent') {
  const ch = String(p.channel), state = consentState(p.state), reference = text(p.reference, 'Consent source', 500)
  insist(CHANNELS.includes(ch), 'invalid_input', 'Channel is email, phone or text.')
  const consent = { ...JSON.parse(r.consent), [ch]: { state, at: c.now, source: reference } }
  await commit(c, [versionGuard(c, r), touch(c, r, 'consent=?', JSON.stringify(consent)), event(c, r.id, 'consent', { channel: ch, state }, reference)], command, r.id)
  return { id: r.id, version: version + 1, tab: 'prospects', notice: `Consent for ${ch} recorded as ${state}.` }
 }
 if (command === 'prospect.email') {
  insist(r.email, 'no_email', 'This prospect has no email address.', 409)
  insist(JSON.parse(r.consent).email.state === 'granted', 'consent_required', 'Email consent is not granted: record the prospect’s consent first. Terrace never emails without it.', 409)
  const subject = text(p.subject, 'Subject', 200), body = text(p.body, 'Message', 5000), key = id()
  c.source = subject
  await commit(c, [...await workflowSendClaim(c, 'prospect', r.id, key), versionGuard(c, r), guard(c, "EXISTS(SELECT 1 FROM tt_prospects WHERE id=? AND json_extract(consent,'$.email.state')='granted')", r.id), touch(c, r), sql(c, 'INSERT INTO tt_prospect_events(id,prospect_id,kind,detail,reference,label,recorded_by,recorded_at) VALUES(?,?,?,?,?,?,?,?)', key, r.id, 'email', JSON.stringify({ to: r.email, subject, body }), subject, PREPARED, c.actor.id, c.now)], command, r.id)
  return { id: r.id, version: version + 1, tab: 'prospects', prospectEmail: { eventId: key, prospectId: r.id, to: r.email, subject, body }, notice: 'Email written.' }
 }
 if (command === 'prospect.respond') {
  const ch = String(p.channel), reference = text(p.reference, 'What was said and where it is recorded', 1000)
  insist(CHANNELS.includes(ch), 'invalid_input', 'Channel is email, phone or text.')
  insist(JSON.parse(r.consent)[ch].state !== 'refused', 'consent_refused', `This prospect refused ${ch} contact.`, 409)
  await commit(c, [versionGuard(c, r), touch(c, r), event(c, r.id, 'response', { channel: ch }, reference)], command, r.id)
  return { id: r.id, version: version + 1, tab: 'prospects', notice: `Response logged, ${RECORDED}.` }
 }
 const stage = String(p.stage), reference = text(p.reference, 'Stage evidence reference', 500), on = date(p.on, 'Date')
 if (stage === 'lost') {
  const reason = String(p.lostReason)
  insist(LOST.some(x => x[0] === reason), 'invalid_input', 'Choose why the prospect was lost.')
  const note = reason === 'other' ? text(p.note, 'Lost note', 500) : (p.note ? text(p.note, 'Lost note', 500) : null)
  await commit(c, [versionGuard(c, r), touch(c, r, "stage='lost',lost_reason=?,lost_note=?", reason, note), event(c, r.id, 'stage', { from: r.stage, to: 'lost', on, reason, note }, reference)], command, r.id)
  return { id: r.id, version: version + 1, tab: 'prospects', notice: 'Marked lost.' }
 }
 insist(STAGES.indexOf(stage) > STAGES.indexOf(r.stage), 'invalid_stage', 'Move the prospect forward: showing scheduled, shown, applied, offer or leased.')
 await commit(c, [versionGuard(c, r), touch(c, r, 'stage=?', stage), event(c, r.id, 'stage', { from: r.stage, to: stage, on }, reference)], command, r.id)
 return { id: r.id, version: version + 1, tab: 'prospects', notice: `Stage: ${stage.replace('_', ' ')}.` }
}

export async function prospectData(c: Context) {
 allow(c, 'prospect.read')
 const [rows, events, properties] = await Promise.all([
  all(c, "SELECT x.*,p.name AS property FROM tt_prospects x JOIN tt_properties p ON p.id=x.property_id WHERE x.merged_into IS NULL ORDER BY CASE x.review WHEN 'possible_duplicate' THEN 0 ELSE 1 END,x.last_activity_at DESC"),
  all(c, 'SELECT * FROM tt_prospect_events ORDER BY recorded_at,rowid'),
  all(c, 'SELECT id,name,portfolio_id FROM tt_properties ORDER BY name'),
 ])
 const mine = rows.filter(r => reachesPortfolio(c, r.portfolio_id)), ids = new Set(mine.map(r => r.id))
 const visible = properties.filter(p => reachesPortfolio(c, p.portfolio_id))
 const staff = Object.fromEntries(await Promise.all([...new Set(visible.map(p => p.portfolio_id))].map(async f => [f, await all(c, `SELECT o.id,o.display_name FROM oa_operators o WHERE ${leasingScope} ORDER BY o.display_name`, f)])))
 const through = (at: string) => `${Number(at.slice(0, 4)) + YEARS}${at.slice(4, 10)}`
 return {
  prospects: mine.map(r => { const history = events.filter(e => e.prospect_id === r.id).map((e): Row => ({ ...e, detail: JSON.parse(e.detail) })); return { ...r, preferences: JSON.parse(r.preferences), consent: JSON.parse(r.consent), sources: [r.first_source, ...history.filter(e => e.kind === 'source').map(e => e.detail.source)], retainedThrough: through(r.last_activity_at), history } }),
  properties: visible, staff, retention: `Prospect records are kept ${YEARS} years after the last activity (SAFE-004 communications); the owner erases one on request.`,
 }
}
