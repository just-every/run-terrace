/** Use the same current-session authorization door as the native restricted-original link. */
export async function documentOriginal(h,id,opts={}){
 const access=await h.request('/api/document-access?id='+encodeURIComponent(id)+'&format=json',opts)
 if(!access.ok)return access
 return h.request((await access.json()).url,opts)
}
