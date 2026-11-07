import test from 'node:test';
import assert from 'node:assert/strict';
import {transcribeUpload,MAX_RECORDING_BYTES} from '../transcription.mjs';

async function upload(files=[new Blob(['recorded audio'],{type:'audio/mp4'})]){
 const form=new FormData();
 for(const file of files)form.append('file',file,'private-filename.m4a');
 form.append('model','untrusted-model');
 const request=new Request('http://localhost',{method:'POST',body:form});
 return {type:request.headers.get('content-type'),bytes:Buffer.from(await request.arrayBuffer())};
}
test('gateway forwards one recording with server credentials and server-selected model',async()=>{
 const {type,bytes}=await upload();let calls=0;
 const result=await transcribeUpload(type,bytes,'server-secret',async(url,options)=>{
  calls++;
  assert.equal(url,'https://api.groq.com/openai/v1/audio/transcriptions');
  assert.equal(options.headers.Authorization,'Bearer server-secret');
  assert.equal(options.redirect,'error');
  assert.equal(options.body.get('model'),'whisper-large-v3-turbo');
  assert.equal(options.body.get('file').name,'nia-recording.m4a');
  assert.equal(await options.body.get('file').text(),'recorded audio');
  return Response.json({text:'  Hello Nia  '});
 });
 assert.deepEqual(result,{text:'Hello Nia'});assert.equal(calls,1);
});
test('invalid uploads are rejected before contacting a provider',async()=>{
 const cases=[
  {type:'application/json',bytes:Buffer.from('{}'),status:415},
  {type:'multipart/form-data; boundary=x',bytes:Buffer.alloc(MAX_RECORDING_BYTES+1),status:413},
  {...await upload([]),status:400},
  {...await upload([new Blob([],{type:'audio/mp4'})]),status:400},
  {...await upload([new Blob(['x'],{type:'image/png'})]),status:415},
  {...await upload([new Blob(['a'],{type:'audio/mp4'}),new Blob(['b'],{type:'audio/mp4'})]),status:400},
 ];
 for(const item of cases)await assert.rejects(transcribeUpload(item.type,item.bytes,'secret',()=>assert.fail('unexpected provider call')),e=>e.status===item.status);
});
test('provider errors do not disclose credentials or provider response bodies',async()=>{
 const {type,bytes}=await upload();
 for(const result of [Response.json({error:'server-secret'},{status:401}),Response.json({text:''}),Response.json({text:'x'.repeat(12001)}),new Response('not JSON')]){
  await assert.rejects(transcribeUpload(type,bytes,'server-secret',async()=>result),e=>e.status===502&&!e.message.includes('server-secret'));
 }
 await assert.rejects(transcribeUpload(type,bytes,'',()=>assert.fail()),e=>e.status===503);
 await assert.rejects(transcribeUpload(type,bytes,'key',async()=>{throw new Error('timeout')}),e=>e.status===502);
});
test('HTTP gateway authenticates uploads and accepts a valid recording end to end',async t=>{
 process.env.NIA_GATEWAY_TOKEN='client-test-token';process.env.GROQ_API_KEY='server-test-key';
 const {server}=await import('../nia-server.mjs');
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const originalFetch=globalThis.fetch;
 t.after(async()=>{globalThis.fetch=originalFetch;await new Promise(resolve=>server.close(resolve));});
 const base='http://127.0.0.1:'+server.address().port;
 const {type,bytes}=await upload();let forwarded=0;
 globalThis.fetch=async(url,options)=>{forwarded++;assert.equal(options.headers.Authorization,'Bearer server-test-key');return Response.json({text:'Voice works'});};
 const denied=await originalFetch(base+'/v1/transcribe',{method:'POST',headers:{'Content-Type':type},body:bytes});
 assert.equal(denied.status,401);assert.equal(forwarded,0);
 const accepted=await originalFetch(base+'/v1/transcribe',{method:'POST',headers:{'Content-Type':type,Authorization:'Bearer client-test-token'},body:bytes});
 assert.equal(accepted.status,200);assert.deepEqual(await accepted.json(),{text:'Voice works'});assert.equal(forwarded,1);
 const oversized=await originalFetch(base+'/v1/transcribe',{method:'POST',headers:{'Content-Type':type,Authorization:'Bearer client-test-token'},body:Buffer.alloc(MAX_RECORDING_BYTES+1)});
 assert.equal(oversized.status,413);assert.match((await oversized.json()).error,/10 MB/);assert.equal(forwarded,1);
 const health=await originalFetch(base+'/health');assert.equal((await health.json()).transcription_ready,true);
});

test('oversized upstream responses are cancelled before full buffering',async()=>{
 const {type,bytes}=await upload();let cancelled=false;
 await assert.rejects(transcribeUpload(type,bytes,'key',async()=>new Response(new ReadableStream({
  start(controller){controller.enqueue(new Uint8Array(100001));},
  cancel(){cancelled=true;},
 }))),e=>e.status===502);
 assert.equal(cancelled,true);
});
test('audio upload reads have a deadline and bounded bytes',async()=>{
 const {PassThrough}=await import('node:stream');
 const {readRecording}=await import('../transcription.mjs');
 const stalled=new PassThrough();
 await assert.rejects(readRecording(stalled,10,10),e=>e.status===408);
 const large=new PassThrough();const reading=readRecording(large,2);
 large.end(Buffer.from('abc'));
 await assert.rejects(reading,e=>e.status===413);
});
