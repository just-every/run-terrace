import { themeFrame } from '../base/theme-frame'
import { fontHead } from '../base/font-head'
import { escape as e, type Context } from './core'
export const hidden=(name:string,value:unknown)=>`<input type="hidden" name="${e(name)}" value="${e(value)}">`
export const input=(label:string,name:string,type='text',value:unknown='',extra='')=>`<label>${e(label)}<input name="${e(name)}" type="${type}" value="${e(value)}" required ${extra}></label>`
export const button=(label:string)=>`<button type="submit">${e(label)}</button>`
export const form=(command:string,body:string,tenancyId='',tab='tenancy',extra='')=>`<form method="post" action="/app/command" ${extra}>${hidden('command',command)}${hidden('tenancyId',tenancyId)}${hidden('tab',tab)}${body}</form>`
export async function page(c:Context,title:string,body:string,notice='',status=200) {
 const frame=await themeFrame({href:'/rer-theme.css',productName:'Terrace'})
 const links=[['tenancy','Tenancies'],['ledger','Rent & arrears'],['work','Inspections & maintenance'],['import','Move in'],['settings','Data & access']]
 const html=`<!doctype html><html lang="en"${frame.htmlClass}><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${e(title)} · Terrace</title>${fontHead}${frame.head}<link rel="stylesheet" href="/terrace.css"></head><body><main>${frame.brand}<header><div><p>Residential property management</p><h1>${e(title)}</h1></div><a href="/app?tab=settings">Manage people</a></header><nav aria-label="Main navigation">${links.map(([tab,label])=>`<a href="/app?tab=${tab}">${label}</a>`).join('')}</nav><p class="boundary">Recorded rent and property operations. Trust accounting, collection and money movement stay in your existing systems.</p>${notice?`<div role="status" class="notice">${e(notice)}</div>`:''}${body}<footer>Signed in with ${e(c.actor.role==='admin'?'manager':c.actor.role)} access · <a href="/app?tab=settings">Data & access</a></footer></main></body></html>`
 return new Response(html,{status,headers:{'content-type':'text/html;charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'strict-origin','content-security-policy':`default-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'; ${frame.policy}`}})
}
