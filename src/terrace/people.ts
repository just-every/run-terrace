import { operatorAuth,type Bindings } from '../auth.server'
import { allow,audit,escape as e,insist,one,text,type Context,type Row } from './core'
import { icon } from './icons'
import { ROLES,requestedRole,roleData,roleLabel,setRole,tier } from './roles'
import { avatar,button,form,hidden,input,pill } from './view'
const roleSelect=(current='member')=>`<label>Role<select name="role">${ROLES.map(([v,l])=>`<option value="${v}"${v===current?' selected':''}>${l}</option>`).join('')}</select></label>`
const scopeFields=(portfolios:Row[],every:boolean,chosen:string[])=>`<fieldset><legend>Portfolios</legend><label><input type="checkbox" name="allPortfolios" value="1"${every?' checked':''}> All portfolios, including tenancies without a unit</label>${portfolios.map(f=>`<label><input type="checkbox" name="portfolio:${e(f.id)}" value="1"${chosen.includes(f.id)?' checked':''}> ${e(f.name)}</label>`).join('')}</fieldset>`
export async function peopleView(request:Request,env:Bindings,c:Context) {
 allow(c,'operator.role')
 const [people,roles]=await Promise.all([operatorAuth(env).listOperators(request),roleData(c)])
 const row=(p:Row)=>{
  const r=roles.of(p.id),scope=p.role==='owner'?'Everything':r?.all?'All portfolios':r?.portfolios.length?r.portfolios.map((a:Row)=>a.name).join(', '):'No portfolios'
  const change=p.role!=='owner'?`<details><summary>Change role or portfolios</summary>${form('operator.role',hidden('operatorId',p.id)+roleSelect(r?.role)+scopeFields(roles.portfolios,r?.all??false,(r?.portfolios??[]).map((a:Row)=>a.portfolio_id))+button('Save role'),'','settings')}</details>`:''
  return `<article class="operator-row">${avatar(p.displayName)}<div class="operator-who"><h3>${e(p.displayName)}</h3><p>${e(p.email)}</p><p class="muted">${e(scope)}</p></div><span class="operator-role">${e(p.role==='owner'?'Owner':r?roleLabel(r.role):'Role set at first sign-in')}</span>${pill(p.status,p.status==='active'?'paid':p.status==='invited'?'pending':'closed')}${p.id!==c.actor.id&&p.role!=='owner'&&p.status!=='invited'?form('operator.status',hidden('operatorId',p.id)+hidden('status',p.status==='active'?'inactive':'active')+`<button class="${p.status==='active'?'danger':'secondary'}" type="submit">${p.status==='active'?'Deactivate operator':'Activate operator'}</button>`,'','settings'):''}${change}</article>`
 }
 const history=roles.changes.length?`<details><summary>Role changes</summary><ul>${roles.changes.map((x:Row)=>`<li>${e(x.changed_at.slice(0,10))} · ${e(x.changed_name)} set ${e(x.operator_name)} to ${e(roleLabel(x.role))} · ${x.all_portfolios?'all portfolios':`${JSON.parse(x.portfolios).length} portfolio(s)`}</li>`).join('')}</ul></details>`:''
 return `<section class="settings-invite"><h2><span class="icon-disc">${icon('people')}</span>Invite an operator</h2><p>Choose the person's role and the portfolios they work in. Only you change roles and portfolios; every change is recorded.</p>${form('operator.invite',input('Name','displayName')+input('Email','email','email')+roleSelect()+scopeFields(roles.portfolios,false,[])+button('Send invitation'),'','settings')}</section><section class="settings-operators"><h2><span class="icon-disc">${icon('people')}</span>Operators</h2><details><summary>People and roles</summary><p>Owner: access, people, integrations, money authorities, currency confirmation and data custody (move-in, restore, erasure).</p><ul>${ROLES.map(([,l,d])=>`<li><strong>${l}:</strong> ${e(d)}</li>`).join('')}</ul><p>Staff see only tenancies on units in their portfolios; a tenancy without a unit is seen only with all portfolios.</p></details>${people.map(row).join('')}${history}</section>`
}
export async function peopleCommand(request:Request,env:Bindings,c:Context,name:string,p:Row) {
 if(!['operator.invite','operator.status','operator.role'].includes(name))return
 allow(c,name);const auth=operatorAuth(env)
 if(name==='operator.invite'){
  const want=await requestedRole(c,p),mail=text(p.email,'Email').toLowerCase()
  await auth.invite(request,{email:mail,displayName:text(p.displayName,'Name'),role:tier(want.role),returnTo:'/app'})
  const invited=await one(c,'SELECT id FROM oa_operators WHERE email=?',mail)
  await setRole(c,String(invited?.id),want,name)
  return {notice:`Invitation recorded for a ${roleLabel(want.role).toLowerCase()}.`}
 }
 if(name==='operator.role'){
  const want=await requestedRole(c,p),target=await one(c,"SELECT id,role FROM oa_operators WHERE id=? AND role<>'owner'",text(p.operatorId,'Operator',100))
  if(target&&target.role!==tier(want.role))await auth.setRole(request,target.id,tier(want.role))
  await setRole(c,String(target?.id),want,name)
  return {notice:`Role set to ${roleLabel(want.role).toLowerCase()}.`}
 }
 insist(['active','inactive'].includes(p.status),'status','Choose active or inactive.');await auth.setOperatorStatus(request,text(p.operatorId,'Operator'),p.status)
 // SAFE-002: Base made the change; Terrace's history records it once it succeeded.
 await audit(c,`${name}:${p.status}`,String(p.operatorId)).run()
 return {notice:'Operator access updated.'}
}
