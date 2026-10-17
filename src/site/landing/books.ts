// Page 08: Oct 31, trust account ···4821 reconciled to the cent. The duplicate $1,425.00 cash receipt for 1D is
// traced through the resident, property and owner ledgers to its reversal; deposits sit in ···5530.
import { icon } from '../icons'
import { disc, eyebrow, heading, pill } from './parts'

const ledgers = [['Resident ledger', '1D Sam Patel', 'SP'], ['Property ledger', 'Alder Court', 'AC'], ['Owner ledger', 'Okafor Family Trust', 'OF']]
const ledger = ([kind, whose]: string[]) => `<article class="card ledger"><h3>${kind} · ${whose}</h3><ul>
<li><span>Oct 1 · Cash at store</span><b>$1,425.00</b></li>
<li class="dup"><span>Oct 1 · Cash at store ${pill('Duplicate', 'red')}</span><b>$1,425.00</b></li>
<li class="rev"><span>Oct 31 · Reversal ${disc('check', 'green', 'tiny')}</span><b>−$1,425.00</b></li></ul></article>`

export function books() {
 return `<section class="section books" aria-labelledby="books-title"><div class="wrap">
<div class="split"><div class="copy">${eyebrow('Oct 31 · Books closed')}${heading('h2', 'Balanced to the cent.', 'books-title')}
<p class="lead">Every dollar sits in a trust ledger by owner, property and resident. Terrace matches the bank line by line and flags what doesn't fit.</p></div>
<article class="card trust"><h3>Trust account <span class="dots">···</span>4821 · October</h3><dl><div><dt>Bank statement</dt><dd>$412,906.18</dd></div><div><dt>Terrace ledger</dt><dd>$414,331.18</dd></div></dl>
<p class="flag bad">${disc('alert', 'red-solid')}<span>Difference $1,425.00 · cash payment for 1D posted twice</span></p><p class="down" aria-hidden="true">${icon('down')}</p>
<p class="flag good">${disc('check', 'green-solid')}<span>Duplicate reversed Oct 31 · Difference $0.00</span>${pill('Reconciled', 'green-solid')}</p></article></div>
<div class="trace">${ledgers.map(ledger).join(`<span class="trace-arrow" aria-hidden="true">${icon('arrow')}</span>`)}</div>
<p class="deposits">${icon('lock')}Security deposits · separate account ···5530 · $312,450.00 held</p>
</div></section>`
}
