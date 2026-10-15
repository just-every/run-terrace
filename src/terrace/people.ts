import { operatorAuth,type Bindings } from '../auth.server'
import { escape as e,insist,owner,text,type Context,type Row } from './core'
import { button,form,hidden,input } from './view'
export async function peopleView(request:Request,env:Bindings,c:Context) {
 owner(c)
 const people=await operatorAuth(env).listOperators(request)
 return `<section><h2>Invite an operator</h2><p>Invite a manager (admin) to approve work, or a preparer (member) who can draft proposals. Local invitations arrive only in the development outbox.</p>${form('operator.invite',input('Name','displayName')+input('Email','email','email')+'<label>Role<select name="role"><option value="member">Member · prepare proposals</option><option value="admin">Admin · property manager</option></select></label>'+button('Send invitation'),'','settings')}<h3>Operators</h3>${people.map(p=>`<article><h3>${e(p.displayName)}</h3><p>${e(p.email)} · ${e(p.role)} · ${e(p.status)}</p>${p.id!==c.actor.id&&p.role!=='owner'&&p.status!=='invited'?form('operator.status',hidden('operatorId',p.id)+hidden('status',p.status==='active'?'inactive':'active')+button(p.status==='active'?'Deactivate operator':'Activate operator'),'','settings'):''}</article>`).join('')}</section>`
}
export async function peopleCommand(request:Request,env:Bindings,c:Context,name:string,p:Row) {
 if(!['operator.invite','operator.status'].includes(name))return
 owner(c);const auth=operatorAuth(env)
 if(name==='operator.invite'){insist(['admin','member'].includes(p.role),'role','Choose manager or member.');await auth.invite(request,{email:text(p.email,'Email'),displayName:text(p.displayName,'Name'),role:p.role,returnTo:'/app'})}
 else {insist(['active','inactive'].includes(p.status),'status','Choose active or inactive.');await auth.setOperatorStatus(request,text(p.operatorId,'Operator'),p.status)}
 return {notice:name==='operator.invite'?'Invitation recorded. Check the local outbox during development, or the recipient’s email in production.':'Operator access updated.'}
}
