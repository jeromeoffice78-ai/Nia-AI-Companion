export const MAX_RECORDING_BYTES=10*1024*1024;
export class TranscriptionError extends Error {
 constructor(status,message){super(message);this.status=status;}
}
export function readRecording(req,max=MAX_RECORDING_BYTES,timeoutMs=30000){
 return new Promise((resolve,reject)=>{
  const chunks=[];let size=0;
  const cleanup=()=>{clearTimeout(timer);req.off('data',data);req.off('end',end);req.off('error',error);req.off('aborted',aborted);};
  const fail=err=>{cleanup();req.resume();reject(err);};
  const data=chunk=>{size+=chunk.length;if(size>max)return fail(new TranscriptionError(413,'Recording exceeds the 10 MB limit'));chunks.push(chunk);};
  const end=()=>{cleanup();resolve(Buffer.concat(chunks));};
  const error=()=>fail(new TranscriptionError(400,'Audio upload interrupted'));
  const aborted=()=>error();
  const timer=setTimeout(()=>fail(new TranscriptionError(408,'Audio upload timed out')),timeoutMs);
  req.on('data',data);req.once('end',end);req.once('error',error);req.once('aborted',aborted);
 });
}
async function providerText(response){
 if(!response.body)throw new Error('Missing provider body');
 const reader=response.body.getReader();const chunks=[];let size=0;
 try{
  while(true){
   const {done,value}=await reader.read();if(done)break;
   size+=value.byteLength;
   if(size>100000){await reader.cancel();throw new Error('Oversized provider response');}
   chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks).toString('utf8');
 }finally{reader.releaseLock();}
}

/** Parse bounded audio and forward only the recording to a fixed provider URL. */
export async function transcribeUpload(contentType,bytes,key,fetchImpl=fetch,signal){
 if(!key)throw new TranscriptionError(503,'Voice provider not configured');
 if(!bytes.length||bytes.length>MAX_RECORDING_BYTES)
  throw new TranscriptionError(413,'Recording exceeds the 10 MB limit');
 if(typeof contentType!=='string'||!/^multipart\/form-data\s*;/i.test(contentType))
  throw new TranscriptionError(415,'Expected multipart audio');
 let form;
 try{
  form=await new Request('http://localhost/upload',{
   method:'POST',headers:{'Content-Type':contentType},body:bytes,
  }).formData();
 }catch{throw new TranscriptionError(400,'Invalid multipart audio');}
 const files=form.getAll('file');
 const audio=files[0];
 if(files.length!==1||!audio||typeof audio==='string'||!audio.size)
  throw new TranscriptionError(400,'One nonempty audio file is required');
 const formats=new Map([
  ['audio/mp4','m4a'],['audio/m4a','m4a'],['audio/x-m4a','m4a'],
  ['audio/mpeg','mp3'],['audio/wav','wav'],['audio/x-wav','wav'],['audio/webm','webm'],
 ]);
 const extension=formats.get(audio.type);
 if(!extension)throw new TranscriptionError(415,'Unsupported recording format');
 const outgoing=new FormData();
 outgoing.set('file',audio,'nia-recording.'+extension);
 outgoing.set('model','whisper-large-v3-turbo');
 outgoing.set('response_format','json');
 try{
  const result=await fetchImpl('https://api.groq.com/openai/v1/audio/transcriptions',{
   method:'POST',headers:{Authorization:'Bearer '+key},body:outgoing,
   signal:signal?AbortSignal.any([signal,AbortSignal.timeout(55000)]):AbortSignal.timeout(55000),redirect:'error',
  });
  if(!result.ok)throw new Error('Voice provider rejected request');
  const text=await providerText(result);
  const data=JSON.parse(text);
  if(typeof data?.text!=='string'||!data.text.trim()||data.text.length>12000)
   throw new Error('No usable speech recognized');
  return {text:data.text.trim()};
 }catch{throw new TranscriptionError(502,'Speech recognition failed; retry the recording');}
}
