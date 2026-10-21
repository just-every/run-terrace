import { workflowScheduled } from '../../src/terrace/workflow-scheduler'
import { terraceResponse } from '../../src/terrace/api'
import { authResponse } from '../../src/auth.server'
export default {scheduled:workflowScheduled,async fetch(request:Request,env:any) {return await authResponse(request,env) ?? await terraceResponse(request,env) ?? new Response('Not found',{status:404})}}
