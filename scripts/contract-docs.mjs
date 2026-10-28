import {readFile,writeFile,mkdir} from 'node:fs/promises'
import {parseContract} from '../src/base/seed-contract.mjs'

// Preserve the legacy acceptance document while migrating one clause projection at a time.
const ids=['LEASE-007','MOVE-001','MOVE-010','PORTAL-001','OPS-004'],mode=process.argv[2]
if(!['write','check'].includes(mode))throw Error('Use contract-docs.mjs write or check')
let source=await readFile('CONTRACT.md','utf8')
const original=source
const statusRows=source.split('\n').filter(line=>/^\| `[A-Z]+-\d+` \|/.test(line)).map(line=>line.split('|').slice(1,-1).map(cell=>cell.trim()))
source=source.replace(/^\| (Published|Target and push further|All) \|.*$/gm,(_,label)=>{
 const rows=statusRows.filter(row=>label==='All'||(label==='Published'?row[2]==='published':row[2]!=='published'))
 return '| '+label+' | '+['done','partial','missing'].map(state=>rows.filter(row=>row[3]===state).length).concat(rows.length).join(' | ')+' |'
})
const contract=parseContract(source),states=new Map(contract.clauses.map(c=>[c.id,c.status]))
source=source.split('\n').map(line=>{
 if(!/^\| \d+ \|/.test(line)||!ids.some(id=>line.includes('`'+id+'`')))return line
 const cells=line.split('|'),claimIds=[...cells[3].matchAll(/`([^`]+)`/g)].map(m=>m[1]),values=claimIds.map(id=>states.get(id))
 if(values.some(v=>!v))throw Error('Claim maps an unknown clause')
 cells[4]=' '+(values.every(v=>v==='done')?'done':values.every(v=>v==='missing')?'missing':'partial')+' '
 return cells.join('|')
}).join('\n')
const claimRows=source.split('\n').filter(l=>/^\| (?:[1-9]|[1-4][0-9]|50) \|/.test(l))
const tally=status=>claimRows.filter(l=>l.split('|')[4].trim()===status).length
source=source.replace(/Claims 1–50: \d+ done, \d+ partial, \d+ missing\./,`Claims 1–50: ${tally('done')} done, ${tally('partial')} partial, ${tally('missing')} missing.`)
source=source.replace(/raw clause statuses agree id for id in both documents: \d+ done, \d+ partial, \d+ missing \(143 clauses\)\./,`raw clause statuses agree id for id in both documents: ${contract.counts.done} done, ${contract.counts.partial} partial, ${contract.counts.missing} missing (${contract.counts.total} clauses).`)
if(mode==='write')await writeFile('CONTRACT.md',source)
else if(source!==original)throw Error('Stale homepage claim statuses in CONTRACT.md')
let acceptance=await readFile('ACCEPTANCE.md','utf8')
for(const id of ids){
 const clause=contract.clauses.find(c=>c.id===id)
 if(!clause)throw Error('Missing contract clause '+id)
 const sentence=clause.text.split('**Acceptance evidence:**')[1]?.trim()
 if(!sentence)throw Error('Missing acceptance evidence for '+id)
 const lines=acceptance.split('\n'),index=lines.findIndex(line=>line.includes('**'+id+' —'))
 if(index<0)throw Error('Missing legacy acceptance entry '+id)
 const prefix=lines[index].match(/^\d+\./)?.[0]
 if(!prefix)throw Error('Missing acceptance numbering for '+id)
 lines[index]=`${prefix} **${id} — ${clause.title}.** **Status: ${clause.status}.** ${sentence} **Current evidence:** ${source.split('\n')[clause.row-1].split('|')[5].trim()||'No executed proof yet.'}${clause.gap?' **Remaining:** '+clause.gap:''}`
 acceptance=lines.join('\n')
}
acceptance=acceptance.replace(/raw clause statuses agree id for id in both documents: \d+ done, \d+ partial, \d+ missing \(143 clauses\)\./,`raw clause statuses agree id for id in both documents: ${contract.counts.done} done, ${contract.counts.partial} partial, ${contract.counts.missing} missing (${contract.counts.total} clauses).`)
const claimStart=source.indexOf('## Homepage claims'),claimEnd=source.indexOf('\n## ',claimStart+1)
if(claimStart<0)throw Error('Homepage claims source missing')
const claims='# Terrace capability claims\n\nGenerated from CONTRACT.md. Edit its claim mapping and Status rows, then run `node scripts/contract-docs.mjs write`.\n\n'+source.slice(claimStart,claimEnd<0?undefined:claimEnd).split('\n').filter(line=>line.startsWith('|')).join('\n')+'\n'
const outputs=[['ACCEPTANCE.md',acceptance],['docs/CLAIMS.md',claims]]
for(const[path,bytes]of outputs){
 if(mode==='write'){await mkdir('docs',{recursive:true});await writeFile(path,bytes)}
 else{let current;try{current=await readFile(path,'utf8')}catch{};if(current!==bytes)throw Error('Stale contract projection: '+path)}
}
console.log('Contract projections '+(mode==='write'?'written':'match their source')+'; all '+contract.clauses.length+' Status rows retained.')
