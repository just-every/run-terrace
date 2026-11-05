import { one, type Context } from './core'

export const EMPTY_RESTORE = 'This installation already has product data. Restore into a separate, empty installation; existing records were not replaced.'
/** Product writes and imports retain evidence even when a tenancy was erased. */
export async function restoreOccupied(c: Context) {
 return !!await one(c, 'SELECT 1 WHERE EXISTS(SELECT 1 FROM tt_tenancies) OR EXISTS(SELECT 1 FROM tt_audit) OR EXISTS(SELECT 1 FROM ik_jobs) OR EXISTS(SELECT 1 FROM tt_erasures)')
}
