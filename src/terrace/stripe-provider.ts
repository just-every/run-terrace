import { Fault, type Row } from './core'

type StripeEnv = { STRIPE_SECRET_KEY?: string; RER_DEMO?: string }
const unavailable = () => new Fault('stripe_unavailable', 'Stripe could not confirm the request. Its outcome may be uncertain; check this payment before trying again.', 503)

/** PAY-003: server-only, test-mode transport. Never retry an uncertain write. */
export async function stripe(env: StripeEnv, path: string, params?: URLSearchParams, idempotencyKey?: string): Promise<Row> {
  if (env.RER_DEMO) throw new Fault('stripe_unavailable', 'Card collection is unavailable in the demo.', 503)
  const key = env.STRIPE_SECRET_KEY?.trim()
  if (!key || /^(sk|rk)_live_/i.test(key)) throw new Fault('stripe_unavailable', 'Card collection requires a configured Stripe test secret key.', 503)
  if (!/^\/?[a-zA-Z0-9_]+(?:\/[a-zA-Z0-9_]+)*$/.test(path)) throw unavailable()

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15_000)
  try {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${key}`,
      'Stripe-Version': '2026-09-30.endive',
    }
    if (params !== undefined) headers['Content-Type'] = 'application/x-www-form-urlencoded'
    if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey
    const response = await fetch(`https://api.stripe.com/v1/${path.replace(/^\//, '')}`, {
      method: params === undefined ? 'GET' : 'POST', headers,
      body: params === undefined ? undefined : params.toString(),
      signal: controller.signal, redirect: 'manual',
    })
    let result: unknown
    try { result = await response.json() } catch { result = undefined }
    if (response.status >= 400 && response.status < 500) {
      const code = (result as Row | undefined)?.error?.code
      const safeCode = typeof code === 'string' && /^[a-z][a-z0-9_]{0,63}$/.test(code) && code !== key && !/^(sk|rk|pk)_/.test(code) ? ` (${code})` : ''
      throw new Fault('stripe_rejected', `Stripe rejected the request${safeCode}. Review the payment before trying again.`, 409)
    }
    if (!response.ok || !result || typeof result !== 'object' || Array.isArray(result)) throw unavailable()
    const row = result as Row
    if ('livemode' in row && row.livemode !== false) throw unavailable()
    return row
  } catch (error) {
    if (error instanceof Fault) throw error
    throw unavailable()
  } finally { clearTimeout(timeout) }
}

/** Hosted card entry: no resident identity or card details leave Terrace here. */
export async function createCheckout(env: StripeEnv, input: { id: string; amountCents: number; origin: string; tenancyId: string }): Promise<Row> {
  if (!Number.isSafeInteger(input.amountCents) || input.amountCents <= 0) throw new Fault('invalid_money', 'Enter a positive amount in exact cents.')
  let cancel: URL
  try {
    const origin = new URL(input.origin)
    if (!['https:', 'http:'].includes(origin.protocol) || origin.username || origin.password) throw new Error()
    cancel = new URL('/portal/card', origin.origin)
  } catch { throw new Fault('invalid_input', 'A valid payment return origin is required.') }
  cancel.searchParams.set('tenancy', input.tenancyId)
  cancel.searchParams.set('payment', input.id)
  const success = new URL(cancel)
  success.searchParams.set('returned', '1')
  const params = new URLSearchParams({
    mode: 'payment',
    'payment_method_types[0]': 'card',
    'payment_method_options[card][request_three_d_secure]': 'automatic',
    'line_items[0][price_data][currency]': 'usd',
    'line_items[0][price_data][unit_amount]': String(input.amountCents),
    'line_items[0][price_data][product_data][name]': 'Terrace account payment',
    'line_items[0][quantity]': '1',
    'metadata[terrace_payment_id]': input.id,
    'payment_intent_data[metadata][terrace_payment_id]': input.id,
    success_url: success.href,
    cancel_url: cancel.href,
  })
  const session = await stripe(env, '/checkout/sessions', params, `terrace-card:${input.id}`)
  let url: URL
  try { url = new URL(session.url) } catch { throw unavailable() }
  if (typeof session.id !== 'string' || !session.id.startsWith('cs_test_') || url.protocol !== 'https:' || url.hostname !== 'checkout.stripe.com' || url.port || url.username || url.password) throw unavailable()
  return session
}
