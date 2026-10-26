import {money,type Row} from './core'

// Tagged, selectable text in reading order. ActualText preserves the original
// Unicode even where the standard PDF font has no matching display glyph.
const unicode=(s:string)=>'FEFF'+Array.from({length:s.length},(_,i)=>s.charCodeAt(i).toString(16).padStart(4,'0')).join('')
const extra='€\u0081‚ƒ„…†‡ˆ‰Š‹Œ\u008dŽ\u008f\u0090‘’“”•–—˜™š›œ\u009džŸ'
const code=(c:string)=>{const n=c.charCodeAt(0),x=extra.indexOf(c);return n<128||n>=160&&n<=255?n:x>=0?128+x:63}
const encoded=(s:string)=>Array.from(s,c=>code(c).toString(16).padStart(2,'0')).join('')
const widths=[0,0,0,0,0,0,0,0,0,260,0,0,0,260,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584,0,556,1000,222,556,333,1000,556,556,333,1000,667,333,1000,1000,611,1000,1000,222,222,333,333,350,556,1000,333,1000,500,333,944,1000,500,667,278,333,556,556,556,556,260,556,333,737,370,556,584,333,737,333,400,584,333,333,333,556,537,278,333,333,365,556,834,834,834,611,667,667,667,667,667,667,1000,722,667,667,667,667,278,278,278,278,722,722,778,778,778,778,778,584,778,722,722,722,722,667,667,611,556,556,556,556,556,556,889,500,556,556,556,556,278,278,278,278,556,556,556,556,556,556,556,584,611,556,556,556,556,500,556,500]
const size=(role:string)=>role==='H1'?18:role==='H2'?15:13
const width=(text:string,role:string)=>Array.from(text,c=>widths[code(c)]).reduce((n,w)=>n+w,0)*size(role)/1000
export function residentPdf(d:Row,receipt=false){
 const title=receipt?'Payment receipt':'Monthly rent statement',m=(n:number)=>money(n,d.currency)
 const paragraphs:{role:string,text:string}[]=[{role:'H1',text:title},...(d.receipt?[{role:'P',text:`Payment received ${d.receipt.date}: ${m(d.receipt.amountCents)}. ${d.receipt.description}. Receipt source ${d.receipt.id}.`}]:[]),{role:'P',text:d.tenancy.address},{role:'P',text:`${d.month} | ${d.from} through ${d.to} | ${d.timeZone} | ${d.currency}`},
  {role:'P',text:`Opening receivable: ${m(d.openingCents)}. Closing receivable: ${m(d.closingCents)}.`},
  {role:'P',text:`Pending funds, not deducted: ${m(d.pendingCents)}. Unapplied credit, separate: ${m(d.unappliedCreditCents)}.`},
  {role:'P',text:`${d.delivery?'Recorded balance at preparation':'Current recorded balance'} as of ${d.currentAsOf}: ${m(d.currentBalanceCents)}.`},{role:'H2',text:'Itemized transactions'},
  ...d.lines.map((r:Row)=>({role:'P',text:`${r.kind==='Lease charge'?'Due':'Dated'} ${r.date}. ${r.kind}. ${r.description}. Amount ${m(r.amountCents)}. Receivable change ${m(r.receivableDeltaCents)}. Source ${r.id}.`})),{role:'P',text:d.notice}]
 const lines:{role:string,text:string}[]=[]
 for(const p of paragraphs){let line='';for(const word of p.text.split(/\s+/)){if(width(line+' '+word,p.role)>528&&line){lines.push({role:p.role,text:line});line=''}for(const char of word){if(width(line+char,p.role)>528){lines.push({role:p.role,text:line});line=''}line+=char}line+=' '}if(line.trim())lines.push({role:p.role,text:line.trim()})}
 const objects:string[]=[],put=(s:string)=>{objects.push(s);return objects.length},set=(n:number,s:string)=>{objects[n-1]=s}
 const catalog=put(''),pages=put(''),font=put('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>'),tree=put(''),parents=put(''),info=put(`<< /Title <${unicode(title)}> /Author (Terrace) >>`),kids:number[]=[],tags:number[]=[],nums:string[]=[]
 for(let start=0;start<lines.length;start+=38){
  const page=put(''),content=put(''),pageTags:number[]=[],part=lines.slice(start,start+38)
  const stream=part.map((l,i)=>{const tag=put(`<< /Type /StructElem /S /${l.role} /P ${tree} 0 R /Pg ${page} 0 R /K ${i} >>`);tags.push(tag);pageTags.push(tag);return`/${l.role} << /MCID ${i} /ActualText <${unicode(l.text)}> >> BDC BT /F1 ${size(l.role)} Tf 1 0 0 1 42 ${744-i*18} Tm <${encoded(l.text)}> Tj ET EMC`}).join('\n')
  set(content,`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`)
  set(page,`<< /Type /Page /Parent ${pages} 0 R /MediaBox [0 0 612 792] /StructParents ${kids.length} /Resources << /Font << /F1 ${font} 0 R >> >> /Contents ${content} 0 R >>`)
  nums.push(`${kids.length} [${pageTags.map(n=>n+' 0 R').join(' ')}]`);kids.push(page)
 }
 set(catalog,`<< /Type /Catalog /Pages ${pages} 0 R /Lang (en-US) /MarkInfo << /Marked true >> /ViewerPreferences << /DisplayDocTitle true >> /StructTreeRoot ${tree} 0 R >>`)
 set(pages,`<< /Type /Pages /Kids [${kids.map(n=>n+' 0 R').join(' ')}] /Count ${kids.length} >>`)
 set(tree,`<< /Type /StructTreeRoot /K [${tags.map(n=>n+' 0 R').join(' ')}] /ParentTree ${parents} 0 R /ParentTreeNextKey ${kids.length} >>`);set(parents,`<< /Nums [${nums.join(' ')}] >>`)
 let output='%PDF-1.7\n';const offsets:number[]=[]
 objects.forEach((o,i)=>{offsets.push(output.length);output+=`${i+1} 0 obj\n${o}\nendobj\n`});const xref=output.length
 output+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n${offsets.map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')}trailer\n<< /Size ${objects.length+1} /Root ${catalog} 0 R /Info ${info} 0 R >>\nstartxref\n${xref}\n%%EOF\n`
 return new TextEncoder().encode(output)
}
