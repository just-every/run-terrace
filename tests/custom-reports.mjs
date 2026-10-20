import assert from 'node:assert/strict'
import {installation} from './api/harness.mjs'

/** REPORT-005: governed typed fields, saved expressions, source/schema lineage and frozen merges. */
export async function journey({inspect,assets=false}={}) {
 const h=await installation({assets})
 try {
  const north=await h.command('portfolio.add',{name:'Inspection portfolio'}),west=await h.command('portfolio.add',{name:'Unassigned portfolio'})
  const property=async(f,name)=>h.command('property.add',{portfolioId:f.id,name,address:name+', Oakland, CA',kind:'duplex',timeZone:'America/Los_Angeles'})
  const p=await property(north,'Inspection duplex'),outside=await property(west,'Hidden western property')
  const unit=async(prop,identifier)=>h.command('unit.add',{propertyId:prop.id,identifier,bedrooms:2,bathrooms:1})
  const a=await unit(p,'A'),b=await unit(p,'B'),x=await unit(outside,'X')
  await h.stepUp()
  const staff={}
  for(const role of ['portfolio_manager','leasing','member']) {
   const email=role+'-custom@example.test';await h.command('operator.invite',{email,displayName:role,role,['portfolio:'+north.id]:'1'});staff[role]=await h.accept(email)
  }
  const all=['portfolio_manager','leasing','bookkeeper','accountant','maintenance_coordinator','member'],managers=['portfolio_manager']
  const base={portfolioId:north.id,entity:'unit',readRoles:all,required:true,reason:'Inspection field approved for this portfolio'}
  const score=await h.command('custom.field.define',{...base,key:'inspection_score',label:'Unit inspection score',type:'number',min:0,max:10},{as:staff.portfolio_manager})
  const group=await h.command('custom.field.define',{...base,key:'inspection_state',label:'Inspection state',type:'select',options:['ready','repair']},{as:staff.portfolio_manager})
  const field=(key,type)=>h.command('custom.field.define',{...base,key,label:key,type})
  const checked=await field('inspection_checked','boolean'),on=await field('inspection_on','date'),notes=await field('inspection_notes','text')
  await h.command('custom.field.define',{...base,portfolioId:west.id,key:'outside_score',label:'Wrong scope',type:'number'},{as:staff.portfolio_manager,status:404})
  await h.command('custom.field.define',{...base,key:'forged',label:'Forged',type:'number'},{as:staff.leasing,status:403})
  const set=(f,entityId,value,version=0,opts={})=>h.command('custom.value.set',{fieldId:f.id,entityId,value,version,source:'Inspection photo sheet 2026-10'},opts)
  await set(score,a.id,'not a number',0,{status:400});await set(score,a.id,'11',0,{status:400});await set(group,a.id,'unknown',0,{status:400});await set(checked,a.id,'maybe',0,{status:400});await set(on,a.id,'2026-02-30',0,{status:400});await set(notes,a.id,'',0,{status:400})
  await set(score,a.id,'8',0,{as:staff.portfolio_manager});await set(score,b.id,4,0,{as:staff.portfolio_manager});await set(group,a.id,'ready');await set(group,b.id,'repair');await set(checked,a.id,true);await set(on,a.id,'2026-10-19');await set(notes,a.id,'Photographed kitchen and bathroom')
  await set(score,x.id,5,0,{as:staff.portfolio_manager,status:404});await set(score,a.id,1,0,{status:409});await set(score,a.id,1,1,{as:staff.member,status:403})
  const spec={columns:[{key:'state',label:'Inspection state',field:'inspection_state'},{key:'score',label:'Inspection score',field:'inspection_score'},{key:'weighted',label:'Weighted score',formula:{op:'multiply',args:[{field:'inspection_score'},{literal:2}]}}],groupBy:['state'],aggregates:[{key:'units',op:'count'},{key:'score_total',op:'sum',column:'weighted'}],filters:[{field:'inspection_score',op:'gte',value:5}]}
  const report=await h.command('custom.report.save',{...base,name:'Inspection readiness',spec,reason:'Reviewed inspection scoring'},{as:staff.portfolio_manager})
  const get=async(path,as)=>{const r=await h.request(path,as?{as}:{});assert.equal(r.status,200,await r.clone().text());assert.equal(r.headers.get('cache-control'),'no-store');return r.json()}
  const reportUrl='/api/custom-report?id='+report.id,result=await get(reportUrl,staff.leasing)
  assert.equal(result.rows.length,1);assert.equal(result.rows[0].entityId,a.id);assert.deepEqual(result.rows[0].cells,{state:'ready',score:8,weighted:16});assert.equal(result.groups[0].aggregates.score_total,16)
  assert.equal(result.rows[0].lineage.find(v=>v.fieldId===score.id).source,'Inspection photo sheet 2026-10');assert.equal(result.schema.find(f=>f.id===score.id).label,'Unit inspection score')
  const download=await h.request(reportUrl+'&format=csv',{as:staff.leasing});assert.equal(download.status,200);const csv=await download.text();assert.ok(csv.includes('Inspection photo sheet 2026-10'));assert.ok(!csv.includes('Hidden western property'))
  const grouped=await h.command('custom.report.save',{...base,name:'Grouped inspection totals',spec:{...spec,filters:[]}})
  const groupedRows=await get('/api/custom-report?id='+grouped.id)
  assert.deepEqual(groupedRows.groups.map(g=>[g.by.state,g.aggregates.units,g.aggregates.score_total]).sort(),[['ready',1,16],['repair',1,8]])
  const formulaReport=await h.command('custom.report.save',{...base,name:'Inspection calculation semantics',spec:{columns:[{key:'add',label:'Add',formula:{op:'add',args:[{literal:0.1},{literal:0.2}]}},{key:'subtract',label:'Subtract',formula:{op:'subtract',args:[{field:'inspection_score'},{literal:2}]}},{key:'divide',label:'Divide',formula:{op:'divide',args:[{field:'inspection_score'},{literal:2}]}}]}})
  const computed=await get('/api/custom-report?id='+formulaReport.id)
  assert.deepEqual(computed.rows.find(r=>r.entityId===a.id).cells,{add:0.1+0.2,subtract:6,divide:4})
  const zero=await h.command('custom.report.save',{...base,name:'Division needs review',spec:{columns:[{key:'ratio',label:'Ratio',formula:{op:'divide',args:[{field:'inspection_score'},{literal:0}]}}]}})
  assert.equal((await h.request('/api/custom-report?id='+zero.id)).status,400)
  const optional=await h.command('custom.field.define',{...base,required:false,key:'optional_reading',label:'Optional meter reading',type:'number'})
  const missing=await h.command('custom.report.save',{...base,name:'Incomplete reading',spec:{columns:[{key:'reading',label:'Reading',formula:{op:'add',args:[{field:'optional_reading'},{literal:1}]}}],aggregates:[{key:'total',op:'sum',column:'reading'},{key:'units',op:'count'}]}})
  const incomplete=await get('/api/custom-report?id='+missing.id)
  assert.deepEqual(incomplete.rows.map(r=>r.cells.reading),[null,null]);assert.deepEqual(incomplete.groups[0].aggregates,{total:null,units:2})
  const template=await h.command('custom.template.save',{...base,name:'Unit inspection note',body:'Inspection score: {{inspection_score}}. Result: {{inspection_state}}.',reason:'Review unit inspection letter'},{as:staff.portfolio_manager})
  const doc=await h.command('custom.document.generate',{templateId:template.id,entityId:a.id,version:template.version},{as:staff.leasing}),docUrl='/api/custom-document?id='+doc.id
  const original=await get(docUrl,staff.leasing);assert.equal(original.content,'Inspection score: 8. Result: ready.');assert.equal(original.lineage.find(f=>f.fieldId===score.id).valueVersion,1)
  await set(score,a.id,9,1)
  await h.command('custom.template.revise',{definitionId:template.id,version:1,name:'Updated inspection note',body:'Updated inspection: {{inspection_score}}.',readRoles:all,reason:'New wording for future documents'})
  assert.equal((await get(docUrl,staff.leasing)).content,original.content,'source and template edits never regenerate earlier documents')
  const next=await h.command('custom.document.generate',{templateId:template.id,entityId:a.id,version:2},{as:staff.leasing});assert.equal((await get('/api/custom-document?id='+next.id,staff.leasing)).content,'Updated inspection: 9.')
  await h.command('custom.document.generate',{templateId:template.id,entityId:a.id,version:1},{status:409})
  await h.command('custom.field.revise',{fieldId:score.id,version:1,label:'Reviewed unit inspection score',type:'number',min:0,max:10,readRoles:all,required:true,reason:'Clarify inspection label'})
  assert.equal((await h.request(reportUrl)).status,409,'schema changes require explicit report review')
  await h.command('custom.report.revise',{definitionId:report.id,version:1,name:'Inspection readiness reviewed',readRoles:all,spec,reason:'Reviewed changed source schema'})
  assert.equal((await get(reportUrl)).rows[0].cells.score,9)
  assert.equal((await get(docUrl)).content,original.content)
  const catalog=await get('/api/custom-reports',staff.portfolio_manager),history=catalog.fields.find(f=>f.id===score.id).history
  assert.equal(history.length,2);assert.equal(history[1].reason,'Clarify inspection label');assert.ok(catalog.definitions.find(d=>d.id===report.id).history.length===2)
  // A hidden dependency remains hidden in filters, formula-only columns, old documents and revised templates.
  await h.command('custom.field.revise',{fieldId:score.id,version:2,label:'Manager inspection score',type:'number',min:0,max:10,readRoles:managers,required:true,reason:'Restrict internal inspection score'})
  for(const path of [reportUrl,reportUrl+'&format=csv',docUrl,docUrl+'&format=text'])assert.equal((await h.request(path,{as:staff.leasing})).status,403)
  await h.command('custom.document.generate',{templateId:template.id,entityId:a.id,version:2},{as:staff.leasing,status:403})
  const privateCatalog=JSON.stringify(await get('/api/custom-reports',staff.leasing));assert.ok(!privateCatalog.includes(score.id));assert.ok(!privateCatalog.includes('Manager inspection score'))
  await h.command('custom.template.revise',{definitionId:template.id,version:2,name:'State only',body:'State: {{inspection_state}}',readRoles:all,reason:'Remove score from future letters'})
  assert.equal((await h.request(docUrl,{as:staff.leasing})).status,403,'old dependencies remain checked when current template no longer mentions them')
  const owner=await h.command('owner.add',{kind:'individual',legalName:'Inspection Owner',email:'inspection-owner@example.test',mailingAddress:'10 Owner Street'})
  await h.command('ownership.set',{propertyId:p.id,effectiveFrom:'2025-01-01',reason:'Ownership source',shares:[{ownerId:owner.id,percent:'100'}]})
  const sensitive=await h.command('custom.field.define',{...base,entity:'owner',key:'private_owner_note',label:'Sensitive owner review',type:'text',readRoles:managers})
  await set(sensitive,owner.id,'PRIVATE-OWNER-REVIEW-472')
  const ownerSpec={columns:[{key:'note',label:'Internal owner review',field:'private_owner_note'}],groupBy:[],aggregates:[],filters:[]}
  const ownerReport=await h.command('custom.report.save',{...base,entity:'owner',name:'Owner internal review',spec:ownerSpec}),ownerTemplate=await h.command('custom.template.save',{...base,entity:'owner',name:'Owner review memo',body:'Owner note: {{private_owner_note}}'})
  const ownerDoc=await h.command('custom.document.generate',{templateId:ownerTemplate.id,version:1,entityId:owner.id})
  assert.ok((await get('/api/custom-document?id='+ownerDoc.id)).content.includes('PRIVATE-OWNER-REVIEW-472'))
  for(const path of ['/api/custom-report?id='+ownerReport.id+'&format=csv','/api/custom-document?id='+ownerDoc.id+'&format=text']){const r=await h.request(path,{as:staff.leasing});assert.equal(r.status,403);assert.ok(!(await r.text()).includes('PRIVATE-OWNER-REVIEW-472'))}
  await h.command('custom.document.generate',{templateId:ownerTemplate.id,version:1,entityId:owner.id},{as:staff.leasing,status:403})
  assert.ok(!JSON.stringify(await get('/api/custom-reports',staff.leasing)).includes('PRIVATE-OWNER-REVIEW-472'))
  for(const path of ['/api/custom-reports',reportUrl,docUrl])assert.equal((await h.request(path,{as:''})).status,401)
  const outsideField=await h.command('custom.field.define',{...base,portfolioId:west.id,key:'western_inspection',label:'Western inspection',type:'number'})
  await set(outsideField,x.id,7)
  const outsideReport=await h.command('custom.report.save',{...base,portfolioId:west.id,name:'Western inspections',spec:{columns:[{key:'score',label:'Score',field:'western_inspection'}]}})
  assert.equal((await h.request('/api/custom-report?id='+outsideReport.id,{as:staff.portfolio_manager})).status,404)
  const visibleReport=await h.command('custom.report.save',{...base,name:'Current inspection states',spec:{columns:[{key:'state',label:'Inspection result',field:'inspection_state'}],groupBy:['state'],aggregates:[{key:'units',op:'count'}],filters:[]}})
  assert.equal((await get('/api/custom-report?id='+visibleReport.id,staff.leasing)).rows.length,2)
  if(inspect)await inspect({h,p,staff,report,template,visibleReport})
 }finally{await h.close()}
}
