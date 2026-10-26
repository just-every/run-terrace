// Install the production demo guard before importing any application module.
import { withDemo } from '../../src/modules/demo/index.mjs'
import worker from './worker'
import { seedDemo } from '../../src/demo'

const demo = withDemo(worker, { seed: seedDemo })
// Migration setup uses the existing guarded SQL fixture door before demo seeding.
// Every product request still passes through the production effect guard.
export default {...demo,async fetch(request:Request,env:any,execution:any){
 if(new URL(request.url).pathname==='/__test/sql'&&env.HARNESS_SQL_KEY&&request.headers.get('x-terrace-harness-key')===env.HARNESS_SQL_KEY)return worker.fetch(request,env)
 return demo.fetch(request,env,execution)
}}
