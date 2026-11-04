import {parseContract} from '../src/base/seed-contract.mjs'

const names = new Map([['appfolio', 'AppFolio'], ['buildium', 'Buildium'], ['rent-manager', 'Rent Manager']])
const hosts = new Map([['appfolio', 'appfolio.com'], ['buildium', 'buildium.com'], ['rent-manager', 'rentmanager.com']])
const text = (value, label) => {
 if (typeof value !== 'string' || !value.trim()) throw Error('Missing '+label)
 return value.trim()
}
const date = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0,10) === value
const normalized = value => value.replace(/\s+/g, ' ').trim()
const md = value => value.replace(/[<>]/g, c => c === '<' ? '&lt;' : '&gt;')
const actualReplacement = id => /^(PORT|LEASE|PAY|ACCT|PORTAL|WORK|REPORT)-/.test(id) || /^MOVE-(00[1-8]|010)$/.test(id)

/** Join curated incumbent functions to the authoritative contract; no stored coverage flags. */
export function switchChecklists(input, source) {
 if (input.schemaVersion !== 1 || !Array.isArray(input.incumbents)) throw Error('Invalid switch checklist source')
 const contract = parseContract(source), clauses = new Map(contract.clauses.map(c => [c.id,c]))
 const lines = source.split('\n'), seen = new Set()
 const incumbents = input.incumbents.map(incumbent => {
  if (!names.has(incumbent.id) || seen.has(incumbent.id) || incumbent.name !== names.get(incumbent.id)) throw Error('Unknown or duplicate incumbent')
  seen.add(incumbent.id)
  if (!Array.isArray(incumbent.sources) || !Array.isArray(incumbent.functions) || !incumbent.functions.length) throw Error('Empty incumbent checklist')
  const sources = new Map()
  for (const citation of incumbent.sources) {
   const id = text(citation.id,'citation id'), url = new URL(citation.url), host = hosts.get(incumbent.id)
   if (sources.has(id) || url.protocol !== 'https:' || url.username || url.password || !(url.hostname === host || url.hostname.endsWith('.'+host)) || !date(citation.reviewed)) throw Error('Invalid official documentation citation: '+id)
   text(citation.title,'citation title'); sources.set(id,citation)
  }
  const functionIds = new Set()
  const functions = incumbent.functions.map(fn => {
   const id = text(fn.id,'function id')
   if (!/^[a-z][a-z0-9-]*$/.test(id) || functionIds.has(id)) throw Error('Invalid or duplicate function id: '+id)
   functionIds.add(id); text(fn.name,'function name')
   if (!Array.isArray(fn.citations) || !fn.citations.length) throw Error('Missing function citation: '+id)
   const citations = fn.citations.map(citation => {
    if (!sources.has(citation.source)) throw Error('Unknown citation: '+citation.source)
    text(citation.section,'documentation section')
    return {...sources.get(citation.source), section:citation.section}
   })
   if (!Array.isArray(fn.replacements)) throw Error('Missing replacement mapping: '+id)
   if (!fn.replacements.length) text(fn.gap,'explicit unmapped function gap')
   const mapped = new Set()
   const replacements = fn.replacements.map(mapping => {
    const clause = clauses.get(mapping.clause)
    if (!clause) throw Error('Unknown replacement clause: '+mapping.clause)
    if (mapped.has(clause.id)) throw Error('Duplicate replacement clause: '+clause.id)
    mapped.add(clause.id)
    const acceptance = text(mapping.acceptance,'matching replacement acceptance')
    const matches = normalized(clause.text.split('**Acceptance evidence:**')[1] ?? '').includes(normalized(acceptance))
    const eligible = actualReplacement(clause.id)
    const passed = eligible && matches && clause.status === 'done' && clause.evidence.length > 0 && !clause.gap
    const evidence = lines[clause.row-1].split(/(?<!\\)\|/)[5].trim()
    return {id:clause.id, title:clause.title, status:clause.status, evidence, gap:clause.gap, acceptance, matches, eligible, passed}
   })
   // Context or a narrower implementation never silently becomes replacement coverage.
   const gaps = replacements.flatMap(r => [
    ...(!r.eligible ? [r.id+': boundary or generic importer only; no replacement acceptance.'] : []),
    ...(!r.matches ? [r.id+': mapped acceptance no longer matches CONTRACT.md.'] : []),
    ...(r.status !== 'done' ? [r.id+': '+r.status.toUpperCase()+'. '+r.gap] : []),
    ...(r.status === 'done' && r.gap ? [r.id+': '+r.gap] : []),
   ])
   if (fn.gap) gaps.push(fn.gap)
   const covered = replacements.length > 0 && replacements.every(r => r.passed) && !gaps.length
   const state = covered ? 'Covered' : !replacements.length ? 'Unsupported' : replacements.some(r => r.status === 'missing') ? 'Missing' : 'Partial'
   return {...fn, citations, replacements, gaps, covered, state}
  })
  return {...incumbent, functions}
 })
 if (seen.size !== names.size) throw Error('All three incumbent checklists are required')
 return {incumbents, contract}
}

export function renderSwitchChecklists(input, source) {
 const {incumbents} = switchChecklists(input,source)
 const output = [
  '# Switching to Terrace',
  'Generated from [the checklist source](switch-checklists.json) and [CONTRACT.md](../CONTRACT.md). Regenerate with `node scripts/contract-docs.mjs write`; `check` rejects stale output.',
  'These are function-by-function research checklists, not a qualified full switch. Public documentation describes available features; a customer’s plan, account, region and provider entitlements still need verification. Review dates below record when the cited documentation was read, not a provider qualification date.',
  'Covered means every named replacement acceptance excerpt still matches CONTRACT.md, every replacement is DONE with evidence and no Gap, and no function-specific gap remains. It applies only to that stated acceptance. A boundary clause or generic CSV importer proves no replacement coverage. Partial, missing and intentionally unmapped functions remain gaps. No checklist establishes authentic migration, a full operating month, settlement or permission to cut over payments.',
  'Each function links its official source and shows the current contract Status, Evidence and Gap. Evidence is the contract’s recorded proof, not a new incumbent qualification. Status changes require regeneration; the command refuses unknown clause IDs.',
 ]
 for (const incumbent of incumbents) {
  const covered = incumbent.functions.filter(fn => fn.covered).length
  output.push('## '+incumbent.name, `${covered} of ${incumbent.functions.length} documented functions have covered replacement acceptance; ${incumbent.functions.length-covered} remain gaps. Full switch: unqualified.`)
  for (const fn of incumbent.functions) {
   output.push('### '+fn.name, '**'+fn.state+'**'+(fn.covered ? ' — mapped replacement acceptance passed.' : ' — gap remains.'))
   output.push('Official documentation: '+fn.citations.map(c => `[${md(c.title)}](${c.url}) — ${md(c.section)}; reviewed ${c.reviewed}`).join('; ')+'.')
   if (!fn.replacements.length) output.push('Replacement: intentionally unmapped. Status: unsupported. Evidence: none. Gap: '+md(fn.gap))
   for (const r of fn.replacements) {
    output.push(`- [${r.id}](../CONTRACT.md) — **${r.status.toUpperCase()}**: ${md(r.title)}. ${r.eligible ? (r.matches ? 'Matching acceptance' : 'Unmatched acceptance') : 'Context only'}: “${md(r.acceptance)}”\n  - Evidence: ${md(r.evidence) || 'None recorded.'}\n  - Gap: ${md(r.gap) || 'None in the contract row.'}`)
   }
   if (fn.gaps.length) output.push('**Uncovered:** '+fn.gaps.map(md).join(' '))
  }
 }
 output.push('## What remains before a complete switch',
  'Authentic redacted books of a 50-unit portfolio from each incumbent, source-specific importers and reconciliation, remaining MOVE-001 and MOVE-010 completeness, authentic shadow-cycle qualification and MOVE-008 payment cutover remain owed. Synthetic fixtures and the tenancy CSV establish none of these.',
  'A complete operating month through leasing, applications, screening, electronic signatures, ACH, card and cash collection, autopay and fees, trust and deposit accounting, vendor and owner payouts, 1099s, resident, owner and vendor portals, repair-to-matched-invoice closure, owner statements and three-way bank reconciliation remains unqualified.',
  'Terrace counsel engagement and counsel-reviewed PORT-008 authored pack and template contents, authorized provider accounts, scopes, entitlements and settlement proof remain outstanding. Existing account, CT, Base and device holds are unchanged. This checklist grants no execution authority.')
 return output.join('\n\n')+'\n'
}
