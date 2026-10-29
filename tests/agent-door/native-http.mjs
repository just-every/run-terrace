// Verification tooling uses only the disposable installation's public doors.
export function nativeHttp({ request, origin, cookie }) {
 const send = (path, { headers, ...init } = {}) => request(new URL(path, origin).href, {
  redirect: 'manual', ...init,
  headers: { Origin: origin, Cookie: cookie, 'Content-Type': 'application/json', ...headers },
 });
 const command = async (command, fields = {}) => {
  const response = await send('/api/commands', { method: 'POST', body: JSON.stringify({ command, ...fields }) });
  if (!response.ok) { await response.body?.cancel(); throw new Error(`Native ${command} failed with HTTP ${response.status}`); }
  const body = await response.json();
  if (!body.ok || !body.result) throw new Error(`Native ${command} omitted its result`);
  return body.result;
 };
 const get = async path => {
  const response = await send(path);
  if (!response.ok) { await response.body?.cancel(); throw new Error(`Native read failed with HTTP ${response.status}`); }
  return response.json();
 };
 return { send, command, get };
}

export async function stepUp(context) {
 const { send } = nativeHttp(context), since = Date.now();
 const sent = await send('/auth/step-up', { method: 'POST', body: JSON.stringify({ action: 'credentials:mint' }) });
 if (sent.status !== 202) { await sent.body?.cancel(); throw new Error('Native owner step-up request failed'); }
 await sent.body?.cancel();
 const messages = await context.mail.read({ after: since, limit: 5, maxAgeMs: 60_000 });
 let token;
 for (const message of messages) {
  const links = `${message.text ?? ''}\n${message.html ?? ''}`.match(/https?:\/\/[^\s<>"']+/g) ?? [];
  for (const candidate of links) {
   const url = new URL(candidate.replaceAll('&amp;', '&'));
   if (url.origin === context.origin && url.pathname === '/auth/confirm' && url.searchParams.has('token')) {
    token = url.searchParams.get('token'); break;
   }
  }
  if (token) break;
 }
 if (!token) throw new Error('Native owner step-up mail did not contain a confirmation');
 const confirmed = await send('/auth/confirm', { method: 'POST', body: JSON.stringify({ token }) });
 if (confirmed.status !== 303) { await confirmed.body?.cancel(); throw new Error('Native owner step-up confirmation failed'); }
 await confirmed.body?.cancel();
}
