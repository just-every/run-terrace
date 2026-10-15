import {queuedEntrypoint} from '@runeditrun/rer/queued-entry';
const queued=await queuedEntrypoint(import.meta.url,'verify:email-link');if(queued!==null)process.exit(queued);
// The emitted Worker follows ordinary email-link sign-in. Only the paid mail
// provider is replaced; development mail is deliberately suppressed by Base.
import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { Miniflare, convertV4MiniflareOptions } from 'miniflare'
import { unstable_splitSqlQuery } from 'wrangler'

const directory=await mkdtemp(join(tmpdir(),'terrace-email-link-')),messages=[]
const secret=()=>randomBytes(32).toString('base64url'),owner='owner@example.test'
const vars={AUTH_LOCAL:'true',AUTH_ORIGIN:'http://localhost',OWNER_EMAIL:owner,SESSION_SECRET:secret(),SETUP_TOKEN:secret(),MAIL_PROVIDER:'resend',MAIL_API_KEY:'example-test-mail',MAIL_FROM:'auth@localhost.test'}
const modules=[{type:'ESModule',path:resolve('dist/server/index.js')},...(await readdir('dist/server/assets')).filter(name=>name.endsWith('.js')).map(name=>({type:'ESModule',path:resolve('dist/server/assets',name)}))]
const options=port=>({...convertV4MiniflareOptions({host:'127.0.0.1',port,modules:modules,compatibilityDate:'2026-09-08',compatibilityFlags:['nodejs_compat'],d1Databases:['DB'],bindings:vars,outboundService:async request=>{assert.equal(new URL(request.url).hostname,'api.resend.com');messages.push(await request.json());return Response.json({id:crypto.randomUUID()})}}),resourcePersistencePath:directory})
const worker=new Miniflare(options(0))
try {
 const origin=(await worker.ready).origin;vars.AUTH_ORIGIN=origin;await worker.setOptions(options(Number(new URL(origin).port)))
 const db=await worker.getD1Database('DB')
 for(const file of (await readdir('migrations/core')).filter(f=>f.endsWith('.sql')).sort())await db.batch(unstable_splitSqlQuery(await readFile('migrations/core/'+file,'utf8')).map(sql=>db.prepare(sql)))
 const post=(path,body)=>fetch(origin+path,{method:'POST',redirect:'manual',headers:{origin,'content-type':'application/json'},body:JSON.stringify(body)})
 assert.equal((await post('/auth/bootstrap',{token:vars.SETUP_TOKEN,displayName:'Owner'})).status,303)
 assert.equal((await post('/auth/magic-link',{email:owner})).status,202)
 assert.equal(messages.length,1,'one sign-in message reached the provider edge')
 const message=messages[0],match=(message.html??message.text).match(/(?:href=")?([^"\s<>]*\/auth\/confirm\?token=[^"\s<>]+)/)
 assert.ok(match,'message contains the ordinary confirmation link')
 const link=new URL(match[1].replaceAll('&amp;','&'),origin)
 assert.equal(link.origin,origin)
 assert.equal((await fetch(link)).status,200)
 const confirmed=await post('/auth/confirm',{token:link.searchParams.get('token')})
 assert.equal(confirmed.status,303)
 const cookie=confirmed.headers.getSetCookie().map(line=>line.split(';')[0]).join('; ')
 const session=await fetch(origin+'/auth/session',{headers:{cookie}})
 assert.equal(session.status,200)
 assert.equal((await session.json()).operator.email,owner)
 assert.equal((await post('/auth/confirm',{token:link.searchParams.get('token')})).status,400,'a consumed link cannot be reused')
 assert.equal((await fetch(origin+'/__dev/outbox')).status,404)
 console.log('Email-link sign-in passed against emitted Worker: provider edge, confirmation, session, single use')
} finally {await worker.dispose();await rm(directory,{recursive:true,force:true})}
