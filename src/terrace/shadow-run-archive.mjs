import {ArchiveValidationError} from './archive-validation.mjs'
import {canonicalJson,sha256} from '../modules/import-kit/src/d1/index.ts'

/** Archived comparisons retain their exact original and review without restoring authority. */
export async function validateShadowArchive(db,tables){
 const runs=tables.tt_shadow_runs
 if(!runs)return
 for(const r of (await db.prepare(`SELECT * FROM "${runs}"`).all()).results){
  const bytes=new Uint8Array(r.original)
  const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(x=>x.toString(16).padStart(2,'0')).join('')
  const fingerprint=sha256(canonicalJson({hash,rows:JSON.parse(r.mapped_rows),snapshot:JSON.parse(r.snapshot),reference:r.source_reference,synthetic:!!r.synthetic}))
  if(hash!==r.sha256||fingerprint!==r.fingerprint)throw new ArchiveValidationError('Shadow comparison source bytes or retained snapshot differ from their exact review.')
 }
}
