import {vendorAppointment,respondToWork} from './portal-vendor'
import {externalRequest,completeRequest} from './action-requests'
import {actionPage} from './action-request-view'
import {portalReport} from './report-deliveries'
import { answerRequest, requestData, requestPhoto, residentRequests, submitRequest } from './portal-requests'
import { requestDetail, requestList } from './portal-request-view'
import {residentMonthlyStatement,residentMonthlyCsv,residentMonthlyPage,residentTransaction,residentTransactionPage} from './resident-statements'
// ROLE-002: the /portal door. It is separate from /app and /api: a portal cookie reaches nothing there, and a staff cookie reaches
// nothing here. Every request reads the live session, person and grants, then answers for the one record a grant names.
// An unknown or unshared record is always a plain 404, never a hint that it exists.
import { Fault, audit, guard, insist, recordRead, sql, type Context, type Row } from './core'
import type { Bindings } from '../auth.server'
import { csv } from './exports'
import { ownerStatementTable } from './owners'
import { invoiceFile, ownerData, ownerPeriodStatement, residentCsv, residentData, vendorData } from './portal-data'
import { COOKIE, current, portalContext, redeem, hash, linkExpiry, secret, type Portal } from './portal-session'
import { acceptPage, failurePage, homePage, leasePage, ownerPage, shell, signinPage, statementPage, workPage } from './portal-view'

const headers = (extra: Record<string, string> = {}) => ({ 'cache-control': 'private, no-store', 'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer', 'content-security-policy': "default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; form-action 'self'; frame-ancestors 'none'", ...extra })
// A native POST needs its Origin header. no-referrer makes browsers send Origin: null on form navigation; strict-origin
// keeps that same-origin proof without putting a portal path, invitation token or tenancy id in a Referer header.
const html = (body: string, status = 200, extra: Record<string, string> = {}) => new Response(body, { status, headers: headers({ 'content-type': 'text/html;charset=utf-8', 'referrer-policy': 'strict-origin', ...extra }) })
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: headers() })
const missing = (api: boolean) => api ? json({ error: 'not_found', message: 'Not found.' }, 404) : html(shell('Not found', '<section><p>That page is not available to you.</p><p><a href="/portal">Back to your portal</a></p></section>'), 404)
const cookie = (env: Bindings, value: string, age: number) => `${COOKIE}=${value}; Path=/portal; HttpOnly; SameSite=Lax; Max-Age=${age}${env.AUTH_ORIGIN.startsWith('https') ? '; Secure' : ''}`

export async function portalResponse(request: Request, env: Bindings): Promise<Response> {
 const url = new URL(request.url), now = new Date().toISOString(), path = url.pathname.replace(/\/$/, '') || '/portal', api = path.startsWith('/portal/api/') || ['/portal/report', '/portal/statement', '/portal/transaction', '/portal/owner-statement', '/portal/invoice-file'].includes(path)
 try {
  if (url.origin !== env.AUTH_ORIGIN) return html(shell('Forbidden', '<p>The request origin does not match this installation.</p>'), 403)
  if (request.method === 'POST') insist(request.headers.get('origin') === env.AUTH_ORIGIN && request.headers.get('sec-fetch-site') !== 'cross-site', 'origin', 'Same-origin confirmation is required.', 403)
  else insist(request.method === 'GET', 'method', 'Method not allowed.', 405)
  const form = request.method === 'POST' ? await request.formData().catch(() => new FormData()) : new FormData()
  if (path === '/portal/signin') {
   if (request.method === 'GET') return html(signinPage())
   const to = String(form.get('email') ?? '').trim().toLowerCase(), since = new Date(Date.parse(now) - 60000).toISOString()
   // The answer never says whether an address has access. A link is made only for an active person, at most one a minute.
   for (const p of to ? (await env.DB.prepare("SELECT id,email FROM tt_portal_identities WHERE email=? AND status='active' AND NOT EXISTS(SELECT 1 FROM tt_portal_links WHERE identity_id=tt_portal_identities.id AND purpose='signin' AND created_at>?)").bind(to, since).all<Row>()).results : []) {
    const token = secret()
    // Requests made at once can all pass the check above; the insert repeats it, so only the one that claims the minute sends.
    const claimed = await env.DB.prepare("INSERT INTO tt_portal_links(token_hash,identity_id,purpose,created_at,expires_at) SELECT ?,?,'signin',?,? WHERE NOT EXISTS(SELECT 1 FROM tt_portal_links WHERE identity_id=? AND purpose='signin' AND created_at>?) RETURNING token_hash").bind(await hash(token), p.id, now, linkExpiry(now), p.id, since).first()
    if (claimed) await sendSignin(env, p.email, token)
   }
   return html(signinPage('If that address has portal access, a sign-in link has been sent to it.'), 202)
  }
  if (path === '/portal/accept') {
   const token = String(request.method === 'POST' ? form.get('token') ?? '' : url.searchParams.get('token') ?? '')
   if (request.method === 'GET') return token ? html(acceptPage(token)) : html(failurePage('This link is not valid.'), 400)
   const made = token ? await redeem(env.DB, token, now) : null
   if (!made) return html(failurePage('This link is not valid, has expired or was already used.'), 400)
   return new Response(null, { status: 303, headers: headers({ location: '/portal', 'set-cookie': cookie(env, made.session, 43200) }) })
  }
  const portal = await current(env.DB, request.headers.get('cookie'), now)
  if (!portal) return api ? json({ error: 'unauthorized', message: 'Sign in first.' }, 401) : new Response(null, { status: 303, headers: headers({ location: '/portal/signin' }) })
  if (path === '/portal/signout') { await env.DB.prepare('UPDATE tt_portal_sessions SET revoked_at=? WHERE hash=?').bind(now, portal.sessionHash).run(); return new Response(null, { status: 303, headers: headers({ location: '/portal/signin', 'set-cookie': cookie(env, '', 0) }) }) }
  const c = portalContext(env.DB, portal, now, env.SESSION_SECRET), mine = (key: string, value: unknown) => portal.grants.find(g => g[key] === value)
  if(['/portal/api/appointment-response','/portal/appointment-response'].includes(path)){
   insist(request.method==='POST','method','Method not allowed.',405)
   const response=await vendorAppointment(c,portal,form)
   return path.startsWith('/portal/api/')?json(response):new Response(null,{status:303,headers:headers({location:'/portal/work'})})
  }
  if(['/portal/api/work-response','/portal/work-response'].includes(path)){
   insist(request.method==='POST','method','Method not allowed.',405)
   const response=await respondToWork(c,portal,form)
   return path.startsWith('/portal/api/')?json(response):new Response(null,{status:303,headers:headers({location:'/portal/work'})})
  }
  if(path==='/portal/request') {
   const token=String(request.method==='POST'?form.get('token')??'':url.searchParams.get('token')??'')
   const r=await externalRequest(c,portal,token)
   if(request.method==='GET'&&url.searchParams.get('file')==='1') {
    insist(r.document_version_id,'not_found','Document not found.',404)
    const original=await env.DB.prepare('SELECT bytes,name,media_type,sha256 FROM tt_document_versions WHERE id=? AND sha256=?').bind(r.document_version_id,r.document_sha256).first<Row>()
    insist(original,'not_found','Document not found.',404);await recordRead(c,'portal.request.document',r.id)
    return new Response(new Uint8Array(original.bytes),{headers:headers({'content-type':original.media_type,'content-disposition':'attachment; filename="'+String(original.name).replace(/[^a-zA-Z0-9._-]/g,'_')+'"','content-security-policy':"default-src 'none'; sandbox"})})
   }
   if(request.method==='POST'){const done=await completeRequest(c,portal,r,Object.fromEntries(form));return html(actionPage(done,token,portal.identity,'Your action was recorded.'))}
   return html(actionPage(r,token,portal.identity))
  }
  if (path === '/portal/delegate/revoke') {
   // The resident on a lease ends a delegated contact's access to it: the grant and the contact's open sessions, in history.
   insist(request.method === 'POST', 'method', 'Method not allowed.', 405)
   const grant = await env.DB.prepare("SELECT * FROM tt_portal_grants WHERE id=? AND access='delegate' AND revoked_at IS NULL").bind(String(form.get('grantId') ?? '')).first<Row>()
   if (!grant || !portal.grants.some(g => g.access === 'resident' && g.tenancy_id === grant.tenancy_id)) return missing(false)
   c.tenancyId = grant.tenancy_id
   await env.DB.batch([guard(c, "EXISTS(SELECT 1 FROM tt_portal_grants WHERE identity_id=? AND tenancy_id=? AND access='resident' AND revoked_at IS NULL)", portal.identity.id, grant.tenancy_id),
    sql(c, "UPDATE tt_portal_grants SET revoked_by=?,revoked_at=?,revoke_reason='Revoked by the resident' WHERE id=? AND revoked_at IS NULL", c.actor.id, now, grant.id),
    sql(c, 'UPDATE tt_portal_sessions SET revoked_at=? WHERE identity_id=? AND revoked_at IS NULL', now, grant.identity_id), audit(c, 'portal.revoke', grant.id)])
   return new Response(null, { status: 303, headers: headers({ location: `/portal/lease?tenancy=${encodeURIComponent(grant.tenancy_id)}&revoked=1` }) })
  }
  if (['/portal/repairs','/portal/repair','/portal/repair-file'].includes(path)) {
   if (request.method === 'POST') {
    insist(path !== '/portal/repair-file','method','Method not allowed.',405)
    const key = path === '/portal/repairs' ? await submitRequest(c,portal,form,env) : await answerRequest(c,portal,form)
    return new Response(null,{status:303,headers:headers({location:'/portal/repair?id='+encodeURIComponent(key)})})
   }
   if (path === '/portal/repairs') return html(shell('Repair requests',requestList(await residentRequests(c,portal,url.searchParams.get('tenancy'))),portal.identity))
   if (path === '/portal/repair') return html(shell('Repair tracking',requestDetail(await requestData(c,portal,url.searchParams.get('id'))),portal.identity))
   const f = await requestPhoto(c,portal,String(url.searchParams.get('id') ?? ''))
   return new Response(new Uint8Array(f.bytes),{headers:headers({'content-type':f.media_type,'content-disposition':`attachment; filename="${String(f.name).replace(/[^a-zA-Z0-9._-]/g,'_')}"`,'content-security-policy':"default-src 'none'; sandbox"})})
  }
  insist(request.method === 'GET', 'method', 'Method not allowed.', 405)
  if (path === '/portal') {
   const labelled = await Promise.all(portal.grants.map(async (g): Promise<Row> => ({ ...g, label: g.tenancy_id ? (await env.DB.prepare('SELECT address FROM tt_tenancies WHERE id=? AND erased_at IS NULL').bind(g.tenancy_id).first<Row>())?.address ?? 'Lease' : '' })))
   return html(homePage(portal.identity, labelled.filter(g => g.label || !g.tenancy_id)))
  }
  if(path==='/portal/report'){const statement=await portalReport(c,portal,String(url.searchParams.get('id')||''));return url.searchParams.get('format')==='json'?json(statement):html(statementPage(portal.identity,statement))}
  if (path === '/portal/api/me') return json({ person: { id: portal.identity.id, kind: portal.identity.kind, name: portal.identity.display_name }, grants: portal.grants.map(g => ({ id: g.id, access: g.access, tenancyId: g.tenancy_id, ownerId: g.owner_id, vendorId: g.vendor_id })) })
  if(path==='/portal/transaction'||(path==='/portal/statement'&&url.searchParams.has('month'))){
   const grant=mine('tenancy_id',url.searchParams.get('tenancyId'));if(!grant||grant.access!=='resident')return missing(true)
   const format=url.searchParams.get('format')??'html';insist(['html','csv','json'].includes(format),'statement_format','Monthly statements support HTML, CSV or JSON. Accessible PDF and delivery are not implemented.')
   if(path==='/portal/transaction'){const d=await residentTransaction(c,grant,url.searchParams.get('id'));await recordRead(c,'portal.read:transaction',d.transaction.id);return format==='json'?json(d):html(residentTransactionPage(portal.identity,d))}
   const d=await residentMonthlyStatement(c,grant,url.searchParams.get('month'));await recordRead(c,'portal.read:monthly-statement',d.tenancy.id+':'+d.month)
   if(format==='csv')return new Response(residentMonthlyCsv(d),{headers:headers({'content-type':'text/csv;charset=utf-8','content-disposition':'attachment; filename="terrace-monthly-statement.csv"'})})
   return format==='json'?json(d):html(residentMonthlyPage(portal.identity,d))
  }
  const resident = async () => { const g = mine('tenancy_id', url.searchParams.get(path.startsWith('/portal/api') ? 'tenancyId' : path === '/portal/statement' ? 'tenancyId' : 'tenancy')); return g ? residentData(c, g) : null }
  if (['/portal/lease', '/portal/api/resident', '/portal/statement'].includes(path)) {
   const d = await resident(); if (!d) return missing(api)
   if (path === '/portal/api/resident') return json(d)
   if (path === '/portal/statement') { await recordRead(c, 'portal.read:statement', d.tenancy.id); return new Response(residentCsv(d), { headers: headers({ 'content-type': 'text/csv;charset=utf-8', 'content-disposition': 'attachment; filename="terrace-statement.csv"' }) }) }
   await recordRead(c, 'portal.read:lease', d.tenancy.id); return html(leasePage(portal.identity, d, url.searchParams.has('revoked')))
  }
  const ownerGrant = portal.grants.find(g => g.owner_id), vendorGrant = portal.grants.find(g => g.vendor_id)
  if (['/portal/owner', '/portal/api/owner', '/portal/owner-statement'].includes(path)) {
   if (!ownerGrant) return missing(api)
   const d = await ownerData(c, ownerGrant.owner_id), today = now.slice(0, 10), first = d.properties.flatMap(p => p.periods.map(x => x.from)).sort()[0] ?? today
   if (path === '/portal/api/owner') return json(d)
   if (path === '/portal/owner') return html(ownerPage(portal.identity, d, first, today))
   const from = url.searchParams.get('from') ?? first, to = url.searchParams.get('to') ?? today, s = await ownerPeriodStatement(c, ownerGrant.owner_id, from, to), format = url.searchParams.get('format') ?? 'html'
   await recordRead(c, 'portal.read:owner-statement', `${ownerGrant.owner_id} ${s.from}..${s.to}`)
   if (format === 'csv') return new Response(csv(ownerStatementTable(s as Parameters<typeof ownerStatementTable>[0])), { headers: headers({ 'content-type': 'text/csv;charset=utf-8', 'content-disposition': 'attachment; filename="terrace-owner-statement.csv"' }) })
   return format === 'json' ? json(s) : html(statementPage(portal.identity, s))
  }
  if (['/portal/work', '/portal/api/vendor', '/portal/invoice-file'].includes(path)) {
   if (!vendorGrant) return missing(api)
   if (path === '/portal/invoice-file') {
    const f = await invoiceFile(c, vendorGrant.vendor_id, String(url.searchParams.get('id') ?? '')); if (!f) return missing(true)
    await recordRead(c, 'portal.read:invoice', String(url.searchParams.get('id')))
    return new Response(new Uint8Array(f.bytes), { headers: headers({ 'content-type': f.type, 'content-disposition': `attachment; filename="${String(f.name).replace(/[^a-zA-Z0-9._-]/g, '_')}"`, 'content-security-policy': "default-src 'none'; sandbox" }) })
   }
   const d = await vendorData(c, vendorGrant.vendor_id)
   return path === '/portal/api/vendor' ? json(d) : html(workPage(portal.identity, d))
  }
  return missing(api)
 } catch (error) {
  const x = error as Fault
  if (!(error instanceof Fault)) throw error
  return api ? json({ error: x.code, message: x.message }, x.status) : html(shell('Not available', `<section><p>${x.message}</p></section>`), x.status)
 }
}
async function sendSignin(env: Bindings, to: string, token: string) {
 const { operatorMail } = await import('../mail.server.mjs'), mail = operatorMail(env)
 if (!mail) return
 const link = `${env.AUTH_ORIGIN}/portal/accept?token=${token}`
 try { await mail.send({ deliveryId: crypto.randomUUID(), from: env.MAIL_FROM!, to: [to], subject: 'Your Terrace sign-in link', text: `Open this link to sign in to your Terrace portal. It works once and expires in 7 days:\n${link}\n\nIf you did not ask for it, ignore this message.`, html: `<p>Open this link to sign in to your Terrace portal. It works once and expires in 7 days:<br><a href="${link}">${link}</a></p><p>If you did not ask for it, ignore this message.</p>`, headers: {} } as Parameters<NonNullable<typeof mail>['send']>[0]) } catch {}
}
