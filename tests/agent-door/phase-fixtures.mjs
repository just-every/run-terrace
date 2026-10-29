import { randomUUID } from 'node:crypto';
import { nativeHttp, stepUp } from './native-http.mjs';

const specialist = 'Residential portfolio steward';
let current;
export const currentFixture = () => current;
const day = value => value.toISOString().slice(0, 10);

export default async function prepare(context) {
 const { phase } = context, { command, send } = nativeHttp(context);
 if (!context.cookie) throw new Error('Native phase preparation requires the signed-in owner');
 if (phase === 'initial') {
  const setup = await send('/setup', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ confirm: 'yes' }).toString() });
  if (setup.status !== 303) { await setup.body?.cancel(); throw new Error('Native first-run confirmation failed'); }
  await setup.body?.cancel();
 }
 await stepUp(context);
 const label = `Synthetic Terrace steward ${phase} ${randomUUID()}`;
 const portfolio = await command('portfolio.add', { name: label });
 const credential = await command('credential.mint', { label, role: 'portfolio_manager', scope: 'prepare', portfolioIds: [portfolio.id] });
 const local = { token: credential.token, clientId: credential.id, agent: { id: credential.id, name: label, specialist } };
 if (!local.token || !local.clientId) throw new Error('Native credential lifecycle omitted its identity');
 if (phase === 'initial') { current = { values: {}, local }; return { values: {}, clients: { local } }; }

 const today = new Date(), startDate = `${today.getUTCFullYear() - 1}-01-01`, endDate = `${today.getUTCFullYear() + 1}-12-31`;
 const dueOn = day(new Date(today.getTime() + 7 * 86_400_000));
 const previousMonth = day(new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 1, 15)));
 const home = async (portfolioId, identifier) => {
  const property = await command('property.add', { portfolioId, name: `${identifier} Court`, address: `${identifier} Alder Street, Oakland, CA`, kind: 'multifamily', timeZone: 'America/Los_Angeles' });
  const unit = await command('unit.add', { propertyId: property.id, identifier: '1A', bedrooms: 2, bathrooms: 1 });
  const tenancy = await command('tenancy.create', { unitId: unit.id, ownerName: 'Rowan Ellis', ownerEmail: 'rowan@example.test', tenantName: 'Alex Chen', tenantEmail: `${randomUUID()}@example.test`, startDate, endDate, rent: '1850.00', cadence: 'monthly' });
  return { ...tenancy, startDate, endDate, propertyId: property.id, unitId: unit.id };
 };
 const tenancy = await home(portfolio.id, '1840');
 const outsidePortfolio = await command('portfolio.add', { name: `Outside ${label}` });
 const outsideTenancy = await home(outsidePortfolio.id, '1920');
 const repair = { tenancyId: tenancy.id, title: 'Investigate a dripping kitchen tap', tradeName: 'Alder Plumbing', tradeEmail: 'alder-plumbing@example.test', dueDate: dueOn, estimate: '180.00', scope: 'Inspect the tap and prepare a repair option', checklist: 'Inspect tap\nRecord repair recommendation' };
 const job = await command('maintenance.prepare', repair);
 const workloadInput = message => ({ credentialId: credential.id, action: 'arrears.prepare', arguments: { tenancyId: tenancy.id, message, followUpDate: dueOn }, purpose: 'Prepare a dated rent follow-up for staff review', nextStep: 'A person reviews the proposed follow-up', dueOn });
 const workload = await command('agent.enqueue', workloadInput('Ask the resident to discuss the recorded overdue rent.'));
 const workloadSensitive = await command('agent.enqueue', workloadInput('Synthetic identity source: SSN 123-45-6789. Ask staff to review the recorded overdue rent.'));
 const values = {
  portfolio: { id: portfolio.id }, tenancy, outsideTenancy,
  job: { id: job.id, version: job.version, tenancyId: tenancy.id },
  workload: { id: workload.id, version: workload.version }, workloadSensitive: { id: workloadSensitive.id, version: workloadSensitive.version },
  repair,
  renewal: { tenancyId: tenancy.id, endDate: `${today.getUTCFullYear() + 2}-12-31`, rent: '1900.00', source: 'Synthetic owner-reviewed renewal options' },
  arrears: { tenancyId: tenancy.id, message: 'Prepare a discussion of the recorded rent balance.', followUpDate: dueOn },
  correction: { tenancyId: tenancy.id, kind: 'charge', dueDate: previousMonth, amount: '27.50', description: 'Documented missed parking charge', reference: `synthetic-correction-${randomUUID()}`, reason: 'Synthetic prior-period invoice identified in close review' },
  quote: { jobId: job.id, vendorName: 'Alder Plumbing', vendorEmail: 'alder-plumbing@example.test', scope: 'Inspect and repair the kitchen tap', availableDate: dueOn, amount: '160.00', tax: '0.00' },
  month: day(today).slice(0, 7), dueOn,
 };
 current = { values, local };
 return { values, clients: { local } };
}
