import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { parseContract } from '../src/base/seed-contract.mjs'

const sourceDirectory = './docs/switch-checklist-sources/'
const output = 'docs/switch-checklists.md'
const names = { appfolio: 'AppFolio', buildium: 'Buildium', 'rent-manager': 'Rent Manager' }
const gapNames = { corporate: 'Corporate accounting', telephone: 'Telephone maintenance intake', gps: 'Technician GPS', reports: 'Scheduled reports' }
const hosts = { appfolio: ['www.appfolio.com'], buildium: ['www.buildium.com', 'help.buildium.com'], 'rent-manager': ['www.rentmanager.com'] }
const hash = value => createHash('sha256').update(value).digest('hex')
const fail = message => { throw Error('Switch checklist: ' + message) }
const need = (condition, message) => { if (!condition) fail(message) }
const required = (value, label) => need(typeof value === 'string' && value.trim(), 'missing ' + label)
const unique = (items, key, label) => {
 const map = new Map()
 for (const item of items) { required(item[key], label); need(!map.has(item[key]), 'duplicate ' + label + ': ' + item[key]); map.set(item[key], item) }
 return map
}
const md = text => String(text).replace(/[<>]/g, '').replace(/[\[\]*_`]/g, '\\$&').replace(/\|/g, '\\|').replace(/\s+/g, ' ').trim()
const safeProse = text => text.split(/(`[^`]*`|\[[^\]]*\]\([^)]*\))/g).map((part, index) => index % 2 ? part : part.replace(/(?<![\w:/.-])([A-Za-z][\w-]*)\/([A-Za-z][\w-]*)(?![\w/.])/g, '$1 and $2')).join('')
const official = (url, incumbent) => {
 let parsed; try { parsed = new URL(url) } catch { fail('invalid official URL') }
 need(parsed.protocol === 'https:' && hosts[incumbent]?.includes(parsed.hostname) && !parsed.username && !parsed.password && !parsed.search, 'unofficial source URL: ' + url)
}
const sameSet = (actual, expected, label) => need(actual.length === expected.length && new Set(actual).size === actual.length && actual.every(id => expected.includes(id)), label)

/** Read the source corpus independently of replacement mappings. Never infer an absent workflow from an unaudited area. */
export function loadSwitchChecklist({ root = process.cwd(), contractText, read = path => readFileSync(resolve(root, path), 'utf8') } = {}) {
 const manifest = JSON.parse(read(sourceDirectory + 'manifest.json'))
 const audits = unique(JSON.parse(read(sourceDirectory + 'source-areas.json')).sources, 'source', 'source area audit')
 const discoveries = unique(JSON.parse(read(sourceDirectory + 'discovery-audit.json')).discoveries, 'incumbent', 'discovery audit')
 const mappings = JSON.parse(read('docs/switch-checklists.json')).mappings
 const contractSource = contractText ?? read('CONTRACT.md')
 // Summary counts are generated; the caller supplies a consistent contract when simulating a changed judgment.
 const contract = parseContract(contractSource)
 const clauses = new Map(contract.clauses.map(clause => [clause.id, { ...clause, evidenceText: contractSource.split('\n')[clause.row - 1].split('|')[5].trim() }]))
 sameSet(manifest.inventories.map(item => item.incumbent), Object.keys(names), 'all three separate incumbent inventories are required')
 need(manifest.complete === false, 'complete corpus coverage is not established')
 required(manifest.captureMethod, 'capture method')
 const sources = unique(manifest.sources, 'id', 'source ID')
 sameSet([...audits.keys()], [...sources.keys()], 'every captured source needs a source area audit')
 const inventories = manifest.inventories.map(inventory => {
  need(inventory.complete === false, 'inventory completeness is unqualified: ' + inventory.incumbent)
  required(inventory.gap, 'inventory uncertainty')
  need(/^[a-z-]+\.json$/.test(inventory.file), 'invalid inventory file')
  const data = JSON.parse(read(sourceDirectory + inventory.file))
  need(data.incumbent === inventory.incumbent, 'inventory belongs to another incumbent')
  need(data.workflows.length > 0, 'empty incumbent inventory')
  return { ...inventory, name: names[inventory.incumbent], workflows: data.workflows }
 })
 const workflows = unique(inventories.flatMap(inventory => inventory.workflows.map(workflow => ({ ...workflow, incumbent: inventory.incumbent }))), 'id', 'workflow ID')
 const capture = source => {
  official(source.url, source.incumbent)
  if (source.resolvedUrl) official(source.resolvedUrl, source.incumbent)
  need(/^\d{4}-\d{2}-\d{2}$/.test(source.capturedOn), 'missing capture date')
  need(/^[a-f0-9]{64}$/.test(source.rawSha256), 'missing raw source hash')
  need(!source.captureMode || ['http-response', 'browser-rendered'].includes(source.captureMode), 'unknown source capture mode')
  if (source.captureMode === 'browser-rendered') need(/^[a-f0-9]{64}$/.test(source.renderedSha256), 'missing rendered source hash')
  need(/^[a-z-]+\.txt$/.test(source.capture), 'invalid source capture path')
  const bytes = read(sourceDirectory + source.capture)
  need(hash(bytes) === source.captureSha256, 'captured-source hash mismatch: ' + source.capture)
  return bytes
 }
 for (const source of sources.values()) {
  need(source.httpStatus === 200 && ['partial', 'unaudited'].includes(source.review), 'source review must disclose its limited audit')
  required(source.unaudited, 'unaudited source areas')
  const lines = capture(source).split('\n')
  const selected = [...workflows.values()].filter(workflow => workflow.source === source.id)
  need(source.review !== 'unaudited' || selected.length === 0, 'unaudited source cannot establish verified workflows')
  sameSet(source.workflows, selected.map(workflow => workflow.id), 'source-to-workflow reconciliation failed: ' + source.id)
  for (const workflow of selected) {
   need(workflow.incumbent === source.incumbent, 'cross-incumbent source')
   required(workflow.label, 'workflow name'); required(workflow.section, 'page section'); required(workflow.quote, 'captured quotation')
   need(Number.isInteger(workflow.line) && workflow.line > 0 && lines[workflow.line - 1] === workflow.quote, 'missing provenance at captured source line: ' + workflow.id)
  }
  // Partition the retained capture, separately from the replacement mappings. Gaps in review may not disappear with a row.
  const audit = audits.get(source.id), assigned = []
  need(audit.captureSha256 === source.captureSha256, 'source area audit is stale for captured bytes: ' + source.id)
  let next = 1
  for (const area of audit.areas) {
   need(Number.isInteger(area.from) && Number.isInteger(area.to) && area.from === next && area.to >= area.from && area.to <= lines.length - 1, 'source area audit must reconcile every captured line without overlap: ' + source.id)
   need(['workflows', 'unaudited', 'context'].includes(area.review), 'invalid source area review')
   required(area.section, 'source area section'); required(area.note, 'source area explanation')
   need(Array.isArray(area.workflows), 'missing source area workflows')
   need(area.review === 'workflows' ? area.workflows.length > 0 : area.workflows.length === 0, 'source area review disagrees with its workflows')
   for (const id of area.workflows) {
    const workflow = workflows.get(id)
    need(workflow?.source === source.id && workflow.line >= area.from && workflow.line <= area.to, 'source area workflow provenance mismatch: ' + id)
    assigned.push(id)
   }
   next = area.to + 1
  }
  need(next === lines.length, 'source area audit omits captured lines: ' + source.id)
  sameSet(assigned, source.workflows, 'source area workflow reconciliation failed: ' + source.id)
  source.areas = audit.areas
 }
 for (const workflow of workflows.values()) need(sources.has(workflow.source), 'unknown source: ' + workflow.source)
 sameSet(manifest.discovery.map(item => item.incumbent), Object.keys(names), 'each incumbent needs a discovery register')
 sameSet([...discoveries.keys()], Object.keys(names), 'each incumbent needs an independent discovery audit')
 for (const index of manifest.discovery) {
  const urls = capture(index).trim().split('\n')
  need(urls.length === index.urls && index.review === 'unaudited', 'discovery register reconciliation failed')
  required(index.gap, 'discovery uncertainty')
  const audit = discoveries.get(index.incumbent)
  need(audit.captureSha256 === index.captureSha256, 'discovery audit is stale for captured URLs: ' + index.incumbent)
  sameSet(audit.urls.map(item => item.url), urls, 'discovery audit must retain every captured URL exactly once: ' + index.incumbent)
  for (const item of audit.urls) {
   official(item.url, index.incumbent)
   const retained = [...sources.values()].filter(source => source.incumbent === index.incumbent && [source.url, source.resolvedUrl].includes(item.url)).map(source => source.id)
   need(Array.isArray(item.sources), 'discovery source references missing')
   sameSet(item.sources, retained, 'discovery URL must reconcile to its actual retained sources: ' + item.url)
   need(item.review === (retained.length ? 'partial' : 'unaudited'), 'a captured page cannot establish complete discovery coverage')
  }
  index.areas = audit.urls
 }
 for (const area of manifest.unresolvedAreas) { need(names[area.incumbent], 'unknown unresolved incumbent'); required(area.area, 'unaudited area'); required(area.reason, 'unaudited reason') }
 sameSet(manifest.namedGaps.map(item => item.incumbent + ':' + item.category), Object.keys(names).flatMap(incumbent => Object.keys(gapNames).map(category => incumbent + ':' + category)), 'each incumbent needs every required named-gap assessment')
 for (const item of manifest.namedGaps) {
  required(item.gap, 'named-gap assessment')
  need(['documented', 'unqualified'].includes(item.status) && Array.isArray(item.workflows), 'invalid named-gap assessment')
  need(item.status === 'documented' ? item.workflows.length > 0 : item.workflows.length === 0, 'named-gap provenance required')
  sameSet(item.workflows, [...new Set(item.workflows)], 'duplicate named-gap workflow')
  for (const id of item.workflows) need(workflows.get(id)?.incumbent === item.incumbent, 'named-gap source workflow missing: ' + id)
 }
 const mapping = unique(mappings, 'workflow', 'replacement workflow')
 sameSet([...mapping.keys()], [...workflows.keys()], 'every inventoried source workflow needs exactly one rendered replacement or named gap')
 const rows = [...workflows.values()].map(workflow => {
  const replacement = mapping.get(workflow.id)
  required(replacement.gap, 'named gap for ' + workflow.id)
  need(Array.isArray(replacement.clauses), 'replacement clauses missing')
  const mapped = replacement.clauses.map(id => { need(clauses.has(id), 'unknown clause: ' + id); return clauses.get(id) })
  // This inventory has no qualified same-capability acceptance receipts. DONE, a boundary, a partner or an importer alone never qualifies.
  need(replacement.coverage === 'gap' && !replacement.proof, 'Covered needs current passed acceptance matching actor, public door, prerequisites and outcome: ' + workflow.id)
  return { ...workflow, source: sources.get(workflow.source), replacement, clauses: mapped }
 })
 return { manifest, inventories, rows, clauses }
}

export function renderSwitchChecklist(data) {
 const { manifest, inventories, rows } = data
 const lines = ['# Incumbent switch checklists', '',
  'These separate inventories record verified workflows in selected official sources. **Inventory coverage is incomplete for all three incumbents.** Other documented workflows may be omitted. Sampled pages, a sitemap, partner referrals and Terrace product boundaries cannot establish completeness.', '',
  'Every inventoried workflow below remains a **Gap** until current passed replacement acceptance proves its actor, public door, prerequisites and outcome. A related DONE clause, generic CSV importer, staff-recorded substitute or boundary statement alone does not establish replacement. This page grants no migration, payment, provider or operational authority.', '',
  'The [source-corpus manifest](switch-checklist-sources/manifest.json) retains separate inventories, captured-source hashes, source-to-workflow reconciliation and unaudited source areas. Source quotations are documentary claims by the incumbent; they establish no Terrace capability or provider entitlement.', '',
  '## Corpus coverage and uncertainty', '', md(manifest.captureMethod), '']
 for (const inventory of inventories) {
  const index = manifest.discovery.find(item => item.incumbent === inventory.incumbent)
  lines.push(`### ${inventory.name} source coverage`, '', `**Incomplete inventory:** ${md(inventory.gap)}`, '',
   `${inventory.workflows.length} inventoried workflows from ${manifest.sources.filter(source => source.incumbent === inventory.incumbent && source.review === 'partial').length} partially audited pages; ${manifest.sources.filter(source => source.incumbent === inventory.incumbent && source.review === 'unaudited').length} unaudited captures. [Discovery register](switch-checklist-sources/${index.capture}): ${index.urls} URLs, captured ${index.capturedOn}; all unselected entries remain unaudited. ${md(index.gap)}`, '',
   `Discovery raw SHA-256: \`${index.rawSha256}\`. Retained register SHA-256: \`${index.captureSha256}\`.`, '')
  for (const area of manifest.unresolvedAreas.filter(area => area.incumbent === inventory.incumbent)) lines.push(`**Unaudited area — ${md(area.area)}:** ${md(area.reason)}${area.url ? ` [Official source area](${area.url})` : ''}`, '')
  const pendingAreas = manifest.sources.filter(source => source.incumbent === inventory.incumbent).flatMap(source => source.areas.filter(area => area.review === 'unaudited'))
  lines.push(`**Captured source areas awaiting review:** ${pendingAreas.length} unreconciled ranges. [Inspect the source area register](#captured-source-register) for every range and its retained context.`, '')
 }
 for (const inventory of inventories) {
  lines.push(`## ${inventory.name} checklist`, '', `**Partial official-source inventory. ${inventory.workflows.length} workflows; additional source areas remain unaudited.**`, '')
  lines.push(`### ${inventory.name} required named gaps`, '')
  for (const item of manifest.namedGaps.filter(item => item.incumbent === inventory.incumbent)) {
   lines.push(`**${gapNames[item.category]} — ${item.status === 'documented' ? 'Gap' : 'Unqualified source coverage'}:** ${md(item.gap)}`, '')
   for (const id of item.workflows) {
    const row = rows.find(row => row.id === id)
    lines.push(`Documented in [${md(row.label)} · ${row.id}](#${md(row.label + ' ' + row.id).normalize('NFKD').toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, '').trim().replace(/\s+/g, '-')}) — [official source](${row.source.url}), captured ${row.source.capturedOn}, section “${md(row.section)}”, line ${row.line}.`, '')
   }
  }
  for (const row of rows.filter(row => row.incumbent === inventory.incumbent)) {
   lines.push(`#### ${md(row.label)} · ${row.id}`, '', `**Gap:** ${md(row.replacement.gap)}`, '',
    `**Related replacements:** ${row.clauses.length ? row.clauses.map(clause => `[${clause.id}](#clause-${clause.id.toLowerCase()}) (${clause.status})`).join('; ') : 'Intentionally unmapped; no qualified Terrace replacement.'}`, '',
    `**Official source:** [${md(row.source.id)}](${row.source.url}), captured ${row.source.capturedOn}; section “${md(row.section)}”, [capture](switch-checklist-sources/${row.source.capture}) line ${row.line}.`, '',
    `> ${md(row.quote)}`, '')
  }
 }
 lines.push('## Discovery audit register', '', 'Every URL in each retained discovery capture is accounted for below, including pages outside Terrace product boundaries. A partially audited capture qualifies only its inventoried quotations; every other URL remains unaudited. Discovery is itself incomplete: omitted indexes, nested links and authenticated documentation remain open.', '')
 for (const index of manifest.discovery) {
  lines.push(`### ${names[index.incumbent]} discovery audit`, '', `[Capture-bound discovery audit](switch-checklist-sources/discovery-audit.json): ${index.areas.length} URLs reconciled; ${index.areas.filter(area => area.review === 'unaudited').length} have no retained source audit.`, '')
  for (const area of index.areas) lines.push(`- [${md(area.url)}](${area.url}) — **${area.review}**.${area.sources.length ? ' Retained source areas: ' + area.sources.map(id => `[${id}](#${id})`).join(', ') + '; surrounding and linked documentation remains unqualified.' : ' No workflow absence or replacement is inferred.'}`)
  lines.push('')
 }
 lines.push('## Captured source register', '')
 for (const source of manifest.sources) {
  lines.push(`### ${source.id}`, '', `[Official page](${source.url})${source.url !== source.resolvedUrl ? ` → [resolved page](${source.resolvedUrl})` : ''}; captured ${source.capturedOn}, HTTP ${source.httpStatus}. [Retained normalized text](switch-checklist-sources/${source.capture}).`, '',
  `Raw SHA-256: \`${source.rawSha256}\`. Capture SHA-256: \`${source.captureSha256}\`.`, '', `**Audit: ${source.review}.** ${md(source.unaudited)} Reconciled source workflows: ${source.workflows.map(id => '\`' + id + '\`').join(', ')}.`, '')
  if (source.captureMode === 'browser-rendered') lines.push(`**Browser-rendered source:** the initial HTTP response is a loading shell; the retained text was read after the official article loaded in a clean browser. Rendered document SHA-256: \`${source.renderedSha256}\`.`, '')
  lines.push('**Source area reconciliation:** [review register](switch-checklist-sources/source-areas.json). Each retained line belongs to exactly one area; workflow references reconcile independently of replacement mappings. A reviewed quotation does not audit the surrounding page or linked manuals.', '')
  for (const area of source.areas) lines.push(`- ${md(source.id)} lines ${area.from}–${area.to}, ${md(area.section)}: **${area.review}**. ${md(area.note)}${area.workflows.length ? ' Workflows: ' + area.workflows.map(id => '\`' + id + '\`').join(', ') + '.' : ''}`)
  lines.push('')
 }
 lines.push('## Current Terrace replacement evidence', '', 'The following statuses, acceptance fingerprints, Evidence and Gap cells come directly from CONTRACT.md. They describe the related Terrace work, not complete incumbent replacement.', '')
 const used = [...new Set(rows.flatMap(row => row.clauses.map(clause => clause.id)))].sort()
 for (const id of used) {
  const clause = data.clauses.get(id)
  lines.push(`### Clause ${id}`, '', `**${md(clause.title)} — ${clause.status}.**`, '', `**Evidence:** ${safeProse(clause.evidenceText || 'No executed evidence.')}`, '', `**Remaining clause gap:** ${safeProse(clause.gap || 'None in the clause; same-capability checklist qualification still required.')}`, '', `Acceptance source SHA-256: \`${hash(clause.text)}\`.`, '')
 }
 return lines.join('\n') + '\n'
}

export function generateSwitchChecklist(mode, options) {
 need(['write', 'check'].includes(mode), 'use write or check')
 const root = options?.root ?? process.cwd(), bytes = renderSwitchChecklist(loadSwitchChecklist(options))
 if (mode === 'write') writeFileSync(resolve(root, output), bytes)
 else need(readFileSync(resolve(root, output), 'utf8') === bytes, 'stale output: ' + output)
 return bytes
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
 generateSwitchChecklist(process.argv[2]); console.log('Switch checklist ' + process.argv[2] + ': source workflows reconciled; inventory coverage remains incomplete.')
}
