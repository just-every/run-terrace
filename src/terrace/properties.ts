// PORT-002: portfolios, properties and units with occupancy and lease history kept per unit. A unit holds at most
// one lease on any day; a lease's occupancy runs from its start to its move-out day (ended_on) or, if not ended
// early, its end date. Ending a lease early keeps the record; a transfer ends the lease on one unit and starts a
// linked lease on another, so neither unit's history is merged or lost.
import { all, cents, commit, date, guard, id, insist, allow, one, sql, tenancy, text, reaches, reachesPortfolio, everywhere, type Context, type Row } from './core'
import { usZone, localDate } from './zones'

export const PROPERTY_KINDS = ['single_family','duplex','multifamily','townhouse','condo'] as const
export const occupiedTo = (t: Row) => t.ended_on ?? t.end_date
const dayBefore = (d: string) => new Date(Date.parse(d + 'T00:00:00Z') - 86400000).toISOString().slice(0, 10)
/** A guard that no other lease on the unit overlaps [from, to]. */
export const freeUnit = (c: Context, unitId: string, from: string, to: string, except = '') => guard(c, 'NOT EXISTS(SELECT 1 FROM tt_tenancies WHERE unit_id=? AND id<>? AND start_date<=? AND COALESCE(ended_on,end_date)>=?)', unitId, except, to, from)

export async function unitFor(c: Context, v: unknown) {
 const u = await one(c, 'SELECT u.*,p.address AS property_address,p.time_zone,p.name AS property_name FROM tt_units u JOIN tt_properties p ON p.id=u.property_id WHERE u.id=?', text(v, 'Unit', 100))
 insist(u && reaches(c, u.id), 'not_found', 'Unit not found.', 404)
 insist(u.rentable === 1, 'unit_offline', 'This unit is not rentable.', 409)
 return u
}
export const unitAddress = (u: Row) => `Unit ${u.identifier}, ${u.property_address}`

export async function propertyCommand(c: Context, command: string, p: Row): Promise<Row | undefined> {
 if (command === 'portfolio.add') {
  allow(c, command); everywhere(c); const key = id()
  await commit(c, [sql(c, 'INSERT INTO tt_portfolios(id,name,created_by,created_at) VALUES(?,?,?,?)', key, text(p.name, 'Portfolio name', 150), c.actor.id, c.now)], command, key)
  return { id: key, notice: 'Portfolio added.' }
 }
 if (command === 'property.add') {
  allow(c, command); const key = id()
  insist(PROPERTY_KINDS.includes(p.kind), 'invalid_kind', `Property kind is one of ${PROPERTY_KINDS.join(', ')}.`)
  insist(await one(c, 'SELECT 1 FROM tt_portfolios WHERE id=?', text(p.portfolioId, 'Portfolio', 100)) && reachesPortfolio(c, p.portfolioId), 'not_found', 'Portfolio not found.', 404)
  await commit(c, [sql(c, 'INSERT INTO tt_properties(id,portfolio_id,name,address,kind,time_zone,created_by,created_at) VALUES(?,?,?,?,?,?,?,?)', key, p.portfolioId, text(p.name, 'Property name', 150), text(p.address, 'Property address', 300), p.kind, usZone(p.timeZone), c.actor.id, c.now)], command, key)
  return { id: key, notice: 'Property added.' }
 }
 if (command === 'unit.add' || command === 'unit.update') {
  allow(c, command)
  const old = command === 'unit.update' ? await one(c, 'SELECT * FROM tt_units WHERE id=?', text(p.unitId, 'Unit', 100)) : null
  insist(command === 'unit.add' || (old && reaches(c, old.id)), 'not_found', 'Unit not found.', 404)
  const bedrooms = Number(p.bedrooms), bathrooms = Number(p.bathrooms), amenities = String(p.amenities ?? '').split(',').map(x => x.trim()).filter(Boolean)
  insist(Number.isInteger(bedrooms) && bedrooms >= 0 && bedrooms <= 20, 'invalid_unit', 'Bedrooms is a whole number from 0 to 20.')
  insist(Number.isFinite(bathrooms) && bathrooms >= 0 && bathrooms <= 20 && bathrooms * 2 === Math.round(bathrooms * 2), 'invalid_unit', 'Bathrooms is 0 to 20 in halves.')
  insist(amenities.length <= 30 && amenities.every(a => a.length <= 60), 'invalid_unit', 'List up to 30 amenities.')
  const market = p.marketRent ? cents(p.marketRent) : null
  const rentable = p.rentable === undefined || p.rentable === true || p.rentable === 'yes' || p.rentable === '1' ? 1 : 0
  if (old) {
   await commit(c, [guard(c, 'EXISTS(SELECT 1 FROM tt_units WHERE id=? AND version=?)', old.id, Number(p.version ?? old.version)), sql(c, 'UPDATE tt_units SET bedrooms=?,bathrooms=?,amenities=?,rentable=?,market_rent_cents=?,version=version+1 WHERE id=?', bedrooms, bathrooms, JSON.stringify(amenities), rentable, market, old.id)], command, old.id)
   return { id: old.id, notice: 'Unit updated.' }
  }
  const key = id()
  const home = await one(c, 'SELECT portfolio_id FROM tt_properties WHERE id=?', text(p.propertyId, 'Property', 100))
  insist(home && reachesPortfolio(c, home.portfolio_id), 'not_found', 'Property not found.', 404)
  await commit(c, [sql(c, 'INSERT INTO tt_units(id,property_id,identifier,bedrooms,bathrooms,amenities,rentable,market_rent_cents,created_by,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)', key, p.propertyId, text(p.identifier, 'Unit identifier', 40), bedrooms, bathrooms, JSON.stringify(amenities), rentable, market, c.actor.id, c.now)], command, key)
  return { id: key, notice: 'Unit added.' }
 }
 if (command === 'tenancy.end') {
  allow(c, command)
  const t = await tenancy(c, p.tenancyId), moveOut = date(p.moveOut, 'Move-out date')
  insist(!t.ended_on, 'lease_ended', 'This lease has already ended.', 409)
  insist(moveOut >= t.start_date && moveOut <= t.end_date, 'invalid_move_out', 'The move-out day falls within the lease.')
  await commit(c, [guard(c, 'EXISTS(SELECT 1 FROM tt_tenancies WHERE id=? AND version=?)', t.id, t.version), sql(c, 'UPDATE tt_tenancies SET ended_on=?,end_reason=?,version=version+1 WHERE id=?', moveOut, text(p.reason, 'Reason', 300), t.id)], command, t.id)
  return { tenancyId: t.id, notice: `Lease ended with move-out on ${moveOut}. The lease record is kept.` }
 }
 if (command === 'tenancy.transfer') {
  allow(c, command)
  const t = await tenancy(c, p.tenancyId), u = await unitFor(c, p.unitId), moveIn = date(p.moveIn, 'Move-in date'), key = id()
  insist(!t.ended_on, 'lease_ended', 'This lease has already ended.', 409)
  insist(u.id !== t.unit_id, 'same_unit', 'Choose a different unit.')
  insist(moveIn > t.start_date && moveIn <= t.end_date, 'invalid_move_in', 'The transfer falls after the lease starts and on or before it ends.')
  const end = p.endDate ? date(p.endDate, 'New lease end') : t.end_date, rent = p.rent ? cents(p.rent) : t.rent_cents
  insist(end >= moveIn, 'lease_dates', 'The new lease ends on or after the move-in.')
  await commit(c, [
   guard(c, 'EXISTS(SELECT 1 FROM tt_tenancies WHERE id=? AND version=?)', t.id, t.version), freeUnit(c, u.id, moveIn, end),
   sql(c, 'UPDATE tt_tenancies SET ended_on=?,end_reason=?,version=version+1 WHERE id=?', dayBefore(moveIn), `Transferred to unit ${u.identifier}`, t.id),
   sql(c, 'INSERT INTO tt_tenancies(id,address,owner_name,owner_email,tenant_name,tenant_email,start_date,end_date,rent_cents,cadence,created_at,currency,time_zone,unit_id,transferred_from,currency_confirmed) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)', key, unitAddress(u), t.owner_name, t.owner_email, t.tenant_name, t.tenant_email, moveIn, end, rent, t.cadence, c.now, t.currency, u.time_zone, u.id, t.id, t.currency_confirmed),
  ], command, key)
  return { id: key, tenancyId: key, notice: `Transferred to unit ${u.identifier} from ${moveIn}. Both leases are kept.` }
 }
}

/** Portfolios, properties and units, each unit with its occupancy as of its property-local today and its leases. */
export async function propertyData(c: Context) {
 const [portfolios, properties, units, leases] = await Promise.all([
  all(c, 'SELECT * FROM tt_portfolios ORDER BY name'), all(c, 'SELECT * FROM tt_properties ORDER BY name'), all(c, 'SELECT * FROM tt_units ORDER BY identifier'),
  all(c, 'SELECT id,unit_id,tenant_name,start_date,end_date,ended_on,end_reason,transferred_from,rent_cents,currency,currency_confirmed,cadence FROM tt_tenancies WHERE unit_id IS NOT NULL ORDER BY start_date'),
 ])
 return { portfolios: portfolios.filter(f => reachesPortfolio(c, f.id)).map(f => ({ ...f, properties: properties.filter(p => p.portfolio_id === f.id).map(p => {
  const today = localDate(c.now, p.time_zone)
  return { ...p, today, units: units.filter(u => u.property_id === p.id).map(u => {
   const history: Row[] = leases.filter(l => l.unit_id === u.id).map(l => ({ ...l, occupiedTo: occupiedTo(l), state: l.start_date > today ? 'future' : occupiedTo(l) < today ? 'past' : 'current' }))
   const current = history.find(l => l.state === 'current'), next = history.find(l => l.state === 'future')
   return { ...u, amenities: JSON.parse(u.amenities), history, occupancy: current ? 'occupied' : next ? 'vacant, leased' : 'vacant', nextMoveIn: next?.start_date ?? null }
  }) }
 }) })) }
}
export const unitChoices = (c: Context) => all(c, 'SELECT u.id,u.identifier,p.name AS property_name FROM tt_units u JOIN tt_properties p ON p.id=u.property_id WHERE u.rentable=1 ORDER BY p.name,u.identifier').then(rows => rows.filter(u => reaches(c, u.id)))
