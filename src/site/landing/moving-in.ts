// Page 10: moving in. The Sep 30 opening trial balance tied out by account, AppFolio against Terrace, one line
// off by $150.00 until the 2C prepayment is imported; the one-line start; the honest residential-only limit.
import { icon } from '../icons'
import { eyebrow, heading } from './parts'
import { builtForHomes } from './drawings'

const accounts: [string, string, string, string?][] = [
 ['Cash in trust', '$398,214.66', '$398,214.66'], ['Security deposits held', '$310,300.00', '$310,300.00'], ['Owner balances', '$371,902.41', '$371,902.41'], ['Prepaid rent', '$26,312.25', '$26,162.25', 'fixed'],
]
export const startLine = 'npx -y @runeditrun/rer dev just-every/run-terrace'

export function movingIn() {
 return `<section class="section moving-in" aria-labelledby="moving-title"><div class="wrap">
<div class="split"><div class="copy">${eyebrow('Moving in')}${heading('h2', 'Bring your whole\nportfolio.', 'moving-title')}
<p class="lead">Import properties, leases, deposits and opening balances from AppFolio or Buildium.</p></div>
<article class="card tie-out"><h3>Opening balances · Sep 30</h3><p class="sub">9 properties · 186 units · 172 leases · 14 owners</p>
<table><thead><tr><th scope="col">Account</th><th scope="col">AppFolio</th><th scope="col">Terrace</th><th scope="col"><span class="visually-hidden">Result</span></th></tr></thead><tbody>
${accounts.map(([name, theirs, ours, fixed]) => `<tr${fixed ? ' class="fixed"' : ''}><th scope="row">${name}</th><td data-label="AppFolio">${theirs}</td><td data-label="Terrace">${ours}${fixed ? '<span class="off">Off by $150.00 · 2C prepayment missing</span><span class="on">2C prepayment imported · Matched</span>' : ''}</td><td>${fixed ? '' : `<span class="matched">${icon('check')}Matched</span>`}</td></tr>`).join('')}
</tbody></table></article></div>
<div class="own-row"><div class="terminal" role="group" aria-label="Run it yourself"><p class="terminal-bar"><span class="lights" aria-hidden="true"><i></i><i></i><i></i></span>Run it yourself</p>
<pre><code><span class="prompt" aria-hidden="true">$ </span>${startLine}
<span class="comment"># clones, installs and starts Terrace on your computer</span></code></pre></div>
<article class="card homes">${builtForHomes}<h3>Built for homes<span class="dot">.</span></h3><p>Residential rentals only: no commercial leases, CAM reconciliation or HOA dues.</p></article></div>
</div></section>`
}
