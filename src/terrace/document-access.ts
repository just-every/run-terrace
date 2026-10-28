import { insist, type Context } from './core'

const encoder = new TextEncoder(), lifetime = 60_000
const hex = (bytes: ArrayBuffer) => Array.from(new Uint8Array(bytes), n => n.toString(16).padStart(2, '0')).join('')
async function key(c: Context) {
 insist(c.session && c.secret && !c.actor.credential, 'forbidden', 'Sign in to download a restricted original.', 403)
 return crypto.subtle.importKey('raw', encoder.encode(c.secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify'])
}
const payload = (c: Context, versionId: string, expires: number) => encoder.encode(JSON.stringify(['terrace-restricted-original', c.actor.id, c.session!.hash, versionId, expires]))

/** This authorization carries no document text and grants nothing without the same live sign-in. */
export async function authorizeOriginal(c: Context, versionId: string) {
 const signingKey = await key(c), expires = Date.parse(c.now) + lifetime
 const signature = hex(await crypto.subtle.sign('HMAC', signingKey, payload(c, versionId, expires)))
 return { url: `/api/document?id=${encodeURIComponent(versionId)}&access=${expires}.${signature}`, expiresAt: new Date(expires).toISOString() }
}

/** The caller must separately load the document and check current role, scope and erasure before serving bytes. */
export async function requireOriginalAccess(c: Context, versionId: string, value: unknown) {
 const signingKey = await key(c), token = typeof value === 'string' ? /^(\d{13})\.([a-f0-9]{64})$/.exec(value) : null
 const expires = Number(token?.[1]), now = Date.parse(c.now)
 insist(token && expires > now && expires <= now + lifetime, 'document_access_expired', 'Open the document again to authorize this download.', 403)
 const signature = Uint8Array.from(token[2].match(/../g)!, part => parseInt(part, 16))
 insist(await crypto.subtle.verify('HMAC', signingKey, signature, payload(c, versionId, expires)), 'document_access_expired', 'Open the document again to authorize this download.', 403)
}
