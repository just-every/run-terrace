// The run site (run-terrace.com) as `rer build --site` writes it: a visitor reaches /run from the homepage's
// Run Terrace action and the docs from Read the docs, every link and file a page names resolves inside the site,
// no page links an instance-only route, and the homepage carries no local dev output.
import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join, relative } from 'node:path'

const root = new URL('../..', import.meta.url).pathname
const site = join(root, 'dist/site')
const pages = dir => readdirSync(dir, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? pages(join(dir, entry.name)) : entry.name.endsWith('.html') ? [join(dir, entry.name)] : [])
const served = path => [path, `${path}.html`, join(path, 'index.html')].some(candidate => existsSync(join(site, candidate)) && !candidate.endsWith('/'))
const attrs = (html, name) => [...html.matchAll(new RegExp(`\\s${name}="([^"]*)"`, 'g'))].map(match => match[1].replaceAll('&amp;', '&'))

test('the run site builds, its actions open /run and /docs, and every link and file it names resolves', () => {
  execFileSync(join(root, 'node_modules/.bin/rer'), ['build', '--site'], { cwd: root, stdio: 'pipe' })
  const home = readFileSync(join(site, 'index.html'), 'utf8')
  assert.match(home, /<a class="run-button" href="\/run">Run Terrace /, 'the homepage leads with Run Terrace to /run')
  assert.match(home, /href="\/docs">Read the docs</, 'the homepage links the docs')
  assert.doesNotMatch(home, /\b(?:127\.0\.0\.1|localhost|\[::1\]):\d+|\bRER_[A-Z_]+\b/, 'the homepage shows no local dev output')
  assert.ok(served('run') && served('docs'), '/run and /docs are built')
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
