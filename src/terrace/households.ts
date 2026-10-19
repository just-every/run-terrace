// PORT-004: households. The tenancy's tenant is its primary resident. Co-tenants and guarantors are liable for
// that lease's balance; occupants and emergency or authorized contacts are not. Lease notices and statements go
// to the primary resident and current co-tenants, guarantors and authorized contacts whose preference is not
// "none"; lease and ledger documents are open to those people whatever their preference; emergency contacts
// and occupants get neither.
// A member is current from the day they join to the day they leave, in the property's time zone. Moving a
// member to another lease ends their membership the day before and adds them there; balances stay with each lease.
import { all, commit, date, email, guard, id, insist, manager, one, sql, tenancy, text, type Context, type Row } from './core'
import { localDate } from './zones'

export const ROLES = ['co_tenant','guarantor','occupant','emergency_contact','authorized_contact'] as const
const LIABLE = ['resident','co_tenant','guarantor'], INFORMED = ['resident','co_tenant','guarantor','authorized_contact']
const dayBefore = (d: string) => new Date(Date.parse(d + 'T00:00:00Z') - 86400000).toISOString().slice(0, 10)
export const rights = (role: string, contactBy: string, current: boolean) => ({ liable: LIABLE.includes(role), recipient: current && INFORMED.includes(role) && contactBy !== 'none', documents: current && INFORMED.includes(role) })

async function member(c: Context, v: unknown) { const row = await one(c, 'SELECT * FROM tt_household_members WHERE id=?', text(v, 'Household member', 100)); insist(row, 'not_found', 'Household member not found.', 404); return row }
function contact(p: Row) {
 const mail = p.email ? email(p.email) : null, phone = p.phone ? text(p.phone, 'Phone', 40) : null, by = p.contactBy ?? (mail ? 'email' : phone ? 'phone' : 'none')
 insist(['email','phone','mail','none'].includes(by), 'invalid_input', 'Contact by email, phone, mail or none.')
 insist(by !== 'email' || mail, 'invalid_input', 'Enter an email to contact this person by email.')
 insist(by !== 'phone' || phone, 'invalid_input', 'Enter a phone number to contact this person by phone.')
 return { mail, phone, by }
}

export async function householdCommand(c: Context, command: string, p: Row): Promise<Row | undefined> {
 if (command === 'household.add') {
  manager(c)
  const t = await tenancy(c, p.tenancyId), key = id(), k = contact(p), joined = date(p.joined ?? t.start_date, 'Joined')
  insist(ROLES.includes(p.role), 'invalid_role', `Role is one of ${ROLES.join(', ')}.`)
  insist(joined >= t.start_date && joined <= (t.ended_on ?? t.end_date), 'invalid_date', 'A member joins during the lease.')
  await commit(c, [sql(c, 'INSERT INTO tt_household_members(id,tenancy_id,role,name,email,phone,contact_by,joined,created_by,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)', key, t.id, p.role, text(p.name, 'Name', 150), k.mail, k.phone, k.by, joined, c.actor.id, c.now)], command, key)
  return { id: key, tenancyId: t.id, notice: 'Household member added.' }
 }
 if (command === 'household.leave' || command === 'household.move') {
  manager(c)
  const m = await member(c, p.memberId), on = date(command === 'household.move' ? p.date : p.left, command === 'household.move' ? 'Move date' : 'Leaving date')
  insist(!m.left_on, 'member_left', 'This person has already left the household.', 409)
  const left = command === 'household.move' ? dayBefore(on) : on
  insist(left >= m.joined, 'invalid_date', 'A member leaves on or after joining.')
  const writes = [guard(c, 'EXISTS(SELECT 1 FROM tt_household_members WHERE id=? AND version=? AND left_on IS NULL)', m.id, m.version)]
  let moved: string | null = null
  if (command === 'household.move') {
   const to = await tenancy(c, p.toTenancyId)
   insist(to.id !== m.tenancy_id, 'same_lease', 'Choose another lease.')
   insist(on >= to.start_date && on <= (to.ended_on ?? to.end_date), 'invalid_date', 'The move falls during the other lease.')
   moved = id()
   writes.push(sql(c, 'INSERT INTO tt_household_members(id,tenancy_id,role,name,email,phone,contact_by,joined,created_by,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)', moved, to.id, m.role, m.name, m.email, m.phone, m.contact_by, on, c.actor.id, c.now))
  }
  writes.push(sql(c, 'UPDATE tt_household_members SET left_on=?,moved_to=?,version=version+1 WHERE id=?', left, moved, m.id))
  await commit(c, writes, command, m.id)
  return { id: moved ?? m.id, tenancyId: m.tenancy_id, notice: moved ? 'Moved to the other lease. Each lease keeps its own balance.' : 'Member has left the household.' }
 }
}

/** A lease's household with each person's role, dates and rights today, and the lease balance they share. */
export async function householdData(c: Context, t: Row, balanceCents: number) {
 const today = localDate(c.now, t.time_zone), rows = await all(c, 'SELECT * FROM tt_household_members WHERE tenancy_id=? ORDER BY joined,name', t.id)
 const current = (m: Row) => m.joined <= today && (!m.left_on || m.left_on >= today)
 const primary = { id: null, role: 'resident', name: t.tenant_name, email: t.tenant_email, contact_by: 'email', joined: t.start_date, left_on: t.ended_on ?? null, current: !t.ended_on || t.ended_on >= today }
 const members: Row[] = ([primary, ...rows.map(m => ({ ...m, current: current(m) }))] as Row[]).map(m => ({ ...m, ...rights(m.role, m.contact_by, m.current) }))
 return { tenancyId: t.id, balanceCents, currency: t.currency, members, recipients: members.filter(m => m.recipient).map(m => m.name), liable: members.filter(m => m.liable && m.current).map(m => m.name) }
}
