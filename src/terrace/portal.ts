// ROLE-002. Staff doors for external portal people: invite a resident (or a delegated contact), an owner or a vendor against one
// record, and revoke a grant or a whole person. Inviting or revoking is an access change, so it needs the fresh email-link proof
// (SAFE-001). Resident grants are limited to tenancies the staff member reaches; owner and vendor grants are installation-wide
// records, so they need every-portfolio scope, as the owner and vendor directories do. Nothing here moves money or reads a record.
import type { Bindings } from '../auth.server'
import { operatorMail } from '../mail.server.mjs'
import { all, audit, commit, email, everywhere, escape, id, insist, one, sql, tenancy, text, type Context, type Row } from './core'
import { hash, linkExpiry, secret } from './portal-session'

export const PORTAL_COMMANDS = ['portal.invite', 'portal.revoke']
const SUBJECT: Record<string, { access: string[]; column: string }> = { resident: { access: ['resident', 'delegate'], column: 'tenancy_id' }, owner: { access: ['owner'], column: 'owner_id' }, vendor: { access: ['vendor'], column: 'vendor_id' } }

async function subject(c: Context, kind: string, p: Row) {
 if (kind === 'resident') { const t = await tenancy(c, p.tenancyId); return { column: 'tenancy_id', value: t.id as string, label: t.address as string } }
 everywhere(c)
 if (kind === 'owner') { const o = await one(c, 'SELECT id,legal_name FROM tt_owners WHERE id=?', text(p.ownerId, 'Owner', 100)); insist(o, 'not_found', 'Owner not found.', 404); return { column: 'owner_id', value: o.id as string, label: o.legal_name as string } }
 const v = await one(c, 'SELECT id,name FROM tt_vendors WHERE id=?', text(p.vendorId, 'Vendor', 100)); insist(v, 'not_found', 'Vendor not found.', 404)
 return { column: 'vendor_id', value: v.id as string, label: v.name as string }
}
/** Staff reach for an existing grant: residents by tenancy scope, owners and vendors by every-portfolio scope. */
async function reach(c: Context, grant: Row) { if (grant.tenancy_id) await tenancy(c, grant.tenancy_id); else everywhere(c) }

export async function portalCommand(c: Context, command: string, p: Row): Promise<Row | undefined> {
 if (!PORTAL_COMMANDS.includes(command)) return
 if (command === 'portal.invite') {
  const kind = String(p.kind), spec = SUBJECT[kind]
  insist(spec, 'portal_kind', 'Choose resident, owner or vendor.')
  const access = String(p.access ?? spec.access[0])
  insist(spec.access.includes(access), 'portal_access', 'Choose resident or delegated contact access.')
  const target = await subject(c, kind, p), to = email(p.email), name = text(p.displayName, 'Name', 200), source = text(p.source, 'Authorization reference', 500)
  const existing = await one(c, 'SELECT * FROM tt_portal_identities WHERE kind=? AND email=?', kind, to), person = existing?.id ?? id(), grant = id(), token = secret(), eventId = id()
  await commit(c, [
   sql(c, "INSERT INTO tt_portal_identities(id,kind,email,display_name,status,invited_by,invited_at) VALUES(?,?,?,?,'invited',?,?) ON CONFLICT(kind,email) DO UPDATE SET display_name=excluded.display_name,status=CASE WHEN status='revoked' THEN 'invited' ELSE status END,activated_at=CASE WHEN status='revoked' THEN NULL ELSE activated_at END,revoked_by=NULL,revoked_at=NULL", person, kind, to, name, c.actor.id, c.now),
   sql(c, `INSERT INTO tt_portal_grants(id,identity_id,access,${target.column},source,granted_by,granted_at) SELECT ?,id,?,?,?,?,? FROM tt_portal_identities WHERE kind=? AND email=?`, grant, access, target.value, source, c.actor.id, c.now, kind, to),
   sql(c, 'INSERT INTO tt_portal_links(token_hash,identity_id,purpose,created_at,expires_at) SELECT ?,id,?,?,? FROM tt_portal_identities WHERE kind=? AND email=?', await hash(token), 'invite', c.now, linkExpiry(c.now), kind, to),
  ], command, grant)
  const person_id = (await one(c, 'SELECT id FROM tt_portal_identities WHERE kind=? AND email=?', kind, to))!.id
  const body = `You have been given access to ${target.label} on Terrace.\n\nOpen this link to sign in. It works once and expires in 7 days:\n{link}\n\nIf you did not expect this, ignore this message: nothing is opened until you follow the link.`
  return { identityId: person_id, grantId: grant, tenancyId: kind === 'resident' ? target.value : undefined, portalEmail: { eventId, to, token, subject: 'Your Terrace portal access', body }, notice: `Portal access recorded for ${name} (${access === 'delegate' ? 'delegated contact' : kind}).` }
 }
 // portal.revoke: one grant, or the person and everything they hold.
 const reason = text(p.reason, 'Reason', 500)
 if (p.grantId) {
  const grant = await one(c, 'SELECT * FROM tt_portal_grants WHERE id=? AND revoked_at IS NULL', text(p.grantId, 'Grant', 100))
  insist(grant, 'not_found', 'Active grant not found.', 404); await reach(c, grant)
  await commit(c, [sql(c, 'UPDATE tt_portal_grants SET revoked_by=?,revoked_at=?,revoke_reason=? WHERE id=? AND revoked_at IS NULL', c.actor.id, c.now, reason, grant.id), sql(c, 'UPDATE tt_portal_sessions SET revoked_at=? WHERE identity_id=? AND revoked_at IS NULL', c.now, grant.identity_id)], command, grant.id)
  return { tenancyId: grant.tenancy_id ?? undefined, notice: 'Portal access to that record revoked. The person’s open sessions have ended; they sign in again to reach anything else they hold.' }
 }
 const person = await one(c, "SELECT * FROM tt_portal_identities WHERE id=? AND status<>'revoked'", text(p.identityId, 'Person', 100))
 insist(person, 'not_found', 'Portal person not found.', 404)
 for (const g of await all(c, 'SELECT * FROM tt_portal_grants WHERE identity_id=? AND revoked_at IS NULL', person.id)) await reach(c, g)
 await commit(c, [
  sql(c, "UPDATE tt_portal_identities SET status='revoked',revoked_by=?,revoked_at=? WHERE id=?", c.actor.id, c.now, person.id),
  sql(c, 'UPDATE tt_portal_grants SET revoked_by=?,revoked_at=?,revoke_reason=? WHERE identity_id=? AND revoked_at IS NULL', c.actor.id, c.now, reason, person.id),
  sql(c, 'UPDATE tt_portal_sessions SET revoked_at=? WHERE identity_id=? AND revoked_at IS NULL', c.now, person.id),
  sql(c, 'UPDATE tt_portal_links SET used_at=? WHERE identity_id=? AND used_at IS NULL', c.now, person.id),
 ], command, person.id)
 return { notice: 'Portal access revoked everywhere. Open sessions and unused links stop working now.' }
}

/** Staff listing: people and live grants on records the viewer reaches. Never carries a link or session secret. */
export async function portalData(c: Context) {
 const people = await all(c, "SELECT i.id,i.kind,i.email,i.display_name,i.status,i.invited_at,i.activated_at,i.revoked_at FROM tt_portal_identities i ORDER BY i.display_name,i.id")
 const grants = await all(c, 'SELECT g.id,g.identity_id,g.access,g.tenancy_id,g.owner_id,g.vendor_id,g.source,g.granted_at,g.revoked_at,t.address,t.unit_id,o.legal_name AS owner_name,v.name AS vendor_name FROM tt_portal_grants g LEFT JOIN tt_tenancies t ON t.id=g.tenancy_id LEFT JOIN tt_owners o ON o.id=g.owner_id LEFT JOIN tt_vendors v ON v.id=g.vendor_id ORDER BY g.granted_at')
 const wide = c.actor.role === 'owner' || !!c.actor.staff?.all, reachable = (g: Row) => g.tenancy_id ? (wide || c.actor.staff?.units.has(g.unit_id)) : wide
 const seen = grants.filter(reachable)
 return { people: people.filter(p => seen.some(g => g.identity_id === p.id)).map(p => ({ ...p, grants: seen.filter(g => g.identity_id === p.id).map(g => ({ id: g.id, access: g.access, record: g.address ?? g.owner_name ?? g.vendor_name, source: g.source, grantedAt: g.granted_at, revokedAt: g.revoked_at })) })),
  owners: wide ? await all(c, 'SELECT id,legal_name AS name FROM tt_owners ORDER BY legal_name') : [], vendors: wide ? await all(c, 'SELECT id,name FROM tt_vendors ORDER BY name') : [] }
}

/** The invitation goes after its grant is committed; the provider's own answer is recorded in the history either way. */
export async function sendPortalEmail(c: Context, env: Bindings, m: Row) {
 const mail = operatorMail(env), link = `${env.AUTH_ORIGIN}/portal/accept?token=${m.token}`
 let outcome = mail ? 'uncertain' : 'unconfigured'
 if (mail) try { outcome = (await mail.send({ deliveryId: m.eventId, from: env.MAIL_FROM!, to: [m.to], subject: m.subject, text: m.body.replace('{link}', link), html: `<p>${escape(m.body).replace('{link}', `<a href="${escape(link)}">${escape(link)}</a>`).replace(/\n/g, '<br>')}</p>`, headers: {} } as Parameters<NonNullable<typeof mail>['send']>[0])).status } catch { outcome = 'failed' }
 await audit(c, 'portal.invite.email', m.eventId, outcome).run()
 return { outcome, label: outcome === 'accepted' ? 'invitation accepted by the mail provider; delivery is not confirmed' : 'invitation not delivered (' + outcome + '); revoke and invite again once mail works' }
}

/** Inside the reviewed erasure transaction: a resident's portal grants on the erased lease go, and a resident left with none is removed with their links and sessions. */
export async function portalErasureStatements(c: Context, tenancyId: string) {
 const orphans = (await all(c, "SELECT DISTINCT g.identity_id AS id FROM tt_portal_grants g JOIN tt_portal_identities i ON i.id=g.identity_id WHERE g.tenancy_id=? AND i.kind='resident' AND NOT EXISTS(SELECT 1 FROM tt_portal_grants o WHERE o.identity_id=g.identity_id AND o.tenancy_id IS NOT ?)", tenancyId, tenancyId)).map(r => r.id as string)
 const marks = orphans.map(() => '?').join(',')
 return [sql(c, 'UPDATE tt_portal_sessions SET revoked_at=COALESCE(revoked_at,?) WHERE identity_id IN (SELECT identity_id FROM tt_portal_grants WHERE tenancy_id=?)', c.now, tenancyId), sql(c, 'DELETE FROM tt_portal_grants WHERE tenancy_id=?', tenancyId),
  ...(orphans.length ? ['tt_portal_sessions', 'tt_portal_links'].map(t => sql(c, `DELETE FROM ${t} WHERE identity_id IN (${marks})`, ...orphans)).concat(sql(c, `DELETE FROM tt_portal_identities WHERE id IN (${marks})`, ...orphans)) : [])]
}
