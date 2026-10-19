import { operatorAuth,type Bindings } from '../auth.server'
import { allow, can, Fault, insist, tenancy, text, type Context, type Row } from './core'
import { loadStaff } from './roles'
import { localDate as today } from './zones'
import { tenancyCommand,tenancyData,proposals } from './tenancies'
import { ledgerCommand,ledgerData,statement,statementCsv } from './ledger'
import { workCommand,workData,operatorNames,photoResponse,workPacket } from './work'
import { importCommand,importData,importView } from './imports'
import { backup,dataCommand } from './data'
import { page } from './view'
import { chooser,tenancyView,emptyView,createTenancy,backToTenancies } from './tenancy-view'
import { homeView,addTenancyAction } from './home-view'
import { monthData } from './month'
import { ledgerView } from './ledger-view'
import { workView } from './work-view'
import { settingsView } from './settings-view'
import { peopleView,peopleCommand } from './people'
import { companyCommand,companyData,officeZone } from './company'
import { assetCommand } from './assets'
import { vendorCommand } from './vendors'
import { scheduleCommand } from './schedules'
import { chargeRunCommand,preview,terms } from './charge-run'
import { runSection,termSection } from './charge-run-view'
import { propertyCommand,propertyData,unitChoices } from './properties'
import { propertiesView } from './property-view'
import { turnoverCommand,turnoverData } from './turnovers'
import { householdCommand,householdData } from './households'
import { quoteCommand } from './quotes'
import { completionCommand } from './completions'
import { householdSection } from './household-view'
import { collections,rentRoll,rentRollTable } from './rent-roll'
import { rentRollSection } from './rent-roll-view'
import { csv,pdf,xlsx } from './exports'
import { companyView } from './company-view'
import { ownerCommand,ownershipData,ownerStatement,ownerStatementTable } from './owners'
import { ownerDirectory,propertyOwners } from './owner-view'
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{'cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer'}})
async function render(c:Context,url:URL,notice='',result:Row={},status=200,request?:Request,env?:Bindings) {
 const tab=url.searchParams.get('tab')??'tenancy',rows=await tenancyData(c),asked=url.searchParams.get('tenancy'),selected=rows.find(t=>t.id===asked)??rows[0],manage=can(c,'tenancy.create'),ledgers=can(c,'ledger.read')
 // ROLE-001: a named tenancy outside the viewer's portfolios (or erased) answers 404, never another tenancy.
 insist(!asked||rows.some(t=>t.id===asked),'not_found','Tenancy not found.',404)
 let body='',title='Tenancies',head={}
 if(tab==='import'){allow(c,'import.preview');title='Move in';body=importView({...await importData(c),...result})}
 else if(tab==='properties'){title='Properties';const data=await propertyData(c);const owners=await ownershipData(c),keep=can(c,'ownership.set')&&!!owners.directory;body=ownerDirectory(owners.directory,can(c,'owner.add'),can(c,'reports.read'))+propertiesView(data,await unitChoices(c),can(c,'unit.add'),await turnoverData(c),p=>propertyOwners(p,owners.byProperty[p.id],owners.directory,keep));if(can(c,'reports.read')){const day=today(c.now,c.zone!);body+=rentRollSection(await rentRoll(c,{asOf:url.searchParams.get('asOf')||day,propertyId:url.searchParams.get('propertyId'),occupancy:url.searchParams.get('occupancy')}),await collections(c,url.searchParams.get('month')||day.slice(0,7)),data.portfolios.flatMap((f:Row)=>f.properties))}}
 else if(tab==='settings'){title='Data & access';body=companyView(await companyData(c),can(c,'company.save')&&(c.actor.role==='owner'||!!c.actor.staff?.all),c.actor.role==='owner')+settingsView(rows,c.actor.role==='owner');if(can(c,'operator.role')&&request&&env)body+=await peopleView(request,env,c);body=`<div class="settings-layout">${body}</div>`}
 else {
  if(tab==='tenancy') {
   if(url.searchParams.get('tenancy')&&selected){title=selected.address;const ledger=ledgers?await ledgerData(c,selected.id):null;body=tenancyView(selected,await proposals(c,selected.id),{approve:can(c,'proposal.approve'),zone:can(c,'tenancy.timezone'),renew:can(c,'renewal.prepare')},ledger,await workData(c,selected.id),today(c.now,selected.time_zone))+householdSection(selected,await householdData(c,selected,ledger?.balanceCents??null),can(c,'household.add'),rows);head={eyebrow:selected.owner_name,back:backToTenancies}}
   else {
    const create=manage?createTenancy(!rows.length||url.searchParams.get('add')==='1',c.zone!,await unitChoices(c)):''
    body=rows.length?(ledgers?homeView(await monthData(c,rows),can(c,'proposal.approve'),create):chooser(rows,undefined,'tenancy')+create):emptyView(create,c.now)
    if(manage&&rows.length)head={actions:addTenancyAction}
   }
  }
  else body=chooser(rows,selected,tab)
  if(tab==='ledger'){allow(c,'ledger.read');title='Rent & arrears';if(selected){const run=url.searchParams.get('run'),ledger=await ledgerData(c,selected.id),post=can(c,'rent.charge');body+=ledgerView(selected,ledger,post,can(c,'reports.read'))+termSection(selected,await terms(c,selected.id),post)+runSection(selected,post&&run?await preview(c,run):null,post,run??ledger.today.slice(0,7))}}
  else if(tab==='work'){allow(c,'work.read');title='Inspections & maintenance';if(selected)body+=workView(selected,{...await workData(c,selected.id),names:await operatorNames(c)})}
  else if(tab!=='tenancy') throw new Fault('not_found','Page not found.',404)
 }
 return page(c,title,body,notice,status,tab,head)
}
const COMMANDS=['tenancy.create','renewal.prepare','arrears.prepare','proposal.approve','proposal.reject','rent.charge','rent.receipt','rent.adjust','inspection.create','inspection.photo','inspection.complete','maintenance.prepare','maintenance.approve','maintenance.sent','import.preview','import.apply','import.undo','import.journal','tenancy.erase','data.restore','company.save','entity.add','account.add','tenancy.timezone','asset.add','asset.replace','vendor.add','vendor.update','maintenance.reassign','maintenance.exception','schedule.add','schedule.defer','schedule.run','term.add','term.amend','charges.preview','charges.post','portfolio.add','property.add','unit.add','unit.update','tenancy.end','tenancy.transfer','turnover.open','turnover.task.update','turnover.task.submit','turnover.task.check','turnover.publish','household.add','household.leave','household.move','currency.confirm','work.limits','quote.add','quote.select','maintenance.revise','maintenance.owner','completion.record','completion.check','completion.close','owner.add','owner.w9','ownership.set','agreement.set','operator.invite','operator.status','operator.role']
async function command(c:Context,name:string,p:Row) {
 for(const handler of [tenancyCommand,ledgerCommand,workCommand,importCommand,dataCommand,companyCommand,assetCommand,vendorCommand,scheduleCommand,chargeRunCommand,propertyCommand,turnoverCommand,householdCommand,quoteCommand,completionCommand,ownerCommand]) {
  const result=await handler(c,name,p); if(result!==undefined)return result
 }
 throw new Fault('unknown_command','Unknown Terrace command.',404)
}
export async function terraceResponse(request:Request,env:Bindings):Promise<Response|null> {
 const url=new URL(request.url),isApi=url.pathname.startsWith('/api/'),isPage=url.pathname==='/app'||url.pathname==='/app/command'
 if(!isApi&&!isPage)return null
 // Unknown API paths retain a genuine 404 without leaking installation data.
 if(isApi&&!['/api/state','/api/commands','/api/statement','/api/backup','/api/rent-roll','/api/collections','/api/owner-statement'].includes(url.pathname)&&!/^\/api\/(inspections\/photos\/[^/]+|maintenance\/[^/]+\/packet)$/.test(url.pathname))return new Response('Not found',{status:404})
 let c:Context|undefined,p:Row={}
 try {
  insist(url.origin===env.AUTH_ORIGIN,'origin','The request origin does not match this installation.',403)
  const session=await operatorAuth(env).getSession(request)
  if(!session) return isApi?json({error:'unauthorized',message:'Sign in first.'},401):new Response(null,{status:303,headers:{location:'/signin'}})
  insist(['owner','admin','member'].includes(session.operator.role),'forbidden','Access denied.',403)
  c={db:env.DB,actor:session.operator,now:new Date().toISOString()};await loadStaff(c);c.zone=await officeZone(c)
  if(request.method==='POST') {
   insist(url.pathname==='/api/commands'||url.pathname==='/app/command','method','Use the command endpoint.',405)
   insist(request.headers.get('origin')===env.AUTH_ORIGIN&&request.headers.get('sec-fetch-site')!=='cross-site','origin','Same-origin confirmation is required.',403)
   insist(Number(request.headers.get('content-length')??0)<=25*1024*1024,'body_limit','Request is too large.',413)
   p=request.headers.get('content-type')?.includes('application/json')?await request.json():Object.fromEntries(await request.formData())
   insist(p&&typeof p==='object'&&!Array.isArray(p),'input','Send a command object.')
   const name=text(p.command,'Command',100)
   // ROLE-001: an unknown command is 404; a known command outside the actor's role is 403 before any record is read.
   insist(COMMANDS.includes(name),'unknown_command','Unknown Terrace command.',404);allow(c,name);c.action=name
   const result:Row=await peopleCommand(request,env,c,name,p)??await command(c,name,p)
   if(isApi)return json({ok:true,result})
   const dest=new URL('/app',url);dest.searchParams.set('tab',String(p.tab??'tenancy'));dest.searchParams.set('tenancy',String(result.tenancyId??(name==='tenancy.create'?result.id:p.tenancyId)??''))
   if(name==='import.preview'||name==='import.journal')return await render(c,dest,result.notice??'Review the result below.',result)
   dest.searchParams.set('notice',result.notice??'Saved.');return new Response(null,{status:303,headers:{location:dest.pathname+dest.search,'cache-control':'no-store'}})
  }
  insist(request.method==='GET','method','Method not allowed.',405)
  if(url.pathname==='/app')return await render(c,url,url.searchParams.get('notice')??'',{},200,request,env)
  if(url.pathname==='/api/commands')return json({commands:COMMANDS.filter(name=>can(c!,name))})
  if(url.pathname==='/api/state') {
   const tenancies=await tenancyData(c),tenancyId=url.searchParams.get('tenancy'),t=tenancyId?await tenancy(c,tenancyId):undefined,ledger=t&&can(c,'ledger.read')?await ledgerData(c,t.id):undefined
   return json({actor:{role:c.actor.role,staffRole:c.actor.staff?.role??'owner',allPortfolios:c.actor.role==='owner'||!!c.actor.staff?.all},...await companyData(c),...await propertyData(c),turnovers:await turnoverData(c),ownership:await ownershipData(c),tenancies,...(t?{ledger,household:await householdData(c,t,ledger?.balanceCents??null),proposals:await proposals(c,t.id),work:await workData(c,t.id)}:{})})
  }
  if(url.pathname==='/api/backup')return await backup(c)
  if(url.pathname==='/api/collections')return json(await collections(c,url.searchParams.get('month')))
  if(url.pathname==='/api/rent-roll') {
   const r=await rentRoll(c,Object.fromEntries(url.searchParams)),f=url.searchParams.get('format')??'json',file='terrace-rent-roll-'+r.asOf,head=(type:string,ext:string)=>({'content-type':type,'content-disposition':`attachment; filename="${file}.${ext}"`,'cache-control':'no-store'})
   if(f==='csv')return new Response(csv(rentRollTable(r)),{headers:head('text/csv;charset=utf-8','csv')})
   if(f==='xlsx')return new Response(xlsx(rentRollTable(r),'Rent roll'),{headers:head('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','xlsx')})
   if(f==='pdf')return new Response(pdf('Terrace rent roll as of '+r.asOf,rentRollTable(r).slice(1)),{headers:head('application/pdf','pdf')})
   return json(r)
  }
  if(url.pathname==='/api/owner-statement') {const s=await ownerStatement(c,url.searchParams.get('ownerId'),url.searchParams.get('from'),url.searchParams.get('to'));return url.searchParams.get('format')==='csv'?new Response(csv(ownerStatementTable(s)),{headers:{'content-type':'text/csv;charset=utf-8','content-disposition':'attachment; filename="terrace-owner-allocation.csv"','cache-control':'no-store'}}):json(s)}
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
