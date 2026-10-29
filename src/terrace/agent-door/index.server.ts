import { createAgentDoor, operatorAuthPeople, type Trust } from '../../modules/agent-door/index.ts'
import { authConfig, operatorAuth, type Bindings } from '../../auth.server'
import { owesSecondFactor } from '../second-factor'
import { credentialActor } from '../credentials'
import { nativeContext } from './context'
import { tools } from './tools'
import { capabilities, notTools, specialist } from './spec.mjs'

function trust(env: Bindings): Trust | null {
 const issuer = env.RER_OWNER_CLAIM_ISSUER, installationId = env.RER_OWNER_CLAIM_INSTALLATION_ID, publicKeys = env.RER_OWNER_CLAIM_PUBLIC_KEYS
 if (![issuer,installationId,publicKeys].some(Boolean)) return null
 if (!issuer || !installationId || !publicKeys) throw new Error('Incomplete agent door trust configuration')
 return { issuer, installationId, appOrigin: env.AUTH_ORIGIN, publicKeys: JSON.parse(publicKeys) }
}
export function terraceAgentDoor(env: Bindings) {
 const people = operatorAuthPeople({ db: env.DB, allowList: authConfig(env).allowList, session: async request => {
  const session = await operatorAuth(env).getSession(request)
  return session && !await owesSecondFactor(env.DB,session) ? session : null
 } })
 return createAgentDoor({ seed: 'terrace', name: 'Terrace', specialist, db: env.DB, origin: env.AUTH_ORIGIN, trust: trust(env), people,
  capabilities, tools: tools(env), resources: [], notTools,
  async localCredentials(request) {
   const header = request.headers.get('authorization') ?? ''
   if (!/^Bearer ttk_/.test(header)) return null
   try {
    const actor = await credentialActor(env.DB, header, new Date().toISOString())
    const k = await env.DB.prepare('SELECT created_by FROM tt_api_credentials WHERE id=? AND revoked_at IS NULL').bind(actor.id).first<{created_by: string}>()
    if (!k) return null
    return { sponsor: { id: k.created_by }, agent: { id: actor.id, name: actor.displayName, specialist }, clientId: actor.id, scopes: actor.credential?.scope === 'prepare' ? ['terrace:read','terrace:prepare'] : ['terrace:read'] }
   } catch { return null }
  },
  async currentScopes(principal) {
   try { const c = await nativeContext(env, principal); return c.actor.credential ? c.actor.credential.scope === 'prepare' ? ['terrace:read','terrace:prepare'] : ['terrace:read'] : principal.scopes }
   catch { return [] }
  },
 })
}
