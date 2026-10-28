import { all, allow, cents, commit, email, guard, id, insist, one, reachesPortfolio, recordRead, sql, text, type Context, type Row } from './core'
import { portable } from './data'
import { localDate } from './zones'
import { applicantData, applicationRevision, applicationFileList } from './application-answers'

export const APPLICATION_COMMANDS = ['application.open','application.invite','application.request','application.revoke','application.hold','application.erase']
export async function applicationRecord(c: Context, applicationId: unknown, action = 'application.read') {
 allow(c, action)
 const r = await one(c, 'SELECT * FROM tt_applications WHERE id=?', text(applicationId, 'Application', 100))
 insist(r && reachesPortfolio(c, r.portfolio_id), 'not_found', 'Application not found.', 404)
 return r
}
/** Freeze all assigned, activated pack disclosures; missing data is held rather than guessed. */
async function disclosures(c: Context, property: Row) {
 const assignment = await one(c, 'SELECT * FROM tt_property_rules WHERE property_id=?', property.id)
 insist(assignment, 'disclosures_required', 'Assign reviewed state and local rule packs first.', 409)
 const result: Row[] = [], day = localDate(c.now, property.time_zone)
 for (const code of [assignment.state_code, ...JSON.parse(assignment.overlays)]) {
  const pack = await one(c, `SELECT p.*,a.activated_at FROM tt_rule_packs p LEFT JOIN tt_rule_activations a ON a.pack_id=p.id
 WHERE p.code=? AND p.effective_from<=? ORDER BY p.effective_from DESC,p.version DESC LIMIT 1`, code, day)
  const field = pack ? JSON.parse(pack.fields).leaseDisclosures : null
  insist(pack?.activated_at && field?.effectiveDate <= day && typeof field?.value?.text === 'string' && field.value.text.trim(), 'disclosures_required', 'Each applicable pack needs activated, dated disclosure text.', 409)
  result.push({ packId: pack.id, code, version: pack.version, citation: field.citation, text: text(field.value.text, 'Disclosure text', 20000) })
 }
 return result
}
export async function applicationCommand(c: Context, command: string, p: Row): Promise<Row | undefined> {
 if (!APPLICATION_COMMANDS.includes(command)) return
 allow(c, command)
 insist(!c.actor.credential, 'forbidden', 'Use a current staff sign-in.', 403)
 if (command === 'application.open') {
  insist(c.actor.role === 'owner', 'forbidden', 'Only the owner prepares an application and its fee.', 403)
  const prospect = await one(c, 'SELECT * FROM tt_prospects WHERE id=?', text(p.prospectId, 'Prospect', 100))
  insist(prospect && reachesPortfolio(c, prospect.portfolio_id), 'not_found', 'Prospect not found.', 404)
  insist(prospect.version === Number(p.version) && !prospect.merged_into && ['clear','kept_separate'].includes(prospect.review) && !['leased','lost'].includes(prospect.stage), 'conflict', 'Review the current open prospect first.', 409)
  insist(!await one(c, 'SELECT id FROM tt_applications WHERE prospect_id=?', prospect.id), 'application_exists', 'This prospect already has an application.', 409)
  let adults = p.adults
  if (typeof adults === 'string') try { adults = JSON.parse(adults) } catch { adults = null }
  if (!adults && p.adultName && p.adultEmail) adults = [{name:p.adultName,email:p.adultEmail},...(p.coName || p.coEmail ? [{name:p.coName,email:p.coEmail}] : [])]
  insist(Array.isArray(adults) && adults.length >= 1 && adults.length <= 20, 'invalid_input', 'Name every adult applicant (one to twenty).')
  const roster = adults.map((a: Row) => ({ id: id(), name: text(a.name, 'Adult name', 200), email: email(a.email) }))
  insist(new Set(roster.map(a => a.email)).size === roster.length, 'invalid_input', 'Each adult needs their own email address.')
  const property = await one(c, 'SELECT * FROM tt_properties WHERE id=?', prospect.property_id)
  insist(property, 'not_found', 'Property not found.', 404)
  const pack = await disclosures(c, property), amount = cents(p.fee), reference = text(p.reference, 'Reviewed invitation and fee authority', 1000), key = id()
  insist(p.consent === 'PREPARE APPLICATION', 'consent_required', 'Explicitly confirm the roster, required disclosures and one household fee.')
  c.source = reference
  await commit(c, [guard(c, 'EXISTS(SELECT 1 FROM tt_prospects WHERE id=? AND version=? AND merged_into IS NULL)', prospect.id, prospect.version),
   sql(c, 'INSERT INTO tt_applications(id,prospect_id,property_id,portfolio_id,disclosures,fee_cents,created_by,created_at,last_activity_at) VALUES(?,?,?,?,?,?,?,?,?)', key, prospect.id, prospect.property_id, prospect.portfolio_id, JSON.stringify(pack), amount, c.actor.id, c.now, c.now),
   ...roster.map(a => sql(c, 'INSERT INTO tt_application_adults(id,application_id,name,email) VALUES(?,?,?,?)', a.id, key, a.name, a.email)),
  ], command, key)
  return { id:key, adults:roster.map(a => ({id:a.id,name:a.name})), tab:'applications', notice:'Application prepared. Explicitly send each adult their own sign-in link.' }
 }
 const app = await applicationRecord(c, p.applicationId, command)
 if (command === 'application.hold') {
  insist(c.actor.role === 'owner', 'forbidden', 'Only the owner manages a retention hold.', 403)
  const reference = text(p.reference, 'Hold or release reference', 1000)
  insist(['hold','release'].includes(p.action), 'invalid_input', 'Choose hold or release.')
  await commit(c, [sql(c, 'UPDATE tt_applications SET hold_reference=? WHERE id=?', p.action === 'hold' ? reference : null, app.id)], command, app.id)
  return {tab:'applications',notice:'Retention hold recorded.'}
 }
 if (command === 'application.erase') {
  insist(c.actor.role === 'owner', 'forbidden', 'Only the owner erases application evidence.', 403)
  text(p.reference, 'Erasure request reference', 1000)
  insist(!app.hold_reference, 'retention_hold', 'A legal hold retains this application.', 409)
  const fee = await one(c, "SELECT 1 AS paid FROM tt_application_fees WHERE application_id=? AND state='paid'", app.id)
  const until = new Date(app.last_activity_at); until.setUTCFullYear(until.getUTCFullYear() + (fee ? 7 : 3))
  insist(Date.parse(c.now) > until.getTime(), 'retention_hold', 'Application evidence is retained for three years after last activity, or seven years with a collected fee.', 409)
  const checkpoint = await (await portable(c)).redactionStatements()
  await commit(c, [guard(c, 'EXISTS(SELECT 1 FROM tt_applications WHERE id=? AND hold_reference IS NULL AND last_activity_at=?)',app.id,app.last_activity_at),...checkpoint,sql(c, 'DELETE FROM tt_applications WHERE id=?', app.id)], command, 'application-'+app.id)
  return {tab:'applications',notice:'Application and private originals erased. A later archive fences older copies.'}
 }
 const adult = await one(c, 'SELECT * FROM tt_application_adults WHERE id=? AND application_id=?', text(p.adultId,'Adult',100),app.id)
 insist(adult, 'not_found', 'Applicant not found.', 404)
 if (command === 'application.revoke') {
  insist(c.actor.role === 'owner', 'forbidden', 'Only the owner revokes applicant access.', 403)
  text(p.reference,'Revocation reason',1000)
  await commit(c, [sql(c,'UPDATE tt_application_adults SET revoked_at=? WHERE id=?',c.now,adult.id),sql(c,'UPDATE tt_application_sessions SET revoked_at=? WHERE adult_id=?',c.now,adult.id),sql(c,'UPDATE tt_application_links SET used_at=? WHERE adult_id=? AND used_at IS NULL',c.now,adult.id)],command,adult.id)
  return {tab:'applications',notice:'Applicant access revoked; stored evidence is retained.'}
 }
 insist(!adult.revoked_at, 'not_found', 'Applicant not found.', 404)
 if (command === 'application.invite') {
  insist(c.actor.role === 'owner' && p.consent === 'SEND LINK', 'consent_required', 'The owner explicitly approves each sign-in email.', 403)
  await commit(c, [], command, adult.id)
  return {tab:'applications',applicationEmail:adult.id,notice:'Sign-in email approved.'}
 }
 insist(adult.version === Number(p.version) && adult.state === 'submitted', 'conflict', 'Request evidence from the current submitted revision.', 409)
 const message = text(p.message, 'Missing document request', 1000), key = id()
 await commit(c, [guard(c,"EXISTS(SELECT 1 FROM tt_application_adults WHERE id=? AND version=? AND state='submitted' AND revoked_at IS NULL)",adult.id,adult.version),
  sql(c,'INSERT INTO tt_application_requests(id,adult_id,message,requested_by,requested_at) VALUES(?,?,?,?,?)',key,adult.id,message,c.actor.id,c.now),
  sql(c,"UPDATE tt_application_adults SET state='changes_requested',version=version+1 WHERE id=?",adult.id),
  sql(c,'UPDATE tt_applications SET last_activity_at=? WHERE id=?',c.now,app.id),
  applicationRevision(c, adult, adult.version+1, 'changes_requested', JSON.parse(adult.answers), await applicationFileList(c,adult.id), c.actor.id, message),
 ], command, adult.id)
 return {id:key,tab:'applications',notice:'Missing document requested. Submitted answers remain in revision history; no email was sent.'}
}
export async function applicationData(c: Context, applicationId?: string | null) {
 allow(c,'application.read')
 const apps = (await all(c,'SELECT x.*,p.name AS prospect_name FROM tt_applications x JOIN tt_prospects p ON p.id=x.prospect_id ORDER BY x.created_at DESC')).filter(r => reachesPortfolio(c,r.portfolio_id)&&(!applicationId||r.id===applicationId))
 if(applicationId) insist(apps.length,'not_found','Application not found.',404)
 for(const app of apps) {
  app.disclosures=JSON.parse(app.disclosures)
  app.adults=await all(c,'SELECT * FROM tt_application_adults WHERE application_id=? ORDER BY rowid',app.id)
  for(const a of app.adults) Object.assign(a,await applicantData(c,a))
 }
 await recordRead(c,'application.read',applicationId??'applications')
 return {applications:apps}
}
