import { applyD1ImportBatches, createD1ImportJob, planD1Import, readD1ErasureJournal, readD1ImportJob, readD1ImportOriginals, retireD1ImportCustody, rollbackD1Import, undoD1Import } from '../modules/import-kit/src/d1/index.ts'
import { toD1Sql } from '../modules/erasure/index.mjs'
import { Context, Fault, Row, all, insist, one, allow, text } from './core'
import { IMPORT_DESTINATION, IMPORT_KIT, TENANCY_KIND, importNamespace, tenancyMapping, tenancySource } from './imports-source'
import { tenancyImportContext } from './imports-target'
import { officeZone } from './company'
export { importView } from './imports-view'
export { IMPORT_KIT, CSV_HEADERS, LEASE_TYPE_HEADER, OPTIONAL_HEADERS, RESIDENTIAL_ONLY, tenancySource, tenancyMapping, tenancyImportId } from './imports-source'

async function importOwner(c: Context) {
  allow(c, 'import.apply')
  insist(await one(c, "SELECT 1 FROM oa_operators WHERE id=? AND status='active' AND role='owner' AND version=?", c.actor.id, c.actor.version ?? 1), 'forbidden', 'Your owner access changed. Sign in again.', 403)
}

function csvInput(p: Row): unknown {
  if (p.csv !== undefined) return p.csv
  insist(typeof p.csvBase64 === 'string' && p.csvBase64.length <= 350_000, 'invalid_csv', 'CSV source is required.')
  try { return new TextDecoder('utf-8',{fatal:true}).decode(Uint8Array.from(atob(p.csvBase64), ch => ch.charCodeAt(0))) }
  catch { throw new Fault('invalid_csv', 'The preserved CSV source is invalid.') }
}

async function jobContext(c: Context, jobId: string) {
  const row = await one(c, 'SELECT namespace FROM ik_jobs WHERE id=? AND destination=? AND principal_id=?', jobId, IMPORT_DESTINATION, 'role:owner')
  // The kit resolves absent and retired job IDs without exposing another destination.
  return tenancyImportContext(c, row?.namespace ?? 'terrace-tenancies-v1')
}

/** POST /api/commands and owner forms both use this same authorization boundary.
 * Preview is read-only. Only import.apply accepts the owner's exact reviewed
 * fingerprint and creates/applies a durable job; it never approves a preview. */
export async function importCommand(c: Context, command: string, p: Row): Promise<Row | undefined> {
  if (!['import.preview','import.apply','import.undo','import.journal'].includes(command)) return undefined
  await importOwner(c)
  try {
    if (command === 'import.apply' && p.jobId !== undefined) {
      const jobId = text(p.jobId, 'Import job', 100), context = await jobContext(c,jobId)
      const current = await readD1ImportJob(jobId,context)
      insist(p.fingerprint === current.fingerprint, 'review_changed', 'The retained import changed. Review its journal before continuing.',409)
      insist(['queued','applying','completed'].includes(current.state), 'import_conflict', 'This import cannot continue forward. Review its journal or undo it.',409)
      return { kit: IMPORT_KIT, job: await applyD1ImportBatches(jobId, { ...context, reviewedFingerprint: current.fingerprint }) }
    }
    if (command === 'import.preview' || command === 'import.apply') {
      const namespace = importNamespace(p.namespace), csv = csvInput(p)
      const context = tenancyImportContext(c, namespace)
      const plan = await planD1Import(tenancySource(csv,namespace), tenancyMapping(await officeZone(c)), context)
      const rows = plan.entries.map(entry => ({ ref: entry.source.sourceId, sourceRow: entry.source.location.row, targetId: entry.effects[0]?.targetId, value: entry.effects[0]?.value, rejection: entry.rejection ?? null }))
      if (command === 'import.preview') {
        const original = plan.source.artifacts[0].original
        return { kit: IMPORT_KIT, namespace, csv, csvBase64: original?.status === 'available' ? original.base64 : '', fingerprint: plan.fingerprint, counts: plan.counts, diagnostics: plan.diagnostics, rows, approvalRequired: true }
      }
      const fingerprint = text(p.fingerprint, 'Reviewed fingerprint', 64)
      insist(/^[a-f0-9]{64}$/.test(fingerprint) && fingerprint === plan.fingerprint, 'review_changed', 'The CSV or namespace changed. Preview it and approve the new fingerprint.', 409)
      insist(plan.counts.rejected === 0 && !plan.diagnostics.some(d => d.severity === 'error'), 'invalid_import', 'Resolve every rejected record before approving this import.')
      const reviewed = tenancyImportContext(c, namespace, { reviewedFingerprint: fingerprint, operationKey: `terrace-csv:${fingerprint}` })
      const created = await createD1ImportJob(plan, reviewed)
      const job = await applyD1ImportBatches(created.id, reviewed)
      return { kit: IMPORT_KIT, job }
    }
    const jobId = text(p.jobId, 'Import job', 100), context = await jobContext(c,jobId)
    const current = await readD1ImportJob(jobId,context)
    if (command === 'import.undo') {
      const job = ['queued','applying','failed','rolling_back','rolled_back'].includes(current.state)
        ? await rollbackD1Import(jobId, context)
        : await undoD1Import(jobId, context)
      return { kit: IMPORT_KIT, job }
    }
    const originals = await readD1ImportOriginals(jobId,context)
    const journal = await all(c, 'SELECT action,position,end_position,fence FROM ik_batches WHERE job_id=? ORDER BY fence,position',jobId)
    const provenance = await all(c, 'SELECT source_identity,target_kind,target_id,reversed,record_json FROM ik_provenance WHERE job_id=? ORDER BY ordinal,effect_ordinal',jobId)
    const job = await readD1ImportJob(jobId,context)
    return { kit: IMPORT_KIT, job, originals, journal, provenance, erasureJournal: await readD1ErasureJournal(context) }
  } catch (error) {
    if (error instanceof Fault) throw error
    const code = error instanceof Error ? error.message : ''
    if (/^IMPORT_JOB_RETIRED$/.test(code)) throw new Fault('import_retired', `Import retired by erasure; receipt ${(error as Error & {receiptId?: string}).receiptId ?? 'recorded in erasure journal'}.`,410)
    if (/^(IMPORT_JOB_NOT_FOUND|JOB_BINDING_MISMATCH)$/.test(code)) throw new Fault('not_found','Import job not found.',404)
    if (code.includes('IMPORT_ATOMIC_GUARD') || code.includes('IMPORT_FINAL_GUARD')) throw new Fault('import_conflict','Your owner access, the import, or a tenancy changed. Reload and review it again.',409)
    if (code === 'NATIVE_EDIT_CONFLICT') throw new Fault('import_conflict','A tenancy has later edits or related work. Undo preserved that work and stopped.',409)
    if (code === 'TARGET_REVISION_CONFLICT') throw new Fault('import_conflict','A tenancy with this source reference already exists. This kit does not replace existing tenancies.',409)
    if (/^(IMPORT_|TARGET_|NATIVE_|OPERATION_KEY_|SOURCE_|STORED_|REVIEW_|UNDO_|REVERSAL_)/.test(code)) throw new Fault('import_conflict',code,409)
    if (code.includes('CHECK constraint')) throw new Fault('import_conflict','An erased tenant or later tenancy work prevents this change.',409)
    throw error
  }
}

export async function importData(c: Context) {
  await importOwner(c)
  const jobs = await all(c, 'SELECT id,namespace,mapping_version AS mappingVersion,fingerprint,state,checkpoint,total,error FROM ik_jobs WHERE destination=? AND principal_id=? ORDER BY rowid DESC LIMIT 30',IMPORT_DESTINATION,'role:owner')
  const erasureJournal = await readD1ErasureJournal(tenancyImportContext(c,'terrace-tenancies-v1'))
  await importOwner(c)
  return { kit: IMPORT_KIT, jobs, erasureJournal }
}

/** The caller supplies full native erasure and portability checkpoint statements.
 * Both commit atomically with withdrawn originals, import tombstones and journal.
 * Erasure addresses this tenancy only; an owner's other tenancies remain usable. */
export async function retireTenancy(c: Context, tenancyRow: Row, nativeStatements: D1PreparedStatement[], checkpoint: D1PreparedStatement[]) {
  await importOwner(c)
  const tenancyId = text(tenancyRow.id,'Tenancy',100)
  return retireD1ImportCustody(
    { target: { kind: TENANCY_KIND, id: tenancyId }, values: [tenancyId] },
    nativeStatements.map(toD1Sql), tenancyImportContext(c,'terrace-tenancies-v1'), checkpoint.map(toD1Sql),
  )
}
