// SAFE-001 on /app?tab=security: set up an authenticator, pass it for this sign-in, the owner's requirement switch
// and authenticator resets. A new key and recovery codes are shown once, in the response that created them.
import { escape as e, type Row } from './core'
import { button, form, hidden, input } from './view'

const tab = (command: string, body: string) => form(command, body, '', 'security')
export function securityView(state: Row, result: Row, owner: boolean, enrolled: Row[]) {
 const status = state.idp ? 'You signed in through your organisation’s identity provider; its MFA policy applies to this sign-in.' : state.enrolled ? (state.satisfied ? 'Your authenticator is set up and passed for this sign-in.' : 'Enter the 6-digit code from your authenticator app, or one unused recovery code, to continue.') : state.required ? 'The owner requires a second factor. Set up an authenticator app to continue.' : 'Add an authenticator app so each new sign-in also needs a code from your phone.'
 const key = result.secret ? `<p>Key: <code>${e(result.secret)}</code></p><p class="muted">Or open: <code>${e(result.uri)}</code></p>${tab('factor.confirm', input('6-digit code', 'code', 'text', '', 'inputmode="numeric" autocomplete="one-time-code"') + button('Confirm authenticator'))}` : ''
 const codes = result.codes ? `<p><strong>Recovery codes.</strong> Each works once; they are not shown again.</p><ul class="recovery-codes">${result.codes.map((x: string) => `<li><code>${e(x)}</code></li>`).join('')}</ul>` : ''
 const start = !state.enrolled && !result.secret && !state.idp ? tab('factor.start', button('Set up an authenticator')) : ''
 const verify = state.enrolled && !state.satisfied ? tab('factor.verify', input('Code or recovery code', 'code', 'text', '', 'autocomplete="one-time-code"') + button('Continue')) : ''
 const owned = owner && !state.needed || owner && state.satisfied ? `<section><h2>Require a second factor</h2><p>When on, everyone who signs in with an email link must pass an authenticator code. Identity-provider sign-ins follow that provider’s MFA.</p>${tab('factor.require', `<label>Requirement<select name="required"><option value="on"${state.required ? ' selected' : ''}>Required for everyone</option><option value="off"${state.required ? '' : ' selected'}>Optional</option></select></label>` + button('Save requirement'))}${enrolled.length ? `<h3>Authenticators</h3><ul>${enrolled.map(o => `<li>${e(o.display_name)}${tab('factor.reset', hidden('operatorId', o.id) + '<button class="secondary" type="submit">Reset authenticator</button>')}</li>`).join('')}</ul>` : ''}</section>` : ''
 return `<section><h2>Two-step sign-in</h2><p>${status}</p>${start}${key}${codes}${verify}<p class="muted">Changing bank references, legal entities or anyone’s access also asks you to confirm by email link (valid 10 minutes).</p></section>${owned}`
}
