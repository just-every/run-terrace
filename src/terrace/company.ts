// PORT-001: the US management company, its legal entities and their USD operating accounts, and each
// property's time zone. An EIN is format-checked only; an operating account is a recorded reference.
// Terrace verifies neither with the IRS or a bank and moves no money.
import { all, commit, email, guard, id, insist, manager, one, owner, sql, tenancy, text, type Context, type Row } from './core'
import { DEFAULT_ZONE, usZone } from './zones'

/** "12-3456789" or "123456789" -> "12-3456789". */
export function ein(v: unknown) {
 const digits = text(v, 'EIN', 20).replace(/-/g, '')
 insist(/^\d{9}$/.test(digits), 'invalid_ein', 'Enter the EIN as nine digits, for example 12-3456789.')
 return `${digits.slice(0, 2)}-${digits.slice(2)}`
}

// Money tables that carry their tenancy's currency; confirming USD relabels them with the tenancy, never converting an amount.
const BY_TENANCY = ['tt_charges', 'tt_lease_history', 'tt_maintenance_jobs', 'tt_lease_terms', 'tt_schedules', 'tt_assets']
const OPEN = 'SELECT id FROM tt_tenancies WHERE currency_confirmed=0'

export async function companyCommand(c: Context, command: string, p: Row): Promise<Row | undefined> {
 if (command === 'currency.confirm') {
  // PORT-001 legacy currency: the installation owner confirms, once, whether earlier records were AUD or USD.
  owner(c)
  const currency = String(p.currency ?? '')
  insist(['AUD', 'USD'].includes(currency), 'invalid_currency', 'Confirm AUD or USD.')
  insist(!await one(c, 'SELECT 1 FROM tt_currency_confirmation'), 'already_confirmed', 'The currency of earlier records was already confirmed for this installation.', 409)
  const n = (await one<{ n: number }>(c, 'SELECT COUNT(*) AS n FROM tt_tenancies WHERE currency_confirmed=0'))!.n
  insist(n > 0, 'nothing_to_confirm', 'No tenancy has an unconfirmed currency.', 409)
  const relabel = currency === 'USD' ? [
   ...BY_TENANCY.map(table => sql(c, `UPDATE ${table} SET currency='USD' WHERE tenancy_id IN (${OPEN})`)),
   ...['tt_receipts', 'tt_adjustments'].map(table => sql(c, `UPDATE ${table} SET currency='USD' WHERE charge_id IN (SELECT id FROM tt_charges WHERE tenancy_id IN (${OPEN}))`)),
  ] : []
  await commit(c, [
   guard(c, '(SELECT COUNT(*) FROM tt_tenancies WHERE currency_confirmed=0)=?', n),
   sql(c, 'INSERT INTO tt_currency_confirmation(singleton,currency,tenancies,confirmed_by,confirmed_at) VALUES(1,?,?,?,?)', currency, n, c.actor.id, c.now),
   ...relabel,
   sql(c, 'UPDATE tt_tenancies SET currency=?,currency_confirmed=1 WHERE currency_confirmed=0', currency),
  ], command, 'currency:' + currency)
  return { notice: `Confirmed: money on ${n} earlier ${n === 1 ? 'tenancy is' : 'tenancies is'} ${currency}. Labels changed only; no amount was converted.` }
 }
 if (command === 'company.save') {
  manager(c)
  const current = await one(c, 'SELECT version FROM tt_company WHERE singleton=1')
  const values = [text(p.name, 'Company name', 200), usZone(p.timeZone), email(p.officeEmail), text(p.officePhone, 'Office phone', 40), text(p.officeAddress, 'Office address', 300)]
  await commit(c, [current
   ? sql(c, "UPDATE tt_company SET name=?,time_zone=?,office_email=?,office_phone=?,office_address=?,version=version+1,updated_by=?,updated_at=? WHERE singleton=1", ...values, c.actor.id, c.now)
   : sql(c, "INSERT INTO tt_company(singleton,name,country,currency,time_zone,office_email,office_phone,office_address,updated_by,updated_at) VALUES(1,?,'US','USD',?,?,?,?,?,?)", values[0], values[1], values[2], values[3], values[4], c.actor.id, c.now)
  ], command, 'company')
  return { notice: 'Company saved. Money for new tenancies is USD.' }
 }
 if (command === 'entity.add') {
  manager(c)
  const key = id()
  await commit(c, [
   guard(c, 'EXISTS(SELECT 1 FROM tt_company WHERE singleton=1)'),
   sql(c, 'INSERT INTO tt_entities(id,legal_name,ein,created_by,created_at) VALUES(?,?,?,?,?)', key, text(p.legalName, 'Legal entity name', 200), ein(p.ein), c.actor.id, c.now),
  ], command, key)
  return { id: key, notice: 'Legal entity recorded. The EIN is format-checked only; Terrace has not verified it with the IRS.' }
 }
 if (command === 'account.add') {
  manager(c)
  const key = id(), entity = await one(c, 'SELECT id FROM tt_entities WHERE id=?', text(p.entityId, 'Legal entity', 100))
  insist(entity, 'not_found', 'Legal entity not found.', 404)
  const last4 = text(p.last4, 'Account last four digits', 4)
  insist(/^\d{4}$/.test(last4), 'invalid_account', 'Enter the last four digits of the account number.')
  await commit(c, [sql(c, "INSERT INTO tt_operating_accounts(id,entity_id,name,bank_name,last4,currency,created_by,created_at) VALUES(?,?,?,?,?,'USD',?,?)", key, entity.id, text(p.name, 'Account name', 150), text(p.bankName, 'Bank name', 150), last4, c.actor.id, c.now)], command, key)
  return { id: key, notice: 'USD operating account recorded. Terrace has not verified it with the bank and moves no money.' }
 }
 if (command === 'tenancy.timezone') {
  manager(c)
  const t = await tenancy(c, p.tenancyId), zone = usZone(p.timeZone)
  await commit(c, [
   guard(c, 'EXISTS(SELECT 1 FROM tt_tenancies WHERE id=? AND version=?)', t.id, t.version),
   sql(c, 'UPDATE tt_tenancies SET time_zone=?,version=version+1 WHERE id=?', zone, t.id),
  ], command, t.id)
  return { tenancyId: t.id, notice: `Property time zone set to ${zone}. Recorded dates are unchanged.` }
 }
}

export async function companyData(c: Context) {
 const [company, entities, accounts, open, confirmation] = await Promise.all([
  one(c, 'SELECT name,country,currency,time_zone,office_email,office_phone,office_address,version,updated_at FROM tt_company WHERE singleton=1'),
  all(c, 'SELECT id,legal_name,ein,created_at FROM tt_entities ORDER BY legal_name'),
  all(c, 'SELECT a.id,a.entity_id,e.legal_name,a.name,a.bank_name,a.last4,a.currency,a.created_at FROM tt_operating_accounts a JOIN tt_entities e ON e.id=a.entity_id ORDER BY e.legal_name,a.name'),
  one<{ n: number }>(c, 'SELECT COUNT(*) AS n FROM tt_tenancies WHERE currency_confirmed=0'),
  one(c, 'SELECT k.currency,k.tenancies,k.confirmed_at,COALESCE(o.display_name,k.confirmed_by) AS confirmed_by FROM tt_currency_confirmation k LEFT JOIN oa_operators o ON o.id=k.confirmed_by'),
 ])
 return { company: company ?? null, entities, accounts, legacyCurrency: { unconfirmed: open?.n ?? 0, confirmation: confirmation ?? null } }
}

/** The office zone dates the home and header; America/New_York until the company sets one. */
export const officeZone = async (c: Context) => (await one<{ time_zone: string }>(c, 'SELECT time_zone FROM tt_company WHERE singleton=1'))?.time_zone ?? DEFAULT_ZONE
