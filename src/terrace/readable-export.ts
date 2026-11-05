// Display copy of operating records. The complete private backup remains the restore format.
import { readArchive, type Manifest, type Part } from '@runeditrun/rer/modules/portability'
import { allow, type Context } from './core'
import { backup } from './data'
import { csv, zip } from './exports'
import { documentExportCell } from './document-redaction'
import { label, tableLabel, group, internal, presentation, type ExportRow } from './readable-export-labels'
import { originals, isBlob, type ExportFile } from './readable-export-files'

export const RECONNECT = [
 'Shadow rent: source originals, mappings, differences, next actions and prior reviews are documentary evidence. Restored reviews are inert; capture and review a new comparison with current native statements. No cutover, collection or schedule is authorized.',
 'Stripe diagnostics: set the Stripe test secret privately, review the authorized account and scope, and reconcile existing references. Restored counters and setup metadata are evidence only; no collection is replayed.',
 'Resend mail diagnostics: reconnect the key and verified sender privately; review sending permission. No restored message is sent.',
 'SendGrid mail diagnostics: reconnect the key and verified sender privately; review Mail Send permission. No restored message is sent.',
 'Cloudflare mail diagnostics: reconnect the key, account and verified sender privately; review mail permission. No restored message is sent.',
 'RER mail diagnostics: reconnect the approved relay privately; origin validation remains Base-held. No restored message is sent.',
 'Restricted documents: readable metadata is redacted; private original files and the complete owner backup retain their exact bytes. Download authorization belongs to the current sign-in and must be requested again after restore.',
 'Office prints: frozen PDFs, manifests, approvals and service photographs are retained as evidence. Restored batches grant no printing or service authority; invite recipients again and prepare and approve a new batch.',
 'Applications: answers, originals, revisions and provider outcomes are retained. Applicant sign-in links, sessions and active Checkout destinations are installation-local. Restore never permits another collection; invite each adult again explicitly.',
 'Repair messages: archived content, frozen mail providers and recipients, verified delivery receipts and opt-outs are evidence only. Reconfigure mail verification and Twilio privately, record consent again and prepare new messages; restored callbacks and messages never authorize actions.',
 'Resident document delivery: frozen documents and delivery evidence are retained, but restored deliveries never authorize a send or a recipient. Invite the resident again and prepare a new reviewed document.',
 'Mail delivery: set MAIL_PROVIDER, MAIL_FROM and the provider key on the new installation; invitations and sign-in links use it.',
 'People: operator accounts and sessions are not in the archive. The new owner signs in, invites each person again and sets their role and portfolios (ROLE-001).',
 'Portal people: residents, owners and vendors with portal access are not in the archive. Invite each person again from Data & access (ROLE-002).',
 'Two-step sign-in: authenticators and recovery codes never leave an installation (SAFE-001). Each person sets up a new authenticator; re-enable the requirement if you used it.',
 'Identity provider: link your organisation’s OIDC provider again under Data & access if you used one.',
 'Card payments: provider references and ledger receipts are portable; Stripe credentials and active Checkout links stay in the originating installation. A restore repeats no collection.',
]


export async function readableExport(c: Context) {
 allow(c, 'data.restore')
 const archive=await backup(c), rows=new Map<string,ExportRow[]>()
 let manifest:Manifest|undefined
 for await(const line of readArchive(archive.body!)){
  if(line.kind==='manifest')manifest=line as Manifest
  if(line.kind==='part')for(const item of (line as Part).items)if(item.kind==='row'){
   if(!rows.has(item.table))rows.set(item.table,[])
   rows.get(item.table)!.push(item.row)
  }
 }
 const display=presentation(rows), stored=await originals(rows,display.reference)
 const restricted=new Set((rows.get('tt_documents')??[]).filter(row=>row.restriction).map(row=>row.id))
 const files:ExportFile[]=[...stored.files], groups=new Map<string,(string|number)[][]>()
 const primary:Record<string,string>={tt_tenancies:'Tenancies',tt_charges:'Charges',tt_receipts:'Receipts',tt_inspections:'Inspections',tt_maintenance_jobs:'Maintenance'}
 const counts:(string|number)[][]=[['Collection','Records','File']]
 for(const [table,list]of rows){
  if(!list.length||internal(table))continue
  const fields=Array.from(new Set(list.flatMap(row=>Object.keys(row))))
  if(stored.cells.has(list[0])&&stored.cells.get(list[0])!.has('original_file'))fields.push('original_file')
  const value=(row:ExportRow,key:string)=>{
   const file=stored.cells.get(row)?.get(key);if(file)return file
   const raw=documentExportCell(table,row,key,row[key],restricted)
   return isBlob(raw)?'Original file listed in File inventory.csv':display.render(raw,key)
  }
  if(primary[table]){
   const name=`${primary[table]}.csv`
   const headers=fields.map(key=>key==='id'?'Record reference':label(key).replace(/ cents$/i,' amount'))
   files.push([name,csv([headers,...list.map(row=>fields.map(key=>value(row,key)))])])
   counts.push([primary[table],list.length,name])
  }else{
   const name=group(table)
   if(!groups.has(name))groups.set(name,[['Record type','Record reference','Field','Value']])
   for(const [i,row]of list.entries()){
    const ref=display.reference(String(row.id??`${table} row ${i+1}`))
    for(const key of fields)groups.get(name)!.push([tableLabel(table),ref,key==='id'?'Record reference':label(key).replace(/ cents$/i,' amount'),value(row,key)])
    const original=stored.cells.get(row)?.get('original_file')
    if(original&&!fields.includes('original_file'))groups.get(name)!.push([tableLabel(table),ref,'Original file',original])
   }
   counts.push([tableLabel(table),list.length,`${name}.csv`])
  }
 }
 for(const [name,lines]of groups)files.push([`${name}.csv`,csv(lines)])
 files.push(['Collections.csv',csv(counts)])
 const readme=`# Terrace readable export

Exported ${display.render(manifest?.exportedAt??c.now)}.

Start with Tenancies, Charges, Receipts, Inspections and Maintenance when those collections contain records. Related operating records are grouped by the work they belong to. Collections.csv lists each included collection and its record count. Grouped sheets have one row per field, linked by a readable record reference. These references link records within this export; keep the private backup for restoring an installation.

Money amounts use decimal currency units, with the recorded currency alongside. Dates use month names; times are labelled UTC. Saved structured details are expanded into labelled text. Empty collections, sign-in secrets and internal installation bookkeeping are omitted. The private backup retains complete restore and custody information, including internal identifiers and erasure safeguards.

Original files contains stored originals, including earlier versions and assembled attachments, without changing their bytes. Original source documents can contain their own technical notation, dates and identifiers. File inventory.csv lists each original, its linked record, file size and SHA-256 checksum. Restricted document metadata is redacted; original files remain private and may contain sensitive information. Keep this entire export private.

## Reconnect after a restore

${RECONNECT.map(item=>'- '+display.render(item)).join('\n')}
`
 files.unshift(['README.md',readme])
 files.push(['File inventory.csv',csv([['File','Record reference','File size','SHA-256 checksum'],...stored.inventory])])
 return new Response(zip(files),{headers:{'content-type':'application/zip','content-disposition':'attachment; filename="terrace-readable-export.zip"','cache-control':'no-store'}})
}
