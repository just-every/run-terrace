import { operatorAuth,type Bindings } from '../auth.server'
import { escape as e,insist,owner,text,type Context,type Row } from './core'
import { icon } from './icons'
import { avatar,button,form,hidden,input,pill } from './view'
export async function peopleView(request:Request,env:Bindings,c:Context) {
 owner(c)
 const people=await operatorAuth(env).listOperators(request)
 return `<section class="settings-invite"><h2><span class="icon-disc">${icon('people')}</span>Invite an operator</h2><p>Invite a manager (admin) to approve work, or a preparer (member) who can draft proposals.</p>${form('operator.invite',input('Name','displayName')+input('Email','email','email')+'<label>Role<select name="role"><option value="member">Member · prepare proposals</option><option value="admin">Admin · property manager</option></select></label>'+button('Send invitation'),'','settings')}</section><section class="settings-operators"><h2><span class="icon-disc">${icon('people')}</span>Operators</h2><details><summary>People and roles</summary><p>Owner: all operations and data custody. Admin: property manager who can record rent, complete inspections and approve proposals. Member: can read the portfolio and prepare renewal, arrears and maintenance proposals, but cannot approve or change rent.</p></details>${people.map(p=>`<article class="operator-row">${avatar(p.displayName)}<div class="operator-who"><h3>${e(p.displayName)}</h3><p>${e(p.email)}</p></div><span class="operator-role">${e(p.role)}</span>${pill(p.status,p.status==='active'?'paid':p.status==='invited'?'pending':'closed')}${p.id!==c.actor.id&&p.role!=='owner'&&p.status!=='invited'?form('operator.status',hidden('operatorId',p.id)+hidden('status',p.status==='active'?'inactive':'active')+`<button class="${p.status==='active'?'danger':'secondary'}" type="submit">${p.status==='active'?'Deactivate operator':'Activate operator'}</button>`,'','settings'):''}</article>`).join('')}</section>`
}
export async function peopleCommand(request:Request,env:Bindings,c:Context,name:string,p:Row) {
 if(!['operator.invite','operator.status'].includes(name))return
 owner(c);const auth=operatorAuth(env)
 if(name==='operator.invite'){insist(['admin','member'].includes(p.role),'role','Choose manager or member.');await auth.invite(request,{email:text(p.email,'Email'),displayName:text(p.displayName,'Name'),role:p.role,returnTo:'/app'})}
 else {insist(['active','inactive'].includes(p.status),'status','Choose active or inactive.');await auth.setOperatorStatus(request,text(p.operatorId,'Operator'),p.status)}
 return {notice:name==='operator.invite'?'Invitation recorded.':'Operator access updated.'}
}
