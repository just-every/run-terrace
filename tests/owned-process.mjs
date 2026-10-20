// SAFE-007 process ownership: capture credentials privately, stop only descendants
// of the foreground CLI we started, and never call the machine-wide stop door.
import assert from 'node:assert/strict'
import {spawn,execFileSync} from 'node:child_process'
import {setTimeout as delay} from 'node:timers/promises'
import {readFile,writeFile} from 'node:fs/promises'
import {join} from 'node:path'

export const commandEnv=Object.fromEntries(['PATH','HOME','USER','SHELL','TMPDIR','CI','PLAYWRIGHT_BROWSERS_PATH','PLAYWRIGHT_SKIP_BROWSER_GC'].filter(k=>process.env[k]).map(k=>[k,process.env[k]]))
Object.assign(commandEnv,{WRANGLER_SEND_METRICS:'false',DO_NOT_TRACK:'1'})
export const git=(cwd,...args)=>execFileSync('git',args,{cwd,env:commandEnv,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim()
// This is the reviewer's explicit resolution of the fixture's known owner-note
// edit, preserving the upstream document and their note. Any other conflict
// needs a separate review and fails this journey.
export async function reviewedMerge(cwd,target,upstreamReadme,ownerNote){
 try {git(cwd,'merge','--no-edit',target)}catch(error){
  if(error.status!==1)throw error
  assert.equal(git(cwd,'diff','--name-only','--diff-filter=U'),'README.md','only the known owner-note conflict is reviewed here')
  assert.ok((await readFile(join(cwd,'README.md'),'utf8')).includes(ownerNote))
  await writeFile(join(cwd,'README.md'),upstreamReadme+'\n'+ownerNote)
  git(cwd,'add','README.md');git(cwd,'commit','--no-edit')
  console.log('SAFE-007: owner reviewed the README conflict and retained upstream instructions plus their own note')
 }
}
const redact=s=>s.replace(/(RER_OPEN\s+)\S+/g,'$1[private]').replace(/([#?&](?:rer-dev|token|key)=)[^\s&"<>]+/gi,'$1[private]')
export async function command(cwd,exe,args,{status=0,env=commandEnv}={}){
 const p=spawn(exe,args,{cwd,env,stdio:['ignore','pipe','pipe']});let output=''
 p.stdout.on('data',b=>output+=b);p.stderr.on('data',b=>output+=b)
 const code=await new Promise((resolve,reject)=>{p.on('error',reject);p.on('exit',resolve)})
 assert.equal(code,status,redact(output).slice(-6000));return output
}
export async function launch(cwd,rer){
 const p=spawn(process.execPath,[rer,'dev','--foreground'],{cwd,env:commandEnv,stdio:['ignore','pipe','pipe']});let output='',error
 p.stdout.on('data',b=>output+=b);p.stderr.on('data',b=>output+=b);p.on('error',e=>error=e)
 const stop=async()=>{
  // ps supplies ancestry, not a command-name pattern. Every signalled PID is
  // proved to be descended from this invocation before any signal is sent.
  const rows=execFileSync('ps',['-axo','pid=,ppid='],{encoding:'utf8'}).trim().split('\n').map(l=>l.trim().split(/\s+/).map(Number)),owned=new Set([p.pid])
  for(let changed=true;changed;){changed=false;for(const [pid,parent]of rows)if(owned.has(parent)&&!owned.has(pid)){owned.add(pid);changed=true}}
  const signal=s=>{for(const pid of [...owned].reverse())try{process.kill(pid,s)}catch(e){if(e.code!=='ESRCH')throw e}}
  signal('SIGTERM');await delay(1000)
  for(const pid of owned)try{process.kill(pid,0);process.kill(pid,'SIGKILL')}catch(e){if(e.code!=='ESRCH')throw e}
 }
 try {
  for(let i=0;i<1800;i++){
   if(error)throw error
   const open=output.match(/RER_OPEN\s+(https?:\/\/\S+)/)?.[1]
   const site=output.match(/RER_SITE\s+(https?:\/\/\S+)/)?.[1]
   if(open&&site)return {open,origin:new URL(open).origin,site,stop}
   assert.equal(p.exitCode,null,redact(output).slice(-6000));await delay(500)
  }
  throw Error('SAFE-007: rer dev did not become ready in 15 minutes: '+redact(output).slice(-6000))
 }catch(e){await stop();throw e}
}
