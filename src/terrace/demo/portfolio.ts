// The first two properties come from fixtures/terrace-tenancies.csv. Dates are
// relative to the visitor's start; all addresses and contacts are sample data.
export const portfolio = [
 { id: 'garden', address: '12 Garden Terrace, Paddington QLD 4064', owner: 'Morgan Wells', tenant: 'Alex Chen', rent: 72000, cadence: 'weekly', end: 75 },
 { id: 'fern', address: 'Unit 4, 80 Fern Street, Toowong QLD 4066', owner: 'Sam Rivers', tenant: 'Jordan Bell', rent: 128000, cadence: 'fortnightly', end: 190 },
 { id: 'banksia', address: '8 Banksia Avenue, Ashgrove QLD 4060', owner: 'Priya Shah', tenant: 'Taylor Brooks', rent: 81000, cadence: 'weekly', end: 28 },
 { id: 'river', address: 'Unit 11, 25 River Road, West End QLD 4101', owner: 'Chris Nguyen', tenant: 'Isabel Torres', rent: 265000, cadence: 'monthly', end: 245 },
 { id: 'jacaranda', address: '36 Jacaranda Street, New Farm QLD 4005', owner: 'Elena Rossi', tenant: 'Noah Williams', rent: 89000, cadence: 'weekly', end: 310 },
 { id: 'cedar', address: '5 Cedar Lane, Bardon QLD 4065', owner: 'David Okafor', tenant: 'Grace Martin', rent: 154000, cadence: 'fortnightly', end: 120 },
] as const

export const maintenance = [
 { property: 'garden', title: 'Replace kitchen mixer cartridge', trade: 'Harper Plumbing', email: 'harper@example.test', estimate: 24500, state: 'pending', due: 4 },
 { property: 'garden', title: 'Service living room air conditioner', trade: 'River City Cooling', email: 'cooling@example.test', estimate: 18000, state: 'approved', due: 8 },
 { property: 'fern', title: 'Repair balcony door latch', trade: 'Finch Property Repairs', email: 'finch@example.test', estimate: 16000, state: 'sent', due: -3 },
 { property: 'banksia', title: 'Replace worn smoke alarm battery', trade: 'Bright Electrical', email: 'bright@example.test', estimate: 9500, state: 'pending', due: 2 },
] as const
