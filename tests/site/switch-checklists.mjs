import assert from 'node:assert/strict'
import { readFileSync, mkdtempSync, writeFileSync, mkdirSync, rmSync, cpSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { loadSwitchChecklist, renderSwitchChecklist, generateSwitchChecklist } from '../../scripts/switch-checklists.mjs'

const read = path => readFileSync(path, 'utf8')
const sourceDirectory = './docs/switch-checklist-sources/'
const names = { appfolio: 'AppFolio', buildium: 'Buildium', 'rent-manager': 'Rent Manager' }
// Separate from the replacement manifest: these source statements require these named gaps.
const requiredGaps = [
 ['af-accounting', /Bring your management company’s books|Bring your management company's books/, 'Corporate accounting'],
 ['rm-reports', /company’s finances/, 'Corporate accounting reports'],
 ['bu-company', /Track the books for your business/, 'Corporate accounting'],
 ['bu-telephone', /Answers all inbound service calls/, 'Telephone maintenance intake'],
 ['rm-telephone', /Call Center agents instantly add maintenance requests/, 'Telephone maintenance intake'],
 ['rm-maintenance', /device’s GPS/, 'Technician GPS'],
 ['rm-reports', /Send Report Batches based on a pre-determined schedule/, 'Scheduled reports'],
 ['af-vendor', /request estimates from multiple vendors/, 'Competing repair estimates'],
 ['rm-schedules', /automatically generates and delivers designated Report Batches/, 'Scheduled reports'],
 ['af-smart-blog', /make a quick call/, 'Telephone maintenance intake'],
 ['bu-automation', /Set up reports once and let them send themselves/, 'Scheduled reports'],
 ['bu-scheduled-help', /automate the creation and sharing of these report packets/, 'Scheduled reports'],
]
const sourceInventory = () => {
 const manifest = JSON.parse(read(sourceDirectory + 'manifest.json'))
 return { manifest, workflows: manifest.inventories.flatMap(item => JSON.parse(read(sourceDirectory + item.file)).workflows.map(workflow => ({ ...workflow, incumbent: item.incumbent }))) }
}

/** Independently reconcile source inventory records against public output, rather than trusting the renderer's row list. */
export function assertSwitchChecklistSite(html) {
 const { manifest, workflows } = sourceInventory()
 const plain = html.replace(/<[^>]*>/g, ' ').replaceAll('&amp;', '&').replaceAll('&#39;', "'").replace(/\s+/g, ' ')
 for (const incumbent of manifest.inventories) {
  assert.ok(plain.includes(names[incumbent.incumbent] + ' checklist'), 'public checklist for ' + incumbent.incumbent)
  assert.ok(plain.includes(incumbent.gap), 'incomplete source coverage stays visible')
 }
 const headings = [...html.matchAll(/<h4\b[^>]*>([\s\S]*?)<\/h4>/g)].map(match => match[1].replace(/<a\b[\s\S]*?<\/a>/g, '').replace(/<[^>]*>/g, '').trim())
 const headingPositions = [...html.matchAll(/<h4\b[^>]*>([\s\S]*?)<\/h4>/g)]
 assert.equal(headings.length, workflows.length, 'every inventoried source workflow renders exactly once')
 for (const workflow of workflows) {
  assert.equal(headings.filter(heading => heading.endsWith('· ' + workflow.id)).length, 1, 'rendered source workflow: ' + workflow.id)
  assert.ok(plain.includes(workflow.label), 'readable source capability: ' + workflow.id)
  const source = manifest.sources.find(item => item.id === workflow.source)
  assert.ok(html.includes('href="' + source.url + '"'), 'official source remains public')
  assert.ok(plain.includes(source.capturedOn) && plain.includes(source.rawSha256) && plain.includes(source.captureSha256), 'dated capture provenance remains visible')
  const at = headingPositions[headings.findIndex(heading => heading.endsWith('· ' + workflow.id))].index, end = html.indexOf('<h4', at + 1)
  const row = html.slice(at, end < 0 ? undefined : end)
  assert.ok(row.includes('href="' + source.url + '"') && row.includes(source.capturedOn) && row.includes('line ' + workflow.line + '.'), 'each rendered workflow retains its own located official source: ' + workflow.id)
  assert.match(row, /<strong>Gap:<\/strong>/, 'every unqualified workflow remains a named gap')
 }
 for (const [sourceId, documented, label] of requiredGaps) {
  const source = manifest.sources.find(item => item.id === sourceId)
  assert.ok(source, 'required official-source area remains inventoried: ' + sourceId)
  assert.match(read(sourceDirectory + source.capture), documented, 'independent official capture documents the workflow')
  const workflow = workflows.find(item => item.source === sourceId && item.label === label)
  assert.ok(workflow, 'documented named gap may not be deleted: ' + label)
  const at = headingPositions[headings.findIndex(heading => heading.endsWith('· ' + workflow.id))].index, end = html.indexOf('<h4', at + 1)
  const row = html.slice(at, end < 0 ? undefined : end)
  assert.match(row, /<strong>Gap:<\/strong>/, label + ' remains a gap')
  assert.doesNotMatch(row, /<strong>Covered/, 'a related done or boundary clause cannot establish replacement')
 }
 for (const area of manifest.unresolvedAreas) assert.ok(plain.includes(area.reason), 'unaudited source area cannot disappear')
 for (const index of manifest.discovery) {
  const id = names[index.incumbent].toLowerCase().replaceAll(' ', '-') + '-discovery-audit'
  const start = html.indexOf('id="' + id + '"')
  assert.ok(start > 0, 'each incumbent exposes its full discovery audit')
  const body = html.slice(html.indexOf('>', start) + 1).split(/<h[23]\b/)[0]
  const urls = read(sourceDirectory + index.capture).trim().split('\n')
  assert.equal([...body.matchAll(/<li>/g)].length, urls.length, 'every discovery URL renders independently of workflow mappings')
  for (const url of urls) {
   const row = [...body.matchAll(/<li>(.*?)<\/li>/g)].find(match => match[1].includes('href="' + url + '"'))?.[1]
   assert.ok(row, 'a discovered official source may not disappear: ' + url)
   const retained = manifest.sources.filter(source => source.incumbent === index.incumbent && [source.url, source.resolvedUrl].includes(url))
   assert.match(row, retained.length ? /<strong>partial<\/strong>/ : /<strong>unaudited<\/strong>/, 'retained captures never imply complete source coverage')
   for (const source of retained) assert.ok(row.includes('href="#' + source.id + '"'), 'discovery links to the actual captured source area')
  }
 }
 const areas = JSON.parse(read(sourceDirectory + 'source-areas.json')).sources
 for (const source of manifest.sources) {
  const audit = areas.find(item => item.source === source.id)
  assert.equal(audit.captureSha256, source.captureSha256, 'area review is bound to the retained source revision')
  for (const area of audit.areas.filter(item => item.review === 'unaudited')) assert.ok(plain.includes(`${source.id} lines ${area.from}–${area.to}`), 'unreconciled captured text stays visible independently of workflow mappings')
 }
 for (const incumbent of Object.keys(names)) {
  assert.ok(plain.includes(names[incumbent] + ' required named gaps'), 'every incumbent has an explicit required-capability assessment')
  for (const category of manifest.namedGaps.filter(item => item.incumbent === incumbent)) assert.ok(plain.includes(category.gap), 'unknown official-source coverage is disclosed rather than inferred absent')
 }
}

/** Run through the same write and check commands used by maintainers, plus invalid corpus and coverage inputs. */
export function assertSwitchChecklistIntegrity() {
 const data = loadSwitchChecklist()
 assert.equal(read('docs/switch-checklists.md'), renderSwitchChecklist(data), 'stale public output is refused')
 const { manifest, workflows } = sourceInventory()
 const mappings = JSON.parse(read('docs/switch-checklists.json'))
 const areaPath = sourceDirectory + 'source-areas.json', areas = JSON.parse(read(areaPath))
 const altered = (path, value) => ({ read: name => name === path ? JSON.stringify(value) : read(name) })
 const missing = structuredClone(mappings); missing.mappings = missing.mappings.filter(row => row.workflow !== workflows[0].id)
 assert.throws(() => loadSwitchChecklist(altered('docs/switch-checklists.json', missing)), /every inventoried source workflow/, 'deleting a replacement row cannot silently omit a source workflow')
 // Coordinated deletion in both inventories and replacement mappings still leaves the source review unsatisfied.
 const omitted = workflows[0], withoutSource = structuredClone(manifest), inventoryPath = sourceDirectory + manifest.inventories.find(item => item.incumbent === omitted.incumbent).file
 withoutSource.sources.find(item => item.id === omitted.source).workflows = withoutSource.sources.find(item => item.id === omitted.source).workflows.filter(id => id !== omitted.id)
 const withoutWorkflow = JSON.parse(read(inventoryPath)); withoutWorkflow.workflows = withoutWorkflow.workflows.filter(item => item.id !== omitted.id)
 const omissions = new Map([[sourceDirectory + 'manifest.json', withoutSource], [inventoryPath, withoutWorkflow], ['docs/switch-checklists.json', missing]])
 assert.throws(() => loadSwitchChecklist({ read: path => omissions.has(path) ? JSON.stringify(omissions.get(path)) : read(path) }), /source area workflow provenance mismatch/, 'a source area cannot silently disappear with its workflow and replacement mapping')
 const noAssessment = structuredClone(manifest); noAssessment.namedGaps.pop()
 assert.throws(() => loadSwitchChecklist(altered(sourceDirectory + 'manifest.json', noAssessment)), /every required named-gap assessment/, 'a required named gap cannot disappear with its replacement row')
 const noArea = structuredClone(areas); noArea.sources[0].areas.shift()
 assert.throws(() => loadSwitchChecklist(altered(areaPath, noArea)), /reconcile every captured line/, 'unreviewed source areas may not disappear')
 const staleArea = structuredClone(areas); staleArea.sources[0].captureSha256 = '0'.repeat(64)
 assert.throws(() => loadSwitchChecklist(altered(areaPath, staleArea)), /source area audit is stale/, 'review of an earlier source capture cannot qualify changed bytes')
 const discoveryPath = sourceDirectory + 'discovery-audit.json', discovery = JSON.parse(read(discoveryPath))
 const lostUrl = structuredClone(discovery); lostUrl.discoveries[0].urls.pop()
 assert.throws(() => loadSwitchChecklist(altered(discoveryPath, lostUrl)), /retain every captured URL/, 'an unreviewed discovered source cannot disappear')
 const staleDiscovery = structuredClone(discovery); staleDiscovery.discoveries[0].captureSha256 = '0'.repeat(64)
 assert.throws(() => loadSwitchChecklist(altered(discoveryPath, staleDiscovery)), /discovery audit is stale/, 'discovery audit is bound to its captured URL corpus')
 const wrongSource = structuredClone(discovery); wrongSource.discoveries[0].urls[0].sources = [manifest.sources[0].id]
 assert.throws(() => loadSwitchChecklist(altered(discoveryPath, wrongSource)), /actual retained sources/, 'an unrelated capture cannot audit a discovered URL')
 const falseAudit = structuredClone(discovery); falseAudit.discoveries[0].urls.find(item => item.sources.length === 0).review = 'partial'
 assert.throws(() => loadSwitchChecklist(altered(discoveryPath, falseAudit)), /complete discovery coverage/, 'a source without a capture cannot be promoted to reviewed')
 for (const [source, , label] of requiredGaps) {
  const inventory = manifest.inventories.find(item => workflows.find(workflow => workflow.source === source)?.incumbent === item.incumbent)
  const path = sourceDirectory + inventory.file, value = JSON.parse(read(path))
  value.workflows = value.workflows.filter(workflow => !(workflow.source === source && workflow.label === label))
  assert.throws(() => loadSwitchChecklist(altered(path, value)), /source-to-workflow reconciliation/, 'deleting a required named gap fails: ' + label)
 }
 const unknown = structuredClone(mappings); unknown.mappings[0].clauses = ['UNKNOWN-999']
 assert.throws(() => loadSwitchChecklist(altered('docs/switch-checklists.json', unknown)), /unknown clause/)
 const unsupported = structuredClone(mappings), staffQuote = unsupported.mappings.find(row => row.clauses.includes('WORK-003'))
 staffQuote.coverage = 'covered'
 assert.throws(() => loadSwitchChecklist(altered('docs/switch-checklists.json', unsupported)), /actor, public door, prerequisites and outcome/, 'staff-recorded quotes cannot qualify vendor pre-approval estimates')
 const absent = structuredClone(manifest); delete absent.sources[0].rawSha256
 assert.throws(() => loadSwitchChecklist(altered(sourceDirectory + 'manifest.json', absent)), /missing raw source hash/)
 const noRenderedSource = structuredClone(manifest); delete noRenderedSource.sources.find(item => item.captureMode === 'browser-rendered').renderedSha256
 assert.throws(() => loadSwitchChecklist(altered(sourceDirectory + 'manifest.json', noRenderedSource)), /missing rendered source hash/, 'a loading shell cannot stand in for a loaded official help article')
 const unlocated = JSON.parse(read(sourceDirectory + 'appfolio.json')); unlocated.workflows[0].line = 1
 assert.throws(() => loadSwitchChecklist(altered(sourceDirectory + 'appfolio.json', unlocated)), /missing provenance/)
 const corrupted = manifest.sources[0].capture
 assert.throws(() => loadSwitchChecklist({ read: path => read(path) + (path === sourceDirectory + corrupted ? 'changed' : '') }), /captured-source hash mismatch/)
 const boundary = structuredClone(mappings); boundary.mappings[0].clauses = ['BOUND-004']; boundary.mappings[0].coverage = 'covered'
 assert.throws(() => loadSwitchChecklist(altered('docs/switch-checklists.json', boundary)), /Covered needs/, 'a product boundary cannot replace corporate books')
 const importer = structuredClone(mappings); importer.mappings[0].clauses = ['TER-009']; importer.mappings[0].coverage = 'covered'
 assert.throws(() => loadSwitchChecklist(altered('docs/switch-checklists.json', importer)), /Covered needs/, 'a generic importer cannot replace an operating workflow')
 const directory = mkdtempSync(join(tmpdir(), 'terrace-switch-'))
 try {
  mkdirSync(join(directory, 'docs'))
  cpSync(sourceDirectory, join(directory, sourceDirectory), { recursive: true })
  for (const path of ['CONTRACT.md', 'docs/switch-checklists.json', 'docs/switch-checklists.md']) writeFileSync(join(directory, path), read(path))
  generateSwitchChecklist('check', { root: directory })
  writeFileSync(join(directory, 'docs/switch-checklists.md'), 'outdated public guide')
  assert.throws(() => generateSwitchChecklist('check', { root: directory }), /stale output/)
  generateSwitchChecklist('write', { root: directory }); generateSwitchChecklist('check', { root: directory })
  const contract = read('CONTRACT.md')
  const revised = contract.replace(/(^- \*\*WORK-003[^\n]*\*\*Acceptance evidence:\*\*)/m, '$1 Synthetic changed acceptance. ')
  assert.notEqual(revised, contract, 'acceptance source revision is exercised')
  writeFileSync(join(directory, 'CONTRACT.md'), revised)
  assert.throws(() => generateSwitchChecklist('check', { root: directory }), /stale output/, 'changed replacement acceptance invalidates generated proof provenance')
  generateSwitchChecklist('write', { root: directory })
  const demoted = revised.split('\n').map(line => { if (!line.startsWith('| `WORK-003` |')) return line; const cells = line.split('|'); cells[4] = ' partial '; cells[6] = ' Synthetic unqualified replacement acceptance. '; return cells.join('|') }).join('\n')
  const statusRows = demoted.split('\n').filter(line => /^\| `[A-Z][A-Z0-9-]*-\d+` \|/.test(line)).map(line => line.split('|').slice(1, -1).map(cell => cell.trim()))
  const counted = demoted.replace(/^\| (Published|Target and push further|All) \|.*$/gm, (_, label) => {
   const rows = statusRows.filter(row => label === 'All' || (label === 'Published' ? row[2] === 'published' : row[2] !== 'published'))
   return '| ' + label + ' | ' + ['done', 'partial', 'missing'].map(status => rows.filter(row => row[3] === status).length).concat(rows.length).join(' | ') + ' |'
  })
  writeFileSync(join(directory, 'CONTRACT.md'), counted)
  assert.throws(() => generateSwitchChecklist('check', { root: directory }), /stale output/, 'changed mapped clause status invalidates the public output')
  const afterDemotion = loadSwitchChecklist({ root: directory })
  assert.equal(afterDemotion.clauses.get('WORK-003').status, 'partial')
  assert.ok(afterDemotion.rows.filter(row => row.replacement.clauses.includes('WORK-003')).every(row => row.replacement.coverage === 'gap'), 'demoted or unsupported acceptance never becomes coverage')
 } finally { rmSync(directory, { recursive: true, force: true }) }
}

/** Assertions at desktop width; phone evidence reuses the existing one-width site smoke. */
export async function inspectSwitchChecklists(visitor, siteOrigin) {
 await visitor.getByRole('navigation', { name: 'Documentation guides' }).getByRole('link', { name: 'Switch checklists', exact: true }).click()
 await visitor.waitForURL(url => url.pathname === '/docs/switch-checklists')
 const { manifest, workflows } = sourceInventory()
 for (const inventory of manifest.inventories) {
  await visitor.getByRole('heading', { name: names[inventory.incumbent] + ' checklist' }).scrollIntoViewIfNeeded()
  const required = visitor.getByRole('heading', { name: names[inventory.incumbent] + ' required named gaps' })
  const assessments = await required.evaluate(element => {
   let text = '', next = element.nextElementSibling
   while (next && next.tagName !== 'H4') { text += next.textContent + ' '; next = next.nextElementSibling }
   return text
  })
  for (const name of ['Corporate accounting', 'Telephone maintenance intake', 'Technician GPS', 'Scheduled reports']) assert.ok(assessments.includes(name + ' — '), 'the public checklist exposes the required capability or its source-coverage uncertainty')
  const documented = manifest.namedGaps.filter(item => item.incumbent === inventory.incumbent && item.status === 'documented')
  for (const item of documented) {
   const id = item.workflows[0], workflow = workflows.find(row => row.id === id)
   await visitor.getByRole('link', { name: workflow.label + ' · ' + id, exact: true }).click()
   const target = visitor.getByRole('heading', { name: workflow.label + ' · ' + id })
   assert.equal(await target.evaluate(element => element.id === decodeURIComponent(location.hash.slice(1))), true, 'named gap links reach their sourced workflow row')
  }
  for (const workflow of workflows.filter(item => item.incumbent === inventory.incumbent)) {
   const heading = visitor.getByRole('heading', { name: workflow.label + ' · ' + workflow.id })
   assert.equal(await heading.count(), 1, workflow.id)
   assert.match(await heading.evaluate(element => element.nextElementSibling.textContent), /^Gap:/, 'each source workflow shows its replacement gap')
  }
  await visitor.getByRole('navigation', { name: 'On this page' }).getByRole('link', { name: names[inventory.incumbent] + ' discovery audit', exact: true }).click()
  const discovery = visitor.getByRole('heading', { name: names[inventory.incumbent] + ' discovery audit' })
  assert.equal(await discovery.evaluate(element => element.id === decodeURIComponent(location.hash.slice(1))), true, 'the public discovery audit is reachable through page navigation')
  assert.match(await discovery.evaluate(element => element.nextElementSibling.textContent), /URLs reconciled.*no retained source audit/, 'unaudited discovery sources stay visible')
 }
 await visitor.getByRole('heading', { name: 'Buildium checklist' }).scrollIntoViewIfNeeded()
 const permalink = visitor.getByRole('link', { name: 'Link to Buildium checklist', exact: true })
 await permalink.focus()
 assert.equal(await permalink.evaluate(element => getComputedStyle(element, '::after').opacity), '1', 'icon permalink tooltip appears on keyboard focus')
 await permalink.blur()
 await permalink.hover()
 await visitor.waitForTimeout(350)
 assert.equal(await permalink.evaluate(element => getComputedStyle(element, '::after').opacity), '1', 'permalink tooltip appears after hover delay')
 assert.ok(await visitor.locator('article').evaluate(element => [...element.querySelectorAll('p, li, h2, h3, h4')].every(node => parseFloat(getComputedStyle(node).fontSize) >= 13)), 'checklist text is readable')
 assert.ok(await visitor.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'desktop checklist fits')
 // Screens are opt-in artifacts only; all assertions above run unconditionally in push Verify.
 if (process.env.TERRACE_SWITCH_SCREENS) {
  const directory = process.env.TERRACE_SWITCH_SCREENS
  mkdirSync(directory, { recursive: true })
  for (const width of [1440, 390]) {
   await visitor.setViewportSize({ width, height: width === 1440 ? 900 : 844 })
   for (const name of Object.values(names)) {
    for (const [section, suffix] of [['required named gaps', 'gaps'], ['discovery audit', 'discovery']]) {
     await visitor.getByRole('heading', { name: name + ' ' + section, exact: true }).scrollIntoViewIfNeeded()
     await visitor.screenshot({ path: join(directory, name.toLowerCase().replaceAll(' ', '-') + '-' + suffix + '-' + width + '.png') })
    }
   }
  }
  await visitor.setViewportSize({ width: 1440, height: 900 })
 }
 const phoneSize = { width: 390, height: 844 }
 await visitor.setViewportSize(phoneSize)
 assert.ok(await visitor.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'phone checklist smoke: long sources and capture hashes wrap within the viewport')
 await visitor.setViewportSize({ width: 1440, height: 900 })
 for (const [point, inventory] of manifest.inventories.entries()) console.log(`PROBE MOVE-012 ${point + 1}: GET /docs/switch-checklists -> ${names[inventory.incumbent]} ${workflows.filter(workflow => workflow.incumbent === inventory.incumbent).length} sourced rows; complete inventory explicitly unqualified`)
 console.log('PROBE MOVE-012 4: built public inventory -> every inventoried workflow has a named Gap; unsupported boundary and partner workflows remain visible')
 console.log('PROBE MOVE-012 5: built corporate accounting rows -> AppFolio and Buildium corporate books and Rent Manager company reports remain gaps')
 console.log('PROBE MOVE-012 6: built telephone maintenance rows -> sourced AppFolio, Buildium and Rent Manager call intake remain named gaps')
 console.log('PROBE MOVE-012 7: built technician GPS row -> Rent Manager Service Tech Map remains a gap; association violations GPS remains separate')
 console.log('PROBE MOVE-012 8: built scheduled-report rows -> rendered Buildium scheduling and owner-portal delivery, and Rent Manager scheduled report batches remain sourced gaps; unaudited AppFolio and remaining help areas stay disclosed')
 await visitor.goto(siteOrigin + '/docs')
}
