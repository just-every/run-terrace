// OPEN-001: the credential-free public deployment door discloses provider costs.
// Run outside the emitted-app queue: the deploy probe enters its own queue.
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
const root = new URL('../..', import.meta.url).pathname

// The public command enters the real deployment hook with no credentials.
// It must disclose providers before validation/build/provisioning can proceed.
const env = Object.fromEntries(['PATH','HOME','USER','TMPDIR','RER_LOCAL_OPERATION'].filter(k=>process.env[k]).map(k=>[k,process.env[k]]))
const deploy = spawnSync(join(root,'node_modules/.bin/rer'), ['deploy','--dry-run'], {cwd:root,env,encoding:'utf8'})
if (deploy.error) throw deploy.error
const output = deploy.stdout + deploy.stderr
for (const provider of ['Cloudflare','Resend','https://developers.cloudflare.com/workers/platform/pricing/','https://resend.com/pricing']) assert.ok(output.includes(provider),'OPEN-001: pre-connection pricing '+provider)
console.log('OPEN-001 passed: provider costs before deployment')
