import assert from 'node:assert/strict'
import {copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs'
import {spawnSync} from 'node:child_process'
import {tmpdir} from 'node:os'
import {dirname, join} from 'node:path'
import {parseContract} from '../../src/base/seed-contract.mjs'

const root = new URL('../..',import.meta.url).pathname
const manifestPath = 'docs/switch-checklists.json', outputPath = 'docs/switch-checklists.md'
const read = path => readFileSync(join(root,path),'utf8')

// Invoked by assertRunSite in the existing emitted-app journey, never a separate build.
export function assertSwitchChecklists() {
 const source = read('CONTRACT.md'), manifest = JSON.parse(read(manifestPath))
 const directory = mkdtempSync(join(tmpdir(),'terrace-switch-checklists-'))
 try {
  for (const path of ['scripts/contract-docs.mjs','scripts/switch-checklists.mjs','src/base/seed-contract.mjs','CONTRACT.md','ACCEPTANCE.md','docs/CLAIMS.md',manifestPath,outputPath]) {
   mkdirSync(dirname(join(directory,path)),{recursive:true});copyFileSync(join(root,path),join(directory,path))
  }
  const write = (path,bytes) => writeFileSync(join(directory,path),bytes)
  const run = (mode, error) => {
   const result = spawnSync(process.execPath,['scripts/contract-docs.mjs',mode],{cwd:directory,encoding:'utf8',timeout:30000})
   if (result.error) throw result.error
   const output = result.stdout+result.stderr
   if (error) {assert.notEqual(result.status,0,'the public command must reject invalid or stale input');assert.match(output,error)}
   else assert.equal(result.status,0,output)
  }
  run('write');run('check')
  assert.equal(readFileSync(join(directory,outputPath),'utf8'),read(outputPath),'committed public checklist matches current contract and citations')
  const html = read('dist/site/docs/switch-checklists.html'), projected = read(outputPath)
  assert.match(read('dist/site/docs.html'),/href="\/docs\/switch-checklists"/,'the public docs index links the built checklist')
  for (const incumbent of manifest.incumbents) {
   const checklist=projected.split('## '+incumbent.name+'\n\n')[1].split('\n## ')[0]
   for (const fn of incumbent.functions) {
    const functionText=checklist.split('### '+fn.name+'\n\n')[1]?.split('\n### ')[0]
    assert.ok(functionText,'each researched function stays in its incumbent checklist')
    assert.ok(html.includes(fn.name.replaceAll('&','&amp;')),'the built checklist retains each researched function: '+fn.name)
    for (const ref of fn.citations) {
     const citation=incumbent.sources.find(c=>c.id===ref.source)
     assert.ok(html.includes(citation.url.replaceAll('&','&amp;')),'the function has a public official citation')
     assert.ok(functionText.includes(citation.url) && functionText.includes(citation.reviewed) && functionText.includes(ref.section),'each function retains its own dated official citation')
    }
    if (!fn.replacements.length) {
     assert.ok(fn.gap && html.includes(fn.gap),'an unsupported function stays visible with its explicit gap')
    }
    if (fn.gap) {
     assert.ok(functionText.includes('**Uncovered:**') && functionText.includes(fn.gap),'every function-specific gap stays explicit')
     assert.ok(!functionText.startsWith('**Covered**'),'a documented function gap cannot read as covered')
    }
   }
  }
  const save = value => write(manifestPath,JSON.stringify(value,null,2)+'\n')
  const invalid = structuredClone(manifest)
  invalid.incumbents[0].functions[0].replacements[0].clause='UNKNOWN-999'
  save(invalid);run('write',/Unknown replacement clause: UNKNOWN-999/)
  const uncited = structuredClone(manifest)
  uncited.incumbents[0].functions[0].citations=[]
  save(uncited);run('write',/Missing function citation/)
  const unofficial = structuredClone(manifest)
  unofficial.incumbents[0].sources[0].url='https://example.test/unverified'
  save(unofficial);run('write',/Invalid official documentation citation/)
  const undated = structuredClone(manifest)
  undated.incumbents[0].sources[0].reviewed=''
  save(undated);run('write',/Invalid official documentation citation/)
  const unmapped=structuredClone(manifest)
  const unsupported=unmapped.incumbents[0].functions.find(fn=>!fn.replacements.length)
  delete unsupported.gap
  save(unmapped);run('write',/Missing explicit unmapped function gap/)
  save(manifest);run('write')
  write(outputPath,read(outputPath)+'Stale output\n');run('check',/Stale contract projection: docs\/switch-checklists\.md/)

  // Real contract mutations through write and check: coverage is recomputed, never copied from JSON.
  const clauses=parseContract(source).clauses, ledger=clauses.find(c=>c.id==='ACCT-001')
  const acceptance=ledger.text.split('**Acceptance evidence:**')[1].trim().split(/(?<=\.)\s/)[0]
  const research=structuredClone(manifest), fn={id:'synthetic-proof',name:'Synthetic replacement proof',citations:[research.incumbents[0].functions[0].citations[0]],replacements:[{clause:ledger.id,acceptance}]}
  research.incumbents[0].functions.push(fn);save(research);run('write')
  const section=()=>readFileSync(join(directory,outputPath),'utf8').split('### Synthetic replacement proof\n\n')[1].split('\n## ')[0]
  assert.ok(section().startsWith('**Covered**'),'matching DONE replacement acceptance is covered')
  fn.gap='Synthetic function outcome lacks replacement proof.'
  save(research);run('write')
  assert.ok(section().startsWith('**Partial**'),'a function-specific gap withholds coverage even when the mapped clause is DONE')
  assert.ok(section().includes(fn.gap),'the unproved function outcome remains a named public gap')
  delete fn.gap
  save(research)
  const demoted=source.split('\n').map(line=>line.startsWith('| `ACCT-001` |')?line.split('|').map((cell,index)=>index===4?' partial ':index===6?' Synthetic acceptance proof withdrawn. ':cell).join('|'):line).join('\n')
  write('CONTRACT.md',demoted);run('check',/Stale/);run('write');run('check')
  assert.ok(section().startsWith('**Partial**'),'demoting a mapped replacement removes coverage')
  assert.ok(section().includes('Synthetic acceptance proof withdrawn.'),'current contract Gap reaches the public checklist')
  write('CONTRACT.md',source)
  fn.replacements[0].acceptance='An acceptance outcome the contract does not promise.'
  save(research);run('write')
  assert.ok(section().startsWith('**Partial**'),'DONE with unmatched acceptance remains a gap')
  fn.replacements[0].acceptance=acceptance.split(/[;,]/)[0]
  save(research);run('write')
  assert.ok(section().startsWith('**Partial**'),'an incomplete acceptance fragment cannot establish replacement coverage')
  assert.ok(section().includes('mapped acceptance no longer matches CONTRACT.md.'),'the incomplete acceptance is an explicit public gap')
  for (const id of ['BOUND-004','TER-009']) {
   const context=clauses.find(c=>c.id===id)
   fn.replacements=[{clause:id,acceptance:context.text.split('**Acceptance evidence:**')[1].trim().split(/(?<=\.)\s/)[0]}]
   save(research);run('write')
   assert.ok(section().startsWith('**Partial**'),id+' cannot establish replacement coverage')
   assert.ok(section().includes('Context only'),'non-replacement context is labelled')
  }
  console.log('MOVE-011 command probes passed: dated official citations; explicit unsupported gaps; unknown IDs and invalid citations refused; stale output rejected; mapped demotion, unmatched acceptance, boundaries and generic CSV cannot retain coverage')
 } finally {rmSync(directory,{recursive:true,force:true})}
}

// One phone-width public navigation and readability journey; optional captures stay outside the repository.
export async function assertSwitchChecklistNavigation(page,origin) {
 await page.setViewportSize({width:390,height:844})
 assert.equal((await page.goto(origin+'/docs')).status(),200)
 await page.locator('main').getByRole('link',{name:'Switch checklists',exact:true}).click()
 await page.waitForURL(url=>url.pathname==='/docs/switch-checklists')
 assert.equal(await page.title(),'Switching to Terrace · Terrace docs')
 await page.locator('h1').filter({hasText:'Switching to Terrace'}).waitFor()
 const manifest=JSON.parse(read(manifestPath))
 for (const incumbent of manifest.incumbents) {
  const heading=page.locator('h2').filter({hasText:incumbent.name})
  await heading.scrollIntoViewIfNeeded();await heading.waitFor({state:'visible'})
  const unsupported=incumbent.functions.find(fn=>!fn.replacements.length)
  const gap=page.locator('h3').filter({hasText:unsupported.name})
  await gap.scrollIntoViewIfNeeded()
  assert.ok(await gap.evaluate(el=>el.nextElementSibling.textContent.includes('Unsupported')),'unsupported function is visibly a gap')
 }
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'phone results fit without horizontal page scrolling')
 assert.ok(await page.locator('article p,article li').evaluateAll(elements=>elements.every(el=>parseFloat(getComputedStyle(el).fontSize)>=13)),'checklist results stay readable')
 const anchor=page.getByRole('link',{name:'Link to AppFolio',exact:true})
 await anchor.focus()
 assert.equal(await anchor.evaluate(el=>getComputedStyle(el,'::after').visibility),'visible','section-link tooltip appears on keyboard focus')
 const proof=process.env.TERRACE_SWITCH_PROOF
 if (proof) {
  mkdirSync(proof,{recursive:true})
  for(const width of [1440,390]) {
   await page.setViewportSize({width,height:width===1440?900:844});await page.locator('h2').filter({hasText:'AppFolio'}).evaluate(el=>el.scrollIntoView({block:'start'}))
   await page.screenshot({path:join(proof,'switch-checklists-'+width+'.png')})
  }
 }
 await page.setViewportSize({width:1440,height:900})
 console.log('MOVE-011 route probe passed: docs navigation, all incumbent sections, unsupported gaps, readable 390-pixel results and keyboard tooltip')
}
