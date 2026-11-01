export type NiaRole='user'|'assistant';
export type NiaMessage={role:NiaRole;content:string};
export type NiaMode='companion'|'research'|'business';
export type NiaGatewaySettings={baseUrl:string;clientToken:string};
export type NiaChatResult={answer:string;model:string};
export class NiaGatewayError extends Error{
 constructor(message:string,public readonly status?:number){super(message);this.name='NiaGatewayError';}
}
export function normalizeGatewayUrl(input:string):string{
 const url=input.trim().replace(/\/+$/,'');
 if(!/^https:\/\//i.test(url)&&!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(url)){
  throw new NiaGatewayError('Gateway must use HTTPS (localhost is permitted for development).');
 }
 if(url.endsWith('/v1/chat')||url.endsWith('/health'))throw new NiaGatewayError('Enter the API base URL, not an endpoint path.');
 return url;
}
export async function checkGateway(baseUrl:string):Promise<boolean>{
 const url=normalizeGatewayUrl(baseUrl);
 const controller=new AbortController();
 const timeout=setTimeout(()=>controller.abort(),8000);
 try{
  const response=await fetch(url+'/health',{signal:controller.signal});
  if(!response.ok)return false;
  const body=await response.json();
  return body?.status==='ok'&&body?.service==='nia-api';
 }finally{clearTimeout(timeout);}
}
export async function chatWithGateway(settings:NiaGatewaySettings,messages:NiaMessage[],mode:NiaMode,flirty:boolean):Promise<NiaChatResult>{
 const baseUrl=normalizeGatewayUrl(settings.baseUrl);
 if(!settings.clientToken.trim())throw new NiaGatewayError('Enter a gateway access token.');
 if(!messages.length)throw new NiaGatewayError('Conversation is empty.');
 if(messages.some(m=>!['user','assistant'].includes(m.role)||typeof m.content!=='string'||m.content.length>16000))throw new NiaGatewayError('Invalid or oversized conversation message.');
 const controller=new AbortController();
 const timeout=setTimeout(()=>controller.abort(),35000);
 try{
  const response=await fetch(baseUrl+'/v1/chat',{
   method:'POST',signal:controller.signal,
   headers:{'Content-Type':'application/json',Authorization:'Bearer '+settings.clientToken},
   body:JSON.stringify({messages:messages.slice(-40),mode,flirty})
  });
  if(!response.ok)throw new NiaGatewayError(response.status===401?'Gateway access token rejected':response.status===503?'Gateway not configured':'Gateway returned HTTP '+response.status,response.status);
  const raw=await response.text();
  if(raw.length>1000000)throw new NiaGatewayError('Gateway response exceeds size limit.');
  let result:unknown;
  try{result=JSON.parse(raw);}catch{throw new NiaGatewayError('Gateway returned malformed JSON.');}
  const payload=result as {answer?:unknown;model?:unknown}|null;
  if(typeof payload?.answer!=='string'||!payload.answer.trim()||payload.answer.length>16000||typeof payload?.model!=='string'||!payload.model.trim())throw new NiaGatewayError('Unexpected gateway response.');
  return {answer:payload.answer,model:payload.model};
 }catch(error){
  if(error instanceof NiaGatewayError)throw error;
  throw new NiaGatewayError('Gateway connection failed: '+String(error));
 }finally{clearTimeout(timeout);}
}
