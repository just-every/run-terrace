// Page 05: the same repair on four surfaces — Jordan's resident portal, the arrival text, the owner's email
// and Bayline's work order. Phones show the portal as a card, not a phone frame.
import { icon } from '../icons'
import { sinkPhoto } from './drawings'
import { avatar, disc, eyebrow, heading, pill } from './parts'

const portal = `<div class="portal"><div class="status-bar" aria-hidden="true"><span>9:41</span><i class="island"></i><span class="signal"><i></i><i></i><i></i><i></i></span></div>
<div class="portal-head">${avatar('J', 'blue')}<div><p class="hi">Hi Jordan<span class="unit"> · 3A</span></p><p class="where">3A · Alder Court</p><p class="paid-line">Balance <b>$0.00</b> · Paid Oct 1</p></div></div>
<div class="balance"><p>Balance</p><p class="zero">$0.00</p><p>Paid Oct 1</p>${disc('check', 'green')}</div>
<div class="repair-row">${disc('wrench', 'orange', 'square')}<div><b>Kitchen sink</b><span><span class="phone-only">· </span>Bayline · Tue 1–3 pm</span>${pill('Scheduled', 'amber')}</div>${icon('chevron', 'chev')}</div>
<p class="request">Request a repair</p></div>`

export function repaired() {
 return `<section class="section repaired" aria-labelledby="repaired-title"><div class="wrap split">
<div class="surfaces" role="list" aria-label="The repair on four screens">
<div class="phone" role="listitem" aria-label="Resident portal">${portal}</div>
<div class="card sms" role="listitem" aria-label="Arrival text">${avatar('T', 'grey')}<p class="bubble in">Terrace: Bayline Plumbing arrives Tue 1–3 pm for your sink. Reply Y to confirm.</p><p class="bubble out">Y</p></div>
<div class="card email" role="listitem" aria-label="Owner email">${avatar('O', 'violet')}<p class="kicker">Email <span>To: Okafor Family Trust</span></p><h3>3A kitchen sink fixed</h3><p class="meta">$385.00 · Bayline Plumbing · 2 photos</p>
<div class="photos">${sinkPhoto(1)}${sinkPhoto(2)}</div><p class="on">On your October statement</p><p class="view">View statement</p></div>
<div class="card work-order" role="listitem" aria-label="Vendor work order">${disc('wrench', 'orange', 'square big')}${avatar('B', 'green')}<div class="wo-head"><h3>WO-2291 · 3A kitchen sink</h3><p>Tue 1:00 pm · Bayline Plumbing</p></div>
<ul><li>${disc('check', 'green')}<span>Upload photos</span><b>2 added</b></li><li>${disc('check', 'green')}<span>Submit invoice</span><b>$385.00</b></li></ul></div>
</div>
<div class="copy">${eyebrow('Oct 6 · 3A repaired')}${heading('h2', 'Everyone sees\nthe same repair.', 'repaired-title')}
<p class="lead">Residents pay and report from their phone. Owners see their books. Vendors get the job, the photos and the invoice form.</p></div>
</div></section>`
}
