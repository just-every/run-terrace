export type TwilioConfig = { accountSid: string; authToken: string; from: string }
type TwilioMessage = { to: string; body: string; channel: 'sms' | 'voice'; statusCallback?: string }
type TwilioResult = { outcome: 'accepted' | 'rejected' | 'uncertain'; providerId: string | null; errorCode: string | null }

const result = (outcome: TwilioResult['outcome'], errorCode: string | null = null, providerId: string | null = null): TwilioResult => ({ outcome, providerId, errorCode })
const numericCode = (value: unknown): string | null => typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? String(value) : typeof value === 'string' && /^\d{1,10}$/.test(value) ? value : null
const xml = (text: string) => text.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[character]!)
const base64 = (bytes: Uint8Array) => btoa(Array.from(bytes, byte => String.fromCharCode(byte)).join(''))

/** One submission only. An uncertain result requires reconciliation before another send. */
export async function sendTwilio(config: TwilioConfig, message: TwilioMessage, fetcher: typeof fetch = (input, init) => globalThis.fetch(input, init)): Promise<TwilioResult> {
 if (!config.accountSid || !config.authToken || !config.from) return result('rejected', 'unconfigured')
 if (!message.to || !message.body || !['sms', 'voice'].includes(message.channel)) return result('rejected', 'invalid_request')
 const form = new URLSearchParams({ From: config.from, To: message.to })
 if (message.channel === 'voice') {
  const twiml = `<Response><Say>${xml(message.body)}</Say></Response>`
  if (twiml.length > 4000 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\ufffe\uffff]/u.test(message.body)) return result('rejected', 'invalid_voice_body')
  form.set('Twiml', twiml)
 } else form.set('Body', message.body)
 if (message.statusCallback) {
  try {
   const callback = new URL(message.statusCallback)
   if (callback.protocol !== 'https:' || callback.username || callback.password || callback.hash) return result('rejected', 'invalid_callback')
  } catch { return result('rejected', 'invalid_callback') }
  form.set('StatusCallback', message.statusCallback)
  if (message.channel === 'voice') form.set('StatusCallbackMethod', 'POST')
 }
 const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 15_000)
 try {
  const response = await fetcher(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(config.accountSid)}/${message.channel === 'sms' ? 'Messages' : 'Calls'}.json`, {
   method: 'POST', redirect: 'manual', signal: controller.signal,
   headers: { Authorization: `Basic ${base64(new TextEncoder().encode(`${config.accountSid}:${config.authToken}`))}`, 'Content-Type': 'application/x-www-form-urlencoded' },
   body: form.toString(),
  })
  // A server error or interrupted response may follow a committed submission.
  const outcome = response.ok ? 'accepted' : response.status >= 400 && response.status < 500 && response.status !== 408 ? 'rejected' : 'uncertain'
  let receipt: Record<string, unknown> = {}
  try {
   const parsed: unknown = await response.json()
   if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) receipt = parsed as Record<string, unknown>
  } catch { return result(outcome === 'accepted' ? 'uncertain' : outcome, 'invalid_response') }
  const errorCode = numericCode(receipt.code) ?? numericCode(receipt.error_code)
  if (outcome !== 'accepted') return result(outcome, errorCode ?? `http_${response.status}`)
  const providerId = typeof receipt.sid === 'string' && receipt.sid.trim() && receipt.sid.length <= 128 && !/[\s\u0000-\u001f]/u.test(receipt.sid) ? receipt.sid : null
  return providerId ? result('accepted', errorCode, providerId) : result('uncertain', 'missing_provider_id')
 } catch { return result('uncertain', controller.signal.aborted ? 'timeout' : 'transport_error') }
 finally { clearTimeout(timeout) }
}

/** The URL must be the exact externally configured URL, including its query string. */
export async function verifyTwilio(config: TwilioConfig, request: { url: string; params: URLSearchParams; signature: string }): Promise<boolean> {
 if (!config.authToken || !/^[A-Za-z0-9+/]{27}=$/.test(request.signature)) return false
 const seen = new Set<string>(), entries: [string, string][] = []
 for (const [name, value] of request.params) {
  // Reject ambiguous form encodings instead of silently discarding repeated values.
  if (seen.has(name)) return false
  seen.add(name); entries.push([name, value])
 }
 entries.sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
 const signed = request.url + entries.map(([name, value]) => name + value).join('')
 try {
  const signature = Uint8Array.from(atob(request.signature), character => character.charCodeAt(0))
  if (signature.length !== 20 || base64(signature) !== request.signature) return false
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(config.authToken), { name: 'HMAC', hash: 'SHA-1' }, false, ['verify'])
  // Web Crypto compares the decoded signature bytes within its HMAC verifier.
  return await crypto.subtle.verify('HMAC', key, signature, new TextEncoder().encode(signed))
 } catch { return false }
}
