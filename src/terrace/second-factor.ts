// SAFE-001. Terrace's own second factor: a time-based one-time password (RFC 6238: HMAC-SHA1, 30-second steps,
// 6 digits, one step either side of now) with ten single-use recovery codes. Once a person confirms an
// authenticator, every new sign-in of theirs must pass it before any page, API call, download or command; when the
// owner requires a second factor, everyone who signs in with an email link must enrol. A sign-in through the
// organisation's identity provider (OIDC) counts as satisfied: that provider's own MFA policy applies.
// Secrets are sealed with AES-GCM under a key derived from the installation's session secret and, like the
// recovery codes and verified sessions, are never archived: after a restore elsewhere people enrol again.
import { all, allow, commit, Fault, guard, id, insist, one, sha256, sql, text, type Context, type Row } from './core'

const STEP = 30, DIGITS = 6, WINDOW = 1, CODES = 10, FAILURES = 5, LOCK_MINUTES = 15
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
const enc = new TextEncoder()
export const base32 = (b: Uint8Array) => { let bits = 0, v = 0, out = ''; for (const x of b) { v = (v << 8) | x; bits += 8; while (bits >= 5) { out += B32[(v >>> (bits - 5)) & 31]; bits -= 5 } } return bits ? out + B32[(v << (5 - bits)) & 31] : out }
const unbase32 = (s: string) => { let bits = 0, v = 0; const out: number[] = []; for (const ch of s) { v = (v << 5) | B32.indexOf(ch); bits += 5; if (bits >= 8) { out.push((v >>> (bits - 8)) & 255); bits -= 8 } } return new Uint8Array(out) }
const b64 = (b: Uint8Array) => btoa(String.fromCharCode(...b)), unb64 = (s: string) => Uint8Array.from(atob(s), ch => ch.charCodeAt(0))

async function sealKey(secret: string) {
 const base = await crypto.subtle.importKey('raw', enc.encode(secret), 'HKDF', false, ['deriveKey'])
 return crypto.subtle.deriveKey({ name: 'HKDF', hash: 'SHA-256', salt: enc.encode('terrace-second-factor'), info: enc.encode('totp-secret') }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
}
async function seal(c: Context, raw: Uint8Array) { const iv = crypto.getRandomValues(new Uint8Array(12)); return b64(iv) + '.' + b64(new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await sealKey(c.secret!), raw as BufferSource))) }
async function unseal(c: Context, sealed: string) { const [iv, data] = sealed.split('.'); return new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(iv) as BufferSource }, await sealKey(c.secret!), unb64(data) as BufferSource)) }
async function hotp(raw: Uint8Array, counter: number) {
 const key = await crypto.subtle.importKey('raw', raw as BufferSource, { name: 'HMAC', hash: 'SHA-1' }, false, ['sign'])
 const msg = new Uint8Array(8); new DataView(msg.buffer).setBigUint64(0, BigInt(counter))
 const h = new Uint8Array(await crypto.subtle.sign('HMAC', key, msg)), o = h[19] & 15
 return String((((h[o] & 127) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3]) % 10 ** DIGITS).padStart(DIGITS, '0')
}
/** The step a 6-digit code matches within one step of now, or null. */
async function matchStep(raw: Uint8Array, code: string, now: string) {
 const t = Math.floor(Date.parse(now) / 1000 / STEP)
 for (let d = -WINDOW; d <= WINDOW; d++) if (await hotp(raw, t + d) === code) return t + d
 return null
}
const recoveryHash = (code: string) => sha256(enc.encode('terrace-recovery:' + code.toUpperCase().replace(/[^A-Z2-7]/g, '')))
const newCode = () => { const s = base32(crypto.getRandomValues(new Uint8Array(7))).slice(0, 10); return s.slice(0, 5) + '-' + s.slice(5) }

/** Where the signed-in session stands: enrolled (confirmed authenticator), required (owner's switch), satisfied (verified this session or an identity-provider sign-in). */
export async function factorState(c: Context) {
 const [totp, setting, verified] = await Promise.all([
  one(c, 'SELECT confirmed_at FROM tt_totp WHERE operator_id=?', c.actor.id),
  one(c, 'SELECT required FROM tt_security WHERE singleton=1'),
  one(c, 'SELECT 1 AS ok FROM tt_factor_sessions WHERE session_hash=? AND operator_id=?', c.session!.hash, c.actor.id),
 ])
 const enrolled = !!totp?.confirmed_at, required = setting?.required === 1, idp = c.session!.kind === 'oidc'
 return { enrolled, required, idp, needed: !idp && (enrolled || required), satisfied: idp || !!verified }
}
/** For Base's own account doors: whether this sign-in still owes its second factor. */
export async function owesSecondFactor(db: D1Database, session: { id: string; kind: string; operator: Row }) {
 const state = await factorState({ db, actor: session.operator as Context['actor'], now: new Date().toISOString(), session: { hash: await sha256(enc.encode(session.id)), kind: session.kind } })
 return state.needed && !state.satisfied
}
/** Commands a session may run before passing its second factor: enrolment and verification only. */
export const FACTOR_COMMANDS = ['factor.start', 'factor.confirm', 'factor.verify']

async function failed(c: Context): Promise<never> {
 await sql(c, 'INSERT INTO tt_factor_failures(id,operator_id,at) VALUES(?,?,?)', id(), c.actor.id, c.now).run()
 throw new Fault('invalid_code', 'That code is not valid. Check the time on your device and try again.', 400)
}
async function notLocked(c: Context) {
 const since = new Date(Date.parse(c.now) - LOCK_MINUTES * 60000).toISOString(), n = await one<{ n: number }>(c, 'SELECT COUNT(*) AS n FROM tt_factor_failures WHERE operator_id=? AND at>=?', c.actor.id, since)
 insist((n?.n ?? 0) < FAILURES, 'too_many_attempts', `Too many wrong codes. Wait ${LOCK_MINUTES} minutes and try again.`, 429)
}
const passSession = (c: Context, method: string) => sql(c, 'INSERT INTO tt_factor_sessions(session_hash,operator_id,method,verified_at) VALUES(?,?,?,?) ON CONFLICT(session_hash) DO NOTHING', c.session!.hash, c.actor.id, method, c.now)

export async function factorCommand(c: Context, command: string, p: Row): Promise<Row | undefined> {
 if (command === 'factor.start') {
  allow(c, command)
  const current = await one(c, 'SELECT confirmed_at FROM tt_totp WHERE operator_id=?', c.actor.id)
  insist(!current?.confirmed_at, 'already_enrolled', 'Your authenticator is already set up. Ask the owner to reset it if you lost the device.', 409)
  const raw = crypto.getRandomValues(new Uint8Array(20)), secret = base32(raw), who = await one(c, 'SELECT email FROM oa_operators WHERE id=?', c.actor.id)
  await commit(c, [sql(c, 'INSERT INTO tt_totp(operator_id,secret_sealed,created_at) VALUES(?,?,?) ON CONFLICT(operator_id) DO UPDATE SET secret_sealed=excluded.secret_sealed,created_at=excluded.created_at,last_step=0 WHERE confirmed_at IS NULL', c.actor.id, await seal(c, raw), c.now)], command, c.actor.id)
  return { secret, uri: `otpauth://totp/Terrace:${encodeURIComponent(who?.email ?? c.actor.id)}?secret=${secret}&issuer=Terrace&algorithm=SHA1&digits=${DIGITS}&period=${STEP}`, notice: 'Add this key to your authenticator app, then enter the 6-digit code it shows.' }
 }
 if (command === 'factor.confirm' || command === 'factor.verify') {
  allow(c, command); await notLocked(c)
  const row = await one(c, 'SELECT * FROM tt_totp WHERE operator_id=?', c.actor.id), code = text(p.code, 'Code', 20).replace(/\s/g, '')
  insist(row && (command === 'factor.confirm' ? !row.confirmed_at : !!row.confirmed_at), 'not_enrolled', command === 'factor.confirm' ? 'Start setting up an authenticator first.' : 'Set up an authenticator first.', 409)
  if (command === 'factor.verify' && !/^\d{6}$/.test(code)) {
   const hash = await recoveryHash(code), used = await one(c, 'SELECT 1 AS ok FROM tt_recovery_codes WHERE operator_id=? AND code_hash=? AND used_at IS NULL', c.actor.id, hash)
   if (!used) return failed(c)
   await commit(c, [guard(c, 'EXISTS(SELECT 1 FROM tt_recovery_codes WHERE operator_id=? AND code_hash=? AND used_at IS NULL)', c.actor.id, hash), sql(c, 'UPDATE tt_recovery_codes SET used_at=? WHERE operator_id=? AND code_hash=?', c.now, c.actor.id, hash), passSession(c, 'recovery')], command, c.actor.id)
   const left = await one<{ n: number }>(c, 'SELECT COUNT(*) AS n FROM tt_recovery_codes WHERE operator_id=? AND used_at IS NULL', c.actor.id)
   return { notice: `Recovery code accepted; it cannot be used again. ${left?.n ?? 0} left.` }
  }
  const step = await matchStep(await unseal(c, row.secret_sealed), code, c.now)
  if (step === null || step <= row.last_step) return failed(c)
  const writes = [guard(c, 'EXISTS(SELECT 1 FROM tt_totp WHERE operator_id=? AND last_step<?)', c.actor.id, step), sql(c, 'UPDATE tt_totp SET last_step=?,confirmed_at=COALESCE(confirmed_at,?) WHERE operator_id=?', step, c.now, c.actor.id), passSession(c, 'totp')]
  if (command === 'factor.verify') { await commit(c, writes, command, c.actor.id); return { notice: 'Second factor accepted for this sign-in.' } }
  const codes = Array.from({ length: CODES }, newCode)
  await commit(c, [...writes, sql(c, 'DELETE FROM tt_recovery_codes WHERE operator_id=?', c.actor.id), ...await Promise.all(codes.map(async x => sql(c, 'INSERT INTO tt_recovery_codes(operator_id,code_hash) VALUES(?,?)', c.actor.id, await recoveryHash(x))))], command, c.actor.id)
  return { codes, notice: 'Authenticator confirmed. Save these recovery codes now: each works once and they are not shown again.' }
 }
 if (command === 'factor.require') {
  allow(c, command)
  const on = p.required === 'on' || p.required === true, state = await factorState(c)
  insist(!on || (state.enrolled && state.satisfied), 'enrol_first', 'Set up and pass your own authenticator before requiring one for everyone.', 409)
  await commit(c, [sql(c, 'INSERT INTO tt_security(singleton,required,set_by,set_at) VALUES(1,?,?,?) ON CONFLICT(singleton) DO UPDATE SET required=excluded.required,set_by=excluded.set_by,set_at=excluded.set_at', on ? 1 : 0, c.actor.id, c.now)], command, on ? 'on' : 'off')
  return { notice: on ? 'Everyone who signs in with an email link must now pass a second factor. Identity-provider sign-ins follow that provider’s MFA.' : 'A second factor is now optional.' }
 }
 if (command === 'factor.reset') {
  allow(c, command)
  const target = await one(c, "SELECT id FROM oa_operators WHERE id=? AND id<>?", text(p.operatorId, 'Operator', 100), c.actor.id)
  insist(target, 'not_found', 'Operator not found.', 404)
  await commit(c, [sql(c, 'DELETE FROM tt_totp WHERE operator_id=?', target.id), sql(c, 'DELETE FROM tt_recovery_codes WHERE operator_id=?', target.id), sql(c, 'DELETE FROM tt_factor_sessions WHERE operator_id=?', target.id)], command, target.id)
  return { notice: 'Authenticator reset. They set up a new one at their next sign-in.' }
 }
}

/** Who has an authenticator, for the owner's people page. */
export const enrolledOperators = async (c: Context) => new Set((await all(c, 'SELECT operator_id FROM tt_totp WHERE confirmed_at IS NOT NULL')).map(r => r.operator_id))
