// OPS-001 screen: the owner's API credentials. A token is shown once, in the result of minting or rotating.
import { escape as e, type Row } from './core'
import { ROLES, roleLabel } from './roles'
import { button, hidden } from './view'

const form = (command: string, body: string) => `<form method="post" action="/app/command">${hidden('command', command)}${hidden('tab', 'settings')}${body}</form>`

export function credentialSection(d: Row, owner: boolean, result: Row = {}) {
 if (!owner) return ''
 const shown = result.token ? `<p role="status"><strong>Copy this token now; it is shown once.</strong></p><p><code>${e(result.token)}</code></p>` : ''
 const rows = d.credentials.map((k: Row) => `<li><strong>${e(k.label)}</strong> · ${e(roleLabel(k.role))} · ${k.scope === 'read' ? 'read-only' : 'prepare-only'} · ${e(k.portfolios.join(', ') || 'no portfolios')} · ${k.revoked_at ? `revoked ${e(k.revoked_at.slice(0, 10))}` : k.last_used_at ? `last used ${e(k.last_used_at.slice(0, 10))}` : 'never used'}${k.revoked_at ? '' : form('credential.rotate', hidden('credentialId', k.id) + button('Rotate token')) + form('credential.revoke', hidden('credentialId', k.id) + button('Revoke'))}</li>`).join('')
 const mint = form('credential.mint', `<label>Name<input name="label" maxlength="80" required></label><label>Acts as<select name="role">${ROLES.map(([v, l]) => `<option value="${v}">${e(l)}</option>`).join('')}</select></label><label>Scope<select name="scope"><option value="read">Read only</option><option value="prepare">Read and prepare proposals</option></select></label><fieldset><legend>Portfolios</legend><label><input type="checkbox" name="allPortfolios" value="1"> All portfolios</label>${d.portfolios.map((f: Row) => `<label><input type="checkbox" name="portfolio:${e(f.id)}" value="1"> ${e(f.name)}</label>`).join('')}</fieldset>${button('Create credential')}`)
 return `<section class="settings-credentials"><h2>API credentials</h2><p>A credential acts as one staff role over the portfolios you choose, never more than that role holds, and can prepare proposals but never approve, post money or change access. Creating, rotating or revoking one needs a fresh email-link sign-in. It is documented in API.md under /api/v1.</p>${shown}${rows ? `<ul>${rows}</ul>` : ''}<details><summary>Create a credential</summary>${mint}</details></section>`
}
