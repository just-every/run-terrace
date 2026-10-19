// PORT-001: the company, legal entities and USD operating accounts in Data & access.
import { escape as e, type Row } from './core'
import { usDate } from './format'
import { icon } from './icons'
import { zoneSelect } from './tenancy-view'
import { button, form, input } from './view'
import { DEFAULT_ZONE } from './zones'

// PORT-001 legacy currency: tenancies recorded before Terrace stored a currency, and the owner's one confirmation.
function legacyCurrency(l: Row, isOwner: boolean) {
 if (l.confirmation) return `<h3>Currency of earlier records</h3><p>${e(l.confirmation.tenancies)} earlier ${l.confirmation.tenancies === 1 ? 'tenancy was' : 'tenancies were'} confirmed as ${e(l.confirmation.currency)} by ${e(l.confirmation.confirmed_by)} on ${usDate(l.confirmation.confirmed_at)}. No amount was converted.</p>`
 if (!l.unconfirmed) return ''
 const ask = isOwner ? form('currency.confirm', `<label>These records were entered in<select name="currency"><option value="USD">USD</option><option value="AUD">AUD</option></select></label>` + button('Confirm currency'), '', 'settings') : '<p class="muted">The installation owner confirms this once.</p>'
 return `<h3>Currency of earlier records</h3><p>${e(l.unconfirmed)} ${l.unconfirmed === 1 ? 'tenancy was' : 'tenancies were'} recorded before Terrace stored a currency, while money showed as A$ and later $. Their money is shown as “currency unconfirmed” and totalled apart from USD until the owner confirms AUD or USD. Confirming changes the label only; no amount is converted.</p>${ask}`
}

export function companyView(data: Row, manage: boolean, isOwner = false) {
 const k: Row = data.company ?? {}, entities: Row[] = data.entities, accounts: Row[] = data.accounts
 const facts = data.company ? `<p><strong>${e(k.name)}</strong> · United States · money in USD · office time zone ${e(k.time_zone)}</p><p class="muted">${e(k.office_address)} · ${e(k.office_email)} · ${e(k.office_phone)}</p>` : `<p class="muted">No company set up yet. New tenancies are USD and the office time zone is ${DEFAULT_ZONE} until you save one.</p>`
 const entityList = entities.length ? `<ul>${entities.map(x => `<li>${e(x.legal_name)} · EIN ${e(x.ein)} <span class="muted">(format checked, not verified with the IRS)</span></li>`).join('')}</ul>` : '<p class="muted">No legal entities recorded.</p>'
 const accountList = accounts.length ? `<ul>${accounts.map(x => `<li>${e(x.legal_name)} · ${e(x.name)} · ${e(x.bank_name)} ···${e(x.last4)} · ${e(x.currency)}</li>`).join('')}</ul>` : '<p class="muted">No operating accounts recorded.</p>'
 const forms = manage ? `<details><summary>${data.company ? 'Edit company' : 'Set up the company'}</summary>${form('company.save', input('Company name', 'name', 'text', k.name ?? '') + input('Office address', 'officeAddress', 'text', k.office_address ?? '') + input('Office email', 'officeEmail', 'email', k.office_email ?? '') + input('Office phone', 'officePhone', 'tel', k.office_phone ?? '') + zoneSelect('Office time zone', k.time_zone ?? DEFAULT_ZONE) + button('Save company'), '', 'settings')}</details>${data.company ? `<details><summary>Add a legal entity</summary>${form('entity.add', input('Legal entity name', 'legalName') + input('EIN', 'ein', 'text', '', 'placeholder="12-3456789" pattern="\\d{2}-?\\d{7}"') + button('Add legal entity'), '', 'settings')}</details>` : ''}${entities.length ? `<details><summary>Add a USD operating account</summary><p class="muted">A record of the account: Terrace stores no full account or routing number and moves no money.</p>${form('account.add', `<label>Legal entity<select name="entityId">${entities.map(x => `<option value="${e(x.id)}">${e(x.legal_name)}</option>`).join('')}</select></label>` + input('Account name', 'name') + input('Bank', 'bankName') + input('Last four digits', 'last4', 'text', '', 'inputmode="numeric" pattern="\\d{4}" maxlength="4"') + button('Add operating account'), '', 'settings')}</details>` : ''}` : ''
 return `<section class="settings-company"><h2><span class="icon-disc">${icon('building')}</span>Company</h2>${facts}<h3>Legal entities</h3>${entityList}<h3>USD operating accounts</h3>${accountList}${forms}${legacyCurrency(data.legacyCurrency, isOwner)}</section>`
}
