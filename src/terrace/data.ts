import { createPortability, readArchive, type Manifest, type Part, type Closing, type LaterJournal } from '../modules/portability/index.mjs'
import policy from './archive-policy.mjs'
import { audit, Fault, guard, insist, allow, sha256, sql, tenancy, text, type Context, type Row } from './core'
import { retireTenancy } from './imports'
export const portable = (c:Context) => createPortability({db:c.db,policy})
export async function backup(c:Context) {
 allow(c,'data.restore')
 const service=await portable(c), job=await service.exports.create('role:owner')
 try { while((await service.exports.advance(job,{maxParts:16})).phase==='building') {} return new Response(await service.exports.download(job),{headers:{'content-type':'application/x-ndjson','content-disposition':'attachment; filename="terrace-backup.rer"','cache-control':'no-store'}}) }
 catch(e) {await service.exports.abort(job);throw e}
}
async function archive(file:unknown) {
 insist(file instanceof File && file.size>0 && file.size<=20*1024*1024,'archive_file','Choose a Terrace .rer archive up to 20 MB. Use rer import for larger archives.')
 const records=[]; for await (const line of readArchive(file.stream())) records.push(line)
 return records
}
export async function dataCommand(c:Context,command:string,p:Row):Promise<Row|undefined> {
 if(command==='data.restore') {
  allow(c, command);insist(p.confirm==='RESTORE','confirmation','Type RESTORE to confirm importing into an empty installation.')
  const records=await archive(p.backup),manifest=records[0] as Manifest,closing=records.at(-1) as Closing
  let laterJournal:LaterJournal|undefined
  if(p.journal instanceof File && p.journal.size>0) { const latest=(await archive(p.journal))[0] as Manifest;laterJournal={sourceIdentity:latest.sourceIdentity,epoch:latest.epoch,journal:latest.journal} }
  const service=await portable(c), job=await service.imports.create(manifest,'role:owner')
  try {for(const part of records.filter(r=>r.kind==='part') as Part[]) await service.imports.uploadPart(job,part.index,part);await service.imports.finalize(job,{archiveHash:closing.archiveHash,contentHash:closing.contentHash,laterJournal})}
  catch(e){await service.imports.abort(job);if(String((e as any).code).startsWith('erasure_'))throw new Fault('erasure_fence','This older archive is blocked by the later erasure journal. Restore a backup made after the erasure.',409);throw e}
  return {notice:'Archive restored. Your current sign-in remains in this installation.'}
 }
 if(command==='tenancy.erase') {
  allow(c, command);const row=await tenancy(c,p.tenancyId)
  insist(p.confirm===row.tenant_email,'confirmation','Type the exact tenant email to confirm permanent tenancy erasure.')
  const service=await portable(c)
  const checkpoint=await service.redactionStatements()
  const native=[guard(c,"EXISTS(SELECT 1 FROM oa_operators WHERE id=? AND status='active' AND role='owner' AND version=?)",c.actor.id,c.actor.version??1),guard(c,'EXISTS(SELECT 1 FROM tt_tenancies WHERE id=? AND version=?)',row.id,row.version),sql(c,'INSERT INTO tt_erasures(subject,erased_at) VALUES(?,?) ON CONFLICT DO NOTHING',await sha256(new TextEncoder().encode(row.tenant_email)),c.now),sql(c,'DELETE FROM tt_tenancies WHERE id=?',row.id),audit(c,command,row.id)]
  await retireTenancy(c,row,native,checkpoint)
  return {notice:'Tenancy, dependent records, photos and import custody erased. Download a new backup to retain the restore fence.',tenancyId:''}
 }
}
