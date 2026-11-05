import { all, type Context } from './core'

/** Display evidence only. These records never establish an account or grant access. */
export function recordedActorNameSql(actor: string): string {
 return `CASE WHEN ${actor} IS NULL THEN NULL WHEN ${actor}='scheduler:workflows' THEN 'Workflow scheduler' ELSE COALESCE(
  (SELECT NULLIF(display_name,'') FROM oa_operators WHERE id=${actor}),
  (SELECT label||' (API credential)' FROM tt_api_credentials WHERE id=${actor}),
  (SELECT CASE kind WHEN 'operator' THEN display_name||' (former operator)' WHEN 'credential' THEN display_name||' (API credential)' ELSE display_name END FROM tt_recorded_actors WHERE id=${actor}),
  'Former operator') END`
}

export async function recordedActorNames(c: Context): Promise<Record<string, string>> {
 const rows = await all(c, `SELECT actors.id,${recordedActorNameSql('actors.id')} AS name FROM (
  SELECT id FROM tt_recorded_actors UNION SELECT id FROM oa_operators UNION SELECT id FROM tt_api_credentials
  UNION SELECT 'scheduler:workflows'
 ) actors`)
 return Object.fromEntries(rows.map(row => [row.id, row.name]))
}
