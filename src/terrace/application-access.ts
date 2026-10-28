import { hash, secret } from './portal-session'
import { audit, guard, insist, one, sql, type Context, type Row } from './core'
import { operatorMail } from '../mail.server.mjs'
import type { Bindings } from '../auth.server'

export const APPLICATION_COOKIE = 'tt_application'
const expiry = (now: string, hours: number) => new Date(Date.parse(now) + hours * 3600000).toISOString()
/** Invitations and sign-in links are emailed once; a provider uncertainty never starts a retry. */
export async function sendApplicationLink(c: Context, env: Bindings, adultId: string) {
 const adult = await one(c, 'SELECT a.* FROM tt_application_adults a JOIN tt_application_access x ON x.adult_id=a.id WHERE a.id=? AND a.revoked_at IS NULL', adultId)
 insist(adult, 'not_found', 'Applicant not found.', 404)
 const token = secret(), key = await hash(token), since = new Date(Date.parse(c.now) - 60000).toISOString()
 const claim = await sql(c, `INSERT INTO tt_application_links(hash,adult_id,created_at,expires_at)
 SELECT ?,?,?,? WHERE EXISTS(SELECT 1 FROM tt_application_adults a JOIN tt_application_access x ON x.adult_id=a.id WHERE a.id=? AND a.revoked_at IS NULL)
 AND NOT EXISTS(SELECT 1 FROM tt_application_links WHERE adult_id=? AND created_at>?) RETURNING hash`, key, adultId, c.now, expiry(c.now, 1), adultId, adultId, since).first()
 if (!claim) return { outcome: 'held', notice: 'A recent sign-in link already exists. Check its delivery before sending again.' }
 const mail = operatorMail(env), href = new URL('/apply/accept', env.AUTH_ORIGIN)
 href.searchParams.set('token', token)
 let outcome = 'unconfigured'
 if (mail) try {
  const sent = await mail.send({ deliveryId: key, from: env.MAIL_FROM!, to: [adult.email], subject: 'Your Terrace application', text: `Open your own application: ${href.href}\nThis link works once and expires in one hour.`, html: '', headers: {} } as Parameters<NonNullable<typeof mail>['send']>[0])
  outcome = sent.status
 } catch { outcome = 'uncertain' }
 await c.db.batch([sql(c, 'UPDATE tt_application_links SET outcome=? WHERE hash=?', outcome, key), audit(c, 'application.invite.result', adultId, outcome)])
 return { outcome, notice: `Sign-in email ${outcome}. Provider acceptance does not confirm delivery.` }
}
export async function acceptApplication(db: D1Database, token: string, now: string) {
 const key = await hash(token), session = secret(), sessionHash = await hash(session)
 const result = await db.batch([
  db.prepare(`INSERT INTO tt_application_sessions(hash,adult_id,created_at,expires_at)
 SELECT ?,l.adult_id,?,? FROM tt_application_links l JOIN tt_application_adults a ON a.id=l.adult_id JOIN tt_application_access x ON x.adult_id=a.id
 WHERE l.hash=? AND l.used_at IS NULL AND l.expires_at>? AND a.revoked_at IS NULL`).bind(sessionHash, now, expiry(now, 12), key, now),
  db.prepare('UPDATE tt_application_links SET used_at=? WHERE hash=? AND used_at IS NULL').bind(now, key),
 ])
 return result[0].meta.changes === 1 ? session : null
}
export async function currentApplicant(db: D1Database, cookie: string | null, now: string) {
 const token = cookie?.split(/;\s*/).map(x => x.split('=')).find(([k]) => k === APPLICATION_COOKIE)?.[1]
 if (!token) return null
 const sessionHash = await hash(token)
 const adult = await db.prepare(`SELECT a.* FROM tt_application_sessions s JOIN tt_application_adults a ON a.id=s.adult_id JOIN tt_application_access x ON x.adult_id=a.id
 WHERE s.hash=? AND s.revoked_at IS NULL AND s.expires_at>? AND a.revoked_at IS NULL`).bind(sessionHash, now).first<Row>()
 return adult ? { adult, sessionHash } : null
}
export const applicantGuard = (c: Context, adultId: string, sessionHash: string) => guard(c, `EXISTS(
 SELECT 1 FROM tt_application_sessions s JOIN tt_application_adults a ON a.id=s.adult_id JOIN tt_application_access x ON x.adult_id=a.id
 WHERE s.hash=? AND s.adult_id=? AND s.revoked_at IS NULL AND s.expires_at>? AND a.revoked_at IS NULL)`, sessionHash, adultId, c.now)
