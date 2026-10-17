// Page 04, the differentiator: the agent runs WO-2291 from Jordan's report to the matched invoice, through a
// vendor no-show, inside the owner's $500 limit. Wide screens draw the desk's two-sided timeline; phones a list.
import { pTrap } from './drawings'
import { avatar, disc, eyebrow, heading, pill } from './parts'

// On the desk's 1435-wide timeline (from x 50 at 1536): x and w place the card, dot its pin on the line, and
// gap the connector between the card's edge and the line, above or below it.
const steps = [
 { tone: 'orange', glyph: 'wrench', x: 14, w: 329, dot: 126, gap: 35, side: 'above', when: 'Mon 7:42 pm', what: 'Report', body: '<p>Jordan Ellis, 3A: Water under the kitchen sink.</p>' + `<div class="leak-art">${pTrap}</div>` + pill('Urgent · water active', 'red') },
 { tone: 'green', glyph: 'check', x: 214, w: 334, dot: 353, gap: 40, side: 'below', when: 'Mon 7:44 pm', what: 'Triage', body: '<p>Plumbing, urgent. Asked Jordan to close the valve.</p>' + pill('Valve closed', 'green big') },
 { tone: 'orange', glyph: 'wrench', x: 445, w: 332, dot: 596, gap: 68, side: 'above', when: 'Mon 7:51 pm', what: 'Booked', body: '<p>Rivera Plumbing · Tue 9:00 am · Quote $360</p>' },
 { tone: 'red', glyph: 'x', x: 663, w: 346, dot: 827, gap: 40, side: 'below', when: 'Tue 9:40 am', what: 'No-show', body: '<p>Rivera didn\'t arrive. Rebooked Bayline Plumbing, Tue 1:00 pm.</p><p class="note">Jordan confirmed by text</p>', className: 'failed' },
 { tone: 'green', glyph: 'check', x: 933, w: 347, dot: 1075, gap: 61, side: 'above', when: 'Tue 2:35 pm', what: 'Completion check', body: `<p>Bayline replaced the P-trap. 2 photos.</p><div class="reply">${avatar('JE', 'violet')}<q>All dry.</q></div>` },
 { tone: 'green', glyph: 'dollar', x: 1091, w: 348, dot: 1278, gap: 42, side: 'below', when: 'Tue 4:10 pm', what: 'Invoice matched', body: '<p>$385.00 = $360 labor + $25 parts<br>Under owner limit $500</p>' + pill('Posted to Alder Court ledger', 'green big') },
]

export function leak() {
 return `<section class="section leak" aria-labelledby="leak-title"><div class="wrap">
${eyebrow('Oct 5 · Leak in 3A', 'center')}${heading('h2', 'A leak, fixed by Tuesday.', 'leak-title', 'center display')}
<p class="lead center">Terrace's agent runs the repair from the report to the matched invoice, inside the owner's limit.</p>
<div class="leak-stage">
<ol class="leak-steps">${steps.map(s => `<li class="leak-step ${s.side}${s.className ? ` ${s.className}` : ''}" data-tone="${s.tone}" style="--x:${s.x};--w:${s.w};--dot:${s.dot};--gap:${s.gap}"><span class="leak-dot ${s.tone}" aria-hidden="true"></span><article class="card"><header>${disc(s.glyph, s.tone)}<h3><b>${s.when}</b> · ${s.what}</h3></header>${s.body}</article></li>`).join('')}</ol>
<p class="wo-pill">Work order WO-2291 · closed in 20 h 28 m</p></div>
</div></section>`
}
