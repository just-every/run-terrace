// ROLE-001. Staff rights by responsibility: each non-owner operator holds one Terrace role over Base's sign-in
// tier, either over every portfolio or only the portfolios the owner assigned. What each role may do is the one
// capability table, tt_role_actions, read here for every request and rechecked inside every write's D1 batch
// (core.ts authority). Only the owner changes roles and assignments; each change is kept in tt_role_changes.
import { all, id, insist, one, sql, text, commit, type Context, type Row } from './core'

export const ROLES: [string, string, string][] = [
 ['portfolio_manager', 'Portfolio manager', 'Leases, renewals, households, rent, maintenance approval and owner limits in their portfolios. No access changes.'],
 ['leasing', 'Leasing', 'Tenancies, households, move-in, move-out and turnovers. No ledger, receipts, statements, collections, rent-roll money, bank accounts or EINs.'],
 ['bookkeeper', 'Bookkeeper', 'Rent charges, receipts, corrections, the charge run, statements, collections and the rent roll. No people or access.'],
 ['accountant', 'Accountant', 'Reads and downloads every ledger, statement, rent roll and collections report. Posts nothing.'],
 ['maintenance_coordinator', 'Maintenance coordinator', 'Inspections, maintenance preparation, vendor reassignment, handoff, vendors, schedules and turnovers. Never approves spend or posts money.'],
 ['member', 'Member', 'Reads the portfolio and prepares renewal, arrears and maintenance proposals. Approves nothing.'],
]
export const roleLabel = (role: string) => ROLES.find(r => r[0] === role)?.[1] ?? role
/** The Base sign-in tier each role uses: portfolio managers sign in as admin, everyone else as member. Terrace's role decides what they may do. */
export const tier = (role: string) => role === 'portfolio_manager' ? 'admin' : 'member'

/** Loads the signed-in operator's role, capabilities and reachable units. An operator Terrace has not given a role yet
 * (invited through Base's own door) gets the migration's default once: admin -> portfolio manager, member -> member, all portfolios. */
export async function loadStaff(c: Context) {
 if (c.actor.role === 'owner') return
 const read = () => one(c, 'SELECT role,all_portfolios,version FROM tt_staff_roles WHERE operator_id=?', c.actor.id)
 let r = await read()
 if (!r) {
  await sql(c, "INSERT INTO tt_staff_roles(operator_id,role,all_portfolios,set_by,set_at) VALUES(?,?,1,'default',?) ON CONFLICT DO NOTHING", c.actor.id, c.actor.role === 'admin' ? 'portfolio_manager' : 'member', c.now).run()
  r = await read()
 }
 insist(r, 'forbidden', 'Access denied.', 403)
 const [actions, portfolios, units] = await Promise.all([
  all(c, 'SELECT action FROM tt_role_actions WHERE role=?', r.role),
  all(c, 'SELECT portfolio_id FROM tt_role_portfolios WHERE operator_id=?', c.actor.id),
  r.all_portfolios ? Promise.resolve([] as Row[]) : all(c, 'SELECT u.id FROM tt_units u JOIN tt_properties p ON p.id=u.property_id JOIN tt_role_portfolios a ON a.portfolio_id=p.portfolio_id WHERE a.operator_id=?', c.actor.id),
 ])
 c.actor.staff = { role: r.role, all: r.all_portfolios === 1, version: r.version, actions: actions.map(a => a.action), portfolios: portfolios.map(p => p.portfolio_id), units: new Set(units.map(u => u.id)) }
}

/** The role and assignments a form or API call asks for: role, allPortfolios, and portfolioIds (array) or one portfolio:<id> field per checked portfolio. */
export async function requestedRole(c: Context, p: Row) {
 const role = String(p.role ?? '')
 insist(ROLES.some(r => r[0] === role), 'role', 'Choose portfolio manager, leasing, bookkeeper, accountant, maintenance coordinator or member.')
 const every = p.allPortfolios === true || p.allPortfolios === '1' || p.allPortfolios === 'on'
 const ids = [...new Set([...(Array.isArray(p.portfolioIds) ? p.portfolioIds : []), ...Object.keys(p).filter(k => k.startsWith('portfolio:')).map(k => k.slice(10))].map(v => text(v, 'Portfolio', 100)))]
 if (ids.length) {
  const known = await all(c, `SELECT id FROM tt_portfolios WHERE id IN (${ids.map(() => '?').join(',')})`, ...ids)
  insist(known.length === ids.length, 'not_found', 'Portfolio not found.', 404)
 }
 return { role, every, ids: every ? [] : ids }
}

/** Owner only (the dispatcher's capability check; no role holds operator.*): sets one operator's role and portfolios, audited. */
export async function setRole(c: Context, operatorId: string, want: { role: string; every: boolean; ids: string[] }, action: string) {
 const target = await one(c, "SELECT id,role FROM oa_operators WHERE id=? AND role<>'owner'", operatorId)
 insist(target, 'not_found', 'Operator not found.', 404)
 await commit(c, [
  sql(c, "INSERT INTO tt_staff_roles(operator_id,role,all_portfolios,set_by,set_at) VALUES(?,?,?,?,?) ON CONFLICT(operator_id) DO UPDATE SET role=excluded.role,all_portfolios=excluded.all_portfolios,version=version+1,set_by=excluded.set_by,set_at=excluded.set_at", target.id, want.role, want.every ? 1 : 0, c.actor.id, c.now),
  sql(c, 'DELETE FROM tt_role_portfolios WHERE operator_id=?', target.id),
  ...want.ids.map(p => sql(c, 'INSERT INTO tt_role_portfolios(operator_id,portfolio_id) VALUES(?,?)', target.id, p)),
  sql(c, 'INSERT INTO tt_role_changes(id,operator_id,role,all_portfolios,portfolios,changed_by,changed_at) VALUES(?,?,?,?,?,?,?)', id(), target.id, want.role, want.every ? 1 : 0, JSON.stringify(want.ids), c.actor.id, c.now),
 ], action, target.id)
}

/** Every operator's Terrace role and portfolios, and the role change history, for the owner's people page. */
export async function roleData(c: Context) {
 const [roles, assigned, portfolios, changes] = await Promise.all([
  all(c, 'SELECT operator_id,role,all_portfolios FROM tt_staff_roles'),
  all(c, 'SELECT a.operator_id,a.portfolio_id,f.name FROM tt_role_portfolios a JOIN tt_portfolios f ON f.id=a.portfolio_id ORDER BY f.name'),
  all(c, 'SELECT id,name FROM tt_portfolios ORDER BY name'),
  all(c, 'SELECT r.*,COALESCE(o.display_name,r.changed_by) AS changed_name,COALESCE(t.display_name,r.operator_id) AS operator_name FROM tt_role_changes r LEFT JOIN oa_operators o ON o.id=r.changed_by LEFT JOIN oa_operators t ON t.id=r.operator_id ORDER BY r.changed_at DESC LIMIT 20'),
 ])
 const of = (operatorId: string) => { const r = roles.find(x => x.operator_id === operatorId); return r ? { role: r.role, all: r.all_portfolios === 1, portfolios: assigned.filter(a => a.operator_id === operatorId) } : null }
 return { of, portfolios, changes }
}
