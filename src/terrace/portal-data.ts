import {ownerPayerBalances} from './hap-portal'
import {vendorAppointmentProposals} from './portal-vendor-proposals'
import {vendorAppointments,vendorEstimates,vendorResponses} from './portal-vendor'
// ROLE-002: what each kind of portal person may read. Every function takes the one record a live grant names and projects
// only that record's fields: no owner contact, screening, bank, trust or other household data is ever selected.
import { all, one, type Context, type Row } from './core'
import { ledgerData } from './ledger'
import { ownerStatement } from './owners'

const day = (v: string) => new Date(Date.parse(v + 'T00:00:00Z') - 86400000).toISOString().slice(0, 10)

export async function residentData(c: Context, grant: Row) {
 const t = await one(c, 'SELECT t.id,t.address,t.start_date,t.end_date,t.ended_on,u.identifier AS unit,p.name AS property FROM tt_tenancies t LEFT JOIN tt_units u ON u.id=t.unit_id LEFT JOIN tt_properties p ON p.id=u.property_id WHERE t.id=? AND t.erased_at IS NULL', grant.tenancy_id)
 if (!t) return null
 const l = await ledgerData(c, t.id), delegate = grant.access === 'delegate'
 return {
  access: grant.access, tenancy: delegate ? { id: t.id, address: t.address } : { id: t.id, address: t.address, unit: t.unit ?? null, property: t.property ?? null, startDate: t.start_date, endDate: t.end_date, endedOn: t.ended_on ?? null },
  currency: l.currency, balanceCents: l.balanceCents, arrearsCents: l.arrearsCents,
  charges: l.charges.map(q => ({ id: q.id, dueDate: q.due_date, description: q.description, amountCents: q.amount_cents, balanceCents: q.balance_cents })),
  boundary: 'Recorded rent only. Payments are made outside Terrace.',
  ...(delegate ? {} : {
   housingAuthority:l.hapCharges.length?{balanceCents:l.hapBalanceCents,creditCents:l.hapCreditCents,charges:l.hapCharges.map(q=>({id:q.id,dueDate:q.due_date,payer:q.payer,amountCents:q.effective_amount_cents,balanceCents:q.balance_cents}))}:null,
   payerCorrections:l.hapEffects.map(x=>({id:x.id,kind:x.kind,residentDeltaCents:x.resident_delta,phaDeltaCents:x.pha_delta,postingDay:x.posting_day,effectiveFrom:x.effective_from,effectiveTo:x.effective_to})),
   receipts: l.receipts.map(r => ({ date: r.received_date, amountCents: r.amount_cents })),
   adjustments: l.adjustments.map(a => ({ date: a.at.slice(0, 10), amountCents: a.amount_cents })),
   delegates: (await all(c, "SELECT g.id,i.display_name FROM tt_portal_grants g JOIN tt_portal_identities i ON i.id=g.identity_id WHERE g.tenancy_id=? AND g.access='delegate' AND g.revoked_at IS NULL ORDER BY g.granted_at,g.id", t.id)).map(r => ({ grantId: r.id as string, name: r.display_name as string })),
  }),
 }
}
const cell = (v: unknown) => '"' + String(v ?? '').replaceAll('"', '""').replace(/^[=+@-]/, "'$&") + '"'
export function residentCsv(d: NonNullable<Awaited<ReturnType<typeof residentData>>>) {
 const rows: unknown[][] = [['Terrace account statement', d.tenancy.address], ['Currency', d.currency], ['Date', 'Kind', 'Description', 'Amount'],
  ...d.charges.map(q => [q.dueDate, 'Charge', q.description, (q.amountCents / 100).toFixed(2)]), ...(d.receipts ?? []).map(r => [r.date, 'Recorded payment', '', (r.amountCents / 100).toFixed(2)]), ...(d.adjustments ?? []).map(a => [a.date, 'Charge reduction', '', (a.amountCents / 100).toFixed(2)]),
  ...(d.payerCorrections??[]).map(x=>[x.postingDay,'Reviewed payer correction',x.effectiveFrom+' through '+x.effectiveTo,(x.residentDeltaCents/100).toFixed(2)]),['Resident balance', '', '', (d.balanceCents / 100).toFixed(2)],...(d.housingAuthority?[['Separate PHA balance','','',(d.housingAuthority.balanceCents/100).toFixed(2)],['PHA credit','','',(d.housingAuthority.creditCents/100).toFixed(2)]]:[]),[d.boundary]]
 return rows.map(r => r.map(cell).join(',')).join('\r\n') + '\r\n'
}

/** The properties an owner holds a share of and, for each, the dated periods they owned it. Other owners' names and shares are never read. */
export async function ownerData(c: Context, ownerId: string) {
 const mine = await all(c, 'SELECT s.id AS set_id,s.property_id,s.effective_from,h.share_bp FROM tt_ownership_shares h JOIN tt_ownership_sets s ON s.id=h.set_id WHERE h.owner_id=?', ownerId)
 const ids = [...new Set(mine.map(m => m.property_id))]
 if (!ids.length) return { properties: [] }
 const marks = ids.map(() => '?').join(','), props = await all(c, `SELECT id,name,address FROM tt_properties WHERE id IN (${marks}) ORDER BY name`, ...ids)
 const sets = await all(c, `SELECT id,property_id,effective_from FROM tt_ownership_sets WHERE property_id IN (${marks}) ORDER BY property_id,effective_from`, ...ids)
 const properties=await Promise.all(props.map(async p => {
  const list = sets.filter(s => s.property_id === p.id)
  return { id: p.id, name: p.name, address: p.address,payerBalances:await ownerPayerBalances(c,ownerId,p.id), periods: list.flatMap((s, i) => { const m = mine.find(x => x.set_id === s.id); return m ? [{ from: s.effective_from, to: list[i + 1] ? day(list[i + 1].effective_from) : null, shareBp: m.share_bp }] : [] }) }
 }));return {properties}
}
export async function ownerPeriodStatement(c: Context, ownerId: string, from: unknown, to: unknown, propertyId?: string) {
 const s = await ownerStatement(c, ownerId, from, to, propertyId)
 return { owner: { id: s.owner.id, name: s.owner.name }, from: s.from, to: s.to, rows: s.rows, totals: s.totals, reserves: s.reserves, fees: s.fees, expenses: s.expenses, cash: s.cash, boundary: s.boundary }
}

/** Approved or sent work currently assigned to the vendor, and the vendor's own bills with their original files. */
export async function vendorData(c: Context, vendorId: string) {
 const jobs = await all(c, "SELECT j.id,j.version,j.title,j.scope,j.checklist,j.state,j.due_date,j.estimate_cents,j.trade,t.address,t.time_zone FROM tt_maintenance_jobs j JOIN tt_tenancies t ON t.id=j.tenancy_id WHERE j.vendor_id=? AND j.state IN ('approved','sent') AND t.erased_at IS NULL ORDER BY j.due_date,j.id", vendorId)
 const bills = await all(c, 'SELECT b.id,b.invoice_number,b.day,b.state,b.version,(SELECT terms FROM tt_bill_revisions r WHERE r.bill_id=b.id AND r.version=b.version) AS terms FROM tt_bills b WHERE b.vendor_id=? ORDER BY b.day DESC,b.id', vendorId)
 const files = await all(c, 'SELECT a.id,a.bill_id,a.name,a.type,a.sha256 FROM tt_bill_attachments a JOIN tt_bills b ON b.id=a.bill_id WHERE b.vendor_id=? ORDER BY a.recorded_at', vendorId)
 return {
  appointmentProposals:await vendorAppointmentProposals(c,vendorId),
  responses: await vendorResponses(c,vendorId),
  appointments: await vendorAppointments(c,vendorId),
  estimates: await vendorEstimates(c,vendorId),
  jobs: jobs.map(j => ({ id: j.id, version:j.version, title: j.title, scope:j.scope, checklist:JSON.parse(j.checklist), state: j.state, trade: j.trade, dueDate: j.due_date, estimateCents: j.estimate_cents, address: j.address,timeZone:j.time_zone })),
  invoices: bills.map(b => ({ id: b.id, invoiceNumber: b.invoice_number, day: b.day, totalCents: b.terms ? JSON.parse(b.terms).totalCents ?? null : null, payment: b.state === 'payable' ? 'Approved as payable. Terrace makes no payment; the payer records it elsewhere.' : 'Awaiting approval', files: files.filter(f => f.bill_id === b.id).map(f => ({ id: f.id, name: f.name, type: f.type, sha256: f.sha256, url: '/portal/invoice-file?id=' + f.id })) })),
 }
}
export async function invoiceFile(c: Context, vendorId: string, fileId: string) {
 return one(c, 'SELECT a.name,a.type,a.bytes,a.sha256 FROM tt_bill_attachments a JOIN tt_bills b ON b.id=a.bill_id WHERE a.id=? AND b.vendor_id=?', fileId, vendorId)
}
