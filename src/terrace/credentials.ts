// OPS-001. Scoped, revocable API credentials. A credential acts as one staff role over fixed portfolios (the same
// capability table and portfolio scope as a person, read from D1 on every call and rechecked inside every write's
// batch) and is narrower still by scope: `read` answers GETs only; `prepare` may also run the proposal commands
// below. No credential approves, posts money, changes access or satisfies a second factor: an unlisted command is
// refused by default, so a future approval or payout door is closed to credentials until it is deliberately listed.
// Only the SHA-256 of a token is kept; the token is shown once, at minting or rotation.
import { all, allow, commit, Fault, id, insist, one, sha256, sql, text, type Actor, type Context, type Row } from './core'
import { requestedRole, roleLabel } from './roles'

export const CREDENTIAL_COMMANDS = ['credential.mint', 'credential.rotate', 'credential.revoke']
/** The only commands a prepare credential may run, each still limited by its role's capability row. */
export const PREPARE_COMMANDS = ['maintenance.prepare', 'maintenance.revise', 'quote.add', 'renewal.prepare', 'arrears.prepare', 'arrears.compare', 'arrears.draft', 'correction.prepare', 'charges.preview', 'agent.execute']
const APPROVAL = /\.(approve|reject|review|owner|exception|sent)$|^period\.|^completion\.close$/
const enc = new TextEncoder()
const hash = (token: string) => sha256(enc.encode('terrace-api-credential:' + token))
const base64url = (b: Uint8Array) => btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

/** The credential behind an `Authorization: Bearer` header, loaded fresh from D1 with its role's actions and portfolios; revoked or unknown tokens answer 401. */
export async function credentialActor(db: D1Database, header: string, now: string): Promise<Actor> {
 const token = /^Bearer (ttk_[A-Za-z0-9_-]{43})$/.exec(header)?.[1]
 const c = { db, now } as Context
 const k = token ? await one(c, 'SELECT * FROM tt_api_credentials WHERE token_hash=? AND revoked_at IS NULL', await hash(token)) : null
 if (!k) throw new Fault('unauthorized', 'Send a current API credential as Authorization: Bearer.', 401)
 const [actions, portfolios, units] = await Promise.all([
  all(c, 'SELECT action FROM tt_role_actions WHERE role=?', k.role),
  all(c, 'SELECT portfolio_id FROM tt_api_credential_portfolios WHERE credential_id=?', k.id),
  k.all_portfolios ? Promise.resolve([] as Row[]) : all(c, 'SELECT u.id FROM tt_units u JOIN tt_properties p ON p.id=u.property_id JOIN tt_api_credential_portfolios a ON a.portfolio_id=p.portfolio_id WHERE a.credential_id=?', k.id),
 ])
 if (!k.last_used_at || Date.parse(now) - Date.parse(k.last_used_at) > 60_000) await sql(c, 'UPDATE tt_api_credentials SET last_used_at=? WHERE id=?', now, k.id).run()
 return { id: k.id, role: 'member', displayName: k.label, version: k.version, credential: { scope: k.scope, label: k.label },
  staff: { role: k.role, all: k.all_portfolios === 1, version: k.version, actions: actions.map(a => a.action), portfolios: portfolios.map(p => p.portfolio_id), units: new Set(units.map(u => u.id)) } }
}

/** A credential never approves and never leaves its scope: approvals answer credential_cannot_approve, anything unlisted credential_scope. */
export function credentialGate(c: Context, name: string) {
 const k = c.actor.credential
 if (!k) return
 insist(!APPROVAL.test(name), 'credential_cannot_approve', 'An API credential can prepare but never approve: a person approves in their own sign-in.', 403)
 insist(k.scope === 'prepare' && PREPARE_COMMANDS.includes(name), 'credential_scope', `This credential is ${k.scope === 'read' ? 'read-only' : 'prepare-only'} and cannot run ${name}.`, 403)
}
/** Credentials never download installation-wide archives. */
export function noCredential(c: Context, what: string) { insist(!c.actor.credential, 'credential_scope', `An API credential cannot ${what}.`, 403) }

const mintToken = () => 'ttk_' + base64url(crypto.getRandomValues(new Uint8Array(32)))
const find = async (c: Context, value: unknown) => { const k = await one(c, 'SELECT * FROM tt_api_credentials WHERE id=?', text(value, 'Credential', 100)); insist(k, 'not_found', 'Credential not found.', 404); return k }

/** Owner only (no role holds credential.*), with the fresh email-link proof the dispatcher demands (SAFE-001). */
export async function credentialCommand(c: Context, name: string, p: Row): Promise<Row | undefined> {
 if (!CREDENTIAL_COMMANDS.includes(name)) return
 allow(c, name)
 if (name === 'credential.mint') {
  const want = await requestedRole(c, p), label = text(p.label, 'Label', 80), key = id(), token = mintToken()
  insist(['read', 'prepare'].includes(p.scope), 'scope', 'Choose read (GET only) or prepare (GET and proposals, never an approval).')
  insist(want.every || want.ids.length, 'portfolios', 'Choose all portfolios or at least one.')
  await commit(c, [
   sql(c, 'INSERT INTO tt_api_credentials(id,label,role,scope,all_portfolios,token_hash,created_by,created_at) VALUES(?,?,?,?,?,?,?,?)', key, label, want.role, p.scope, want.every ? 1 : 0, await hash(token), c.actor.id, c.now),
   ...want.ids.map(f => sql(c, 'INSERT INTO tt_api_credential_portfolios(credential_id,portfolio_id) VALUES(?,?)', key, f)),
  ], name, key)
  return { id: key, token, role: want.role, scope: p.scope, notice: `Credential “${label}” created as ${roleLabel(want.role).toLowerCase()}, ${p.scope === 'read' ? 'read-only' : 'prepare-only'}. Copy the token now: it is shown once.` }
 }
 const k = await find(c, p.credentialId)
 if (name === 'credential.rotate') {
  insist(!k.revoked_at, 'revoked', 'A revoked credential cannot be rotated: mint a new one.', 409)
  const token = mintToken()
  await commit(c, [sql(c, 'UPDATE tt_api_credentials SET token_hash=?,version=version+1,rotated_at=? WHERE id=? AND revoked_at IS NULL', await hash(token), c.now, k.id)], name, k.id)
  return { id: k.id, token, notice: `Credential “${k.label}” rotated. The old token stopped working; copy the new one now, it is shown once.` }
 }
 await commit(c, [sql(c, 'UPDATE tt_api_credentials SET revoked_at=COALESCE(revoked_at,?),revoked_by=COALESCE(revoked_by,?),version=version+1 WHERE id=?', c.now, c.actor.id, k.id)], name, k.id)
 return { id: k.id, notice: `Credential “${k.label}” revoked.` }
}

/** The owner's credential list: who it acts as, its reach and when it last answered. Never any token or hash. */
export async function credentialData(c: Context) {
 if (c.actor.role !== 'owner') return { credentials: [], portfolios: [] }
 const [rows, links, portfolios] = await Promise.all([
  all(c, 'SELECT id,label,role,scope,all_portfolios,version,created_at,rotated_at,revoked_at,last_used_at FROM tt_api_credentials ORDER BY created_at,id'),
  all(c, 'SELECT a.credential_id,f.name FROM tt_api_credential_portfolios a JOIN tt_portfolios f ON f.id=a.portfolio_id ORDER BY f.name'),
  all(c, 'SELECT id,name FROM tt_portfolios ORDER BY name'),
 ])
 return { credentials: rows.map(k => ({ ...k, portfolios: k.all_portfolios ? ['All portfolios'] : links.filter(l => l.credential_id === k.id).map(l => l.name) })), portfolios }
}

/** Idempotent writes: one stored outcome per credential and Idempotency-Key. A reused key with another body is refused; a key whose first attempt never reported back stays pending (outcome uncertain) and is never silently re-run. */
export async function beginIdempotent(c: Context, key: string | null, body: string): Promise<Response | null> {
 insist(key && /^[A-Za-z0-9._:-]{8,100}$/.test(key), 'idempotency_key_required', 'Send an Idempotency-Key header (8 to 100 letters, digits or . _ : -) so a retry cannot repeat the write.')
 const digest = await sha256(enc.encode(body))
 try { await sql(c, "INSERT INTO tt_api_idempotency(credential_id,key,request_sha256,state,created_at) VALUES(?,?,?,'pending',?)", c.actor.id, key, digest, c.now).run(); return null }
 catch (e) { if (!String(e).includes('UNIQUE constraint')) throw e }
 const seen = await one(c, 'SELECT * FROM tt_api_idempotency WHERE credential_id=? AND key=?', c.actor.id, key)
 insist(seen && seen.request_sha256 === digest, 'idempotency_conflict', 'That Idempotency-Key was used for a different request. Use a new key for new work.', 422)
 insist(seen.state === 'done', 'idempotency_in_progress', 'The first attempt with this key has not reported an outcome. Read the record, then use a new key if it is absent.', 409)
 return new Response(seen.response, { status: 200, headers: { 'content-type': 'application/json', 'cache-control': 'no-store', 'idempotent-replay': 'true' } })
}
export const finishIdempotent = (c: Context, key: string, response: string) => sql(c, "UPDATE tt_api_idempotency SET state='done',response=? WHERE credential_id=? AND key=?", response, c.actor.id, key).run()
