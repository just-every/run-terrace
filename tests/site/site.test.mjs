// The run site (run-terrace.com) as `rer build --site` writes it: a visitor reaches /run from the homepage's
// Run Terrace action and the docs from Read the docs, every link and file a page names resolves inside the site,
// no page links an instance-only route, and the homepage carries no local dev output.
import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join, relative } from 'node:path'

const root = new URL('../..', import.meta.url).pathname
const site = join(root, 'dist/site')
const pages = dir => readdirSync(dir, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? pages(join(dir, entry.name)) : entry.name.endsWith('.html') ? [join(dir, entry.name)] : [])
const served = path => [path, `${path}.html`, join(path, 'index.html')].some(candidate => existsSync(join(site, candidate)) && !candidate.endsWith('/'))
const attrs = (html, name) => [...html.matchAll(new RegExp(`\\s${name}="([^"]*)"`, 'g'))].map(match => match[1].replaceAll('&amp;', '&'))

test('OPEN-001 TER-012: the built run site, MIT product, ungated source and provider costs before deployment', () => {
  execFileSync(join(root, 'node_modules/.bin/rer'), ['build', '--site'], { cwd: root, stdio: 'pipe' })
  const home = readFileSync(join(site, 'index.html'), 'utf8')
  assert.match(home, /<a class="run-button" href="\/run">Run Terrace /, 'the homepage leads with Run Terrace to /run')
  assert.match(home, /href="\/docs">Read the docs</, 'the homepage links the docs')
  assert.doesNotMatch(home, /\b(?:127\.0\.0\.1|localhost|\[::1\]):\d+|\bRER_[A-Z_]+\b/, 'the homepage shows no local dev output')
  assert.ok(served('run') && served('docs'), '/run and /docs are built')
  const run = readFileSync(join(site, 'run.html'), 'utf8')
  assert.ok(run.replace(/<[^>]*>/g,'').includes('npx -y @runeditrun/rer dev just-every/run-terrace'), 'OPEN-001: /run publishes the usable one-command installation')
  assert.equal(JSON.parse(readFileSync(join(root, 'rer-project.json'))).license, 'MIT')
  const license = readFileSync(join(root, 'LICENSE'), 'utf8')
  assert.match(license, /MIT License/)
  for (const right of ['use', 'copy', 'modify', 'merge', 'publish', 'distribute', 'sublicense', 'sell']) assert.ok(license.includes(right), 'OPEN-001: MIT grants '+right)
  const sources = dir => readdirSync(dir, {withFileTypes:true}).flatMap(entry => entry.isDirectory() ? sources(join(dir,entry.name)) : /\.(?:[cm]?[jt]sx?|json)$/.test(entry.name) ? [join(dir,entry.name)] : [])
  for (const file of [...sources(join(root,'src')), ...sources(join(root,'scripts'))]) {
    assert.doesNotMatch(readFileSync(file,'utf8'), /\b(?:licenseKey|license_key|license-key|seatLimit|maxSeats|maxOwners|paywall|billingPortal)\b|upgrade (?:to (?:pro|premium)|your plan)/i, 'OPEN-001: no author commercial gate in '+relative(root,file))
  }
  // The public command enters the real deployment hook with no credentials.
  // It must disclose providers before validation/build/provisioning can proceed.
  const env = Object.fromEntries(['PATH','HOME','USER','TMPDIR'].filter(k=>process.env[k]).map(k=>[k,process.env[k]]))
  const deploy = spawnSync(join(root,'node_modules/.bin/rer'), ['deploy','--dry-run'], {cwd:root,env,encoding:'utf8'})
  if (deploy.error) throw deploy.error
  const output = deploy.stdout + deploy.stderr
  for (const provider of ['Cloudflare','Resend','https://developers.cloudflare.com/workers/platform/pricing/','https://resend.com/pricing']) assert.ok(output.includes(provider),'OPEN-001: pre-connection pricing '+provider)
  assert.match(readFileSync(join(site, 'docs/getting-started.html'), 'utf8'), /residential rentals only: it has no commercial leases, CAM reconciliation or homeowners’-association dues/, 'BOUND-004: the docs state the residential-only limit')
  for (const file of pages(site)) {
    const html = readFileSync(file, 'utf8'), where = relative(site, file)
    const refs = [...attrs(html, 'href'), ...attrs(html, 'src'), ...attrs(html, 'srcset').flatMap(set => set.split(',').map(part => part.trim().split(/\s+/)[0]))]
    for (const ref of refs.filter(ref => ref.startsWith('/') && !ref.startsWith('//'))) {
      const path = decodeURIComponent(ref.split(/[?#]/)[0])
      assert.doesNotMatch(path, /^\/(signin|login|sign-in|setup|app|auth|api)(\/|$)/, `${where} links the instance-only ${path}`)
      if (path !== '/') assert.ok(served(path), `${where} names ${path}, which the site does not serve`)
    }
  }
})
