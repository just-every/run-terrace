// Page 11: the hero building's rooftop at night (a clean plate) under the closing heading; two HTML tags close
// the month, then the thin footer.
import { siteFooter } from '../shell'
import { disc, heading, picture, runButton } from './parts'

export function closing() {
 return `<section class="closing" aria-labelledby="closing-title"><div class="closing-copy">${heading('h2', 'Every unit, cared for.', 'closing-title', 'center')}
<p class="closing-sub">Open source property management you run yourself.</p>
<div class="actions">${runButton()}<a class="text-link" href="/docs">Read the docs</a></div><p class="licence">Free and open source, MIT licensed.</p></div>
<div class="closing-scene">${picture('closing', 'The same building’s rooftop terrace at night under its parasol and string lights, the city and the bay lit behind.', { phone: 'closing-phone' })}
<svg class="closing-pins" viewBox="0 0 1536 588" aria-hidden="true"><path class="lead green" d="M1252 75 1150 119"/><circle class="pin green" cx="1150" cy="119" r="8"/><path class="lead blue" d="M1172 430 1075 499"/><circle class="pin blue" cx="1075" cy="499" r="8"/></svg>
<p class="night-tag paid">${disc('dollar', 'green-solid')}<span><b>Owners paid</b>Nov 3 · 14 owners</span></p>
<p class="night-tag moved">${disc('people', 'blue-solid')}<span><b>Unit 4B</b>Moved in Nov 1</span></p></div>
${siteFooter()}</section>`
}
