// Page 01: the approved hero. The painting is the desk's building at dusk with its painted copy, header and
// cards removed (a clean plate); the copy, the header and the five unit cards are HTML at the desk's positions.
import { escape } from '../../base/run-site'
import { icon } from '../icons'
import { demo } from '../run'
import { siteHeader } from '../shell'
import { picture, runButton } from './parts'

// Each card's box (x, y, width) on the 1536 x 1024 painting, its pin, and where the narrow layout places it
// (left and top, in percent) over the 836 x 660 crop that starts at (700, 100).
const cards = [
 { id: 'owner', tone: 'green', glyph: 'dollar', x: 1245, y: 119, w: 230, pin: [1360, 256], from: [1360, 216], phone: [54.5, 1], body: '<b>Owner statement</b><span>October</span><strong>$14,220.40 <em class="pill green">Sent</em></strong>', short: '<b>Owner statement</b><span>$14,220.40 · Sent</span>' },
 { id: 'u2b', tone: 'green', glyph: 'dollar', x: 741, y: 363, w: 202, pin: [958, 459], from: [943, 448], phone: [2, 36], body: '<b>Unit 2B</b><span>Rent paid</span><strong>$1,850 · Oct 1</strong>', short: '<b>Unit 2B · Rent paid</b><span>$1,850 · Oct 1</span>' },
 { id: 'u3a', tone: 'orange', glyph: 'wrench', x: 1256, y: 377, w: 211, pin: [1233, 459], from: [1256, 437], phone: [54.5, 39], body: '<b>Unit 3A</b><span>Leak reported</span><span>Plumber booked</span><strong>Tue 9am</strong>', short: '<b>3A · Leak reported</b><span>Plumber booked Tue 9am</span>' },
 { id: 'u1c', tone: 'violet', glyph: 'doc', x: 762, y: 599, w: 202, pin: [979, 685], from: [964, 676], phone: [2, 72], body: '<b>Unit 1C</b><span>Lease renewed</span><strong class="soft">12 mo</strong>', short: '<b>Unit 1C</b><span>Lease renewed · 12 mo</span>' },
 { id: 'u4b', tone: 'blue', glyph: 'people', x: 1236, y: 620, w: 231, pin: [1217, 702], from: [1240, 682], phone: [54.5, 75.5], body: '<b>Unit 4B</b><span>Application approved</span>', short: '<b>Unit 4B</b><span>Application approved</span>' },
]

const pins = (viewBox: string, className: string) => `<svg class="${className}" viewBox="${viewBox}" aria-hidden="true">${cards.map(card => `<path class="lead ${card.tone}" d="M${card.from.join(' ')}L${card.pin.join(' ')}"/><circle class="pin ${card.tone}" cx="${card.pin[0]}" cy="${card.pin[1]}" r="8"/>`).join('')}</svg>`

const card = (c: typeof cards[number]) => `<div class="unit-card ${c.id}" style="--x:${c.x};--y:${c.y};--w:${c.w};--px:${c.phone[0]}%;--py:${c.phone[1]}%"><span class="disc ${c.tone}">${icon(c.glyph)}</span><p class="long">${c.body}</p><p class="short">${c.short}</p></div>`

export function hero() {
 return `<section class="hero" aria-labelledby="hero-title">${siteHeader(undefined, 'over-art')}
<div class="hero-copy"><h1 id="hero-title">Rent in. Repairs done. Owners paid<span class="dot">.</span></h1>
<p class="hero-sub">Terrace fills your units, collects the rent, fixes what breaks, and keeps every owner's books reconciled.</p>
<p class="hero-alt">100% free, open source alternative to <span class="names"><strong>AppFolio</strong>, <strong>Buildium</strong> and <strong>Rent Manager</strong></span></p>
<div class="actions">${runButton()}<a class="text-link" href="${escape(demo)}">Try the demo</a><a class="text-link" href="/docs">Read the docs</a></div></div>
<div class="hero-scene">${picture('hero', 'A terraced apartment building at dusk drawn in cross-section, its rooms lit, a rooftop terrace with a parasol and string lights, and a hillside city and bay behind.', { phone: 'hero-phone', eager: true })}
${pins('0 0 1536 1024', 'hero-pins')}
<div class="unit-cards" role="list" aria-label="This month in one building">${cards.map(c => card(c).replace('<div class="unit-card', '<div role="listitem" class="unit-card')).join('')}</div></div>
</section>`
}
