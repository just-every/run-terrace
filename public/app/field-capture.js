// Device drafts contain only the user's explicit capture and original files, never cookies or session tokens.
const database=new Promise((resolve,reject)=>{const r=indexedDB.open('TerraceFieldDrafts',1);r.onupgradeneeded=()=>r.result.createObjectStore('drafts');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})
async function draftStore(method,key,value){const db=await database;return new Promise((resolve,reject)=>{const tx=db.transaction('drafts',method==='get'?'readonly':'readwrite'),s=tx.objectStore('drafts'),r=method==='get'?s.get(key):method==='delete'?s.delete(key):s.put(value,key);tx.oncomplete=()=>resolve(r.result);tx.onerror=()=>reject(tx.error)})}
const hash=async b=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',b)),v=>v.toString(16).padStart(2,'0')).join('')
async function command(name,p={},file){let body,headers;if(file){body=new FormData();body.set('command',name);for(const[k,v]of Object.entries(p))body.set(k,typeof v==='object'?JSON.stringify(v):v);body.set('file',file)}else{body=JSON.stringify({command:name,...p});headers={'content-type':'application/json'}}const r=await fetch('/api/commands',{method:'POST',headers,body}),b=await r.json();if(!r.ok){const e=Error(b.message||'Could not synchronize');e.code=b.error;throw e}return b.result}
async function upload(form,d,key,file){
 const kind=form.dataset.fieldCapture==='inspection'?'inspection':'work',recordId=form.dataset.record,sha256=await hash(await file.arrayBuffer())
 let saved=d.uploads[key];if(saved&&saved.sha256!==sha256)saved=null
 if(!saved){saved={...await command('media.begin',{kind,recordId,name:file.name,mediaType:file.type,size:file.size,sha256,capturedAt:d.values.capturedAt||d.values.completedDate,source:d.values.source||d.values.reference}),sha256};d.uploads[key]=saved;if(d.consentAt)await draftStore('put',d.key,d)}
 const response=await fetch('/api/record-media/upload?id='+encodeURIComponent(saved.id)),state=await response.json();if(!response.ok)throw Error(state.message||'Sign in again to resume')
 const positions=new Set(state.positions),size=saved.chunkSize
 for(let n=0;n<Math.ceil(file.size/size);n++)if(!positions.has(n))await command('media.chunk',{uploadId:saved.id,position:n},file.slice(n*size,(n+1)*size))
 await command('media.finish',{uploadId:saved.id});return saved.id
}
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))
const finding=x=>`<fieldset data-finding="${escape(x.key)}"><legend>${escape(x.room)} · ${escape(x.asset)}</legend><label>Condition<select name="condition:${escape(x.key)}">${['unknown','good','worn','damaged','missing'].map(v=>`<option>${v}</option>`).join('')}</select></label><label>Notes<textarea name="notes:${escape(x.key)}" maxlength="2000" required></textarea></label><label>Reading, or none<input name="reading:${escape(x.key)}" maxlength="200" required></label><label>Original photo or video<input type="file" name="file:${escape(x.key)}" accept="image/png,image/jpeg,video/mp4,video/quicktime,video/webm"></label></fieldset>`
for(const f of document.querySelectorAll('[data-field-capture]')){
 const key=f.dataset.operator+':'+f.dataset.fieldCapture+':'+f.dataset.record,status=f.querySelector('[data-field-status]'),conflict=f.querySelector('[data-conflict]')
 let saved=null,reconciliation=null
 const restore=d=>{for(const[k,v]of Object.entries(d.values))if(f.elements[k]&&f.elements[k].type!=='file')f.elements[k].value=v;f.dataset.version=d.version;f.elements.deviceConsent.checked=!!d.consentAt;reconciliation=d.reconciliation;status.textContent='Private device draft recovered. Original files are retained; review and sync when connected.'}
 draftStore('get',key).then(d=>{if(d){saved=d;restore(d)}}).catch(e=>status.textContent=e.message)
 function collect(){const values={};for(const input of f.elements)if(input.name&&input.type!=='file'&&input.type!=='checkbox')values[input.name]=input.value;const files={...saved?.files};for(const input of f.querySelectorAll('input[type=file]'))if(input.files[0])files[input.name]=input.files[0];return {key,clientId:saved?.clientId||crypto.randomUUID(),kind:f.dataset.fieldCapture,version:Number(f.dataset.version),values,files,uploads:saved?.uploads||{},consentAt:saved?.consentAt||null,reconciliation}}
 f.querySelector('[data-save]').addEventListener('click',async()=>{try{if(!f.elements.deviceConsent.checked)throw Error('Explicitly consent before storing private evidence on this device.');saved=collect();saved.consentAt=saved.consentAt||new Date().toISOString();await draftStore('put',key,saved);status.textContent='Saved offline on this device. Nothing has been sent. Reconnect, review the current scope and explicitly sync.'}catch(e){status.textContent=e.message}})
 f.querySelector('[data-clear]').addEventListener('click',async()=>{await draftStore('delete',key);saved=null;reconciliation=null;status.textContent='Private device draft and its original files deleted.'})
 f.addEventListener('submit',async event=>{
  event.preventDefault();if(!f.reportValidity())return;const button=f.querySelector('button[type=submit]');button.disabled=true
  try{
   const d=collect();status.textContent='Checking current scope before sending…';const r=await fetch('/api/state?tenancy='+encodeURIComponent(f.dataset.tenancy)),state=await r.json();if(!r.ok)throw Error(state.message||'Sign in again before syncing')
   const current=d.kind==='inspection'?state.work.inspections.find(x=>x.id===f.dataset.record):state.work.jobs.find(x=>x.id===f.dataset.record)
   if(!current)throw Error('This record is no longer available to your sign-in. Nothing was submitted.')
   const already=d.kind==='inspection'?state.work.captures?.some(x=>x.client_id===d.clientId):state.work.attempts?.some(x=>x.field_evidence&&JSON.parse(x.field_evidence).clientId===d.clientId);if(already){await draftStore('delete',key);location.reload();return}
   if(current.version!==d.version||(d.kind==='technician'&&current.approval_id!==d.values.approvalId)){
    conflict.hidden=false;conflict.replaceChildren();const h=document.createElement('h4');h.textContent='Scope changed — reconcile before submitting';const p=document.createElement('pre');p.textContent=JSON.stringify({saved:{version:d.version,findings:d.values},current:d.kind==='inspection'?{version:current.version,checklist:JSON.parse(current.checklist||'[]')}:JSON.parse(current.approval_snapshot||'{}')},null,2);const confirm=document.createElement('button');confirm.type='button';confirm.textContent='Review current scope and reconcile draft';conflict.append(h,p,confirm)
    confirm.onclick=()=>{
     reconciliation={previousVersion:d.version,previousValues:d.values,reviewedVersion:current.version,reviewedAt:new Date().toISOString()}
     if(d.kind==='inspection'){
      const definitions=JSON.parse(current.checklist||'[]');for(const x of definitions)if(!f.querySelector('[data-finding="'+CSS.escape(x.key)+'"]'))f.querySelector('fieldset').insertAdjacentHTML('afterend',finding(x))
      for(const item of f.querySelectorAll('[data-finding]'))if(!definitions.some(x=>x.key===item.dataset.finding)){item.hidden=true;for(const input of item.querySelectorAll('input,textarea,select'))input.required=false}
      f.dataset.definitions=JSON.stringify(definitions)
     }else{
      f.elements.approvalId.value=current.approval_id;f.elements.jobVersion.value=current.version;const tasks=JSON.parse(current.approval_snapshot).checklist||[current.title];f.elements.completedTasks.value='';f.elements.completedTasks.placeholder=tasks.join('\n');f.querySelector('[data-current-tasks]').textContent='Current approved tasks: '+tasks.join('; ')
     }
     f.dataset.version=current.version;conflict.hidden=true;status.textContent='Current scope reviewed. Complete the revised fields and explicitly sync again. Original findings remain in the reconciliation record.'
    }
    status.textContent='Conflict retained. Nothing was submitted.';return
   }
   const media={};for(const[k,file]of Object.entries(d.files)){status.textContent='Synchronizing original '+file.name+'…';media[k]=await upload(f,d,k,file)}
   const common={clientId:d.clientId,deviceConsentAt:d.consentAt,reconciliation:d.reconciliation}
   if(d.kind==='inspection'){
    const items=JSON.parse(f.dataset.definitions).map(x=>({key:x.key,condition:d.values['condition:'+x.key],notes:d.values['notes:'+x.key],reading:d.values['reading:'+x.key],mediaIds:media['file:'+x.key]?[media['file:'+x.key]]:[]}))
    await command('inspection.capture',{...common,inspectionId:f.dataset.record,version:d.version,items,source:d.values.source,capturedAt:d.values.capturedAt})
   }else await command('completion.record',{...d.values,...common,jobId:f.dataset.record,jobVersion:d.version,captureMode:'direct',fieldEvidence:'yes',beforePhotoId:media.beforeFile||d.values.beforePhotoId,afterPhotoId:media.afterFile||d.values.afterPhotoId})
   await draftStore('delete',key);status.textContent='Evidence synchronized. Device draft deleted.';location.reload()
  }catch(e){status.textContent=e.message+' The device draft is retained. No automatic retry or submission will occur.'}finally{button.disabled=false}
 })
}
