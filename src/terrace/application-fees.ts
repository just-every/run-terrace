import type { Bindings } from '../auth.server'
import { all, audit, Fault, guard, id, insist, one, sql, type Context, type Row } from './core'
import { stripe } from './stripe-provider'

export const APPLICATION_FEE_CONSENT_VERSION = 'application-fee-1'
export const APPLICATION_FEE_CONSENT_TEXT = 'I authorize this one-time household application fee in Stripe test mode. Terrace receives no card details. No payer surcharge is added. Returning here does not confirm payment.'
type Applicant = { adultId: string; sessionHash: string; now: string }
type Start = Applicant & { origin: string; consent: unknown; consentVersion: unknown; requestKey: unknown }
const context = (env: Bindings, p: Applicant): Context => ({ db: env.DB, now: p.now, actor: { id: 'applicant:' + p.adultId, role: 'member', displayName: 'Applicant' } })
const LIVE = `EXISTS(SELECT 1 FROM tt_application_sessions s JOIN tt_application_adults d ON d.id=s.adult_id JOIN tt_application_access x ON x.adult_id=d.id JOIN tt_applications a ON a.id=d.application_id JOIN tt_prospects p ON p.id=a.prospect_id WHERE s.hash=? AND s.adult_id=? AND s.revoked_at IS NULL AND s.expires_at>? AND d.revoked_at IS NULL AND p.merged_into IS NULL)`
const liveGuard = (c: Context, p: Applicant) => guard(c, LIVE, p.sessionHash, p.adultId, p.now)
async function application(c: Context, p: Applicant) {
 insist(await one(c, `SELECT 1 AS ok WHERE ${LIVE}`, p.sessionHash, p.adultId, p.now), 'unauthorized', 'Sign in with a current applicant link.', 401)
 const row = await one(c, 'SELECT a.* FROM tt_applications a JOIN tt_application_adults d ON d.application_id=a.id WHERE d.id=?', p.adultId)
 insist(row, 'not_found', 'Application not found.', 404)
 return row
}
const conflict = () => new Fault('fee_changed', 'The application fee or your access changed. Reload the application before continuing.', 409)
const safeBatch = async (c: Context, writes: D1PreparedStatement[]) => { try { await c.db.batch(writes) } catch (e) { if (/CHECK constraint|UNIQUE constraint/.test(String(e))) throw conflict(); throw e } }

/** Shared household outcome only. Hosted URLs and provider card objects are never staff or co-applicant data. */
export async function applicationFeeData(db: D1Database, applicationId: string) {
 const c = { db } as Context
 return all(c, 'SELECT id,adult_id,amount_cents,currency,state,consent_version,consent_text,consented_at,checkout_id,intent_id,charge_id,last_event_id,(SELECT kind FROM tt_application_fee_events e WHERE e.id=last_event_id) AS last_event_kind FROM tt_application_fees WHERE application_id=? ORDER BY consented_at,id', applicationId)
}

/** Only the initiating applicant can recover their in-progress request and hosted destination. */
export async function currentApplicationFee(env: Bindings, p: Applicant) {
 const c = context(env, p), app = await application(c, p)
 return one(c, "SELECT f.id AS paymentId,f.request_key AS requestKey,f.state,l.checkout_url AS checkoutUrl FROM tt_application_fees f JOIN tt_application_fee_links l ON l.fee_id=f.id WHERE f.application_id=? AND f.adult_id=? AND f.state IN ('reserved','checkout')", app.id, p.adultId)
}

/** Reserve once before provider egress; an uncertain request can only resume with its original key. */
export async function startApplicationFee(env: Bindings, p: Start) {
 const c = context(env, p), app = await application(c, p)
 insist(p.consent === 'yes' && p.consentVersion === APPLICATION_FEE_CONSENT_VERSION, 'consent_required', 'Confirm this one-time fee and its disclosed total.')
 insist(typeof p.requestKey === 'string' && /^[a-f0-9-]{36}$/i.test(p.requestKey), 'request_key', 'Open the payment form again.')
 insist(Number.isSafeInteger(app.fee_cents) && app.fee_cents >= 50, 'fee_not_required', 'This application has no payable card fee.', 409)
 insist(env.STRIPE_SECRET_KEY && !env.RER_DEMO, 'stripe_unavailable', 'Application fee collection requires configured Stripe test mode.', 503)
 const origin = new URL(p.origin)
 insist(['http:', 'https:'].includes(origin.protocol) && !origin.username && !origin.password && origin.origin === env.AUTH_ORIGIN, 'origin', 'The return origin must match this installation.', 403)
 let saved = await one(c, 'SELECT * FROM tt_application_fees WHERE application_id=? AND request_key=?', app.id, p.requestKey)
 if (!saved) {
  const active = await one(c, "SELECT id FROM tt_application_fees WHERE application_id=? AND state IN ('reserved','checkout','paid')", app.id)
  insist(!active, 'fee_in_progress', 'This household fee is already paid or has an open attempt. Review its outcome before another payment.', 409)
  const key = id()
  try {
   await c.db.batch([liveGuard(c, p), guard(c, 'EXISTS(SELECT 1 FROM tt_applications WHERE id=? AND fee_cents=?)', app.id, app.fee_cents),
    sql(c, "INSERT INTO tt_application_fees(id,application_id,adult_id,request_key,amount_cents,currency,state,consent_version,consent_text,consented_at) VALUES(?,?,?,?,?,'usd','reserved',?,?,?)", key, app.id, p.adultId, p.requestKey, app.fee_cents, APPLICATION_FEE_CONSENT_VERSION, APPLICATION_FEE_CONSENT_TEXT, p.now),
    sql(c, 'INSERT INTO tt_application_fee_links(fee_id,checkout_url) VALUES(?,NULL)', key), sql(c,'UPDATE tt_applications SET last_activity_at=? WHERE id=?',p.now,app.id), audit(c, 'application.fee.start', key)])
  } catch (e) {
   const prior = await one(c, 'SELECT * FROM tt_application_fees WHERE application_id=? AND request_key=?', app.id, p.requestKey)
   if (!prior) { if (/CHECK constraint|UNIQUE constraint/.test(String(e))) throw conflict(); throw e }
  }
  saved = await one(c, 'SELECT * FROM tt_application_fees WHERE application_id=? AND request_key=?', app.id, p.requestKey)
 }
 insist(saved && saved.adult_id === p.adultId && saved.amount_cents === app.fee_cents, 'fee_changed', 'This fee request belongs to another applicant or total.', 409)
 insist(['reserved', 'checkout'].includes(saved.state), 'fee_finished', 'This fee attempt has finished. Review the recorded outcome.', 409)
 const link = await one(c, 'SELECT checkout_url FROM tt_application_fee_links WHERE fee_id=?', saved.id)
 insist(link, 'restore_hold', 'Restored fee evidence cannot reopen collection. Ask your manager to reconcile it in the original installation.', 409)
 await safeBatch(c, [liveGuard(c, p)])
 if (saved.checkout_id) {
  insist(link.checkout_url, 'provider_review', 'This fee needs provider reconciliation before another payment.', 409)
  return { paymentId: saved.id, checkoutUrl: link.checkout_url, state: saved.state }
 }
 insist(Date.parse(p.now) - Date.parse(saved.consented_at) < 23 * 3600000, 'provider_review', 'This uncertain fee needs provider reconciliation before another payment.', 409)
 const cancel = new URL('/apply', origin.origin), success = new URL(cancel)
 success.searchParams.set('returned', '1')
 const params = new URLSearchParams({ mode: 'payment', 'allowed_payment_method_types[0]': 'card', 'adaptive_pricing[enabled]': 'false', 'wallet_options[link][display]': 'never',
  'payment_method_options[card][request_three_d_secure]': 'automatic',
  'line_items[0][price_data][currency]': 'usd', 'line_items[0][price_data][unit_amount]': String(saved.amount_cents),
  'line_items[0][price_data][product_data][name]': 'Terrace household application fee', 'line_items[0][quantity]': '1',
  'metadata[terrace_application_fee_id]': saved.id, 'payment_intent_data[metadata][terrace_application_fee_id]': saved.id,
  success_url: success.href, cancel_url: cancel.href })
 // Even a rejected response can race another request using this idempotency key. Keep the reservation.
 const checkout = await stripe(env, 'checkout/sessions', params, 'terrace-application-fee:' + saved.id)
 let url: URL
 try { url = new URL(checkout.url) } catch { throw new Fault('stripe_unavailable', 'Stripe did not confirm a secure hosted destination.', 503) }
 insist(typeof checkout.id === 'string' && /^cs_test_[A-Za-z0-9]+$/.test(checkout.id) && checkout.livemode === false && url.protocol === 'https:' && url.hostname === 'checkout.stripe.com' && !url.port && !url.username && !url.password, 'stripe_unavailable', 'Stripe did not confirm a test-mode hosted destination.', 503)
 await safeBatch(c, [liveGuard(c, p), guard(c, "EXISTS(SELECT 1 FROM tt_application_fees WHERE id=? AND (state='reserved' OR (state='checkout' AND checkout_id=?)))", saved.id, checkout.id),
  sql(c, "UPDATE tt_application_fees SET checkout_id=?,state='checkout' WHERE id=?", checkout.id, saved.id),
  sql(c, 'UPDATE tt_application_fee_links SET checkout_url=? WHERE fee_id=?', url.href, saved.id)])
 return { paymentId: saved.id, checkoutUrl: url.href, state: 'checkout' }
}

/** Applicant confirmation fetches the canonical event; redirect fields can neither mark paid nor change the total. */
export async function reconcileApplicationFee(env: Bindings, p: Applicant & { eventId: unknown }) {
 const c = context(env, p), app = await application(c, p)
 return verifiedApplicationFee(env, p.eventId, p.now, app.id, [liveGuard(c, p)])
}
/** The staff caller must check current application-read authority and scope before calling. */
export async function reconcileStaffApplicationFee(env: Bindings, eventId: unknown, now: string, applicationId: string, authority: D1PreparedStatement[]) {
 return verifiedApplicationFee(env, eventId, now, applicationId, authority)
}
async function verifiedApplicationFee(env: Bindings, eventId: unknown, now: string, applicationId: string, authority: D1PreparedStatement[]) {
 insist(typeof eventId === 'string' && /^evt_[A-Za-z0-9]{5,100}$/.test(eventId), 'provider_event', 'Supply a Stripe event id.')
 const ev = await stripe(env, 'events/' + eventId), object = ev.data?.object
 insist(ev.id === eventId && ev.livemode === false && object && ['checkout.session.completed', 'checkout.session.expired', 'payment_intent.payment_failed'].includes(ev.type), 'provider_event', 'A supported canonical Stripe test event is required.', 409)
 const c: Context = { db: env.DB, now, actor: { id: 'provider:stripe', role: 'member', displayName: 'Stripe verified fee' } }
 const fee = await one(c, 'SELECT f.* FROM tt_application_fees f JOIN tt_applications a ON a.id=f.application_id JOIN tt_prospects p ON p.id=a.prospect_id WHERE f.id=? AND a.id=? AND p.merged_into IS NULL', String(object.metadata?.terrace_application_fee_id ?? ''), applicationId)
 insist(fee, 'not_found', 'Application fee not found.', 404)
 insist(await one(c, 'SELECT 1 AS ok FROM tt_application_fee_links WHERE fee_id=?', fee.id), 'restore_hold', 'Restored evidence cannot confirm another collection. Reconcile in its originating installation.', 409)
 const prior = await one(c, 'SELECT id FROM tt_application_fee_events WHERE id=? AND fee_id=?', ev.id, fee.id)
 if (prior) { await safeBatch(c, authority); return { paymentId: fee.id, state: fee.state, replayed: true } }
 const failed = ev.type === 'payment_intent.payment_failed', expired = ev.type === 'checkout.session.expired'
 let intent: Row | undefined, charge: Row | undefined
 if (failed) {
  insist(fee.checkout_id, 'provider_event', 'The fee has no matching hosted session.', 409)
  const session = await stripe(env, 'checkout/sessions/' + fee.checkout_id)
  insist(session.id === fee.checkout_id && session.livemode === false && session.mode === 'payment' && session.currency === 'usd' && session.amount_total === fee.amount_cents && session.metadata?.terrace_application_fee_id === fee.id && session.payment_intent === object.id && object.currency === 'usd' && object.amount === fee.amount_cents, 'provider_event', 'The failed attempt does not match the hosted fee.', 409)
 } else {
  insist(fee.checkout_id && object.id === fee.checkout_id && object.livemode === false && object.mode === 'payment' && object.currency === 'usd' && object.amount_total === fee.amount_cents && (expired ? object.status === 'expired' : object.payment_status === 'paid'), 'provider_event', 'The hosted fee, mode, amount or outcome does not match.', 409)
  if (!expired) {
   insist(typeof object.payment_intent === 'string', 'provider_event', 'The hosted fee has no provider payment.', 409)
   intent = await stripe(env, 'payment_intents/' + object.payment_intent)
   insist(intent.id === object.payment_intent && intent.livemode === false && intent.status === 'succeeded' && intent.currency === 'usd' && intent.amount === fee.amount_cents && intent.amount_received === fee.amount_cents && intent.metadata?.terrace_application_fee_id === fee.id && typeof intent.latest_charge === 'string', 'provider_event', 'The provider payment does not match the household fee.', 409)
   charge = await stripe(env, 'charges/' + intent.latest_charge)
   insist(charge.id === intent.latest_charge && charge.livemode === false && charge.paid === true && charge.captured === true && charge.refunded === false && charge.currency === 'usd' && charge.amount === fee.amount_cents && charge.amount_captured === fee.amount_cents && charge.amount_refunded === 0 && charge.payment_intent === intent.id, 'provider_event', 'The provider charge is not a matching captured household fee.', 409)
  }
 }
 // A decline remains in the same Checkout session; only canonical expiry releases its one open attempt.
 const state = expired ? 'expired' : failed ? fee.state : 'paid'
 insist(['reserved', 'checkout'].includes(fee.state) || fee.state === state, 'fee_finished', 'This fee already has a different terminal outcome.', 409)
 const writes = [...authority, guard(c, 'EXISTS(SELECT 1 FROM tt_application_fees WHERE id=? AND state=?)', fee.id, fee.state),
  sql(c, 'INSERT INTO tt_application_fee_events(id,fee_id,kind,object_id,provider_created,verified_at) VALUES(?,?,?,?,?,?)', ev.id, fee.id, ev.type, object.id, ev.created, now),
  sql(c, 'UPDATE tt_application_fees SET state=?,intent_id=COALESCE(?,intent_id),charge_id=COALESCE(?,charge_id),last_event_id=? WHERE id=?', state, intent?.id ?? null, charge?.id ?? null, ev.id, fee.id), sql(c,'UPDATE tt_applications SET last_activity_at=? WHERE id=?',now,applicationId), audit(c, 'application.fee.event', fee.id, ev.type)]
 try { await c.db.batch(writes) } catch (e) {
  if (/UNIQUE constraint|CHECK constraint/.test(String(e)) && await one(c, 'SELECT id FROM tt_application_fee_events WHERE id=? AND fee_id=?', ev.id, fee.id)) { await safeBatch(c, authority); const current = await one(c, 'SELECT state FROM tt_application_fees WHERE id=?', fee.id); return { paymentId: fee.id, state: current?.state, replayed: true } }
  if (/CHECK constraint/.test(String(e))) throw conflict()
  throw e
 }
 return { paymentId: fee.id, state: failed ? 'declined' : state, replayed: false }
}
