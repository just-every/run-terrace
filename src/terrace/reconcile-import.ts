import {date,insist,text,type Row} from './core'
export function signedCents(value:unknown){
 const s=text(String(value??''),'Signed USD amount',18)
 insist(/^-?\d+(\.\d{1,2})?$/.test(s),'statement_amount','Amounts must be exact USD cents.')
 const [a,b='']=s.replace('-','').split('.'),n=(Number(a)*100+Number(b.padEnd(2,'0')))*(s.startsWith('-')?-1:1)
 insist(Number.isSafeInteger(n)&&Math.abs(n)<=1_000_000_000,'statement_amount','Amount is outside the supported range.');return n
}
function csvRows(source:string){
 const rows:string[][]=[];let row:string[]=[],cell='',quoted=false,closed=false
 for(let i=0;i<source.length;i++){
  const ch=source[i]
  if(quoted){if(ch==='"'){if(source[i+1]==='"'){cell+='"';i++}else{quoted=false;closed=true}}else cell+=ch;continue}
  if(ch==='"'){insist(!cell&&!closed,'statement_csv','Malformed CSV quote.');quoted=true;continue}
  if(ch===','||ch==='\n'||ch==='\r'){row.push(cell);cell='';closed=false;if(ch!==','){if(ch==='\r'&&source[i+1]==='\n')i++;if(row.some(x=>x))rows.push(row);row=[]}continue}
  insist(!closed,'statement_csv','Unexpected data after a quoted field.');cell+=ch
 }
 insist(!quoted,'statement_csv','Unclosed CSV field.');if(cell||row.length){row.push(cell);rows.push(row)}
 return rows
}
const tag=(source:string,name:string)=>source.match(new RegExp('<'+name+'>([^<\\r\\n]*)','i'))?.[1]?.trim()
export function bankLines(format:string,source:string,reviewed:string,from:string,to:string,closing:number):Row[]{
 let raw:Row[]=[]
 if(format==='csv'||format==='pdf'){
  const rows=csvRows(format==='pdf'?reviewed:source),header=rows.shift()??[]
  insist(['id','date','amount','description'].every(x=>header.includes(x))&&new Set(header).size===header.length&&header.every(x=>['id','date','amount','description','checkNumber','traceNumber'].includes(x)),'statement_csv','CSV needs id,date,amount,description, with optional checkNumber and traceNumber.')
  raw=rows.map(row=>{insist(row.length===header.length,'statement_csv','Every CSV row must have all columns.');return Object.fromEntries(header.map((x,i)=>[x,row[i]]))})
 }else{
  insist(['ofx','qfx'].includes(format),'statement_format','Choose CSV, OFX, QFX or reviewed PDF.')
  insist(!/<!DOCTYPE|<!ENTITY/i.test(source)&&tag(source,'CURDEF')==='USD','statement_currency','Only USD statements without external entities are supported.')
  insist((source.match(/<STMTRS>/gi)??[]).length===1,'statement_account','Import one bank account statement per file.')
  const balance=source.match(/<LEDGERBAL>([\s\S]*?)<\/LEDGERBAL>/i)?.[1]
  insist(balance&&signedCents(tag(balance,'BALAMT'))===closing,'statement_balance','The OFX closing balance must equal the reviewed closing balance.')
  raw=[...source.matchAll(/<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi)].map(([,s])=>{const d=tag(s,'DTPOSTED')??'';insist(/^\d{8}/.test(d),'statement_date','OFX posting date is missing.');return{id:tag(s,'FITID'),date:d.slice(0,4)+'-'+d.slice(4,6)+'-'+d.slice(6,8),amount:tag(s,'TRNAMT'),description:tag(s,'MEMO')||tag(s,'NAME')||'Bank transaction',checkNumber:tag(s,'CHECKNUM')||'',traceNumber:tag(s,'REFNUM')||''}})
 }
 insist(raw.length<=2000,'statement_limit','Import at most 2,000 lines per statement.')
 const seen=new Set<string>()
 return raw.map(r=>{const key=text(r.id,'Stable bank transaction id',150),day=date(r.date),amount=signedCents(r.amount);insist(!seen.has(key)&&day>=from&&day<=to&&amount!==0,'statement_line','Ids must be unique, nonzero amounts dated within the statement.');seen.add(key);return{key,day,amountCents:amount,description:text(r.description,'Description',500),checkNumber:r.checkNumber?text(r.checkNumber,'Check number',100):'',traceNumber:r.traceNumber?text(r.traceNumber,'ACH trace',100):''}})
}
