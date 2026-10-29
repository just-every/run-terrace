import { ToolRefusal, type ToolContext, type Principal } from '../../modules/agent-door/index.ts'
import { credentialRecordActor } from '../credentials'
import { allow, Fault, insist, type Context, type Actor, type Row } from '../core'
import { officeZone } from '../company'
import { loadStaff } from '../roles'
import { redactSensitive } from '../sensitive-metadata'
import type { Bindings } from '../../auth.server'

export async function nativeContext(env: Bindings, who: Pick<Principal, 'person' | 'clientId'>, invocation?: ToolContext): Promise<Context> {
 const now = new Date().toISOString()
 const person = await env.DB.prepare("SELECT id,role,version,display_name AS displayName FROM oa_operators WHERE id=? AND status='active'").bind(who.person.id).first<Actor>()
 insist(person, 'unauthorized', 'The sponsor is no longer active.', 401)
 const c: Context = { db: env.DB, actor: person, now, secret: env.SESSION_SECRET }
 if (who.clientId) {
  const k = await env.DB.prepare('SELECT * FROM tt_api_credentials WHERE id=? AND created_by=? AND revoked_at IS NULL').bind(who.clientId, person.id).first<Row>()
  insist(k, 'unauthorized', 'The native credential is unavailable.', 401)
  c.actor = await credentialRecordActor(env.DB, k, now)
 } else await loadStaff(c)
 c.zone = await officeZone(c)
 if (invocation) c.agentDoor = { agentId: invocation.agent.id, agentName: invocation.agent.name, sponsorId: person.id, label: invocation.actor.label, operationId: invocation.operationId, consent: invocation.consent ?? null, clientId: invocation.clientId ?? null, approvers: invocation.approvers }
 return c
}
export async function admitted(env: Bindings, ctx: ToolContext, action: string, args: Row = {}) {
 const c = await nativeContext(env, ctx, ctx)
 allow(c, action); c.action = action
 c.source = redactSensitive([args.source,args.reference,args.reason].find(v => typeof v === 'string' && v.trim()) ?? '').slice(0,500) || null
 return c
}
export async function nativeCall<T>(run: () => Promise<T>): Promise<T> {
 try { return await run() } catch (error) {
  if (error instanceof Fault) throw new ToolRefusal(error.code)
  throw error
 }
}
