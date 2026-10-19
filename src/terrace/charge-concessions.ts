/** PAY-001 / PORT-005: one concession may cover several effective rent segments in a period. */
import { one, type Context, type Row } from './core'
import { nextDay } from './zones'
const days=(from:string,to:string)=>Math.round((Date.parse(to)-Date.parse(from))/86400000)+1
export async function concessionLines(c:Context,line:Row,rents:Row[]) {
 const parts=rents.map(r=>({rent:r,from:r.coveredFrom>line.coveredFrom?r.coveredFrom:line.coveredFrom,to:r.coveredTo<line.coveredTo?r.coveredTo:line.coveredTo})).filter(x=>x.from<=x.to).sort((a,b)=>a.from.localeCompare(b.from))
 if(!parts.length||parts[0].from!==line.coveredFrom||parts.at(-1)!.to!==line.coveredTo||parts.some((p,i)=>i>0&&p.from!==nextDay(parts[i-1].to)))return {lines:[],reason:'Concession without unambiguous rent coverage in this period'}
 const totalDays=days(line.coveredFrom,line.coveredTo)
 const split=parts.map(p=>({...p,days:days(p.from,p.to),amount:Math.floor(line.amountCents*days(p.from,p.to)/totalDays)}))
 // Allocate the period's already-rounded total exactly; remainder goes to the longest segment, earliest on a tie.
 let remainder=line.amountCents-split.reduce((n,p)=>n+p.amount,0)
 const largest=split.reduce((best,p)=>p.days>best.days?p:best)
 largest.amount+=remainder
 if(split.some(p=>p.amount>p.rent.amountCents))return {lines:[],reason:'Concession exceeds its effective rent segment'}
 const lines:Row[]=[]
 for(const p of split.filter(p=>p.amount>0)) {
  const reference=parts.length===1?line.reference:`${line.reference}-${p.rent.termId.slice(0,8)}`
  const posted=!!(await one(c,'SELECT 1 FROM tt_adjustments a JOIN tt_charges q ON q.id=a.charge_id WHERE q.tenancy_id=? AND q.reference=? AND a.reference=?',line.tenancyId,p.rent.reference,reference))
  lines.push({...line,amountCents:p.amount,dueDate:p.from,coveredFrom:p.from,coveredTo:p.to,coveredDays:p.days,reference,rentReference:p.rent.reference,posted})
 }
 return {lines,reason:null}
}
