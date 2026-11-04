// Page 09: Nov 3, Okafor's October statement nets $14,220.40 with the 3A repair on it and its invoice attached;
// the 14 owners' statements are ready and their W-9s are tracked.
import { icon } from '../icons'
import { disc, eyebrow, heading, pill } from './parts'

const lines: [string, string, boolean?][] = [
 ['Rent received', '$22,140.00'], ['Late fees', '$75.00'], ['Management fee (8%)', '−$1,771.20'], ['Plumbing, 3A · WO-2291', '−$385.00'],
 ['Landscaping', '−$420.00', true], ['Water and sewer', '−$1,138.40', true], ['Property tax escrow', '−$2,780.00', true], ['Reserve top-up', '−$1,500.00', true],
]

export function owners() {
 return `<section class="section owners" aria-labelledby="owners-title"><div class="wrap split">
<div class="statement-stack"><article class="card statement"><h3>Owner statement · October 2026</h3><p class="sub">Okafor Family Trust · Alder Court · 12 of 20 units</p>
<dl>${lines.map(([label, value, other]) => `<div${other ? ' class="other"' : ''}><dt>${label}</dt><dd>${value}</dd></div>`).join('')}<div class="folded"><dt>Other expenses</dt><dd>−$5,838.40</dd></div></dl>
<p class="net"><b>Net to owner</b><b>$14,220.40</b></p><p class="attached"><span>${icon('file')}Bayline invoice</span><span>${icon('image')}Work order WO-2291</span></p></article>
<div class="card ach">${disc('dollar', 'green-solid', 'big')}<p><span>Net to 14 owners · Nov 3</span><b>$203,476.85</b></p>${pill('Ready', 'green big')}</div>
<div class="card ten99">${disc('doc', 'violet-solid', 'big')}<p>W-9 status · 14 owners · tracked</p></div></div>
<div class="copy">${eyebrow('Nov 3 · Owners informed')}${heading('h2', 'Every owner,\ninformed.', 'owners-title')}
<p class="lead">Each statement carries the invoice behind every repair, and each owner reads theirs in the owner portal.</p></div>
</div></section>`
}
