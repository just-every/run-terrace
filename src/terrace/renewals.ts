import { workflowSendClaim } from './workflow-mail'
// LEASE-012: renewal campaigns. A dated window of lease ends schedules one renewal item per tenancy; offers are TER-003
// proposals carrying the campaign comparison; approved offers go out only when a person sends them through the
// installation mail provider; replies and outcomes are staff-recorded with their source and date. A signed renewal is a
// staff-recorded original (PORT-005 lease version, not e-signature evidence: LEASE-011), and its separately approved
// charge preview activates the renewed terms once (lease-versions.ts).
import { all, allow, audit, cents, commit, date, guard, id, insist, money, one, reaches, sql, tenancy, text, type Context, type Row } from './core'
import { householdData } from './households'
import { localDate } from './zones'

export const RENEWAL_COMMANDS = ['renewal.schedule', 'renewal.send', 'renewal.reply', 'renewal.close']
const PERIODS: Record<string, number> = { weekly: 52, fortnightly: 26, monthly: 12 }
const REPLIES = ['accepted', 'declined', 'counteroffer', 'unknown'], CLOSES = ['no_response', 'nonrenewal', 'month_to_month']
export const SIGNED_LABEL = 'signature recorded by staff, not verified by an e-signature provider'
const addDays = (day: string, n: number) => new Date(Date.parse(day + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10)
/** Half away from zero: n/d rounded to an integer. */
const round = (n: bigint, d: bigint) => { const s = (n < 0n) !== (d < 0n) ? -1n : 1n, a = n < 0n ? -n : n, b = d < 0n ? -d : d; return Number(s * ((2n * a + b) / (2n * b))) }
const amount0 = (v: unknown, label: string) => { const s = text(String(v ?? ''), label, 16); return /^0+(\.0{1,2})?$/.test(s) ? 0 : cents(s) }

/** The comparison shown before approval. Percentages are basis points of current rent (or market rent), half away from zero. */
export function comparison(t: Row, rentCents: number, market: Row, vacantDays: number, makeReadyCents: number, leasingCents: number) {
 const per = PERIODS[t.cadence], changeCents = rentCents - t.rent_cents
 const vacancyCents = round(BigInt(vacantDays) * BigInt(t.rent_cents) * BigInt(per), 365n)
 return { changeCents, changeBp: round(BigInt(changeCents) * 10000n, BigInt(t.rent_cents)), marketGapCents: rentCents - market.cents, marketGapBp: round(BigInt(rentCents - market.cents) * 10000n, BigInt(market.cents)),
  vacancyCents, turnoverCents: vacancyCents + makeReadyCents + leasingCents,
  formula: `Vacancy = vacant days × current rent × ${per} ${t.cadence} periods ÷ 365, rounded half up once to the cent; turnover = vacancy + make-ready + leasing costs. Percentages are of current rent and of the dated market rent, to 0.01%.` }
}

export async function renewalItem(c: Context, value: unknown) {
 const r = await one(c, 'SELECT * FROM tt_renewals WHERE id=?', text(value, 'Renewal', 100))
 insist(r, 'not_found', 'Renewal not found.', 404)
 return { r, t: await tenancy(c, r.tenancy_id) }
}
export const renewalRoster = (c: Context, tenancyId: string) => all(c, 'SELECT id,version FROM tt_household_members WHERE tenancy_id=? ORDER BY id', tenancyId)
export const rosterGuards = (c: Context, tenancyId: string, rows: Row[]) => [guard(c, '(SELECT COUNT(*) FROM tt_household_members WHERE tenancy_id=?)=?', tenancyId, rows.length), ...rows.map(row => guard(c, 'EXISTS(SELECT 1 FROM tt_household_members WHERE tenancy_id=? AND id=? AND version=?)', tenancyId, row.id, row.version))]
const event = (c: Context, r: Row, kind: string, on: string, detail: Row, reference: string, label: string) =>
 sql(c, 'INSERT INTO tt_renewal_events(id,renewal_id,tenancy_id,kind,happened_on,detail,reference,label,recorded_by,recorded_at,sequence) VALUES(?,?,?,?,?,?,?,?,?,?,(SELECT COALESCE(MAX(sequence),0)+1 FROM tt_renewal_events WHERE renewal_id=?))', id(), r.id, r.tenancy_id, kind, on, JSON.stringify(detail), reference, label, c.actor.id, c.now, r.id)
const fence = (c: Context, r: Row) => guard(c, 'EXISTS(SELECT 1 FROM tt_renewals WHERE id=? AND version=?)', r.id, r.version)
const step = (c: Context, r: Row, state: string) => sql(c, 'UPDATE tt_renewals SET state=?,version=version+1 WHERE id=?', state, r.id)
/** Current household contacts entitled to lease notices (PORT-004) who have an email address. */
async function recipients(c: Context, t: Row) {
 return (await householdData(c, t, null)).members.filter((m: Row) => m.recipient && m.email).map((m: Row) => ({ name: m.name, email: m.email, role: m.role }))
}

/** renewal.prepare with a campaign item: the offer, its recipients and the comparison, frozen into the proposal. */
export async function offerInput(c: Context, t: Row, p: Row) {
 const { r } = await renewalItem(c, p.renewalId), today = localDate(c.now, t.time_zone)
 insist(r.tenancy_id === t.id, 'not_found', 'Renewal not found.', 404)
 if(c.agentWorkload)insist(JSON.stringify(p.expectedRoster)===JSON.stringify(await renewalRoster(c,t.id)),'renewal_changed','Household roster changed; owner review and a new workload are required.',409)
 if(c.agentWorkload)insist(p.expectedTenancyVersion===t.version&&p.expectedRenewalVersion===r.version,'renewal_changed','Renewal terms or history changed after owner configuration. Pause and review a new workload.',409)
 insist(['open', 'countered'].includes(r.state), 'renewal_state', 'This renewal is not waiting for an offer.', 409)
 insist(r.lease_end === t.end_date && !t.ended_on, 'renewal_changed', 'The lease end changed after this renewal was scheduled.', 409)
 insist(!await one(c, "SELECT 1 FROM tt_proposals WHERE kind='renewal' AND state='pending' AND json_extract(payload,'$.renewalId')=?", r.id), 'offer_pending', 'An offer for this renewal is already waiting for approval.', 409)
 const endDate = date(p.endDate, 'Proposed lease end'), deadline = date(p.deadline, 'Reply deadline')
 insist(endDate > t.end_date, 'renewal_date', 'The proposed end must be later than the current lease end.')
 insist(deadline >= today && deadline <= t.end_date, 'renewal_deadline', 'The reply deadline must fall between today and the current lease end.')
 const market = { cents: cents(p.marketRent), asOf: date(p.marketRentDate, 'Market rent date'), source: text(p.marketRentSource, 'Market rent source', 500) }
 insist(market.asOf <= today, 'invalid_date', 'The market rent must be dated today or earlier.')
 const vacantDays = Number(text(String(p.vacantDays ?? ''), 'Vacant days', 3))
 insist(Number.isInteger(vacantDays) && vacantDays >= 0 && vacantDays <= 365, 'invalid_input', 'Vacant days must be a whole number from 0 to 365.')
 const makeReady = { cents: amount0(p.makeReadyCost, 'Make-ready cost'), source: text(p.makeReadySource, 'Make-ready cost source', 500) }
 const leasing = { cents: amount0(p.leasingCost, 'Leasing cost'), source: text(p.leasingSource, 'Leasing cost source', 500) }
 const to = await recipients(c, t)
 insist(to.length, 'no_recipients', 'No current household contact has an email address for this offer (PORT-004).', 409)
 const prior=await one(c,"SELECT payload FROM tt_proposals WHERE kind='renewal' AND json_extract(payload,'$.renewalId')=? ORDER BY renewal_sequence DESC,prepared_at DESC,id DESC LIMIT 1",r.id)
 if(p.requiredSigners!==undefined&&!c.agentWorkload)insist(c.actor.role==='owner'&&!c.actor.credential,'forbidden','Only the owner configures the required signer roster.',403)
 const signerInput=p.requiredSigners??(prior?JSON.parse(prior.payload).requiredSigners:undefined)
 let requiredSigners:string[]|undefined
 if(signerInput!==undefined){
  insist(Array.isArray(signerInput)&&signerInput.length>0&&signerInput.length<=20,'renewal_signers','Supply one to twenty required signer names from reviewed legal terms.')
  requiredSigners=signerInput.map((s:unknown)=>text(s,'Required signer',150))
  insist(new Set(requiredSigners.map(s=>s.toLocaleLowerCase('en-US'))).size===requiredSigners.length,'renewal_signers','Required signer names must be distinct.')
 }
 const rentCents = cents(p.rent)
 let alternatives:Row[]|undefined
 if(p.alternatives!==undefined){
  insist(Array.isArray(p.alternatives)&&p.alternatives.length>=2&&p.alternatives.length<=5&&p.alternatives.every((a:unknown)=>a&&typeof a==='object'&&!Array.isArray(a)),'renewal_options','Supply two to five sourced alternatives.')
  alternatives=p.alternatives.map((a:Row)=>{
   const amount=cents(a.rent),end=date(a.endDate,'Alternative lease end'),concessionCents=amount0(a.concessionCost,'Estimated concession')
   insist(end>t.end_date,'renewal_date','Every alternative must extend the lease.')
   return {rentCents:amount,endDate:end,concessionCents,source:text(a.source,'Alternative source',1000),comparison:comparison(t,amount,market,vacantDays,makeReady.cents,leasing.cents)}
  })
  insist(alternatives!.some(a=>a.rentCents===rentCents&&a.endDate===endDate),'renewal_options','The selected offer must match a sourced alternative.')
 }
 return { renewalId: r.id, renewalVersion:r.version, householdRoster:await renewalRoster(c,t.id), ...(requiredSigners?{requiredSigners}:{}), endDate, rentCents, source: text(p.source, 'Lease reference / reason', 1000), deadline, market, vacantDays, makeReady, leasing, recipients: to,
  comparison: comparison(t, rentCents, market, vacantDays, makeReady.cents, leasing.cents),
  ...(alternatives?{alternatives,context:{conditionSource:p.conditionSource??null,communicationSource:p.communicationSource??null,cashSource:p.cashSource??null}}:{}) }
}

/** What a person does next on a renewal; null once executed. */
export function nextAction(r: Row, offer: Row | undefined, sends: Row[], today: string) {
 if (r.state === 'executed') return null
 if (r.state === 'accepted') return 'Record the signed renewal original, then approve its charge preview to activate the renewed terms'
 if (r.state === 'declined') return 'Declined: record nonrenewal or month-to-month'
 if (r.state === 'countered' && offer?.state === 'pending') return 'Approve or reject the revised offer'
 if (r.state === 'countered') return 'Counteroffer received: prepare a revised offer'
 if (r.state === 'no_response') return 'No response by the deadline: decide nonrenewal or month-to-month and tell the household yourself'
 if (r.state === 'nonrenewal') return 'Nonrenewal: plan the move-out inspection and turnover. Terrace sends no legal notice'
 if (r.state === 'month_to_month') return 'Month-to-month: record the agreed terms as a signed lease version. Terrace converts nothing automatically'
 if (!offer || offer.state === 'rejected') return 'Prepare a renewal offer'
 if (offer.state === 'pending') return 'Approve or reject the offer'
 if (!sends.length) return 'Send the approved offer'
 if(today>=addDays(offer.payload.deadline,-3)&&today<=offer.payload.deadline)return `Escalate unanswered offer to the owner before ${offer.payload.deadline}; no automatic contact`
 return today > offer.payload.deadline ? `No reply by ${offer.payload.deadline}: follow up or record no response` : `Await a reply by ${offer.payload.deadline}`
}

/** Campaign items in the actor's scope, with offer, history and next action. */
export async function renewalData(c: Context, tenancyId?: string) {
 const rows = await all(c, `SELECT r.*,t.address,t.tenant_name,t.unit_id,t.time_zone,t.rent_cents,t.cadence,t.currency FROM tt_renewals r JOIN tt_tenancies t ON t.id=r.tenancy_id WHERE t.erased_at IS NULL${tenancyId ? ' AND r.tenancy_id=?' : ''} ORDER BY r.lease_end,t.address`, ...(tenancyId ? [tenancyId] : []))
 const scoped = rows.filter(r => reaches(c, r.unit_id))
 if (!scoped.length) return []
 const [offers, events] = await Promise.all([
  all(c, "SELECT p.id,p.state,p.payload,p.tenancy_version,p.prepared_at,p.approved_at,p.approval_label,COALESCE(a.display_name,p.prepared_by) AS prepared_name,COALESCE(b.display_name,p.approved_by) AS approved_name FROM tt_proposals p LEFT JOIN oa_operators a ON a.id=p.prepared_by LEFT JOIN oa_operators b ON b.id=p.approved_by WHERE p.kind='renewal' AND json_extract(p.payload,'$.renewalId') IS NOT NULL ORDER BY p.renewal_sequence,p.prepared_at,p.id"),
  all(c, 'SELECT e.*,COALESCE(o.display_name,e.recorded_by) AS recorded_name FROM tt_renewal_events e LEFT JOIN oa_operators o ON o.id=e.recorded_by ORDER BY e.renewal_id,e.sequence'),
 ])
 return scoped.map(r => {
  const mine = offers.map((o): Row => ({ ...o, payload: JSON.parse(o.payload) })).filter(o => o.payload.renewalId === r.id), offer = mine.at(-1)
  const history = events.filter(e => e.renewal_id === r.id).map((e): Row => ({ ...e, detail: JSON.parse(e.detail) }))
  const sends = offer ? history.filter(e => e.kind === 'send' && e.detail.proposalId === offer.id) : []
  return { ...r, offers: mine, offer, events: history, nextAction: nextAction(r, offer, sends, localDate(c.now, r.time_zone)) }
 })
}

export async function renewalCommand(c: Context, command: string, p: Row): Promise<Row | undefined> {
 if (!RENEWAL_COMMANDS.includes(command)) return
 allow(c, command)
 if (command === 'renewal.schedule') {
  const from = date(p.from, 'Lease ends from'), to = date(p.to, 'Lease ends to')
  insist(to >= from && to <= addDays(from, 366), 'invalid_window', 'Choose an inclusive window of lease end dates of at most 367 days.')
  const property = p.propertyId ? text(p.propertyId, 'Property', 100) : null
  const leases = (await all(c, `SELECT t.id,t.end_date,t.unit_id,t.time_zone FROM tt_tenancies t LEFT JOIN tt_units u ON u.id=t.unit_id WHERE t.erased_at IS NULL AND t.ended_on IS NULL AND t.end_date BETWEEN ? AND ?${property ? ' AND u.property_id=?' : ''} AND NOT EXISTS(SELECT 1 FROM tt_renewals r WHERE r.tenancy_id=t.id AND r.lease_end=t.end_date) ORDER BY t.end_date,t.id`, from, to, ...(property ? [property] : []))).filter(t => reaches(c, t.unit_id))
  const created = leases.map(t => ({ id: id(), tenancy_id: t.id, lease_end: t.end_date, time_zone: t.time_zone }))
  const writes = created.flatMap(r => [sql(c, 'INSERT INTO tt_renewals(id,tenancy_id,lease_end,window_from,window_to,created_by,created_at) VALUES(?,?,?,?,?,?,?)', r.id, r.tenancy_id, r.lease_end, from, to, c.actor.id, c.now),
   guard(c, 'EXISTS(SELECT 1 FROM tt_tenancies WHERE id=? AND end_date=? AND ended_on IS NULL)', r.tenancy_id, r.lease_end),
   event(c, r, 'scheduled', localDate(c.now, r.time_zone), { from, to }, `Lease ends ${from} to ${to}`, 'renewal work scheduled from the lease end date')])
  await commit(c, writes, command, `${from}..${to}`)
  return { created: created.map(r => r.id), notice: `${created.length} renewal${created.length === 1 ? '' : 's'} scheduled for lease ends ${from} to ${to}.` }
 }
 const { r, t } = await renewalItem(c, p.renewalId), today = localDate(c.now, t.time_zone)
 const offer = await one(c, "SELECT * FROM tt_proposals WHERE kind='renewal' AND json_extract(payload,'$.renewalId')=? ORDER BY renewal_sequence DESC,prepared_at DESC,id DESC LIMIT 1", r.id)
 if(command==='renewal.send'||command==='renewal.reply')insist(offer?.tenancy_version===t.version,'renewal_changed','The lease terms changed after offer approval. Review a new offer before contacting or recording agreement.',409)
 if((command==='renewal.send'||command==='renewal.reply')&&offer){const payload=JSON.parse(offer.payload);insist(!payload.householdRoster||JSON.stringify(payload.householdRoster)===JSON.stringify(await renewalRoster(c,t.id)),'renewal_changed','Household roster changed after approval. Review a new offer and required signer roster.',409)}
 if (command === 'renewal.send') {
  insist(offer?.state === 'approved' && r.state === 'open', 'offer_not_approved', 'Only an approved offer still waiting for a reply can be sent.', 409)
  const payload = JSON.parse(offer.payload), current = await recipients(c, t)
  insist((!payload.householdRoster||JSON.stringify(payload.householdRoster)===JSON.stringify(await renewalRoster(c,t.id)))&&payload.recipients.length===current.length&&payload.recipients.every((x: Row) => current.some(y => y.email === x.email)), 'recipients_changed', 'The household’s contacts changed after approval. Prepare a new offer.', 409)
  // Never resend an attempt the provider accepted or did not answer; only clearly refused attempts may be sent again.
  const results = await all(c, "SELECT detail FROM tt_renewal_events WHERE renewal_id=? AND kind IN ('send','send_result')", r.id)
  const attempts = results.map(x => JSON.parse(x.detail)).filter(x => x.proposalId === offer.id)
  const settled = (to: string) => attempts.some(a => a.to === to && !a.outcome && !attempts.some(b => b.sendEvent === a.eventId && ['rejected', 'rate_limited', 'development', 'unconfigured'].includes(b.outcome)))
  const due = payload.recipients.filter((x: Row) => !settled(x.email))
  insist(due.length, 'already_sent', 'This offer was already sent to every recipient, or its outcome is uncertain. It is not sent again.', 409)
  const subject = `Lease renewal offer: ${t.address}`, body = `Hello,\n\nWe are offering to renew your lease at ${t.address} through ${payload.endDate} at ${money(payload.rentCents, t.currency)} per ${t.cadence === 'monthly' ? 'month' : t.cadence === 'weekly' ? 'week' : 'fortnight'}.\nPlease reply to this email by ${payload.deadline}.\n\nThis offer is not a lease. A renewal takes effect only once a signed renewal is recorded.`
  const emails = due.map((x: Row) => ({ eventId: id(), renewalId: r.id, tenancyId: t.id, proposalId: offer.id, day: today, to: x.email, subject, body }))
  await commit(c, [...await workflowSendClaim(c, 'renewal', r.id, emails[0].eventId), guard(c, "EXISTS(SELECT 1 FROM tt_proposals WHERE id=? AND state='approved')", offer.id), fence(c, r), guard(c,'EXISTS(SELECT 1 FROM tt_tenancies WHERE id=? AND version=?)',t.id,t.version), sql(c, 'UPDATE tt_renewals SET version=version+1 WHERE id=?', r.id),
   ...(payload.householdRoster?rosterGuards(c,t.id,payload.householdRoster):[]), ...emails.map((m: Row) => sql(c, 'INSERT INTO tt_renewal_events(id,renewal_id,tenancy_id,kind,happened_on,detail,reference,label,recorded_by,recorded_at,sequence) VALUES(?,?,?,?,?,?,?,?,?,?,(SELECT COALESCE(MAX(sequence),0)+1 FROM tt_renewal_events WHERE renewal_id=?))', m.eventId, r.id, t.id, 'send', today, JSON.stringify({ proposalId: offer.id, eventId: m.eventId, to: m.to, subject }), `Offer ${offer.id}`, 'sending through the installation mail provider', c.actor.id, c.now, r.id))], command, r.id)
  return { renewalId: r.id, tenancyId: t.id, renewalEmails: emails, notice: `Renewal offer sent to ${emails.length} recipient${emails.length === 1 ? '' : 's'}.` }
 }
 const on = date(p.on, 'Date'), source = text(p.source, 'Source', 500)
 insist(on <= today, 'invalid_date', 'Record what already happened: the date cannot be in the future.')
 if (command === 'renewal.reply') {
  const outcome = text(p.outcome, 'Reply', 20)
  insist(REPLIES.includes(outcome), 'invalid_input', 'The reply is accepted, declined, counteroffer or unknown.')
  insist(offer?.state === 'approved' && ['open', 'no_response'].includes(r.state), 'renewal_state', 'Record a reply only to an approved offer that is still open.', 409)
  insist(on >= localDate(offer.approved_at, t.time_zone), 'invalid_date', 'A reply cannot predate the offer’s approval.')
  const note = p.note ? text(p.note, 'Note', 2000) : null, state = { accepted: 'accepted', declined: 'declined', counteroffer: 'countered', unknown: r.state }[outcome]!
  await commit(c, [...(JSON.parse(offer.payload).householdRoster?rosterGuards(c,t.id,JSON.parse(offer.payload).householdRoster):[]),fence(c, r), guard(c,'EXISTS(SELECT 1 FROM tt_tenancies WHERE id=? AND version=?)',t.id,t.version), step(c, r, state), event(c, r, 'reply', on, { proposalId: offer.id, outcome, note }, source, 'reply recorded by staff; Terrace does not read the inbox')], command, r.id)
  return { renewalId: r.id, tenancyId: t.id, state, notice: 'Reply recorded.' }
 }
 const outcome = text(p.outcome, 'Outcome', 20)
 insist(CLOSES.includes(outcome), 'invalid_input', 'The outcome is no_response, nonrenewal or month_to_month.')
 insist(['open', 'declined', 'countered', 'no_response', 'accepted'].includes(r.state), 'renewal_state', 'This renewal is already resolved.', 409)
 if (outcome === 'no_response') insist(offer?.state === 'approved' && r.state === 'open' && today > JSON.parse(offer.payload).deadline, 'deadline_open', 'Record no response only after the approved offer’s reply deadline has passed.', 409)
 await commit(c, [fence(c, r), step(c, r, outcome), event(c, r, 'outcome', on, { outcome }, source, 'outcome recorded by staff')], command, r.id)
 return { renewalId: r.id, tenancyId: t.id, state: outcome, notice: 'Outcome recorded.' }
}

/** Reported once the provider answers, at the time it answered; called after the send events are committed. */
export const sendResult = (c: Context, m: Row, outcome: string, provider: string | null, label: string) =>
 [sql(c, 'INSERT INTO tt_renewal_events(id,renewal_id,tenancy_id,kind,happened_on,detail,reference,label,recorded_by,recorded_at,sequence) VALUES(?,?,?,?,?,?,?,?,?,?,(SELECT COALESCE(MAX(sequence),0)+1 FROM tt_renewal_events WHERE renewal_id=?))', id(), m.renewalId, m.tenancyId, 'send_result', m.day, JSON.stringify({ proposalId: m.proposalId, sendEvent: m.eventId, to: m.to, outcome, providerMessageId: provider }), provider ? `provider message ${provider}` : 'no provider message id', label, c.actor.id, new Date().toISOString(), m.renewalId),
  audit(c, 'renewal.send.result', m.renewalId, outcome)]
