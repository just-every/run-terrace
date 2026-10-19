// The first two tenancies come from fixtures/terrace-tenancies.csv. Dates are
// relative to the visitor's start; all addresses and contacts are sample data. `ref` is the manager's own
// short name for the unit, used in ledger references ("4C-2026-10").
export const portfolio = [
 { id: 'garden', ref: '2B', address: 'Unit 2B, 1840 Alder Street, Oakland, CA 94610', owner: 'Okafor Family Trust', tenant: 'Maya Chen', rent: 185000, cadence: 'monthly', end: 75 },
 { id: 'fern', ref: '3A', address: 'Unit 3A, 1840 Alder Street, Oakland, CA 94610', owner: 'Okafor Family Trust', tenant: 'Jordan Ellis', rent: 192500, cadence: 'monthly', end: 190 },
 { id: 'banksia', ref: '4C', address: 'Unit 4C, 1840 Alder Street, Oakland, CA 94610', owner: 'Okafor Family Trust', tenant: 'Luis Ortega', rent: 185000, cadence: 'monthly', end: 28 },
 { id: 'river', ref: 'GROVE', address: '2219 Grove Street, Berkeley, CA 94704', owner: 'Chris Nguyen', tenant: 'Isabel Torres', rent: 265000, cadence: 'monthly', end: 245 },
 { id: 'jacaranda', ref: 'LAKE6', address: 'Apt 6, 415 Lakeshore Avenue, Oakland, CA 94610', owner: 'Elena Rossi', tenant: 'Noah Williams', rent: 172500, cadence: 'monthly', end: 310 },
 { id: 'cedar', ref: 'CEDAR', address: '58 Cedar Lane, Alameda, CA 94501', owner: 'David Okafor', tenant: 'Grace Martin', rent: 215000, cadence: 'monthly', end: 120 },
 { id: 'oak', ref: '1C', address: 'Unit 1C, 1840 Alder Street, Oakland, CA 94610', owner: 'Okafor Family Trust', tenant: 'Theo Grant', rent: 175000, cadence: 'monthly', end: 12 },
 { id: 'maple', ref: '5A', address: 'Unit 5A, 1840 Alder Street, Oakland, CA 94610', owner: 'Okafor Family Trust', tenant: 'Dana Brooks', rent: 185000, cadence: 'monthly', end: 220 },
] as const

export const maintenance = [
 { property: 'garden', title: 'Replace kitchen faucet cartridge', trade: 'Harper Plumbing', email: 'harper@example.test', estimate: 24500, state: 'pending', due: 4 },
 { property: 'garden', title: 'Service living room air conditioner', trade: 'Bay City Cooling', email: 'cooling@example.test', estimate: 18000, state: 'approved', due: 8 },
 { property: 'fern', title: 'Replace kitchen sink P-trap', trade: 'Bayline Plumbing', email: 'bayline@example.test', estimate: 38500, state: 'sent', due: -3 },
 { property: 'banksia', title: 'Replace smoke alarm battery', trade: 'Bright Electric', email: 'bright@example.test', estimate: 9500, state: 'pending', due: 2 },
] as const
