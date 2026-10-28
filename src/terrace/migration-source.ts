import { canonicalJson, sha256 } from '../modules/import-kit/src/d1/index.ts'
import { date, email, Fault, insist, text, type Row } from './core'
import { anyZone } from './zones'
import { scan } from './document-scan'

export const MIGRATION_FORMAT = 'terrace-migration-v1'
export const MIGRATION_KINDS = ['owner','property','household','lease','vendor','document','deposit','charge','bill','work','schedule','vendor_ytd','owner_ytd','history','opening'] as const
export type MigrationKind = typeof MIGRATION_KINDS[number]
export type MigrationRecord = { kind: MigrationKind; ref: string; value: Row; targetId: string; excluded: boolean }
export type MigrationIssue = { key: string; kind: string; ref: string; message: string; resolved: boolean; reason: string; action: string }
export type MigrationSource = { original: string; source: Row; namespace: string; cutover: string; records: MigrationRecord[]; issues: MigrationIssue[]; artifacts: Row[]; counts: Row; trial: Row[] }
export const migrationId = (namespace: string, kind: string, ref: string) => 'move-' + sha256(canonicalJson([namespace,kind,ref]))
const ref = (v: unknown) => { const s = text(v,'Source reference',100); insist(/^[A-Za-z0-9][A-Za-z0-9_.-]*$/.test(s),'migration_reference','References use letters, digits, dots, underscores and hyphens.'); return s }
const amount = (v: unknown, signed = false) => { insist(Number.isSafeInteger(v) && Math.abs(Number(v)) <= 100_000_000 && (signed || Number(v) >= 0),'migration_money','Money must be integer cents, at most 100,000,000 per value.'); return Number(v) }
const positive = (v: unknown) => { const n = amount(v); insist(n > 0,'migration_money','Amount must be positive.'); return n }
const choice = (v: unknown, choices: string[]) => { insist(typeof v === 'string' && choices.includes(v),'migration_value','Choose one of: ' + choices.join(', ') + '.'); return v }
const list = (v: unknown, label: string): Row[] => { insist(Array.isArray(v),'migration_shape',label + ' must be an array.'); return v }
const obj = (v: unknown): Row => { insist(v && typeof v === 'object' && !Array.isArray(v),'migration_shape','Each source row must be an object.'); return v as Row }
const named = (p: Row, key: string, max = 500) => text(p[key],key,max)

/** The original stays byte-for-byte intact. Field maps select columns without rewriting it. */
export async function migrationSource(input: unknown): Promise<MigrationSource> {
 insist(typeof input === 'string' && new TextEncoder().encode(input).length <= 1_000_000,'migration_size','Choose a UTF-8 migration manifest up to 1 MB.')
 let source: Row
 try { source = obj(JSON.parse(input)) } catch { throw new Fault('migration_shape','The migration manifest must be a JSON object.') }
 insist(source.format === MIGRATION_FORMAT,'migration_format','Choose the Terrace migration v1 format.')
 const namespace = ref(source.namespace), cutover = date(source.cutoverDate), rows = list(source.records,'Records'), issues: MigrationIssue[] = []
 insist(rows.length > 0 && rows.length <= 100,'migration_size','Review between 1 and 100 source records per manifest.')
 const resolutions = list(source.resolutions ?? [],'Resolutions'), seen = new Set<string>(), artifacts: Row[] = []
 const add = (key: string, kind: string, sourceRef: string, message: string, actions: string[] = []) => {
  const resolution = resolutions.find(r => r.key === key)
  const resolved = !!resolution && actions.includes(resolution.action) && typeof resolution.reason === 'string' && !!resolution.reason.trim() && resolution.reason.trim().length <= 1000
  issues.push({key,kind,ref:sourceRef,message,resolved,reason:resolved ? resolution.reason.trim() : '',action:resolved ? resolution.action : ''})
 }
 for (const a of list(source.artifacts ?? [],'Artifacts')) {
  const key = ref(a.ref)
  insist(!artifacts.some(x=>x.ref===key),'migration_artifact','Artifact references must be unique.')
  let bytes: Uint8Array
  try { bytes = Uint8Array.from(atob(named(a,'base64',1_000_000)), ch=>ch.charCodeAt(0)) } catch { throw new Fault('migration_artifact','An original has invalid base64 bytes.') }
  const type = named(a,'type',100), result = await scan(bytes,type), digest = sha256(bytes)
  if (!result.ok) add('artifact:' + key,'artifact',key,result.reason)
  artifacts.push({ref:key,name:named(a,'name',200),type,base64:a.base64,bytes,sha256:digest,size:bytes.length,scan:result.ok ? result.label : 'refused',contentText:result.ok ? result.text : null})
 }
 const records: MigrationRecord[] = []
 for (const sourceRow of rows) {
  const kind = choice(sourceRow.kind,[...MIGRATION_KINDS]) as MigrationKind, sourceRef = ref(sourceRow.ref), key = kind + ':' + sourceRef
  insist(!seen.has(key),'migration_duplicate_ref','A source kind and reference must occur once: ' + key)
  seen.add(key)
  const original = obj(sourceRow.data), map = obj(source.fieldMap?.[kind] ?? {}), p: Row = {...original}
  for (const [field,column] of Object.entries(map)) p[field] = original[text(column,'Source column',100)]
  const r: MigrationRecord = {kind,ref:sourceRef,value:p,targetId:migrationId(namespace,kind,sourceRef),excluded:false}
  records.push(r)
  const exclude = (message: string) => { add('exclude:' + key,kind,sourceRef,message,['exclude']); r.excluded = issues.at(-1)!.resolved }
  if ((kind==='lease' && p.leaseType !== 'residential') || (kind==='property' && ['commercial','association','hoa'].includes(String(p.kind).toLowerCase()))) {
   exclude('BOUND-004: commercial or association records stay in their specialist system and are never loaded as residential records.'); continue
  }
  try {
   if (kind==='owner') { p.name=named(p,'name',200); p.email=email(p.email); p.kind=choice(p.kind,['individual','entity']); p.mailingAddress=named(p,'mailingAddress'); p.w9=choice(p.w9,['not_requested','requested','received']) }
   if (kind==='property') {
    p.name=named(p,'name',200);p.address=named(p,'address');p.kind=choice(p.kind,['single_family','duplex','multifamily','townhouse','condo']);p.timeZone=anyZone(p.timeZone);p.ownershipFrom=date(p.ownershipFrom)
    p.owners=list(p.owners,'Property owners').map(s=>({ownerRef:ref(s.ownerRef),shareBp:positive(s.shareBp)}))
    insist(p.owners.length && new Set(p.owners.map((s:Row)=>s.ownerRef)).size===p.owners.length && p.owners.reduce((n:number,s:Row)=>n+s.shareBp,0)===10000,'migration_ownership','Property shares must total 10,000 basis points with distinct owners.')
   }
   if (kind==='household') {
    p.identity=ref(p.identity);p.name=named(p,'name',200);p.email=email(p.email)
    p.members=list(p.members ?? [],'Household members').map(m=>({role:choice(m.role,['co_tenant','guarantor','occupant','emergency_contact','authorized_contact']),name:named(m,'name',200),email:m.email?email(m.email):null,phone:m.phone?text(m.phone,'Phone',100):null}))
    const duplicate = records.find(x=>x!==r && x.kind===kind && (x.value.identity===p.identity || (x.value.name===p.name && x.value.email===p.email)) && !x.excluded)
    if (duplicate) exclude('Duplicate household of ' + duplicate.ref + '. Remove this duplicate or exclude it and map its leases to the retained household.')
   }
   if (kind==='lease') {
    p.propertyRef=ref(p.propertyRef);p.householdRef=ref(p.householdRef);p.ownerRef=ref(p.ownerRef);p.unit=named(p,'unit',100);p.starts=date(p.starts);p.ends=date(p.ends);p.rentCents=positive(p.rentCents);p.cadence=choice(p.cadence,['weekly','fortnightly','monthly']);p.depositCents=amount(p.depositCents);p.historyFrom=date(p.historyFrom);p.historyOpeningCents=amount(p.historyOpeningCents,true)
    insist(p.ends>=p.starts && p.starts<cutover,'migration_lease','Lease dates must be ordered and start before cutover.')
    const twoYears = new Date(cutover + 'T00:00:00.000Z');twoYears.setUTCFullYear(twoYears.getUTCFullYear()-2)
    if (p.historyFrom>twoYears.toISOString().slice(0,10) && p.historyFrom>p.starts) add('history-coverage:' + key,kind,sourceRef,'History must cover at least the previous 24 months, or the whole lease if newer.')
   }
   if (kind==='vendor') {
    p.name=named(p,'name',200);p.email=email(p.email);p.phone=named(p,'phone',100);p.specialties=named(p,'specialties',200);p.serviceAreas=named(p,'serviceAreas',200);p.w9=choice(p.w9,['received','missing']);p.insuranceExpires=date(p.insuranceExpires);p.availability=named(p,'availability',200)
    p.licenseNumber=p.licenseNumber?text(p.licenseNumber,'License number',100):null;p.licenseExpires=p.licenseNumber?date(p.licenseExpires):null
    p.dba=String(p.dba??'');p.tinStatus=choice(p.tinStatus,['missing','restricted_source','verified_external']);p.eligible1099=!!p.eligible1099;p.box=named(p,'box',50);p.paymentMethod=choice(p.paymentMethod,['check','ach','other']);p.remitAddress=named(p,'remitAddress')
    if(p.w9!=='received')add('w9:' + key,kind,sourceRef,'Vendor has no W-9. Retain its missing status; importing never qualifies it or authorizes payment.',['hold'])
   }
   if (['document','deposit','charge','work','schedule','history'].includes(kind)) p.leaseRef=ref(p.leaseRef)
   if (['work','schedule','bill','vendor_ytd'].includes(kind)) p.vendorRef=ref(p.vendorRef)
   if (['bill','owner_ytd','opening'].includes(kind)) p.propertyRef=ref(p.propertyRef)
   if (['owner_ytd','opening'].includes(kind)) p.ownerRef=ref(p.ownerRef)
   if (['document','bill'].includes(kind)) p.artifactRef=ref(p.artifactRef)
   if (kind==='document') {p.title=named(p,'title',200);p.documentKind=choice(p.documentKind,['lease','application','screening','notice','tax','other'])}
   if (['deposit','charge','bill','work','schedule','history'].includes(kind)) p.amountCents=positive(p.amountCents)
   if (['deposit','charge','bill','history'].includes(kind)) { p.day=date(p.day);p.reference=named(p,'reference',150);insist(p.day<cutover,'migration_date','Historical activity must precede cutover.') }
   if (['charge','bill','work','schedule'].includes(kind)) p.description=named(p,'description',300)
   if (['work','schedule'].includes(kind)) p.dueDate=date(p.dueDate)
   if (kind==='schedule') {p.intervalMonths=positive(p.intervalMonths);insist(p.intervalMonths<=60,'migration_schedule','Interval must be at most 60 months.');insist(p.dueDate>=cutover,'migration_schedule','Future schedules must start on or after cutover.');p.trade=named(p,'trade',100)}
   if (kind==='work') {p.trade=named(p,'trade',100);p.sourceState=named(p,'sourceState',100)}
   if (kind==='bill') p.invoiceNumber=named(p,'invoiceNumber',150)
   if (kind==='history') {
    p.type=choice(p.type,['charge','receipt','credit','returned_payment','deposit']);p.deltaCents=amount(p.deltaCents,true)
    const delta=['charge','returned_payment'].includes(p.type)?p.amountCents:['receipt','credit'].includes(p.type)?-p.amountCents:0
    insist(p.deltaCents===delta,'migration_history','History movement must match its transaction kind and amount; deposit activity has no receivable effect.')
   }
   if (['vendor_ytd','owner_ytd'].includes(kind)) {
    p.year=Number(cutover.slice(0,4));p.reference=named(p,'reference',150)
    if(kind==='vendor_ytd')p.reportableCents=amount(p.reportableCents)
    else {p.incomeCents=amount(p.incomeCents);p.expenseCents=amount(p.expenseCents)}
   }
   if (kind==='opening') {
    p.fund=choice(p.fund,['operating','deposit']);p.lines=list(p.lines,'Opening lines').map(l=>({account:named(l,'account',40),debit:amount(l.debit),credit:amount(l.credit)}))
    insist(p.lines.length>=2 && p.lines.length<=100 && p.lines.every((l:Row)=>(l.debit===0)!==(l.credit===0)) && p.lines.reduce((n:number,l:Row)=>n+l.debit-l.credit,0)===0,'migration_opening','Each opening bucket must balance with positive debit or credit lines.')
   }
  } catch (error) { if (!(error instanceof Fault)) throw error; add('invalid:' + key,kind,sourceRef,error.message) }
 }
 for (const kind of MIGRATION_KINDS) {
  const actual = records.filter(r=>r.kind===kind).length, expected = source.inventory?.[kind]
  if (!Number.isSafeInteger(expected) || expected!==actual) add('count:' + kind,kind,'inventory','Source inventory count does not match the supplied ' + kind + ' records.')
 }
 for (const r of records.filter(r=>!r.excluded)) {
  const p=r.value, key=r.kind+':'+r.ref
  for (const [field,kind] of Object.entries({propertyRef:'property',ownerRef:'owner',householdRef:'household',leaseRef:'lease',vendorRef:'vendor'})) if (p[field] && !records.some(x=>x.kind===kind&&x.ref===p[field]&&!x.excluded)) add('reference:'+key+':'+field,r.kind,r.ref,'Missing or excluded ' + kind + ' reference ' + p[field] + '.')
  if(p.artifactRef&&!artifacts.some(a=>a.ref===p.artifactRef))add('original:'+key,r.kind,r.ref,'Missing original file ' + p.artifactRef + '.')
  if(r.kind==='property') for(const s of Array.isArray(p.owners)?p.owners:[])if(!records.some(x=>x.kind==='owner'&&x.ref===s.ownerRef&&!x.excluded))add('owner:'+key+':'+s.ownerRef,r.kind,r.ref,'Missing property owner ' + s.ownerRef + '.')
  if(r.kind==='lease') {
   const prop=records.find(x=>x.kind==='property'&&x.ref===p.propertyRef&&!x.excluded)
   if(prop&&Array.isArray(prop.value.owners)&&!prop.value.owners.some((s:Row)=>s.ownerRef===p.ownerRef))add('beneficiary:'+key,r.kind,r.ref,'The lease owner must belong to its property.')
   const deposits=records.filter(x=>x.kind==='deposit'&&x.value.leaseRef===r.ref&&!x.excluded).reduce((n,x)=>n+Number(x.value.amountCents??0),0)
   if(deposits!==p.depositCents)add('deposit:'+key,r.kind,r.ref,'Missing deposit or mismatched deposit balance: expected ' + p.depositCents + ' cents; supplied ' + deposits + '.')
   const history=records.filter(x=>x.kind==='history'&&x.value.leaseRef===r.ref&&!x.excluded),closing=history.reduce((n,x)=>n+Number(x.value.deltaCents??0),Number(p.historyOpeningCents??0))
   const charges=records.filter(x=>x.kind==='charge'&&x.value.leaseRef===r.ref&&!x.excluded).reduce((n,x)=>n+Number(x.value.amountCents??0),0)
   if(closing!==charges)add('history:'+key,r.kind,r.ref,'Resident history closing balance differs from unpaid charges: ' + closing + ' versus ' + charges + ' cents.')
   if(history.some(h=>h.value.day<p.historyFrom))add('history-date:'+key,r.kind,r.ref,'A history line predates the declared history opening.')
   if(records.some(x=>x!==r&&x.kind==='lease'&&!x.excluded&&x.value.propertyRef===p.propertyRef&&x.value.unit===p.unit&&x.value.starts<=p.ends&&x.value.ends>=p.starts))add('overlap:'+key,r.kind,r.ref,'Two leases overlap on this property and unit.')
  }
 }
 for(const resolution of resolutions) if(!issues.some(x=>x.key===resolution.key)) add('unused-resolution:'+ref(String(resolutions.indexOf(resolution))), 'resolution','review','A resolution no longer matches an exception. Remove it and preview again.')
 const counts=Object.fromEntries(MIGRATION_KINDS.map(kind=>{const group=records.filter(r=>r.kind===kind);return[kind,{source:group.length,imported:group.filter(r=>!r.excluded).length,excluded:group.filter(r=>r.excluded).length}]}))
 return {original:input,source,namespace,cutover,records,issues,artifacts,counts,trial:list(source.trialBalance,'Source trial balance')}
}
