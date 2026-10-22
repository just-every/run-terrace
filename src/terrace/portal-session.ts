// ROLE-002: portal links and sessions. A link is single-use and expires; a session lasts hours, and every request re-reads the
// live session, identity and grants, so a revocation or a changed assignment applies on the next request. Only hashes are stored.
import { sha256, type Context, type Row } from './core'
export const COOKIE = 'tt_portal'
const LINK_MS = 7 * 86400000, SESSION_MS = 12 * 3600000
export const secret = () => [...crypto.getRandomValues(new Uint8Array(32))].map(b => b.toString(16).padStart(2, '0')).join('')
export const hash = (value: string) => sha256(new TextEncoder().encode(value))
export type Portal = { identity: Row; grants: Row[]; sessionHash: string }

export const linkExpiry = (now: string) => new Date(Date.parse(now) + LINK_MS).toISOString()
export const sessionExpiry = (now: string) => new Date(Date.parse(now) + SESSION_MS).toISOString()

/** Trades a valid, unused link for a new session, in one batch; null when the link is unknown, used, expired or its person is revoked. */
export async function redeem(db: D1Database, token: string, now: string) {
 const th = await hash(token)
 const link = await db.prepare("SELECT l.token_hash,l.purpose,i.id AS identity_id,i.status FROM tt_portal_links l JOIN tt_portal_identities i ON i.id=l.identity_id WHERE l.token_hash=? AND l.used_at IS NULL AND l.expires_at>?").bind(th, now).first<Row>()
 if (!link || (link.purpose === 'signin' ? link.status !== 'active' : !['invited', 'active'].includes(link.status))) return null
 const session = secret(), sh = await hash(session)
 const results = await db.batch([
  db.prepare('UPDATE tt_portal_links SET used_at=? WHERE token_hash=? AND used_at IS NULL').bind(now, th),
  db.prepare("UPDATE tt_portal_identities SET status='active',activated_at=COALESCE(activated_at,?) WHERE id=? AND status IN ('invited','active')").bind(now, link.identity_id),
  db.prepare("INSERT INTO tt_portal_sessions(hash,identity_id,created_at,expires_at) SELECT ?,?,?,? WHERE EXISTS(SELECT 1 FROM tt_portal_identities WHERE id=? AND status='active') AND EXISTS(SELECT 1 FROM tt_portal_links WHERE token_hash=? AND used_at=?)").bind(sh, link.identity_id, now, sessionExpiry(now), link.identity_id, th, now),
 ])
 return results[0].meta.changes === 1 && results[2].meta.changes === 1 ? { session, identityId: link.identity_id as string } : null
}

/** The live portal person behind a request's cookie, or null. */
export async function current(db: D1Database, cookie: string | null, now: string): Promise<Portal | null> {
 const value = cookie?.split(/;\s*/).map(p => p.split('=')).find(([k]) => k === COOKIE)?.[1]
 if (!value) return null
 const sessionHash = await hash(value)
 const identity = await db.prepare("SELECT i.* FROM tt_portal_sessions s JOIN tt_portal_identities i ON i.id=s.identity_id WHERE s.hash=? AND s.revoked_at IS NULL AND s.expires_at>? AND i.status='active'").bind(sessionHash, now).first<Row>()
 if (!identity) return null
 const grants = (await db.prepare('SELECT * FROM tt_portal_grants WHERE identity_id=? AND revoked_at IS NULL ORDER BY granted_at').bind(identity.id).all<Row>()).results
 return { identity, grants, sessionHash }
}

/** The context reads run under: one person's session, with only the actions a portal read uses. Scope is the grant's own record, never the actor. */
export function portalContext(db: D1Database, portal: Portal, now: string, secretKey?: string): Context {
 return { db, now, secret: secretKey, zone: 'UTC', actor: { id: 'portal:' + portal.identity.id, role: 'member', displayName: portal.identity.display_name, staff: { role: 'portal_' + portal.identity.kind, all: true, version: 1, actions: ['reports.read'], portfolios: [], units: new Set() } } }
}
