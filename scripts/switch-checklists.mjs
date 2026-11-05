import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { parseContract } from '../src/base/seed-contract.mjs'

const sourceDirectory = 'docs/switch-checklist-sources/'
const output = 'docs/switch-checklists.md'
const names = { appfolio: 'AppFolio', buildium: 'Buildium', 'rent-manager': 'Rent Manager' }
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
 const mappings = JSON.parse(read('docs/switch-checklists.json')).mappings
 const contractSource = contractText ?? read('CONTRACT.md')
 // Summary counts are generated; the caller supplies a consistent contract when simulating a changed judgment.
 const contract = parseContract(contractSource)
 const clauses = new Map(contract.clauses.map(clause => [clause.id, { ...clause, evidenceText: contractSource.split('\n')[clause.row - 1].split('|')[5].trim() }]))
 sameSet(manifest.inventories.map(item => item.incumbent), Object.keys(names), 'all three separate incumbent inventories are required')
 need(manifest.complete === false, 'complete corpus coverage is not established')
 required(manifest.captureMethod, 'capture method')
 const sources = unique(manifest.sources, 'id', 'source ID')
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
 }
 for (const workflow of workflows.values()) need(sources.has(workflow.source), 'unknown source: ' + workflow.source)
 sameSet(manifest.discovery.map(item => item.incumbent), Object.keys(names), 'each incumbent needs a discovery register')
 for (const index of manifest.discovery) {
  const urls = capture(index).trim().split('\n')
  need(urls.length === index.urls && index.review === 'unaudited', 'discovery register reconciliation failed')
  required(index.gap, 'discovery uncertainty')
 }
 for (const area of manifest.unresolvedAreas) { need(names[area.incumbent], 'unknown unresolved incumbent'); required(area.area, 'unaudited area'); required(area.reason, 'unaudited reason') }
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
 }
 for (const inventory of inventories) {
  lines.push(`## ${inventory.name} checklist`, '', `**Partial official-source inventory. ${inventory.workflows.length} workflows; additional source areas remain unaudited.**`, '')
  for (const row of rows.filter(row => row.incumbent === inventory.incumbent)) {
   lines.push(`#### ${md(row.label)} · ${row.id}`, '', `**Gap:** ${md(row.replacement.gap)}`, '',
    `**Related replacements:** ${row.clauses.length ? row.clauses.map(clause => `[${clause.id}](#clause-${clause.id.toLowerCase()}) (${clause.status})`).join('; ') : 'Intentionally unmapped; no qualified Terrace replacement.'}`, '',
    `**Official source:** [${md(row.source.id)}](${row.source.url}), captured ${row.source.capturedOn}; section “${md(row.section)}”, [capture](switch-checklist-sources/${row.source.capture}) line ${row.line}.`, '',
    `> ${md(row.quote)}`, '')
  }
 }
 lines.push('## Captured source register', '')
 for (const source of manifest.sources) lines.push(`### ${source.id}`, '', `[Official page](${source.url})${source.url !== source.resolvedUrl ? ` → [resolved page](${source.resolvedUrl})` : ''}; captured ${source.capturedOn}, HTTP ${source.httpStatus}. [Retained normalized text](switch-checklist-sources/${source.capture}).`, '',
  `Raw SHA-256: \`${source.rawSha256}\`. Capture SHA-256: \`${source.captureSha256}\`.`, '', `**Audit: ${source.review}.** ${md(source.unaudited)} Reconciled source workflows: ${source.workflows.map(id => '\`' + id + '\`').join(', ')}.`, '')
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
