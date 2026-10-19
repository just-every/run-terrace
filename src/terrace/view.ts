import { fontHead } from '../base/font-head'
import { escape as e, type Context } from './core'
import { eyebrowDate, initials, tint } from './format'
import { DEFAULT_ZONE, localDate } from './zones'
export const hidden=(name:string,value:unknown)=>`<input type="hidden" name="${e(name)}" value="${e(value)}">`
export const input=(label:string,name:string,type='text',value:unknown='',extra='')=>`<label>${e(label)}<input name="${e(name)}" type="${type}" value="${e(value)}" required ${extra}></label>`
export const button=(label:string)=>`<button type="submit">${e(label)}</button>`
export const form=(command:string,body:string,tenancyId='',tab='tenancy',extra='')=>`<form method="post" action="/app/command" ${extra}>${hidden('command',command)}${hidden('tenancyId',tenancyId)}${hidden('tab',tab)}${body}</form>`
export const avatar=(name:string)=>`<span class="avatar t${tint(name)}" aria-hidden="true">${e(initials(name))}</span>`
export const pill=(label:string,tone='')=>`<span class="pill${tone?' '+tone:''}">${e(label)}</span>`
const styles=['shell','controls','content','home','pages'].map(n=>`<link rel="stylesheet" href="/app/${n}.css">`).join('')
type Head={eyebrow?:string,actions?:string,back?:string}
export async function page(c:Context,title:string,body:string,notice='',status=200,current='tenancy',head:Head={}) {
 const links=[['tenancy','Tenancies'],['properties','Properties'],['ledger','Rent & arrears'],['work','Inspections & maintenance'],['import','Move in'],['settings','Data & access']]
 const name=c.actor.displayName
 const html=`<!doctype html><html lang="en" class="terrace-app"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${e(title)} · Terrace</title><link rel="icon" href="/brand/mark.svg">${fontHead}<link rel="stylesheet" href="/rer-theme.css">${styles}</head><body><a class="skip-link" href="#content">Skip to content</a><header class="app-header"><a class="app-brand" href="/app"><img src="/brand/mark.svg" alt="" width="36" height="24"><span data-rer-name>Terrace</span></a><nav class="app-nav" aria-label="Main navigation">${links.map(([tab,label])=>`<a href="/app?tab=${tab}"${tab===current?' aria-current="page"':''}>${label}</a>`).join('')}</nav><a class="person" href="/app?tab=settings" title="Manage people">${avatar(name)}<span class="person-name">${e(name)}</span></a></header><main id="content"><div class="title-row"><div>${head.back??''}<p class="eyebrow">${e(head.eyebrow??eyebrowDate(localDate(c.now,c.zone??DEFAULT_ZONE)))}</p><h1>${e(title)}<span class="dot" aria-hidden="true">.</span></h1><p class="boundary">Recorded rent and property operations. Trust accounting, collection and money movement stay in your existing systems.</p></div>${head.actions??''}</div>${notice?`<div role="status" class="notice">${e(notice)}</div>`:''}${body}</main><footer class="app-footer">Signed in with ${e(c.actor.role==='admin'?'manager':c.actor.role)} access · <a href="/app?tab=settings">Data & access</a></footer></body></html>`
 return new Response(html,{status,headers:{'content-type':'text/html;charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'strict-origin','content-security-policy':"default-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'; style-src 'self'; font-src 'self'; img-src 'self' data:"}})
}
