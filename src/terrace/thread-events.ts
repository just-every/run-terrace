import {id,policy,sql,type Context,type Row} from './core'
/** Retained operating evidence contains no reply body or attachment bytes. */
export function threadEvent(c:Context,r:Row,action:string,before:number,after:number,reason:string,source?:string){
 return sql(c,'INSERT INTO tt_thread_events(id,thread_id,action,actor,at,policy,source,reason,before_revision,after_revision,fingerprint) VALUES(?,?,?,?,?,?,?,?,?,?,?)',id(),r.id,action,c.actor.id,c.now,policy(c),source??c.source??r.consent_reference,reason,before,after,r.fingerprint)
}
