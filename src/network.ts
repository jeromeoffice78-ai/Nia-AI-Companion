/** Validate the complete URL before sending credentials or private content. */
export function secureUrl(input:string):string {
 let url:URL;
 try{url=new URL(input.trim());}catch{throw new Error('Enter a valid server URL.');}
 const loopback=['localhost','127.0.0.1','[::1]'].includes(url.hostname);
 if(url.protocol!=='https:'&&!(url.protocol==='http:'&&loopback))throw new Error('Use HTTPS for remote servers.');
 if(!url.hostname||url.username||url.password||url.search||url.hash)throw new Error('Server URLs must not contain credentials, query strings, or fragments.');
 return url.toString().replace(/\/+$/,'');
}
export async function fetchWithTimeout(url:string,options:RequestInit={},timeoutMs=35000):Promise<Response>{
 const controller=new AbortController();
 const abort=()=>controller.abort();
 if(options.signal?.aborted)abort();
 options.signal?.addEventListener('abort',abort);
 const timer=setTimeout(()=>controller.abort(),timeoutMs);
 try{
  const response=await fetch(url,{...options,signal:controller.signal,redirect:'error'});
  // Consume the response while the timer is still active: headers alone do not
  // mean a stalled body has finished downloading.
  const body=await response.text();
  if(body.length>1000000)throw new Error('Server response exceeds size limit.');
  return new Response(body,{status:response.status,headers:response.headers});
 }catch(e){
  if(controller.signal.aborted)throw new Error('Connection timed out. Please retry.');
  throw e;
 }finally{clearTimeout(timer);options.signal?.removeEventListener('abort',abort);}
}
