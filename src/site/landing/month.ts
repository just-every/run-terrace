// Page 02: the month ribbon (one stop per dated section, worded as its eyebrow) and the Oct 1 rent roll.
import { avatar, eyebrow, heading, pill } from './parts'

const stops = [['Oct 1', 'Rent day', 'green'], ['Oct 2–12', '4B leased', 'blue'], ['Oct 5', 'Leak in 3A', 'orange'], ['Oct 6', '3A repaired', 'green'], ['Oct 6–14', '5A on a plan, 1C\u00a0renewed', 'amber'], ['Oct 15', 'Mid-month', 'violet'], ['Oct 31', 'Books closed', 'violet'], ['Nov 3', 'Owners paid', 'green']]

const rows = [
 ['MC', 'violet', '2B · Maya Chen', '$1,850.00', '', 'ACH autopay', 'Paid', 'green'],
 ['JE', 'blue', '3A · Jordan Ellis', '$1,925.00', '', 'Card', 'Paid', 'green'],
 ['LO', 'amber', '4C · Luis Ortega', '$900.00 of $1,850.00', 'Balance due Oct 15', '', 'Partial', 'amber'],
 ['SP', 'green', '1D · Sam Patel', '$1,425.00', '', 'Cash at store', 'Posted', 'green'],
 ['DB', 'red', '5A · Dana Brooks', '$1,850.00', 'Late fee $75 on Oct 6', '', 'Unpaid', 'red'],
]

export function month() {
 return `<section class="section month" aria-labelledby="month-title"><div class="wrap">
${eyebrow('October at a glance', 'center')}${heading('h2', 'The whole month, handled.', 'month-title', 'center')}
<ol class="card ribbon" aria-label="October, section by section">${stops.map(([date, label, tone]) => `<li><b>${date}</b><span class="stop ${tone}" aria-hidden="true"></span><span>${label}</span></li>`).join('')}</ol>
<div class="split rent-day"><div class="copy">${eyebrow('Oct 1 · Rent day')}${heading('h2', 'Rent comes\nin on its own.', 'rent-title')}
<p class="lead">Residents pay by bank transfer, card or cash at a store. Autopay, partial payments and late fees follow your rules.</p></div>
<div class="card rent-roll" aria-label="Rent roll at 5:00 pm on October 1"><h3><b>Rent roll</b> · Oct 1, 5:00 pm</h3><p class="big-figure">$296,310.00</p><p class="of">collected of $318,615.00</p>
<div class="progress"><span class="bar"><i style="width:93%"></i></span><b>93%</b></div><p class="count">158 of 172 leases paid</p>
<ul class="roll">${rows.map(([initials, tone, who, amount, note, method, status, statusTone]) => `<li>${avatar(initials, tone)}<span class="who">${who}</span><span class="amount">${amount}${note ? `<small>${note}</small>` : ''}</span><span class="method">${method}</span>${pill(status, statusTone)}</li>`).join('')}</ul></div></div>
</div></section>`
}
