// Resumption stores only an upload id and hash in sessionStorage, never file bytes.
const post=async(command,p={},file)=>{
 let body,headers
 if(file){body=new FormData();body.set('command',command);for(const [k,v]of Object.entries(p))body.set(k,v);body.set('file',file)}
 else{body=JSON.stringify({command,...p});headers={'content-type':'application/json'}}
 const r=await fetch('/api/commands',{method:'POST',headers,body}),b=await r.json()
 if(!r.ok)throw Error(b.message||'Upload failed');return b.result
}
const digest=async b=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',b)),x=>x.toString(16).padStart(2,'0')).join('')
for(const f of document.querySelectorAll('[data-media-upload]'))f.addEventListener('submit',async event=>{
 event.preventDefault();const button=f.querySelector('button'),status=f.querySelector('[data-upload-status]');button.disabled=true
 try{
  const file=f.elements.file.files[0];if(!file||file.size>25*1024*1024)throw Error('Choose an original file up to 25 MB.')
  status.textContent='Checking original bytes…';const sha256=await digest(await file.arrayBuffer()),option=f.elements.attachmentId.selectedOptions[0]
  const key='terrace-upload:'+f.dataset.kind+':'+f.dataset.record+':'+sha256+':'+option.value+':'+(option.dataset.version||'0')
  let saved;try{saved=JSON.parse(sessionStorage.getItem(key)||'null')}catch{}
  if(!saved){saved=await post('media.begin',{kind:f.dataset.kind,recordId:f.dataset.record,name:file.name,mediaType:file.type,size:file.size,sha256,capturedAt:f.elements.capturedAt.value,source:f.elements.source.value,attachmentId:option.value,version:option.dataset.version});sessionStorage.setItem(key,JSON.stringify(saved))}
  const r=await fetch('/api/record-media/upload?id='+encodeURIComponent(saved.id)),state=await r.json();if(!r.ok)throw Error(state.message||'Sign in again before resuming.')
  if(state.sha256!==sha256)throw Error('Choose the same original to resume.')
  const size=saved.chunkSize||262144,positions=new Set(state.positions)
  for(let i=0;i<Math.ceil(file.size/size);i++)if(!positions.has(i)){status.textContent=`Sending chunk ${i+1} of ${Math.ceil(file.size/size)}…`;await post('media.chunk',{uploadId:saved.id,position:i},file.slice(i*size,(i+1)*size))}
  await post('media.finish',{uploadId:saved.id});sessionStorage.removeItem(key);status.textContent='Original attached. Reloading…';location.reload()
 }catch(error){status.textContent=error.message+' Select the same original to resume, or contact your manager.'}finally{button.disabled=false}
})
