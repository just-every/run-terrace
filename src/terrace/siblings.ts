// OPS-007: Terrace keeps long-term residential operations and its ledger; Cabin owns short-stay reservations and Chest
// general files. A property links to its record there by address only. The owner enters each sibling's origin; the
// link opens the sibling, whose own sign-in and grants decide access. Terrace never fetches or copies sibling data:
// confirming a record's existence/title needs Base's egress door first (CONTRACT OPS-007 gap).
import { all, allow, commit, id, insist, one, reachesPortfolio, sql, text, type Context, type Row } from './core'

export const SIBLING_COMMANDS = ['sibling.origin', 'sibling.link', 'sibling.unlink']
export const PRODUCTS: Record<string, string> = { cabin: 'Cabin', chest: 'Chest' }
export const UNCHECKED = 'opens in the sibling product, whose own sign-in decides access; Terrace has not checked that this record exists'

/** https, a host name (never an IP literal or localhost), no credentials, path, query or fragment. */
function origin(v: unknown) {
 let u: URL
 try { u = new URL(text(v, 'Origin', 200)) } catch { insist(false, 'invalid_origin', 'Enter the sibling’s https origin, for example https://cabin.example.com.') }
 const host = u!.hostname
 insist(u!.protocol === 'https:' && !u!.username && !u!.password && u!.pathname === '/' && !u!.search && !u!.hash && !host.startsWith('[') && !/^\d+(\.\d+){3}$/.test(host) && host.includes('.') && !/(^|\.)localhost$/.test(host), 'invalid_origin', 'Enter the sibling’s https origin by host name, without a path, address literal or credentials.')
 return u!.origin
}
async function scopedProperty(c: Context, v: unknown) {
 const p = await one(c, 'SELECT * FROM tt_properties WHERE id=?', text(v, 'Property', 100))
 insist(p && reachesPortfolio(c, p.portfolio_id), 'not_found', 'Property not found.', 404)
 return p
}

export async function siblingCommand(c: Context, command: string, p: Row): Promise<Row | undefined> {
 if (!SIBLING_COMMANDS.includes(command)) return
 allow(c, command)
 if (command === 'sibling.origin') {
  insist(c.actor.role === 'owner', 'forbidden', 'Only the installation owner sets sibling product addresses.', 403)
  const product = text(p.product, 'Product', 10), o = origin(p.origin)
  insist(PRODUCTS[product], 'invalid_input', 'Choose Cabin or Chest.')
  await commit(c, [sql(c, 'INSERT INTO tt_sibling_origins(product,origin,set_by,set_at) VALUES(?,?,?,?) ON CONFLICT(product) DO UPDATE SET origin=excluded.origin,set_by=excluded.set_by,set_at=excluded.set_at', product, o, c.actor.id, c.now)], command, product)
  return { product, origin: o, notice: `${PRODUCTS[product]} address saved.` }
 }
 if (command === 'sibling.link') {
  const property = await scopedProperty(c, p.propertyId), product = text(p.product, 'Product', 10)
  const configured = await one(c, 'SELECT origin FROM tt_sibling_origins WHERE product=?', product)
  insist(PRODUCTS[product] && configured, 'sibling_unconfigured', 'The owner has not set this sibling product’s address.', 409)
  const url = text(p.url, 'Record address', 500)
  let parsed: URL | null = null
  try { parsed = new URL(url) } catch { /* refused below */ }
  insist(parsed && parsed.origin === configured.origin && parsed.pathname.length > 1 && !parsed.username && !parsed.password, 'invalid_link', `Paste the record’s address in ${PRODUCTS[product]} (${configured.origin}/…).`)
  const key = id()
  await commit(c, [sql(c, 'INSERT INTO tt_sibling_links(id,property_id,product,url,label,created_by,created_at) VALUES(?,?,?,?,?,?,?)', key, property.id, product, parsed!.href, text(p.label, 'Label', 200), c.actor.id, c.now)], command, key)
  return { id: key, notice: `${PRODUCTS[product]} record linked.` }
 }
 const link = await one(c, 'SELECT * FROM tt_sibling_links WHERE id=?', text(p.linkId, 'Link', 100))
 insist(link, 'not_found', 'Link not found.', 404)
 await scopedProperty(c, link.property_id)
 await commit(c, [sql(c, 'DELETE FROM tt_sibling_links WHERE id=?', link.id)], command, link.id)
 return { id: link.id, notice: 'Link removed.' }
}

/** Links on the properties the person reaches; anyone who reads a property sees its links. */
export async function siblingData(c: Context) {
 const [origins, links, properties] = await Promise.all([all(c, 'SELECT product,origin FROM tt_sibling_origins ORDER BY product'), all(c, 'SELECT * FROM tt_sibling_links ORDER BY product,label,id'), all(c, 'SELECT id,portfolio_id FROM tt_properties')])
 const reach = new Set(properties.filter(p => reachesPortfolio(c, p.portfolio_id)).map(p => p.id))
 return { origins, links: links.filter(l => reach.has(l.property_id)).map(l => ({ ...l, productName: PRODUCTS[l.product], label: l.label, boundary: UNCHECKED })) }
}
