import { operatorAuth,type Bindings } from '../auth.server'
import { all, Fault, insist, manager, owner, text, type Context, type Row } from './core'
import { tenancyCommand,tenancyData,proposals } from './tenancies'
import { ledgerCommand,ledgerData,statement,statementCsv } from './ledger'
import { workCommand,workData,photoResponse,workPacket } from './work'
import { importCommand,importData,importView } from './imports'
import { backup,dataCommand } from './data'
import { page } from './view'
import { chooser,tenancyView } from './tenancy-view'
import { ledgerView } from './ledger-view'
import { workView } from './work-view'
import { settingsView } from './settings-view'
import { peopleView,peopleCommand } from './people'
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{'cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer'}})
async function render(c:Context,url:URL,notice='',result:Row={},status=200,request?:Request,env?:Bindings) {
 const tab=url.searchParams.get('tab')??'tenancy',rows=await tenancyData(c),selected=rows.find(t=>t.id===url.searchParams.get('tenancy'))??rows[0],manage=['owner','admin'].includes(c.actor.role)
 let body='',title='Tenancies'
 if(tab==='import'){owner(c);title='Move in';body=importView({...await importData(c),...result})}
 else if(tab==='settings'){title='Data & access';body=settingsView(rows,c.actor.role==='owner');if(c.actor.role==='owner'&&request&&env)body+=await peopleView(request,env,c)}
 else {
  body=chooser(rows,selected,tab)
  if(tab==='tenancy') body+=tenancyView(selected,selected?await proposals(c,selected.id):[],manage)
  else if(tab==='ledger'){title='Rent & arrears';if(selected)body+=ledgerView(selected,await ledgerData(c,selected.id),manage)}
  else if(tab==='work'){title='Inspections & maintenance';if(selected)body+=workView(selected,await workData(c,selected.id))}
  else throw new Fault('not_found','Page not found.',404)
 }
 return page(c,title,body,notice,status)
}
async function command(c:Context,name:string,p:Row) {
 for(const handler of [tenancyCommand,ledgerCommand,workCommand,importCommand,dataCommand]) {
  const result=await handler(c,name,p); if(result!==undefined)return result
 }
 throw new Fault('unknown_command','Unknown Terrace command.',404)
}
export async function terraceResponse(request:Request,env:Bindings):Promise<Response|null> {
 const url=new URL(request.url),isApi=url.pathname.startsWith('/api/'),isPage=url.pathname==='/app'||url.pathname==='/app/command'
 if(!isApi&&!isPage)return null
 // Unknown API paths retain a genuine 404 without leaking installation data.
 if(isApi&&!['/api/state','/api/commands','/api/statement','/api/backup'].includes(url.pathname)&&!/^\/api\/(inspections\/photos\/[^/]+|maintenance\/[^/]+\/packet)$/.test(url.pathname))return new Response('Not found',{status:404})
 let c:Context|undefined,p:Row={}
 try {
  insist(url.origin===env.AUTH_ORIGIN,'origin','The request origin does not match this installation.',403)
  const session=await operatorAuth(env).getSession(request)
  if(!session) return isApi?json({error:'unauthorized',message:'Sign in first.'},401):new Response(null,{status:303,headers:{location:'/signin'}})
  insist(['owner','admin','member'].includes(session.operator.role),'forbidden','Access denied.',403)
  c={db:env.DB,actor:session.operator,now:new Date().toISOString()}
  if(request.method==='POST') {
   insist(url.pathname==='/api/commands'||url.pathname==='/app/command','method','Use the command endpoint.',405)
   insist(request.headers.get('origin')===env.AUTH_ORIGIN&&request.headers.get('sec-fetch-site')!=='cross-site','origin','Same-origin confirmation is required.',403)
   insist(Number(request.headers.get('content-length')??0)<=25*1024*1024,'body_limit','Request is too large.',413)
   p=request.headers.get('content-type')?.includes('application/json')?await request.json():Object.fromEntries(await request.formData())
   insist(p&&typeof p==='object'&&!Array.isArray(p),'input','Send a command object.')
   const name=text(p.command,'Command',100),result:Row=await peopleCommand(request,env,c,name,p)??await command(c,name,p)
   if(isApi)return json({ok:true,result})
   const dest=new URL('/app',url);dest.searchParams.set('tab',String(p.tab??'tenancy'));dest.searchParams.set('tenancy',String(result.tenancyId??(name==='tenancy.create'?result.id:p.tenancyId)??''))
   if(name==='import.preview'||name==='import.journal')return await render(c,dest,result.notice??'Review the result below.',result)
   dest.searchParams.set('notice',result.notice??'Saved.');return new Response(null,{status:303,headers:{location:dest.pathname+dest.search,'cache-control':'no-store'}})
  }
  insist(request.method==='GET','method','Method not allowed.',405)
  if(url.pathname==='/app')return await render(c,url,url.searchParams.get('notice')??'',{},200,request,env)
  if(url.pathname==='/api/commands')return json({commands:['tenancy.create','renewal.prepare','arrears.prepare','proposal.approve','proposal.reject','rent.charge','rent.receipt','rent.adjust','inspection.create','inspection.photo','inspection.complete','maintenance.prepare','maintenance.approve','maintenance.sent','import.preview','import.apply','import.undo','import.journal','tenancy.erase','data.restore']})
  if(url.pathname==='/api/state') {
   const tenancies=await tenancyData(c),tenancyId=url.searchParams.get('tenancy')
   return json({actor:{role:c.actor.role},tenancies,...(tenancyId?{ledger:await ledgerData(c,tenancyId),proposals:await proposals(c,tenancyId),work:await workData(c,tenancyId)}:{})})
  }
  if(url.pathname==='/api/backup')return await backup(c)
  if(url.pathname==='/api/statement') {const s=await statement(c,text(url.searchParams.get('tenancyId'),'Tenancy'),text(url.searchParams.get('from'),'From'),text(url.searchParams.get('to'),'To'));return new Response(statementCsv(s),{headers:{'content-type':'text/csv;charset=utf-8','content-disposition':'attachment; filename="terrace-owner-statement.csv"','cache-control':'no-store'}})}
  if(url.pathname.startsWith('/api/inspections/photos/'))return await photoResponse(c,url.pathname.split('/').at(-1)!)
  if(url.pathname.startsWith('/api/maintenance/'))return await workPacket(c,url.pathname.split('/')[3])
  return new Response('Not found',{status:404})
 } catch(error) {
  const x=error as any,conflict=String(x.message).includes('UNIQUE constraint'),status=conflict?409:(x.status??400),message=conflict?'That reference already exists. Use the existing record or a distinct reference.':x.message??'The operation failed.',code=conflict?'duplicate':x.code??'operation_failed'
  if(isApi)return json({ok:false,error:code,message},status)
  if(c) {const dest=new URL('/app',url);dest.searchParams.set('tab',String(p.tab??url.searchParams.get('tab')??'tenancy'));dest.searchParams.set('tenancy',String(p.tenancyId??url.searchParams.get('tenancy')??''));try{return await render(c,dest,message,{},status,request,env)}catch{return page(c,'Unable to continue','<p><a href="/app">Back to tenancies</a></p>',message,status)}}
  return new Response(message,{status})
 }
}
