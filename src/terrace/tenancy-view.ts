import { escape as e,money,type Row } from './core'
import { monthName,place,usDate } from './format'
import { icon } from './icons'
import { RESIDENTIAL_ONLY } from './imports-source'
import { avatar,button,form,hidden,input,pill } from './view'
export function chooser(rows:Row[],selected:Row|undefined,tab:string) {
 if(!rows.length) return `<section class="empty-state">${emptyMark}<h2 class="empty-title">No tenancies yet<span class="dot" aria-hidden="true">.</span></h2><p>Add your first tenancy or use the Move in kit.</p><p><a href="/app">Add a tenancy</a> · <a href="/app?tab=import">Move in</a></p></section>`
 return `<form class="tenancy-chooser" method="get" action="/app"><input type="hidden" name="tab" value="${e(tab)}"><label>Choose tenancy<select name="tenancy">${rows.map(t=>`<option value="${e(t.id)}" ${t.id===selected?.id?'selected':''}>${e(t.address)} · ${e(t.tenant_name)}</option>`).join('')}</select></label><button class="secondary" type="submit">Open tenancy</button></form>`
}
const emptyMark='<img class="empty-mark" src="/brand/mark.svg" alt="" width="72" height="48">'
const example=(text:string)=>`placeholder="e.g. ${e(text)}"`
export function createTenancy(open:boolean) {
 return `<details class="panel add-tenancy" id="add-tenancy"${open?' open':''}><summary>Add a tenancy</summary>${form('tenancy.create',`<div class="form-columns"><div>${input('Property address','address','text','',example('123 Maple St, Oakland, CA 94610'))}${input('Property owner','ownerName','text','',example('Okafor Family Trust'))}${input('Owner email','ownerEmail','email','',example('owner@example.com'))}${input('Tenant name','tenantName','text','',example('Jane Doe'))}${input('Tenant email','tenantEmail','email','',example('tenant@example.com'))}</div><div>${input('Lease starts','startDate','date')}${input('Lease ends','endDate','date')}${input('Rent (USD)','rent','number','',`min="0.01" step="0.01" ${example('1850.00')}`)}<label>Rent cadence<select name="cadence"><option value="monthly" selected>Monthly</option><option value="fortnightly">Every two weeks</option><option value="weekly">Weekly</option></select></label>${button('Add tenancy')}</div></div>`)}</details>`
}
export function emptyView(create:string,today:string) {
 return `<div class="empty-layout"><section class="empty-state">${emptyMark}<h2 class="empty-title">No tenancies yet<span class="dot" aria-hidden="true">.</span></h2><p>Add your first tenancy or use the Move in kit.</p><p><a class="arrow-link" href="/app?tab=import">Move in →</a></p><ol class="empty-steps"><li>Add a tenancy</li><li>Record ${e(monthName(today))} rent</li><li>Prepare renewals for approval</li></ol><p class="muted">${e(RESIDENTIAL_ONLY)}</p></section>${create}</div>`
}
function decision(r:Row,t:Row,manage:boolean) {
 const p=JSON.parse(r.payload),tone=r.state==='pending'?'pending':r.state==='approved'?'paid':'closed'
 const what=r.kind==='renewal'?`Proposed end ${usDate(p.endDate)}, ${money(p.rentCents)}. ${e(p.source)}`:`${e(p.message)}<br>Follow-up: ${usDate(p.followUpDate)}`
 return `<article class="decision"><h3><span class="icon-disc ${e(r.kind)}">${icon(r.kind)}</span>${r.kind==='renewal'?'Renewal':'Arrears follow-up'} ${pill(r.state,tone)}</h3><p>${what}</p><p class="muted">Prepared ${usDate(r.prepared_at)} by ${e(r.prepared_name)}</p>${r.approved_at?`<p class="muted">Decision ${usDate(r.approved_at)} by ${e(r.approved_name)}</p>`:''}${manage&&r.state==='pending'?`<div class="decision-actions">${form('proposal.approve',hidden('proposalId',r.id)+button('Approve '+r.kind),t.id)}${form('proposal.reject',hidden('proposalId',r.id)+'<button class="secondary" type="submit">Reject proposal</button>',t.id)}</div>`:''}</article>`
}
function rentCard(t:Row,ledger:Row,today:string) {
 const recent=[...ledger.charges].reverse().slice(0,4)
 const rows=recent.map((q:Row)=>{const paid=q.balance_cents===0,late=!paid&&q.due_date<today;return `<li><span>${usDate(q.due_date)}</span><span>${e(q.description)}</span><span class="muted">${e(q.reference)}</span><span>${money(q.amount_cents)}</span>${pill(paid?'Recorded · Paid':q.balance_cents<q.amount_cents?'Partial':late?'Overdue':'Due',paid?'paid':late?'overdue':'pending')}</li>`}).join('')
 return `<section class="side-card"><h2>Rent &amp; arrears</h2><dl class="side-metrics"><div><dt>Outstanding</dt><dd>${money(ledger.balanceCents)}</dd></div><div><dt>Overdue as of today</dt><dd${ledger.arrearsCents?' class="overdue"':''}>${money(ledger.arrearsCents)}</dd></div></dl>${rows?`<h3>${recent.length===1?'Last charge':`Last ${['','','two','three','four'][recent.length]} charges`}</h3><ul class="charge-list">${rows}</ul>`:'<p class="muted">No rent charges yet.</p>'}<a class="arrow-link" href="/app?tab=ledger&amp;tenancy=${e(t.id)}">Open ledger →</a></section>`
}
function workCard(t:Row,work:Row) {
 const href=`/app?tab=work&amp;tenancy=${e(t.id)}`
 const items=[...work.inspections.slice(0,2).map((i:Row)=>{const n=work.photos.filter((p:Row)=>p.inspection_id===i.id).length;return `<li><a href="${href}"><span class="icon-disc inspection">${icon('inspection')}</span><span>Inspection · ${usDate(i.inspection_date)} · ${i.state==='completed'?'Completed':'Draft'} · ${n} ${n===1?'photo':'photos'}</span>${icon('chevron')}</a></li>`}),...work.jobs.slice(0,2).map((j:Row)=>`<li><a href="${href}"><span class="icon-disc maintenance">${icon('maintenance')}</span><span>${e(j.title)} · ${e(j.trade_name)}<small>${j.state==='pending'?'Prepared · awaiting approval':j.state==='approved'?'Approved · awaiting external handoff':'Sent · external handoff recorded'}</small></span>${icon('chevron')}</a></li>`)]
 return `<section class="side-card"><h2>Inspections &amp; maintenance</h2>${items.length?`<ul class="work-list">${items.join('')}</ul>`:'<p class="muted">No inspections or maintenance recorded.</p>'}<a class="arrow-link" href="${href}">Open work →</a></section>`
}
export function tenancyView(t:Row|undefined,proposals:Row[],manage:boolean,ledger:Row,work:Row,today:string) {
 if(!t) return ''
 const unit=place(t.address).unit
 const facts=[['Tenant',`${avatar(t.tenant_name)}<span>${e(t.tenant_name)}<small>${e(t.tenant_email)}</small></span>`],['Property owner',`${avatar(t.owner_name)}<span>${e(t.owner_name)}<small>${e(t.owner_email)}</small></span>`],['Lease',`${icon('calendar')}<span>${usDate(t.start_date)} to ${usDate(t.end_date)}</span>`],['Rent',`${icon('dollar')}<span>${money(t.rent_cents)} ${e(t.cadence)}</span>`]]
 return `<section class="definition-strip" aria-label="${unit?`Unit ${e(unit)}`:'Tenancy'} facts"><dl>${facts.map(([label,value])=>`<div><dt>${label}</dt><dd>${value}</dd></div>`).join('')}</dl></section><div class="detail-layout"><div><section><h2>Prepared decisions</h2>${proposals.length?proposals.map(r=>decision(r,t,manage)).join(''):'<p class="muted">No proposals waiting.</p>'}</section><section><h2>Prepare a renewal</h2><p class="muted">A person confirms the proposed terms. Terrace does not generate or serve a statutory notice.</p>${form('renewal.prepare',`<div class="field-row">${input('Proposed lease end','endDate','date')}${input('Proposed rent (USD)','rent','number',(t.rent_cents/100).toFixed(2),'min="0.01" step="0.01"')}${input('Lease reference / reason','source')}</div>`+button('Prepare renewal'),t.id)}</section></div><div>${rentCard(t,ledger,today)}${workCard(t,work)}</div></div>`
}
export const backToTenancies='<a class="back-link" href="/app?tab=tenancy">← Tenancies</a>'
