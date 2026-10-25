import { workflowScheduled } from '../../src/terrace/workflow-scheduler'
import { terraceResponse } from '../../src/terrace/api'
import { authResponse } from '../../src/auth.server'
export default {scheduled:workflowScheduled,async fetch(request:Request,env:any) {if(env.HARNESS_SQL_KEY&&new URL(request.url).pathname==='/__test/sql'&&request.headers.get('x-terrace-harness-key')===env.HARNESS_SQL_KEY){try{const statements=await request.json() as {query:string,values:unknown[]}[];return Response.json(await env.DB.batch(statements.map(s=>env.DB.prepare(s.query).bind(...s.values))))}catch(e){return new Response(String(e),{status:500})}}return await authResponse(request,env) ?? await terraceResponse(request,env) ?? new Response('Not found',{status:404})}}
