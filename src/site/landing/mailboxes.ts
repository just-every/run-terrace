// Page 07: Oct 15 at the building's brass mailboxes (a clean plate). The 20 unit labels and the seven
// mid-month tags are HTML; on phones the tags become dots on the boxes and a list below the panel.
import { disc, eyebrow, picture } from './parts'

// Floor is the column (1–5), letter the row (A–D).
const tags: Record<string, [string, string, string, string]> = {
 '3A': ['All dry', 'Sink fixed Oct 6', 'green', 'check'],
 '5A': ['On a plan', '$925 paid Oct 9', 'amber', 'dollar'],
 '2B': ['Paid', '$1,850 · Oct 1', 'green', 'dollar'],
 '4B': ['Leased', 'Moves in Nov 1', 'violet', 'list'],
 '1C': ['Renewed', '12 mo · $1,940', 'violet', 'list'],
 '4C': ['Partial', '$950 due Oct 15', 'amber', 'dollar'],
 '1D': ['Cash posted', '$1,425 · Oct 1', 'green', 'dollar'],
}
const listOrder = ['2B', '1D', '3A', '4C', '5A', '4B', '1C']

export function mailboxes() {
 const boxes = ['A', 'B', 'C', 'D'].flatMap(row => [1, 2, 3, 4, 5].map(floor => `${floor}${row}`))
 return `<section class="section mailboxes" aria-labelledby="mid-title"><h2 class="visually-hidden" id="mid-title">Mid-month, box by box</h2>
${eyebrow('Oct 15 · Mid-month', 'center plate-eyebrow')}
<div class="mail-stage">${picture('mailboxes', 'A brass panel of twenty mailboxes on a pale tiled wall, a tree’s shadow falling across it.', { phone: 'mailboxes-phone' })}
<ul class="boxes" aria-label="Mailboxes 1A to 5D">${boxes.map((unit, index) => {
  const tag = tags[unit]
  return `<li class="box" style="--c:${index % 5};--r:${Math.floor(index / 5)}"><span class="label">${unit}</span>${tag ? `<span class="box-dot ${tag[2]}" aria-hidden="true"></span><span class="tag">${disc(tag[3], tag[2])}<span><b>${tag[0]}</b>${tag[1]}</span></span>` : ''}</li>`
 }).join('')}</ul></div>
<ul class="wrap tag-list" aria-label="Mid-month states">${listOrder.map(unit => { const [title, line, tone, glyph] = tags[unit]; return `<li class="card">${disc(glyph, tone)}<span><b>${unit} · ${title}</b>${line}</span></li>` }).join('')}</ul>
</section>`
}
