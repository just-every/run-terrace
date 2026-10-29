import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { nativeHttp, stepUp } from './native-http.mjs';
import { currentFixture } from './phase-fixtures.mjs';

// Hooks inspect the effects through native person HTTP, without altering the
// mandatory journey arguments or rebuilding a consumed workload for a retry.
export async function beforeStep({ step, args, ...context }) {
 if (step.tool !== 'terrace.workloads.execute') return;
 const { get } = nativeHttp(context), { workloads } = await get('/api/agent-workloads');
 const workload = workloads.find(item => item.id === args.workloadId);
 assert.ok(workload, 'The mandatory execution must address an owner-enqueued workload');
 assert.equal(workload.state, 'queued');
 assert.equal(workload.version, args.version);
}

export async function afterStep({ step, args, result, ...context }) {
 const { get } = nativeHttp(context);
 if (step.tool === 'terrace.workloads.execute') {
  const { workloads } = await get('/api/agent-workloads');
  const workload = workloads.find(item => item.id === args.workloadId);
  assert.equal(workload?.state, 'prepared');
  assert.equal(workload.attempts, 1);
  assert.deepEqual(workload.events.map(event => event.kind), ['queued', 'attempt', 'prepared']);
  assert.ok(workload.outcomeEvidence?.subjectId);
 } else if (step.id === 'revise') {
  const before = await get(`/api/state?tenancy=${encodeURIComponent(result.tenancyId)}`);
  const stale = await context.tool(step.tool, { ...args, idempotency_key: randomUUID() });
  assert.equal(stale.result?._meta?.['com.runeditrun/error']?.code, 'revision_conflict');
  assert.deepEqual(await get(`/api/state?tenancy=${encodeURIComponent(result.tenancyId)}`), before);
 } else if (step.tool === 'terrace.work.prepare') {
  const state = await get(`/api/state?tenancy=${encodeURIComponent(args.tenancyId)}`);
  const job = state.work.jobs.find(item => item.id === (result.job?.id ?? result.id));
  assert.ok(job, 'The tool must prepare a native job');
  assert.equal(job.state, 'pending');
  assert.equal(job.approval_id, null);
  if (step.id === 'prepare') {
   const before = await get(`/api/state?tenancy=${encodeURIComponent(args.tenancyId)}`);
   const conflict = await context.tool(step.tool, { ...args, title: 'Changed effect using the original key' });
   assert.equal(conflict.result?._meta?.['com.runeditrun/error']?.code, 'idempotency_conflict');
   assert.deepEqual(await get(`/api/state?tenancy=${encodeURIComponent(args.tenancyId)}`), before);
  }
 }
}

export default async function nativeJourney(context) {
 const prepared = currentFixture();
 assert.ok(prepared?.values.tenancy && prepared.local, 'Native lifecycle must prepare a scoped local client');
 const { values, local } = prepared;
 const answer = await context.tool('terrace.leases.get', { tenancyId: values.tenancy.id }, { client: 'local' });
 assert.equal(answer.status, 200);
 assert.equal(answer.result?.isError, undefined);
 assert.equal(answer.result?.structuredContent?.tenancy?.id, values.tenancy.id);

 const { send, command } = nativeHttp(context);
 const pause = async paused => {
  const response = await send('/agents/api/pause', { method: 'POST', body: JSON.stringify({ paused }) });
  assert.equal(response.status, 200); await response.body?.cancel();
 };
 await pause(true);
 const paused = await context.tool('terrace.company.get', {});
 assert.equal(paused.result?._meta?.['com.runeditrun/error']?.code, 'agents_paused');
 await pause(false);
 const readAsLocal = id => send(`/api/v1/leases/${encodeURIComponent(id)}`, { headers: { Cookie: '', Authorization: `Bearer ${local.token}` } });
 const outside = await readAsLocal(values.outsideTenancy.id);
 const missing = await readAsLocal(randomUUID());
 assert.equal(outside.status, 404);
 assert.equal(missing.status, outside.status);
 assert.equal((await outside.json()).error, (await missing.json()).error);
 await stepUp(context);
 await command('credential.revoke', { credentialId: local.clientId });
 const doorRevoked = await context.tool('terrace.leases.get', { tenancyId: values.tenancy.id }, { client: 'local' });
 assert.equal(doorRevoked.status, 401);
 const revoked = await readAsLocal(values.tenancy.id);
 assert.equal(revoked.status, 401);
 await revoked.body?.cancel();
}
