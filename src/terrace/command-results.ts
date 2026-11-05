import { escape as e, one, sql, type Context, type Row } from './core'

export type CommandResult = { notice: string; result?: Row; error?: boolean; command?: string; values?: Row }
/** Browser display state is private to the live sign-in, never authoritative command input. */
export async function redirectResult(c: Context, destination: URL, payload: CommandResult) {
 const key = [...crypto.getRandomValues(new Uint8Array(24))].map(n => n.toString(16).padStart(2, '0')).join('')
 await c.db.batch([
  sql(c, 'DELETE FROM tt_command_results WHERE expires_at<?', c.now),
  sql(c, 'INSERT INTO tt_command_results(id,session_hash,actor_id,payload,expires_at) VALUES(?,?,?,?,?)', key, c.session!.hash, c.actor.id, JSON.stringify(payload), new Date(Date.parse(c.now) + 30 * 60000).toISOString()),
 ])
 destination.searchParams.delete('notice')
 destination.searchParams.set('result', key)
 return new Response(null, { status:303, headers:{location:destination.pathname + destination.search,'cache-control':'no-store','referrer-policy':'no-referrer'} })
}
export async function readResult(c: Context, key: string | null): Promise<CommandResult | undefined> {
 if (!key || !/^[a-f0-9]{48}$/.test(key)) return
 const row = await one(c, 'SELECT payload FROM tt_command_results WHERE id=? AND actor_id=? AND session_hash=? AND expires_at>?', key, c.actor.id, c.session!.hash, c.now)
 return row ? JSON.parse(row.payload) : {notice:'This result has expired. Review the current records before submitting again.',error:true}
}
/** Files and secret-bearing fields must be supplied again, never saved as browser display state. */
export function formValues(values: Row): Row {
 return Object.fromEntries(Object.entries(values).filter(([name, value]) => typeof value === 'string' && !/secret|token|password|code|confirm|consent|authorization|fingerprint|sha256/i.test(name)))
}
const attr = (tag: string, name: string) => new RegExp(`\\b${name}="([^"]*)"`).exec(tag)?.[1]
/** Restore only the submitted form, leaving every other form and its authoritative hidden fields intact. */
export function restoreForm(body: string, state: CommandResult) {
 if (!state.command || !state.values) return body
 return body.replace(/<form\b[^>]*>[\s\S]*?<\/form>/g, form => {
  if (!form.includes(`name="command" value="${e(state.command)}"`)) return form
  const values = state.values!
  for(const name of ['tenancyId','jobId','inspectionId','requestId','proposalId','holdId']){
   const current=new RegExp(`name="${name}" value="([^"]*)"`).exec(form)?.[1]
   if(current!==undefined&&values[name]!==undefined&&current!==e(values[name]))return form
  }
  form = form.replace(/<input\b[^>]*>/g, tag => {
   const name = attr(tag, 'name'), type = attr(tag, 'type')
   if (!name || !Object.hasOwn(values, name) || ['hidden','file','password','checkbox','radio'].includes(type ?? '')) return tag
   return tag.replace(/\svalue="[^"]*"/g, '').replace(/>$/, ` value="${e(values[name])}">`)
  }).replace(/(<textarea\b[^>]*>)[\s\S]*?(<\/textarea>)/g, (tag, start, end) => {
   const name = attr(start, 'name')
   return name && Object.hasOwn(values, name) ? start + e(values[name]) + end : tag
  }).replace(/(<select\b[^>]*>)([\s\S]*?)(<\/select>)/g, (tag, start, options, end) => {
   const name = attr(start, 'name')
   if (!name || !Object.hasOwn(values, name)) return tag
   return start + options.replace(/<option\b[^>]*>/g, (option: string) => option.replace(/\sselected(?:="[^"]*")?/g, '').replace(/>$/, attr(option, 'value') === e(values[name]) ? ' selected>' : '>')) + end
  })
  return form.replace(/<form\b[^>]*>/, start => `${start}<p class="notice error" role="alert">${e(state.notice)}</p>`)
 })
}
