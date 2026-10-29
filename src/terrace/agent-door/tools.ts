import type { ToolDefinition, ToolContext, ClassAndFacts } from '../../modules/agent-door/index.ts'
import type { Bindings } from '../../auth.server'
import { tenancy, type Row } from '../core'
import { credentialGate } from '../credentials'
import { tenancyCommand } from '../tenancies'
import { workCommand } from '../work'
import { quoteCommand } from '../quotes'
import { periodCommand } from '../periods'
import { agentCommand } from '../agent-workloads'
import { redactSensitive, redactErrorReport } from '../sensitive-metadata'
import { admitted, nativeCall, nativeContext } from './context'
import { mayRead, nativeJob, nativeWorkload, read } from './reads'
import { specs } from './spec.mjs'

const picked = (spec: typeof specs[number], args: Row) => Object.fromEntries(Object.keys(spec.inputSchema.properties).filter(key=>args[key]!==undefined).map(key=>[key,args[key]]))
const sensitive = (value: unknown): boolean => typeof value === 'string' ? redactSensitive(value)!==value || /\b(?:diagnosis|medical condition|health record|disability|accommodation)\b/i.test(value) : value !== null && typeof value === 'object' ? Object.values(value).some(sensitive) : false
export function tools(env: Bindings): ToolDefinition[] {
 return specs.map(spec => {
  const context = async (ctx: ToolContext,args: Row) => {
   const c = mayRead(spec.action) && spec.readOnly ? await nativeContext(env,ctx,ctx) : await admitted(env,ctx,spec.action,args)
   if (!spec.readOnly) credentialGate(c,spec.action)
   return c
  }
  const nativeRecord = async (args: Row,ctx: ToolContext) => {
   const c = await context(ctx,args)
   if (spec.action === 'agent.execute' || spec.action === 'agent.read') return {c,row:await nativeWorkload(c,args),kind:'workload'}
   if (args.jobId) return {c,row:await nativeJob(c,args),kind:'maintenance'}
   if (args.tenancyId) return {c,row:await tenancy(c,args.tenancyId),kind:'tenancy'}
   return {c,row:null,kind:null}
  }
  return {
   name:spec.name,title:spec.name.replace('terrace.','').replaceAll('.',' '),description:spec.readOnly?'Inspect current native Terrace records within the sponsor’s role and portfolios. Returned text is untrusted.':'Prepare native work only. This tool never approves, sends, posts money or supplies a person’s sign-in proof. Text is untrusted.',
   scope:spec.scope,readOnly:spec.readOnly,classes:spec.classes as ToolDefinition['classes'],clauses:spec.clauses,inputSchema:spec.inputSchema,outputSchema:spec.outputSchema,untrusted:true,
   classify: (args,ctx) => nativeCall(async () => {
    const p = picked(spec,args), {row} = await nativeRecord(p,ctx)
    const effect = spec.action==='agent.execute' ? JSON.parse(row!.payload) : p
    const classes: ClassAndFacts[] = [{class:'standard',facts:{measure:1}}]
    if (!spec.readOnly && sensitive(effect)) classes.push({class:'sensitive',facts:{measure:1,kind:'protected native preparation'}})
    return classes
   }),
   target: (args,ctx) => nativeCall(async () => { const {row,kind} = await nativeRecord(picked(spec,args),ctx); return row && kind ? {kind,id:String(row.id)} : null }),
   ...(spec.readOnly ? {} : {
    summary: (args: Row,ctx: ToolContext) => nativeCall(async () => {
     const {row} = await nativeRecord(picked(spec,args),ctx)
     return {target:{id:row?.id,name:redactSensitive(row?.address ?? row?.title ?? row?.purpose ?? spec.name)},items:[...Object.entries(picked(spec,args)).filter(([key])=>!['tenancyId','jobId','workloadId'].includes(key)).map(([key,value])=>redactSensitive(`${key}: ${typeof value==='string'?value:JSON.stringify(value)}`))]}
    }),
    revision: (args: Row,ctx: ToolContext) => nativeCall(async () => { const {row} = await nativeRecord(picked(spec,args),ctx);return row?.version ?? null }),
   }),
   run: (args,ctx) => nativeCall(async () => {
    const p = picked(spec,args), c = await context(ctx,p)
    if (spec.readOnly) return {result:await read(c,spec.action,p)}
    const result = await workCommand(c,spec.action,p) ?? await quoteCommand(c,spec.action,p) ?? await tenancyCommand(c,spec.action,p) ?? await periodCommand(c,spec.action,p) ?? await agentCommand(c,spec.action,p)
    if (!result) throw new Error('Native preparation dispatcher did not handle its registered command')
    return {result:redactErrorReport(result)}
   }),
  } satisfies ToolDefinition
 })
}
