import { escape as e, money, type Row } from './core'
import { localTime, usDate } from './format'

export type PacketContext = { timeZone?: string; contacts?: Record<string, Row>; inspectionEvidence?: Row[] }
export const workReference = (snapshot: Row) => `WORK-${String(snapshot.jobId).replace(/[^a-z0-9]/gi, '').slice(0, 8).toUpperCase()}`
const roleLabels: Record<string,string> = {owner:'Owner',admin:'Administrator',portfolio_manager:'Portfolio manager',maintenance_coordinator:'Maintenance coordinator'}
export const approvalRole = (role: string) => roleLabels[role] ?? String(role || 'Staff').replaceAll('_', ' ')
const tasks = (s: Row): string[] => s.checklist?.length ? s.checklist : [s.title]
const zone = (s: Row, c: PacketContext) => s.timeZone ?? c.timeZone
const contact = (s: Row, c: PacketContext) => s.permittedContact ?? c.contacts?.[s.approvedBy]
const staff = (s: Row, c: PacketContext) => {
 const person = contact(s,c)
 return `${person?.display_name || 'Former staff member (name not retained)'}${person?.email ? ` <${person.email}>` : ' · email contact not retained'}`
}
const evidence = (s: Row, c: PacketContext): Row[] => s.inspectionEvidence ?? c.inspectionEvidence ?? []
const provenance = (s: Row, c: PacketContext) => [
 !s.permittedContact && c.contacts?.[s.approvedBy] ? 'Staff name and contact are from the current staff record; they were not saved with this approval.' : '',
 !s.timeZone && c.timeZone ? 'Approval time uses the current property timezone; the timezone was not saved with this approval.' : '',
 !s.inspectionEvidence && c.inspectionEvidence?.length ? 'Inspection references are from current records; they were not frozen with this approval.' : '',
].filter(Boolean)
export function maintenancePacketSubject(s: Row) {
 return `Approved Terrace work: ${s.title} · ${s.address} · ${workReference(s)}`.replace(/[\r\n]/g, ' ')
}
export function maintenancePacketFilename(s: Row) {
 const slug = [s.address,s.title].join('-').normalize('NFKD').replace(/[^a-zA-Z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,120)
 return `${slug || 'maintenance'}-${workReference(s)}.eml`
}
/** The approved terms come only from the immutable snapshot. Current context is labelled separately. */
export function maintenancePacketText(s: Row, c: PacketContext = {}) {
 const inspections = evidence(s,c)
 return [
 `Hello ${s.tradeName},`, '', `Please arrange the approved maintenance work at ${s.address}.`, '',
 `Work: ${s.title}`, `Job reference: ${workReference(s)}`, `Approved version: ${s.version}`,
 `Vendor: ${s.tradeName} <${s.tradeEmail}>`, `Scope: ${s.scope || s.title}`,
 `Approved estimate / spend limit: ${money(s.estimateCents,s.currency)}`, `Due date: ${usDate(s.dueDate)}`,
 '', 'Approved task checklist:', ...tasks(s).map(task => `[ ] ${task}`), '',
 s.appointment ? `Arrival: ${localTime(s.appointment.starts,s.appointment.zone)} to ${localTime(s.appointment.ends,s.appointment.zone)} (${s.appointment.state})` : 'Arrival appointment: not booked; contact staff before attending.',
 `Approved by: ${staff(s,c)} (${s.approvedRoleLabel ?? approvalRole(s.approvedRole)})`,
 `Approved at: ${localTime(s.approvedAt,zone(s,c) ?? 'UTC')}${zone(s,c) ? ` · ${zone(s,c)}` : ' · UTC (property timezone not retained)'}`,
 ...(s.approvalLabel ? [`Approval note: ${s.approvalLabel}`] : []),
 ...(s.ownerDecision ? [`Owner decision: ${s.ownerDecision.decision} · ${s.ownerDecision.label} · ${String(s.ownerDecision.source).replaceAll('_',' ')} · ${s.ownerDecision.reference}`] : []),
 '', 'Inspection references (context for the work):',
 ...(inspections.length ? inspections.map(i => `${usDate(i.date)} · ${i.state === 'completed' ? 'Completed inspection' : 'Draft inspection'}${i.photos.length ? ': '+i.photos.map((p: Row)=>p.filename).join('; ') : ' · no original photos retained'}`) : ['No inspection/photo reference was saved with this approval.']),
 'Original inspection files are held in Terrace. Ask the staff contact above for the relevant originals before attending.',
 ...provenance(s,c), '',
 'Reply to staff to arrange access and confirm acceptance, arrival, blockers, parts needed and completion. Staff record replies with their source; technician completion does not confirm the resident issue is resolved.',
 ].join('\n')
}
/** Human-readable approval and dispatch history; internal identifiers remain in the stored snapshot. */
export function maintenancePacketEvidence(s: Row, c: PacketContext = {}) {
 const inspections = evidence(s,c)
 const values: [string,unknown][] = [
 ['Job reference',workReference(s)], ['Property',s.address], ['Approved work',s.title], ['Scope',s.scope || s.title],
 ['Vendor',`${s.tradeName} · ${s.tradeEmail}`], ['Approved estimate / spend limit',money(s.estimateCents,s.currency)],
 ['Due date',usDate(s.dueDate)], ['Approved by',staff(s,c)], ['Approval role',s.approvedRoleLabel ?? approvalRole(s.approvedRole)],
 ['Approved at',`${localTime(s.approvedAt,zone(s,c) ?? 'UTC')}${zone(s,c) ? ` · ${zone(s,c)}` : ' · UTC (property timezone not retained)'}`], ['Approved version',s.version],
 ...(s.approvalLabel ? [['Approval note',s.approvalLabel] as [string,unknown]] : []),
 ...(s.ownerDecision ? [['Owner decision',`${s.ownerDecision.decision} · ${s.ownerDecision.label} · ${String(s.ownerDecision.source).replaceAll('_',' ')} · ${s.ownerDecision.reference}`] as [string,unknown]] : []),
 ...(s.appointment ? [['Arrival',`${localTime(s.appointment.starts,s.appointment.zone)} to ${localTime(s.appointment.ends,s.appointment.zone)} · ${s.appointment.state}`] as [string,unknown]] : []),
 ]
 return `<dl class="maintenance-evidence">${values.map(([label,value])=>`<dt>${e(label)}</dt><dd>${e(value)}</dd>`).join('')}</dl><p>Approved task checklist</p><ul>${tasks(s).map(task=>`<li>${e(task)}</li>`).join('')}</ul><p>Inspection references (context for the work)</p>${inspections.length ? `<ul>${inspections.map(i=>`<li>${usDate(i.date)} · ${i.state === 'completed' ? 'Completed inspection' : 'Draft inspection'}${i.photos.length ? `<ul>${i.photos.map((p: Row)=>`<li>${p.url ? `<a href="${e(p.url)}">${e(p.filename)}</a>` : e(p.filename)}</li>`).join('')}</ul>` : ' · no original photos retained'}</li>`).join('')}</ul>` : '<p>No inspection/photo reference was saved with this approval.</p>'}${provenance(s,c).map(note=>`<p>${e(note)}</p>`).join('')}`
}
