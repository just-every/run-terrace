// Produce checksum-valid malformed financial archives, then submit them through data.restore.
import {makePart,ArchiveVerifier,ContentVerifier} from '../src/modules/portability/format.mjs'
export async function editArchive(text,mutate){
 const records=text.trim().split('\n').map(line=>JSON.parse(line)),manifest=records[0],parts=[]
 for(const part of records.filter(r=>r.kind==='part')){for(const item of part.items)if(item.kind==='row')mutate(item.table,item.row);parts.push(await makePart(part.index,part.items))}
 const archive=new ArchiveVerifier(manifest),content=new ContentVerifier(manifest)
 for(const p of parts){archive.add(p);for(const item of p.items)content.add(item)}
 return[manifest,...parts,{...records.at(-1),archiveHash:archive.digest(),contentHash:content.digest()}].map(r=>JSON.stringify(r)).join('\n')+'\n'
}
