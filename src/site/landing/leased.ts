// Page 03: 4B empty on Oct 2, applications reviewed against the income rule on Oct 9, the signed lease recorded on Oct 12.
import { icon } from '../icons'
import { listingRoom } from './drawings'
import { avatar, disc, eyebrow, heading, pill } from './parts'

const applicants = [
 ['AR', 'green', 'Ana Ruiz', ['Income 3.4× rent', 'Income documents verified'], pill('Meets your 2.5× rule', 'green')],
 ['KM', 'blue', 'Kevin Moore', ['Income 2.1× rent', 'Below your 2.5× rule'], pill('Does not meet rule', 'grey')],
 ['PN', 'violet', 'Priya Nair', [], pill('Withdrew', 'grey')],
] as const

export function leased() {
 return `<section class="section leased" aria-labelledby="leased-title"><div class="wrap">
${eyebrow('Oct 2–12 · 4B leased')}${heading('h2', 'Empty on the 2nd.\nLeased by the 12th.', 'leased-title')}
<p class="lead">Enquiries, applications and the signed lease all live in Terrace.<br>Every applicant is checked against your income rule.</p>
<ol class="rail-cards">
<li class="rail-step listing"><span class="rail-date">Oct 2</span><article class="card"><header>${disc('home', 'violet-soft')}<h3>Vacancy</h3></header>${listingRoom}
<p class="facts">4B · 2 bed<span class="wide-only"> · 1 bath · 860 sq ft</span><span class="phone-only"> · $2,150/mo</span></p><p class="price">$2,150/mo</p><p class="avail">Available Nov 1</p>
<ul class="live">${['Enquiries', 'Applications', 'Income rule'].map(step => `<li>${step}</li>`).join('')}</ul><p class="stats">9 enquiries · 3 applications</p></article></li>
<li class="rail-step applications"><span class="rail-date">Oct 9</span><article class="card"><header>${disc('list', 'violet-soft')}<h3>Applications</h3></header>
<ul class="applicants">${applicants.map(([initials, tone, name, lines, status]) => `<li>${avatar(initials, tone)}<div><b>${name}</b>${lines.map(line => `<span>${line}</span>`).join('')}</div>${status}</li>`).join('')}</ul></article></li>
<li class="rail-step lease"><span class="rail-date">Oct 12</span><article class="card"><header>${disc('doc', 'violet-soft')}<h3>Lease · 4B</h3></header>
<p class="term">Nov 1, 2026 – Oct 31, 2027</p><p class="price">$2,150/mo</p><p class="deposit">Deposit $2,150 ${icon('arrow', 'inline')} deposit account ···5530</p>
<ul class="signers"><li>${avatar('AR', 'green')}<span><b>Ana Ruiz</b> · signed Oct 12</span></li><li>${avatar('KL', 'blue')}<span><b>Kim Lee, manager</b> · signed Oct 12</span></li></ul>
${pill('Signed lease on file', 'green big')}</article></li>
</ol></div></section>`
}
