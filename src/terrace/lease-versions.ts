import { all, allow, can, commit, guard, id, insist, one, recordRead, sha256, sql, tenancy, text, type Context, type Row } from './core'
import { independence } from './dual-control'
import { previewLease } from './charge-run'
import { LEASE_COMMANDS, leaseDigestInput, leaseInput } from './lease-input'
import { prepareLeaseSource } from './lease-source'
import { freeUnit } from './properties'
import { renewalItem, SIGNED_LABEL } from './renewals'
import { localDate } from './zones'
export { LEASE_COMMANDS } from './lease-input'
export { leaseSource, leaseErasureStatements } from './lease-source'

const previousDay = (day: string) => new Date(Date.parse(day + 'T00:00:00Z') - 86400000).toISOString().slice(0,10)
const digest = (value: unknown) => sha256(leaseDigestInput(value))
const latest = (c: Context, tenancyId: string) => one(c, 'SELECT id,effective FROM tt_lease_versions WHERE tenancy_id=? AND approved_at IS NOT NULL ORDER BY effective DESC LIMIT 1', tenancyId)
const priorGuard = (c: Context, tenancyId: string, priorId: string | null) => guard(c, '(SELECT id FROM tt_lease_versions WHERE tenancy_id=? AND approved_at IS NOT NULL ORDER BY effective DESC LIMIT 1) IS ?', tenancyId, priorId)
/** Compare the complete live row, including optional fields; inserts are fenced by the separate row count. */
function rowGuard(c: Context, table: string, row: Row) {
 const keys = Object.keys(row)
 insist(keys.every(k => /^[a-z_][a-z0-9_]*$/.test(k)), 'invalid_snapshot', 'Invalid lease record snapshot.')
 return guard(c, `EXISTS(SELECT 1 FROM ${table} WHERE ${keys.map(k => `${k} IS ?`).join(' AND ')})`, ...keys.map(k => row[k]))
}
const nextDay = (day: string) => new Date(Date.parse(day + 'T00:00:00Z') + 86400000).toISOString().slice(0,10)
/** LEASE-012: a signed renewal runs from the day after the current end through the accepted offer's end. */
const renewed = (t: Row, payload: Row) => payload.renewal ? {...t, end_date: payload.renewal.endDate} : t
async function acceptedOffer(c: Context, t: Row, renewalId: unknown) {
 const {r} = await renewalItem(c, renewalId)
 insist(r.tenancy_id === t.id, 'not_found', 'Renewal not found.', 404)
 insist(r.state === 'accepted' && r.lease_end === t.end_date && !t.ended_on, 'renewal_state', 'Record the signed renewal only after the household accepted the approved offer for the current lease end.', 409)
 const offer = await one(c, "SELECT * FROM tt_proposals WHERE kind='renewal' AND state='approved' AND json_extract(payload,'$.renewalId')=? ORDER BY renewal_sequence DESC,prepared_at DESC,id DESC LIMIT 1", r.id)
 insist(offer, 'renewal_state', 'The accepted renewal has no approved offer.', 409)
 return {r, offer, terms: JSON.parse(offer.payload)}
}
async function version(c: Context, value: unknown) {
 const v = await one(c, 'SELECT * FROM tt_lease_versions WHERE id=?', text(value, 'Lease version', 100))
 insist(v, 'not_found', 'Lease version not found.', 404)
 const t = await tenancy(c, v.tenancy_id)
 return {v, t}
}
function fresh(v: Row, t: Row, prior: Row | null) {
 insist(!v.approved_at, 'already_approved', 'This signed lease version is already approved.', 409)
 insist(v.base_version === t.version && v.prior_id === (prior?.id ?? null), 'review_changed', 'The tenancy or approved lease changed. Prepare a new version against the current records.', 409)
 insist(v.effective >= t.start_date && v.effective <= (t.ended_on ?? t.end_date) && (!prior || v.effective > prior.effective), 'invalid_effective', 'The version must take effect within the tenancy and after its prior approved version.')
}
/** A proposed complete run view keeps prior days and stable IDs, so approval and PAY-001 produce identical references. */
function proposed(v: Row, payload: Row, terms: Row[]) {
 const retained = terms.filter(term => !term.superseded_by && term.starts < v.effective).map(term =>
  !term.ends || term.ends >= v.effective ? {...term, ends: previousDay(v.effective), version: term.version + 1} : term)
 const added = payload.terms.map((term: Row) => ({id: term.id, tenancy_id: v.tenancy_id, kind: term.kind, description: term.description, amount_cents: term.amountCents, currency: term.currency, starts: term.starts, ends: term.ends, replaces: null, version: 1, created_by: v.prepared_by, created_at: v.prepared_at, lease_version_id: v.id, source_clause: term.sourceClause, superseded_by: null}))
 return [...retained, ...added]
}
async function review(c: Context, v: Row, current: Row, month: unknown) {
 const t = renewed(current, JSON.parse(v.payload))
 const [prior, terms, charges, adjustments, unit] = await Promise.all([
  latest(c, t.id), all(c, 'SELECT * FROM tt_lease_terms WHERE tenancy_id=? ORDER BY id', t.id),
  all(c, 'SELECT id,reference,term_id,period_start,period_end FROM tt_charges WHERE tenancy_id=? ORDER BY id', t.id),
  all(c, 'SELECT a.id,a.charge_id,a.reference FROM tt_adjustments a JOIN tt_charges q ON q.id=a.charge_id WHERE q.tenancy_id=? ORDER BY a.id', t.id),
  t.unit_id ? one(c, 'SELECT * FROM tt_units WHERE id=?', t.unit_id) : Promise.resolve(null)
 ])
 insist(!v.renewal_id || current.end_date === previousDay(v.effective), 'review_changed', 'The lease end changed after this signed renewal was recorded.', 409)
 const taxRules = unit ? await all(c, 'SELECT * FROM tt_tax_rules WHERE property_id=? ORDER BY id', unit.property_id) : []
 fresh(v, t, prior)
 const payload = JSON.parse(v.payload)
 insist(await digest(payload) === v.payload_sha256, 'invalid_snapshot', 'The prepared lease payload does not match its recorded digest.', 409)
 const blocked = await one(c, 'SELECT MAX(q.period_end) AS last FROM tt_charges q JOIN tt_lease_terms l ON l.id=q.term_id WHERE l.tenancy_id=? AND l.superseded_by IS NULL AND (l.ends IS NULL OR l.ends>=?) AND q.period_end>=?', t.id, v.effective, v.effective)
 const hapBlocked=await one(c,'SELECT MAX(period_end) AS last FROM tt_hap_charges WHERE tenancy_id=? AND period_end>=?',t.id,v.effective)
 insist(!hapBlocked?.last,'posted_period','HAP charges already cover this amendment period. Retroactive HAP amendments require the dedicated adjustment journey.',409)
 insist(!blocked?.last, 'posted_period', `Existing terms are posted through ${blocked?.last}. Use an effective date after that period.`, 409)
 const proposedTerms = proposed(v, payload, terms), run = await previewLease(c, t, proposedTerms, month, v)
 insist(run.month >= v.effective.slice(0,7) && run.month <= (t.ended_on ?? t.end_date).slice(0,7), 'invalid_month', 'Preview a month from the version’s effective month through the tenancy end.')
 // Full records catch changes made by older term doors that did not increment the tenancy's version.
 const fingerprint = await digest({leaseId: v.id, payloadSha256: v.payload_sha256, sourceSha256: v.source_sha256, tenancy: t, priorId: prior?.id ?? null, terms, charges, adjustments, unit, taxRules, month: run.month, runFingerprint: run.fingerprint, lines: run.lines, missing: run.missing})
 return {run: {...run, leaseId: v.id, tenancyId: t.id, fingerprint}, terms, prior, proposedTerms, charges, adjustments, unit, taxRules}
}

export async function leaseCommand(c: Context, command: string, p: Row): Promise<Row | undefined> {
 if (!LEASE_COMMANDS.includes(command)) return
 allow(c, command)
 if (command === 'lease.prepare') {
  const t = await tenancy(c, p.tenancyId)
  insist(t.currency_confirmed!==0,'currency_unconfirmed','The owner must confirm this historical tenancy’s currency before recording new signed terms.',409)
  const accepted = p.renewalId ? await acceptedOffer(c, t, p.renewalId) : null
  const payload: Row = leaseInput(p, accepted ? {...t, end_date: accepted.terms.endDate} : t)
  if (accepted) {
   insist(payload.effective === nextDay(t.end_date), 'invalid_effective', 'A signed renewal takes effect the day after the current lease end.')
   insist(payload.terms.filter((x: Row) => x.kind === 'rent').every((x: Row) => x.amountCents === accepted.terms.rentCents), 'renewal_terms', 'The signed renewal rent differs from the accepted offer. Prepare and approve a revised offer first.', 409)
   if(accepted.terms.requiredSigners)insist(accepted.terms.requiredSigners.every((name:string)=>payload.signers.some((s:Row)=>s.name.toLocaleLowerCase('en-US')===name.toLocaleLowerCase('en-US'))),'renewal_signers','The staff-recorded original is missing a required signer from the approved offer.',409)
   payload.renewal = {id: accepted.r.id, proposalId: accepted.offer.id, endDate: accepted.terms.endDate, rentCents: accepted.terms.rentCents, label: SIGNED_LABEL}
  }
  const [source, prior] = await Promise.all([prepareLeaseSource(c, p.source), latest(c, t.id)])
  insist(!prior || payload.effective > prior.effective, 'invalid_effective', 'An amendment must start after the latest approved version.')
  const key = id(), payloadSha = await digest(payload)
  await commit(c, [rowGuard(c, 'tt_tenancies', t), priorGuard(c, t.id, prior?.id ?? null),
   guard(c, 'NOT EXISTS(SELECT 1 FROM tt_erased_lease_files WHERE sha256=?)', source.sha),
   ...(accepted ? [guard(c, "EXISTS(SELECT 1 FROM tt_renewals WHERE id=? AND version=? AND state='accepted')", accepted.r.id, accepted.r.version), ...(t.unit_id ? [freeUnit(c, t.unit_id, payload.effective, accepted.terms.endDate, t.id)] : [])] : []),
   sql(c, 'INSERT INTO tt_lease_versions(id,tenancy_id,effective,signed_date,signers,reference,payload,payload_sha256,source_sha256,source_name,source_size,base_version,prior_id,prepared_by,prepared_at,renewal_id) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)', key, t.id, payload.effective, payload.signedDate, JSON.stringify(payload.signers), payload.reference, JSON.stringify(payload), payloadSha, source.sha, source.name, source.size, t.version, prior?.id ?? null, c.actor.id, c.now, accepted?.r.id ?? null),
   sql(c, 'INSERT INTO tt_lease_sources(lease_version_id,name,media_type,bytes,sha256) VALUES(?,?,?,?,?)', key, source.name, source.media_type, source.bytes, source.sha)
  ], command, key)
  return {leaseId: key, tenancyId: t.id, notice: accepted ? `Signed renewal recorded: ${SIGNED_LABEL}. Preview its charges; another person approves to activate the renewed terms.` : 'Signed lease evidence recorded by staff. Preview future charges before approval.'}
 }
 const {v, t} = await version(c, p.leaseId)
 const r = await review(c, v, t, p.month)
 if (command === 'lease.preview') {
  await recordRead(c, command, v.id)
  return r.run
 }
 insist(p.fingerprint === r.run.fingerprint, 'review_changed', 'The lease or charge preview changed. Preview again before approving.', 409)
 insist(r.run.missing.length === 0, 'incomplete_run', 'Resolve the missing rent or concession terms shown in the preview before approving.', 409)
 const independent = await independence(c, command, [v.prepared_by])
 const writes: D1PreparedStatement[] = [guard(c,'NOT EXISTS(SELECT 1 FROM tt_hap_charges WHERE tenancy_id=? AND period_end>=?)',t.id,v.effective),...independent.guards, rowGuard(c, 'tt_tenancies', t), rowGuard(c, 'tt_lease_versions', v), priorGuard(c, t.id, v.prior_id),
  guard(c, '(SELECT COUNT(*) FROM tt_lease_terms WHERE tenancy_id=?)=?', t.id, r.terms.length), ...r.terms.map(term => rowGuard(c, 'tt_lease_terms', term)),
  guard(c, '(SELECT COUNT(*) FROM tt_charges WHERE tenancy_id=?)=?', t.id, r.charges.length), ...r.charges.map(q => rowGuard(c, 'tt_charges', q)),
  guard(c, '(SELECT COUNT(*) FROM tt_adjustments a JOIN tt_charges q ON q.id=a.charge_id WHERE q.tenancy_id=?)=?', t.id, r.adjustments.length), ...r.adjustments.map(a => rowGuard(c, 'tt_adjustments', a)),
  ...(r.unit ? [rowGuard(c, 'tt_units', r.unit), guard(c, '(SELECT COUNT(*) FROM tt_tax_rules WHERE property_id=?)=?', r.unit.property_id, r.taxRules.length), ...r.taxRules.map(rule => rowGuard(c, 'tt_tax_rules', rule))] : []),
  guard(c, 'NOT EXISTS(SELECT 1 FROM tt_charges q JOIN tt_lease_terms l ON l.id=q.term_id WHERE l.tenancy_id=? AND l.superseded_by IS NULL AND (l.ends IS NULL OR l.ends>=?) AND q.period_end>=?)', t.id, v.effective, v.effective)]
 // LEASE-012: the accepted renewal activates once, extending the tenancy atomically and retaining its prior term.
 const renewal = JSON.parse(v.payload).renewal
 if (renewal) writes.push(guard(c, "EXISTS(SELECT 1 FROM tt_renewals WHERE id=? AND state='accepted' AND lease_end=?)", renewal.id, t.end_date), ...(t.unit_id ? [freeUnit(c, t.unit_id, v.effective, renewal.endDate, t.id)] : []),
  sql(c, 'INSERT INTO tt_lease_history(id,tenancy_id,start_date,end_date,rent_cents,proposal_id,confirmed_by,confirmed_at,currency) VALUES(?,?,?,?,?,?,?,?,?)', id(), t.id, t.start_date, t.end_date, t.rent_cents, renewal.proposalId, c.actor.id, c.now, t.currency),
  sql(c, 'UPDATE tt_tenancies SET end_date=?,rent_cents=? WHERE id=?', renewal.endDate, renewal.rentCents, t.id),
  sql(c, "UPDATE tt_renewals SET state='executed',lease_version_id=?,version=version+1 WHERE id=?", v.id, renewal.id),
  sql(c, 'INSERT INTO tt_renewal_events(id,renewal_id,tenancy_id,kind,happened_on,detail,reference,label,recorded_by,recorded_at,sequence) VALUES(?,?,?,?,?,?,?,?,?,?,(SELECT COALESCE(MAX(sequence),0)+1 FROM tt_renewal_events WHERE renewal_id=?))', id(), renewal.id, t.id, 'executed', localDate(c.now, t.time_zone), JSON.stringify({leaseVersionId: v.id, proposalId: renewal.proposalId, effective: v.effective, endDate: renewal.endDate, rentCents: renewal.rentCents, signedDate: v.signed_date}), v.reference, `renewed terms activated; ${SIGNED_LABEL}`, c.actor.id, c.now, renewal.id))
 for (const term of r.terms.filter(term => !term.superseded_by && (!term.ends || term.ends >= v.effective))) {
  if (term.starts < v.effective) writes.push(sql(c, 'UPDATE tt_lease_terms SET ends=?,version=version+1 WHERE id=?', previousDay(v.effective), term.id))
  else writes.push(sql(c, 'UPDATE tt_lease_terms SET superseded_by=?,version=version+1 WHERE id=?', v.id, term.id))
 }
 for (const term of r.proposedTerms.filter(term => term.lease_version_id === v.id)) writes.push(sql(c, 'INSERT INTO tt_lease_terms(id,tenancy_id,kind,description,amount_cents,currency,starts,ends,replaces,version,created_by,created_at,lease_version_id,source_clause,superseded_by) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)', term.id, term.tenancy_id, term.kind, term.description, term.amount_cents, term.currency, term.starts, term.ends, null, 1, term.created_by, term.created_at, v.id, term.source_clause, null))
 writes.push(sql(c, 'UPDATE tt_lease_versions SET approved_by=?,approved_at=?,approval_label=?,approval_month=?,approval_fingerprint=? WHERE id=?', c.actor.id, c.now, independent.label, r.run.month, r.run.fingerprint, v.id), sql(c, 'UPDATE tt_tenancies SET version=version+1 WHERE id=?', t.id))
 await commit(c, writes, command, v.id)
 return {leaseId: v.id, tenancyId: t.id, approvalLabel: independent.label, fingerprint: r.run.fingerprint, notice: renewal ? 'Renewal activated: the tenancy now runs through ' + renewal.endDate + '. Post the ordinary charge run to record the reviewed charges.' : 'Lease version approved. Post the ordinary charge run to record the reviewed charges.'}
}

/** Scoped metadata and complete parsed terms, without original file bytes. */
export async function leaseData(c: Context, tenancyId: string) {
 if(!can(c,'lease.read'))allow(c,'lease.metadata')
 const t = await tenancy(c, tenancyId)
 const rows = await all(c, 'SELECT * FROM tt_lease_versions WHERE tenancy_id=? ORDER BY effective DESC,prepared_at DESC,id', t.id)
 return rows.map(v => {
  const payload=JSON.parse(v.payload),state=v.approved_at?'approved':'prepared'
  if(!can(c,'lease.read'))return {id:v.id,tenancy_id:v.tenancy_id,effective:v.effective,approved_at:v.approved_at,state,payload:{reference:payload.reference,signedDate:payload.signedDate,signers:payload.signers,terms:[],obligations:payload.obligations.map((x:Row)=>({kind:x.kind,starts:x.starts,ends:x.ends,sourceClause:x.sourceClause}))}}
  return {...v,signers:JSON.parse(v.signers),payload,state}
 })
}
