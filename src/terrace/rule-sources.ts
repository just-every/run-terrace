import {one,sha256,type Context,type Row} from './core'

/** Include the jurisdiction revision and dated pack activations, including missing packs. */
export async function ruleSource(c:Context,propertyId:string,on:string){
 const assignment=await one(c,'SELECT state_code,overlays,version FROM tt_property_rules WHERE property_id=?',propertyId)
 const jurisdiction=assignment?{state:assignment.state_code,overlays:JSON.parse(assignment.overlays),version:assignment.version}:null
 const packs:Row[]=[]
 for(const code of jurisdiction?[jurisdiction.state,...jurisdiction.overlays]:[]){
  const pack=await one(c,'SELECT p.id,p.version,a.activated_at FROM tt_rule_packs p LEFT JOIN tt_rule_activations a ON a.pack_id=p.id WHERE p.code=? AND p.effective_from<=? ORDER BY p.effective_from DESC,p.version DESC LIMIT 1',code,on)
  packs.push({code,id:pack?.id??null,version:pack?.version??null,activatedAt:pack?.activated_at??null})
 }
 const snapshot=JSON.stringify({propertyId,on,jurisdiction,packs})
 return{snapshot,revision:await sha256(new TextEncoder().encode(snapshot))}
}
