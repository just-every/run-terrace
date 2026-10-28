import { workflowScheduled } from '../../src/terrace/workflow-scheduler'
import { terraceResponse } from '../../src/terrace/api'
import { authResponse } from '../../src/auth.server'
export default {
 scheduled:workflowScheduled,
 async fetch(request:Request,env:any) {
  if(env.HARNESS_NOW)(globalThis as any).__terraceJourneyNow=env.HARNESS_NOW
  const testPath=new URL(request.url).pathname
  if(env.HARNESS_SQL_KEY&&request.headers.get('x-terrace-harness-key')===env.HARNESS_SQL_KEY){
   try{
    if(testPath==='/__test/sql'){
     const statements=await request.json() as {query:string,values:unknown[]}[]
     return Response.json(await env.DB.batch(statements.map(s=>env.DB.prepare(s.query).bind(...s.values))))
    }
    if(testPath==='/__test/scheduled'){
     const controller=await request.json() as ScheduledController
     await workflowScheduled(controller,env)
     return Response.json({ok:true})
    }
   }catch(e){return new Response(String(e),{status:500})}
  }
  return await authResponse(request,env) ?? await terraceResponse(request,env) ?? new Response('Not found',{status:404})
 }
}
