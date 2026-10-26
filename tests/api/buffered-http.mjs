import {createServer} from 'node:http'

// Deliver the real Worker response through Node's buffered HTTP transport. This
// keeps a hosted checkout's cross-site return independent of Miniflare's socket.
export async function bufferedHttp(dispatch){
 const server=createServer(async(req,res)=>{
  try{
   const chunks=[];for await(const chunk of req)chunks.push(chunk)
   const headers=new Headers();for(const [name,value]of Object.entries(req.headers))if(value)headers.set(name,Array.isArray(value)?value.join(', '):value)
   const response=await dispatch('http://'+req.headers.host+req.url,{method:req.method,headers,redirect:'manual',...(['GET','HEAD'].includes(req.method)?{}:{body:Buffer.concat(chunks)})})
   const bytes=Buffer.from(await response.arrayBuffer())
   for(const [name,value]of response.headers)if(!['set-cookie','content-length','transfer-encoding','connection'].includes(name))res.setHeader(name,value)
   const cookies=response.headers.getSetCookie();if(cookies.length)res.setHeader('set-cookie',cookies)
   res.setHeader('content-length',bytes.length);res.writeHead(response.status);res.end(bytes)
  }catch{res.writeHead(500);res.end('Worker transport failed')}
 })
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve)})
 return {origin:'http://127.0.0.1:'+server.address().port,close:()=>new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()))}
}
