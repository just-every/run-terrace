import {readFile,writeFile,mkdir} from 'node:fs/promises'
// Incremental generation preserves the legacy acceptance journeys while their clauses move to canonical generation.
const mode=process.argv[2],ids=process.argv.slice(3)
if(!['write','check'].includes(mode))throw Error('Use write or check, followed by the clause ids to regenerate.')
if(!ids.length)ids.push('MOVE-001')
const contract=await readFile('CONTRACT.md','utf8'),original=await readFile('ACCEPTANCE.md','utf8')
let acceptance=original
const claims=[]
for(const id of ids){
 const status=contract.split('\n').find(l=>l.startsWith('| `'+id+'` |'))?.split('|').slice(1,-1).map(s=>s.trim())
 const clause=contract.split('\n').find(l=>l.startsWith('- **'+id+' — '))
 if(!status||!clause||!clause.includes('**Acceptance evidence:**'))throw Error('Canonical clause or status not found: '+id)
 const [,title,,state,evidence,gap]=status
 const proof=clause.split('**Acceptance evidence:**')[1].trim()
 const lines=acceptance.split('\n'),position=lines.findIndex(l=>new RegExp('^\\d+\\. \\*\\*'+id+' — ').test(l))
 if(position<0)throw Error('Legacy acceptance position not found: '+id)
 const number=lines[position].match(/^\d+/)[0]
 lines[position]=`${number}. **${id} — ${title}.** **Status: ${state}.** ${proof} **Current evidence:** ${evidence||'No implementation evidence yet.'}${gap?' **Remaining:** '+gap:''}`
 acceptance=lines.join('\n')
 claims.push(`| \`${id}\` | ${title} | ${state} | ${evidence} | ${gap} |`)
}
const register='# Generated clause claims\n\nGenerated from CONTRACT.md by the seed contract-docs command. This incremental register covers '+ids.map(id=>'`'+id+'`').join(', ')+'. Other clauses and the homepage claim map remain in CONTRACT.md.\n\n| Clause | Capability | Status | Evidence | Gap |\n| --- | --- | --- | --- | --- |\n'+claims.join('\n')+'\n'
if(mode==='write'){await writeFile('ACCEPTANCE.md',acceptance);await mkdir('docs',{recursive:true});await writeFile('docs/CLAIMS.md',register)}
else{let current='';try{current=await readFile('docs/CLAIMS.md','utf8')}catch{}if(acceptance!==original||current!==register)throw Error('Contract documents are stale. Run the seed contract-docs write command.');console.log('Contract documents are current.')}
