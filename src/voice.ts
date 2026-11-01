import {secureUrl,fetchWithTimeout} from './network';
export async function transcribeAudio(uri:string,endpoint:string,token:string):Promise<string>{
 const url=new URL(secureUrl(endpoint));
 if(!url.pathname.endsWith('/chat/completions'))throw new Error('Voice input requires a compatible endpoint ending in /chat/completions.');
 if(!token.trim())throw new Error('Configure your AI connection token before recording.');
 url.pathname=url.pathname.replace(/\/chat\/completions$/,'/audio/transcriptions');
 const body=new FormData();
 body.append('model','whisper-large-v3-turbo');
 body.append('file',{uri,name:'nia-voice.m4a',type:'audio/mp4'} as unknown as Blob);
 const response=await fetchWithTimeout(url.toString(),{method:'POST',headers:{Authorization:'Bearer '+token},body},60000);
 if(!response.ok)throw new Error('Speech recognition returned HTTP '+response.status);
 const result=await response.json();
 if(typeof result?.text!=='string'||!result.text.trim()||result.text.length>12000)throw new Error('No usable speech was recognized.');
 return result.text.trim();
}
