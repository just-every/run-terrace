// Page 06: 5A's late rent weighed in cash and vacant days — a payment plan against a pay-or-quit notice —
// and 1C renewed at +4.9% on Oct 14. A person presses Send.
import { icon } from '../icons'
import { avatar, disc, eyebrow, heading, pill } from './parts'

const check = (what: string, when: string) => `<li>${disc('check', 'green')}<span><b>${what}</b>${when}</span></li>`

export function lateRent() {
 return `<section class="section late-rent" aria-labelledby="late-title"><div class="wrap split">
<div class="copy">${eyebrow('Oct 6–14 · 5A on a plan<br>1C renewed')}${heading('h2', 'Late rent,\nworked out.', 'late-title')}
<p class="lead">The agent weighs each case in cash and vacant days, drafts the plan or the notice, and you press Send.</p></div>
<div class="late-cards"><article class="card plan-card"><header>${avatar('DB', 'violet')}<h3>5A · Dana Brooks</h3>${pill('$1,850.00 overdue · 5 days', 'red big')}</header>
<div class="options"><div class="option recommended"><span class="chip">Recommended</span><h4>Payment plan</h4><p>$925 on Oct 9<br>$925 on Oct 23<br>+ $75 late fee</p><p class="outcome"><b>Expected cash $1,925</b><span class="good">0 vacant days</span></p></div>
<div class="option"><h4>Pay-or-quit notice</h4><p>Likely turnover<br>~38 vacant days × $61</p><p class="outcome"><b class="lost">$2,318 lost</b></p></div></div>
<ol class="progress-steps">${check('Plan sent', 'Oct 6')}<li class="arrow" aria-hidden="true">${icon('arrow')}</li>${check('Dana agreed', 'Oct 7')}<li class="arrow" aria-hidden="true">${icon('arrow')}</li>${check('First $925 received', 'Oct 9')}</ol></article>
<article class="card renew-card"><header>${disc('doc', 'violet-soft')}<p><b>1C · Tom Alvarez</b> · Lease ends Dec 31</p></header><h3>Renew 12 mo at $1,940 (+4.9%)</h3><p>Market rent $1,975<br>Turnover cost est. $3,100</p>${pill('Renewed Oct 14', 'green big')}</article></div>
</div></section>`
}
