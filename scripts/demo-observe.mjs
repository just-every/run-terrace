// Read-only admission observation using the run-demo environment's token.
// No request bodies, cookies, IPs, query strings or tail credentials are saved.
import { readFileSync, mkdirSync, appendFileSync, writeFileSync } from 'node:fs'
const account = process.env.CLOUDFLARE_ACCOUNT_ID
if (account !== 'b20c0ca9cab0c2b70e13d7cf724b89bd') throw Error('Wrong demo account')
const project = JSON.parse(readFileSync('deploy.json')).project.split('/').at(-1)
const script = `${project}-demo-test--demo`
const endpoint = `https://api.cloudflare.com/client/v4/accounts/${account}/workers/scripts/${script}/tails`
const headers = { authorization: `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`, 'content-type': 'application/json' }
const response = await fetch(endpoint, { method: 'POST', headers, body: '{}' })
const value = await response.json()
if (!value.success) throw Error(`Could not open demo tail: ${response.status}`)
const tail = value.result, out = '.rer/demo-observation'
mkdirSync(out, { recursive: true })
const startedAt = Date.now(), admissions = []
const socket = new WebSocket(tail.url, 'trace-v1')
socket.binaryType = 'arraybuffer'
let ended = false, failure
socket.addEventListener('message', message => {
 const event = JSON.parse(typeof message.data === 'string' ? message.data : new TextDecoder().decode(message.data))
 for (const log of event.logs ?? []) for (const part of log.message ?? []) {
  let row
  try { row = typeof part === 'string' ? JSON.parse(part) : part } catch { continue }
  if (row?.event !== 'demo_admitted') continue
  // Base's admission record contains only correlation, timing and user-agent/network metadata.
  admissions.push(row)
  appendFileSync(`${out}/admissions.jsonl`, JSON.stringify(row) + '\n')
 }
})
try {
 await new Promise((resolve, reject) => {
  socket.addEventListener('open', resolve, { once: true })
  socket.addEventListener('error', () => reject(Error('Demo tail connection failed')), { once: true })
 })
 console.log('Observing test-host admissions for 15 minutes')
 await new Promise((resolve, reject) => {
  const timer = setTimeout(resolve, 15 * 60 * 1000)
  socket.addEventListener('close', () => { if (!ended) { clearTimeout(timer); reject(Error('Demo tail closed before observation finished')) } })
  socket.addEventListener('error', () => { clearTimeout(timer); reject(Error('Demo tail failed during observation')) })
 })
} catch (error) { failure = error.message }
finally {
 ended = true
 socket.close()
 const removed = await fetch(`${endpoint}/${tail.id}`, { method: 'DELETE', headers })
 if (!removed.ok) failure ??= 'Demo tail cleanup failed'
 const summary = { script, startedAt: new Date(startedAt).toISOString(), endedAt: new Date().toISOString(), admissions, complete: !failure, ...(failure ? { error: failure } : {}) }
 writeFileSync(`${out}/summary.json`, JSON.stringify(summary, null, 2) + '\n')
 console.log(JSON.stringify(summary))
}
if (failure) throw Error(failure)
// Undici can retain the tail socket after close; the completed record is durable.
process.exit(0)
