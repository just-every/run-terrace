// Page 09: Nov 3, Okafor's October statement nets $14,220.40 with the 3A repair on it and its invoice and photos
// attached; ACH goes to 14 owners and the 1099 data is kept year to date.
import { icon } from '../icons'
import { disc, eyebrow, heading, pill } from './parts'

const lines: [string, string, boolean?][] = [
 ['Rent collected', '$22,140.00'], ['Late fees', '$75.00'], ['Management fee (8%)', '−$1,771.20'], ['Plumbing, 3A · WO-2291', '−$385.00'],
 ['Landscaping', '−$420.00', true], ['Water and sewer', '−$1,138.40', true], ['Property tax escrow', '−$2,780.00', true], ['Reserve top-up', '−$1,500.00', true],
]

export function owners() {
 return `<section class="section owners" aria-labelledby="owners-title"><div class="wrap split">
<div class="statement-stack"><article class="card statement"><h3>Owner statement · October 2026</h3><p class="sub">Okafor Family Trust · Alder Court · 12 of 20 units</p>
<dl>${lines.map(([label, value, other]) => `<div${other ? ' class="other"' : ''}><dt>${label}</dt><dd>${value}</dd></div>`).join('')}<div class="folded"><dt>Other expenses</dt><dd>−$5,838.40</dd></div></dl>
<p class="net"><b>Net to owner</b><b>$14,220.40</b></p><p class="attached"><span>${icon('file')}Bayline invoice</span><span>${icon('image')}3A photos (2)</span></p></article>
<div class="card ach">${disc('dollar', 'green-solid', 'big')}<p><span>ACH sent Nov 3 · 14 owners</span><b>$203,476.85</b></p>${pill('Sent', 'green big')}</div>
<div class="card ten99">${disc('doc', 'violet-solid', 'big')}<p>1099 data · 14 owners · year to date</p></div></div>
<div class="copy">${eyebrow('Nov 3 · Owners paid')}${heading('h2', 'Every owner,\npaid on the 3rd.', 'owners-title')}
<p class="lead">Statements go out with receipts attached, money goes out by ACH, and the 1099 data is ready in January.</p></div>
</div></section>`
}
