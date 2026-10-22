// ROLE-002: the staff side on Data & access: invite a resident, delegated contact, owner or vendor, and revoke access.
import { escape as e, type Row } from './core'
import { usDate } from './format'

const hidden = (name: string, value: unknown) => `<input type="hidden" name="${e(name)}" value="${e(value)}">`
const form = (command: string, body: string) => `<form method="post" action="/app/command">${hidden('command', command)}${hidden('tab', 'settings')}${body}</form>`
const field = (label: string, name: string, type = 'text') => `<label>${e(label)}<input type="${type}" name="${e(name)}" required></label>`
const select = (label: string, name: string, rows: Row[], text: (r: Row) => string) => `<label>${e(label)}<select name="${e(name)}" required>${rows.map(r => `<option value="${e(r.id)}">${e(text(r))}</option>`).join('')}</select></label>`

export function portalSection(d: Row, tenancies: Row[], may: (action: string) => boolean) {
 if (!may('portal.invite')) return ''
 const common = field('Name', 'displayName') + field('Email', 'email', 'email') + field('Authorization reference (who asked, and where it is recorded)', 'source')
 const invites = [
  tenancies.length ? `<details><summary>Invite a resident or delegated contact</summary>${form('portal.invite', hidden('kind', 'resident') + select('Lease', 'tenancyId', tenancies, t => `${t.address} · ${t.tenant_name}`) + `<label>Access<select name="access"><option value="resident">Resident: lease account</option><option value="delegate">Delegated contact: balance and charges only</option></select></label>` + common + '<button type="submit">Send portal invitation</button>')}</details>` : '',
  d.owners.length ? `<details><summary>Invite an owner</summary>${form('portal.invite', hidden('kind', 'owner') + select('Owner', 'ownerId', d.owners, o => o.name) + common + '<button type="submit">Send portal invitation</button>')}</details>` : '',
  d.vendors.length ? `<details><summary>Invite a vendor</summary>${form('portal.invite', hidden('kind', 'vendor') + select('Vendor', 'vendorId', d.vendors, v => v.name) + common + '<button type="submit">Send portal invitation</button>')}</details>` : '',
 ].join('')
 const people = d.people.map((p: Row) => `<article><h3>${e(p.display_name)} · ${e(p.kind)} · ${e(p.status)}</h3><p>${e(p.email)}${p.activated_at ? ' · first signed in ' + usDate(p.activated_at.slice(0, 10)) : ' · has not opened the invitation'}</p><ul>${p.grants.map((g: Row) => `<li>${e(g.access === 'delegate' ? 'Delegated contact' : g.access)}: ${e(g.record)} · ref ${e(g.source)}${g.revokedAt ? ' · revoked' : may('portal.revoke') ? form('portal.revoke', hidden('grantId', g.id) + '<label>Reason<input name="reason" required></label><button type="submit" class="secondary">Revoke this access</button>') : ''}</li>`).join('')}</ul>${p.status !== 'revoked' && may('portal.revoke') ? form('portal.revoke', hidden('identityId', p.id) + '<label>Reason<input name="reason" required></label><button type="submit" class="secondary">Revoke this person everywhere</button>') : ''}</article>`).join('')
 return `<section><h2>Portal access</h2><p>Residents, owners and vendors each see only the one record you invite them to, through a one-time email link. Revoking applies on their next request. Changes need your fresh email-link proof.</p>${invites}${people || '<p class="empty">Nobody has portal access yet.</p>'}</section>`
}
