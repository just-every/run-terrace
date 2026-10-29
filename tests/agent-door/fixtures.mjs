const requireValue = (value, message) => { if (!value) throw new Error(message) }

export default async function fixtures({ request, origin, cookie, mail, phase }) {
 requireValue(cookie && mail, 'Native owner session and mail are required')
 const headers = { Origin: origin, Cookie: cookie, 'Content-Type': 'application/json' }
 const post = (path, body) => request(new URL(path, origin).href, { method: 'POST', redirect: 'manual', headers, body: JSON.stringify(body) })
 const command = async (name, args) => {
  const response = await post('/api/commands', { command: name, ...args })
  requireValue(response.status === 200, `Native ${name} failed`)
  const data = await response.json()
  requireValue(data.result?.id, `Native ${name} omitted its record`)
  return data.result
 }
 const suffix = crypto.randomUUID().slice(0, 8)
 const portfolio = await command('portfolio.add', { name: `Conformance ${suffix}` })
 const property = await command('property.add', { portfolioId: portfolio.id, name: `Conformance house ${suffix}`, address: '1 Fixture Road, Oakland, CA 94607', kind: 'multifamily', timeZone: 'America/Los_Angeles' })
 const unit = await command('unit.add', { propertyId: property.id, identifier: 'A', bedrooms: '2', bathrooms: '1' })
 const tenancy = await command('tenancy.create', { unitId: unit.id, ownerName: 'Fixture Owner', ownerEmail: 'fixture-owner@example.test', tenantName: 'Fixture Resident', tenantEmail: `fixture-${suffix}@example.test`, startDate: '2020-01-01', endDate: '2020-12-31', rent: '1500', cadence: 'monthly' })
 const job = await command('maintenance.prepare', { tenancyId: tenancy.id, title: 'Repair a tap', trade: 'plumbing', tradeName: 'Fixture Plumber', tradeEmail: 'plumber@example.test', dueDate: '2030-01-15', estimate: '180.00' })
 const since = Date.now()
 const sent = await post('/auth/step-up', { action: 'credentials:mint' })
 requireValue(sent.status === 202, 'Native step-up delivery failed')
 await sent.body?.cancel()
 const messages = mail.read({ after: since, limit: 20, maxAgeMs: 60000 })
 const message = messages.findLast(m => /\/auth\/confirm\?token=/.test(`${m.text ?? ''} ${m.html ?? ''}`))
 const match = `${message?.text ?? ''} ${message?.html ?? ''}`.match(/(?:https?:\/\/[^\s"<>]*)?\/auth\/confirm\?token=[^\s"<>]+/)
 requireValue(match, 'Native step-up confirmation was not captured')
 const link = new URL(match[0].replaceAll('&amp;', '&'), origin)
 requireValue(link.origin === origin && link.pathname === '/auth/confirm', 'Invalid native confirmation link')
 const confirmation = await post('/auth/confirm', { token: link.searchParams.get('token') })
 requireValue(confirmation.status === 303, 'Native step-up confirmation failed')
 await confirmation.body?.cancel()
 const label = `Conformance ${phase} ${suffix}`.slice(0, 80)
 const credential = await command('credential.mint', { label, role: 'portfolio_manager', scope: 'prepare', [`portfolio:${portfolio.id}`]: '1' })
 requireValue(credential.token, 'Native credential omitted its token')
 const enqueue = message => command('agent.enqueue', { credentialId: credential.id, action: 'arrears.prepare', arguments: { tenancyId: tenancy.id, message, followUpDate: '2030-01-15' }, purpose: 'Prepare an arrears follow-up for review', nextStep: 'Review the prepared proposal', dueOn: '2030-01-15' })
 const workload = await enqueue('Please contact us to discuss your rent balance.')
 const workloadSensitive = await enqueue('Please contact us regarding SSN 123-45-6789.')
 return { values: { tenancy, job, workload, workloadSensitive, portfolio, property, unit }, clients: { local: { token: credential.token, clientId: credential.id, agent: { id: credential.id, name: label, specialist: 'Residential portfolio steward' } } } }
}
