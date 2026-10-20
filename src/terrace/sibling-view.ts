// OPS-007 screen pieces: a property's Cabin and Chest links, and the owner's sibling addresses.
import { escape as e, type Row } from './core'
import { PRODUCTS, UNCHECKED } from './siblings'

const hidden = (name: string, value: unknown) => `<input type="hidden" name="${e(name)}" value="${e(value)}">`
const form = (command: string, body: string, fields: Row = {}) => `<form method="post" action="/app/command">${hidden('command', command)}${hidden('tab', 'properties')}${Object.entries(fields).map(([k, v]) => hidden(k, v)).join('')}${body}</form>`
const products = (origins: Row[]) => origins.map(o => `<option value="${e(o.product)}">${e(PRODUCTS[o.product])}</option>`).join('')

export function siblingLinks(p: Row, d: Row, may: (a: string) => boolean) {
 const mine = d.links.filter((l: Row) => l.property_id === p.id)
 const list = mine.map((l: Row) => `<li><a href="${e(l.url)}" target="_blank" rel="noopener noreferrer">${e(l.productName)}: ${e(l.label)}</a>${may('sibling.unlink') ? form('sibling.unlink', '<button type="submit">Remove link</button>', { linkId: l.id }) : ''}</li>`).join('')
 const add = may('sibling.link') && d.origins.length ? `<details><summary>Link a Cabin or Chest record</summary>${form('sibling.link', `<label>Product<select name="product" required>${products(d.origins)}</select></label><label>Record address<input name="url" type="url" maxlength="500" required></label><label>Label<input name="label" maxlength="200" required></label><button type="submit">Link record</button>`, { propertyId: p.id })}</details>` : ''
 return list || add ? `<section><h4>Linked records</h4>${list ? `<ul>${list}</ul><p class="muted">Each link ${e(UNCHECKED)}. Reservations and files stay in those products.</p>` : ''}${add}</section>` : ''
}

export function siblingOrigins(d: Row, owner: boolean) {
 if (!owner) return ''
 const rows = Object.entries(PRODUCTS).map(([k, name]) => `<li>${e(name)}: ${e(d.origins.find((o: Row) => o.product === k)?.origin ?? 'not set')}</li>`).join('')
 return `<section><h2>Sibling products</h2><p>Short-stay reservations belong in Cabin and general files in Chest. Set their addresses so properties can link to records there.</p><ul>${rows}</ul>${form('sibling.origin', `<label>Product<select name="product" required>${Object.entries(PRODUCTS).map(([k, n]) => `<option value="${k}">${n}</option>`).join('')}</select></label><label>Address<input name="origin" type="url" placeholder="https://cabin.example.com" required></label><button type="submit">Save address</button>`)}</section>`
}
