import http from 'node:http';
import {randomBytes,timingSafeEqual} from 'node:crypto';
import {idToViseme,timingToCues} from './speechTiming.mjs';

const PORT=Number(process.env.PORT||8080);
const ACCESS=process.env.NIA_GATEWAY_TOKEN||'';
const GROQ_KEY=process.env.GROQ_API_KEY||'';
const AZURE_KEY=process.env.AZURE_SPEECH_KEY||'';
const AZURE_REGION=process.env.AZURE_SPEECH_REGION||'';
const VOICE=process.env.AZURE_SPEECH_VOICE||'en-US-JennyNeural';
const AUDIO_TTL=120000;
const stored=new Map();
function json(res,status,obj){
 const data=Buffer.from(JSON.stringify(obj));
 res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Content-Length':data.length,'Cache-Control':'no-store'});
 res.end(data);
}
function allowed(req){
 if(!ACCESS)return false;
 const token=req.headers.authorization?.match(/^Bearer (.+)$/i)?.[1]||'';
 const a=Buffer.from(token),b=Buffer.from(ACCESS);
 return a.length===b.length&&timingSafeEqual(a,b);
}
async function body(req,max=140000){
 let chunks=[],size=0;
 for await(const chunk of req){
  size+=chunk.length;
  if(size>max)throw Error('Request too large');
  chunks.push(chunk);
 }
 const data=JSON.parse(Buffer.concat(chunks).toString('utf8'));
 if(!data||typeof data!=='object')throw Error('Expected JSON object');
 return data;
}
async function synthesize(text){
 const sdk=await import('microsoft-cognitiveservices-speech-sdk');
 const config=sdk.SpeechConfig.fromSubscription(AZURE_KEY,AZURE_REGION);
 config.speechSynthesisVoiceName=VOICE;
 config.speechSynthesisOutputFormat=sdk.SpeechSynthesisOutputFormat.Audio24Khz48KBitRateMonoMp3;
 const synth=new sdk.SpeechSynthesizer(config,null);
 const events=[];
 synth.visemeReceived=(_sender,e)=>{
  if(events.length<2500)events.push({timeMs:e.audioOffset/10000,id:e.visemeId});
 };
 try{
  const result=await new Promise((resolve,reject)=>synth.speakTextAsync(text,resolve,reject));
  if(result.reason!==sdk.ResultReason.SynthesizingAudioCompleted)throw Error('Azure speech synthesis failed');
  const audio=Buffer.from(result.audioData);
  if(audio.length<128||audio.length>4*1024*1024)throw Error('Speech audio too large or empty');
  const last=events.at(-1)?.timeMs||0;
  const durationMs=Math.min(120000,Math.max(last+180,0));
  return {audio,cues:timingToCues(events,durationMs)};
 }finally{synth.close();}
}
async function chat(data){
 if(!GROQ_KEY)throw Error('GROQ_API_KEY missing');
 const messages=data.messages;
 if(!Array.isArray(messages)||messages.length<1||messages.length>42||
   messages.some(m=>!m||!['user','assistant'].includes(m.role)||typeof m.content!=='string'||m.content.length>12000))
   throw Error('Invalid conversation');
 const mode=['companion','business','research'].includes(data.mode)?data.mode:'companion';
 const answer=await fetch('https://api.groq.com/openai/v1/chat/completions',{
  method:'POST',headers:{Authorization:'Bearer '+GROQ_KEY,'Content-Type':'application/json'},
  body:JSON.stringify({model:process.env.GROQ_MODEL||'llama-3.3-70b-versatile',stream:false,
   messages:[{role:'system',content:'You are Nia, a truthful, caring AI companion. Mode: '+mode+'. Remain respectful and do not pretend to be human.'},...messages]})
  ,signal:AbortSignal.timeout(27000)
 });
 if(!answer.ok)throw Error('Groq HTTP '+answer.status);
 const raw=await answer.json();
 const text=raw?.choices?.[0]?.message?.content;
 if(typeof text!=='string'||text.length>16000||!text.trim())throw Error('Invalid Groq response');
 return {answer:text,model:raw.model||'groq'};
}
const server=http.createServer(async(req,res)=>{
 const path=new URL(req.url||'/', 'http://localhost').pathname;
 if(path==='/health'&&req.method==='GET'){
  return json(res,ACCESS?200:503,{status:ACCESS?'ok':'not_configured',service:'nia-api',
    voice_ready:Boolean(AZURE_KEY&&AZURE_REGION),chat_ready:Boolean(GROQ_KEY)});
 }
 if(!allowed(req))return json(res,401,{error:'Unauthorized'});
 try{
  if(path==='/v1/chat'&&req.method==='POST'){
   if(!GROQ_KEY)return json(res,503,{error:'Chat provider not configured'});
   return json(res,200,await chat(await body(req)));
  }
  if(path==='/v1/speech'&&req.method==='POST'){
   if(!AZURE_KEY||!AZURE_REGION)return json(res,503,{error:'Aligned voice not configured'});
   const data=await body(req,20000);
   if(typeof data.text!=='string'||data.text.length<1||data.text.length>4000)return json(res,400,{error:'Invalid speech text'});
   const packet=await synthesize(data.text);
   const id=randomBytes(18).toString('base64url');
   stored.set(id,{audio:packet.audio,expires:Date.now()+AUDIO_TTL});
   // Limit cached audio; drop expired and oldest first.
   for(const [key,val] of stored)if(val.expires<Date.now()||stored.size>8)stored.delete(key);
   return json(res,200,{audioPath:'/v1/speech/audio/'+id,format:'audio/mpeg',visemes:packet.cues});
  }
  const id=path.match(/^\/v1\/speech\/audio\/([A-Za-z0-9_-]{12,100})$/)?.[1];
  if(id&&req.method==='GET'){
   const item=stored.get(id);
   if(!item||item.expires<Date.now())return json(res,404,{error:'Audio expired'});
   res.writeHead(200,{'Content-Type':'audio/mpeg','Content-Length':item.audio.length,'Cache-Control':'no-store'});
   return res.end(item.audio);
  }
  return json(res,404,{error:'Not found'});
 }catch(err){
  console.error('Nia gateway request failed:',err instanceof Error?err.name:'Error');
  return json(res,500,{error:'Nia speech or chat provider failed'});
 }
});
if(import.meta.url===new URL('file://'+process.argv[1]).href)server.listen(PORT,()=>console.log('Nia speech gateway on '+PORT));
export {server};
