import {insist,type Context} from './core'
const enc=new TextEncoder(),LIFETIME=5*60*1000
const key=(c:Context)=>crypto.subtle.importKey('raw',enc.encode(c.secret!),{name:'HMAC',hash:'SHA-256'},false,['sign','verify'])
const payload=(c:Context,id:string,digest:string,expires:number)=>enc.encode(JSON.stringify(['restricted-original',id,digest,expires,c.session!.hash,c.actor.id,c.actor.version??1,c.actor.staff?.version??0]))
const hex=(b:ArrayBuffer)=>Array.from(new Uint8Array(b)).map(x=>x.toString(16).padStart(2,'0')).join('')
export async function originalAuthorization(c:Context,id:string,digest:string){
 insist(c.session&&c.secret&&!c.actor.credential,'forbidden','A current signed-in person must authorize this restricted original.',403)
 const expires=Date.parse(c.now)+LIFETIME,signature=hex(await crypto.subtle.sign('HMAC',await key(c),payload(c,id,digest,expires)))
 return{token:expires+'.'+signature,expiresAt:new Date(expires).toISOString()}
}
export async function requireOriginalAuthorization(c:Context,id:string,digest:string,value:unknown){
 insist(c.session&&c.secret&&!c.actor.credential,'forbidden','A current signed-in person must authorize this restricted original.',403)
 const match=/^(\d{13})\.([a-f0-9]{64})$/.exec(String(value??'')),expires=Number(match?.[1]),now=Date.parse(c.now)
 insist(match&&expires>now&&expires<=now+LIFETIME,'download_authorization_required','Open a fresh restricted-original download from Documents or its record. Authorization expires after five minutes.',403)
 const signature=Uint8Array.from(match[2].match(/../g)!,x=>parseInt(x,16))
 insist(await crypto.subtle.verify('HMAC',await key(c),signature,payload(c,id,digest,expires)),'download_authorization_required','This restricted-original authorization belongs to another session or revision. Open a fresh download.',403)
}
