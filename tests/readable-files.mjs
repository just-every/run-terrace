import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
export function csvRows(bytes) {
 const text=bytes.toString(),rows=[];let row=[],cell='',quoted=false
 for(let i=0;i<text.length;i++){
  const ch=text[i]
  if(ch==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++}else quoted=!quoted}
  else if(!quoted&&ch===','){row.push(cell);cell=''}
  else if(!quoted&&(ch==='\r'||ch==='\n')){if(ch==='\r'&&text[i+1]==='\n')i++;row.push(cell);rows.push(row);row=[];cell=''}
  else cell+=ch
 }
 if(cell||row.length){row.push(cell);rows.push(row)}
 return rows
}
export const readableFiles=entries=>csvRows(entries.get('File inventory.csv')).slice(1).map(([path,reference,size,sha256])=>({path,reference,size,sha256}))
export function originalByHash(entries,sha256) {
 const file=readableFiles(entries).find(f=>f.sha256===sha256)
 assert.ok(file,'the original checksum is listed in the readable inventory')
 assert.equal(createHash('sha256').update(entries.get(file.path)).digest('hex'),sha256,'the listed original has exactly its recorded bytes')
 return file
}
