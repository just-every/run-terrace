import { usDate } from './format'
export type ExportRow = Record<string, unknown>
export const label = (value: string) => value.replace(/([a-z])([A-Z])/g,'$1 $2').replace(/^(?:tt_|ik_d1_|ik_|bs_|rer_|agent_door_)/, '').replace(/^id$/, 'record reference').replace(/_id$/, ' reference').replace(/_cents$/, ' amount').replace(/_/g, ' ').replace(/\bjson\b/gi, 'details').replace(/^./, s => s.toUpperCase())
const tableNames:Record<string,string>={tt_audit:'Operating history',tt_maintenance_jobs:'Maintenance',tt_inspection_photos:'Inspection photographs',tt_gl_accounts:'Chart of accounts',ik_jobs:'Move-in imports',ik_provenance:'Import sources'}
export const tableLabel = (table:string) => tableNames[table] ?? label(table)
/** Installation machinery remains in the complete private backup. Business events and approvals do not. */
export const internal = (table: string) => /^(?:oa_|oc_|rer_dependency_|rer_portability_|rer_erasure_)/.test(table) || /^(?:tt_(?:guard|budget_clock|reconcile_clock|api_idempotency|totp|recovery_codes|factor_sessions|factor_failures|security|erasures|erasure_work|erased_.*|record_media_chunks)|bs_assert|ik_d1_(?:assertions|creation_plans|custody_states|custody_revisions|indexed_jobs|native_staging.*|plan_.*|preparation_.*|publication_fences|reversal_fences|staging.*|stream_origins|original_chunks))$/.test(table) || /_(?:sessions|tokens)$/.test(table)
export function group(table: string) {
 if(table.startsWith('ik_'))return 'Move-in records'
 if(/integration|rer_mail/.test(table))return 'Connections and delivery'
 if(/audit|agent_door|role_|staff_|api_credential/.test(table))return 'People and operating history'
 if(/document|media|print_|thread|request_|action_|professional/.test(table))return 'Documents and conversations'
 if(/inspection|maintenance|vendor|work_|appointment|asset|stock|dispatch|completion|job_|emergenc|oncall|turnover/.test(table))return 'Repairs and inspections'
 if(/lease|renewal|application|prospect|household|move_checklist/.test(table))return 'Leasing and households'
 if(/privacy|legal_hold|rule_|property_rule/.test(table))return 'Resident requests and policies'
 if(/message|resident_|portal/.test(table))return 'Resident services'
 if(/shadow|migration|import/.test(table))return 'Move-in records'
 if(/charge|receipt|payment|bill|journal|fee|trust|financial|reconcil|close|account|hap_|refund|tax|delinquency|utility/.test(table))return 'Accounts and payments'
 return 'Office and property records'
}
const uuid = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi
export function presentation(rows: Map<string, ExportRow[]>) {
 const refs=new Map<string,string>();let serial=0
 const reference=(id:string) => {if(!refs.has(id))refs.set(id,`Record ${String(++serial).padStart(4,'0')}`);return refs.get(id)!}
 const singular:Record<string,string>={tt_tenancies:'Tenancy',tt_charges:'Charge',tt_receipts:'Receipt',tt_inspections:'Inspection',tt_maintenance_jobs:'Maintenance job'}
 for(const [table,list] of rows)for(const row of list)if(typeof row.id==='string')refs.set(row.id,`${singular[table]??tableLabel(table)+' record'} ${String(++serial).padStart(4,'0')}`)
 function text(value:string):string {
  if(refs.has(value))return refs.get(value)!
  return value.replace(uuid,reference).replace(/\b\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})?)?\b/g,s=>{
   if(!s.includes('T'))return usDate(s)
   const d=new Date(s);return Number.isNaN(d.getTime())?usDate(s):new Intl.DateTimeFormat('en-US',{dateStyle:'medium',timeStyle:'short',timeZone:'UTC'}).format(d)+' UTC'
  }).replace(/\b(?:ACCT|AGENT|BASE(?:-AGENT)?|BOUND|LEASE|MOVE|OPS|PAY|PORTAL|PORT|REPORT|ROLE|SAFE|TER|US)-\d{3}\b/g,'recorded policy').replace(/\b(?:tt_|ik_d1_|ik_|bs_)[a-z_]+\b/g,s=>label(s))
 }
 function render(value:unknown,key=''):string {
  if(value===null||value===undefined)return ''
  if(typeof value==='string'){
   if(/^[\s]*[\[{]/.test(value)){try{return render(JSON.parse(value),key)}catch{ /* User prose that begins with punctuation. */ }}
   if(/(?:^id$|_id$|_by$)/.test(key)&&value&&!value.includes(' '))return reference(value)
   return text(/(?:^|_)(?:action|command|operation|kind|state|outcome|role|policy)$/.test(key)?value.replace(/[_.:]/g,' '):value)
  }
  if(Array.isArray(value))return value.map(v=>render(v,key)).join(' | ')
  if(typeof value==='object')return Object.entries(value).map(([k,v])=>`${text(label(k))}: ${render(v,k)}`).join('; ')
  if(typeof value==='number'&&/(?:_cents|Cents)$|^(?:debit|credit|resident_delta|pha_delta)$/.test(key))return (value/100).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:8,useGrouping:false})
  return String(value)
 }
 return {render,reference}
}
