// ACCT-016. Sales and use tax on resident charges, by configured rule: a rule names a property, a charge kind
// (utility, parking, storage or other), a rate and the day it starts, and applies only once an accountant or the
// owner has reviewed it. The rule in force on a charge's due date adds a separate tax charge, half up to the cent,
// that names the rule. Terrace computes the tax as configured; it files and remits nothing.
import { all, allow, commit, date, id, insist, one, reachesPortfolio, sql, text, type Context, type Row } from './core'
import { basisPoints } from './owners'

export const TAX_KINDS = ['utility', 'parking', 'storage', 'other']
const half = (cents: number, bp: number) => Math.floor((cents * bp + 5000) / 10000)

/** The reviewed rule in force for a property, kind and day, if any. */
export async function ruleFor(c: Context, propertyId: string | null | undefined, kind: string, day: string) {
 if (!propertyId || !TAX_KINDS.includes(kind)) return null
 return one(c, 'SELECT * FROM tt_tax_rules WHERE property_id=? AND kind=? AND starts<=? AND reviewed_at IS NOT NULL ORDER BY starts DESC LIMIT 1', propertyId, kind, day)
}
/** The tax charge for a charge of this kind, or null when no reviewed rule is in force. */
export async function taxCharge(c: Context, t: Row, kind: string, day: string, base: number, reference: string, description: string) {
 const unit = t.unit_id ? await one(c, 'SELECT property_id FROM tt_units WHERE id=?', t.unit_id) : null, rule = await ruleFor(c, unit?.property_id, kind, day)
 const amount = rule ? half(base, rule.rate_bp) : 0
 return rule && amount > 0 ? { rule, amount, reference: reference + '-TAX', description: `${rule.label} ${(rule.rate_bp / 100).toFixed(2)}% on ${description}` } : null
}
export const taxInsert = (c: Context, t: Row, day: string, x: NonNullable<Awaited<ReturnType<typeof taxCharge>>>) =>
 sql(c, 'INSERT INTO tt_charges(id,tenancy_id,due_date,amount_cents,description,reference,created_at,currency,tax_rule_id) VALUES(?,?,?,?,?,?,?,?,?)', id(), t.id, day, x.amount, x.description, x.reference, c.now, t.currency, x.rule.id)

export async function taxCommand(c: Context, command: string, p: Row): Promise<Row | undefined> {
 if (command === 'tax.prepare') {
  allow(c, command)
  const prop = await one(c, 'SELECT * FROM tt_properties WHERE id=?', text(p.propertyId, 'Property', 100))
  insist(prop && reachesPortfolio(c, prop.portfolio_id), 'not_found', 'Property not found.', 404)
  insist(TAX_KINDS.includes(p.kind), 'invalid_kind', `A tax rule applies to ${TAX_KINDS.join(', ')} charges.`)
  const key = id()
  await commit(c, [sql(c, 'INSERT INTO tt_tax_rules(id,property_id,kind,rate_bp,label,starts,prepared_by,prepared_at) VALUES(?,?,?,?,?,?,?,?)', key, prop.id, p.kind, basisPoints(p.ratePercent, 'Tax rate'), text(p.label, 'Rule label', 200), date(p.starts, 'Starts'), c.actor.id, c.now)], command, key)
  return { id: key, notice: 'Tax rule prepared. It applies once an accountant or the owner reviews it.' }
 }
 if (command === 'tax.review') {
  allow(c, command)
  const rule = await one(c, 'SELECT r.*,p.portfolio_id FROM tt_tax_rules r JOIN tt_properties p ON p.id=r.property_id WHERE r.id=?', text(p.ruleId, 'Tax rule', 100))
  insist(rule && reachesPortfolio(c, rule.portfolio_id), 'not_found', 'Tax rule not found.', 404)
  insist(!rule.reviewed_at, 'reviewed', 'This rule is already reviewed.', 409)
  await commit(c, [sql(c, 'UPDATE tt_tax_rules SET reviewed_by=?,reviewed_at=? WHERE id=? AND reviewed_at IS NULL', c.actor.id, c.now, rule.id)], command, rule.id)
  return { id: rule.id, notice: 'Tax rule reviewed. It applies to charges due from its start.' }
 }
}
export const taxRules = (c: Context, propertyId: string) => all(c, 'SELECT * FROM tt_tax_rules WHERE property_id=? ORDER BY kind,starts', propertyId)
