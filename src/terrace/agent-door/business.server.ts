import { createBusinessSettings } from '../../modules/business-settings/index.ts'
import { nativeOperatorAuth, type Bindings } from '../../auth.server'

export const business = { settings: 1, values: ['display_name'], team: { roles: { admin: 'admin', member: 'member' } } } as const
export function businessSettings(env: Bindings) {
 return createBusinessSettings({ db: env.DB, trust: env.RER_BUSINESS_TRUST, business, team: nativeOperatorAuth(env).businessTeam })
}
