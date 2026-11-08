import {secureUrl,fetchWithTimeout} from './network';
import {normalizeGatewayUrl} from './niaGateway';
export type RecordingConnection={gateway:boolean;endpoint:string;token:string};
export function validateRecordingConnection(connection:RecordingConnection):RecordingConnection{
 if(!connection.token.trim())throw new Error('Save your voice connection token first.');
 const endpoint=connection.gateway?normalizeGatewayUrl(connection.endpoint):secureUrl(connection.endpoint);
 if(!connection.gateway&&!new URL(endpoint).pathname.endsWith('/chat/completions'))
  throw new Error('Voice input requires a compatible endpoint ending in /chat/completions.');
 return {...connection,endpoint};
}
export async function transcribeRecording(uri:string,connection:RecordingConnection,signal?:AbortSignal):Promise<string>{
 const validated=validateRecordingConnection(connection);
 if(!validated.gateway)return transcribeAudio(uri,validated.endpoint,validated.token,signal);
 const body=new FormData();
 body.append('file',{uri,name:'nia-voice.m4a',type:'audio/mp4'} as unknown as Blob);
 const response=await fetchWithTimeout(validated.endpoint+'/v1/transcribe',{
  method:'POST',headers:{Authorization:'Bearer '+validated.token},body,signal,
 },60000);
 if(!response.ok)throw new Error(response.status===503?'Gateway voice provider is not configured.':
  response.status===413?'Recording is too large. Record a shorter message.':'Speech recognition returned HTTP '+response.status);
 const data=await response.json();
 if(typeof data?.text!=='string'||!data.text.trim()||data.text.length>12000)
  throw new Error('No usable speech was recognized.');
 return data.text.trim();
}
export async function transcribeAudio(uri:string,endpoint:string,token:string,signal?:AbortSignal):Promise<string>{
 const url=new URL(secureUrl(endpoint));
 if(!url.pathname.endsWith('/chat/completions'))throw new Error('Voice input requires a compatible endpoint ending in /chat/completions.');
 if(!token.trim())throw new Error('Configure your AI connection token before recording.');
 url.pathname=url.pathname.replace(/\/chat\/completions$/,'/audio/transcriptions');
 const body=new FormData();
 body.append('model','whisper-large-v3-turbo');
 body.append('file',{uri,name:'nia-voice.m4a',type:'audio/mp4'} as unknown as Blob);
 const response=await fetchWithTimeout(url.toString(),{method:'POST',headers:{Authorization:'Bearer '+token},body,signal},60000);
 if(!response.ok)throw new Error('Speech recognition returned HTTP '+response.status);
 const result=await response.json();
 if(typeof result?.text!=='string'||!result.text.trim()||result.text.length>12000)throw new Error('No usable speech was recognized.');
 return result.text.trim();
}
